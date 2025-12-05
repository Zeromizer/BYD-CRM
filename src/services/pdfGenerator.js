/**
 * PDFGenerator - Generate print-ready PDFs from rendered canvases
 *
 * Features:
 * - Multi-page PDF support
 * - Automatic double-sided setup
 * - Perfect for printing
 * - High quality output
 *
 * NOTE: jsPDF is lazy-loaded to reduce initial bundle size
 */

// Cache the jsPDF module after first load
let jsPDFModule = null;

/**
 * Lazy load jsPDF module
 */
const loadJsPDF = async () => {
  if (!jsPDFModule) {
    const module = await import('jspdf');
    jsPDFModule = module.default || module.jsPDF;
  }
  return jsPDFModule;
};

class PDFGenerator {
  constructor() {
    // A4 dimensions in inches
    this.a4Width = 8.27;
    this.a4Height = 11.69;

    // A4 dimensions in mm (jsPDF default unit)
    this.a4WidthMM = 210;
    this.a4HeightMM = 297;
  }

  /**
   * Generate PDF from single canvas
   */
  async generateSinglePagePDF(canvas, options = {}) {
    const {
      orientation = 'portrait',
      filename = 'document.pdf',
      title = 'Document',
    } = options;

    // Lazy load jsPDF
    const jsPDF = await loadJsPDF();

    // Create PDF
    const pdf = new jsPDF({
      orientation,
      unit: 'in',
      format: 'a4',
      compress: true,
    });

    // Add metadata
    pdf.setProperties({
      title,
      subject: 'BYD CRM Document',
      author: 'BYD MotorEast CRM',
      creator: 'BYD CRM System',
    });

    // Add canvas as image (use NONE compression for best quality)
    const imgData = canvas.toDataURL('image/jpeg', 1.0);
    pdf.addImage(
      imgData,
      'JPEG',
      0,
      0,
      this.a4Width,
      this.a4Height,
      undefined,
      'NONE'
    );

    return pdf;
  }

  /**
   * Generate PDF from multiple canvases (multi-page)
   */
  async generateMultiPagePDF(canvases, options = {}) {
    const {
      orientation = 'portrait',
      filename = 'document.pdf',
      title = 'Document',
    } = options;

    if (!canvases || canvases.length === 0) {
      throw new Error('No canvases provided');
    }

    // Lazy load jsPDF
    const jsPDF = await loadJsPDF();

    // Create PDF
    const pdf = new jsPDF({
      orientation,
      unit: 'in',
      format: 'a4',
      compress: true,
    });

    // Add metadata
    pdf.setProperties({
      title,
      subject: 'BYD CRM Document',
      author: 'BYD MotorEast CRM',
      creator: 'BYD CRM System',
    });

    // Add each canvas as a page (use NONE compression for best quality)
    canvases.forEach((canvas, index) => {
      if (index > 0) {
        pdf.addPage();
      }

      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      pdf.addImage(
        imgData,
        'JPEG',
        0,
        0,
        this.a4Width,
        this.a4Height,
        undefined,
        'NONE'
      );
    });

    return pdf;
  }

  /**
   * Download PDF
   */
  downloadPDF(pdf, filename) {
    pdf.save(filename);
  }

  /**
   * Get PDF as blob (for uploading to Drive)
   */
  getPDFBlob(pdf) {
    return pdf.output('blob');
  }

  /**
   * Get PDF as data URL
   */
  getPDFDataUrl(pdf) {
    return pdf.output('dataurlstring');
  }

  /**
   * Open PDF in new window for printing
   */
  openPDFInPrintWindow(pdf, title = 'Print Document') {
    const blob = this.getPDFBlob(pdf);
    const url = URL.createObjectURL(blob);

    const printWindow = window.open(url, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.document.title = title;
      };
    }

    // Clean up blob URL after some time
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  /**
   * Generate PDF from rendered documents (OPTIMIZED)
   * Uses pre-generated dataUrls to avoid re-encoding canvases
   */
  async generatePDFFromRenders(renders, options = {}) {
    const {
      orientation = 'portrait',
      title = 'Document',
    } = options;

    if (!renders || renders.length === 0) {
      throw new Error('No renders provided');
    }

    // Lazy load jsPDF
    const jsPDF = await loadJsPDF();

    // Create PDF
    const pdf = new jsPDF({
      orientation,
      unit: 'in',
      format: 'a4',
      compress: true,
    });

    // Add metadata
    pdf.setProperties({
      title,
      subject: 'BYD CRM Document',
      author: 'BYD MotorEast CRM',
      creator: 'BYD CRM System',
    });

    // OPTIMIZED: Use existing dataUrls instead of re-encoding canvases
    renders.forEach((render, index) => {
      if (index > 0) {
        pdf.addPage();
      }

      // Use pre-generated dataUrl if available, otherwise fall back to canvas
      const imgData = render.dataUrl || render.canvas.toDataURL('image/jpeg', 1.0);
      pdf.addImage(
        imgData,
        'JPEG',
        0,
        0,
        this.a4Width,
        this.a4Height,
        undefined,
        'NONE'
      );
    });

    return pdf;
  }

  /**
   * Calculate PDF page count
   */
  getPageCount(pdf) {
    return pdf.internal.pages.length - 1; // -1 because first page is template
  }

  /**
   * Get PDF file size
   */
  getPDFSize(pdf) {
    const blob = this.getPDFBlob(pdf);
    return blob.size;
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}

export default new PDFGenerator();
