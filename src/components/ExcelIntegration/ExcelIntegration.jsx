import { useState, useEffect } from 'react';
import useExcelStore from '../../stores/useExcelStore';
import useAuthStore from '../../stores/useAuthStore';
import authService from '../../services/authService';
import Modal from '../Modal/Modal';
import './ExcelIntegration.css';

const FIELD_NAMES = {
  name: 'Customer Name',
  phone: 'Phone Number',
  email: 'Email',
  nric: 'NRIC/FIN',
  occupation: 'Occupation',
  dob: 'Date of Birth',
  address: 'Address',
  addressContinue: 'Address Continue',
  fullAddress: 'Full Address (Combined)',
  salesConsultant: 'Sales Consultant',
  vsaNo: 'VSA No',
  date: "Today's Date",
};

function ExcelIntegration() {
  const {
    excelTemplates,
    loadFromLocalStorage,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    updateFieldMappings,
  } = useExcelStore();

  const { isSignedIn } = useAuthStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [showUploadMasterModal, setShowUploadMasterModal] = useState(false);

  const [templateName, setTemplateName] = useState('');
  const [masterFile, setMasterFile] = useState(null);
  const [creating, setCreating] = useState(false);

  const [currentTemplateId, setCurrentTemplateId] = useState(null);
  const [tempMappings, setTempMappings] = useState({});
  const [selectedField, setSelectedField] = useState('name');
  const [cellRef, setCellRef] = useState('');

  const [uploadingMaster, setUploadingMaster] = useState(false);
  const [masterFileToUpload, setMasterFileToUpload] = useState(null);

  useEffect(() => {
    loadFromLocalStorage();
  }, [loadFromLocalStorage]);

  const handleCreateTemplate = async () => {
    if (!templateName.trim()) {
      alert('Please enter a template name');
      return;
    }

    setCreating(true);

    try {
      const templateId = 'excel_' + Date.now();
      const template = {
        id: templateId,
        name: templateName.trim(),
        createdDate: new Date().toISOString(),
        fieldMappings: {},
        driveFileId: null,
        driveFileName: null,
      };

      // If user uploaded a master file
      if (masterFile && isSignedIn) {
        try {
          const folderId = await getOrCreateExcelTemplatesFolder();
          if (folderId) {
            const fileId = await uploadFileToGoogleDrive(masterFile, folderId);
            template.driveFileId = fileId;
            template.driveFileName = masterFile.name;
          }
        } catch (error) {
          console.error('Error uploading master file:', error);
          alert('Template created but master file upload failed. You can upload it later.');
        }
      }

      addTemplate(templateId, template);
      alert(template.driveFileId
        ? 'Template created successfully with master Excel file!\n\nNow you can map fields to Excel cells.'
        : 'Template created successfully!\n\nNow you can map fields to Excel cells.');

      setShowCreateModal(false);
      setTemplateName('');
      setMasterFile(null);
    } catch (error) {
      console.error('Error creating template:', error);
      alert('Failed to create template: ' + error.message);
    } finally {
      setCreating(false);
    }
  };

  const getOrCreateExcelTemplatesFolder = async () => {
    try {
      let folderId = localStorage.getItem('excelTemplatesFolderId');

      if (folderId) {
        try {
          await window.gapi.client.drive.files.get({ fileId: folderId });
          return folderId;
        } catch {
          folderId = null;
        }
      }

      const metadata = {
        name: 'BYD CRM - Excel Templates',
        mimeType: 'application/vnd.google-apps.folder',
      };

      const response = await window.gapi.client.drive.files.create({
        resource: metadata,
        fields: 'id',
      });

      folderId = response.result.id;
      localStorage.setItem('excelTemplatesFolderId', folderId);
      return folderId;
    } catch (error) {
      console.error('Error getting/creating Excel templates folder:', error);
      return null;
    }
  };

  const uploadFileToGoogleDrive = async (file, folderId) => {
    const metadata = {
      name: file.name,
      parents: [folderId],
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    const token = authService.getAccessToken();
    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      }
    );

    const result = await response.json();
    return result.id;
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!window.confirm('Are you sure you want to delete this Excel template?')) {
      return;
    }

    const template = excelTemplates[templateId];

    try {
      // Delete file from Google Drive if it exists
      if (template?.driveFileId && isSignedIn) {
        await window.gapi.client.drive.files.delete({
          fileId: template.driveFileId,
        });
      }

      deleteTemplate(templateId);
      alert('Template deleted successfully');
    } catch (error) {
      console.error('Error deleting template:', error);
      // Continue with deletion even if Drive deletion fails
      deleteTemplate(templateId);
    }
  };

  const openMappingModal = (templateId) => {
    const template = excelTemplates[templateId];
    if (!template) {
      alert('Template not found');
      return;
    }

    setCurrentTemplateId(templateId);
    setTempMappings({ ...(template.fieldMappings || {}) });
    setShowMappingModal(true);
  };

  const addMapping = () => {
    if (!cellRef.trim()) {
      alert('Please enter a cell reference (e.g., A1)');
      return;
    }

    const cellRefUpper = cellRef.trim().toUpperCase();

    // Validate cell reference format
    if (!/^[A-Z]+[0-9]+$/.test(cellRefUpper)) {
      alert('Invalid cell reference. Please use format like A1, B5, C10, etc.');
      return;
    }

    const mappingId = 'mapping_' + Date.now();
    setTempMappings({
      ...tempMappings,
      [mappingId]: {
        fieldType: selectedField,
        cellRef: cellRefUpper,
      },
    });

    setCellRef('');
  };

  const removeMapping = (mappingId) => {
    const newMappings = { ...tempMappings };
    delete newMappings[mappingId];
    setTempMappings(newMappings);
  };

  const saveMappings = () => {
    if (!currentTemplateId) return;

    updateFieldMappings(currentTemplateId, tempMappings);
    alert('Field mappings saved successfully!');
    setShowMappingModal(false);
    setCurrentTemplateId(null);
    setTempMappings({});
  };

  const openUploadMasterModal = (templateId) => {
    setCurrentTemplateId(templateId);
    setMasterFileToUpload(null);
    setShowUploadMasterModal(true);
  };

  const handleUploadMaster = async () => {
    if (!masterFileToUpload) {
      alert('Please select an Excel file to upload');
      return;
    }

    if (!isSignedIn) {
      alert('Please sign in to Google Drive first');
      return;
    }

    setUploadingMaster(true);

    try {
      const template = excelTemplates[currentTemplateId];

      const folderId = await getOrCreateExcelTemplatesFolder();
      if (!folderId) {
        alert('Could not create Excel Templates folder in Google Drive');
        return;
      }

      // Delete old file if exists
      if (template.driveFileId) {
        try {
          await window.gapi.client.drive.files.delete({
            fileId: template.driveFileId,
          });
        } catch (error) {
          console.error('Error deleting old file:', error);
        }
      }

      // Upload new file
      const fileId = await uploadFileToGoogleDrive(masterFileToUpload, folderId);

      updateTemplate(currentTemplateId, {
        driveFileId: fileId,
        driveFileName: masterFileToUpload.name,
      });

      alert(`Master file uploaded successfully!\n\n✓ ${masterFileToUpload.name}\n\nYou can now use this template without uploading files each time.`);
      setShowUploadMasterModal(false);
      setCurrentTemplateId(null);
      setMasterFileToUpload(null);
    } catch (error) {
      console.error('Error uploading master file:', error);
      alert('Error uploading file to Google Drive: ' + error.message);
    } finally {
      setUploadingMaster(false);
    }
  };

  const templatesArray = Object.entries(excelTemplates);

  return (
    <div className="excel-integration">
      <div className="excel-header">
        <h2>Excel Integration</h2>
        <button
          className="btn btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          📊 Create Excel Template
        </button>
      </div>

      {!isSignedIn && (
        <div className="warning-banner">
          ⚠️ Sign in to Google Drive to upload master Excel files (optional)
        </div>
      )}

      <div className="excel-list">
        {templatesArray.length === 0 ? (
          <div className="empty-state">
            <p>No templates created yet</p>
            <p className="empty-state-hint">
              Create Excel templates to automatically populate customer data into Excel files
            </p>
          </div>
        ) : (
          templatesArray.map(([templateId, template]) => {
            const mappingCount = Object.keys(template.fieldMappings || {}).length;
            const hasMasterFile = template.driveFileId && template.driveFileName;

            return (
              <div key={templateId} className="excel-item">
                <div className="excel-info">
                  <div className="excel-icon">📊</div>
                  <div className="excel-details">
                    <h4>{template.name}</h4>
                    <p>
                      Created: {new Date(template.createdDate).toLocaleDateString()}
                    </p>
                    <p className="mapping-count">
                      {mappingCount} field{mappingCount !== 1 ? 's' : ''} mapped
                    </p>
                    {hasMasterFile ? (
                      <p className="master-file-info">✓ Master file: {template.driveFileName}</p>
                    ) : (
                      <p className="no-master-file">⚠ No master file uploaded</p>
                    )}
                  </div>
                </div>
                <div className="excel-actions">
                  <button
                    className="btn btn-small btn-primary"
                    onClick={() => openMappingModal(templateId)}
                  >
                    Map Fields
                  </button>
                  <button
                    className={`btn btn-small ${hasMasterFile ? 'btn-secondary' : 'btn-success'}`}
                    onClick={() => openUploadMasterModal(templateId)}
                  >
                    {hasMasterFile ? 'Update Master' : 'Upload Master'}
                  </button>
                  <button
                    className="btn btn-small btn-danger"
                    onClick={() => handleDeleteTemplate(templateId)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Template Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setTemplateName('');
          setMasterFile(null);
        }}
        title="Create Excel Template"
      >
        <div className="create-template-form">
          <div className="form-group">
            <label htmlFor="templateName">Template Name</label>
            <input
              type="text"
              id="templateName"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g., VSA Template, Invoice Template"
            />
          </div>

          <div className="form-group">
            <label htmlFor="masterFile">Master Excel File (Optional)</label>
            <input
              type="file"
              id="masterFile"
              accept=".xlsx,.xls"
              onChange={(e) => setMasterFile(e.target.files[0])}
              disabled={!isSignedIn}
            />
            {!isSignedIn && (
              <p className="file-hint">Sign in to Google Drive to upload master file</p>
            )}
            {masterFile && <p className="file-selected">Selected: {masterFile.name}</p>}
          </div>

          <div className="modal-actions">
            <button
              className="btn btn-secondary"
              onClick={() => {
                setShowCreateModal(false);
                setTemplateName('');
                setMasterFile(null);
              }}
              disabled={creating}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleCreateTemplate}
              disabled={creating || !templateName.trim()}
            >
              {creating ? 'Creating...' : 'Create Template'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Field Mapping Modal */}
      <Modal
        isOpen={showMappingModal}
        onClose={() => {
          setShowMappingModal(false);
          setCurrentTemplateId(null);
          setTempMappings({});
        }}
        title="Map Fields to Excel Cells"
        size="large"
      >
        <div className="mapping-form">
          <div className="add-mapping-section">
            <h4>Add Field Mapping</h4>
            <div className="mapping-inputs">
              <div className="form-group">
                <label>Customer Field</label>
                <select value={selectedField} onChange={(e) => setSelectedField(e.target.value)}>
                  {Object.entries(FIELD_NAMES).map(([key, name]) => (
                    <option key={key} value={key}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Excel Cell (e.g., A1, B5)</label>
                <input
                  type="text"
                  value={cellRef}
                  onChange={(e) => setCellRef(e.target.value.toUpperCase())}
                  placeholder="A1"
                  style={{ textTransform: 'uppercase' }}
                />
              </div>
              <button className="btn btn-success" onClick={addMapping}>
                Add Mapping
              </button>
            </div>
          </div>

          <div className="mappings-list">
            <h4>Current Mappings</h4>
            {Object.keys(tempMappings).length === 0 ? (
              <p className="no-mappings">No mappings added yet</p>
            ) : (
              <div className="mappings-grid">
                {Object.entries(tempMappings).map(([mappingId, mapping]) => (
                  <div key={mappingId} className="mapping-item">
                    <div className="mapping-info">
                      <strong>{FIELD_NAMES[mapping.fieldType]}</strong> → Cell{' '}
                      <strong>{mapping.cellRef}</strong>
                    </div>
                    <button
                      className="btn btn-small btn-danger"
                      onClick={() => removeMapping(mappingId)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="modal-actions">
            <button
              className="btn btn-secondary"
              onClick={() => {
                setShowMappingModal(false);
                setCurrentTemplateId(null);
                setTempMappings({});
              }}
            >
              Cancel
            </button>
            <button className="btn btn-primary" onClick={saveMappings}>
              Save Mappings
            </button>
          </div>
        </div>
      </Modal>

      {/* Upload Master File Modal */}
      <Modal
        isOpen={showUploadMasterModal}
        onClose={() => {
          setShowUploadMasterModal(false);
          setCurrentTemplateId(null);
          setMasterFileToUpload(null);
        }}
        title="Upload Master Excel File"
      >
        <div className="upload-master-form">
          {currentTemplateId && excelTemplates[currentTemplateId] && (
            <div className="current-master-info">
              {excelTemplates[currentTemplateId].driveFileId ? (
                <div className="has-master">
                  <h4>Current Master File</h4>
                  <p>📄 {excelTemplates[currentTemplateId].driveFileName}</p>
                  <p className="hint">Uploading a new file will replace this one.</p>
                </div>
              ) : (
                <div className="no-master">
                  <p>⚠️ No master file uploaded yet</p>
                  <p className="hint">
                    Upload a master file to skip the upload step when populating data.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="masterFileUpload">Select Excel File</label>
            <input
              type="file"
              id="masterFileUpload"
              accept=".xlsx,.xls"
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
              {uploadingMaster ? 'Uploading...' : 'Upload to Google Drive'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default ExcelIntegration;
