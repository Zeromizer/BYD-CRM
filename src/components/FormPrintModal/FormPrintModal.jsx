import { useState, useEffect } from 'react';
import useFormsStore from '../../stores/useFormsStore';
import useAuthStore from '../../stores/useAuthStore';
import authService from '../../services/authService';
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
  other: 'Other Form',
};

function FormPrintModal({ isOpen, onClose, customer }) {
  const { formTemplates, loadFromLocalStorage } = useFormsStore();
  const { isSignedIn } = useAuthStore();

  const [selectedFormType, setSelectedFormType] = useState('');
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadFromLocalStorage();
      setSelectedFormType('');
      setImageUrl(null);
      setShowPreview(false);
      setImageDimensions({ width: 0, height: 0 });
    }
  }, [isOpen, loadFromLocalStorage]);

  const getCustomerDataMapping = (customer) => {
    const today = new Date().toLocaleDateString();

    return {
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
    };
  };

  const getAvailableForms = () => {
    const available = [];

    for (const [formType, template] of Object.entries(formTemplates)) {
      if (template.fileType === 'image' && template.fieldMappings && Object.keys(template.fieldMappings).length > 0) {
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

  const loadFormImage = async (fileId) => {
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
      const url = URL.createObjectURL(blob);
      return url;
    } catch (error) {
      console.error('Error loading form image:', error);
      throw error;
    }
  };

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
      const url = await loadFormImage(template.fileId);
      setImageUrl(url);
      setShowPreview(true);
    } catch (error) {
      console.error('Error generating preview:', error);
      alert('Failed to generate preview: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImageLoad = (e) => {
    const img = e.target;
    setImageDimensions({
      width: img.naturalWidth,
      height: img.naturalHeight,
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleBackToSelection = () => {
    setShowPreview(false);
    setImageUrl(null);
    setImageDimensions({ width: 0, height: 0 });
  };

  if (!isOpen) return null;

  const template = selectedFormType ? formTemplates[selectedFormType] : null;
  const customerData = getCustomerDataMapping(customer);

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
                ⚠️ Please sign in to Google Drive to access form templates
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

                {selectedFormType && (
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
                          {Object.keys(formTemplates[selectedFormType].fieldMappings || {}).length}
                        </span>
                      </div>
                      <div className="info-item">
                        <label>Type:</label>
                        <span>Image Form</span>
                      </div>
                    </div>
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
                ← Back to Selection
              </button>
            </div>

            <div className="preview-container">
              {imageUrl && (
                <div className="filled-form-wrapper">
                  <img
                    src={imageUrl}
                    alt="Form template"
                    onLoad={handleImageLoad}
                    className="form-image"
                  />
                  {imageDimensions.width > 0 && template?.fieldMappings && (
                    <svg
                      className="form-text-overlay"
                      viewBox={`0 0 ${imageDimensions.width} ${imageDimensions.height}`}
                    >
                      {Object.entries(template.fieldMappings).map(([fieldId, field]) => {
                        // Get the text value for this field
                        let text = '';
                        if (field.customValue) {
                          text = field.customValue;
                        } else {
                          text = customerData[field.type] || '';
                        }

                        if (!text) return null;

                        return (
                          <text
                            key={fieldId}
                            x={field.x}
                            y={field.y}
                            fill={field.color || '#000000'}
                            fontSize={field.fontSize || 14}
                            fontFamily="Arial"
                          >
                            {text}
                          </text>
                        );
                      })}
                    </svg>
                  )}
                </div>
              )}
            </div>

            <div className="preview-actions no-print">
              <button className="btn btn-primary" onClick={handlePrint}>
                🖨️ Print Form
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default FormPrintModal;
