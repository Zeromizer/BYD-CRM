import { getStorageService, getAuthService } from './storageServiceSelector';
import { PRZ_TYPES } from '../constants/vehicleData';
import userStorage from './userStorage';

/**
 * Excel Service for populating Excel templates with customer data
 *
 * NOTE: xlsx-populate is lazy-loaded to reduce initial bundle size
 */

// Helper to get PRZ type label from value
const getPrzTypeLabel = (value) => {
  if (!value) return '';
  const found = PRZ_TYPES.find(t => t.value === value);
  return found ? found.label : value;
};

// Cache the xlsx-populate module after first load
let xlsxModule = null;

/**
 * Lazy load xlsx-populate module
 */
const loadXlsxPopulate = async () => {
  if (!xlsxModule) {
    const module = await import('xlsx-populate');
    xlsxModule = module.default;
  }
  return xlsxModule;
};

/**
 * Fields that should be treated as currency/numeric values in Excel
 * These will be converted from text strings to numbers for proper Excel formulas
 */
const CURRENCY_FIELDS = new Set([
  // VSA - Pricing & Deposit
  'sellingWithCOE',
  'sellingPriceList',
  'purchasePriceWithCOE',
  'coeRebateLevel',
  'deposit',
  'lessOthers',
  'addOthers',
  // VSA - Trade-In
  'tradeInAmount',
  'tradeInSettlementCost',
  'numberRetentionFee',
  // VSA - Insurance
  'insuranceFee',
  'insuranceFeeNet',
  'insuranceSubsidy',
  // VSA - Loan
  'loanAmount',
  'adminFee',
  'monthlyRepayment',
  'invoiceInstallmentConditional',
  // Proposal - Pricing
  'proposalSellingPrice',
  'proposalDownpayment',
  'proposalLoanAmount',
  'proposalAdminFee',
  'proposalReferralFee',
  'proposalLowLoanSurcharge',
  'proposalNoLoanSurcharge',
  'proposalQuotedTradeInPrice',
]);

/**
 * Fields that should be treated as percentage values in Excel
 */
const PERCENTAGE_FIELDS = new Set([
  'interest',
  'proposalInterestRate',
]);

