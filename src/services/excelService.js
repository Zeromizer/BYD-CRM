import XlsxPopulate from 'xlsx-populate';
import authService from './authService';
import driveService from './driveService';

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
      przType: customer.vsa_przType || '',

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
   * Fetch Excel file from Google Drive
   */
  async fetchFileFromDrive(fileId) {
    try {
      const token = authService.getAccessToken();
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }

      return await response.arrayBuffer();
    } catch (error) {
      console.error('Error fetching file from Drive:', error);
      throw error;
    }
  }

  /**
   * Upload file to Google Drive
   */
  async uploadFileToDrive(file, folderId, fileName) {
    try {
      console.log('📤 Starting file upload to Drive:', {
        fileName,
        folderId,
        fileSize: file.size,
        fileType: file.type
      });

      const metadata = {
        name: fileName,
        parents: [folderId],
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', file);

      const token = authService.getAccessToken();
      const response = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,createdTime',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: form,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Drive upload failed with status:', response.status, errorText);
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ File uploaded successfully to Drive:', {
        fileId: result.id,
        fileName: result.name,
        size: result.size,
        createdTime: result.createdTime
      });

      return result;
    } catch (error) {
      console.error('❌ Error uploading file to Drive:', error);
      throw error;
    }
  }

  /**
   * Populate Excel template with customer data
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

      // Get Excel file - either from Drive or uploaded file
      if (uploadedFile) {
        console.log('📂 Using uploaded file:', uploadedFile.name);
        arrayBuffer = await uploadedFile.arrayBuffer();
      } else if (template.driveFileId) {
        console.log('☁️ Fetching template from Drive:', template.driveFileId);
        arrayBuffer = await this.fetchFileFromDrive(template.driveFileId);
      } else {
        throw new Error('No Excel file available. Please upload a file or configure a master template.');
      }

      console.log('📊 Loading workbook with xlsx-populate...');
      // Load with xlsx-populate
      const workbook = await XlsxPopulate.fromDataAsync(arrayBuffer);

      // Get first sheet
      const sheet = workbook.sheet(0);
      console.log('✅ Workbook loaded, sheet name:', sheet.name());

      // Get customer data mapping
      const dataMapping = this.getCustomerDataMapping(customer);

      // Apply field mappings
      const fieldMappings = template.fieldMappings || {};
      const mappingCount = Object.keys(fieldMappings).length;
      console.log(`🔄 Applying ${mappingCount} field mappings...`);

      let appliedCount = 0;
      for (const mapping of Object.values(fieldMappings)) {
        const value = dataMapping[mapping.fieldType];
        if (value !== undefined && value !== null && value !== '') {
          // Set cell value - all formatting is automatically preserved
          sheet.cell(mapping.cellRef).value(value);
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
   * Get or create customer folder in Google Drive
   * Uses driveService to ensure consistent folder structure and prevent duplicates
   */
  async getOrCreateCustomerFolder(customerName, customerId) {
    try {
      console.log('📁 Getting/creating customer folder:', { customerName, customerId });

      // Check if customer already has a folder ID stored
      const customers = JSON.parse(localStorage.getItem('bydCRM') || '[]');
      const customer = customers.find(c => c.id === customerId);

      if (customer && customer.driveFolderId) {
        console.log('🔍 Found existing folder ID from customer record:', customer.driveFolderId);
        // Verify folder still exists
        try {
          await window.gapi.client.drive.files.get({ fileId: customer.driveFolderId });
          console.log('✅ Customer folder exists:', customer.driveFolderId);
          return customer.driveFolderId;
        } catch {
          console.warn('⚠️ Stored folder ID no longer exists, will search for existing folder');
        }
      }

      // Search for existing folder in Drive before creating a new one
      console.log('🔍 Searching for existing customer folder in Drive...');
      try {
        const existingFolder = await driveService.findCustomerFolderByName(customerName);
        if (existingFolder) {
          console.log('✅ Found existing customer folder:', existingFolder.folderId);

          // Update customer record with found folder ID
          const updatedCustomers = customers.map(c =>
            c.id === customerId ? {
              ...c,
              driveFolderId: existingFolder.folderId,
              driveFolderLink: existingFolder.folderUrl
            } : c
          );
          localStorage.setItem('bydCRM', JSON.stringify(updatedCustomers));
          console.log('💾 Updated customer record with existing folder ID');

          return existingFolder.folderId;
        }
      } catch (searchError) {
        console.warn('⚠️ Error searching for existing folder:', searchError);
      }

      // No folder found, create new one using driveService
      console.log('🆕 Creating new customer folder structure using driveService...');
      const folderInfo = await driveService.createCustomerFolderStructure(customerName, customerId);
      console.log('✅ Customer folder structure created:', folderInfo.folderId);

      // Update customer record with folder ID (driveService should already do this, but ensure it's saved)
      const updatedCustomers = customers.map(c =>
        c.id === customerId ? {
          ...c,
          driveFolderId: folderInfo.folderId,
          driveFolderLink: folderInfo.folderUrl
        } : c
      );
      localStorage.setItem('bydCRM', JSON.stringify(updatedCustomers));
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
