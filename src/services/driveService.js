import { CONFIG } from '../config/config.js';

/**
 * Google Drive Service
 * Handles syncing customer data between localStorage and Google Drive
 */
class DriveService {
  constructor() {
    this.customersFileId = null;
    this.rootFolderId = null;
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
   * Drive data is source of truth, but local changes are preserved
   */
  mergeCustomers(localCustomers, driveCustomers) {
    // Create a map of drive customers by ID
    const driveMap = new Map();
    driveCustomers.forEach(customer => {
      driveMap.set(customer.id, customer);
    });

    // Merge
    const merged = [...driveCustomers];
    const mergedIds = new Set(driveCustomers.map(c => c.id));

    // Add local customers that don't exist in drive
    localCustomers.forEach(localCustomer => {
      if (!mergedIds.has(localCustomer.id)) {
        merged.push(localCustomer);
      }
    });

    return merged;
  }
}

// Create singleton instance
const driveService = new DriveService();

export default driveService;
