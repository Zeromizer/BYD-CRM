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
  CheckSquare,
  Square,
  PlayCircle,
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
const AUTO_PROCESS_CONFIDENCE_THRESHOLD = 95;

// Generate a proper filename based on classification and customer
// Format: Name - Form - dd.mm.yyyy.ext
// Extracts page number from original filename if present
function generateFileName(classification, customerName, originalFileName) {
  const ext = originalFileName.split('.').pop().toLowerCase();
  const date = new Date().toLocaleDateString('en-GB').replace(/\//g, '.'); // dd.mm.yyyy

  // Use document type name, sanitize for filename
  const docType = (classification.documentTypeName || 'Document')
    .replace(/[<>:"/\\|?*]/g, '-')
    .trim();

  // Sanitize customer name
  const customer = (customerName || 'Unknown')
    .replace(/[<>:"/\\|?*]/g, '-')
    .trim();

  // Extract page number from original filename if present (e.g., "page_1", "page_2", "_1", "_2")
  const pageMatch = originalFileName.match(/[_-]?page[_-]?(\d+)|[_-](\d+)\.[^.]+$/i);
  const pageNum = pageMatch ? (pageMatch[1] || pageMatch[2]) : null;

  // Build filename with optional page number
  if (pageNum) {
    return `${customer} - ${docType} - ${date} (${pageNum}).${ext}`;
  }

  return `${customer} - ${docType} - ${date}.${ext}`;
}

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
  const [selectedFiles, setSelectedFiles] = useState([]); // Multi-select
  const [previewUrl, setPreviewUrl] = useState(null);
  const [classification, setClassification] = useState(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [processResult, setProcessResult] = useState(null);
  const [batchProgress, setBatchProgress] = useState(null); // { current, total, results }

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

      // Auto-select customer if we can match by extracted name
      let matchedCustomer = null;
      if (!selectedCustomerId && result.customerName) {
        const extractedName = result.customerName.toLowerCase().trim();
        // Try to find a matching customer
        matchedCustomer = customers.find(c => {
          const customerName = c.name.toLowerCase().trim();
          // Check if names match (partial match both ways)
          return customerName.includes(extractedName) ||
                 extractedName.includes(customerName) ||
                 // Also check individual words
                 extractedName.split(/\s+/).some(word =>
                   word.length > 2 && customerName.includes(word)
                 );
        });
        if (matchedCustomer) {
          setSelectedCustomerId(matchedCustomer.id);
          console.log('Auto-matched customer:', matchedCustomer.name, 'from extracted name:', result.customerName);
        }
      }

      // Auto-process if confidence >= threshold and customer is matched
      if (result.confidence >= AUTO_PROCESS_CONFIDENCE_THRESHOLD && matchedCustomer) {
        console.log(`Auto-processing: ${result.confidence}% confidence >= ${AUTO_PROCESS_CONFIDENCE_THRESHOLD}% threshold`);
        // Use setTimeout to allow state to update first
        setTimeout(() => {
          autoProcess(selectedFile, result, matchedCustomer);
        }, 100);
      }
    } catch (err) {
      console.error('Classification failed:', err);
      setClassification({ error: err.message });
    } finally {
      setProcessing(null);
    }
  };

  // Auto-process function for high confidence classifications
  const autoProcess = async (file, classificationResult, customer) => {
    if (!file || !customer || !classificationResult) return;

    setProcessing(file.id);
    setProcessResult({ success: true, message: 'Auto-processing...' });

    try {
      let customerFolderId = customer.driveFolderId;

      // Auto-create customer folder if it doesn't exist
      if (!customerFolderId) {
        console.log('Creating OneDrive folder for customer:', customer.name);
        const crmFolderId = await oneDriveService.getOrCreateFolder('BYD CRM', 'root');
        const customersFolderId = await oneDriveService.getOrCreateFolder('Customers', crmFolderId);
        const sanitizedName = customer.name.replace(/[<>:"/\\|?*]/g, '-').trim();
        customerFolderId = await oneDriveService.getOrCreateFolder(sanitizedName, customersFolderId);

        // Save folder ID to customer record
        const { updateCustomer, saveToLocalStorage: save, saveCustomerToFolder: saveFolder } = useCustomerStore.getState();
        updateCustomer(customer.id, { driveFolderId: customerFolderId });
        save();
        saveFolder({ ...customer, driveFolderId: customerFolderId }, true);
      }

      // Determine target subfolder
      const folderName = classificationResult.folder || 'Other';
      let targetFolderId = customerFolderId;

      if (folderName && folderName !== 'Other') {
        targetFolderId = await oneDriveService.getOrCreateFolder(folderName, customerFolderId);
      }

      // Generate new filename and rename
      const newFileName = generateFileName(classificationResult, customer.name, file.name);
      console.log('Auto-renaming file:', file.name, '→', newFileName);

      try {
        await oneDriveService.renameFile(file.id, newFileName);
      } catch (e) {
        console.warn('Could not rename file:', e);
      }

      // Move the file
      await oneDriveService.moveFile(file.id, targetFolderId);

      // Update customer checklist
      const checklistMatch = findMatchingChecklistItem(classificationResult);
      if (checklistMatch) {
        addDocumentFile(customer.id, checklistMatch.milestoneId, checklistMatch.documentId, {
          fileId: file.id,
          fileName: newFileName,
          classification: classificationResult,
        });
        saveToLocalStorage();
        saveCustomerToFolder({ ...customer, driveFolderId: customerFolderId }, true);
      }

      setProcessResult({
        success: true,
        message: `Auto-processed: "${newFileName}" → ${customer.name}/${folderName}`,
        checklistUpdated: !!checklistMatch,
      });

      // Remove from list
      setFiles(prev => prev.filter(f => f.id !== file.id));

      // Clear selection after delay
      setTimeout(() => {
        setSelectedFile(null);
        setPreviewUrl(null);
        setClassification(null);
        setProcessResult(null);
      }, 2500);

      if (onProcessComplete) onProcessComplete();

    } catch (err) {
      console.error('Auto-process failed:', err);
      setProcessResult({ error: 'Auto-process failed: ' + err.message });
    } finally {
      setProcessing(null);
    }
  };

  // Toggle file selection for multi-select
  const toggleFileSelection = (file, e) => {
    e.stopPropagation();
    setSelectedFiles(prev => {
      const isSelected = prev.some(f => f.id === file.id);
      if (isSelected) {
        return prev.filter(f => f.id !== file.id);
      } else {
        return [...prev, file];
      }
    });
  };

  // Select all files
  const selectAllFiles = () => {
    if (selectedFiles.length === files.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles([...files]);
    }
  };

  // Batch process all selected files
  const handleBatchProcess = async () => {
    if (selectedFiles.length === 0) return;

    const filesToProcess = [...selectedFiles];
    const results = [];
    setBatchProgress({ current: 0, total: filesToProcess.length, results: [] });

    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      setBatchProgress(prev => ({ ...prev, current: i + 1 }));
      setProcessing(file.id);

      try {
        // Download and classify
        const blob = await oneDriveService.downloadFileAsBlob(file.id);
        const base64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });

        const classificationResult = await classifyDocument(base64, {});

        // Try to match customer
        let matchedCustomer = null;
        if (classificationResult.customerName) {
          const extractedName = classificationResult.customerName.toLowerCase().trim();
          matchedCustomer = customers.find(c => {
            const customerName = c.name.toLowerCase().trim();
            return customerName.includes(extractedName) ||
                   extractedName.includes(customerName) ||
                   extractedName.split(/\s+/).some(word =>
                     word.length > 2 && customerName.includes(word)
                   );
          });
        }

        // Auto-process if confidence >= threshold and customer matched
        if (classificationResult.confidence >= AUTO_PROCESS_CONFIDENCE_THRESHOLD && matchedCustomer) {
          // Process the file
          let customerFolderId = matchedCustomer.driveFolderId;

          if (!customerFolderId) {
            const crmFolderId = await oneDriveService.getOrCreateFolder('BYD CRM', 'root');
            const customersFolderId = await oneDriveService.getOrCreateFolder('Customers', crmFolderId);
            const sanitizedName = matchedCustomer.name.replace(/[<>:"/\\|?*]/g, '-').trim();
            customerFolderId = await oneDriveService.getOrCreateFolder(sanitizedName, customersFolderId);

            const { updateCustomer, saveToLocalStorage: save, saveCustomerToFolder: saveFolder } = useCustomerStore.getState();
            updateCustomer(matchedCustomer.id, { driveFolderId: customerFolderId });
            save();
            saveFolder({ ...matchedCustomer, driveFolderId: customerFolderId }, true);
          }

          const folderName = classificationResult.folder || 'Other';
          let targetFolderId = customerFolderId;
          if (folderName && folderName !== 'Other') {
            targetFolderId = await oneDriveService.getOrCreateFolder(folderName, customerFolderId);
          }

          const newFileName = generateFileName(classificationResult, matchedCustomer.name, file.name);
          try {
            await oneDriveService.renameFile(file.id, newFileName);
          } catch (e) {
            console.warn('Could not rename:', e);
          }

          await oneDriveService.moveFile(file.id, targetFolderId);

          const checklistMatch = findMatchingChecklistItem(classificationResult);
          if (checklistMatch) {
            addDocumentFile(matchedCustomer.id, checklistMatch.milestoneId, checklistMatch.documentId, {
              fileId: file.id,
              fileName: newFileName,
              classification: classificationResult,
            });
            saveToLocalStorage();
            saveCustomerToFolder({ ...matchedCustomer, driveFolderId: customerFolderId }, true);
          }

          results.push({
            file,
            success: true,
            auto: true,
            message: `${newFileName} → ${matchedCustomer.name}/${folderName}`,
            classification: classificationResult,
            customer: matchedCustomer,
          });

          // Remove from files list
          setFiles(prev => prev.filter(f => f.id !== file.id));
        } else {
          // Needs manual review
          results.push({
            file,
            success: false,
            auto: false,
            message: `Needs review (${classificationResult.confidence}% confidence${matchedCustomer ? '' : ', no customer match'})`,
            classification: classificationResult,
            customer: matchedCustomer,
          });
        }
      } catch (err) {
        console.error('Batch process error for', file.name, err);
        results.push({
          file,
          success: false,
          error: err.message,
        });
      }

      setBatchProgress(prev => ({ ...prev, results: [...results] }));
    }

    setProcessing(null);
    setSelectedFiles([]);

    // Show summary
    const autoProcessed = results.filter(r => r.auto).length;
    const needsReview = results.filter(r => !r.auto && !r.error).length;
    const errors = results.filter(r => r.error).length;

    setProcessResult({
      success: true,
      message: `Batch complete: ${autoProcessed} auto-processed, ${needsReview} need review, ${errors} errors`,
      batchResults: results,
    });

    // Clear batch progress after delay
    setTimeout(() => {
      setBatchProgress(null);
    }, 3000);

    if (onProcessComplete) onProcessComplete();
  };

  // Process and move file to customer folder
  const handleProcess = async () => {
    if (!selectedFile || !selectedCustomerId || !classification) return;

    const customer = customers.find(c => c.id === selectedCustomerId);
    if (!customer) {
      setProcessResult({ error: 'Customer not found' });
      return;
    }

    setProcessing(selectedFile.id);

    try {
      let customerFolderId = customer.driveFolderId;

      // Auto-create customer folder if it doesn't exist
      if (!customerFolderId) {
        console.log('Creating OneDrive folder for customer:', customer.name);
        try {
          // Get or create BYD CRM/Customers root folder
          const crmFolderId = await oneDriveService.getOrCreateFolder('BYD CRM', 'root');
          const customersFolderId = await oneDriveService.getOrCreateFolder('Customers', crmFolderId);

          // Create customer folder with their name
          const sanitizedName = customer.name.replace(/[<>:"/\\|?*]/g, '-').trim();
          customerFolderId = await oneDriveService.getOrCreateFolder(sanitizedName, customersFolderId);

          // Save folder ID to customer record
          const { updateCustomer, saveToLocalStorage: save, saveCustomerToFolder: saveFolder } = useCustomerStore.getState();
          updateCustomer(customer.id, { driveFolderId: customerFolderId });
          save();
          saveFolder({ ...customer, driveFolderId: customerFolderId }, true);
          console.log('Created customer folder:', customerFolderId);
        } catch (e) {
          console.error('Failed to create customer folder:', e);
          setProcessResult({ error: 'Failed to create customer folder: ' + e.message });
          setProcessing(null);
          return;
        }
      }

      // Determine target subfolder
      const folderName = classification.folder || 'Other';
      let targetFolderId = customerFolderId;

      // Create/get subfolder for document type
      if (folderName && folderName !== 'Other') {
        try {
          targetFolderId = await oneDriveService.getOrCreateFolder(folderName, customerFolderId);
        } catch (e) {
          console.warn('Could not create subfolder:', e);
        }
      }

      // Generate new filename and rename
      const newFileName = generateFileName(classification, customer.name, selectedFile.name);
      console.log('Renaming file:', selectedFile.name, '→', newFileName);

      try {
        await oneDriveService.renameFile(selectedFile.id, newFileName);
      } catch (e) {
        console.warn('Could not rename file:', e);
        // Continue with move even if rename fails
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
        // Use updated customer with driveFolderId
        saveCustomerToFolder({ ...customer, driveFolderId: customerFolderId }, true);
      }

      const folderCreated = !customer.driveFolderId;
      setProcessResult({
        success: true,
        message: `Renamed to "${newFileName}" and moved to ${customer.name}/${folderName}${folderCreated ? ' (folder created)' : ''}`,
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
            <div className="sdp-file-list-header">
              <h3>
                Pending Documents
                {files.length > 0 && <span className="sdp-count">{files.length}</span>}
              </h3>
              {files.length > 0 && (
                <div className="sdp-batch-actions">
                  <button
                    className="sdp-btn small"
                    onClick={selectAllFiles}
                    title={selectedFiles.length === files.length ? 'Deselect All' : 'Select All'}
                  >
                    {selectedFiles.length === files.length ? (
                      <CheckSquare size={16} />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                  {selectedFiles.length > 0 && (
                    <button
                      className="sdp-btn primary small"
                      onClick={handleBatchProcess}
                      disabled={processing || !isGeminiAvailable()}
                      title={`Process ${selectedFiles.length} files`}
                    >
                      <PlayCircle size={16} />
                      {selectedFiles.length}
                    </button>
                  )}
                </div>
              )}
            </div>

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
                    className={`sdp-file-item ${selectedFile?.id === file.id ? 'selected' : ''} ${selectedFiles.some(f => f.id === file.id) ? 'checked' : ''} ${processing === file.id ? 'processing' : ''}`}
                    onClick={() => handlePreview(file)}
                  >
                    <button
                      className="sdp-checkbox"
                      onClick={(e) => toggleFileSelection(file, e)}
                    >
                      {selectedFiles.some(f => f.id === file.id) ? (
                        <CheckSquare size={18} />
                      ) : (
                        <Square size={18} />
                      )}
                    </button>
                    <div className="sdp-file-info">
                      <span className="sdp-file-name">{file.name}</span>
                      <span className="sdp-file-date">
                        {new Date(file.lastModifiedDateTime).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    {processing === file.id ? (
                      <Loader className="spin" size={14} />
                    ) : (
                      <button
                        className="sdp-btn icon small danger"
                        onClick={(e) => { e.stopPropagation(); handleDelete(file); }}
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Processing Panel */}
          <div className="sdp-process-panel">
            {batchProgress && (
              <div className="sdp-batch-progress">
                <div className="sdp-batch-header">
                  <Loader className="spin" size={20} />
                  <span>Processing {batchProgress.current} of {batchProgress.total} files...</span>
                </div>
                <div className="sdp-progress-bar">
                  <div
                    className="sdp-progress-fill"
                    style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                  />
                </div>
                {batchProgress.results.length > 0 && (
                  <div className="sdp-batch-results">
                    {batchProgress.results.slice(-3).map((r, i) => (
                      <div key={i} className={`sdp-batch-result ${r.auto ? 'success' : r.error ? 'error' : 'warning'}`}>
                        {r.auto ? <Check size={14} /> : r.error ? <X size={14} /> : <Eye size={14} />}
                        <span>{r.message || r.error}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {!selectedFile && !batchProgress ? (
              <div className="sdp-empty">
                <Eye size={48} />
                <p>Select a document to preview and process</p>
                {files.length > 0 && (
                  <p className="sdp-hint">Or select multiple files and click the play button to batch process</p>
                )}
              </div>
            ) : selectedFile && (
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
                          {classification.customerName && (
                            <span className="sdp-customer-name">
                              <User size={12} /> {classification.customerName}
                            </span>
                          )}
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
                        .filter(c => !c.archiveStatus)
                        .map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name}{!c.driveFolderId ? ' (new folder)' : ''}
                          </option>
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
