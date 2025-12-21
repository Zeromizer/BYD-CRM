import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import useDocumentStore from '../../../stores/useDocumentStore';
import useAuthStore from '../../../stores/useAuthStore';
import { getStorageService } from '../../../services/storageServiceSelector';
import FormEditor from '../FormEditor/FormEditor';
import Modal from '../../Modal/Modal';
import './DocumentManager.css';

/**
 * DocumentManager - Main UI for managing document templates
 *
 * Features:
 * - Upload new document templates
 * - View and manage existing templates
 * - Configure field mappings
 * - Delete templates
 * - Sync with OneDrive
 */
function DocumentManager() {
  const {
    templates,
    loading,
    error,
    loadFromLocalStorage,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    clearError,
  } = useDocumentStore();

  const { isSignedIn, isInitialized, canLoadData } = useAuthStore();

  const [uploadingFile, setUploadingFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showUploadMasterModal, setShowUploadMasterModal] = useState(false);
  const [currentTemplateId, setCurrentTemplateId] = useState(null);
  const [masterFileToUpload, setMasterFileToUpload] = useState(null);
  const [uploadingMaster, setUploadingMaster] = useState(false);

  useEffect(() => {
    // Wait for auth to initialize and verify user before loading data
    if (!isInitialized) {
      return;
    }

    if (canLoadData()) {
      loadFromLocalStorage();
    }
  }, [isInitialized, loadFromLocalStorage, canLoadData]);

  // Memoize templates array conversion
  const templatesArray = useMemo(() => Object.values(templates), [templates]);

  // Memoize filtered and sorted templates to avoid recalculation on every render
  const filteredTemplates = useMemo(() => {
    return templatesArray
      .filter((t) => {
        // Search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const name = t.name || '';
          const category = t.category || '';
          return (
            name.toLowerCase().includes(query) ||
            category.toLowerCase().includes(query)
          );
        }
        return true;
      })
      .filter((t) => {
        // Category filter
        if (filterCategory === 'all') return true;
        return t.category === filterCategory;
      })
      .sort((a, b) => {
        const dateA = new Date(a.updatedAt);
        const dateB = new Date(b.updatedAt);
        // Handle invalid dates by treating them as oldest
        const timeA = isNaN(dateA.getTime()) ? 0 : dateA.getTime();
        const timeB = isNaN(dateB.getTime()) ? 0 : dateB.getTime();
        return timeB - timeA;
      });
  }, [templatesArray, searchQuery, filterCategory]);

  // Memoize categories to avoid recalculation on every render
  const categories = useMemo(
    () => ['all', ...new Set(templatesArray.map((t) => t.category).filter(Boolean))],
    [templatesArray]
  );

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      alert('Please select an image file (JPEG, PNG) or PDF');
      return;
    }

    setUploadingFile(file);
  };

  // Handle file upload
  const handleUpload = async (name, category) => {
    if (!uploadingFile) return;
    if (!isSignedIn) {
      alert('Please sign in to cloud storage first');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Upload file to cloud storage (use the correct folder inside BYD CRM root)
      const folderId = await getStorageService().getOrCreateDocumentTemplatesFolder();

      // Generate unique filename
      const timestamp = Date.now();
      const filename = `${name.replace(/[^a-z0-9]/gi, '_')}_${timestamp}.${
        uploadingFile.name.split('.').pop()
      }`;

      setUploadProgress(30);

      // Use uploadFileToFolder for OneDrive compatibility
      const fileId = await getStorageService().uploadFileToFolder(
        filename,
        uploadingFile,
        folderId
      );

      setUploadProgress(70);

      // Create template in store
      await createTemplate({
        name,
        category,
        fileId,
        fileName: filename,
        dpi: 300, // Default DPI
      });

      setUploadProgress(100);

      alert('Template uploaded successfully!');
      setUploadingFile(null);
      setUploading(false);
    } catch (err) {
      console.error('Error uploading template:', err);
      alert('Failed to upload template: ' + err.message);
      setUploading(false);
    }
  };

  // Handle edit fields
  const handleEditFields = (template) => {
    setEditingTemplate(template);
    setEditorOpen(true);
  };

  // Handle save fields
  const handleSaveFields = (templateId, fields) => {
    updateTemplate(templateId, { fields });
    setEditorOpen(false);
    setEditingTemplate(null);
  };

  // Handle delete template
  const handleDelete = async (template) => {
    const templateName = template.name || 'Unnamed Template';
    if (!window.confirm(`Delete template "${templateName}"?`)) return;

    try {
      // Ensure we have a valid template ID
      if (!template.id) {
        alert('Cannot delete: Template has no ID');
        return;
      }
      await deleteTemplate(template.id);
      alert('Template deleted successfully');
    } catch (err) {
      alert('Failed to delete template: ' + err.message);
    }
  };

  // Handle change master file button click
  const handleChangeMasterFile = (template) => {
    setCurrentTemplateId(template.id);
    setShowUploadMasterModal(true);
  };

  // Handle upload master file
  const handleUploadMaster = async () => {
    if (!masterFileToUpload) {
      alert('Please select a file to upload');
      return;
    }

    if (!isSignedIn) {
      alert('Please sign in to cloud storage first');
      return;
    }

    setUploadingMaster(true);

    try {
      const template = templates[currentTemplateId];
      // Use the correct folder inside BYD CRM root
      const folderId = await getStorageService().getOrCreateDocumentTemplatesFolder();

      // Delete old file if exists (using OneDrive-compatible method)
      if (template.fileId) {
        try {
          await getStorageService().deleteFileById(template.fileId);
        } catch (error) {
          console.error('Error deleting old file:', error);
          // Continue with upload even if delete fails
        }
      }

      // Generate unique filename
      const timestamp = Date.now();
      const filename = `${template.name.replace(/[^a-z0-9]/gi, '_')}_${timestamp}.${
        masterFileToUpload.name.split('.').pop()
      }`;

      // Upload new file using OneDrive-compatible method
      const fileId = await getStorageService().uploadFileToFolder(
        filename,
        masterFileToUpload,
        folderId
      );

      // Update template with new file info
      updateTemplate(currentTemplateId, {
        fileId,
        fileName: filename,
      });

      alert(`Master file uploaded successfully!\n\n✓ ${masterFileToUpload.name}\n\nThe template is now using the new master file.`);
      setShowUploadMasterModal(false);
      setCurrentTemplateId(null);
      setMasterFileToUpload(null);
    } catch (error) {
      console.error('Error uploading master file:', error);
      alert('Error uploading file to cloud storage: ' + error.message);
    } finally {
      setUploadingMaster(false);
    }
  };

  return (
    <div className="document-manager">
      <div className="document-manager-header">
        <div>
          <h1>Document Manager</h1>
          <p>Manage your document templates and field configurations</p>
        </div>
      </div>

      {!isSignedIn && (
        <div className="warning-banner">
          ⚠️ Please sign in to cloud storage to upload and manage document templates
        </div>
      )}

      {error && (
        <div className="error-banner">
          ❌ {error}
          <button onClick={clearError} className="close-btn">
            ×
          </button>
        </div>
      )}

      {/* Upload Section */}
      <div className="document-section">
        <h2>Upload New Template</h2>
        <UploadForm
          uploadingFile={uploadingFile}
          uploading={uploading}
          uploadProgress={uploadProgress}
          isSignedIn={isSignedIn}
          onFileSelect={handleFileSelect}
          onUpload={handleUpload}
          onCancel={() => {
            setUploadingFile(null);
            setUploading(false);
          }}
        />
      </div>

      {/* Templates Section */}
      <div className="document-section">
        <div className="section-header">
          <h2>Document Templates ({filteredTemplates.length})</h2>
          <div className="section-filters">
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="category-filter"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading templates...</p>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="empty-state">
            <p>
              {searchQuery || filterCategory !== 'all'
                ? 'No templates match your filters'
                : 'No templates yet'}
            </p>
            <p className="empty-state-hint">Upload a document template to get started</p>
          </div>
        ) : (
          <div className="templates-grid">
            {filteredTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onEditFields={handleEditFields}
                onDelete={handleDelete}
                onChangeMasterFile={handleChangeMasterFile}
              />
            ))}
          </div>
        )}
      </div>

      {/* Form Editor Modal */}
      {editorOpen && editingTemplate && (
        <FormEditor
          isOpen={editorOpen}
          onClose={() => {
            setEditorOpen(false);
            setEditingTemplate(null);
          }}
          template={editingTemplate}
          onSave={handleSaveFields}
        />
      )}

      {/* Upload Master File Modal */}
      <Modal
        isOpen={showUploadMasterModal}
        onClose={() => {
          setShowUploadMasterModal(false);
          setCurrentTemplateId(null);
          setMasterFileToUpload(null);
        }}
        title="Change Master File"
      >
        <div className="upload-master-form">
          {currentTemplateId && templates[currentTemplateId] && (
            <div className="current-master-info">
              {templates[currentTemplateId].fileId ? (
                <div className="has-master">
                  <h4>Current Master File</h4>
                  <p>📄 {templates[currentTemplateId].fileName}</p>
                  <p className="hint">Uploading a new file will replace this one.</p>
                </div>
              ) : (
                <div className="no-master">
                  <p>⚠️ No master file found</p>
                  <p className="hint">
                    Upload a master file for this template.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="masterFileUpload">Select Document File</label>
            <input
              type="file"
              id="masterFileUpload"
              accept="image/*,application/pdf"
              onChange={(e) => setMasterFileToUpload(e.target.files[0])}
            />
            {masterFileToUpload && (
              <p className="file-selected">Selected: {masterFileToUpload.name}</p>
            )}
          </div>

          <div className="modal-actions">
            <button
              className="btn btn-secondary"
              onClick={() => {
                setShowUploadMasterModal(false);
                setCurrentTemplateId(null);
                setMasterFileToUpload(null);
              }}
              disabled={uploadingMaster}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleUploadMaster}
              disabled={!masterFileToUpload || uploadingMaster}
            >
              {uploadingMaster ? 'Uploading...' : 'Upload to Cloud Storage'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/**
 * UploadForm - Form for uploading new templates
 */
function UploadForm({
  uploadingFile,
  uploading,
  uploadProgress,
  isSignedIn,
  onFileSelect,
  onUpload,
  onCancel,
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('vehicle_forms');

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('Please enter a template name');
      return;
    }

    onUpload(name, category);
  };

  const handleCancel = () => {
    setName('');
    setCategory('vehicle_forms');
    onCancel();
  };

  return (
    <div className="upload-form">
      {!uploadingFile ? (
        <div className="upload-dropzone">
          <input
            type="file"
            id="document-upload"
            accept="image/*,application/pdf"
            onChange={onFileSelect}
            disabled={!isSignedIn}
            style={{ display: 'none' }}
          />
          <label htmlFor="document-upload" className="upload-label">
            <div className="upload-icon">📄</div>
            <p className="upload-text">Click to select a document template</p>
            <p className="upload-hint">Supported: JPEG, PNG, PDF</p>
          </label>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="upload-details-form">
          <div className="upload-file-info">
            <span className="file-icon">📄</span>
            <div className="file-details">
              <p className="file-name">{uploadingFile.name}</p>
              <p className="file-size">
                {(uploadingFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            {!uploading && (
              <button type="button" onClick={handleCancel} className="remove-file-btn">
                ×
              </button>
            )}
          </div>

          {uploading ? (
            <div className="upload-progress">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <p className="progress-text">Uploading... {uploadProgress}%</p>
            </div>
          ) : (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="template-name">Template Name *</label>
                  <input
                    type="text"
                    id="template-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Vehicle Sales Agreement"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="template-category">Category</label>
                  <select
                    id="template-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="vehicle_forms">Vehicle Forms</option>
                    <option value="sales_documents">Sales Documents</option>
                    <option value="delivery_checklist">Delivery Checklist</option>
                    <option value="consent_forms">Consent Forms</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="form-actions">
                <button type="button" onClick={handleCancel} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Upload Template
                </button>
              </div>
            </>
          )}
        </form>
      )}
    </div>
  );
}

/**
 * TemplateCard - Display card for a single template (memoized for performance)
 */
const TemplateCard = memo(function TemplateCard({ template, onEditFields, onDelete, onChangeMasterFile }) {
  const fieldCount = Object.keys(template.fields || {}).length;
  const hasFields = fieldCount > 0;
  const hasMasterFile = !!template.fileId;

  // Handle missing or invalid data gracefully
  const templateName = template.name || 'Unnamed Template';
  const templateCategory = template.category || 'uncategorized';

  // Format date safely
  const formatDate = (dateStr) => {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div className="template-card">
      <div className="template-card-header">
        <h3>{templateName}</h3>
        <span className="category-badge">{templateCategory}</span>
      </div>

      <div className="template-card-body">
        <div className="template-info">
          <div className="info-row">
            <span className="info-label">Master File:</span>
            <span className={`info-value ${hasMasterFile ? 'has-fields' : 'no-fields'}`}>
              {hasMasterFile ? '✓ Uploaded' : '✗ Missing'}
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">Fields Configured:</span>
            <span className={`info-value ${hasFields ? 'has-fields' : 'no-fields'}`}>
              {fieldCount} {fieldCount === 1 ? 'field' : 'fields'}
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">Last Updated:</span>
            <span className="info-value">
              {formatDate(template.updatedAt)}
            </span>
          </div>
        </div>
      </div>

      <div className="template-card-footer">
        <button
          className="btn btn-primary btn-small"
          onClick={() => onEditFields(template)}
        >
          {hasFields ? 'Edit Fields' : 'Configure Fields'}
        </button>
        <button
          className="btn btn-secondary btn-small"
          onClick={() => onChangeMasterFile(template)}
        >
          {hasMasterFile ? 'Change File' : 'Add File'}
        </button>
        <button
          className="btn btn-danger btn-small"
          onClick={() => onDelete(template)}
        >
          Delete
        </button>
      </div>
    </div>
  );
});

export default DocumentManager;
