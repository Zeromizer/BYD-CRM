import XlsxPopulate from 'xlsx-populate';
import authService from './authService';

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
   */
  async getOrCreateCustomerFolder(customerName, customerId) {
    try {
      console.log('📁 Getting/creating customer folder:', { customerName, customerId });

      // Check if customer already has a folder ID stored
      const customers = JSON.parse(localStorage.getItem('bydCRM') || '[]');
      const customer = customers.find(c => c.id === customerId);

      if (customer && customer.driveFolderId) {
        console.log('🔍 Found existing folder ID, verifying:', customer.driveFolderId);
        // Verify folder still exists
        try {
          await window.gapi.client.drive.files.get({ fileId: customer.driveFolderId });
          console.log('✅ Customer folder exists:', customer.driveFolderId);
          return customer.driveFolderId;
        } catch {
          console.warn('⚠️ Stored folder ID no longer exists, will create new one');
          // Folder doesn't exist, will create new one
        }
      }

      // Get or create main BYD CRM folder
      const mainFolderId = await this.getOrCreateMainFolder();
      console.log('📂 Main BYD CRM folder ID:', mainFolderId);

      // Create customer folder
      const metadata = {
        name: customerName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [mainFolderId],
      };

      console.log('🆕 Creating new customer folder:', customerName);
      const response = await window.gapi.client.drive.files.create({
        resource: metadata,
        fields: 'id',
      });

      const folderId = response.result.id;
      console.log('✅ Customer folder created:', folderId);

      // Update customer record with folder ID
      const updatedCustomers = customers.map(c =>
        c.id === customerId ? { ...c, driveFolderId: folderId } : c
      );
      localStorage.setItem('bydCRM', JSON.stringify(updatedCustomers));
      console.log('💾 Updated customer record with folder ID');

      return folderId;
    } catch (error) {
      console.error('❌ Error getting/creating customer folder:', error);
      throw error;
    }
  }

  /**
   * Get or create main BYD CRM folder
   */
  async getOrCreateMainFolder() {
    try {
      let mainFolderId = localStorage.getItem('bydCrmMainFolderId');

      if (mainFolderId) {
        try {
          await window.gapi.client.drive.files.get({ fileId: mainFolderId });
          return mainFolderId;
        } catch {
          mainFolderId = null;
        }
      }

      // Create main folder
      const metadata = {
        name: 'BYD CRM',
        mimeType: 'application/vnd.google-apps.folder',
      };

      const response = await window.gapi.client.drive.files.create({
        resource: metadata,
        fields: 'id',
      });

      mainFolderId = response.result.id;
      localStorage.setItem('bydCrmMainFolderId', mainFolderId);

      return mainFolderId;
    } catch (error) {
      console.error('Error getting/creating main folder:', error);
      throw error;
    }
  }

  /**
   * Get or create document subfolders
   */
  async getOrCreateDocumentSubfolders(customerFolderId, customerId) {
    try {
      const customers = JSON.parse(localStorage.getItem('bydCRM') || '[]');
      const customer = customers.find(c => c.id === customerId);

      if (customer && customer.documentFolders) {
        return customer.documentFolders;
      }

      // Create subfolders
      const folderNames = {
        vsa: 'VSA',
        trade_in: 'Trade In',
        test_drive: 'Test Drive',
        pdpa_coe: 'PDPA & COE',
        other: 'Other',
      };

      const documentFolders = {};

      for (const [key, name] of Object.entries(folderNames)) {
        const metadata = {
          name: name,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [customerFolderId],
        };

        const response = await window.gapi.client.drive.files.create({
          resource: metadata,
          fields: 'id',
        });

        documentFolders[key] = response.result.id;
      }

      // Update customer record
      const updatedCustomers = customers.map(c =>
        c.id === customerId ? { ...c, documentFolders } : c
      );
      localStorage.setItem('bydCRM', JSON.stringify(updatedCustomers));

      return documentFolders;
    } catch (error) {
      console.error('Error creating document subfolders:', error);
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
