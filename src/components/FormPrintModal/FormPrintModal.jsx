import { useState, useEffect, useRef } from 'react';
import useFormsStore from '../../stores/useFormsStore';
import useAuthStore from '../../stores/useAuthStore';
import formRenderService, { FIELD_NAMES } from '../../services/formRenderService';
import Modal from '../Modal/Modal';
import './FormPrintModal.css';

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

function FormPrintModal({ isOpen, onClose, customer }) {
  const { formTemplates, loadFromLocalStorage } = useFormsStore();
  const { isSignedIn } = useAuthStore();
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const [selectedFormType, setSelectedFormType] = useState('');
  const [loading, setLoading] = useState(false);
  const [formImage, setFormImage] = useState(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [showPreview, setShowPreview] = useState(false);
  const [renderedDataUrl, setRenderedDataUrl] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadFromLocalStorage();
      resetState();
    }
  }, [isOpen, loadFromLocalStorage]);

  // Calculate scale when container resizes
  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current && imageDimensions.width > 0) {
        const containerWidth = containerRef.current.clientWidth - 60;
        const containerHeight = containerRef.current.clientHeight - 40;

        const scaleX = containerWidth / imageDimensions.width;
        const scaleY = containerHeight / imageDimensions.height;

        setScale(Math.min(scaleX, scaleY, 1));
      }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [imageDimensions, showPreview]);

  // Redraw canvas when dependencies change
  useEffect(() => {
    if (showPreview && formImage && canvasRef.current) {
      drawPreview();
    }
  }, [formImage, scale, showPreview]);

  const resetState = () => {
    setSelectedFormType('');
    setFormImage(null);
    setImageDimensions({ width: 0, height: 0 });
    setScale(1);
    setShowPreview(false);
    setRenderedDataUrl(null);
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

  const handleGeneratePreview = async () => {
    if (!selectedFormType) {
      alert('Please select a form to preview');
      return;
    }

    if (!isSignedIn) {
      alert('Please sign in to Google Drive to access form templates');
      return;
    }

    setLoading(true);

    try {
      const template = formTemplates[selectedFormType];

      // Load form image
      const base64Data = await formRenderService.fetchFormImage(template.fileId);
      const img = await formRenderService.loadImage(base64Data);

      setFormImage(img);
      setImageDimensions({ width: img.width, height: img.height });

      // Generate full-resolution data URL for printing
      const dataUrl = await formRenderService.renderFormToDataURL(
        template.fileId,
        template.fieldMappings,
        customer,
        { usePoints: true }
      );
      setRenderedDataUrl(dataUrl);

      setShowPreview(true);
    } catch (error) {
      console.error('Error generating preview:', error);
      alert('Failed to generate preview: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const drawPreview = () => {
    if (!canvasRef.current || !formImage) return;

    const template = formTemplates[selectedFormType];
    const customerData = formRenderService.getCustomerDataMapping(customer);

    formRenderService.renderFormToCanvas(
      canvasRef.current,
      formImage,
      template.fieldMappings,
      customerData,
      {
        scale,
        showMarkers: false,
        usePoints: true,
      }
    );
  };

  const handlePrint = () => {
    if (!renderedDataUrl) return;

    const template = formTemplates[selectedFormType];
    const formName = FORM_TYPE_NAMES[selectedFormType] || selectedFormType;

    formRenderService.openPrintWindow(
      [{ dataUrl: renderedDataUrl, name: formName }],
      customer.name,
      { title: formName }
    );
  };

  const handleDownload = () => {
    if (!renderedDataUrl) return;

    const formName = FORM_TYPE_NAMES[selectedFormType] || selectedFormType;
    const fileName = `${customer.name.replace(/\s+/g, '_')}_${formName.replace(/\s+/g, '_')}.jpg`;

    const link = document.createElement('a');
    link.href = renderedDataUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBackToSelection = () => {
    setShowPreview(false);
    setFormImage(null);
    setImageDimensions({ width: 0, height: 0 });
    setRenderedDataUrl(null);
  };

  if (!isOpen) return null;

  const template = selectedFormType ? formTemplates[selectedFormType] : null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Print Form with Customer Data" size="large">
      <div className="form-print-modal">
        {!showPreview ? (
          /* Selection View */
          <div className="form-selection">
            <div className="customer-info">
              <h4>Customer: {customer.name}</h4>
              <p>Select a form template to populate with customer data</p>
            </div>

            {!isSignedIn && (
              <div className="warning-banner">
                Please sign in to Google Drive to access form templates
              </div>
            )}

            {availableForms.length === 0 ? (
              <div className="empty-state">
                <p>No forms available</p>
                <p className="empty-state-hint">
                  Upload image form templates and configure field mappings in Forms Management
                </p>
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label htmlFor="formSelect">Select Form Template</label>
                  <select
                    id="formSelect"
                    value={selectedFormType}
                    onChange={(e) => setSelectedFormType(e.target.value)}
                    disabled={loading || !isSignedIn}
                  >
                    <option value="">-- Select a form --</option>
                    {availableForms.map(({ formType, name, template }) => {
                      const fieldCount = Object.keys(template.fieldMappings || {}).length;
                      return (
                        <option key={formType} value={formType}>
                          {name} ({fieldCount} fields)
                        </option>
                      );
                    })}
                  </select>
                </div>

                {selectedFormType && template && (
                  <div className="form-info">
                    <h4>Form Details</h4>
                    <div className="info-grid">
                      <div className="info-item">
                        <label>Template:</label>
                        <span>{FORM_TYPE_NAMES[selectedFormType] || selectedFormType}</span>
                      </div>
                      <div className="info-item">
                        <label>Fields Mapped:</label>
                        <span>
                          {Object.keys(template.fieldMappings || {}).length}
                        </span>
                      </div>
                      <div className="info-item">
                        <label>Type:</label>
                        <span>Image Form</span>
                      </div>
                    </div>

                    {Object.keys(template.fieldMappings || {}).length > 0 && (
                      <div className="field-preview">
                        <h5>Fields that will be populated:</h5>
                        <div className="field-list">
                          {Object.values(template.fieldMappings).map((field, index) => {
                            const fieldName = field.customValue
                              ? `Custom: "${field.customValue}"`
                              : (FIELD_NAMES[field.type] || field.type);
                            return (
                              <span key={index} className="field-tag">
                                {fieldName}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleGeneratePreview}
                disabled={!selectedFormType || loading || !isSignedIn}
              >
                {loading ? 'Loading...' : 'Generate Preview'}
              </button>
            </div>
          </div>
        ) : (
          /* Preview View */
          <div className="form-preview">
            <div className="preview-header no-print">
              <h4>{FORM_TYPE_NAMES[selectedFormType] || selectedFormType}</h4>
              <button className="btn btn-small btn-secondary" onClick={handleBackToSelection}>
                Back to Selection
              </button>
            </div>

            <div className="preview-container" ref={containerRef}>
              {formImage && (
                <canvas
                  ref={canvasRef}
                  width={imageDimensions.width * scale}
                  height={imageDimensions.height * scale}
                  className="preview-canvas"
                />
              )}
            </div>

            <div className="preview-info-bar">
              <span>
                Original: {imageDimensions.width} x {imageDimensions.height}px
              </span>
              <span>|</span>
              <span>
                Preview: {Math.round(scale * 100)}%
              </span>
              <span>|</span>
              <span>
                {Object.keys(template?.fieldMappings || {}).length} fields populated
              </span>
            </div>

            <div className="preview-actions no-print">
              <button className="btn btn-secondary" onClick={handleDownload}>
                Download Image
              </button>
              <button className="btn btn-primary" onClick={handlePrint}>
                Print Form
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default FormPrintModal;
