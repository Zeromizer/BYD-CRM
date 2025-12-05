import { getStorageService } from './storageServiceSelector';

/**
 * DocumentRenderer - Unified Canvas Renderer for Print-First Design
 *
 * Core principle: Everything rendered at print DPI from the start
 * - Preview = Print = Reality (WYSIWYG)
 * - Font sizes in Points (pt), not pixels
 * - Single source of truth for all rendering
 *
 * OPTIMIZED: Includes image caching and parallel operations
 */
class DocumentRenderer {
  constructor() {
    this.defaultDPI = 300; // Print standard
    this.screenDPI = 96;   // Screen standard

    // Image cache with TTL (5 minutes)
    this.imageCache = new Map();
    this.imageCacheTTL = 5 * 60 * 1000;
  }

  /**
   * Get cached image or fetch from storage
   * Cache key is the fileId
   */
  async getCachedImage(fileId) {
    const cached = this.imageCache.get(fileId);
    if (cached && Date.now() - cached.timestamp < this.imageCacheTTL) {
      return cached.image;
    }

    // Fetch and cache the image
    const blob = await this.fetchImageFromDrive(fileId);
    const image = await this.loadImage(blob);

    this.imageCache.set(fileId, {
      image,
      timestamp: Date.now()
    });

    return image;
  }

  /**
   * Prefetch and cache multiple images in parallel
   * Use this to warm up cache before rendering
   */
  async prefetchImages(fileIds) {
    const uniqueIds = [...new Set(fileIds.filter(Boolean))];
    await Promise.all(uniqueIds.map(id => this.getCachedImage(id)));
  }

