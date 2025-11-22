import { CONFIG } from '../config/config.js';

/**
 * Google Drive Service
 * Handles syncing customer data between localStorage and Google Drive
 */
class DriveService {
  constructor() {
    this.customersFileId = null;
    this.formsFileId = null;
    this.excelFileId = null;
    this.rootFolderId = null;
  }

  /**
   * Clear all cached folder and file IDs (for sign out or account switching)
   */
  clearCache() {
    console.log('Clearing Drive service cache');
    this.customersFileId = null;
    this.formsFileId = null;
    this.excelFileId = null;
    this.rootFolderId = null;
    this.customersFolderId = null;
  }

  /**
   * Get or create the Customers folder (searches in Drive root, not in BYD CRM folder)
   */
  async getOrCreateCustomersFolder() {
    if (this.customersFolderId) {
      return this.customersFolderId;
    }

    try {
      const folderName = CONFIG.FOLDER_NAMES.CUSTOMERS || 'BYD_MotorEast_Customers';

      // Search for existing folder in Drive root (not in any parent folder)
      const response = await window.gapi.client.drive.files.list({
        q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive',
      });

      if (response.result.files && response.result.files.length > 0) {
        this.customersFolderId = response.result.files[0].id;
        console.log(`Found existing Customers folder "${folderName}":`, this.customersFolderId);
        return this.customersFolderId;
      }

      // Create new folder in Drive root (no parent specified)
      const createResponse = await window.gapi.client.drive.files.create({
        resource: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
        },
        fields: 'id',
      });

      this.customersFolderId = createResponse.result.id;
      console.log(`Created Customers folder "${folderName}":`, this.customersFolderId);
      return this.customersFolderId;
    } catch (error) {
      console.error('Failed to get/create Customers folder:', error);
      throw error;
    }
  }

  /**
   * Create a folder in Google Drive
   */
  async createFolder(folderName, parentFolderId) {
    try {
      const response = await window.gapi.client.drive.files.create({
        resource: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentFolderId],
        },
        fields: 'id, name, webViewLink',
      });

      console.log(`Created folder "${folderName}":`, response.result.id);
      return response.result;
    } catch (error) {
      console.error(`Failed to create folder "${folderName}":`, error);
      throw error;
    }
  }

  /**
   * Delete a folder from Google Drive
   */
  async deleteFolder(folderId) {
    try {
      await window.gapi.client.drive.files.delete({
        fileId: folderId,
      });
      console.log(`Deleted folder: ${folderId}`);
      return true;
    } catch (error) {
      console.error('Failed to delete folder:', error);
      throw error;
    }
  }

  /**
   * Create customer folder structure
   * Returns the main customer folder info
   */
  async createCustomerFolderStructure(customerName, customerId) {
    try {
      console.log(`[DriveService] Creating folder structure for: ${customerName} (ID: ${customerId})`);

      console.log('[DriveService] Step 1: Getting/creating Customers folder...');
      const customersFolderId = await this.getOrCreateCustomersFolder();
      console.log('[DriveService] Customers folder ID:', customersFolderId);

      // Create main customer folder (just use customer name)
      const mainFolderName = customerName;
      console.log(`[DriveService] Step 2: Creating main folder "${mainFolderName}"...`);
      const mainFolder = await this.createFolder(mainFolderName, customersFolderId);
      console.log('[DriveService] Main folder created:', mainFolder);

      // Create subfolders
      const subfolders = ['NIRC', 'Test Drive', 'Other Documents', 'VSA', 'Trade In'];
      console.log(`[DriveService] Step 3: Creating ${subfolders.length} subfolders in parallel...`);
      const subfolderPromises = subfolders.map(subfolder =>
        this.createFolder(subfolder, mainFolder.id)
      );

      const createdSubfolders = await Promise.all(subfolderPromises);
      console.log(`[DriveService] All ${createdSubfolders.length} subfolders created successfully`);

      const result = {
        folderId: mainFolder.id,
        folderName: mainFolder.name,
        folderUrl: mainFolder.webViewLink,
      };

      console.log(`[DriveService] ✅ Folder structure complete for ${customerName}:`, result);
      return result;
    } catch (error) {
      console.error('[DriveService] ❌ Failed to create customer folder structure:', error);
      console.error('[DriveService] Error details:', {
        message: error.message,
        result: error.result,
        body: error.body,
      });
      throw error;
    }
  }

  /**
   * Get or create the root BYD CRM folder
   */
  async getOrCreateRootFolder() {
    if (this.rootFolderId) {
      return this.rootFolderId;
    }

    try {
      const folderName = CONFIG.FOLDER_NAMES.ROOT || 'BYD CRM';

      // Search for existing folder
      const response = await window.gapi.client.drive.files.list({
        q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive',
      });

      if (response.result.files && response.result.files.length > 0) {
        this.rootFolderId = response.result.files[0].id;
        console.log('Found existing root folder:', this.rootFolderId);
        return this.rootFolderId;
      }

      // Create new folder
      const createResponse = await window.gapi.client.drive.files.create({
        resource: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
        },
        fields: 'id',
      });

      this.rootFolderId = createResponse.result.id;
      console.log('Created root folder:', this.rootFolderId);
      return this.rootFolderId;
    } catch (error) {
      console.error('Failed to get/create root folder:', error);
      throw error;
    }
  }

  /**
   * Get or create customers.json file in Google Drive
   */
  async getOrCreateCustomersFile() {
    try {
      const folderId = await this.getOrCreateRootFolder();
      const fileName = CONFIG.DATA_FILE_NAMES.CUSTOMERS || 'customers.json';

      // Search for existing file
      const response = await window.gapi.client.drive.files.list({
        q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive',
      });

      if (response.result.files && response.result.files.length > 0) {
        this.customersFileId = response.result.files[0].id;
        console.log('Found existing customers file:', this.customersFileId);
        return this.customersFileId;
      }

      // Create new file with empty array
      const fileMetadata = {
        name: fileName,
        mimeType: 'application/json',
        parents: [folderId],
      };

      const fileContent = JSON.stringify([]);
      const file = new Blob([fileContent], { type: 'application/json' });

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
      form.append('file', file);

      const token = window.gapi.client.getToken().access_token;
      const uploadResponse = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: form,
        }
      );

      const result = await uploadResponse.json();
      this.customersFileId = result.id;
      console.log('Created customers file:', this.customersFileId);
      return this.customersFileId;
    } catch (error) {
      console.error('Failed to get/create customers file:', error);
      throw error;
    }
  }

  /**
   * Load customers from Google Drive
   */
  async loadCustomersFromDrive() {
    try {
      const fileId = await this.getOrCreateCustomersFile();

      const response = await window.gapi.client.drive.files.get({
        fileId: fileId,
        alt: 'media',
      });

      const customers = response.result || [];
      console.log('Loaded customers from Drive:', customers.length);
      return customers;
    } catch (error) {
      console.error('Failed to load customers from Drive:', error);
      // Return empty array if file doesn't exist or error occurs
      return [];
    }
  }

  /**
   * Save customers to Google Drive
   */
  async saveCustomersToDrive(customers) {
    try {
      const fileId = await this.getOrCreateCustomersFile();
      const fileContent = JSON.stringify(customers, null, 2);
      const file = new Blob([fileContent], { type: 'application/json' });

      const token = window.gapi.client.getToken().access_token;
      const response = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: file,
        }
      );

      if (response.ok) {
        console.log('Saved customers to Drive:', customers.length);
        return true;
      } else {
        throw new Error(`Failed to save: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to save customers to Drive:', error);
      throw error;
    }
  }

  /**
   * Sync customers: merge localStorage and Drive data
   */
  async syncCustomers(localCustomers) {
    try {
      // Load from Drive
      const driveCustomers = await this.loadCustomersFromDrive();

      // Merge: use Drive as source of truth, but keep local changes if newer
      const merged = this.mergeCustomers(localCustomers, driveCustomers);

      // Save merged data back to Drive
      await this.saveCustomersToDrive(merged);

      console.log('Customers synced successfully');
      return merged;
    } catch (error) {
      console.error('Failed to sync customers:', error);
      // Return local data if sync fails
      return localCustomers;
    }
  }

  /**
   * Merge local and drive customers
   * SIMPLIFIED: Merge field-by-field, preferring non-null values
   * This ensures folder IDs and other data aren't lost during sync
   */
  mergeCustomers(localCustomers, driveCustomers) {
    // Create maps for easy lookup
    const driveMap = new Map();
    driveCustomers.forEach(customer => {
      driveMap.set(customer.id, customer);
    });

    const localMap = new Map();
    localCustomers.forEach(customer => {
      localMap.set(customer.id, customer);
    });

    // Get all unique customer IDs
    const allIds = new Set([...driveMap.keys(), ...localMap.keys()]);

    // Merge each customer
    const merged = [];
    allIds.forEach(id => {
      const driveCustomer = driveMap.get(id);
      const localCustomer = localMap.get(id);

      // If only in one place, use that version
      if (!driveCustomer) {
        merged.push(localCustomer);
        return;
      }
      if (!localCustomer) {
        merged.push(driveCustomer);
        return;
      }

      // Both exist - merge field by field, preferring non-null/non-empty values
      const mergedCustomer = { ...driveCustomer };

      // For critical fields like folder IDs, prefer local if drive is null
      if (!mergedCustomer.driveFolderId && localCustomer.driveFolderId) {
        mergedCustomer.driveFolderId = localCustomer.driveFolderId;
      }
      if (!mergedCustomer.driveFolderLink && localCustomer.driveFolderLink) {
        mergedCustomer.driveFolderLink = localCustomer.driveFolderLink;
      }

      // Merge other fields - prefer local if drive is null/empty
      Object.keys(localCustomer).forEach(key => {
        if (key === 'id' || key === 'dateAdded') return; // Never overwrite these

        const localValue = localCustomer[key];
        const driveValue = mergedCustomer[key];

        // If drive doesn't have this field but local does, use local
        if ((driveValue === null || driveValue === undefined || driveValue === '') &&
            (localValue !== null && localValue !== undefined && localValue !== '')) {
          mergedCustomer[key] = localValue;
        }
      });

      merged.push(mergedCustomer);
    });

    return merged;
  }

  /**
   * Get or create forms.json file in Google Drive
   */
  async getOrCreateFormsFile() {
    try {
      const folderId = await this.getOrCreateRootFolder();
      const fileName = CONFIG.DATA_FILE_NAMES.FORMS || 'forms.json';

      // Search for existing file
      const response = await window.gapi.client.drive.files.list({
        q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive',
      });

      if (response.result.files && response.result.files.length > 0) {
        this.formsFileId = response.result.files[0].id;
        console.log('Found existing forms file:', this.formsFileId);
        return this.formsFileId;
      }

      // Create new file with empty object
      const fileMetadata = {
        name: fileName,
        mimeType: 'application/json',
        parents: [folderId],
      };

      const fileContent = JSON.stringify({});
      const file = new Blob([fileContent], { type: 'application/json' });

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
      form.append('file', file);

      const token = window.gapi.client.getToken().access_token;
      const uploadResponse = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: form,
        }
      );

      const result = await uploadResponse.json();
      this.formsFileId = result.id;
      console.log('Created forms file:', this.formsFileId);
      return this.formsFileId;
    } catch (error) {
      console.error('Failed to get/create forms file:', error);
      throw error;
    }
  }

  /**
   * Load form templates from Google Drive
   */
  async loadFormsFromDrive() {
    try {
      const fileId = await this.getOrCreateFormsFile();

      const response = await window.gapi.client.drive.files.get({
        fileId: fileId,
        alt: 'media',
      });

      const formTemplates = response.result || {};
      console.log('Loaded form templates from Drive:', Object.keys(formTemplates).length);
      return formTemplates;
    } catch (error) {
      console.error('Failed to load form templates from Drive:', error);
      return {};
    }
  }

  /**
   * Save form templates to Google Drive
   */
  async saveFormsToDrive(formTemplates) {
    try {
      const fileId = await this.getOrCreateFormsFile();
      const fileContent = JSON.stringify(formTemplates, null, 2);
      const file = new Blob([fileContent], { type: 'application/json' });

      const token = window.gapi.client.getToken().access_token;
      const response = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: file,
        }
      );

      if (response.ok) {
        console.log('Saved form templates to Drive:', Object.keys(formTemplates).length);
        return true;
      } else {
        throw new Error(`Failed to save forms: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to save form templates to Drive:', error);
      throw error;
    }
  }

  /**
   * Sync form templates: merge localStorage and Drive data
   */
  async syncForms(localForms) {
    try {
      const driveForms = await this.loadFormsFromDrive();

      // Merge: Drive is source of truth, add any local-only templates
      const merged = { ...driveForms };

      // Add local templates that don't exist in drive
      Object.keys(localForms).forEach(formType => {
        if (!merged[formType]) {
          merged[formType] = localForms[formType];
        }
      });

      // Save merged data back to Drive
      await this.saveFormsToDrive(merged);

      console.log('Form templates synced successfully');
      return merged;
    } catch (error) {
      console.error('Failed to sync form templates:', error);
      return localForms;
    }
  }

  /**
   * Get or create excel.json file in Google Drive
   */
  async getOrCreateExcelFile() {
    try {
      const folderId = await this.getOrCreateRootFolder();
      const fileName = CONFIG.DATA_FILE_NAMES.EXCEL || 'excel.json';

      // Search for existing file
      const response = await window.gapi.client.drive.files.list({
        q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive',
      });

      if (response.result.files && response.result.files.length > 0) {
        this.excelFileId = response.result.files[0].id;
        console.log('Found existing excel file:', this.excelFileId);
        return this.excelFileId;
      }

      // Create new file with empty object
      const fileMetadata = {
        name: fileName,
        mimeType: 'application/json',
        parents: [folderId],
      };

      const fileContent = JSON.stringify({});
      const file = new Blob([fileContent], { type: 'application/json' });

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
      form.append('file', file);

      const token = window.gapi.client.getToken().access_token;
      const uploadResponse = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: form,
        }
      );

      const result = await uploadResponse.json();
      this.excelFileId = result.id;
      console.log('Created excel file:', this.excelFileId);
      return this.excelFileId;
    } catch (error) {
      console.error('Failed to get/create excel file:', error);
      throw error;
    }
  }

  /**
   * Load Excel templates from Google Drive
   */
  async loadExcelFromDrive() {
    try {
      const fileId = await this.getOrCreateExcelFile();

      const response = await window.gapi.client.drive.files.get({
        fileId: fileId,
        alt: 'media',
      });

      const excelTemplates = response.result || {};
      console.log('Loaded Excel templates from Drive:', Object.keys(excelTemplates).length);
      return excelTemplates;
    } catch (error) {
      console.error('Failed to load Excel templates from Drive:', error);
      return {};
    }
  }

  /**
   * Save Excel templates to Google Drive
   */
  async saveExcelToDrive(excelTemplates) {
    try {
      const fileId = await this.getOrCreateExcelFile();
      const fileContent = JSON.stringify(excelTemplates, null, 2);
      const file = new Blob([fileContent], { type: 'application/json' });

      const token = window.gapi.client.getToken().access_token;
      const response = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: file,
        }
      );

      if (response.ok) {
        console.log('Saved Excel templates to Drive:', Object.keys(excelTemplates).length);
        return true;
      } else {
        throw new Error(`Failed to save Excel: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to save Excel templates to Drive:', error);
      throw error;
    }
  }

  /**
   * Sync Excel templates: merge localStorage and Drive data
   */
  async syncExcel(localExcel) {
    try {
      const driveExcel = await this.loadExcelFromDrive();

      // Merge: Drive is source of truth, add any local-only templates
      const merged = { ...driveExcel };

      // Add local templates that don't exist in drive
      Object.keys(localExcel).forEach(templateId => {
        if (!merged[templateId]) {
          merged[templateId] = localExcel[templateId];
        }
      });

      // Save merged data back to Drive
      await this.saveExcelToDrive(merged);

      console.log('Excel templates synced successfully');
      return merged;
    } catch (error) {
      console.error('Failed to sync Excel templates:', error);
      return localExcel;
    }
  }
}

// Create singleton instance
const driveService = new DriveService();

export default driveService;
