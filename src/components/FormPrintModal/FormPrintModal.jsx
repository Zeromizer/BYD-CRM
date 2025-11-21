import { useState, useEffect } from 'react';
import useFormsStore from '../../stores/useFormsStore';
import useAuthStore from '../../stores/useAuthStore';
import formService from '../../services/formService';
import Modal from '../Modal/Modal';
import './FormPrintModal.css';

function FormPrintModal({ isOpen, onClose, customer }) {
  const { formTemplates, loadFromLocalStorage } = useFormsStore();
  const { isSignedIn } = useAuthStore();

  const [selectedFormType, setSelectedFormType] = useState('');
  const [processing, setProcessing] = useState(false);
  const [renderedForm, setRenderedForm] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadFromLocalStorage();
      setSelectedFormType('');
      setRenderedForm(null);
      setShowPreview(false);
    }
  }, [isOpen, loadFromLocalStorage]);

  const availableForms = formService.getAvailableForms(formTemplates);

  const handleGeneratePreview = async () => {
    if (!selectedFormType) {
      alert('Please select a form to preview');
      return;
    }

    if (!isSignedIn) {
      alert('Please sign in to Google Drive to access form templates');
      return;
    }

    setProcessing(true);

    try {
      const template = formTemplates[selectedFormType];
      const renderedFormBase64 = await formService.renderFormWithData(template, customer);

      setRenderedForm(renderedFormBase64);
      setShowPreview(true);
    } catch (error) {
      console.error('Error generating preview:', error);
      alert('Failed to generate preview: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handlePrint = () => {
    if (!renderedForm) {
      alert('Please generate a preview first');
      return;
    }

    const template = formTemplates[selectedFormType];
    const formName = formService.getFormTypeName(selectedFormType);

    formService.openFormInPrintWindow(renderedForm, formName, customer.name);
  };

  const handleDownload = () => {
    if (!renderedForm) {
      alert('Please generate a preview first');
      return;
    }

    const formName = formService.getFormTypeName(selectedFormType);
    const timestamp = new Date().toISOString().split('T')[0];
    const fileName = `${customer.name.replace(/\s+/g, '_')}_${formName.replace(/\s+/g, '_')}_${timestamp}.jpg`;

    formService.downloadForm(renderedForm, fileName);
  };

  const handleBackToSelection = () => {
    setShowPreview(false);
    setRenderedForm(null);
  };

  if (!isOpen) return null;

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
                    disabled={processing || !isSignedIn}
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
                        <span>{formService.getFormTypeName(selectedFormType)}</span>
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
              <button className="btn btn-secondary" onClick={onClose} disabled={processing}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleGeneratePreview}
                disabled={!selectedFormType || processing || !isSignedIn}
              >
                {processing ? 'Generating...' : 'Generate Preview'}
              </button>
            </div>
          </div>
        ) : (
          /* Preview View */
          <div className="form-preview">
            <div className="preview-header">
              <h4>{formService.getFormTypeName(selectedFormType)}</h4>
              <button className="btn btn-small btn-secondary" onClick={handleBackToSelection}>
                ← Back to Selection
              </button>
            </div>

            <div className="preview-container">
              <img src={renderedForm} alt="Form Preview" className="preview-image" />
            </div>

            <div className="preview-actions">
              <button className="btn btn-secondary" onClick={handleDownload}>
                💾 Download Image
              </button>
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
