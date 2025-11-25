import authService from './authService';

/**
 * Form Render Service - Unified rendering for forms with DPI awareness
 *
 * Key concepts:
 * - Form images are typically scanned/created at 300 DPI for print quality
 * - A4 at 300 DPI = 2480 x 3508 pixels
 * - Font sizes are specified in "points" (pt) - a typographic unit
 * - 1 point = 1/72 inch, so at 300 DPI: 1pt = 300/72 = 4.167 pixels
 *
 * This service provides:
 * - Consistent rendering between preview and print
 * - DPI-aware font sizing
 * - Canvas-based rendering for WYSIWYG
 */

// Standard print DPI for forms (most scanned forms are 300 DPI)
const PRINT_DPI = 300;

// Points to pixels conversion at 300 DPI
// 1 point = 1/72 inch, at 300 DPI = 300/72 = 4.167 pixels
const POINTS_TO_PIXELS_RATIO = PRINT_DPI / 72;

// Common form sizes at 300 DPI
export const FORM_SIZES = {
  A4_PORTRAIT: { width: 2480, height: 3508, name: 'A4 Portrait' },
  A4_LANDSCAPE: { width: 3508, height: 2480, name: 'A4 Landscape' },
  LETTER_PORTRAIT: { width: 2550, height: 3300, name: 'Letter Portrait' },
  LETTER_LANDSCAPE: { width: 3300, height: 2550, name: 'Letter Landscape' },
};

// Font size presets in points (standard typographic sizes)
export const FONT_SIZE_PRESETS = [
  { value: 8, label: '8pt (Small)' },
  { value: 9, label: '9pt' },
  { value: 10, label: '10pt' },
  { value: 11, label: '11pt' },
  { value: 12, label: '12pt (Normal)' },
  { value: 14, label: '14pt' },
  { value: 16, label: '16pt' },
  { value: 18, label: '18pt (Large)' },
  { value: 20, label: '20pt' },
  { value: 24, label: '24pt' },
  { value: 28, label: '28pt' },
  { value: 32, label: '32pt' },
  { value: 36, label: '36pt (Heading)' },
  { value: 48, label: '48pt' },
  { value: 72, label: '72pt (Title)' },
];

class FormRenderService {
  /**
   * Convert points to pixels at 300 DPI
   * @param {number} points - Font size in points
   * @returns {number} - Font size in pixels
   */
  pointsToPixels(points) {
    return Math.round(points * POINTS_TO_PIXELS_RATIO);
  }

  /**
   * Convert pixels to points at 300 DPI
   * @param {number} pixels - Font size in pixels
   * @returns {number} - Font size in points
   */
  pixelsToPoints(pixels) {
    return Math.round(pixels / POINTS_TO_PIXELS_RATIO);
  }

  /**
   * Get suggested font size in points based on image dimensions
   * Assumes the image is meant to print at A4 size
   * @param {number} imageWidth - Image width in pixels
   * @param {number} imageHeight - Image height in pixels
   * @returns {number} - Estimated DPI of the image
   */
  estimateImageDPI(imageWidth, imageHeight) {
    // Assume A4 paper (210mm x 297mm = 8.27" x 11.69")
    const a4WidthInches = 8.27;
    const a4HeightInches = 11.69;

    // Calculate DPI based on which dimension fits A4 better
    const dpiFromWidth = imageWidth / a4WidthInches;
    const dpiFromHeight = imageHeight / a4HeightInches;

    // Return the average, or use width for landscape images
    if (imageWidth > imageHeight) {
      // Landscape orientation
      return Math.round((imageWidth / a4HeightInches + imageHeight / a4WidthInches) / 2);
    }

    return Math.round((dpiFromWidth + dpiFromHeight) / 2);
  }

  /**
   * Get scale factor for rendering at a specific display size
   * @param {number} imageWidth - Original image width
   * @param {number} displayWidth - Target display width
   * @returns {number} - Scale factor
   */
  getScaleFactor(imageWidth, displayWidth) {
    return displayWidth / imageWidth;
  }

  /**
   * Fetch form image from Google Drive as base64
   * @param {string} fileId - Google Drive file ID
   * @returns {Promise<string>} - Base64 image data URL
   */
  async fetchFormImage(fileId) {
    try {
      const token = authService.getAccessToken();

      if (!token) {
        throw new Error('No access token available. Please sign in again.');
      }

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();

      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read image data'));
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error fetching form image:', error);
      throw error;
    }
  }

