import { useState, useEffect } from 'react';
import useExcelStore from '../../stores/useExcelStore';
import useAuthStore from '../../stores/useAuthStore';
import excelService from '../../services/excelService';
import Modal from '../Modal/Modal';
import { useToast } from '../Toast/Toast';
import './ExcelPopulateModal.css';

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
  tradeInOwnerNotCustomer: 'Trade-In Owner Different',
  tradeInOwnerName: 'Trade-In Owner Name',
  tradeInOwnerNric: 'Trade-In Owner NRIC',
  tradeInOwnerMobile: 'Trade-In Owner Mobile',
  tradeInInsuranceCompany: 'Trade-In Insurance Company',
  tradeInPolicyNumber: 'Trade-In Policy Number',
  tradeInNameAuto: 'Trade-In Name (Auto)',
  tradeInNricAuto: 'Trade-In NRIC (Auto)',
  tradeInMobileAuto: 'Trade-In Mobile (Auto)',

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
  loanSummary: 'Loan Summary (Combined)',

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
  proposalBenefit1: 'Proposal - Benefit 1',
  proposalBenefit2: 'Proposal - Benefit 2',
  proposalBenefit3: 'Proposal - Benefit 3',
  proposalBenefit4: 'Proposal - Benefit 4',
  proposalBenefit5: 'Proposal - Benefit 5',
  proposalBenefitsGiven: 'Proposal - Benefits Given',
  proposalRemarks: 'Proposal - Remarks',

  // Guarantor 1
  guarantor1Name: 'Guarantor 1 - Name',
  guarantor1Phone: 'Guarantor 1 - Phone',
  guarantor1Email: 'Guarantor 1 - Email',
  guarantor1Nric: 'Guarantor 1 - NRIC',
  guarantor1Occupation: 'Guarantor 1 - Occupation',
  guarantor1Dob: 'Guarantor 1 - DOB',
  guarantor1Address: 'Guarantor 1 - Address',
  guarantor1AddressContinue: 'Guarantor 1 - Address Continue',

  // Guarantor 2
  guarantor2Name: 'Guarantor 2 - Name',
  guarantor2Phone: 'Guarantor 2 - Phone',
  guarantor2Email: 'Guarantor 2 - Email',
  guarantor2Nric: 'Guarantor 2 - NRIC',
  guarantor2Occupation: 'Guarantor 2 - Occupation',
  guarantor2Dob: 'Guarantor 2 - DOB',
  guarantor2Address: 'Guarantor 2 - Address',
  guarantor2AddressContinue: 'Guarantor 2 - Address Continue',

  // Guarantor 3
  guarantor3Name: 'Guarantor 3 - Name',
  guarantor3Phone: 'Guarantor 3 - Phone',
  guarantor3Email: 'Guarantor 3 - Email',
  guarantor3Nric: 'Guarantor 3 - NRIC',
  guarantor3Occupation: 'Guarantor 3 - Occupation',
  guarantor3Dob: 'Guarantor 3 - DOB',
  guarantor3Address: 'Guarantor 3 - Address',
  guarantor3AddressContinue: 'Guarantor 3 - Address Continue',

  // Guarantor 4
  guarantor4Name: 'Guarantor 4 - Name',
  guarantor4Phone: 'Guarantor 4 - Phone',
  guarantor4Email: 'Guarantor 4 - Email',
  guarantor4Nric: 'Guarantor 4 - NRIC',
  guarantor4Occupation: 'Guarantor 4 - Occupation',
  guarantor4Dob: 'Guarantor 4 - DOB',
  guarantor4Address: 'Guarantor 4 - Address',
  guarantor4AddressContinue: 'Guarantor 4 - Address Continue',

  // Guarantor 5
  guarantor5Name: 'Guarantor 5 - Name',
  guarantor5Phone: 'Guarantor 5 - Phone',
  guarantor5Email: 'Guarantor 5 - Email',
  guarantor5Nric: 'Guarantor 5 - NRIC',
  guarantor5Occupation: 'Guarantor 5 - Occupation',
  guarantor5Dob: 'Guarantor 5 - DOB',
  guarantor5Address: 'Guarantor 5 - Address',
  guarantor5AddressContinue: 'Guarantor 5 - Address Continue',

  custom: 'Custom Value',
};

