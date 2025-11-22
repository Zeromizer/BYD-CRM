import { useState, useEffect } from 'react';
import useFormsStore from '../../stores/useFormsStore';
import useAuthStore from '../../stores/useAuthStore';
import formService from '../../services/formService';
import Modal from '../Modal/Modal';
import './CombinePrintModal.css';

function CombinePrintModal({ isOpen, onClose, customer }) {
  const { formTemplates, loadFromLocalStorage } = useFormsStore();
  const { isSignedIn } = useAuthStore();

  const [side1FormType, setSide1FormType] = useState('');
  const [side2FormType, setSide2FormType] = useState('');
  const [processing, setProcessing] = useState(false);

  // Test Drive Back Page state - now stores File objects instead of Drive metadata
  const [testDriveImages, setTestDriveImages] = useState([null, null, null, null]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState([null, null, null, null]);

  useEffect(() => {
    if (isOpen) {
      loadFromLocalStorage();
      setSide1FormType('');
      setSide2FormType('');
      setProcessing(false);
      setTestDriveImages([null, null, null, null]);
      setImagePreviewUrls([null, null, null, null]);
    }
  }, [isOpen, loadFromLocalStorage]);

  // Handle file upload for test drive images - now handles multiple files
  const handleImageUpload = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // Limit to 4 images
    const filesToUpload = files.slice(0, 4);

    // Validate all files are images
    if (filesToUpload.some(file => !file.type.startsWith('image/'))) {
      alert('Please select only image files');
      return;
    }

    // Clean up old preview URLs
    imagePreviewUrls.forEach(url => {
      if (url) URL.revokeObjectURL(url);
    });

    // Update images array sequentially
    const newImages = [null, null, null, null];
    const newPreviewUrls = [null, null, null, null];

    filesToUpload.forEach((file, index) => {
      newImages[index] = file;
      newPreviewUrls[index] = URL.createObjectURL(file);
    });

    setTestDriveImages(newImages);
    setImagePreviewUrls(newPreviewUrls);
  };

  // Clean up preview URLs when component unmounts or modal closes
  useEffect(() => {
    return () => {
      imagePreviewUrls.forEach(url => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, [imagePreviewUrls]);

  const availableForms = formService.getAvailableForms(formTemplates);

  // Add Test Drive Back Page as a special option
  const allFormOptions = [
    ...availableForms,
    {
      formType: 'test_drive_back',
      name: 'Test Drive Back Page (Up to 4 Images)',
      template: { fileType: 'special' }
    }
  ];

  const generateTestDriveBackPage = async () => {
    // Create a canvas to render the images in 2x2 grid
    const canvas = document.createElement('canvas');
    // A4 dimensions at 300 DPI: 2480 x 3508 pixels
    const width = 2480;
    const height = 3508;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Fill with white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);

    // Calculate dimensions for each quarter (with small padding)
    const padding = 20;
    const quarterWidth = (width - padding * 3) / 2;
    const quarterHeight = (height - padding * 3) / 2;

    // Load and draw only the uploaded images (filter out nulls)
    const imagePromises = testDriveImages
      .map(async (file, index) => {
        if (!file) return null;
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ img, index });
          img.src = URL.createObjectURL(file);
        });
      })
      .filter(promise => promise !== null);

    const loadedImages = await Promise.all(imagePromises);

    // Draw images in 2x2 grid
    loadedImages.forEach(({ img, index }) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = padding + col * (quarterWidth + padding);
      const y = padding + row * (quarterHeight + padding);

      // Draw image to fit in quarter with aspect ratio maintained
      const imgAspect = img.width / img.height;
      const quarterAspect = quarterWidth / quarterHeight;

      let drawWidth, drawHeight, drawX, drawY;

      if (imgAspect > quarterAspect) {
        // Image is wider than quarter
        drawWidth = quarterWidth;
        drawHeight = quarterWidth / imgAspect;
        drawX = x;
        drawY = y + (quarterHeight - drawHeight) / 2;
      } else {
        // Image is taller than quarter
        drawHeight = quarterHeight;
        drawWidth = quarterHeight * imgAspect;
        drawX = x + (quarterWidth - drawWidth) / 2;
        drawY = y;
      }

      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
    });

    // Convert canvas to base64
    return canvas.toDataURL('image/png');
  };

  const handleCombinePrint = async () => {
    if (!side1FormType || !side2FormType) {
      alert('Please select forms for both sides');
      return;
    }

    if (side1FormType === side2FormType) {
      alert('Please select different forms for each side');
      return;
    }

    if (!isSignedIn) {
      alert('Please sign in to Google Drive to access form templates');
      return;
    }

    setProcessing(true);

    try {
      let form1Data, form2Data, form1Name, form2Name;

      // Render side 1
      if (side1FormType === 'test_drive_back') {
        form1Data = await generateTestDriveBackPage();
        form1Name = 'Test Drive Back Page (4 Images)';
      } else {
        const template1 = formTemplates[side1FormType];
        form1Data = await formService.renderFormWithData(template1, customer);
        form1Name = formService.getFormTypeName(side1FormType);
      }

      // Render side 2
      if (side2FormType === 'test_drive_back') {
        form2Data = await generateTestDriveBackPage();
        form2Name = 'Test Drive Back Page (4 Images)';
      } else {
        const template2 = formTemplates[side2FormType];
        form2Data = await formService.renderFormWithData(template2, customer);
        form2Name = formService.getFormTypeName(side2FormType);
      }

      // Open combined print window
      openCombinedPrintWindow(form1Data, form2Data, form1Name, form2Name);

      // Close modal
      onClose();
    } catch (error) {
      console.error('Error combining forms:', error);
      alert('Failed to combine forms: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const openCombinedPrintWindow = (form1Base64, form2Base64, form1Name, form2Name) => {
    const printWin = window.open('', '_blank');
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${customer.name} - ${form1Name} & ${form2Name}</title>
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
          body {
            font-family: Arial, sans-serif;
          }
          .page {
            width: 210mm;
            height: 297mm;
            page-break-after: always;
            background: white;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .page:last-child {
            page-break-after: auto;
          }
          .page img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
          }
          .print-btn {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 14px 28px;
            background: #27ae60;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 15px;
            font-weight: 700;
            box-shadow: 0 6px 16px rgba(0,0,0,0.3);
            z-index: 1000;
            transition: all 0.3s;
          }
          .print-btn:hover {
            background: #229954;
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(0,0,0,0.4);
          }
          .info-banner {
            position: fixed;
            top: 20px;
            left: 20px;
            background: rgba(0, 188, 212, 0.95);
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 1000;
            max-width: 300px;
          }
          .info-banner strong {
            display: block;
            margin-bottom: 5px;
          }
          @media print {
            .no-print {
              display: none !important;
            }
            body {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <button class="print-btn no-print" onclick="window.print()">🖨️ Print Double-Sided</button>
        <div class="info-banner no-print">
          <strong>${customer.name}</strong>
          📑 Page 1: ${form1Name}<br>
          📑 Page 2: ${form2Name}
        </div>

        <!-- Page 1 (Front) -->
        <div class="page">
          <img src="${form1Base64}" alt="${form1Name}">
        </div>

        <!-- Page 2 (Back) -->
        <div class="page">
          <img src="${form2Base64}" alt="${form2Name}">
        </div>
      </body>
      </html>
    `);
    printWin.document.close();
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Combine & Print Forms" size="large">
      <div className="combine-print-modal">
        <div className="customer-info">
          <h4>Customer: {customer.name}</h4>
          <p>Select two forms to print back-to-back (double-sided)</p>
        </div>

        {!isSignedIn && (
          <div className="warning-banner">
            ⚠️ Please sign in to Google Drive to access form templates
          </div>
        )}

        {allFormOptions.length < 2 ? (
          <div className="empty-state">
            <p>At least 2 forms required</p>
            <p className="empty-state-hint">
              Upload image form templates in Forms Management
            </p>
          </div>
        ) : (
          <>
            <div className="forms-selection">
              <div className="form-group">
                <label htmlFor="side1">Page 1 (Front Side)</label>
                <select
                  id="side1"
                  value={side1FormType}
                  onChange={(e) => setSide1FormType(e.target.value)}
                  disabled={processing || !isSignedIn}
                >
                  <option value="">-- Select a form --</option>
                  {allFormOptions.map(({ formType, name, template }) => {
                    if (formType === 'test_drive_back') {
                      return (
                        <option key={formType} value={formType}>
                          {name}
                        </option>
                      );
                    }
                    const fieldCount = Object.keys(template.fieldMappings || {}).length;
                    return (
                      <option key={formType} value={formType}>
                        {name} ({fieldCount} fields)
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="side2">Page 2 (Back Side)</label>
                <select
                  id="side2"
                  value={side2FormType}
                  onChange={(e) => setSide2FormType(e.target.value)}
                  disabled={processing || !isSignedIn}
                >
                  <option value="">-- Select a form --</option>
                  {allFormOptions.map(({ formType, name, template }) => {
                    if (formType === 'test_drive_back') {
                      return (
                        <option key={formType} value={formType}>
                          {name}
                        </option>
                      );
                    }
                    const fieldCount = Object.keys(template.fieldMappings || {}).length;
                    return (
                      <option key={formType} value={formType}>
                        {name} ({fieldCount} fields)
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Test Drive Image Uploader */}
            {(side1FormType === 'test_drive_back' || side2FormType === 'test_drive_back') && (
              <div className="test-drive-image-selector">
                <h4>Upload Images for Back Page</h4>
                <p className="helper-text">
                  Select up to 4 images. They will be arranged sequentially in a 2x2 grid on the back page.
                  You can upload 1 to 4 images, or leave it blank for an empty page.
                </p>

                <div style={{ marginBottom: '20px' }}>
                  <input
                    id="image-upload-multiple"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    disabled={processing}
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="image-upload-multiple">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => document.getElementById('image-upload-multiple').click()}
                      disabled={processing}
                    >
                      Choose Images (Up to 4)
                    </button>
                  </label>
                </div>

                {/* Image Previews */}
                {testDriveImages.some(img => img) && (
                  <div className="image-grid-selector">
                    {testDriveImages.map((file, index) => {
                      if (!file || !imagePreviewUrls[index]) return null;
                      return (
                        <div key={index} className="image-slot">
                          <label>
                            Position {index + 1} (Quarter {index + 1})
                          </label>
                          <div className="image-preview-small">
                            <img
                              src={imagePreviewUrls[index]}
                              alt={`Preview ${index + 1}`}
                              style={{ maxWidth: '150px', maxHeight: '150px', objectFit: 'contain', border: '1px solid #ddd', borderRadius: '4px' }}
                            />
                            <p style={{ fontSize: '12px', marginTop: '5px', color: '#666' }}>
                              {file.name}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {side1FormType && side2FormType && (
              <div className="preview-info">
                <h4>Print Preview</h4>
                <div className="preview-grid">
                  <div className="preview-item">
                    <div className="preview-page-number">Page 1 (Front)</div>
                    <div className="preview-form-name">
                      {side1FormType === 'test_drive_back'
                        ? 'Test Drive Back Page (4 Images)'
                        : formService.getFormTypeName(side1FormType)}
                    </div>
                    <div className="preview-field-count">
                      {side1FormType === 'test_drive_back'
                        ? '4 images in 2x2 grid'
                        : `${Object.keys(formTemplates[side1FormType].fieldMappings || {}).length} fields`}
                    </div>
                  </div>
                  <div className="preview-item">
                    <div className="preview-page-number">Page 2 (Back)</div>
                    <div className="preview-form-name">
                      {side2FormType === 'test_drive_back'
                        ? 'Test Drive Back Page (4 Images)'
                        : formService.getFormTypeName(side2FormType)}
                    </div>
                    <div className="preview-field-count">
                      {side2FormType === 'test_drive_back'
                        ? '4 images in 2x2 grid'
                        : `${Object.keys(formTemplates[side2FormType].fieldMappings || {}).length} fields`}
                    </div>
                  </div>
                </div>
                <p className="print-instruction">
                  💡 When printing, select "Double-sided" or "Two-sided" in your printer settings
                  for best results.
                </p>
              </div>
            )}

            {side1FormType && side2FormType && side1FormType === side2FormType && (
              <div className="error-message">
                ⚠️ Please select different forms for each side
              </div>
            )}
          </>
        )}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose} disabled={processing}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleCombinePrint}
            disabled={
              !side1FormType ||
              !side2FormType ||
              side1FormType === side2FormType ||
              processing ||
              !isSignedIn ||
              // Validate test drive images if test_drive_back is selected
              ((side1FormType === 'test_drive_back' || side2FormType === 'test_drive_back') &&
                testDriveImages.some(img => !img))
            }
          >
            {processing ? 'Preparing...' : '🖨️ Print Double-Sided'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default CombinePrintModal;
