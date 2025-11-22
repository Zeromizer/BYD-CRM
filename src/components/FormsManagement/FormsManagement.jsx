import { useState, useEffect } from 'react';
import useFormsStore from '../../stores/useFormsStore';
import useAuthStore from '../../stores/useAuthStore';
import authService from '../../services/authService';
import Modal from '../Modal/Modal';
import FieldMappingModal from '../FieldMappingModal/FieldMappingModal';
import JSZip from 'jszip';
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

  // Export all templates as a zip file
  const handleExportAllTemplates = async () => {
    const templatesArray = Object.entries(formTemplates);

    if (templatesArray.length === 0) {
      alert('No templates to export');
      return;
    }

    try {
      const zip = new JSZip();

      // Add each template configuration to the zip
      templatesArray.forEach(([formType, template]) => {
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
        zip.file(`${formType}_template_config.json`, dataStr);
      });

      // Generate the zip file
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `form_templates_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      alert(`Successfully exported ${templatesArray.length} template(s) to a zip file!`);
    } catch (error) {
      console.error('Error exporting templates:', error);
      alert('Failed to export templates: ' + error.message);
    }
  };

  // Handle import file selection (supports multiple JSON files or a zip file)
  const handleImportFileSelect = async (e) => {
    const files = Array.from(e.target.files);

    if (files.length === 0) return;

    try {
      // Check if it's a zip file
      if (files.length === 1 && files[0].name.endsWith('.zip')) {
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(files[0]);
        const configs = [];

        // Extract all JSON files from the zip
        const jsonFiles = Object.keys(zipContent.files).filter(filename =>
          filename.endsWith('.json') && !zipContent.files[filename].dir
        );

        for (const filename of jsonFiles) {
          const content = await zipContent.files[filename].async('text');
          try {
            const config = JSON.parse(content);
            configs.push(config);
          } catch (error) {
            console.error(`Invalid JSON in ${filename}:`, error);
          }
        }

        if (configs.length === 0) {
          alert('No valid template configurations found in the zip file');
          e.target.value = '';
          return;
        }

        setImportConfig(configs);
        setImportFile(files[0]);
      } else {
        // Handle multiple JSON files
        const configs = [];

        for (const file of files) {
          if (file.type === 'application/json' || file.name.endsWith('.json')) {
            const text = await file.text();
            try {
              const config = JSON.parse(text);
              configs.push(config);
            } catch (error) {
              console.error(`Invalid JSON in ${file.name}:`, error);
            }
          }
        }

        if (configs.length === 0) {
          alert('No valid JSON template configuration files selected');
          e.target.value = '';
          return;
        }

        setImportConfig(configs);
        setImportFile(files[0]);
      }
    } catch (error) {
      console.error('Error reading files:', error);
      alert('Failed to read template files: ' + error.message);
      e.target.value = '';
    }
  };

  // Import template(s)
  const handleImportTemplate = async () => {
    const configs = Array.isArray(importConfig) ? importConfig : [importConfig];

    if (configs.length === 0) {
      alert('No configurations to import');
      return;
    }

    if (!isSignedIn) {
      alert('Please sign in to Google Drive to import templates');
      return;
    }

    // For single template import, require master file
    if (configs.length === 1 && !importMasterFile) {
      alert('Please select the master file for this template');
      return;
    }

    setImporting(true);

    try {
      const formsFolderId = await getOrCreateFormsFolder();
      if (!formsFolderId) {
        alert('Failed to create forms folder. Please try again.');
        setImporting(false);
        return;
      }

      let successCount = 0;
      let skipCount = 0;
      const errors = [];

      for (let i = 0; i < configs.length; i++) {
        const config = configs[i];

        try {
          // Check if form type already exists
          if (formTemplates[config.formType]) {
            if (configs.length === 1) {
              if (!window.confirm(`A template for "${config.formTypeName}" already exists. Do you want to replace it?`)) {
                skipCount++;
                continue;
              }
            } else {
              // For bulk import, skip existing templates
              console.log(`Skipping existing template: ${config.formTypeName}`);
              skipCount++;
              continue;
            }
          }

          // For single import, use the provided master file
          // For bulk import, we'll need to prompt for each file
          if (configs.length === 1 && importMasterFile) {
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
              fileType: config.fileType,
              uploadDate: new Date().toISOString(),
              fieldMappings: config.fieldMappings || {},
            };

            addTemplate(config.formType, templateData);
            successCount++;
          } else if (configs.length > 1) {
            // For bulk import without master files, just import the configuration
            // User will need to upload master files later
            const templateData = {
              fileId: null,
              fileName: config.fileName,
              webViewLink: null,
              webContentLink: null,
              fileType: config.fileType,
              uploadDate: new Date().toISOString(),
              fieldMappings: config.fieldMappings || {},
            };

            addTemplate(config.formType, templateData);
            successCount++;
          }
        } catch (error) {
          console.error(`Error importing ${config.formTypeName}:`, error);
          errors.push(`${config.formTypeName}: ${error.message}`);
        }
      }

      // Show summary
      let message = '';
      if (successCount > 0) {
        message += `Successfully imported ${successCount} template(s).\n`;
        if (configs.length > 1) {
          message += 'Note: You will need to upload the master files for each template separately.\n';
        }
      }
      if (skipCount > 0) {
        message += `Skipped ${skipCount} existing template(s).\n`;
      }
      if (errors.length > 0) {
        message += `Failed to import ${errors.length} template(s):\n${errors.join('\n')}`;
      }

      if (message) {
        alert(message);
      }

      if (successCount > 0) {
        setShowImportModal(false);
        setImportFile(null);
        setImportConfig(null);
        setImportMasterFile(null);
      }
    } catch (error) {
      console.error('Error importing templates:', error);
      alert('Failed to import templates: ' + error.message);
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
          {templatesArray.length > 0 && (
            <button
              className="btn btn-success"
              onClick={handleExportAllTemplates}
              style={{ background: '#9c27b0' }}
            >
              📦 Export All
            </button>
          )}
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
        title="Import Form Template(s)"
      >
        <div className="upload-form">
          <div className="info-banner" style={{ marginBottom: '15px', padding: '10px', background: '#e3f2fd', borderRadius: '4px' }}>
            <p style={{ margin: 0, fontSize: '14px' }}>
              📋 Import template(s) shared by another user. You can import:
              <br />• A single template (with configuration .json + master file)
              <br />• Multiple templates (select multiple .json files or a .zip file)
              <br />• For bulk import, you'll upload master files separately later
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="configFile">
              1. Configuration File(s) (.json or .zip)
            </label>
            <input
              type="file"
              id="configFile"
              accept=".json,.zip"
              onChange={handleImportFileSelect}
              disabled={importing}
              multiple
            />
            {importConfig && (
              <div className="file-selected">
                {Array.isArray(importConfig) ? (
                  <>
                    <p style={{ margin: '5px 0', fontWeight: 'bold' }}>
                      ✓ {importConfig.length} template(s) loaded:
                    </p>
                    <ul style={{ margin: '5px 0 5px 20px', fontSize: '13px' }}>
                      {importConfig.map((config, idx) => (
                        <li key={idx}>
                          {config.formTypeName} ({config.fileType.toUpperCase()}, {Object.keys(config.fieldMappings || {}).length} field(s))
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <>
                    <p style={{ margin: 0 }}>
                      ✓ Config loaded: {importConfig.formTypeName}
                    </p>
                    <small>File type: {importConfig.fileType.toUpperCase()} • {Object.keys(importConfig.fieldMappings || {}).length} field(s) mapped</small>
                  </>
                )}
              </div>
            )}
          </div>

          {importConfig && !Array.isArray(importConfig) && (
            <div className="form-group">
              <label htmlFor="masterFile">2. Master Form File (PDF or Image)</label>
              <input
                type="file"
                id="masterFile"
                accept=".pdf,image/*"
                onChange={(e) => setImportMasterFile(e.target.files[0])}
                disabled={importing}
              />
              {importMasterFile && (
                <p className="file-selected">✓ Selected: {importMasterFile.name}</p>
              )}
              {!importMasterFile && (
                <p className="file-hint">
                  Please upload a {importConfig.fileType === 'pdf' ? 'PDF' : 'image'} file that matches the exported template
                </p>
              )}
            </div>
          )}

          {importConfig && Array.isArray(importConfig) && (
            <div className="form-group">
              <div style={{ padding: '10px', background: '#fff3cd', borderRadius: '4px', marginTop: '10px' }}>
                <p style={{ margin: 0, fontSize: '13px' }}>
                  ⚠️ Bulk import will import the template configurations only.
                  <br />You'll need to upload the master files for each template separately after import.
                </p>
              </div>
            </div>
          )}

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
              disabled={!importConfig || importing || (!Array.isArray(importConfig) && !importMasterFile)}
            >
              {importing ? 'Importing...' : `Import ${Array.isArray(importConfig) ? importConfig.length + ' Template(s)' : 'Template'}`}
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