function ExcelPopulateModal({ isOpen, onClose, customer }) {
  const { excelTemplates, loadFromLocalStorage } = useExcelStore();
  const { isSignedIn } = useAuthStore();
  const toast = useToast();

  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [saveToDrive, setSaveToDrive] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadFromLocalStorage();
    }
  }, [isOpen, loadFromLocalStorage]);

  useEffect(() => {
    // Reset state when modal opens/closes
    if (isOpen) {
      setSelectedTemplateId('');
      setUploadedFile(null);
      setProcessing(false);
    }
  }, [isOpen]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadedFile(file);
    }
  };

  const selectedTemplate = selectedTemplateId ? excelTemplates[selectedTemplateId] : null;
  const hasMasterFile = selectedTemplate?.driveFileId && selectedTemplate?.driveFileName;
  const canGenerate = selectedTemplateId && (hasMasterFile || uploadedFile);

  const handleGenerate = async () => {
    if (!canGenerate) {
      toast.warning('Please select a template and upload an Excel file (or use a template with a master file)');
      return;
    }

    console.log('🚀 Starting Excel generation process:', {
      customer: customer.name,
      template: selectedTemplate.name,
      saveToDrive,
      isSignedIn
    });

    setProcessing(true);

    try {
      // Generate populated Excel
      console.log('📝 Calling populateExcelTemplate...');
      const blob = await excelService.populateExcelTemplate(
        selectedTemplate,
        customer,
        uploadedFile
      );
      console.log('✅ Excel template populated, blob size:', blob.size);

      // Create filename
      const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const fileName = `${customer.name.replace(/\s+/g, '_')}_${selectedTemplate.name.replace(/\s+/g, '_')}_${timestamp}.xlsx`;
      console.log('📄 Generated filename:', fileName);

      // Save to OneDrive if requested and signed in
      if (saveToDrive && isSignedIn) {
        console.log('☁️ Saving to OneDrive...');
        try {
          // Get or create customer folder
          console.log('📁 Getting customer folder...');
          const customerFolderId = await excelService.getOrCreateCustomerFolder(
            customer.name,
            customer.id
          );
          console.log('✅ Customer folder ID:', customerFolderId);

          // Save directly to customer's main folder (no subfolders)
          // Convert blob to File
          console.log('🔄 Converting blob to File object...');
          const file = new File([blob], fileName, {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          });
          console.log('✅ File object created:', {
            name: file.name,
            size: file.size,
            type: file.type
          });

          // Upload to Drive
          console.log('📤 Uploading to Drive...');
          const uploadResult = await excelService.uploadFileToDrive(file, customerFolderId, fileName);
          console.log('✅ Upload complete! File ID:', uploadResult.id);

          toast.success('Excel file saved to Google Drive');
        } catch (error) {
          console.error('❌ Error saving to Drive:', error);
          // Download if Drive save failed
          console.log('⬇️ Falling back to download...');
          excelService.downloadExcelFile(blob, fileName);
          toast.warning('Excel downloaded - could not save to Drive: ' + error.message);
        }
      } else {
        // Just download
        console.log('⬇️ Downloading file (not saving to Drive)...');
        excelService.downloadExcelFile(blob, fileName);
        toast.success('Excel file downloaded successfully');
      }

      console.log('✅ Excel generation process complete');
      onClose();
    } catch (error) {
      console.error('❌ Error generating Excel file:', error);
      toast.error('Failed to generate Excel file: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const renderPreview = () => {
    if (!selectedTemplate) {
      return <p className="preview-hint">Select a template to preview...</p>;
    }

    const mappings = selectedTemplate.fieldMappings || {};
    const mappingCount = Object.keys(mappings).length;

    if (mappingCount === 0) {
      return (
        <div className="preview-warning">
          ⚠️ No field mappings configured for this template. Please map fields first.
        </div>
      );
    }

    const dataMapping = excelService.getCustomerDataMapping(customer);

    return (
      <div className="preview-content">
        {hasMasterFile && (
          <div className="master-file-badge">
            ✓ Using master template: {selectedTemplate.driveFileName}
          </div>
        )}
        <h4>The following data will be populated:</h4>
        <div className="preview-list">
          {Object.values(mappings).map((mapping, index) => {
            const fieldName = FIELD_NAMES[mapping.fieldType] || mapping.fieldType;
            let value = dataMapping[mapping.fieldType];

            // Format date for display
            if (value instanceof Date) {
              value = value.toLocaleDateString();
            }

            return (
              <div key={index} className="preview-item">
                <span className="preview-cell">Cell {mapping.cellRef}:</span>
                <span className="preview-field">{fieldName}</span>
                <span className="preview-value">= "{value || '(empty)'}"</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  const templatesArray = Object.entries(excelTemplates);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Populate Excel Template" size="large">
      <div className="excel-populate-modal">
        <div className="populate-form">
          {/* Customer Info */}
          <div className="customer-info">
            <h4>Customer: {customer.name}</h4>
            <p>Populating Excel template with customer data</p>
          </div>

          {/* Template Selection */}
          <div className="form-group">
            <label htmlFor="templateSelect">Select Template</label>
            <select
              id="templateSelect"
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              disabled={processing}
            >
              <option value="">-- Select a mapping template --</option>
              {templatesArray.map(([templateId, template]) => {
                const mappingCount = Object.keys(template.fieldMappings || {}).length;
                return (
                  <option key={templateId} value={templateId}>
                    {template.name} ({mappingCount} fields mapped)
                  </option>
                );
              })}
            </select>
          </div>

          {/* File Upload (if no master file) */}
          {selectedTemplate && !hasMasterFile && (
            <div className="form-group">
              <label htmlFor="excelFile">Upload Excel File</label>
              <input
                type="file"
                id="excelFile"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                disabled={processing}
              />
              {uploadedFile && (
                <p className="file-selected">Selected: {uploadedFile.name}</p>
              )}
              <p className="file-hint">
                This template doesn't have a master file. Please upload your Excel file.
              </p>
            </div>
          )}

          {/* Save to Drive Option */}
          {isSignedIn && (
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={saveToDrive}
                  onChange={(e) => setSaveToDrive(e.target.checked)}
                  disabled={processing}
                />
                <span>Save to Google Drive (customer folder)</span>
              </label>
            </div>
          )}

          {/* Preview */}
          <div className="preview-section">
            <h4>Preview</h4>
            <div className="preview-container">{renderPreview()}</div>
          </div>

          {/* Actions */}
          <div className="modal-actions">
            <button
              className="btn btn-secondary"
              onClick={onClose}
              disabled={processing}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleGenerate}
              disabled={!canGenerate || processing}
            >
              {processing ? 'Generating...' : 'Generate Excel'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default ExcelPopulateModal;
