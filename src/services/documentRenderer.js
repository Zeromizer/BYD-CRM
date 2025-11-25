import authService from './authService';

/**
 * DocumentRenderer - Unified Canvas Renderer for Print-First Design
 *
 * Core principle: Everything rendered at print DPI from the start
 * - Preview = Print = Reality (WYSIWYG)
 * - Font sizes in Points (pt), not pixels
 * - Single source of truth for all rendering
 */
class DocumentRenderer {
  constructor() {
    this.defaultDPI = 300; // Print standard
    this.screenDPI = 96;   // Screen standard
  }

  /**
   * Convert points to pixels at given DPI
   * Industry standard: 72 points = 1 inch
   */
  pointsToPixels(points, dpi = this.defaultDPI) {
    return (points * dpi) / 72;
  }

  /**
   * Convert pixels to points at given DPI
   */
  pixelsToPoints(pixels, dpi = this.defaultDPI) {
    return (pixels * 72) / dpi;
  }

  /**
   * Fetch image from Google Drive
   */
  async fetchImageFromDrive(fileId) {
    try {
      const token = authService.getAccessToken();
      if (!token) {
        throw new Error('No access token available. Please sign in.');
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
        throw new Error(`Failed to fetch image: ${response.status}`);
      }

      const blob = await response.blob();
      return blob;
    } catch (error) {
      console.error('Error fetching image from Drive:', error);
      throw error;
    }
  }

  /**
   * Load image from blob or data URL
   */
  loadImage(source) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));

      if (source instanceof Blob) {
        img.src = URL.createObjectURL(source);
      } else {
        img.src = source;
      }
    });
  }

  /**
   * Detect image DPI from EXIF metadata (if available)
   * Falls back to default 300 DPI
   */
  async detectImageDPI(blob) {
    // For now, return default. Can be enhanced with EXIF reading
    // Most scanned forms are at 300 DPI
    return this.defaultDPI;
  }

  /**
   * Create canvas at print resolution
   */
  createCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  /**
   * Render document with customer data
   * This is the main rendering function - used for both preview and print
   *
   * @param {Object} template - Document template with fields configuration
   * @param {Object} customerData - Customer data mapping
   * @param {Object} options - Rendering options
   * @returns {Object} - Rendered canvas and data URL
   */
  async renderDocument(template, customerData, options = {}) {
    try {
      // Fetch base image
      const imageBlob = await this.fetchImageFromDrive(template.fileId);
      const image = await this.loadImage(imageBlob);

      // Get DPI (from template or detect from image)
      const dpi = template.dpi || await this.detectImageDPI(imageBlob);

      // Create canvas at original image dimensions (already at print DPI)
      const canvas = this.createCanvas(image.width, image.height);
      const ctx = canvas.getContext('2d');

      // Draw base form image
      ctx.drawImage(image, 0, 0);

      // Draw all fields
      if (template.fields && Object.keys(template.fields).length > 0) {
        this.drawFields(ctx, template.fields, customerData, dpi);
      }

      // Return canvas and data URL
      return {
        canvas,
        dataUrl: canvas.toDataURL('image/jpeg', 0.95),
        width: image.width,
        height: image.height,
        dpi,
      };
    } catch (error) {
      console.error('Error rendering document:', error);
      throw error;
    }
  }

  /**
   * Draw all fields onto canvas
   */
  drawFields(ctx, fields, customerData, dpi) {
    Object.entries(fields).forEach(([fieldId, field]) => {
      // Get field value
      let value = '';
      if (field.customValue) {
        value = field.customValue;
      } else if (field.fieldType && customerData[field.fieldType]) {
        value = customerData[field.fieldType];
      }

      if (!value) return;

      // Draw field
      this.drawField(ctx, field, value, dpi);
    });
  }

  /**
   * Draw a single field
   */
  drawField(ctx, field, value, dpi) {
    // Convert font size from points to pixels at current DPI
    const fontSizePx = this.pointsToPixels(field.fontSize, dpi);

    // Set font
    const fontFamily = field.fontFamily || 'Arial';
    const fontWeight = field.fontWeight || 'normal';
    ctx.font = `${fontWeight} ${fontSizePx}px ${fontFamily}`;

    // Set color
    ctx.fillStyle = field.color || '#000000';

    // Set text alignment
    ctx.textAlign = field.alignment || 'left';
    ctx.textBaseline = 'top';

    // Handle multi-line text
    if (field.multiline) {
      this.drawMultilineText(ctx, value, field.x, field.y, field.maxWidth, fontSizePx * 1.2);
    } else {
      // Single line text
      ctx.fillText(value, field.x, field.y);
    }
  }

  /**
   * Draw multi-line text with word wrapping
   */
  drawMultilineText(ctx, text, x, y, maxWidth, lineHeight) {
    if (!maxWidth) {
      ctx.fillText(text, x, y);
      return;
    }

    const words = text.split(' ');
    let line = '';
    let currentY = y;

    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + ' ';
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && i > 0) {
        ctx.fillText(line, x, currentY);
        line = words[i] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, currentY);
  }

  /**
   * Render document at screen resolution for preview
   * Scales down from print resolution to screen resolution
   */
  async renderPreview(template, customerData, maxWidth = 800) {
    try {
      // First render at print resolution
      const printRender = await this.renderDocument(template, customerData);

      // Calculate scale to fit maxWidth
      const scale = maxWidth / printRender.width;

      // Create scaled canvas for preview
      const previewCanvas = this.createCanvas(
        printRender.width * scale,
        printRender.height * scale
      );
      const ctx = previewCanvas.getContext('2d');

      // Draw scaled image
      ctx.drawImage(
        printRender.canvas,
        0, 0,
        printRender.width,
        printRender.height,
        0, 0,
        previewCanvas.width,
        previewCanvas.height
      );

      return {
        canvas: previewCanvas,
        dataUrl: previewCanvas.toDataURL('image/jpeg', 0.95),
        scale,
        originalWidth: printRender.width,
        originalHeight: printRender.height,
      };
    } catch (error) {
      console.error('Error rendering preview:', error);
      throw error;
    }
  }

  /**
   * Render multiple documents (for multi-page forms)
   */
  async renderMultipleDocuments(templates, customerData) {
    const renders = [];

    for (const template of templates) {
      const render = await this.renderDocument(template, customerData);
      renders.push(render);
    }

    return renders;
  }

  /**
   * Get text dimensions for a field (useful for positioning)
   */
  measureText(text, field, dpi) {
    const canvas = this.createCanvas(100, 100);
    const ctx = canvas.getContext('2d');

    const fontSizePx = this.pointsToPixels(field.fontSize, dpi);
    const fontFamily = field.fontFamily || 'Arial';
    const fontWeight = field.fontWeight || 'normal';
    ctx.font = `${fontWeight} ${fontSizePx}px ${fontFamily}`;

    const metrics = ctx.measureText(text);
    return {
      width: metrics.width,
      height: fontSizePx,
    };
  }

  /**
   * Convert canvas to blob
   */
  canvasToBlob(canvas, type = 'image/jpeg', quality = 0.95) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to convert canvas to blob'));
          }
        },
        type,
        quality
      );
    });
  }
}

export default new DocumentRenderer();
