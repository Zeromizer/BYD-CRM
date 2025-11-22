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

  const templatesArray = Object.entries(formTemplates);

  return (
    <div className="forms-management">
      <div className="forms-header">
        <h2>Forms Management</h2>
        <button
          className="btn btn-primary"
          onClick={() => setShowUploadModal(true)}
          disabled={!isSignedIn}
        >
          📄 Upload Form Template
        </button>
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