  /**
   * Clear image cache (call when switching customers or on memory pressure)
   */
  clearImageCache() {
    this.imageCache.clear();
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
   * Fetch image from OneDrive storage
   */
  async fetchImageFromDrive(fileId) {
    try {
      const blob = await getStorageService().downloadFileAsBlob(fileId);
      return blob;
    } catch (error) {
      console.error('Error fetching image from OneDrive:', error);
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
      // Fetch base image (uses cache for repeated renders)
      const image = await this.getCachedImage(template.fileId);

      // Get DPI (from template or default)
      const dpi = template.dpi || this.defaultDPI;

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
   * Render back page with 4 images in quarters (for double-sided forms)
   *
   * @param {Array} imageFileIds - Array of up to 4 OneDrive file IDs for images
   * @param {Object} options - Rendering options (width, height, dpi)
   * @returns {Object} - Rendered canvas and data URL
   */
  async renderBackPageWithImages(imageFileIds, options = {}) {
    try {
      // Use standard paper size or custom dimensions
      const dpi = options.dpi || this.defaultDPI;
      const width = options.width || this.pointsToPixels(595.28, dpi); // A4 width in points (8.27 inches)
      const height = options.height || this.pointsToPixels(841.89, dpi); // A4 height in points (11.69 inches)

      // Create canvas
      const canvas = this.createCanvas(width, height);
      const ctx = canvas.getContext('2d');

      // Enable high-quality image scaling for best photo quality
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Fill white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // Add margin (0.5 inch on each side)
      const margin = this.pointsToPixels(36, dpi); // 0.5 inch = 36 points
      const contentWidth = width - (margin * 2);
      const contentHeight = height - (margin * 2);

      // Calculate quarter dimensions
      const quarterWidth = contentWidth / 2;
      const quarterHeight = contentHeight / 2;

      // Add subtle borders between quarters
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 2;

      // Vertical center line
      ctx.beginPath();
      ctx.moveTo(width / 2, margin);
      ctx.lineTo(width / 2, height - margin);
      ctx.stroke();

      // Horizontal center line
      ctx.beginPath();
      ctx.moveTo(margin, height / 2);
      ctx.lineTo(width - margin, height / 2);
      ctx.stroke();

      // Load and draw images in quarters
      const positions = [
        { x: margin, y: margin },                              // Top-left
        { x: margin + quarterWidth, y: margin },               // Top-right
        { x: margin, y: margin + quarterHeight },              // Bottom-left
        { x: margin + quarterWidth, y: margin + quarterHeight } // Bottom-right
      ];

      // OPTIMIZED: Load all images in parallel using Promise.allSettled
      const imagePromises = imageFileIds.slice(0, 4).map(async (fileId, index) => {
        if (!fileId) return { index, image: null, error: null };
        try {
          const image = await this.getCachedImage(fileId);
          return { index, image, error: null };
        } catch (error) {
          console.error(`Error loading image ${index + 1}:`, error);
          return { index, image: null, error };
        }
      });

      const imageResults = await Promise.all(imagePromises);

      // Draw all loaded images
      for (const { index, image, error } of imageResults) {
        const padding = this.pointsToPixels(18, dpi); // 0.25 inch padding
        const maxImgWidth = quarterWidth - (padding * 2);
        const maxImgHeight = quarterHeight - (padding * 2);

        if (image) {
          // Calculate scaling to fit in quarter with padding
          const scaleX = maxImgWidth / image.width;
          const scaleY = maxImgHeight / image.height;
          const scale = Math.min(scaleX, scaleY);

          const scaledWidth = image.width * scale;
          const scaledHeight = image.height * scale;

          // Center image in quarter
          const imgX = positions[index].x + padding + (maxImgWidth - scaledWidth) / 2;
          const imgY = positions[index].y + padding + (maxImgHeight - scaledHeight) / 2;

          // Draw image
          ctx.drawImage(image, imgX, imgY, scaledWidth, scaledHeight);

          // Add label
          ctx.font = `${this.pointsToPixels(10, dpi)}px Arial`;
          ctx.fillStyle = '#666666';
          ctx.textAlign = 'center';
          ctx.fillText(
            `Image ${index + 1}`,
            positions[index].x + quarterWidth / 2,
            positions[index].y + padding / 2
          );
        } else if (error || imageFileIds[index]) {
          // Draw placeholder for failed or missing image
          ctx.fillStyle = '#f5f5f5';
          ctx.fillRect(
            positions[index].x + this.pointsToPixels(18, dpi),
            positions[index].y + this.pointsToPixels(18, dpi),
            quarterWidth - this.pointsToPixels(36, dpi),
            quarterHeight - this.pointsToPixels(36, dpi)
          );

          ctx.fillStyle = '#999999';
          ctx.textAlign = 'center';
          ctx.font = `${this.pointsToPixels(14, dpi)}px Arial`;
          ctx.fillText(
            'Image not available',
            positions[index].x + quarterWidth / 2,
            positions[index].y + quarterHeight / 2
          );
        }
      }

      // Add "Customer ID - Back Page" label at bottom
      ctx.font = `${this.pointsToPixels(12, dpi)}px Arial`;
      ctx.fillStyle = '#333333';
      ctx.textAlign = 'center';
      ctx.fillText(
        'Customer ID Images',
        width / 2,
        height - margin / 2
      );

      return {
        canvas,
        dataUrl: canvas.toDataURL('image/jpeg', 1.0),
        width,
        height,
        dpi,
      };
    } catch (error) {
      console.error('Error rendering back page:', error);
      throw error;
    }
  }

  /**
   * Render multi-line text with word wrapping
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
   * Render multiple documents in parallel (OPTIMIZED)
   * Prefetches all images first, then renders all documents concurrently
   */
  async renderMultipleDocuments(templates, customerData) {
    // Prefetch all template images in parallel first
    const fileIds = templates.map(t => t.fileId).filter(Boolean);
    await this.prefetchImages(fileIds);

    // Render all documents in parallel
    const renderPromises = templates.map(template =>
      this.renderDocument(template, customerData)
    );

    return Promise.all(renderPromises);
  }

  /**
   * Render documents with back pages in parallel (for PrintManager)
   * This is the fully optimized rendering pipeline
   *
   * @param {Array} templateConfigs - Array of {template, doubleSidedConfig}
   * @param {Object} customerData - Customer data mapping
   * @returns {Array} - Array of renders (front and back pages interleaved)
   */
  async renderDocumentsWithBackPages(templateConfigs, customerData) {
    // Step 1: Collect all file IDs that need to be fetched
    const allFileIds = [];
    templateConfigs.forEach(({ template, doubleSidedConfig }) => {
      if (template.fileId) {
        allFileIds.push(template.fileId);
      }
      if (doubleSidedConfig?.enabled && doubleSidedConfig.images) {
        allFileIds.push(...doubleSidedConfig.images);
      }
    });

    // Step 2: Prefetch ALL images in parallel (both templates and back page images)
    await this.prefetchImages(allFileIds);

    // Step 3: Render all front and back pages in parallel
    const renderPromises = templateConfigs.flatMap(({ template, doubleSidedConfig }) => {
      const promises = [];

      // Front page render
      const frontPromise = this.renderDocument(template, customerData).then(render => ({
        ...render,
        templateId: template.id,
        pageType: 'front',
        templateName: template.name,
        order: templateConfigs.indexOf({ template, doubleSidedConfig }) * 2
      }));
      promises.push(frontPromise);

      // Back page render (if double-sided)
      if (doubleSidedConfig?.enabled && doubleSidedConfig.images?.length > 0) {
        const backPromise = frontPromise.then(async (frontRender) => {
          const backRender = await this.renderBackPageWithImages(
            doubleSidedConfig.images,
            {
              width: frontRender.width,
              height: frontRender.height,
              dpi: frontRender.dpi
            }
          );
          return {
            ...backRender,
            templateId: template.id,
            pageType: 'back',
            templateName: template.name,
            order: templateConfigs.indexOf({ template, doubleSidedConfig }) * 2 + 1
          };
        });
        promises.push(backPromise);
      }

      return promises;
    });

    // Wait for all renders to complete
    const renders = await Promise.all(renderPromises);

    // Sort by original order to maintain front-back sequence
    return renders.sort((a, b) => {
      // Group by template first, then front before back
      const aTemplateIdx = templateConfigs.findIndex(c => c.template.id === a.templateId);
      const bTemplateIdx = templateConfigs.findIndex(c => c.template.id === b.templateId);
      if (aTemplateIdx !== bTemplateIdx) return aTemplateIdx - bTemplateIdx;
      return a.pageType === 'front' ? -1 : 1;
    });
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
