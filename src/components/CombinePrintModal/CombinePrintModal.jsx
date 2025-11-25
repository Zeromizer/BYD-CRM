import { useState, useEffect, useRef } from 'react';
import useFormsStore from '../../stores/useFormsStore';
import useAuthStore from '../../stores/useAuthStore';
import formRenderService, { FIELD_NAMES } from '../../services/formRenderService';
import Modal from '../Modal/Modal';
import './CombinePrintModal.css';

const FORM_TYPE_NAMES = {
  test_drive: 'Test Drive Agreement',
  vsa: 'Vehicle Sales Agreement',
  pdpa: 'PDPA Consent Form',
  coe_bidding_1: 'COE Bidding 1',
  coe_bidding_2: 'COE Bidding 2',
  pdpa_consent_1: 'PDPA Consent 1',
  pdpa_consent_2: 'PDPA Consent 2',
  delivery_checklist_1: 'Delivery Checklist Form (1 of 2)',
  delivery_checklist_2: 'Delivery Checklist Form (2 of 2)',
  proposal: 'Proposal Form',
  other: 'Other Form',
};

/**
 * CombinePrintModal - For double-sided printing
 *
 * Features:
 * - Select front and back pages
 * - Special "Test Drive Back Page" with 2x2 image grid
 * - Live preview of both pages
 * - Proper print window with duplex printing instructions
 */