class ExcelService {
  /**
   * Get customer data mapping for Excel population
   */
  getCustomerDataMapping(customer) {
    // Calculate net insurance fee
    const insuranceFee = this.currencyToNumber(customer.vsa_insuranceFee);
    const subsidy = this.currencyToNumber(customer.vsa_insuranceSubsidy);
    const netInsuranceFee = insuranceFee - subsidy;

    const dataMapping = {
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      nric: customer.nric || '',
      occupation: customer.occupation || '',
      dob: customer.dob || '',
      address: customer.address || '',
      addressContinue: customer.addressContinue || '',
      fullAddress: ((customer.address || '') + (customer.addressContinue ? ', ' + customer.addressContinue : '')).trim(),
      salesConsultant: customer.salesConsultant || '',
      vsaNo: customer.vsaNo || '',
      date: new Date(), // Pass Date object to preserve Excel date formatting

      // VSA Details - BYD New Car Details
      makeModel: customer.vsa_makeModel || '',
      yom: customer.vsa_yom || '',
      bodyColour: customer.vsa_bodyColour || '',
      upholstery: customer.vsa_upholstery || '',
      przType: getPrzTypeLabel(customer.vsa_przType),

      // VSA Details - BYD New Car Package
      package: customer.vsa_package || '',
      sellingWithCOE: customer.vsa_sellingWithCOE || '',
      sellingPriceList: customer.vsa_sellingPriceList || '',
      purchasePriceWithCOE: customer.vsa_purchasePriceWithCOE || '',
      coeRebateLevel: customer.vsa_coeRebateLevel || '',
      deposit: customer.vsa_deposit || '',
      lessOthers: customer.vsa_lessOthers || '',
      addOthers: customer.vsa_addOthers || '',
      deliveryDate: customer.vsa_deliveryDate || '',

      // VSA Details - Trade In Car Details
      tradeInCarNo: customer.vsa_tradeInCarNo || '',
      tradeInCarModel: customer.vsa_tradeInCarModel || '',
      tradeInAmount: customer.vsa_tradeInAmount || '',
      tradeInSettlementCost: customer.vsa_tradeInSettlementCost || '',
      numberRetention: customer.vsa_numberRetention || false,
      numberRetentionFee: customer.vsa_numberRetentionFee || '',
      tradeInOwnerNotCustomer: customer.vsa_tradeInOwnerNotCustomer || '',
      tradeInOwnerName: customer.vsa_tradeInOwnerName || '',
      tradeInOwnerNric: customer.vsa_tradeInOwnerNric || '',
      tradeInOwnerMobile: customer.vsa_tradeInOwnerMobile || '',
      tradeInInsuranceCompany: customer.vsa_tradeInInsuranceCompany || '',
      tradeInPolicyNumber: customer.vsa_tradeInPolicyNumber || '',
      // Trade-In Auto fields - use owner details if different, else customer details
      tradeInNameAuto: customer.vsa_tradeInOwnerNotCustomer ? (customer.vsa_tradeInOwnerName || '') : (customer.name || ''),
      tradeInNricAuto: customer.vsa_tradeInOwnerNotCustomer ? (customer.vsa_tradeInOwnerNric || '') : (customer.nric || ''),
      tradeInMobileAuto: customer.vsa_tradeInOwnerNotCustomer ? (customer.vsa_tradeInOwnerMobile || '') : (customer.phone || ''),

      // VSA Details - Delivery Details
      dateOfRegistration: customer.vsa_dateOfRegistration || '',
      registrationNo: customer.vsa_registrationNo || '',
      chassisNo: customer.vsa_chassisNo || '',
      engineNo: customer.vsa_engineNo || '',
      motorNo: customer.vsa_motorNo || '',

      // VSA Details - Insurance
      insuranceCompany: customer.vsa_insuranceCompany || '',
      insuranceFee: customer.vsa_insuranceFee || '',
      insuranceFeeNet: netInsuranceFee.toFixed(2),

      // VSA Details - Remarks
      remarks1: customer.vsa_remarks1 || '',
      remarks2: customer.vsa_remarks2 || '',
      loanAmount: customer.vsa_loanAmount || '',
      interest: customer.vsa_interest || '',
      tenure: customer.vsa_tenure || '',
      adminFee: customer.vsa_adminFee || '',
      insuranceSubsidy: customer.vsa_insuranceSubsidy || '',
      monthlyRepayment: customer.vsa_monthlyRepayment || '',
      loanSummary: this.formatLoanSummary(customer.vsa_loanAmount, customer.vsa_interest, customer.vsa_tenure),

      // Invoice - Conditional Installment (only included if interest > 2.5%)
      invoiceInstallmentConditional: this.getConditionalInstallment(customer.vsa_interest, customer.vsa_monthlyRepayment),

      // Proposal Details
      proposalModel: customer.proposal_model || '',
      proposalBank: customer.proposal_bank || '',
      proposalSellingPrice: customer.proposal_sellingPrice || '',
      proposalInterestRate: customer.proposal_interestRate || '',
      proposalDownpayment: customer.proposal_downpayment || '',
      proposalLoanTenure: customer.proposal_loanTenure || '',
      proposalLoanAmount: customer.proposal_loanAmount || '',
      proposalAdminFee: customer.proposal_adminFee || '',
      proposalReferralFee: customer.proposal_referralFee || '',
      proposalTradeInModel: customer.proposal_tradeInModel || '',
      proposalLowLoanSurcharge: customer.proposal_lowLoanSurcharge || '',
      proposalTradeInCarPlate: customer.proposal_tradeInCarPlate || '',
      proposalNoLoanSurcharge: customer.proposal_noLoanSurcharge || '',
      proposalQuotedTradeInPrice: customer.proposal_quotedTradeInPrice || '',
      proposalBenefit1: customer.proposal_benefit1 || '',
      proposalBenefit2: customer.proposal_benefit2 || '',
      proposalBenefit3: customer.proposal_benefit3 || '',
      proposalBenefit4: customer.proposal_benefit4 || '',
      proposalBenefit5: customer.proposal_benefit5 || '',
      proposalBenefit6: customer.proposal_benefit6 || '',
      proposalBenefit7: customer.proposal_benefit7 || '',
      proposalBenefit8: customer.proposal_benefit8 || '',
      proposalBenefit9: customer.proposal_benefit9 || '',
      proposalBenefitsGiven: customer.proposal_benefitsGiven || '',
      proposalRemarks: customer.proposal_remarks || '',

      // Guarantor fields (extracted from guarantors array)
      ...this.extractGuarantorFields(customer.guarantors),
    };

    return dataMapping;
  }

