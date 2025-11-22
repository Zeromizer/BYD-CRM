import { useState, useEffect } from 'react';
import useExcelStore from '../../stores/useExcelStore';
import useAuthStore from '../../stores/useAuthStore';
import authService from '../../services/authService';
import Modal from '../Modal/Modal';
import JSZip from 'jszip';
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

  // VSA Details - BYD New Car Details
  makeModel: 'Make & Model',
  yom: 'Year of Manufacture',
  bodyColour: 'Body Colour',
  upholstery: 'Upholstery',
  przType: 'P/R/Z Type',

  // VSA Details - BYD New Car Package
  package: 'Package',
  sellingWithCOE: 'Selling with COE',
  sellingPriceList: 'Selling Price on Price List',
  purchasePriceWithCOE: 'Purchase Price with COE',
  coeRebateLevel: 'COE Rebate Level',
  deposit: 'Deposit',
  lessOthers: 'Less: Others',
  addOthers: 'Add: Others',
  deliveryDate: 'Approximate Delivery Date',

  // VSA Details - Trade In Car Details
  tradeInCarNo: 'Trade in Car No',
  tradeInCarModel: 'Trade in Car Model',
  tradeInAmount: 'Trade In Amount',

  // VSA Details - Delivery Details
  dateOfRegistration: 'Date of Registration',
  registrationNo: 'Registration No',
  chassisNo: 'Chassis No',
  engineNo: 'Engine No',
  motorNo: 'Motor No',

  // VSA Details - Insurance
  insuranceCompany: 'Insurance Company',
  insuranceFee: 'Insurance Fee',
  insuranceFeeNet: 'Net Insurance Fee',

  // VSA Details - Remarks
  remarks1: 'Remarks 1',
  remarks2: 'Remarks 2',
  loanAmount: 'Loan Amount',
  interest: 'Interest',
  tenure: 'Tenure',
  adminFee: 'Admin Fee',
  insuranceSubsidy: 'Insurance Subsidy',
  monthlyRepayment: 'Monthly Repayment',

  // Proposal Details
  proposalModel: 'Proposal - Model',
  proposalBank: 'Proposal - Bank',
  proposalSellingPrice: 'Proposal - Selling Price',
  proposalInterestRate: 'Proposal - Interest Rate',
  proposalDownpayment: 'Proposal - Downpayment',
  proposalLoanTenure: 'Proposal - Loan Tenure',
  proposalLoanAmount: 'Proposal - Loan Amount',
  proposalAdminFee: 'Proposal - Admin Fee',
  proposalReferralFee: 'Proposal - Referral Fee',
  proposalTradeInModel: 'Proposal - Trade In Model',
  proposalLowLoanSurcharge: 'Proposal - Low Loan Surcharge',
  proposalTradeInCarPlate: 'Proposal - Trade In Car Plate',
  proposalNoLoanSurcharge: 'Proposal - No Loan Surcharge',
  proposalQuotedTradeInPrice: 'Proposal - Quoted Trade In Price',
  proposalBenefitsGiven: 'Proposal - Benefits Given',
  proposalRemarks: 'Proposal - Remarks',
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

  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importConfig, setImportConfig] = useState(null);
  const [importMasterFile, setImportMasterFile] = useState(null);
  const [importing, setImporting] = useState(false);

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

  // Export Excel template configuration
  const handleExportTemplate = (templateId) => {
    const template = excelTemplates[templateId];
    if (!template) {
      alert('Template not found');
      return;
    }

    const exportData = {
      templateName: template.name,
      fileName: template.driveFileName,
      fieldMappings: template.fieldMappings || {},
      exportDate: new Date().toISOString(),
      version: '1.0',
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${template.name.replace(/\s+/g, '_')}_excel_config.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    alert('Excel template configuration exported! Share this file with other users.');
  };

  // Export all Excel templates as a zip file
  const handleExportAllTemplates = async () => {
    const templatesArray = Object.entries(excelTemplates);

    if (templatesArray.length === 0) {
      alert('No templates to export');
      return;
    }

    try {
      const zip = new JSZip();

      // Add each template configuration to the zip
      templatesArray.forEach(([templateId, template]) => {
        const exportData = {
          templateName: template.name,
          fileName: template.driveFileName,
          fieldMappings: template.fieldMappings || {},
          exportDate: new Date().toISOString(),
          version: '1.0',
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        zip.file(`${template.name.replace(/\s+/g, '_')}_excel_config.json`, dataStr);
      });

      // Generate the zip file
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `excel_templates_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      alert(`Successfully exported ${templatesArray.length} Excel template(s) to a zip file!`);
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

  // Import Excel template(s)
  const handleImportTemplate = async () => {
    const configs = Array.isArray(importConfig) ? importConfig : [importConfig];

    if (configs.length === 0) {
      alert('No configurations to import');
      return;
    }

    // For single template import, require master file
    if (configs.length === 1 && !importMasterFile) {
      alert('Please select the master Excel file for this template');
      return;
    }

    if (!isSignedIn && configs.length === 1 && importMasterFile) {
      alert('Please sign in to Google Drive to import templates with master files');
      return;
    }

    setImporting(true);

    try {
      let successCount = 0;
      let skipCount = 0;
      const errors = [];

      for (let i = 0; i < configs.length; i++) {
        const config = configs[i];

        try {
          // For single import with master file
          if (configs.length === 1 && importMasterFile) {
            // Get or create Excel templates folder
            const folderId = await getOrCreateExcelTemplatesFolder();
            if (!folderId) {
              alert('Failed to create Excel templates folder. Please try again.');
              setImporting(false);
              return;
            }

            // Upload master file to Google Drive
            const fileId = await uploadFileToGoogleDrive(importMasterFile, folderId);

            // Create template with imported configuration
            const templateId = 'excel_' + Date.now();
            const template = {
              id: templateId,
              name: config.templateName,
              createdDate: new Date().toISOString(),
              fieldMappings: config.fieldMappings || {},
              driveFileId: fileId,
              driveFileName: importMasterFile.name,
            };

            addTemplate(templateId, template);
            successCount++;
          } else if (configs.length > 1) {
            // For bulk import without master files, just import the configuration
            // User will need to upload master files later
            const templateId = 'excel_' + Date.now() + '_' + i;
            const template = {
              id: templateId,
              name: config.templateName,
              createdDate: new Date().toISOString(),
              fieldMappings: config.fieldMappings || {},
              driveFileId: null,
              driveFileName: config.fileName,
            };

            addTemplate(templateId, template);
            successCount++;
          }
        } catch (error) {
          console.error(`Error importing ${config.templateName}:`, error);
          errors.push(`${config.templateName}: ${error.message}`);
        }
      }

      // Show summary
      let message = '';
      if (successCount > 0) {
        message += `Successfully imported ${successCount} Excel template(s).\n`;
        if (configs.length > 1) {
          message += 'Note: You will need to upload the master Excel files for each template separately.\n';
        }
      }
      if (skipCount > 0) {
        message += `Skipped ${skipCount} template(s).\n`;
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

  const templatesArray = Object.entries(excelTemplates);

  return (
    <div className="excel-integration">
      <div className="excel-header">
        <h2>Excel Integration</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            📊 Create Excel Template
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
                    className="btn btn-small btn-success"
                    onClick={() => handleExportTemplate(templateId)}
                  >
                    📤 Export
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
                  <optgroup label="Basic Customer Information">
                    <option value="name">Customer Name</option>
                    <option value="phone">Phone Number</option>
                    <option value="email">Email</option>
                    <option value="nric">NRIC/FIN</option>
                    <option value="occupation">Occupation</option>
                    <option value="dob">Date of Birth</option>
                    <option value="address">Address</option>
                    <option value="addressContinue">Address Continue</option>
                    <option value="fullAddress">Full Address (Combined)</option>
                    <option value="salesConsultant">Sales Consultant</option>
                    <option value="vsaNo">VSA No</option>
                    <option value="date">Today's Date</option>
                  </optgroup>

                  <optgroup label="VSA - New Car Details">
                    <option value="makeModel">Make & Model</option>
                    <option value="yom">Year of Manufacture</option>
                    <option value="bodyColour">Body Colour</option>
                    <option value="upholstery">Upholstery</option>
                    <option value="przType">P/R/Z Type</option>
                  </optgroup>

                  <optgroup label="VSA - New Car Package">
                    <option value="package">Package</option>
                    <option value="sellingWithCOE">Selling with COE</option>
                    <option value="sellingPriceList">Selling Price on Price List</option>
                    <option value="purchasePriceWithCOE">Purchase Price with COE</option>
                    <option value="coeRebateLevel">COE Rebate Level</option>
                    <option value="deposit">Deposit</option>
                    <option value="lessOthers">Less: Others</option>
                    <option value="addOthers">Add: Others</option>
                    <option value="deliveryDate">Approximate Delivery Date</option>
                  </optgroup>

                  <optgroup label="VSA - Trade In Details">
                    <option value="tradeInCarNo">Trade in Car No</option>
                    <option value="tradeInCarModel">Trade in Car Model</option>
                    <option value="tradeInAmount">Trade In Amount</option>
                  </optgroup>

                  <optgroup label="VSA - Delivery Details">
                    <option value="dateOfRegistration">Date of Registration</option>
                    <option value="registrationNo">Registration No</option>
                    <option value="chassisNo">Chassis No</option>
                    <option value="engineNo">Engine No</option>
                    <option value="motorNo">Motor No</option>
                  </optgroup>

                  <optgroup label="VSA - Insurance">
                    <option value="insuranceCompany">Insurance Company</option>
                    <option value="insuranceFee">Insurance Fee</option>
                    <option value="insuranceFeeNet">Net Insurance Fee</option>
                  </optgroup>

                  <optgroup label="VSA - Remarks & Loan">
                    <option value="remarks1">Remarks 1</option>
                    <option value="remarks2">Remarks 2</option>
                    <option value="loanAmount">Loan Amount</option>
                    <option value="interest">Interest</option>
                    <option value="tenure">Tenure</option>
                    <option value="adminFee">Admin Fee</option>
                    <option value="insuranceSubsidy">Insurance Subsidy</option>
                    <option value="monthlyRepayment">Monthly Repayment</option>
                  </optgroup>

                  <optgroup label="Proposal">
                    <option value="proposalModel">Model</option>
                    <option value="proposalBank">Bank</option>
                    <option value="proposalSellingPrice">Selling Price</option>
                    <option value="proposalInterestRate">Interest Rate</option>
                    <option value="proposalDownpayment">Downpayment</option>
                    <option value="proposalLoanTenure">Loan Tenure</option>
                    <option value="proposalLoanAmount">Loan Amount</option>
                    <option value="proposalAdminFee">Admin Fee</option>
                    <option value="proposalReferralFee">Referral Fee</option>
                    <option value="proposalTradeInModel">Trade In Model</option>
                    <option value="proposalLowLoanSurcharge">Low Loan Surcharge</option>
                    <option value="proposalTradeInCarPlate">Trade In Car Plate</option>
                    <option value="proposalNoLoanSurcharge">No Loan Surcharge</option>
                    <option value="proposalQuotedTradeInPrice">Quoted Trade In Price</option>
                    <option value="proposalBenefitsGiven">Benefits Given</option>
                    <option value="proposalRemarks">Remarks</option>
                  </optgroup>
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

      {/* Import Template Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => {
          setShowImportModal(false);
          setImportFile(null);
          setImportConfig(null);
          setImportMasterFile(null);
        }}
        title="Import Excel Template(s)"
      >
        <div className="upload-form">
          <div className="info-banner" style={{ marginBottom: '15px', padding: '10px', background: '#e3f2fd', borderRadius: '4px' }}>
            <p style={{ margin: 0, fontSize: '14px' }}>
              📋 Import Excel template(s) shared by another user. You can import:
              <br />• A single template (with configuration .json + master .xlsx file)
              <br />• Multiple templates (select multiple .json files or a .zip file)
              <br />• For bulk import, you'll upload master Excel files separately later
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="excelConfigFile">
              1. Configuration File(s) (.json or .zip)
            </label>
            <input
              type="file"
              id="excelConfigFile"
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
                          {config.templateName} ({Object.keys(config.fieldMappings || {}).length} field(s))
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <>
                    <p style={{ margin: 0 }}>
                      ✓ Config loaded: {importConfig.templateName}
                    </p>
                    <small>{Object.keys(importConfig.fieldMappings || {}).length} field(s) mapped</small>
                  </>
                )}
              </div>
            )}
          </div>

          {importConfig && !Array.isArray(importConfig) && (
            <div className="form-group">
              <label htmlFor="excelMasterFile">2. Master Excel File (.xlsx or .xls)</label>
              <input
                type="file"
                id="excelMasterFile"
                accept=".xlsx,.xls"
                onChange={(e) => setImportMasterFile(e.target.files[0])}
                disabled={importing}
              />
              {importMasterFile && (
                <p className="file-selected">✓ Selected: {importMasterFile.name}</p>
              )}
              {!importMasterFile && (
                <p className="file-hint">
                  Please upload an Excel file that matches the exported template
                </p>
              )}
            </div>
          )}

          {importConfig && Array.isArray(importConfig) && (
            <div className="form-group">
              <div style={{ padding: '10px', background: '#fff3cd', borderRadius: '4px', marginTop: '10px' }}>
                <p style={{ margin: 0, fontSize: '13px' }}>
                  ⚠️ Bulk import will import the template configurations only.
                  <br />You'll need to upload the master Excel files for each template separately after import.
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
    </div>
  );
}

export default ExcelIntegration;
