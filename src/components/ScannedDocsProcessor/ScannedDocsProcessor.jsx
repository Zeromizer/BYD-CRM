/**
 * Scanned Docs Processor Component
 * Processes documents from Genius Scan's OneDrive folder
 *
 * Workflow:
 * 1. User scans documents with Genius Scan mobile app
 * 2. Genius Scan saves to OneDrive "Scanned Docs" folder
 * 3. User opens this component in CRM
 * 4. AI classifies each document
 * 5. Documents are moved to customer folders and checklist updated
 */

import { useState, useEffect, useCallback } from 'react';
import {
  FolderOpen,
  FileText,
  RefreshCw,
  Sparkles,
  ChevronRight,
  Check,
  X,
  Loader,
  User,
  FolderInput,
  Trash2,
  Eye,
  Settings,
} from 'lucide-react';
import oneDriveService from '../../services/oneDriveService';
import { classifyDocument } from '../../services/documentClassifierService';
import { findMatchingChecklistItem } from '../../services/documentUploadProcessor';
import { isGeminiAvailable } from '../../services/geminiService';
import useCustomerStore from '../../stores/useCustomerStore';
import './ScannedDocsProcessor.css';

// Default folder path for Genius Scan
const DEFAULT_SCANNED_DOCS_PATH = 'BYD CRM/Scanned Docs';
const SETTINGS_KEY = 'bydcrm_scanned_docs_folder';