  /**
   * Convert currency string to number
   */
  currencyToNumber(value) {
    if (!value) return 0;
    const numericValue = parseFloat(value.toString().replace(/[^0-9.-]/g, ''));
    return isNaN(numericValue) ? 0 : numericValue;
  }

  /**
   * Format loan summary as "LOAN AMOUNT $X x Y% x Z MONTHS" or "NO LOAN" if no loan
   */
  formatLoanSummary(loanAmount, interest, tenure) {
    // Check if loan amount is empty or zero - return "NO LOAN"
    const numericLoan = loanAmount ? parseFloat(loanAmount.toString().replace(/[^0-9.-]/g, '')) : 0;
    if (!numericLoan || numericLoan === 0) {
      return 'NO LOAN';
    }

    // Format loan amount with commas
    const loanStr = `$${numericLoan.toLocaleString('en-US')}`;
    const interestStr = interest ? `${interest}%` : '';
    const tenureStr = tenure ? `${tenure} MONTHS` : '';

    // Build the string with parts that exist
    const parts = [loanStr, interestStr, tenureStr].filter(p => p);

    return `LOAN AMOUNT ${parts.join(' x ')}`;
  }

  /**
   * Get conditional installment value
   * Only returns the installment amount if interest rate > 2.5%
   * Returns empty string if interest rate <= 2.5%
   */
  getConditionalInstallment(interest, monthlyRepayment) {
    const interestRate = parseFloat((interest || '0').toString().replace(/[^0-9.-]/g, ''));
    if (interestRate > 2.5) {
      return monthlyRepayment || '';
    }
    return '';
  }

  /**
   * Extract guarantor fields from guarantors array
   */
  extractGuarantorFields(guarantors) {
    const fields = {};
    for (let i = 0; i < 5; i++) {
      const num = i + 1;
      const g = guarantors?.[i] || {};
      fields[`guarantor${num}Name`] = g.name || '';
      fields[`guarantor${num}Phone`] = g.phone || '';
      fields[`guarantor${num}Email`] = g.email || '';
      fields[`guarantor${num}Nric`] = g.nric || '';
      fields[`guarantor${num}Occupation`] = g.occupation || '';
      fields[`guarantor${num}Dob`] = g.dob || '';
      fields[`guarantor${num}Address`] = g.address || '';
      fields[`guarantor${num}AddressContinue`] = g.addressContinue || '';
    }
    return fields;
  }

  /**
   * Fetch Excel file from cloud storage (OneDrive/Google Drive)
   */
  async fetchFileFromDrive(fileId) {
    // Validate fileId before making request
    if (!fileId || typeof fileId !== 'string' || fileId.trim() === '') {
      throw new Error('Invalid file ID. Please re-upload the Excel template master file.');
    }

    try {
      const blob = await getStorageService().downloadFileAsBlob(fileId);
      return await blob.arrayBuffer();
    } catch (error) {
      console.error('Error fetching file from cloud storage:', error);
      // Provide more helpful error message
      if (error.message?.includes('400') || error.message?.includes('404')) {
        throw new Error('Excel template file not found in OneDrive. The file may have been deleted or moved. Please re-upload the master file in Excel Integration settings.');
      }
      throw error;
    }
  }

  /**
   * Upload file to cloud storage (OneDrive/Google Drive)
   */
  async uploadFileToDrive(file, folderId, fileName) {
    try {
      console.log('📤 Starting file upload to cloud storage:', {
        fileName,
        folderId,
        fileSize: file.size,
        fileType: file.type
      });

      const storageService = getStorageService();
      if (!storageService) {
        throw new Error('Storage service not available');
      }

      // Use uploadFileToFolder for binary files (more robust than uploadFile)
      const fileId = await storageService.uploadFileToFolder(fileName, file, folderId);

      console.log('✅ File uploaded successfully to cloud storage:', {
        fileId,
        fileName
      });

      return { id: fileId, name: fileName };
    } catch (error) {
      console.error('❌ Error uploading file to cloud storage:', error);
      throw error;
    }
  }