  /**
   * Load an image from a base64 data URL or URL
   * @param {string} src - Image source (base64 or URL)
   * @returns {Promise<HTMLImageElement>} - Loaded image element
   */
  loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = src;
    });
  }

  /**
   * Get customer data mapping for form population
   * @param {Object} customer - Customer data object
   * @returns {Object} - Mapped customer data
   */
  getCustomerDataMapping(customer) {
    const today = new Date().toLocaleDateString();

    const parseCurrency = (value) => {
      if (!value) return 0;
      const numericValue = parseFloat(value.toString().replace(/[^0-9.-]/g, ''));
      return isNaN(numericValue) ? 0 : numericValue;
    };

    const insuranceFee = parseCurrency(customer.vsa_insuranceFee);
    const subsidy = parseCurrency(customer.vsa_insuranceSubsidy);
    const netInsuranceFee = insuranceFee - subsidy;

    return {
      // Basic Customer Information
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      nric: customer.nric || '',
      occupation: customer.occupation || '',
      dob: customer.dob || '',
      address: customer.address || '',
      addressContinue: customer.addressContinue || '',
      fullAddress: ((customer.address || '') + (customer.addressContinue ? ', ' + customer.addressContinue : '')).trim(),
      salesConsultant: customer.salesConsultant || '',
      vsaNo: customer.vsaNo || '',
      date: today,

      // VSA Details - BYD New Car Details
      makeModel: customer.vsa_makeModel || '',
      yom: customer.vsa_yom || '',
      bodyColour: customer.vsa_bodyColour || '',
      upholstery: customer.vsa_upholstery || '',
      przType: customer.vsa_przType || '',

      // VSA Details - BYD New Car Package
      package: customer.vsa_package || '',
      sellingWithCOE: customer.vsa_sellingWithCOE || '',
      sellingPriceList: customer.vsa_sellingPriceList || '',
      purchasePriceWithCOE: customer.vsa_purchasePriceWithCOE || '',
      coeRebateLevel: customer.vsa_coeRebateLevel || '',
      deposit: customer.vsa_deposit || '',
      lessOthers: customer.vsa_lessOthers || '',
      addOthers: customer.vsa_addOthers || '',
      deliveryDate: customer.vsa_deliveryDate || '',

      // VSA Details - Trade In Car Details
      tradeInCarNo: customer.vsa_tradeInCarNo || '',
      tradeInCarModel: customer.vsa_tradeInCarModel || '',
      tradeInAmount: customer.vsa_tradeInAmount || '',

      // VSA Details - Delivery Details
      dateOfRegistration: customer.vsa_dateOfRegistration || '',
      registrationNo: customer.vsa_registrationNo || '',
      chassisNo: customer.vsa_chassisNo || '',
      engineNo: customer.vsa_engineNo || '',
      motorNo: customer.vsa_motorNo || '',

      // VSA Details - Insurance
      insuranceCompany: customer.vsa_insuranceCompany || '',
      insuranceFee: customer.vsa_insuranceFee || '',
      insuranceFeeNet: netInsuranceFee.toFixed(2),

      // VSA Details - Remarks
      remarks1: customer.vsa_remarks1 || '',
      remarks2: customer.vsa_remarks2 || '',
      loanAmount: customer.vsa_loanAmount || '',
      interest: customer.vsa_interest || '',
      tenure: customer.vsa_tenure || '',
      adminFee: customer.vsa_adminFee || '',
      insuranceSubsidy: customer.vsa_insuranceSubsidy || '',
      monthlyRepayment: customer.vsa_monthlyRepayment || '',

      // Proposal Details
      proposalModel: customer.proposal_model || '',
      proposalBank: customer.proposal_bank || '',
      proposalSellingPrice: customer.proposal_sellingPrice || '',
      proposalInterestRate: customer.proposal_interestRate || '',
      proposalDownpayment: customer.proposal_downpayment || '',
      proposalLoanTenure: customer.proposal_loanTenure || '',
      proposalLoanAmount: customer.proposal_loanAmount || '',
      proposalAdminFee: customer.proposal_adminFee || '',
      proposalReferralFee: customer.proposal_referralFee || '',
      proposalTradeInModel: customer.proposal_tradeInModel || '',
      proposalLowLoanSurcharge: customer.proposal_lowLoanSurcharge || '',
      proposalTradeInCarPlate: customer.proposal_tradeInCarPlate || '',
      proposalNoLoanSurcharge: customer.proposal_noLoanSurcharge || '',
      proposalQuotedTradeInPrice: customer.proposal_quotedTradeInPrice || '',
      proposalBenefit1: customer.proposal_benefit1 || '',
      proposalBenefit2: customer.proposal_benefit2 || '',
      proposalBenefit3: customer.proposal_benefit3 || '',
      proposalBenefit4: customer.proposal_benefit4 || '',
      proposalBenefit5: customer.proposal_benefit5 || '',
      proposalBenefitsGiven: customer.proposal_benefitsGiven || '',
      proposalRemarks: customer.proposal_remarks || '',
    };
  }

  /**
   * Render form with customer data to a canvas
   * This is the main rendering function used for both preview and print
   *
   * @param {HTMLCanvasElement} canvas - Canvas element to render to
   * @param {HTMLImageElement} formImage - Form background image
   * @param {Object} fieldMappings - Field mappings configuration
   * @param {Object} customerData - Customer data mapping (from getCustomerDataMapping)
   * @param {Object} options - Rendering options
   * @param {number} options.scale - Scale factor for display (1 = full size)
   * @param {boolean} options.showMarkers - Whether to show field markers
   * @param {string} options.selectedFieldId - ID of currently selected field
   * @param {boolean} options.usePoints - Whether font sizes are in points (true) or pixels (false)
   */
  renderFormToCanvas(canvas, formImage, fieldMappings, customerData, options = {}) {
    const {
      scale = 1,
      showMarkers = false,
      selectedFieldId = null,
      usePoints = true,
    } = options;

    // Set canvas dimensions
    canvas.width = formImage.width * scale;
    canvas.height = formImage.height * scale;

    const ctx = canvas.getContext('2d');

    // Enable high-quality rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background image
    ctx.drawImage(formImage, 0, 0, canvas.width, canvas.height);

    // Draw each field
    if (fieldMappings) {
      for (const [fieldId, field] of Object.entries(fieldMappings)) {
        // Get text value
        let text = '';
        if (field.customValue) {
          text = field.customValue;
        } else if (customerData) {
          text = customerData[field.type] || '';
        }

        // Calculate font size in pixels
        let fontSizePixels = field.fontSize || 12;
        if (usePoints) {
          fontSizePixels = this.pointsToPixels(field.fontSize || 12);
        }

        // Apply scale
        const scaledFontSize = fontSizePixels * scale;
        const scaledX = field.x * scale;
        const scaledY = field.y * scale;

        // Draw field marker if in edit mode
        if (showMarkers) {
          const isSelected = fieldId === selectedFieldId;

          // Draw position marker
          ctx.beginPath();
          ctx.arc(scaledX, scaledY, 8 * scale, 0, Math.PI * 2);
          ctx.fillStyle = isSelected ? 'rgba(231, 76, 60, 0.5)' : 'rgba(0, 188, 212, 0.3)';
          ctx.fill();
          ctx.strokeStyle = isSelected ? '#e74c3c' : '#00bcd4';
          ctx.lineWidth = 2 * scale;
          ctx.stroke();

          // Draw field label
          ctx.font = `bold ${12 * scale}px Arial`;
          ctx.fillStyle = isSelected ? '#e74c3c' : '#00bcd4';
          const label = field.customValue
            ? `Custom: "${field.customValue.substring(0, 15)}${field.customValue.length > 15 ? '...' : ''}"`
            : (FIELD_NAMES[field.type] || field.type);
          ctx.fillText(label, scaledX + 12 * scale, scaledY + 4 * scale);
        }

        // Draw the actual text
        if (text) {
          ctx.font = `${scaledFontSize}px Arial`;
          ctx.fillStyle = field.color || '#000000';
          ctx.textBaseline = 'top';
          ctx.fillText(text, scaledX, scaledY);
        }
      }
    }
  }

  /**
   * Render form to a data URL (for printing or downloading)
   * @param {string} fileId - Google Drive file ID of the form
   * @param {Object} fieldMappings - Field mappings configuration
   * @param {Object} customer - Customer object
   * @param {Object} options - Rendering options
   * @returns {Promise<string>} - Base64 data URL of rendered form
   */
  async renderFormToDataURL(fileId, fieldMappings, customer, options = {}) {
    const { quality = 0.95, usePoints = true } = options;

    // Fetch and load the form image
    const base64Data = await this.fetchFormImage(fileId);
    const formImage = await this.loadImage(base64Data);

    // Create off-screen canvas
    const canvas = document.createElement('canvas');

    // Get customer data mapping
    const customerData = customer ? this.getCustomerDataMapping(customer) : null;

    // Render at full resolution (scale = 1)
    this.renderFormToCanvas(canvas, formImage, fieldMappings, customerData, {
      scale: 1,
      showMarkers: false,
      usePoints,
    });

    // Return as JPEG data URL
    return canvas.toDataURL('image/jpeg', quality);
  }

  /**
   * Create a print-ready window with form(s)
   * Supports single page and double-sided printing
   *
   * @param {Array<{dataUrl: string, name: string}>} pages - Array of page data
   * @param {string} customerName - Customer name for title
   * @param {Object} options - Print options
   */
  openPrintWindow(pages, customerName, options = {}) {
    const { title = 'Print Form' } = options;

    const printWin = window.open('', '_blank');

    const pagesHtml = pages.map((page, index) => `
      <div class="page">
        <img src="${page.dataUrl}" alt="${page.name}">
      </div>
    `).join('');

    const pageInfo = pages.length > 1
      ? pages.map((p, i) => `Page ${i + 1}: ${p.name}`).join('<br>')
      : pages[0].name;

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${customerName} - ${title}</title>
        <style>
          @page {
            size: A4;
            margin: 0;
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          html, body {
            width: 100%;
            height: 100%;
          }
          body {
            font-family: Arial, sans-serif;
            background: #34495e;
          }
          .page {
            width: 210mm;
            height: 297mm;
            background: white;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 20px auto;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            page-break-after: always;
            overflow: hidden;
          }
          .page:last-child {
            page-break-after: auto;
          }
          .page img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
          }
          .controls {
            position: fixed;
            top: 20px;
            right: 20px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            z-index: 1000;
          }
          .print-btn {
            padding: 14px 28px;
            background: #27ae60;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 15px;
            font-weight: 700;
            box-shadow: 0 6px 16px rgba(0,0,0,0.3);
            transition: all 0.3s;
          }
          .print-btn:hover {
            background: #229954;
            transform: translateY(-2px);
          }
          .info-banner {
            position: fixed;
            top: 20px;
            left: 20px;
            background: rgba(0, 188, 212, 0.95);
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 1000;
            max-width: 300px;
          }
          .info-banner strong {
            display: block;
            margin-bottom: 8px;
            font-size: 16px;
          }
          ${pages.length > 1 ? `
          .duplex-tip {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(241, 196, 15, 0.95);
            color: #2c3e50;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 1000;
          }` : ''}
          @media print {
            body {
              background: white;
            }
            .no-print {
              display: none !important;
            }
            .page {
              margin: 0;
              box-shadow: none;
              width: 100%;
              height: 100vh;
            }
            .page img {
              width: 100%;
              height: 100%;
              object-fit: contain;
            }
          }
        </style>
      </head>
      <body>
        <div class="controls no-print">
          <button class="print-btn" onclick="window.print()">
            Print ${pages.length > 1 ? 'Double-Sided' : 'Form'}
          </button>
        </div>

        <div class="info-banner no-print">
          <strong>${customerName}</strong>
          ${pageInfo}
        </div>

        ${pages.length > 1 ? `
        <div class="duplex-tip no-print">
          Tip: Select "Print on both sides" or "Two-sided" in your printer settings
        </div>` : ''}

        ${pagesHtml}
      </body>
      </html>
    `);
    printWin.document.close();
  }

  /**
   * Generate a 2x2 grid image for back page (Test Drive photos)
   * @param {Array<File|Blob>} images - Array of up to 4 images
   * @returns {Promise<string>} - Base64 data URL
   */
  async generateGridImage(images) {
    // A4 at 300 DPI
    const width = 2480;
    const height = 3508;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // White background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);

    // Calculate grid dimensions
    const padding = 40;
    const cellWidth = (width - padding * 3) / 2;
    const cellHeight = (height - padding * 3) / 2;

    // Load and draw images
    const validImages = images.filter(img => img !== null);

    for (let i = 0; i < validImages.length && i < 4; i++) {
      const file = validImages[i];
      const url = URL.createObjectURL(file);

      try {
        const img = await this.loadImage(url);

        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = padding + col * (cellWidth + padding);
        const y = padding + row * (cellHeight + padding);

        // Calculate aspect-ratio-preserving dimensions
        const imgAspect = img.width / img.height;
        const cellAspect = cellWidth / cellHeight;

        let drawWidth, drawHeight, drawX, drawY;

        if (imgAspect > cellAspect) {
          drawWidth = cellWidth;
          drawHeight = cellWidth / imgAspect;
          drawX = x;
          drawY = y + (cellHeight - drawHeight) / 2;
        } else {
          drawHeight = cellHeight;
          drawWidth = cellHeight * imgAspect;
          drawX = x + (cellWidth - drawWidth) / 2;
          drawY = y;
        }

        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
      } finally {
        URL.revokeObjectURL(url);
      }
    }

    return canvas.toDataURL('image/png');
  }
}

// Field names mapping (for display)
const FIELD_NAMES = {
  name: 'Customer Name',
  phone: 'Phone Number',
  email: 'Email',
  nric: 'NRIC/FIN',
  occupation: 'Occupation',
  dob: 'Date of Birth',
  address: 'Address',
  addressContinue: 'Address Continue',
  fullAddress: 'Full Address',
  salesConsultant: 'Sales Consultant',
  vsaNo: 'VSA No',
  date: "Today's Date",
  makeModel: 'Make & Model',
  yom: 'Year of Manufacture',
  bodyColour: 'Body Colour',
  upholstery: 'Upholstery',
  przType: 'P/R/Z Type',
  package: 'Package',
  sellingWithCOE: 'Selling with COE',
  sellingPriceList: 'Selling Price List',
  purchasePriceWithCOE: 'Purchase Price with COE',
  coeRebateLevel: 'COE Rebate Level',
  deposit: 'Deposit',
  lessOthers: 'Less: Others',
  addOthers: 'Add: Others',
  deliveryDate: 'Delivery Date',
  tradeInCarNo: 'Trade In Car No',
  tradeInCarModel: 'Trade In Car Model',
  tradeInAmount: 'Trade In Amount',
  dateOfRegistration: 'Registration Date',
  registrationNo: 'Registration No',
  chassisNo: 'Chassis No',
  engineNo: 'Engine No',
  motorNo: 'Motor No',
  insuranceCompany: 'Insurance Company',
  insuranceFee: 'Insurance Fee',
  insuranceFeeNet: 'Net Insurance Fee',
  remarks1: 'Remarks 1',
  remarks2: 'Remarks 2',
  loanAmount: 'Loan Amount',
  interest: 'Interest',
  tenure: 'Tenure',
  adminFee: 'Admin Fee',
  insuranceSubsidy: 'Insurance Subsidy',
  monthlyRepayment: 'Monthly Repayment',
  proposalModel: 'Model',
  proposalBank: 'Bank',
  proposalSellingPrice: 'Selling Price',
  proposalInterestRate: 'Interest Rate',
  proposalDownpayment: 'Downpayment',
  proposalLoanTenure: 'Loan Tenure',
  proposalLoanAmount: 'Loan Amount',
  proposalAdminFee: 'Admin Fee',
  proposalReferralFee: 'Referral Fee',
  proposalTradeInModel: 'Trade In Model',
  proposalLowLoanSurcharge: 'Low Loan Surcharge',
  proposalTradeInCarPlate: 'Trade In Car Plate',
  proposalNoLoanSurcharge: 'No Loan Surcharge',
  proposalQuotedTradeInPrice: 'Quoted Trade In Price',
  proposalBenefit1: 'Benefit 1',
  proposalBenefit2: 'Benefit 2',
  proposalBenefit3: 'Benefit 3',
  proposalBenefit4: 'Benefit 4',
  proposalBenefit5: 'Benefit 5',
  proposalBenefitsGiven: 'Benefits Given',
  proposalRemarks: 'Remarks',
  custom: 'Custom Value',
};

export { FIELD_NAMES };
export default new FormRenderService();