function CombinePrintModal({ isOpen, onClose, customer }) {
  const { formTemplates, loadFromLocalStorage } = useFormsStore();
  const { isSignedIn } = useAuthStore();
  const previewCanvas1Ref = useRef(null);
  const previewCanvas2Ref = useRef(null);

  const [side1FormType, setSide1FormType] = useState('');
  const [side2FormType, setSide2FormType] = useState('');
  const [processing, setProcessing] = useState(false);
  const [page1Preview, setPage1Preview] = useState(null);
  const [page2Preview, setPage2Preview] = useState(null);

  // Test Drive Back Page state
  const [testDriveImages, setTestDriveImages] = useState([null, null, null, null]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState([null, null, null, null]);
  const [gridPreviewUrl, setGridPreviewUrl] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadFromLocalStorage();
      resetState();
    }
  }, [isOpen, loadFromLocalStorage]);

  // Generate preview when side selection changes
  useEffect(() => {
    if (side1FormType && side1FormType !== 'test_drive_back') {
      generateFormPreview(side1FormType, setPage1Preview);
    } else if (side1FormType === 'test_drive_back') {
      setPage1Preview(gridPreviewUrl);
    } else {
      setPage1Preview(null);
    }
  }, [side1FormType, gridPreviewUrl]);

  useEffect(() => {
    if (side2FormType && side2FormType !== 'test_drive_back') {
      generateFormPreview(side2FormType, setPage2Preview);
    } else if (side2FormType === 'test_drive_back') {
      setPage2Preview(gridPreviewUrl);
    } else {
      setPage2Preview(null);
    }
  }, [side2FormType, gridPreviewUrl]);

  // Update grid preview when images change
  useEffect(() => {
    const hasImages = testDriveImages.some(img => img !== null);
    if (hasImages) {
      generateGridPreview();
    } else {
      setGridPreviewUrl(null);
    }
  }, [testDriveImages]);

  // Clean up preview URLs when component unmounts
  useEffect(() => {
    return () => {
      imagePreviewUrls.forEach(url => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, [imagePreviewUrls]);

  const resetState = () => {
    setSide1FormType('');
    setSide2FormType('');
    setProcessing(false);
    setPage1Preview(null);
    setPage2Preview(null);
    setTestDriveImages([null, null, null, null]);
    setImagePreviewUrls([null, null, null, null]);
    setGridPreviewUrl(null);
  };

  const generateFormPreview = async (formType, setPreview) => {
    if (!isSignedIn) return;

    try {
      const template = formTemplates[formType];
      if (!template?.fileId) return;

      const dataUrl = await formRenderService.renderFormToDataURL(
        template.fileId,
        template.fieldMappings,
        customer,
        { usePoints: true, quality: 0.8 }
      );
      setPreview(dataUrl);
    } catch (error) {
      console.error('Error generating preview:', error);
    }
  };

  const generateGridPreview = async () => {
    const hasImages = testDriveImages.some(img => img !== null);
    if (!hasImages) {
      setGridPreviewUrl(null);
      return;
    }

    try {
      const dataUrl = await formRenderService.generateGridImage(testDriveImages);
      setGridPreviewUrl(dataUrl);
    } catch (error) {
      console.error('Error generating grid preview:', error);
    }
  };

  // Handle file upload for test drive images
  const handleImageUpload = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const filesToUpload = files.slice(0, 4);

    if (filesToUpload.some(file => !file.type.startsWith('image/'))) {
      alert('Please select only image files');
      return;
    }

    // Clean up old preview URLs
    imagePreviewUrls.forEach(url => {
      if (url) URL.revokeObjectURL(url);
    });

    const newImages = [null, null, null, null];
    const newPreviewUrls = [null, null, null, null];

    filesToUpload.forEach((file, index) => {
      newImages[index] = file;
      newPreviewUrls[index] = URL.createObjectURL(file);
    });

    setTestDriveImages(newImages);
    setImagePreviewUrls(newPreviewUrls);
  };

  const clearImages = () => {
    imagePreviewUrls.forEach(url => {
      if (url) URL.revokeObjectURL(url);
    });
    setTestDriveImages([null, null, null, null]);
    setImagePreviewUrls([null, null, null, null]);
    setGridPreviewUrl(null);
  };

  const getAvailableForms = () => {
    const available = [];

    for (const [formType, template] of Object.entries(formTemplates)) {
      if (template.fileType === 'image') {
        available.push({
          formType,
          name: FORM_TYPE_NAMES[formType] || formType,
          template,
        });
      }
    }

    return available;
  };

  const availableForms = getAvailableForms();

  const allFormOptions = [
    ...availableForms,
    {
      formType: 'test_drive_back',
      name: 'Test Drive Back Page (Up to 4 Images)',
      template: { fileType: 'special' }
    }
  ];

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
      const pages = [];

      // Generate page 1
      if (side1FormType === 'test_drive_back') {
        const dataUrl = await formRenderService.generateGridImage(testDriveImages);
        pages.push({
          dataUrl,
          name: 'Test Drive Back Page (4 Images)'
        });
      } else {
        const template = formTemplates[side1FormType];
        const dataUrl = await formRenderService.renderFormToDataURL(
          template.fileId,
          template.fieldMappings,
          customer,
          { usePoints: true }
        );
        pages.push({
          dataUrl,
          name: FORM_TYPE_NAMES[side1FormType] || side1FormType
        });
      }

      // Generate page 2
      if (side2FormType === 'test_drive_back') {
        const dataUrl = await formRenderService.generateGridImage(testDriveImages);
        pages.push({
          dataUrl,
          name: 'Test Drive Back Page (4 Images)'
        });
      } else {
        const template = formTemplates[side2FormType];
        const dataUrl = await formRenderService.renderFormToDataURL(
          template.fileId,
          template.fieldMappings,
          customer,
          { usePoints: true }
        );
        pages.push({
          dataUrl,
          name: FORM_TYPE_NAMES[side2FormType] || side2FormType
        });
      }

      // Open combined print window
      formRenderService.openPrintWindow(
        pages,
        customer.name,
        { title: 'Double-Sided Forms' }
      );

      onClose();
    } catch (error) {
      console.error('Error combining forms:', error);
      alert('Failed to combine forms: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const getFormName = (formType) => {
    if (formType === 'test_drive_back') {
      return 'Test Drive Back Page (4 Images)';
    }
    return FORM_TYPE_NAMES[formType] || formType;
  };

  const getFieldCount = (formType) => {
    if (formType === 'test_drive_back') {
      return '4 images in 2x2 grid';
    }
    const template = formTemplates[formType];
    if (!template) return '0 fields';
    return `${Object.keys(template.fieldMappings || {}).length} fields`;
  };

  if (!isOpen) return null;

  const showImageUploader = side1FormType === 'test_drive_back' || side2FormType === 'test_drive_back';
  const canPrint = side1FormType && side2FormType && side1FormType !== side2FormType && isSignedIn;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Combine & Print Double-Sided" size="large">
      <div className="combine-print-modal">
        <div className="customer-info">
          <h4>Customer: {customer.name}</h4>
          <p>Select two forms to print back-to-back (double-sided)</p>
        </div>

        {!isSignedIn && (
          <div className="warning-banner">
            Please sign in to Google Drive to access form templates
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
                    const fieldInfo = formType === 'test_drive_back'
                      ? ''
                      : ` (${Object.keys(template.fieldMappings || {}).length} fields)`;
                    return (
                      <option key={formType} value={formType}>
                        {name}{fieldInfo}
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
                    const fieldInfo = formType === 'test_drive_back'
                      ? ''
                      : ` (${Object.keys(template.fieldMappings || {}).length} fields)`;
                    return (
                      <option key={formType} value={formType}>
                        {name}{fieldInfo}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Test Drive Image Uploader */}
            {showImageUploader && (
              <div className="test-drive-image-selector">
                <h4>Upload Images for Back Page</h4>
                <p className="helper-text">
                  Select up to 4 images to be arranged in a 2x2 grid.
                </p>

                <div className="upload-controls">
                  <input
                    id="image-upload-multiple"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    disabled={processing}
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => document.getElementById('image-upload-multiple').click()}
                    disabled={processing}
                  >
                    Choose Images (Up to 4)
                  </button>
                  {testDriveImages.some(img => img) && (
                    <button
                      type="button"
                      className="btn btn-danger btn-small"
                      onClick={clearImages}
                      disabled={processing}
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {/* Image Previews */}
                {testDriveImages.some(img => img) && (
                  <div className="image-grid-preview">
                    {testDriveImages.map((file, index) => (
                      <div key={index} className={`image-slot ${file ? 'filled' : 'empty'}`}>
                        {file && imagePreviewUrls[index] ? (
                          <>
                            <img
                              src={imagePreviewUrls[index]}
                              alt={`Position ${index + 1}`}
                            />
                            <span className="position-label">{index + 1}</span>
                          </>
                        ) : (
                          <span className="empty-label">{index + 1}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Live Preview */}
            {(page1Preview || page2Preview) && (
              <div className="preview-section">
                <h4>Preview</h4>
                <div className="preview-pages">
                  <div className="preview-page">
                    <div className="page-label">Page 1 (Front)</div>
                    {page1Preview ? (
                      <img src={page1Preview} alt="Page 1 Preview" />
                    ) : (
                      <div className="preview-placeholder">Select a form</div>
                    )}
                    {side1FormType && (
                      <div className="page-info">
                        <span className="form-name">{getFormName(side1FormType)}</span>
                        <span className="field-count">{getFieldCount(side1FormType)}</span>
                      </div>
                    )}
                  </div>
                  <div className="preview-page">
                    <div className="page-label">Page 2 (Back)</div>
                    {page2Preview ? (
                      <img src={page2Preview} alt="Page 2 Preview" />
                    ) : (
                      <div className="preview-placeholder">Select a form</div>
                    )}
                    {side2FormType && (
                      <div className="page-info">
                        <span className="form-name">{getFormName(side2FormType)}</span>
                        <span className="field-count">{getFieldCount(side2FormType)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Duplex Print Tip */}
            {canPrint && (
              <div className="print-tip">
                <strong>Tip:</strong> When printing, select "Print on both sides" or "Two-sided"
                in your printer settings. If your printer doesn't support automatic duplex,
                print page 1, flip the paper, then print page 2.
              </div>
            )}

            {side1FormType && side2FormType && side1FormType === side2FormType && (
              <div className="error-message">
                Please select different forms for each side
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
            disabled={!canPrint || processing}
          >
            {processing ? 'Preparing...' : 'Print Double-Sided'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default CombinePrintModal;