function ScannedDocsProcessor({ isOpen, onClose, onProcessComplete }) {
  // State
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(null); // file id being processed
  const [error, setError] = useState(null);
  const [scannedDocsFolderId, setScannedDocsFolderId] = useState(null);
  const [folderPath, setFolderPath] = useState(DEFAULT_SCANNED_DOCS_PATH);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [classification, setClassification] = useState(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [processResult, setProcessResult] = useState(null);

  // Get customers from store
  const customers = useCustomerStore((state) => state.customers);
  const { addDocumentFile, saveToLocalStorage, saveCustomerToFolder } = useCustomerStore.getState();

  // Load saved folder path
  useEffect(() => {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        if (settings.folderPath) setFolderPath(settings.folderPath);
        if (settings.folderId) setScannedDocsFolderId(settings.folderId);
      } catch (e) {
        console.warn('Failed to load scanned docs settings');
      }
    }
  }, []);

  // Save folder settings
  const saveFolderSettings = (path, folderId) => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ folderPath: path, folderId }));
  };

  // Load files from Scanned Docs folder
  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    setFiles([]);

    try {
      let folderId = scannedDocsFolderId;

      // If no folder ID, try to find/create the folder
      if (!folderId) {
        // Navigate to the folder path
        const pathParts = folderPath.split('/').filter(Boolean);
        let currentFolderId = 'root';

        for (const part of pathParts) {
          try {
            currentFolderId = await oneDriveService.getOrCreateFolder(part, currentFolderId);
          } catch (e) {
            throw new Error(`Could not find or create folder: ${part}`);
          }
        }

        folderId = currentFolderId;
        setScannedDocsFolderId(folderId);
        saveFolderSettings(folderPath, folderId);
      }

      // List files in the folder
      const items = await oneDriveService.listFolder(folderId);

      // Filter for images and PDFs only
      const docFiles = items.filter(item =>
        !item.folder && (
          item.name.toLowerCase().endsWith('.jpg') ||
          item.name.toLowerCase().endsWith('.jpeg') ||
          item.name.toLowerCase().endsWith('.png') ||
          item.name.toLowerCase().endsWith('.pdf')
        )
      );

      setFiles(docFiles);

      if (docFiles.length === 0) {
        setError('No scanned documents found in the folder');
      }
    } catch (err) {
      console.error('Failed to load scanned docs:', err);
      setError(err.message || 'Failed to load scanned documents');
    } finally {
      setLoading(false);
    }
  }, [folderPath, scannedDocsFolderId]);

  // Load files when opened
  useEffect(() => {
    if (isOpen) {
      loadFiles();
    }
  }, [isOpen, loadFiles]);

  // Preview a file
  const handlePreview = async (file) => {
    setSelectedFile(file);
    setClassification(null);
    setSelectedCustomerId(null);
    setProcessResult(null);
    setPreviewUrl(null);

    try {
      // For PDFs, use the preview URL
      if (file.name.toLowerCase().endsWith('.pdf')) {
        const url = await oneDriveService.getPreviewUrl(file.id);
        setPreviewUrl(url);
      } else {
        // For images, download as blob and create object URL
        const blob = await oneDriveService.downloadFileAsBlob(file.id);
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
      }
    } catch (err) {
      console.error('Failed to get preview:', err);
      setPreviewUrl(null);
    }
  };

  // Classify document with AI
  const handleClassify = async () => {
    if (!selectedFile) return;

    setProcessing(selectedFile.id);
    setClassification(null);

    try {
      // Download the file directly from OneDrive as blob
      const blob = await oneDriveService.downloadFileAsBlob(selectedFile.id);

      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });

      // Classify with AI
      const result = await classifyDocument(base64, {
        customerName: selectedCustomerId
          ? customers.find(c => c.id === selectedCustomerId)?.name
          : undefined,
      });

      setClassification(result);

      // Auto-select customer if we can match by name or context
      if (!selectedCustomerId && result.extractedInfo?.customerName) {
        const matchedCustomer = customers.find(c =>
          c.name.toLowerCase().includes(result.extractedInfo.customerName.toLowerCase())
        );
        if (matchedCustomer) {
          setSelectedCustomerId(matchedCustomer.id);
        }
      }
    } catch (err) {
      console.error('Classification failed:', err);
      setClassification({ error: err.message });
    } finally {
      setProcessing(null);
    }
  };

  // Process and move file to customer folder
  const handleProcess = async () => {
    if (!selectedFile || !selectedCustomerId || !classification) return;

    const customer = customers.find(c => c.id === selectedCustomerId);
    if (!customer || !customer.driveFolderId) {
      setProcessResult({ error: 'Customer does not have a OneDrive folder' });
      return;
    }

    setProcessing(selectedFile.id);

    try {
      // Determine target folder
      const folderName = classification.folder || 'Other';
      let targetFolderId = customer.driveFolderId;

      // Create/get subfolder
      if (folderName && folderName !== 'Other') {
        try {
          targetFolderId = await oneDriveService.getOrCreateFolder(folderName, customer.driveFolderId);
        } catch (e) {
          console.warn('Could not create subfolder:', e);
        }
      }

      // Move the file
      await oneDriveService.moveFile(selectedFile.id, targetFolderId);

      // Update customer checklist
      const checklistMatch = findMatchingChecklistItem(classification);
      if (checklistMatch) {
        addDocumentFile(customer.id, checklistMatch.milestoneId, checklistMatch.documentId, {
          fileId: selectedFile.id,
          fileName: selectedFile.name,
          classification: classification,
        });
        saveToLocalStorage();
        saveCustomerToFolder(customer, true);
      }

      setProcessResult({
        success: true,
        message: `${classification.documentTypeName || 'Document'} moved to ${customer.name}/${folderName}`,
        checklistUpdated: !!checklistMatch,
      });

      // Remove from list
      setFiles(prev => prev.filter(f => f.id !== selectedFile.id));

      // Clear selection after short delay
      setTimeout(() => {
        setSelectedFile(null);
        setPreviewUrl(null);
        setClassification(null);
        setProcessResult(null);
      }, 2000);

      if (onProcessComplete) {
        onProcessComplete();
      }
    } catch (err) {
      console.error('Failed to process file:', err);
      setProcessResult({ error: err.message || 'Failed to move file' });
    } finally {
      setProcessing(null);
    }
  };

  // Delete file from scanned docs
  const handleDelete = async (file) => {
    if (!confirm(`Delete "${file.name}"?`)) return;

    try {
      await oneDriveService.deleteFile(file.id);
      setFiles(prev => prev.filter(f => f.id !== file.id));
      if (selectedFile?.id === file.id) {
        setSelectedFile(null);
        setPreviewUrl(null);
      }
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  // Update folder path
  const handleFolderPathChange = (newPath) => {
    setFolderPath(newPath);
    setScannedDocsFolderId(null); // Reset folder ID to re-resolve
    saveFolderSettings(newPath, null);
  };

  if (!isOpen) return null;

  return (
    <div className="scanned-docs-overlay" onClick={onClose}>
      <div className="scanned-docs-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sdp-header">
          <div className="sdp-header-left">
            <FolderOpen size={24} />
            <div>
              <h2>Process Scanned Documents</h2>
              <p className="sdp-folder-path">{folderPath}</p>
            </div>
          </div>
          <div className="sdp-header-actions">
            <button
              className="sdp-btn icon"
              onClick={() => setShowSettings(!showSettings)}
              title="Settings"
            >
              <Settings size={18} />
            </button>
            <button className="sdp-btn icon" onClick={loadFiles} title="Refresh">
              <RefreshCw size={18} />
            </button>
            <button className="sdp-btn icon" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="sdp-settings">
            <label>
              <span>Scanned Docs Folder Path:</span>
              <input
                type="text"
                value={folderPath}
                onChange={(e) => handleFolderPathChange(e.target.value)}
                placeholder="BYD CRM/Scanned Docs"
              />
            </label>
            <p className="sdp-settings-hint">
              This should match where Genius Scan saves files in OneDrive
            </p>
          </div>
        )}

        {/* Content */}
        <div className="sdp-content">
          {/* File List */}
          <div className="sdp-file-list">
            <h3>
              Pending Documents
              {files.length > 0 && <span className="sdp-count">{files.length}</span>}
            </h3>

            {loading && (
              <div className="sdp-loading">
                <Loader className="spin" size={24} />
                <span>Loading files...</span>
              </div>
            )}

            {error && !loading && (
              <div className="sdp-error">
                <p>{error}</p>
                <button className="sdp-btn" onClick={loadFiles}>
                  Try Again
                </button>
              </div>
            )}

            {!loading && files.length > 0 && (
              <div className="sdp-files">
                {files.map(file => (
                  <div
                    key={file.id}
                    className={`sdp-file-item ${selectedFile?.id === file.id ? 'selected' : ''}`}
                    onClick={() => handlePreview(file)}
                  >
                    <FileText size={18} />
                    <div className="sdp-file-info">
                      <span className="sdp-file-name">{file.name}</span>
                      <span className="sdp-file-date">
                        {new Date(file.lastModifiedDateTime).toLocaleString()}
                      </span>
                    </div>
                    <button
                      className="sdp-btn icon small danger"
                      onClick={(e) => { e.stopPropagation(); handleDelete(file); }}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Processing Panel */}
          <div className="sdp-process-panel">
            {!selectedFile ? (
              <div className="sdp-empty">
                <Eye size={48} />
                <p>Select a document to preview and process</p>
              </div>
            ) : (
              <>
                {/* Preview */}
                <div className="sdp-preview">
                  {previewUrl ? (
                    selectedFile.name.toLowerCase().endsWith('.pdf') ? (
                      <iframe src={previewUrl} title="Document Preview" />
                    ) : (
                      <img src={previewUrl} alt="Document Preview" />
                    )
                  ) : (
                    <div className="sdp-preview-loading">
                      <Loader className="spin" size={24} />
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="sdp-actions">
                  {/* Step 1: Classify */}
                  <div className="sdp-step">
                    <h4>
                      <span className="sdp-step-num">1</span>
                      AI Classification
                    </h4>
                    {!classification ? (
                      <button
                        className="sdp-btn primary"
                        onClick={handleClassify}
                        disabled={processing || !isGeminiAvailable()}
                      >
                        {processing === selectedFile?.id ? (
                          <>
                            <Loader className="spin" size={16} />
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <Sparkles size={16} />
                            Classify with AI
                          </>
                        )}
                      </button>
                    ) : classification.error ? (
                      <div className="sdp-classification error">
                        <X size={16} />
                        <span>{classification.error}</span>
                      </div>
                    ) : (
                      <div className="sdp-classification success">
                        <Check size={16} />
                        <div>
                          <strong>{classification.documentTypeName}</strong>
                          <span>→ {classification.folder}</span>
                          <span className="sdp-confidence">
                            {classification.confidence}% confident
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Step 2: Select Customer */}
                  <div className="sdp-step">
                    <h4>
                      <span className="sdp-step-num">2</span>
                      Select Customer
                    </h4>
                    <select
                      value={selectedCustomerId || ''}
                      onChange={(e) => setSelectedCustomerId(e.target.value ? parseInt(e.target.value) : null)}
                      className="sdp-customer-select"
                    >
                      <option value="">-- Select Customer --</option>
                      {customers
                        .filter(c => !c.archiveStatus && c.driveFolderId)
                        .map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))
                      }
                    </select>
                  </div>

                  {/* Step 3: Process */}
                  <div className="sdp-step">
                    <h4>
                      <span className="sdp-step-num">3</span>
                      Move to Customer Folder
                    </h4>
                    <button
                      className="sdp-btn success"
                      onClick={handleProcess}
                      disabled={!classification || !selectedCustomerId || processing}
                    >
                      {processing ? (
                        <>
                          <Loader className="spin" size={16} />
                          Processing...
                        </>
                      ) : (
                        <>
                          <FolderInput size={16} />
                          Move & Update Checklist
                        </>
                      )}
                    </button>

                    {processResult && (
                      <div className={`sdp-result ${processResult.success ? 'success' : 'error'}`}>
                        {processResult.success ? <Check size={16} /> : <X size={16} />}
                        <span>{processResult.message || processResult.error}</span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ScannedDocsProcessor;
