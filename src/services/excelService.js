import XlsxPopulate from 'xlsx-populate';
import authService from './authService';

class ExcelService {
  /**
   * Get customer data mapping for Excel population
   */
  getCustomerDataMapping(customer) {
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

      // VSA Details - Remarks
      remarks1: customer.vsa_remarks1 || '',
      remarks2: customer.vsa_remarks2 || '',
      loanAmount: customer.vsa_loanAmount || '',
      interest: customer.vsa_interest || '',
      tenure: customer.vsa_tenure || '',
      adminFee: customer.vsa_adminFee || '',
      insuranceSubsidy: customer.vsa_insuranceSubsidy || '',
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
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error uploading file to Drive:', error);
      throw error;
    }
  }

  /**
   * Populate Excel template with customer data
   */
  async populateExcelTemplate(template, customer, uploadedFile = null) {
    try {
      let arrayBuffer;

      // Get Excel file - either from Drive or uploaded file
      if (uploadedFile) {
        arrayBuffer = await uploadedFile.arrayBuffer();
      } else if (template.driveFileId) {
        arrayBuffer = await this.fetchFileFromDrive(template.driveFileId);
      } else {
        throw new Error('No Excel file available. Please upload a file or configure a master template.');
      }

      // Load with xlsx-populate
      const workbook = await XlsxPopulate.fromDataAsync(arrayBuffer);

      // Get first sheet
      const sheet = workbook.sheet(0);

      // Get customer data mapping
      const dataMapping = this.getCustomerDataMapping(customer);

      // Apply field mappings
      const fieldMappings = template.fieldMappings || {};
      for (const mapping of Object.values(fieldMappings)) {
        const value = dataMapping[mapping.fieldType];
        if (value !== undefined && value !== null && value !== '') {
          // Set cell value - all formatting is automatically preserved
          sheet.cell(mapping.cellRef).value(value);
        }
      }

      // Generate Excel file as blob
      const blob = await workbook.outputAsync();

      return blob;
    } catch (error) {
      console.error('Error populating Excel template:', error);
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
      // Check if customer already has a folder ID stored
      const customers = JSON.parse(localStorage.getItem('bydCRM') || '[]');
      const customer = customers.find(c => c.id === customerId);

      if (customer && customer.driveFolderId) {
        // Verify folder still exists
        try {
          await window.gapi.client.drive.files.get({ fileId: customer.driveFolderId });
          return customer.driveFolderId;
        } catch {
          // Folder doesn't exist, will create new one
        }
      }

      // Get or create main BYD CRM folder
      const mainFolderId = await this.getOrCreateMainFolder();

      // Create customer folder
      const metadata = {
        name: customerName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [mainFolderId],
      };

      const response = await window.gapi.client.drive.files.create({
        resource: metadata,
        fields: 'id',
      });

      const folderId = response.result.id;

      // Update customer record with folder ID
      const updatedCustomers = customers.map(c =>
        c.id === customerId ? { ...c, driveFolderId: folderId } : c
      );
      localStorage.setItem('bydCRM', JSON.stringify(updatedCustomers));

      return folderId;
    } catch (error) {
      console.error('Error getting/creating customer folder:', error);
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