  /**
   * Populate Excel template with customer data
   * OPTIMIZED: Parallelize file fetch and module load
   */
  async populateExcelTemplate(template, customer, uploadedFile = null) {
    try {
      console.log('📝 Starting Excel template population:', {
        templateName: template.name,
        customerName: customer.name,
        hasUploadedFile: !!uploadedFile,
        hasDriveFile: !!template.driveFileId
      });

      let arrayBuffer;
      let XlsxPopulate;

      // OPTIMIZED: Parallelize file fetch and module load
      if (uploadedFile) {
        console.log('📂 Using uploaded file:', uploadedFile.name);
        // For uploaded files, we can still parallelize with module load
        [arrayBuffer, XlsxPopulate] = await Promise.all([
          uploadedFile.arrayBuffer(),
          loadXlsxPopulate()
        ]);
      } else if (template.driveFileId) {
        console.log('☁️ Fetching template from Drive:', template.driveFileId);
        // OPTIMIZATION: Fetch file AND load module in parallel
        [arrayBuffer, XlsxPopulate] = await Promise.all([
          this.fetchFileFromDrive(template.driveFileId),
          loadXlsxPopulate()
        ]);
      } else {
        throw new Error('No Excel file available. Please upload a file or configure a master template.');
      }

      // Load workbook from buffer
      const workbook = await XlsxPopulate.fromDataAsync(arrayBuffer);

      // Log available sheets for debugging
      const sheetNames = workbook.sheets().map(s => s.name());
      console.log('✅ Workbook loaded, available sheets:', sheetNames);

      // Get customer data mapping
      const dataMapping = this.getCustomerDataMapping(customer);

      // Apply field mappings
      const fieldMappings = template.fieldMappings || {};
      const mappingCount = Object.keys(fieldMappings).length;
      console.log(`🔄 Applying ${mappingCount} field mappings...`);

      let appliedCount = 0;
      for (const mapping of Object.values(fieldMappings)) {
        let value;

        // Handle custom field type - use the stored custom value
        if (mapping.fieldType === '_custom') {
          value = mapping.customValue || '';
        } else {
          value = dataMapping[mapping.fieldType];
        }

        if (value !== undefined && value !== null && value !== '') {
          // Convert currency fields to numbers for proper Excel formulas
          if (CURRENCY_FIELDS.has(mapping.fieldType)) {
            const numericValue = this.currencyToNumber(value);
            // Only use numeric value if it's a valid number
            if (!isNaN(numericValue) && numericValue !== 0) {
              value = numericValue;
            } else if (value === '' || value === '0' || value === '$0') {
              value = 0; // Set zero values as numeric 0
            }
            // If it's not a valid number and not zero, keep as string (edge case)
          }

          // Convert percentage fields to decimal for Excel percentage format
          // Excel percentage format displays value * 100, so 2.28% should be stored as 0.0228
          if (PERCENTAGE_FIELDS.has(mapping.fieldType)) {
            const numericValue = parseFloat(value.toString().replace(/[^0-9.-]/g, ''));
            if (!isNaN(numericValue)) {
              value = numericValue / 100; // Convert 2.28 to 0.0228 for Excel percentage format
            }
          }

          // Parse cell reference - supports "A1" (first sheet) or "SheetName!A1" (specific sheet)
          const cellRef = mapping.cellRef;
          let sheet;
          let actualCellRef;

          if (cellRef.includes('!')) {
            // Format: SheetName!CellRef (e.g., "Sheet1!A1" or "Details!B5")
            const parts = cellRef.split('!');
            const sheetNameInput = parts[0].replace(/^'|'$/g, ''); // Remove quotes if present
            actualCellRef = parts[1];

            // Case-insensitive sheet lookup
            sheet = workbook.sheet(sheetNameInput);
            if (!sheet) {
              // Try case-insensitive match
              const allSheets = workbook.sheets();
              const matchedSheet = allSheets.find(s =>
                s.name().toLowerCase() === sheetNameInput.toLowerCase()
              );
              if (matchedSheet) {
                sheet = matchedSheet;
              } else {
                console.warn(`⚠️ Sheet "${sheetNameInput}" not found, skipping cell ${cellRef}`);
                continue;
              }
            }
          } else {
            // Format: CellRef only (e.g., "A1") - use first sheet
            sheet = workbook.sheet(0);
            actualCellRef = cellRef;
          }

          // Set cell value - all formatting is automatically preserved
          sheet.cell(actualCellRef).value(value);
          appliedCount++;
        }
      }
      console.log(`✅ Applied ${appliedCount}/${mappingCount} field values`);

      // Generate Excel file as blob
      console.log('🔨 Generating Excel blob...');
      const blob = await workbook.outputAsync();
      console.log('✅ Excel blob generated:', {
        size: blob.size,
        type: blob.type
      });

      return blob;
    } catch (error) {
      console.error('❌ Error populating Excel template:', error);
      throw error;
    }
  }

