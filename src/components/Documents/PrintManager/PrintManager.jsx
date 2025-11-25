import { useState, useEffect } from 'react';
import Modal from '../../Modal/Modal';
import useDocumentStore from '../../../stores/useDocumentStore';
import useAuthStore from '../../../stores/useAuthStore';
import documentRenderer from '../../../services/documentRenderer';
import pdfGenerator from '../../../services/pdfGenerator';
import { getCustomerDataMapping } from '../../../services/fieldMapper';
import driveService from '../../../services/driveService';
import './PrintManager.css';

/**
 * PrintManager - Print documents with customer data
 *
 * Features:
 * - Single or multi-page document printing
 * - PDF generation with perfect quality
 * - Preview before printing
 * - Save to Google Drive
 * - Download as PDF
 */
function PrintManager({ isOpen, onClose, customer }) {
  const { templates, loadFromLocalStorage } = useDocumentStore();
  const { isSignedIn } = useAuthStore();

  const [selectedTemplateIds, setSelectedTemplateIds] = useState([]);
  const [step, setStep] = useState('select'); // 'select' | 'preview' | 'processing'
  const [renders, setRenders] = useState([]);
  const [pdf, setPdf] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadFromLocalStorage();
      setSelectedTemplateIds([]);
      setStep('select');
      setRenders([]);
      setPdf(null);
      setError(null);
    }
  }, [isOpen, loadFromLocalStorage]);

  const templateArray = Object.values(templates).filter(
    (t) => Object.keys(t.fields || {}).length > 0
  );

  const handleTemplateToggle = (templateId) => {
    if (selectedTemplateIds.includes(templateId)) {
      setSelectedTemplateIds(selectedTemplateIds.filter((id) => id !== templateId));
    } else {
      setSelectedTemplateIds([...selectedTemplateIds, templateId]);
    }
  };

  const handleGeneratePreview = async () => {
    if (selectedTemplateIds.length === 0) {
      alert('Please select at least one document template');
      return;
    }

    if (!isSignedIn) {
      alert('Please sign in to Google Drive to access templates');
      return;
    }

    setStep('processing');
    setError(null);

    try {
      // Get customer data mapping
      const customerData = getCustomerDataMapping(customer);

      // Render all selected templates
      const selectedTemplates = selectedTemplateIds.map((id) => templates[id]);
      const renderResults = await documentRenderer.renderMultipleDocuments(
        selectedTemplates,
        customerData
      );

      setRenders(renderResults);

      // Generate PDF
      const generatedPdf = await pdfGenerator.generatePDFFromRenders(renderResults, {
        title: `${customer.name} - Documents`,
        filename: `${customer.name}_documents.pdf`,
      });

      setPdf(generatedPdf);
      setStep('preview');
    } catch (err) {
      console.error('Error generating preview:', err);
      setError(err.message);
      setStep('select');
    }
  };

  const handlePrint = () => {
    if (!pdf) return;

    pdfGenerator.openPDFInPrintWindow(pdf, `${customer.name} - Documents`);
  };

  const handleDownload = () => {
    if (!pdf) return;

    const filename = `${customer.name}_${new Date().toISOString().split('T')[0]}.pdf`;
    pdfGenerator.downloadPDF(pdf, filename);
  };

  const handleSaveToDrive = async () => {
    if (!pdf) return;

    try {
      setStep('processing');

      // Get or create customer folder
      const customerFolder = await driveService.getOrCreateCustomerFolder(customer.name);

      // Generate filename
      const filename = `${customer.name}_Documents_${new Date().toISOString().split('T')[0]}.pdf`;

      // Get PDF blob
      const blob = pdfGenerator.getPDFBlob(pdf);

      // Upload to Drive
      await driveService.uploadFile(filename, blob, customerFolder.id);

      alert(`PDF saved to Google Drive successfully!\nFolder: ${customer.name}`);
      onClose();
    } catch (err) {
      console.error('Error saving to Drive:', err);
      alert('Failed to save to Drive: ' + err.message);
      setStep('preview');
    }
  };

  const handleBackToSelection = () => {
    setStep('select');
    setRenders([]);
    setPdf(null);
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Print Documents"
      size={step === 'preview' ? 'large' : 'medium'}
    >
      <div className="print-manager">
        {/* Customer Info */}
        <div className="print-customer-info">
          <h3>Customer: {customer.name}</h3>
          {customer.phone && <p>Phone: {customer.phone}</p>}
          {customer.nric && <p>NRIC: {customer.nric}</p>}
        </div>

        {!isSignedIn && (
          <div className="warning-banner">
            ⚠️ Please sign in to Google Drive to access document templates
          </div>
        )}

        {error && (
          <div className="error-banner">
            ❌ Error: {error}
          </div>
        )}

        {/* Step 1: Select Templates */}
        {step === 'select' && (
          <div className="print-select-step">
            <h4>Select Document Templates to Print</h4>

            {templateArray.length === 0 ? (
              <div className="empty-state">
                <p>No document templates available</p>
                <p className="empty-state-hint">
                  Create and configure document templates in Document Manager first
                </p>
              </div>
            ) : (
              <div className="template-selection-grid">
                {templateArray.map((template) => (
                  <div
                    key={template.id}
                    className={`template-card ${
                      selectedTemplateIds.includes(template.id) ? 'selected' : ''
                    }`}
                    onClick={() => handleTemplateToggle(template.id)}
                  >
                    <div className="template-card-header">
                      <input
                        type="checkbox"
                        checked={selectedTemplateIds.includes(template.id)}
                        onChange={() => {}}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <h4>{template.name}</h4>
                    </div>
                    <div className="template-card-body">
                      <div className="template-meta">
                        <span className="meta-badge">{template.category}</span>
                        <span className="meta-badge">
                          {Object.keys(template.fields || {}).length} fields
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedTemplateIds.length > 0 && (
              <div className="selection-summary">
                <p>
                  <strong>{selectedTemplateIds.length}</strong> template
                  {selectedTemplateIds.length > 1 ? 's' : ''} selected
                  {selectedTemplateIds.length > 1 && (
                    <span className="multi-page-note">
                      {' '}
                      (will create {selectedTemplateIds.length}-page PDF)
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Processing */}
        {step === 'processing' && (
          <div className="print-processing-step">
            <div className="loading-spinner"></div>
            <p>Generating your documents...</p>
            <p className="processing-hint">This may take a few moments</p>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === 'preview' && renders.length > 0 && (
          <div className="print-preview-step">
            <div className="preview-header">
              <h4>Document Preview ({renders.length} page{renders.length > 1 ? 's' : ''})</h4>
              <button
                className="btn btn-small btn-secondary"
                onClick={handleBackToSelection}
              >
                ← Change Selection
              </button>
            </div>

            <div className="preview-pages">
              {renders.map((render, index) => (
                <div key={index} className="preview-page">
                  <div className="preview-page-label">
                    Page {index + 1} - {selectedTemplateIds[index] && templates[selectedTemplateIds[index]]?.name}
                  </div>
                  <img
                    src={render.dataUrl}
                    alt={`Page ${index + 1}`}
                    className="preview-image"
                  />
                </div>
              ))}
            </div>

            {pdf && (
              <div className="pdf-info">
                <p>
                  📄 PDF generated: {renders.length} page{renders.length > 1 ? 's' : ''},{' '}
                  {pdfGenerator.formatFileSize(pdfGenerator.getPDFSize(pdf))}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="print-manager-footer">
          {step === 'select' && (
            <>
              <button
                className="btn btn-secondary"
                onClick={onClose}
                disabled={false}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleGeneratePreview}
                disabled={selectedTemplateIds.length === 0 || !isSignedIn}
              >
                Generate Preview
              </button>
            </>
          )}

          {step === 'preview' && (
            <>
              <button className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
              <button className="btn btn-success" onClick={handleSaveToDrive}>
                💾 Save to Drive
              </button>
              <button className="btn btn-info" onClick={handleDownload}>
                ⬇️ Download PDF
              </button>
              <button className="btn btn-primary" onClick={handlePrint}>
                🖨️ Print
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default PrintManager;
