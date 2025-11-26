import { useState } from 'react';
import Modal from '../Modal/Modal';
import useDocumentStore from '../../stores/useDocumentStore';
import useExcelStore from '../../stores/useExcelStore';
import templateExportService from '../../services/templateExportService';
import './TemplateExportImport.css';

function TemplateExportImport({ isOpen, onClose }) {
  const { templates: documentTemplates, saveToLocalStorage: saveDocTemplates, loadFromLocalStorage: loadDocTemplates } = useDocumentStore();
  const { excelTemplates, addTemplate: addExcelTemplate, loadFromLocalStorage: loadExcelTemplates } = useExcelStore();

  const [activeTab, setActiveTab] = useState('export'); // 'export' | 'import'
  const [importFile, setImportFile] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState(null);

  const handleExport = (type) => {
    try {
      const result = templateExportService.exportAndDownload(
        documentTemplates,
        excelTemplates,
        type
      );

      alert(
        `✅ Templates exported successfully!\n\n` +
        `File: ${result.filename}\n` +
        (result.documentCount > 0 ? `Document Templates: ${result.documentCount}\n` : '') +
        (result.excelCount > 0 ? `Excel Templates: ${result.excelCount}` : '')
      );
    } catch (err) {
      setError(err.message);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.name.endsWith('.json')) {
        setError('Please select a JSON file');
        return;
      }
      setImportFile(file);
      setError(null);
      setImportResult(null);
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      setError('Please select a file to import');
      return;
    }

    try {
      setError(null);
      const data = await templateExportService.parseImportFile(importFile);
      templateExportService.validateImportData(data);

      const results = [];

      // Import document templates if present
      if (data.type === 'document_templates' || data.type === 'all_templates') {
        const docResult = templateExportService.importDocumentTemplates(data, documentTemplates);

        // Save merged templates to localStorage and reload
        saveDocTemplates(docResult.merged);
        loadDocTemplates();

        results.push({
          type: 'Document Templates',
          imported: docResult.imported
        });
      }

      // Import Excel templates if present
      if (data.type === 'excel_templates' || data.type === 'all_templates') {
        const excelResult = templateExportService.importExcelTemplates(data, excelTemplates);

        // Add each imported template using the store's addTemplate method
        Object.entries(excelResult.merged).forEach(([templateId, template]) => {
          if (template.importedAt) {
            addExcelTemplate(templateId, template);
          }
        });

        results.push({
          type: 'Excel Templates',
          imported: excelResult.imported
        });
      }

      setImportResult(results);
      setImportFile(null);

    } catch (err) {
      setError(err.message);
    }
  };

  const handleClose = () => {
    setActiveTab('export');
    setImportFile(null);
    setImportResult(null);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Template Export/Import" size="large">
      <div className="template-export-import">
        {/* Tab Navigation */}
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'export' ? 'active' : ''}`}
            onClick={() => setActiveTab('export')}
          >
            📤 Export Templates
          </button>
          <button
            className={`tab ${activeTab === 'import' ? 'active' : ''}`}
            onClick={() => setActiveTab('import')}
          >
            📥 Import Templates
          </button>
        </div>

        {error && (
          <div className="error-message">
            ❌ {error}
          </div>
        )}

        {/* Export Tab */}
        {activeTab === 'export' && (
          <div className="export-section">
            <div className="section-description">
              <p>Export your templates to share with other users or create a backup.</p>
              <p className="hint">Templates will be saved as a JSON file that can be imported by other users.</p>
            </div>

            <div className="export-options">
              <div className="export-option">
                <div className="export-option-content">
                  <h4>📄 All Templates</h4>
                  <p>Export both document and Excel templates</p>
                  <div className="template-counts">
                    <span className="count-badge">
                      {Object.keys(documentTemplates).length} Document Templates
                    </span>
                    <span className="count-badge">
                      {Object.keys(excelTemplates).length} Excel Templates
                    </span>
                  </div>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => handleExport('all')}
                  disabled={Object.keys(documentTemplates).length === 0 && Object.keys(excelTemplates).length === 0}
                >
                  Export All
                </button>
              </div>

              <div className="export-option">
                <div className="export-option-content">
                  <h4>📋 Document Templates Only</h4>
                  <p>Export form templates with field mappings</p>
                  <div className="template-counts">
                    <span className="count-badge">
                      {Object.keys(documentTemplates).length} Templates
                    </span>
                  </div>
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={() => handleExport('documents')}
                  disabled={Object.keys(documentTemplates).length === 0}
                >
                  Export Documents
                </button>
              </div>

              <div className="export-option">
                <div className="export-option-content">
                  <h4>📊 Excel Templates Only</h4>
                  <p>Export Excel templates with field mappings</p>
                  <div className="template-counts">
                    <span className="count-badge">
                      {Object.keys(excelTemplates).length} Templates
                    </span>
                  </div>
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={() => handleExport('excel')}
                  disabled={Object.keys(excelTemplates).length === 0}
                >
                  Export Excel
                </button>
              </div>
            </div>

            <div className="export-note">
              <strong>📝 Note for Excel Templates:</strong>
              <p>Excel templates with master files will need the Excel file re-uploaded after import, as Drive file references don't transfer between accounts.</p>
            </div>
          </div>
        )}

        {/* Import Tab */}
        {activeTab === 'import' && (
          <div className="import-section">
            <div className="section-description">
              <p>Import templates from a JSON file exported from another account.</p>
              <p className="hint">Templates will be added to your existing templates. Duplicates will be renamed automatically.</p>
            </div>

            <div className="import-upload">
              <input
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                id="import-file"
                className="file-input"
              />
              <label htmlFor="import-file" className="file-label">
                {importFile ? (
                  <span>✅ {importFile.name}</span>
                ) : (
                  <span>📁 Choose JSON File...</span>
                )}
              </label>
            </div>

            {importFile && (
              <div className="import-actions">
                <button
                  className="btn btn-primary"
                  onClick={handleImport}
                >
                  Import Templates
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setImportFile(null);
                    setError(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            )}

            {importResult && (
              <div className="import-result">
                <h4>✅ Import Successful!</h4>
                {importResult.map((result, index) => (
                  <div key={index} className="result-section">
                    <h5>{result.type}</h5>
                    <ul className="imported-list">
                      {result.imported.map((item, idx) => (
                        <li key={idx}>
                          {item.renamed ? (
                            <span>
                              "{item.originalName}" → "{item.newName}" <span className="renamed-badge">(renamed)</span>
                            </span>
                          ) : (
                            <span>"{item.newName}"</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <div className="result-note">
                  <strong>Next Steps:</strong>
                  <p>• Document templates are ready to use</p>
                  <p>• Excel templates: Upload master files in Excel Manager if needed</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={handleClose}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default TemplateExportImport;