  /**
   * Download populated Excel file
   */
  downloadExcelFile(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Get or create customer folder in cloud storage
   * Uses storageService to ensure consistent folder structure and prevent duplicates
   * Uses userStorage for multi-user/multi-device support
   */
  async getOrCreateCustomerFolder(customerName, customerId) {
    try {
      console.log('📁 Getting/creating customer folder:', { customerName, customerId });

      // Get current user email for user-specific storage
      const userEmail = userStorage.getUserEmail();

      // Check if customer already has a folder ID stored (use user-specific storage)
      const customers = userEmail
        ? (userStorage.loadUserData(userEmail, 'customers') || [])
        : JSON.parse(localStorage.getItem('bydCRM') || '[]');
      const customer = customers.find(c => c.id === customerId);

      if (customer && customer.driveFolderId) {
        console.log('🔍 Found existing folder ID from customer record:', customer.driveFolderId);
        // Verify folder still exists using storage service
        try {
          await getStorageService().validateFolderId(customer.driveFolderId);
          console.log('✅ Customer folder exists:', customer.driveFolderId);
          return customer.driveFolderId;
        } catch {
          console.warn('⚠️ Stored folder ID no longer exists, will search for existing folder');
        }
      }

      // Search for existing folder before creating a new one
      console.log('🔍 Searching for existing customer folder in cloud storage...');
      try {
        const existingFolder = await getStorageService().findCustomerFolderByName(customerName);
        if (existingFolder) {
          console.log('✅ Found existing customer folder:', existingFolder.folderId);

          // Update customer record with found folder ID (use user-specific storage)
          const updatedCustomers = customers.map(c =>
            c.id === customerId ? {
              ...c,
              driveFolderId: existingFolder.folderId,
              driveFolderLink: existingFolder.folderUrl
            } : c
          );
          if (userEmail) {
            userStorage.saveUserData(userEmail, 'customers', updatedCustomers);
          } else {
            localStorage.setItem('bydCRM', JSON.stringify(updatedCustomers));
          }
          console.log('💾 Updated customer record with existing folder ID');

          return existingFolder.folderId;
        }
      } catch (searchError) {
        console.warn('⚠️ Error searching for existing folder:', searchError);
      }

      // No folder found, create new one using storageService
      console.log('🆕 Creating new customer folder structure using getStorageService()...');
      const folderInfo = await getStorageService().createCustomerFolderStructure(customerName, customerId);
      console.log('✅ Customer folder structure created:', folderInfo.folderId);

      // Update customer record with folder ID (use user-specific storage)
      const updatedCustomers = customers.map(c =>
        c.id === customerId ? {
          ...c,
          driveFolderId: folderInfo.folderId,
          driveFolderLink: folderInfo.folderUrl
        } : c
      );
      if (userEmail) {
        userStorage.saveUserData(userEmail, 'customers', updatedCustomers);
      } else {
        localStorage.setItem('bydCRM', JSON.stringify(updatedCustomers));
      }
      console.log('💾 Updated customer record with new folder ID');

      return folderInfo.folderId;
    } catch (error) {
      console.error('❌ Error getting/creating customer folder:', error);
      throw error;
    }
  }

  /**
   * Determine document type from template name
   */
  getDocumentType(templateName) {
    const nameLower = templateName.toLowerCase();
    if (nameLower.includes('vsa') || nameLower.includes('sales agreement')) {
      return 'vsa';
    } else if (nameLower.includes('trade')) {
      return 'trade_in';
    } else if (nameLower.includes('test drive')) {
      return 'test_drive';
    } else if (nameLower.includes('pdpa') || nameLower.includes('coe')) {
      return 'pdpa_coe';
    }
    return 'other';
  }
}

export default new ExcelService();
