import { useState, useEffect } from 'react';
import useFormsStore from '../../stores/useFormsStore';
import useAuthStore from '../../stores/useAuthStore';
import authService from '../../services/authService';
import Modal from '../Modal/Modal';
import FieldMappingModal from '../FieldMappingModal/FieldMappingModal';
import './FormsManagement.css';

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

function FormsManagement() {
  const {
    formTemplates,
    loadFromLocalStorage,
    addTemplate,
    deleteTemplate,
    updateFieldMappings,
  } = useFormsStore();

  const { isSignedIn } = useAuthStore();

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedFormType, setSelectedFormType] = useState('test_drive');

  const [showFieldMappingModal, setShowFieldMappingModal] = useState(false);
  const [currentMappingFormType, setCurrentMappingFormType] = useState(null);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importConfig, setImportConfig] = useState(null);
  const [importMasterFile, setImportMasterFile] = useState(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    loadFromLocalStorage();
  }, [loadFromLocalStorage]);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const isPDF = file.type.includes('pdf');
      const isImage = file.type.includes('image');

      if (!isPDF && !isImage) {
        alert('Please select a PDF or image file (JPEG, PNG, etc.)');
        e.target.value = '';
        return;
      }

      setSelectedFile(file);
    }
  };

  const uploadFormTemplate = async () => {
    if (!selectedFile) {
      alert('Please select a file to upload');
      return;
    }

    if (!isSignedIn) {
      alert('Please sign in to Google Drive to upload forms');
      return;
    }

    setUploading(true);

    try {
      const isPDF = selectedFile.type.includes('pdf');
      const isImage = selectedFile.type.includes('image');

      // Get or create forms folder
      const formsFolderId = await getOrCreateFormsFolder();
      if (!formsFolderId) {
        alert('Failed to create forms folder. Please try again.');
        setUploading(false);
        return;
      }

      // Upload file to Google Drive
      const metadata = {
        name: selectedFile.name,
        mimeType: selectedFile.type,
        parents: [formsFolderId],
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', selectedFile);

      const token = authService.getAccessToken();
      const response = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: form,
        }
      );

      if (!response.ok) {
        throw new Error('Upload failed: ' + response.statusText);
      }

      const result = await response.json();

      // Store form template info
      const templateData = {
        fileId: result.id,
        fileName: result.name,
        webViewLink: result.webViewLink,
        webContentLink: result.webContentLink,
        fileType: isPDF ? 'pdf' : 'image',
        uploadDate: new Date().toISOString(),
        fieldMappings: isImage ? {} : undefined,
      };

      addTemplate(selectedFormType, templateData);

      alert('Form template uploaded successfully!');
      setShowUploadModal(false);
      setSelectedFile(null);
      setSelectedFormType('test_drive');
    } catch (error) {
      console.error('Error uploading form:', error);
      alert('Failed to upload form: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const getOrCreateFormsFolder = async () => {
    try {
      // Check if forms folder ID is stored
      let formsFolderId = localStorage.getItem('formsFolderId');

      if (formsFolderId) {
        // Verify folder still exists
        try {
          await window.gapi.client.drive.files.get({ fileId: formsFolderId });
          return formsFolderId;
        } catch {
          // Folder doesn't exist, create new one
          formsFolderId = null;
        }
      }

      // Create new forms folder
      const metadata = {
        name: 'BYD CRM - Form Templates',
        mimeType: 'application/vnd.google-apps.folder',
      };

      const response = await window.gapi.client.drive.files.create({
        resource: metadata,
        fields: 'id',
      });

      formsFolderId = response.result.id;
      localStorage.setItem('formsFolderId', formsFolderId);
      console.log('Created forms folder:', formsFolderId);

      return formsFolderId;
    } catch (error) {
      console.error('Error getting/creating forms folder:', error);
      return null;
    }
  };

  const handleViewForm = (formType) => {
    const template = formTemplates[formType];
    if (!template) {
      alert('Form not found');
      return;
    }

    if (template.webViewLink) {
      window.open(template.webViewLink, '_blank');
    } else {
      alert('Form link not available. Please re-upload this form.');
    }
  };

  const handleDeleteForm = async (formType) => {
    if (!window.confirm('Are you sure you want to delete this form template?')) {
      return;
    }

    const template = formTemplates[formType];
    if (!template) {
      return;
    }

    try {
      // Delete from Google Drive
      if (isSignedIn && template.fileId) {
        await window.gapi.client.drive.files.delete({
          fileId: template.fileId,
        });
      }

      deleteTemplate(formType);
      alert('Form template deleted successfully');
    } catch (error) {
      console.error('Error deleting form:', error);
      alert('Failed to delete form: ' + error.message);
    }
  };

  const openFieldMapping = (formType) => {
    const template = formTemplates[formType];
    if (!template || template.fileType !== 'image') {
      alert('This form does not support field mapping');
      return;
    }

    setCurrentMappingFormType(formType);
    setShowFieldMappingModal(true);
  };

  const closeFieldMapping = () => {
    setShowFieldMappingModal(false);
    setCurrentMappingFormType(null);
  };

  const saveFieldMappings = (formType, mappings) => {
    updateFieldMappings(formType, mappings);
    alert('Field mappings saved successfully!');
  };

  // Export template configuration
  const handleExportTemplate = (formType) => {
    const template = formTemplates[formType];
    if (!template) {
      alert('Template not found');
      return;
    }

    const exportData = {
      formType,
      formTypeName: FORM_TYPE_NAMES[formType] || formType,
      fileName: template.fileName,
      fileType: template.fileType,
      fieldMappings: template.fieldMappings || {},
      exportDate: new Date().toISOString(),
      version: '1.0',
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${formType}_template_config.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    alert('Template configuration exported! Share this file with other users.');
  };

  // Handle import file selection
  const handleImportFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/json') {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const config = JSON.parse(event.target.result);
          setImportConfig(config);
        } catch (error) {
          alert('Invalid template configuration file');
          e.target.value = '';
        }
      };
      reader.readAsText(file);
      setImportFile(file);
    } else {
      alert('Please select a valid JSON template configuration file');
      e.target.value = '';
    }
  };

  // Import template
  const handleImportTemplate = async () => {
    if (!importConfig || !importMasterFile) {
      alert('Please select both configuration and master files');
      return;
    }

    if (!isSignedIn) {
      alert('Please sign in to Google Drive to import templates');
      return;
    }

    setImporting(true);

    try {
      // Check if form type already exists
      if (formTemplates[importConfig.formType]) {
        if (!window.confirm(`A template for "${importConfig.formTypeName}" already exists. Do you want to replace it?`)) {
          setImporting(false);
          return;
        }
      }

      // Get or create forms folder
      const formsFolderId = await getOrCreateFormsFolder();
      if (!formsFolderId) {
        alert('Failed to create forms folder. Please try again.');
        setImporting(false);
        return;
      }

      // Upload master file to Google Drive
      const metadata = {
        name: importMasterFile.name,
        mimeType: importMasterFile.type,
        parents: [formsFolderId],
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', importMasterFile);

      const token = authService.getAccessToken();
      const response = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: form,
        }
      );

      if (!response.ok) {
        throw new Error('Upload failed: ' + response.statusText);
      }

      const result = await response.json();

      // Store form template info with imported field mappings
      const templateData = {
        fileId: result.id,
        fileName: result.name,
        webViewLink: result.webViewLink,
        webContentLink: result.webContentLink,
        fileType: importConfig.fileType,
        uploadDate: new Date().toISOString(),
        fieldMappings: importConfig.fieldMappings || {},
      };

      addTemplate(importConfig.formType, templateData);

      alert('Template imported successfully!');
      setShowImportModal(false);
      setImportFile(null);
      setImportConfig(null);
      setImportMasterFile(null);
    } catch (error) {
      console.error('Error importing template:', error);
      alert('Failed to import template: ' + error.message);
    } finally {
      setImporting(false);
    }
  };

  const templatesArray = Object.entries(formTemplates);

  return (
    <div className="forms-management">
      <div className="forms-header">
        <h2>Forms Management</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn btn-primary"
            onClick={() => setShowUploadModal(true)}
            disabled={!isSignedIn}
          >
            📄 Upload Form Template
          </button>
          <button
            className="btn btn-success"
            onClick={() => setShowImportModal(true)}
            disabled={!isSignedIn}
          >
            📥 Import Template
          </button>
        </div>
      </div>

      {!isSignedIn && (
        <div className="warning-banner">
          ⚠️ Please sign in to Google Drive to upload and manage form templates
        </div>
      )}

      <div className="forms-list">
        {templatesArray.length === 0 ? (
          <div className="empty-state">
            <p>No forms uploaded yet</p>
            <p className="empty-state-hint">
              Upload PDF or image form templates to use with customer data
            </p>
          </div>
        ) : (
          templatesArray.map(([formType, template]) => {
            const formName = FORM_TYPE_NAMES[formType] || formType;
            const uploadDate = new Date(template.uploadDate).toLocaleDateString();
            const hasFieldMapping = template.fileType === 'image';
            const fieldCount = template.fieldMappings
              ? Object.keys(template.fieldMappings).length
              : 0;

            return (
              <div key={formType} className="form-item">
                <div className="form-info">
                  <div className="form-icon">📄</div>
                  <div className="form-details">
                    <h4>{formName}</h4>
                    <p>
                      {template.fileName} • Uploaded: {uploadDate}
                    </p>
                    {hasFieldMapping && (
                      <p className="field-mapping-info">
                        ✓ {fieldCount} field(s) mapped
                      </p>
                    )}
                  </div>
                </div>
                <div className="form-actions">
                  {hasFieldMapping && (
                    <button
                      className="btn btn-small btn-success"
                      onClick={() => openFieldMapping(formType)}
                      style={{ background: '#00bcd4' }}
                    >
                      ⚙️ Configure Fields
                    </button>
                  )}
                  <button
                    className="btn btn-small btn-success"
                    onClick={() => handleExportTemplate(formType)}
                  >
                    📤 Export
                  </button>
                  <button
                    className="btn btn-small btn-primary"
                    onClick={() => handleViewForm(formType)}
                  >
                    View
                  </button>
                  <button
                    className="btn btn-small btn-danger"
                    onClick={() => handleDeleteForm(formType)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Modal
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          setSelectedFile(null);
        }}
        title="Upload Form Template"
      >
        <div className="upload-form">
          <div className="form-group">
            <label htmlFor="formType">Form Type</label>
            <select
              id="formType"
              value={selectedFormType}
              onChange={(e) => setSelectedFormType(e.target.value)}
            >
              {Object.entries(FORM_TYPE_NAMES).map(([type, name]) => (
                <option key={type} value={type}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="formFile">Select File (PDF or Image)</label>
            <input
              type="file"
              id="formFile"
              accept=".pdf,image/*"
              onChange={handleFileSelect}
            />
            {selectedFile && (
              <p className="file-selected">Selected: {selectedFile.name}</p>
            )}
          </div>

          <div className="modal-actions">
            <button
              className="btn btn-secondary"
              onClick={() => {
                setShowUploadModal(false);
                setSelectedFile(null);
              }}
              disabled={uploading}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={uploadFormTemplate}
              disabled={!selectedFile || uploading}
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Import Template Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => {
          setShowImportModal(false);
          setImportFile(null);
          setImportConfig(null);
          setImportMasterFile(null);
        }}
        title="Import Form Template"
      >
        <div className="upload-form">
          <div className="info-banner" style={{ marginBottom: '15px', padding: '10px', background: '#e3f2fd', borderRadius: '4px' }}>
            <p style={{ margin: 0, fontSize: '14px' }}>
              📋 Import a template shared by another user. You'll need both the configuration file (.json) and the master form file (PDF/image).
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="configFile">1. Configuration File (.json)</label>
            <input
              type="file"
              id="configFile"
              accept=".json"
              onChange={handleImportFileSelect}
              disabled={importing}
            />
            {importConfig && (
              <p className="file-selected">
                ✓ Config loaded: {importConfig.formTypeName}
                <br />
                <small>File type: {importConfig.fileType.toUpperCase()} • {Object.keys(importConfig.fieldMappings || {}).length} field(s) mapped</small>
              </p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="masterFile">2. Master Form File (PDF or Image)</label>
            <input
              type="file"
              id="masterFile"
              accept=".pdf,image/*"
              onChange={(e) => setImportMasterFile(e.target.files[0])}
              disabled={importing || !importConfig}
            />
            {importMasterFile && (
              <p className="file-selected">✓ Selected: {importMasterFile.name}</p>
            )}
            {importConfig && !importMasterFile && (
              <p className="file-hint">
                Please upload a {importConfig.fileType === 'pdf' ? 'PDF' : 'image'} file that matches the exported template
              </p>
            )}
          </div>

          <div className="modal-actions">
            <button
              className="btn btn-secondary"
              onClick={() => {
                setShowImportModal(false);
                setImportFile(null);
                setImportConfig(null);
                setImportMasterFile(null);
              }}
              disabled={importing}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleImportTemplate}
              disabled={!importConfig || !importMasterFile || importing}
            >
              {importing ? 'Importing...' : 'Import Template'}
            </button>
          </div>
        </div>
      </Modal>

      <FieldMappingModal
        isOpen={showFieldMappingModal}
        onClose={closeFieldMapping}
        formType={currentMappingFormType}
        template={currentMappingFormType ? formTemplates[currentMappingFormType] : null}
        onSave={saveFieldMappings}
      />
    </div>
  );
}

export default FormsManagement;
