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

  useEffect(() => {
    if (isOpen) {
      loadFromLocalStorage();
      setSide1FormType('');
      setSide2FormType('');
      setProcessing(false);
    }
  }, [isOpen, loadFromLocalStorage]);

  const availableForms = formService.getAvailableForms(formTemplates);

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
      // Render both forms with customer data
      const template1 = formTemplates[side1FormType];
      const template2 = formTemplates[side2FormType];

      const form1Data = await formService.renderFormWithData(template1, customer);
      const form2Data = await formService.renderFormWithData(template2, customer);

      // Get form names
      const form1Name = formService.getFormTypeName(side1FormType);
      const form2Name = formService.getFormTypeName(side2FormType);

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

        {availableForms.length === 0 ? (
          <div className="empty-state">
            <p>No forms available</p>
            <p className="empty-state-hint">
              Upload image form templates and configure field mappings in Forms Management
            </p>
          </div>
        ) : availableForms.length < 2 ? (
          <div className="empty-state">
            <p>At least 2 forms required</p>
            <p className="empty-state-hint">
              You need at least two different forms with field mappings configured to use this feature
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

              <div className="form-group">
                <label htmlFor="side2">Page 2 (Back Side)</label>
                <select
                  id="side2"
                  value={side2FormType}
                  onChange={(e) => setSide2FormType(e.target.value)}
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
            </div>

            {side1FormType && side2FormType && (
              <div className="preview-info">
                <h4>Print Preview</h4>
                <div className="preview-grid">
                  <div className="preview-item">
                    <div className="preview-page-number">Page 1 (Front)</div>
                    <div className="preview-form-name">
                      {formService.getFormTypeName(side1FormType)}
                    </div>
                    <div className="preview-field-count">
                      {Object.keys(formTemplates[side1FormType].fieldMappings || {}).length} fields
                    </div>
                  </div>
                  <div className="preview-item">
                    <div className="preview-page-number">Page 2 (Back)</div>
                    <div className="preview-form-name">
                      {formService.getFormTypeName(side2FormType)}
                    </div>
                    <div className="preview-field-count">
                      {Object.keys(formTemplates[side2FormType].fieldMappings || {}).length} fields
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
              !isSignedIn
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
