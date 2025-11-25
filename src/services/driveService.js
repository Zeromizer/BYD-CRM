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
    this.customersDataFolderId = null;
    this.formFilesFolderId = null;
  }

  /**
   * Get or create the Customers Data folder (new hybrid structure)
   * This folder contains both customer folders AND the index file
   */
  async getOrCreateCustomersDataFolder() {
    if (this.customersDataFolderId) {
      return this.customersDataFolderId;
    }

    try {
      const folderName = CONFIG.FOLDER_NAMES.CUSTOMERS_DATA || 'BYD Customers Data';

      // Search for existing folder in Drive root
      const response = await window.gapi.client.drive.files.list({
        q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive',
      });

      if (response.result.files && response.result.files.length > 0) {
        this.customersDataFolderId = response.result.files[0].id;
        console.log(`Found existing Customers Data folder "${folderName}":`, this.customersDataFolderId);
        return this.customersDataFolderId;
      }

      // Create new folder in Drive root
      const createResponse = await window.gapi.client.drive.files.create({
        resource: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
        },
        fields: 'id',
      });

      this.customersDataFolderId = createResponse.result.id;
      console.log(`Created Customers Data folder "${folderName}":`, this.customersDataFolderId);
      return this.customersDataFolderId;
    } catch (error) {
      console.error('Failed to get/create Customers Data folder:', error);
      throw error;
    }
  }

  /**
   * LEGACY: Get or create the old Customers folder
   * Kept for backward compatibility during migration
   */
  async getOrCreateCustomersFolder() {
    // Now points to the new structure
    return this.getOrCreateCustomersDataFolder();
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
   * Get or create the customers index file (lightweight listing)
   */
  async getOrCreateCustomersIndex() {
    try {
      const folderId = await this.getOrCreateCustomersDataFolder();
      const fileName = CONFIG.DATA_FILE_NAMES.CUSTOMERS_INDEX || 'customers_index.json';

      // Search for existing file
      const response = await window.gapi.client.drive.files.list({
        q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive',
      });

      if (response.result.files && response.result.files.length > 0) {
        const fileId = response.result.files[0].id;
        console.log('Found existing customers index:', fileId);
        return fileId;
      }

      // Create new index file with empty array
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
      console.log('Created customers index:', result.id);
      return result.id;
    } catch (error) {
      console.error('Failed to get/create customers index:', error);
      throw error;
    }
  }

  /**
   * Load customers index from Google Drive
   */
  async loadCustomersIndex() {
    try {
      const fileId = await this.getOrCreateCustomersIndex();

      const response = await window.gapi.client.drive.files.get({
        fileId: fileId,
        alt: 'media',
      });

      const index = response.result || [];
      console.log('Loaded customers index from Drive:', index.length, 'customers');
      return index;
    } catch (error) {
      console.error('Failed to load customers index:', error);
      return [];
    }
  }

  /**
   * Save customers index to Google Drive
   */
  async saveCustomersIndex(indexData) {
    try {
      const fileId = await this.getOrCreateCustomersIndex();
      const fileContent = JSON.stringify(indexData, null, 2);
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
        console.log('Saved customers index to Drive:', indexData.length, 'customers');
        return true;
      } else {
        throw new Error(`Failed to save index: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to save customers index:', error);
      throw error;
    }
  }

  /**
   * Load individual customer data from their folder
   */
  async loadCustomerData(customerId, customerFolderId) {
    try {
      const fileName = CONFIG.DATA_FILE_NAMES.CUSTOMER_DETAILS || 'customer.json';

      // Search for customer.json in the customer's folder
      const response = await window.gapi.client.drive.files.list({
        q: `name='${fileName}' and '${customerFolderId}' in parents and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive',
      });

      if (response.result.files && response.result.files.length > 0) {
        const fileId = response.result.files[0].id;

        // Load the file content
        const dataResponse = await window.gapi.client.drive.files.get({
          fileId: fileId,
          alt: 'media',
        });

        console.log(`Loaded customer data for ID ${customerId}`);
        return dataResponse.result;
      }

      console.log(`No customer.json found for customer ${customerId}`);
      return null;
    } catch (error) {
      console.error(`Failed to load customer data for ${customerId}:`, error);
      return null;
    }
  }

  /**
   * Save individual customer data to their folder
   */
  async saveCustomerData(customerData, customerFolderId) {
    try {
      const fileName = CONFIG.DATA_FILE_NAMES.CUSTOMER_DETAILS || 'customer.json';

      // Search for existing customer.json file
      const response = await window.gapi.client.drive.files.list({
        q: `name='${fileName}' and '${customerFolderId}' in parents and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive',
      });

      const fileContent = JSON.stringify(customerData, null, 2);
      const file = new Blob([fileContent], { type: 'application/json' });
      const token = window.gapi.client.getToken().access_token;

      if (response.result.files && response.result.files.length > 0) {
        // Update existing file
        const fileId = response.result.files[0].id;
        const updateResponse = await fetch(
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

        if (updateResponse.ok) {
          console.log(`Updated customer.json for ${customerData.name}`);
          return true;
        } else {
          throw new Error(`Failed to update: ${updateResponse.statusText}`);
        }
      } else {
        // Create new file
        const fileMetadata = {
          name: fileName,
          mimeType: 'application/json',
          parents: [customerFolderId],
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
        form.append('file', file);

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
        console.log(`Created customer.json for ${customerData.name}:`, result.id);
        return true;
      }
    } catch (error) {
      console.error(`Failed to save customer data for ${customerData.name}:`, error);
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
   * HYBRID SYNC: Sync using index + individual customer files
   * This is the new efficient sync method
   */
  async syncCustomersHybrid(localCustomers) {
    try {
      console.log('🔄 Starting hybrid sync...');

      // Load index from Drive
      const driveIndex = await this.loadCustomersIndex();
      console.log(`Loaded index with ${driveIndex.length} customers`);

      // Build index entries for local customers
      const localIndex = localCustomers.map(c => ({
        id: c.id,
        name: c.name,
        vsaNo: c.vsaNo,
        driveFolderId: c.driveFolderId,
        driveFolderLink: c.driveFolderLink,
        lastModified: c.lastModified || c.dateAdded || new Date().toISOString(),
      }));

      // Merge indices
      const mergedIndex = this.mergeIndices(localIndex, driveIndex);

      // Save merged index back to Drive
      await this.saveCustomersIndex(mergedIndex);

      // For full customer data, we'll load on-demand when needed
      // Return the index as lightweight customer list
      const lightweightCustomers = mergedIndex.map(indexEntry => {
        const localCustomer = localCustomers.find(c => c.id === indexEntry.id);
        return localCustomer || indexEntry;
      });

      console.log('✅ Hybrid sync complete');
      return lightweightCustomers;
    } catch (error) {
      console.error('Failed to sync customers (hybrid):', error);
      return localCustomers;
    }
  }

  /**
   * LEGACY: Sync customers using old centralized file method
   * Kept for backward compatibility during migration
   */
  async syncCustomers(localCustomers) {
    try {
      // Load from Drive
      const driveCustomers = await this.loadCustomersFromDrive();

      // Merge: use Drive as source of truth, but keep local changes if newer
      const merged = this.mergeCustomers(localCustomers, driveCustomers);

      // Save merged data back to Drive
      await this.saveCustomersToDrive(merged);

      console.log('Customers synced successfully (legacy method)');
      return merged;
    } catch (error) {
      console.error('Failed to sync customers:', error);
      // Return local data if sync fails
      return localCustomers;
    }
  }

  /**
   * Merge index entries from local and drive
   */
  mergeIndices(localIndex, driveIndex) {
    const driveMap = new Map();
    driveIndex.forEach(entry => {
      driveMap.set(entry.id, entry);
    });

    const localMap = new Map();
    localIndex.forEach(entry => {
      localMap.set(entry.id, entry);
    });

    // Get all unique customer IDs
    const allIds = new Set([...driveMap.keys(), ...localMap.keys()]);

    // Merge each entry
    const merged = [];
    allIds.forEach(id => {
      const driveEntry = driveMap.get(id);
      const localEntry = localMap.get(id);

      // If only in one place, use that version
      if (!driveEntry) {
        merged.push(localEntry);
        return;
      }
      if (!localEntry) {
        merged.push(driveEntry);
        return;
      }

      // Both exist - use the one with newer lastModified date
      const driveDate = new Date(driveEntry.lastModified || 0);
      const localDate = new Date(localEntry.lastModified || 0);

      if (localDate > driveDate) {
        merged.push(localEntry);
      } else {
        merged.push(driveEntry);
      }
    });

    return merged;
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
   * Get or create Form Files subfolder in the main BYD CRM folder
   * This is where actual PDF/image form files are stored
   */
  async getOrCreateFormFilesFolder() {
    if (this.formFilesFolderId) {
      return this.formFilesFolderId;
    }

    try {
      const parentFolderId = await this.getOrCreateRootFolder();
      const folderName = 'Form Files';

      // Search for existing folder
      const response = await window.gapi.client.drive.files.list({
        q: `name='${folderName}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive',
      });

      if (response.result.files && response.result.files.length > 0) {
        this.formFilesFolderId = response.result.files[0].id;
        console.log('Found existing Form Files folder:', this.formFilesFolderId);
        return this.formFilesFolderId;
      }

      // Create new folder
      const createResponse = await window.gapi.client.drive.files.create({
        resource: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentFolderId],
        },
        fields: 'id',
      });

      this.formFilesFolderId = createResponse.result.id;
      console.log('Created Form Files folder:', this.formFilesFolderId);
      return this.formFilesFolderId;
    } catch (error) {
      console.error('Failed to get/create Form Files folder:', error);
      throw error;
    }
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

  /**
   * Validate if a folder ID still exists in Google Drive and is in the correct location
   */
  async validateFolderId(folderId, checkParent = true) {
    if (!folderId) return false;

    try {
      const response = await window.gapi.client.drive.files.get({
        fileId: folderId,
        fields: 'id, name, trashed, parents'
      });

      const folder = response.result;

      // Check if folder is trashed
      if (folder.trashed) {
        console.log(`Folder ID ${folderId} is in trash`);
        return false;
      }

      // Optionally check if folder is in the correct parent (Customers folder)
      if (checkParent && folder.parents) {
        const customersFolderId = await this.getOrCreateCustomersFolder();
        const isInCorrectParent = folder.parents.includes(customersFolderId);

        if (!isInCorrectParent) {
          console.log(`Folder ID ${folderId} exists but is not in the Customers folder`);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.log(`Folder ID ${folderId} is invalid or deleted:`, error.message);
      return false;
    }
  }

  /**
   * Search for a customer folder by name in the Customers folder
   */
  async findCustomerFolderByName(customerName) {
    try {
      const customersFolderId = await this.getOrCreateCustomersFolder();

      // Search for folder with this name in the Customers folder
      const response = await window.gapi.client.drive.files.list({
        q: `name='${customerName.replace(/'/g, "\\'")}' and '${customersFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name, webViewLink)',
        spaces: 'drive',
      });

      if (response.result.files && response.result.files.length > 0) {
        const folder = response.result.files[0];
        console.log(`Found existing folder for "${customerName}":`, folder.id);
        return {
          folderId: folder.id,
          folderUrl: folder.webViewLink
        };
      }

      console.log(`No folder found for "${customerName}"`);
      return null;
    } catch (error) {
      console.error(`Error searching for folder "${customerName}":`, error);
      return null;
    }
  }

  /**
   * Repair customer folder references after folder deletion/restoration
   * This scans all customers and attempts to re-link them to their folders
   *
   * @param {Array} customers - Array of customer objects
   * @param {boolean} forceRescan - If true, skip validation and always search by name
   */
  async repairCustomerFolderReferences(customers, forceRescan = false) {
    console.log('🔧 Starting customer folder repair process...');
    console.log(`Found ${customers.length} customers to check`);
    console.log(`Mode: ${forceRescan ? 'FORCE RE-SCAN (searching all by name)' : 'Smart repair (validate first)'}`);

    const results = {
      total: customers.length,
      validated: 0,
      repaired: 0,
      notFound: 0,
      created: 0,
      errors: 0,
      details: []
    };

    for (let i = 0; i < customers.length; i++) {
      const customer = customers[i];
      const customerName = customer.name || 'Unnamed Customer';

      console.log(`\n[${i + 1}/${customers.length}] Checking: ${customerName} (ID: ${customer.id})`);

      try {
        let shouldSearchByName = false;

        // Check if customer has a folder ID and we're not forcing a re-scan
        if (customer.driveFolderId && !forceRescan) {
          console.log(`  Current folder ID: ${customer.driveFolderId}`);

          // Validate if the folder still exists and is in the correct location
          const isValid = await this.validateFolderId(customer.driveFolderId, true);

          if (isValid) {
            console.log(`  ✅ Folder ID is valid and in correct location - no repair needed`);
            results.validated++;
            results.details.push({
              customer: customerName,
              status: 'valid',
              folderId: customer.driveFolderId
            });
            continue;
          } else {
            console.log(`  ❌ Folder ID is invalid or misplaced - searching for folder...`);
            shouldSearchByName = true;
          }
        } else if (forceRescan && customer.driveFolderId) {
          console.log(`  🔄 Force re-scan mode - ignoring existing folder ID: ${customer.driveFolderId}`);
          shouldSearchByName = true;
        } else {
          console.log(`  ⚠️ No folder ID - searching for folder...`);
          shouldSearchByName = true;
        }

        // Search for the folder by name if needed
        if (shouldSearchByName) {
          const oldFolderId = customer.driveFolderId;
          const folderInfo = await this.findCustomerFolderByName(customerName);

          if (folderInfo) {
            // Update customer with found folder
            customer.driveFolderId = folderInfo.folderId;
            customer.driveFolderLink = folderInfo.folderUrl;
            console.log(`  ✅ Repaired! ${oldFolderId ? `Old: ${oldFolderId} → ` : ''}New: ${folderInfo.folderId}`);
            results.repaired++;
            results.details.push({
              customer: customerName,
              status: 'repaired',
              oldId: oldFolderId,
              newId: folderInfo.folderId
            });
          } else {
            // Folder not found - offer to create
            console.log(`  ⚠️ Folder not found for "${customerName}"`);
            results.notFound++;
            results.details.push({
              customer: customerName,
              status: 'not_found',
              message: 'Folder not found in Drive'
            });
          }
        }
      } catch (error) {
        console.error(`  ❌ Error processing ${customerName}:`, error);
        results.errors++;
        results.details.push({
          customer: customerName,
          status: 'error',
          error: error.message
        });
      }
    }

    console.log('\n🔧 Repair process complete!');
    console.log(`✅ Valid: ${results.validated}`);
    console.log(`🔧 Repaired: ${results.repaired}`);
    console.log(`⚠️ Not found: ${results.notFound}`);
    console.log(`❌ Errors: ${results.errors}`);

    return {
      customers,
      results
    };
  }

  /**
   * MIGRATION: Migrate from old centralized structure to new hybrid structure
   * This will:
   * 1. Create "BYD Customers Data" folder if it doesn't exist
   * 2. Move/verify all customer folders are in this new folder
   * 3. Create customer.json in each customer folder
   * 4. Create customers_index.json
   * 5. Clean up old customers.json file (optional)
   */
  async migrateToHybridStructure(customers) {
    console.log('🚀 Starting migration to hybrid structure...');
    console.log(`Found ${customers.length} customers to migrate`);

    const results = {
      total: customers.length,
      foldersCreated: 0,
      foldersMoved: 0,
      customerFilesCreated: 0,
      indexCreated: false,
      errors: [],
      details: [],
    };

    try {
      // Step 1: Create/get the new "BYD Customers Data" folder
      console.log('\n📁 Step 1: Creating "BYD Customers Data" folder...');
      const customersDataFolderId = await this.getOrCreateCustomersDataFolder();
      console.log(`✅ Folder ID: ${customersDataFolderId}`);

      // Step 2: Process each customer
      console.log('\n📋 Step 2: Processing customers...');
      for (let i = 0; i < customers.length; i++) {
        const customer = customers[i];
        const customerName = customer.name || 'Unnamed Customer';

        console.log(`\n[${i + 1}/${customers.length}] Processing: ${customerName}`);

        try {
          let customerFolderId = customer.driveFolderId;

          // Check if customer has a folder
          if (!customerFolderId) {
            console.log(`  ⚠️ No folder ID - creating new folder...`);
            const folderInfo = await this.createCustomerFolderStructure(customerName, customer.id);
            customerFolderId = folderInfo.folderId;
            customer.driveFolderId = folderInfo.folderId;
            customer.driveFolderLink = folderInfo.folderUrl;
            results.foldersCreated++;
            console.log(`  ✅ Created folder: ${customerFolderId}`);
          } else {
            // Verify folder exists and check its parent
            console.log(`  🔍 Verifying folder: ${customerFolderId}`);
            const folderResponse = await window.gapi.client.drive.files.get({
              fileId: customerFolderId,
              fields: 'id, name, parents, webViewLink, trashed',
            });

            const folder = folderResponse.result;

            if (folder.trashed) {
              console.log(`  ⚠️ Folder is in trash - creating new folder...`);
              const folderInfo = await this.createCustomerFolderStructure(customerName, customer.id);
              customerFolderId = folderInfo.folderId;
              customer.driveFolderId = folderInfo.folderId;
              customer.driveFolderLink = folderInfo.folderUrl;
              results.foldersCreated++;
            } else {
              // Check if folder is in correct parent
              const currentParent = folder.parents?.[0];
              if (currentParent !== customersDataFolderId) {
                console.log(`  📦 Moving folder to "BYD Customers Data"...`);
                // Move folder to new parent
                await window.gapi.client.drive.files.update({
                  fileId: customerFolderId,
                  addParents: customersDataFolderId,
                  removeParents: currentParent,
                  fields: 'id, parents',
                });
                results.foldersMoved++;
                console.log(`  ✅ Moved folder from ${currentParent} to ${customersDataFolderId}`);
              } else {
                console.log(`  ✅ Folder already in correct location`);
              }
            }
          }

          // Step 3: Create customer.json in the folder
          console.log(`  📝 Creating customer.json...`);
          await this.saveCustomerData(customer, customerFolderId);
          results.customerFilesCreated++;
          console.log(`  ✅ Created customer.json`);

          results.details.push({
            customer: customerName,
            status: 'success',
            folderId: customerFolderId,
          });

        } catch (error) {
          console.error(`  ❌ Error processing ${customerName}:`, error);
          results.errors.push({
            customer: customerName,
            error: error.message,
          });
          results.details.push({
            customer: customerName,
            status: 'error',
            error: error.message,
          });
        }
      }

      // Step 4: Create customers_index.json
      console.log('\n📇 Step 3: Creating customers index...');
      const indexData = customers.map(c => ({
        id: c.id,
        name: c.name,
        vsaNo: c.vsaNo,
        driveFolderId: c.driveFolderId,
        driveFolderLink: c.driveFolderLink,
        lastModified: new Date().toISOString(),
      }));

      await this.saveCustomersIndex(indexData);
      results.indexCreated = true;
      console.log(`✅ Created index with ${indexData.length} entries`);

      // Summary
      console.log('\n🎉 Migration complete!');
      console.log(`✅ Folders created: ${results.foldersCreated}`);
      console.log(`📦 Folders moved: ${results.foldersMoved}`);
      console.log(`📝 Customer files created: ${results.customerFilesCreated}`);
      console.log(`📇 Index created: ${results.indexCreated ? 'Yes' : 'No'}`);
      console.log(`❌ Errors: ${results.errors.length}`);

      return {
        success: true,
        customers,
        results,
      };

    } catch (error) {
      console.error('❌ Migration failed:', error);
      results.errors.push({
        customer: 'MIGRATION',
        error: error.message,
      });
      return {
        success: false,
        customers,
        results,
        error: error.message,
      };
    }
  }

  /**
   * Check if migration is needed
   * Returns true if old structure is detected
   */
  async checkMigrationNeeded() {
    try {
      // Check if new folder exists
      const newFolderName = CONFIG.FOLDER_NAMES.CUSTOMERS_DATA || 'BYD Customers Data';
      const response = await window.gapi.client.drive.files.list({
        q: `name='${newFolderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive',
      });

      if (response.result.files && response.result.files.length > 0) {
        // New folder exists - check if index exists
        const folderId = response.result.files[0].id;
        const indexName = CONFIG.DATA_FILE_NAMES.CUSTOMERS_INDEX || 'customers_index.json';

        const indexResponse = await window.gapi.client.drive.files.list({
          q: `name='${indexName}' and '${folderId}' in parents and trashed=false`,
          fields: 'files(id, name)',
          spaces: 'drive',
        });

        if (indexResponse.result.files && indexResponse.result.files.length > 0) {
          console.log('✅ Hybrid structure detected - no migration needed');
          return false;
        } else {
          console.log('⚠️ New folder exists but no index - migration recommended');
          return true;
        }
      }

      console.log('⚠️ New folder structure not found - migration needed');
      return true;
    } catch (error) {
      console.error('Error checking migration status:', error);
      return true; // Assume migration needed on error
    }
  }

  /**
   * Create missing folders for customers that don't have them
   */
  async createMissingCustomerFolders(customers) {
    console.log('📁 Creating missing customer folders...');

    let created = 0;
    const errors = [];

    for (const customer of customers) {
      if (!customer.driveFolderId) {
        try {
          console.log(`Creating folder for: ${customer.name}`);
          const folderInfo = await this.createCustomerFolderStructure(
            customer.name,
            customer.id
          );

          customer.driveFolderId = folderInfo.folderId;
          customer.driveFolderLink = folderInfo.folderUrl;
          created++;
          console.log(`✅ Created folder for ${customer.name}`);
        } catch (error) {
          console.error(`❌ Failed to create folder for ${customer.name}:`, error);
          errors.push({
            customer: customer.name,
            error: error.message
          });
        }
      }
    }

    console.log(`\n📁 Created ${created} new folders`);
    if (errors.length > 0) {
      console.log(`❌ ${errors.length} errors occurred`);
    }

    return {
      customers,
      created,
      errors
    };
  }
}

// Create singleton instance
const driveService = new DriveService();

export default driveService;
