import { useState } from 'react';
import Modal from '../Modal/Modal';
import useDocumentStore from '../../stores/useDocumentStore';
import useExcelStore from '../../stores/useExcelStore';
import useAuthStore from '../../stores/useAuthStore';
import templateExportService from '../../services/templateExportService';
import './TemplateExportImport.css';

function TemplateExportImport({ isOpen, onClose }) {
  const { templates: documentTemplates, saveToLocalStorage: saveDocTemplates, loadFromLocalStorage: loadDocTemplates, syncWithDrive: syncDocWithDrive } = useDocumentStore();
  const { excelTemplates, addTemplate: addExcelTemplate } = useExcelStore();
  const { isSignedIn } = useAuthStore();

  const [activeTab, setActiveTab] = useState('export'); // 'export' | 'import'
  const [importFile, setImportFile] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(null);
  const [importProgress, setImportProgress] = useState(null);

  // Check if there are any templates with master files
  const hasExcelMasterFiles = Object.values(excelTemplates).some(t => t.driveFileId);
  const hasDocumentBackgroundFiles = Object.values(documentTemplates).some(t => t.fileId);
  const hasMasterFiles = hasExcelMasterFiles || hasDocumentBackgroundFiles;

  const handleExport = async (type, includeMasterFiles = false) => {
    try {
      setError(null);

      // If including master files, use async ZIP export
      if (includeMasterFiles && isSignedIn) {
        setIsExporting(true);
        setExportProgress({ type: 'starting' });

        const result = await templateExportService.exportWithMasterFiles(
          documentTemplates,
          excelTemplates,
          type,
          (progress) => setExportProgress(progress)
        );

        setExportProgress(null);
        setIsExporting(false);

        alert(
          `Templates exported successfully!\n\n` +
          `File: ${result.filename}\n` +
          (result.documentCount > 0 ? `Document Templates: ${result.documentCount}\n` : '') +
          (result.excelCount > 0 ? `Excel Templates: ${result.excelCount}\n` : '') +
          `Master Files Included: ${result.masterFilesIncluded}\n\n` +
          `The ZIP file contains all template configurations and master files. ` +
          `Recipients can import this ZIP to get everything set up automatically.`
        );
      } else {
        // Legacy JSON-only export
        const result = templateExportService.exportAndDownload(
          documentTemplates,
          excelTemplates,
          type
        );

        alert(
          `Templates exported successfully!\n\n` +
          `File: ${result.filename}\n` +
          (result.documentCount > 0 ? `Document Templates: ${result.documentCount}\n` : '') +
          (result.excelCount > 0 ? `Excel Templates: ${result.excelCount}` : '')
        );
      }
    } catch (err) {
      setIsExporting(false);
      setExportProgress(null);
      setError(err.message);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.name.endsWith('.json') && !file.name.endsWith('.zip')) {
        setError('Please select a JSON or ZIP file');
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
      setIsImporting(true);
      setImportProgress({ type: 'parsing' });

      const data = await templateExportService.parseImportFile(importFile);
      templateExportService.validateImportData(data);

      const results = [];

      // Check if this is a ZIP import with master files
      if (data._isZipImport && isSignedIn) {
        setImportProgress({ type: 'uploading_master_files' });

        // Use the new import with master files method
        const importResults = await templateExportService.importWithMasterFiles(
          data,
          documentTemplates,
          excelTemplates,
          (progress) => setImportProgress(progress)
        );

        // Save document templates
        if (importResults.documentTemplates) {
          saveDocTemplates(importResults.documentTemplates.merged);
          loadDocTemplates();

          results.push({
            type: 'Document Templates',
            imported: importResults.documentTemplates.imported
          });
        }

        // Save Excel templates
        if (importResults.excelTemplates) {
          Object.entries(importResults.excelTemplates.merged).forEach(([templateId, template]) => {
            if (template.importedAt) {
              addExcelTemplate(templateId, template);
            }
          });
          results.push({
            type: 'Excel Templates',
            imported: importResults.excelTemplates.imported
          });
        }

        // Show any errors
        if (importResults.errors.length > 0) {
          setError(`Some files failed to upload: ${importResults.errors.join(', ')}`);
        }
      } else {
        // Legacy JSON import (no master files)

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
      }

      // Trigger a single sync to Google Drive for document templates
      // This avoids multiple simultaneous sync operations
      if (results.some(r => r.type === 'Document Templates') && isSignedIn) {
        setImportProgress({ type: 'syncing' });
        try {
          await syncDocWithDrive();
        } catch (syncError) {
          console.error('Failed to sync document templates to Drive:', syncError);
          // Don't fail the import, just log the error
        }
      }

      setImportResult(results);
      setImportFile(null);
      setIsImporting(false);
      setImportProgress(null);

    } catch (err) {
      setError(err.message);
      setIsImporting(false);
      setImportProgress(null);
    }
  };

  const handleClose = () => {
    setActiveTab('export');
    setImportFile(null);
    setImportResult(null);
    setError(null);
    setIsExporting(false);
    setIsImporting(false);
    setExportProgress(null);
    setImportProgress(null);
    onClose();
  };

  // Render progress indicator
  const renderProgressIndicator = () => {
    if (exportProgress) {
      if (exportProgress.type === 'downloading') {
        return (
          <div className="progress-indicator">
            <div className="progress-spinner"></div>
            <p>Downloading: {exportProgress.templateName}</p>
            <p className="progress-count">{exportProgress.current} of {exportProgress.total} files</p>
          </div>
        );
      }
      if (exportProgress.type === 'creating_zip') {
        return (
          <div className="progress-indicator">
            <div className="progress-spinner"></div>
            <p>Creating ZIP file...</p>
          </div>
        );
      }
      return (
        <div className="progress-indicator">
          <div className="progress-spinner"></div>
          <p>Preparing export...</p>
        </div>
      );
    }

    if (importProgress) {
      if (importProgress.type === 'uploading') {
        return (
          <div className="progress-indicator">
            <div className="progress-spinner"></div>
            <p>Uploading: {importProgress.templateName}</p>
          </div>
        );
      }
      if (importProgress.type === 'parsing') {
        return (
          <div className="progress-indicator">
            <div className="progress-spinner"></div>
            <p>Reading import file...</p>
          </div>
        );
      }
      if (importProgress.type === 'syncing') {
        return (
          <div className="progress-indicator">
            <div className="progress-spinner"></div>
            <p>Syncing templates to Google Drive...</p>
          </div>
        );
      }
      return (
        <div className="progress-indicator">
          <div className="progress-spinner"></div>
          <p>Uploading master files to Google Drive...</p>
        </div>
      );
    }

    return null;
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
            disabled={isExporting || isImporting}
          >
            Export Templates
          </button>
          <button
            className={`tab ${activeTab === 'import' ? 'active' : ''}`}
            onClick={() => setActiveTab('import')}
            disabled={isExporting || isImporting}
          >
            Import Templates
          </button>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {/* Progress Indicator */}
        {renderProgressIndicator()}

        {/* Export Tab */}
        {activeTab === 'export' && !isExporting && (
          <div className="export-section">
            <div className="section-description">
              <p>Export your templates to share with other users or create a backup.</p>
              {isSignedIn && hasMasterFiles ? (
                <p className="hint">
                  <strong>Recommended:</strong> Use "Export with Master Files" to include Excel master files and document backgrounds.
                  Recipients can import everything with one click!
                </p>
              ) : (
                <p className="hint">Templates will be saved as a JSON file that can be imported by other users.</p>
              )}
            </div>

            {/* Export with Master Files - Primary Option */}
            {isSignedIn && hasMasterFiles && (
              <div className="export-options primary-export">
                <div className="export-option highlight">
                  <div className="export-option-content">
                    <h4>Export with Master Files (Recommended)</h4>
                    <p>Export templates as a ZIP file including all master Excel files and document backgrounds.</p>
                    <div className="template-counts">
                      <span className="count-badge">
                        {Object.keys(documentTemplates).length} Document Templates
                        {hasDocumentBackgroundFiles && ` (${Object.values(documentTemplates).filter(t => t.fileId).length} with backgrounds)`}
                      </span>
                      <span className="count-badge">
                        {Object.keys(excelTemplates).length} Excel Templates
                        {hasExcelMasterFiles && ` (${Object.values(excelTemplates).filter(t => t.driveFileId).length} with master files)`}
                      </span>
                    </div>
                  </div>
                  <button
                    className="btn btn-primary btn-large"
                    onClick={() => handleExport('all', true)}
                    disabled={Object.keys(documentTemplates).length === 0 && Object.keys(excelTemplates).length === 0}
                  >
                    Export All with Files
                  </button>
                </div>
              </div>
            )}

            {/* Regular Export Options */}
            <div className="export-options">
              <div className="export-option">
                <div className="export-option-content">
                  <h4>All Templates {!hasMasterFiles && '(Config Only)'}</h4>
                  <p>Export both document and Excel template configurations</p>
                  <div className="template-counts">
                    <span className="count-badge">
                      {Object.keys(documentTemplates).length} Document Templates
                    </span>
                    <span className="count-badge">
                      {Object.keys(excelTemplates).length} Excel Templates
                    </span>
                  </div>
                </div>
                <div className="export-buttons">
                  {isSignedIn && hasMasterFiles && (
                    <button
                      className="btn btn-primary"
                      onClick={() => handleExport('all', true)}
                      disabled={Object.keys(documentTemplates).length === 0 && Object.keys(excelTemplates).length === 0}
                    >
                      With Files (ZIP)
                    </button>
                  )}
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleExport('all', false)}
                    disabled={Object.keys(documentTemplates).length === 0 && Object.keys(excelTemplates).length === 0}
                  >
                    Config Only (JSON)
                  </button>
                </div>
              </div>

              <div className="export-option">
                <div className="export-option-content">
                  <h4>Document Templates Only</h4>
                  <p>Export form templates with field mappings</p>
                  <div className="template-counts">
                    <span className="count-badge">
                      {Object.keys(documentTemplates).length} Templates
                    </span>
                  </div>
                </div>
                <div className="export-buttons">
                  {isSignedIn && hasDocumentBackgroundFiles && (
                    <button
                      className="btn btn-primary"
                      onClick={() => handleExport('documents', true)}
                      disabled={Object.keys(documentTemplates).length === 0}
                    >
                      With Files (ZIP)
                    </button>
                  )}
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleExport('documents', false)}
                    disabled={Object.keys(documentTemplates).length === 0}
                  >
                    Config Only (JSON)
                  </button>
                </div>
              </div>

              <div className="export-option">
                <div className="export-option-content">
                  <h4>Excel Templates Only</h4>
                  <p>Export Excel templates with field mappings</p>
                  <div className="template-counts">
                    <span className="count-badge">
                      {Object.keys(excelTemplates).length} Templates
                    </span>
                  </div>
                </div>
                <div className="export-buttons">
                  {isSignedIn && hasExcelMasterFiles && (
                    <button
                      className="btn btn-primary"
                      onClick={() => handleExport('excel', true)}
                      disabled={Object.keys(excelTemplates).length === 0}
                    >
                      With Files (ZIP)
                    </button>
                  )}
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleExport('excel', false)}
                    disabled={Object.keys(excelTemplates).length === 0}
                  >
                    Config Only (JSON)
                  </button>
                </div>
              </div>
            </div>

            {!isSignedIn && hasMasterFiles && (
              <div className="export-note warning">
                <strong>Sign in to Google Drive</strong>
                <p>Sign in to export templates with master files. Without signing in, only template configurations (JSON) can be exported.</p>
              </div>
            )}

            {hasMasterFiles && (
              <div className="export-note info">
                <strong>About Export with Master Files:</strong>
                <p>
                  Exports a ZIP file containing template configurations and all associated files (Excel master files, document backgrounds).
                  Recipients can import this ZIP and have everything set up automatically - no need to manually upload master files!
                </p>
              </div>
            )}
          </div>
        )}

        {/* Import Tab */}
        {activeTab === 'import' && !isImporting && (
          <div className="import-section">
            <div className="section-description">
              <p>Import templates from a JSON or ZIP file exported from another account.</p>
              <p className="hint">
                {isSignedIn
                  ? 'ZIP files with master files will be automatically uploaded to your Google Drive.'
                  : 'Sign in to Google Drive to import ZIP files with master files.'}
              </p>
            </div>

            <div className="import-upload">
              <input
                type="file"
                accept=".json,.zip"
                onChange={handleFileSelect}
                id="import-file"
                className="file-input"
              />
              <label htmlFor="import-file" className="file-label">
                {importFile ? (
                  <span>{importFile.name}</span>
                ) : (
                  <span>Choose JSON or ZIP File...</span>
                )}
              </label>
            </div>

            {importFile && (
              <>
                <div className="import-file-info">
                  {importFile.name.endsWith('.zip') ? (
                    <p className="file-type-info zip">
                      <strong>ZIP File Detected</strong>
                      {isSignedIn
                        ? ' - Master files will be automatically uploaded to Google Drive'
                        : ' - Sign in to Google Drive to upload master files'}
                    </p>
                  ) : (
                    <p className="file-type-info json">
                      <strong>JSON File</strong> - Template configurations only (no master files)
                    </p>
                  )}
                </div>

                <div className="import-actions">
                  <button
                    className="btn btn-primary"
                    onClick={handleImport}
                    disabled={importFile.name.endsWith('.zip') && !isSignedIn}
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

                {importFile.name.endsWith('.zip') && !isSignedIn && (
                  <div className="import-warning">
                    Please sign in to Google Drive to import ZIP files with master files.
                  </div>
                )}
              </>
            )}

            {importResult && (
              <div className="import-result">
                <h4>Import Successful!</h4>
                {importResult.map((result, index) => (
                  <div key={index} className="result-section">
                    <h5>{result.type}</h5>
                    <ul className="imported-list">
                      {result.imported.map((item, idx) => (
                        <li key={idx}>
                          {item.renamed ? (
                            <span>
                              "{item.originalName}" renamed to "{item.newName}"
                            </span>
                          ) : (
                            <span>"{item.newName}"</span>
                          )}
                          {item.hasMasterFile && (
                            <span className="master-file-badge"> (with master file)</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <div className="result-note success">
                  <strong>Import Complete!</strong>
                  <p>Your templates are ready to use. Master files have been uploaded to your Google Drive.</p>
                </div>
              </div>
            )}

            <div className="import-info">
              <h4>Supported Import Formats:</h4>
              <ul>
                <li><strong>ZIP files</strong> - Contains templates with master files (Excel/document backgrounds). Everything is set up automatically!</li>
                <li><strong>JSON files</strong> - Template configurations only. You'll need to upload master files separately.</li>
              </ul>
            </div>
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
