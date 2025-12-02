/**
 * OneDrive Service
 *
 * Handles all file operations with Microsoft OneDrive via Microsoft Graph API.
 * This is the OneDrive equivalent of driveService.js for Google Drive.
 *
 * API Reference: https://docs.microsoft.com/graph/api/resources/onedrive
 */

import msAuthService from './msAuthService';
import { ONEDRIVE_FOLDER_NAMES, ONEDRIVE_DATA_FILES } from '../config/msalConfig';

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

class OneDriveService {
  constructor() {
    // Cache folder IDs to avoid repeated lookups
    this.folderIdCache = {};
    this.rootFolderId = null;
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  /**
   * Get authorization headers with current access token
   */
  async getHeaders(contentType = 'application/json') {
    const token = await msAuthService.getAccessToken();
    const headers = {
      Authorization: `Bearer ${token}`,
    };
    if (contentType) {
      headers['Content-Type'] = contentType;
    }
    return headers;
  }

  /**
   * Make authenticated request to Microsoft Graph API
   */
  async request(endpoint, options = {}) {
    const headers = await this.getHeaders(options.contentType);

    const response = await fetch(`${GRAPH_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    // Handle 204 No Content
    if (response.status === 204) {
      return null;
    }

    // Handle errors
    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;
      try {
        const error = await response.json();
        errorMessage = error.error?.message || errorMessage;
      } catch {
        // Ignore JSON parse errors
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  /**
   * Clear cached folder IDs
   */
  clearCache() {
    this.folderIdCache = {};
    this.rootFolderId = null;
    localStorage.removeItem('onedrive_folder_ids');
    console.log('OneDrive cache cleared');
  }

  // ============================================================
  // Folder Operations
  // ============================================================

  /**
   * Get or create a folder
   */
  async getOrCreateFolder(parentId, folderName) {
    const cacheKey = `${parentId}:${folderName}`;

    // Check cache first
    if (this.folderIdCache[cacheKey]) {
      return this.folderIdCache[cacheKey];
    }

    try {
      // Try to find existing folder
      const parentPath = parentId === 'root'
        ? '/me/drive/root/children'
        : `/me/drive/items/${parentId}/children`;

      const result = await this.request(`${parentPath}?$filter=name eq '${encodeURIComponent(folderName)}'`);

      if (result.value && result.value.length > 0) {
        const folder = result.value[0];
        this.folderIdCache[cacheKey] = folder;
        return folder;
      }

      // Create folder if not exists
      const newFolder = await this.createFolder(parentId, folderName);
      this.folderIdCache[cacheKey] = newFolder;
      return newFolder;
    } catch (error) {
      console.error(`Error getting/creating folder "${folderName}":`, error);
      throw error;
    }
  }

  /**
   * Create a new folder
   */
  async createFolder(parentId, folderName) {
    const parentPath = parentId === 'root'
      ? '/me/drive/root/children'
      : `/me/drive/items/${parentId}/children`;

    return this.request(parentPath, {
      method: 'POST',
      body: JSON.stringify({
        name: folderName,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'fail',
      }),
    });
  }

  /**
   * List items in a folder
   */
  async listFolder(folderId) {
    const path = folderId === 'root'
      ? '/me/drive/root/children'
      : `/me/drive/items/${folderId}/children`;

    const result = await this.request(path);
    return result.value || [];
  }

  /**
   * Find a folder by name within a parent folder
   */
  async findFolder(parentId, folderName) {
    const items = await this.listFolder(parentId);
    return items.find(item => item.folder && item.name === folderName);
  }

  /**
   * Get folder by ID
   */
  async getFolder(folderId) {
    return this.request(`/me/drive/items/${folderId}`);
  }

  /**
   * Delete a folder
   */
  async deleteFolder(folderId) {
    return this.request(`/me/drive/items/${folderId}`, {
      method: 'DELETE',
    });
  }

  // ============================================================
  // File Operations
  // ============================================================

  /**
   * Upload a file (for files < 4MB)
   */
  async uploadFile(folderId, fileName, content, contentType = 'application/json') {
    const path = `/me/drive/items/${folderId}:/${encodeURIComponent(fileName)}:/content`;
    const token = await msAuthService.getAccessToken();

    const body = contentType === 'application/json' && typeof content === 'object'
      ? JSON.stringify(content)
      : content;

    const response = await fetch(`${GRAPH_BASE_URL}${path}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': contentType,
      },
      body,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Upload failed');
    }

    return response.json();
  }

  /**
   * Upload file to root folder by path
   */
  async uploadFileToRoot(filePath, content, contentType = 'application/json') {
    const path = `/me/drive/root:/${encodeURIComponent(filePath)}:/content`;
    const token = await msAuthService.getAccessToken();

    const body = contentType === 'application/json' && typeof content === 'object'
      ? JSON.stringify(content)
      : content;

    const response = await fetch(`${GRAPH_BASE_URL}${path}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': contentType,
      },
      body,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Upload failed');
    }

    return response.json();
  }

  /**
   * Download file content (raw response)
   */
  async downloadFile(fileId) {
    const token = await msAuthService.getAccessToken();

    const response = await fetch(`${GRAPH_BASE_URL}/me/drive/items/${fileId}/content`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    return response;
  }

  /**
   * Download file as JSON
   */
  async downloadFileAsJson(fileId) {
    const response = await this.downloadFile(fileId);
    return response.json();
  }

  /**
   * Download file as text
   */
  async downloadFileAsText(fileId) {
    const response = await this.downloadFile(fileId);
    return response.text();
  }

  /**
   * Download file as Blob (for images/PDFs)
   */
  async downloadFileAsBlob(fileId) {
    const response = await this.downloadFile(fileId);
    return response.blob();
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(fileId) {
    return this.request(`/me/drive/items/${fileId}`);
  }

  /**
   * Update file content
   */
  async updateFile(fileId, content, contentType = 'application/json') {
    const token = await msAuthService.getAccessToken();

    const body = contentType === 'application/json' && typeof content === 'object'
      ? JSON.stringify(content)
      : content;

    const response = await fetch(`${GRAPH_BASE_URL}/me/drive/items/${fileId}/content`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': contentType,
      },
      body,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Update failed');
    }

    return response.json();
  }

  /**
   * Delete a file
   */
  async deleteFile(fileId) {
    return this.request(`/me/drive/items/${fileId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Rename a file or folder
   * @param {string} itemId - The file/folder ID to rename
   * @param {string} newName - The new name for the item
   */
  async renameFile(itemId, newName) {
    return this.request(`/me/drive/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: newName }),
    });
  }

  /**
   * Move a file or folder to a new parent
   * @param {string} itemId - The file/folder ID to move
   * @param {string} newParentId - The new parent folder ID
   */
  async moveFile(itemId, newParentId) {
    return this.request(`/me/drive/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        parentReference: { id: newParentId }
      }),
    });
  }

  /**
   * Validate folder ID exists
   * @param {string} folderId - The folder ID to validate
   * @returns {boolean} - True if folder exists, false otherwise
   */
  async validateFolderId(folderId) {
    try {
      await this.request(`/me/drive/items/${folderId}`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Batch validate multiple folder IDs efficiently
   * @param {string[]} folderIds - Array of folder IDs to validate
   * @returns {Map<string, boolean>} - Map of folderId -> isValid
   */
  async batchValidateFolderIds(folderIds) {
    const results = new Map();
    const uniqueIds = [...new Set(folderIds.filter(id => id && id !== 'root'))];

    // Validate in parallel with a concurrency limit
    const BATCH_SIZE = 5;
    for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
      const batch = uniqueIds.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (id) => {
          const isValid = await this.validateFolderId(id);
          return [id, isValid];
        })
      );
      batchResults.forEach(([id, isValid]) => results.set(id, isValid));
    }

    return results;
  }

  /**
   * Find file by name in a folder
   */
  async findFile(folderId, fileName) {
    const items = await this.listFolder(folderId);
    return items.find(item => !item.folder && item.name === fileName);
  }

  // ============================================================
  // Preview & Embed
  // ============================================================

  /**
   * Get preview URL for a file (for embedding in iframe)
   */
  async getPreviewUrl(fileId) {
    try {
      const result = await this.request(`/me/drive/items/${fileId}/preview`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      return result.getUrl;
    } catch (error) {
      console.error('Error getting preview URL:', error);
      return null;
    }
  }

  /**
   * Get thumbnail URL for an image
   */
  async getThumbnailUrl(fileId, size = 'medium') {
    try {
      const result = await this.request(`/me/drive/items/${fileId}/thumbnails`);
      if (result.value && result.value.length > 0) {
        return result.value[0][size]?.url;
      }
      return null;
    } catch (error) {
      console.error('Error getting thumbnail:', error);
      return null;
    }
  }

  /**
   * Create sharing link for a file
   * Note: Personal accounts only support 'anonymous' scope
   */
  async createSharingLink(fileId, type = 'view', scope = 'anonymous') {
    const result = await this.request(`/me/drive/items/${fileId}/createLink`, {
      method: 'POST',
      body: JSON.stringify({
        type, // 'view' or 'edit'
        scope, // 'anonymous' for personal accounts (organization not supported)
      }),
    });
    return result.link;
  }

  // ============================================================
  // Search
  // ============================================================

  /**
   * Search for files in OneDrive
   */
  async searchFiles(query) {
    const result = await this.request(`/me/drive/root/search(q='${encodeURIComponent(query)}')`);
    return result.value || [];
  }

  // ============================================================
  // CRM-Specific Methods (Matching Google Drive Structure)
  // ============================================================

  /**
   * Initialize CRM folder structure
   * Creates the same folder hierarchy as Google Drive
   */
  async initializeCrmStructure() {
    console.log('Initializing OneDrive CRM folder structure...');

    // Create root folder
    const rootFolder = await this.getOrCreateFolder('root', ONEDRIVE_FOLDER_NAMES.ROOT);
    this.rootFolderId = rootFolder.id;

    // Create subfolders
    const folderIds = {
      root: rootFolder.id,
    };

    const subfolders = [
      { key: 'customersData', name: ONEDRIVE_FOLDER_NAMES.CUSTOMERS_DATA },
      { key: 'forms', name: ONEDRIVE_FOLDER_NAMES.FORMS },
      { key: 'excelTemplates', name: ONEDRIVE_FOLDER_NAMES.EXCEL_TEMPLATES },
      { key: 'documentTemplates', name: ONEDRIVE_FOLDER_NAMES.DOCUMENT_TEMPLATES },
    ];

    for (const { key, name } of subfolders) {
      const folder = await this.getOrCreateFolder(rootFolder.id, name);
      folderIds[key] = folder.id;
    }

    // Cache folder IDs
    localStorage.setItem('onedrive_folder_ids', JSON.stringify(folderIds));
    console.log('OneDrive CRM folder structure initialized:', folderIds);

    return folderIds;
  }

  /**
   * Get cached folder IDs or initialize structure
   * @param {boolean} skipValidation - Skip validation for performance (use during warmup)
   */
  async getFolderIds(skipValidation = false) {
    const cached = localStorage.getItem('onedrive_folder_ids');
    if (cached) {
      try {
        const folderIds = JSON.parse(cached);

        // Skip validation if requested (for faster cold start)
        if (skipValidation) {
          return folderIds;
        }

        // Validate the root folder ID exists (quick check)
        if (folderIds.root) {
          const rootValid = await this.validateFolderId(folderIds.root);
          if (rootValid) {
            return folderIds;
          }
          console.warn('OneDrive: Cached root folder ID is invalid, reinitializing...');
        }
      } catch {
        // Invalid cache, re-initialize
      }
    }
    return this.initializeCrmStructure();
  }

  // ============================================================
  // Customer Data Operations
  // ============================================================

  /**
   * Save customer index
   */
  async saveCustomerIndex(indexData) {
    const folderIds = await this.getFolderIds();
    return this.uploadFile(
      folderIds.root,
      ONEDRIVE_DATA_FILES.CUSTOMERS_INDEX,
      indexData
    );
  }

  /**
   * Load customer index
   */
  async loadCustomerIndex() {
    const folderIds = await this.getFolderIds();
    const file = await this.findFile(folderIds.root, ONEDRIVE_DATA_FILES.CUSTOMERS_INDEX);

    if (!file) {
      return { customers: [], lastModified: null };
    }

    return this.downloadFileAsJson(file.id);
  }

  /**
   * Create customer folder
   */
  async createCustomerFolder(customerId) {
    const folderIds = await this.getFolderIds();
    return this.getOrCreateFolder(folderIds.customersData, customerId);
  }

  /**
   * Save customer data
   */
  async saveCustomer(customer) {
    const folderIds = await this.getFolderIds();

    // Create customer folder
    const customerFolder = await this.getOrCreateFolder(folderIds.customersData, customer.id);

    // Save customer.json
    await this.uploadFile(customerFolder.id, ONEDRIVE_DATA_FILES.CUSTOMER_DETAILS, customer);

    // Update customer index
    const index = await this.loadCustomerIndex();
    const existingIdx = index.customers?.findIndex(c => c.id === customer.id) ?? -1;

    const customerSummary = {
      id: customer.id,
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      lastModified: new Date().toISOString(),
      folderId: customerFolder.id,
    };

    if (existingIdx >= 0) {
      index.customers[existingIdx] = customerSummary;
    } else {
      index.customers = index.customers || [];
      index.customers.push(customerSummary);
    }

    index.lastModified = new Date().toISOString();
    await this.saveCustomerIndex(index);

    return customerFolder;
  }

  /**
   * Load customer data
   */
  async loadCustomer(customerId) {
    const folderIds = await this.getFolderIds();

    // Find customer folder
    const customerFolder = await this.findFolder(folderIds.customersData, customerId);
    if (!customerFolder) {
      return null;
    }

    // Load customer.json
    const customerFile = await this.findFile(customerFolder.id, ONEDRIVE_DATA_FILES.CUSTOMER_DETAILS);
    if (!customerFile) {
      return null;
    }

    return this.downloadFileAsJson(customerFile.id);
  }

  /**
   * Delete customer
   */
  async deleteCustomer(customerId) {
    const folderIds = await this.getFolderIds();

    // Delete customer folder
    const customerFolder = await this.findFolder(folderIds.customersData, customerId);
    if (customerFolder) {
      await this.deleteFolder(customerFolder.id);
    }

    // Update index
    const index = await this.loadCustomerIndex();
    index.customers = (index.customers || []).filter(c => c.id !== customerId);
    index.lastModified = new Date().toISOString();
    await this.saveCustomerIndex(index);
  }

  /**
   * Create document subfolder for customer
   */
  async createCustomerDocumentFolder(customerId, subfolderName) {
    const folderIds = await this.getFolderIds();
    const customerFolder = await this.getOrCreateFolder(folderIds.customersData, customerId);
    return this.getOrCreateFolder(customerFolder.id, subfolderName);
  }

  // ============================================================
  // Template Operations
  // ============================================================

  /**
   * Save form templates
   */
  async saveFormTemplates(templates) {
    const folderIds = await this.getFolderIds();
    return this.uploadFile(folderIds.root, ONEDRIVE_DATA_FILES.FORMS, templates);
  }

  /**
   * Load form templates
   */
  async loadFormTemplates() {
    const folderIds = await this.getFolderIds();
    const file = await this.findFile(folderIds.root, ONEDRIVE_DATA_FILES.FORMS);

    if (!file) {
      return { templates: {} };
    }

    return this.downloadFileAsJson(file.id);
  }

  /**
   * Save Excel templates
   */
  async saveExcelTemplates(templates) {
    const folderIds = await this.getFolderIds();
    return this.uploadFile(folderIds.root, ONEDRIVE_DATA_FILES.EXCEL, templates);
  }

  /**
   * Load Excel templates
   */
  async loadExcelTemplates() {
    const folderIds = await this.getFolderIds();
    const file = await this.findFile(folderIds.root, ONEDRIVE_DATA_FILES.EXCEL);

    if (!file) {
      return { templates: {} };
    }

    return this.downloadFileAsJson(file.id);
  }

  /**
   * Upload template file (PDF/image)
   */
  async uploadTemplateFile(folderKey, fileName, blob, mimeType) {
    const folderIds = await this.getFolderIds();
    const folderId = folderIds[folderKey] || folderIds.forms;

    const token = await msAuthService.getAccessToken();
    const path = `/me/drive/items/${folderId}:/${encodeURIComponent(fileName)}:/content`;

    const response = await fetch(`${GRAPH_BASE_URL}${path}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': mimeType,
      },
      body: blob,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Template upload failed');
    }

    return response.json();
  }

  // ============================================================
  // Image Operations (for document rendering)
  // ============================================================

  /**
   * Fetch image from OneDrive as blob
   * Used by documentRenderer for form templates
   */
  async fetchImageAsBlob(fileId) {
    return this.downloadFileAsBlob(fileId);
  }

  /**
   * List all images in a folder recursively
   */
  async listAllImagesRecursively(folderId) {
    const images = [];

    const processFolder = async (currentFolderId) => {
      const items = await this.listFolder(currentFolderId);

      for (const item of items) {
        if (item.folder) {
          // Recurse into subfolders
          await processFolder(item.id);
        } else if (item.file?.mimeType?.startsWith('image/')) {
          images.push(item);
        }
      }
    };

    await processFolder(folderId);
    return images;
  }

  // ============================================================
  // Compatibility Methods (matching Google Drive service API)
  // ============================================================

  /**
   * Create customer folder structure
   * Matches Google Drive service API
   * Only creates the main customer folder - subfolders are created on demand by other features
   */
  async createCustomerFolderStructure(customerName, customerId) {
    const folderIds = await this.getFolderIds();

    // Create customer folder using customer name
    // Sanitize name to remove characters not allowed in folder names
    const sanitizedName = (customerName || customerId)
      .replace(/[<>:"/\\|?*]/g, '') // Remove invalid characters
      .replace(/\s+/g, ' ')          // Normalize spaces
      .trim()
      || customerId;                 // Fallback to ID if name is empty
    const customerFolder = await this.getOrCreateFolder(folderIds.customersData, sanitizedName);

    // Subfolders (NIRC, Test Drive, etc.) are created on demand when needed

    return {
      folderId: customerFolder.id,
      folderUrl: customerFolder.webUrl || null,
    };
  }

  /**
   * Load customers index (alias for loadCustomerIndex)
   */
  async loadCustomersIndex() {
    const result = await this.loadCustomerIndex();
    // Return array format expected by stores
    return result.customers || [];
  }

  /**
   * Save customers index (alias for saveCustomerIndex)
   */
  async saveCustomersIndex(indexData) {
    return this.saveCustomerIndex({ customers: indexData, lastModified: new Date().toISOString() });
  }

  /**
   * Save customer data to folder
   */
  async saveCustomerData(customer, folderId) {
    return this.uploadFile(folderId, ONEDRIVE_DATA_FILES.CUSTOMER_DETAILS, customer);
  }

  /**
   * Load customer data from folder
   * @param {string} customerId - Customer ID for logging
   * @param {string} folderId - OneDrive folder ID containing customer data
   * @returns {Object|null} - Customer data or null if not found/error
   */
  async loadCustomerData(customerId, folderId) {
    // Handle missing folder ID
    if (!folderId) {
      console.warn(`loadCustomerData: No folder ID provided for customer ${customerId}`);
      return null;
    }

    try {
      // First validate the folder exists
      const folderExists = await this.validateFolderId(folderId);
      if (!folderExists) {
        console.warn(`loadCustomerData: Folder ${folderId} not found for customer ${customerId} - folder may have been deleted or moved`);
        // Return a special marker to indicate folder needs repair
        return { _folderNotFound: true, customerId, folderId };
      }

      const customerFile = await this.findFile(folderId, ONEDRIVE_DATA_FILES.CUSTOMER_DETAILS);
      if (!customerFile) {
        console.warn(`loadCustomerData: Customer file not found in folder ${folderId} for customer ${customerId}`);
        return null;
      }
      return this.downloadFileAsJson(customerFile.id);
    } catch (error) {
      // Check for 404 errors specifically
      if (error.message?.includes('404') || error.message?.includes('not found') || error.message?.includes('could not be found')) {
        console.warn(`loadCustomerData: 404 error for customer ${customerId}, folder ${folderId} - ${error.message}`);
        return { _folderNotFound: true, customerId, folderId };
      }
      console.error(`Failed to load customer data for ${customerId}:`, error);
      return null;
    }
  }

  /**
   * Check if migration is needed
   * For OneDrive, we don't need migration (fresh start)
   */
  async checkMigrationNeeded() {
    return false;
  }

  /**
   * Migrate to hybrid structure
   * For OneDrive, this is a no-op since we start fresh
   */
  async migrateToHybridStructure(customers) {
    return {
      success: true,
      customers,
      results: { migrated: 0, skipped: customers.length },
    };
  }

  /**
   * Repair customer folder references
   * Validates existing folder IDs and recreates folders for customers with invalid references
   * @param {Array} customers - Array of customer objects
   * @param {boolean} forceRescan - Force re-validation of all folder IDs
   * @returns {Object} - { customers: updatedCustomers, results: { repaired, failed, skipped } }
   */
  async repairCustomerFolderReferences(customers, forceRescan = false) {
    console.log('OneDrive: Repairing customer folder references...');
    const results = { repaired: 0, failed: 0, skipped: 0 };
    const updatedCustomers = [];

    // Collect folder IDs to validate
    const customerFolderIds = customers
      .filter(c => c.driveFolderId)
      .map(c => c.driveFolderId);

    // Batch validate all folder IDs
    const validationResults = await this.batchValidateFolderIds(customerFolderIds);

    for (const customer of customers) {
      // Skip customers without folder IDs - they'll be handled by createMissingCustomerFolders
      if (!customer.driveFolderId) {
        updatedCustomers.push(customer);
        results.skipped++;
        continue;
      }

      // Check if folder ID is valid
      const isValid = validationResults.get(customer.driveFolderId);

      if (isValid && !forceRescan) {
        // Folder exists, keep as is
        updatedCustomers.push(customer);
        results.skipped++;
        continue;
      }

      // Folder doesn't exist - recreate it
      try {
        console.log(`OneDrive: Recreating folder for customer ${customer.id} (${customer.name})`);
        const folderInfo = await this.createCustomerFolderStructure(customer.name, customer.id);

        // Save customer data to the new folder
        await this.saveCustomerData(customer, folderInfo.folderId);

        updatedCustomers.push({
          ...customer,
          driveFolderId: folderInfo.folderId,
          driveFolderLink: folderInfo.folderUrl,
        });
        results.repaired++;
        console.log(`OneDrive: Repaired folder for customer ${customer.id}`);
      } catch (error) {
        console.error(`OneDrive: Failed to repair folder for customer ${customer.id}:`, error);
        // Keep the customer but clear the invalid folder ID
        updatedCustomers.push({
          ...customer,
          driveFolderId: null,
          driveFolderLink: null,
        });
        results.failed++;
      }
    }

    console.log(`OneDrive: Repair complete - repaired: ${results.repaired}, failed: ${results.failed}, skipped: ${results.skipped}`);
    return { customers: updatedCustomers, results };
  }

  /**
   * Create missing customer folders
   * Stub for compatibility
   */
  async createMissingCustomerFolders(customers) {
    const updatedCustomers = [];
    let created = 0;
    const errors = [];

    for (const customer of customers) {
      if (!customer.driveFolderId) {
        try {
          const folderInfo = await this.createCustomerFolderStructure(customer.name, customer.id);
          updatedCustomers.push({
            ...customer,
            driveFolderId: folderInfo.folderId,
            driveFolderLink: folderInfo.folderUrl,
          });
          created++;
        } catch (error) {
          errors.push({ id: customer.id, error: error.message });
          updatedCustomers.push(customer);
        }
      } else {
        updatedCustomers.push(customer);
      }
    }

    return { customers: updatedCustomers, created, errors };
  }

  /**
   * Get or create document templates folder
   */
  async getOrCreateDocumentTemplatesFolder() {
    const folderIds = await this.getFolderIds();
    return { id: folderIds.documentTemplates };
  }

  /**
   * Save document templates to Drive
   */
  async saveDocumentTemplateToDrive(templates) {
    const folderIds = await this.getFolderIds();
    return this.uploadFile(folderIds.root, 'document_templates.json', templates);
  }

  /**
   * Load document templates from Drive
   */
  async loadDocumentTemplatesFromDrive() {
    const folderIds = await this.getFolderIds();
    const file = await this.findFile(folderIds.root, 'document_templates.json');

    if (!file) {
      return { templates: {} };
    }

    return this.downloadFileAsJson(file.id);
  }

  /**
   * Get or create Excel templates folder
   */
  async getOrCreateExcelTemplatesFolder() {
    const folderIds = await this.getFolderIds();
    return { id: folderIds.excelTemplates };
  }

  /**
   * Save Excel templates to Drive
   */
  async saveExcelTemplatesToDrive(templates) {
    return this.saveExcelTemplates(templates);
  }

  /**
   * Load Excel templates from Drive
   */
  async loadExcelTemplatesFromDrive() {
    return this.loadExcelTemplates();
  }

  /**
   * Upload file to Drive (generic method used by various stores)
   */
  async uploadFileToDrive(folderId, fileName, content, mimeType = 'application/json') {
    return this.uploadFile(folderId, fileName, content, mimeType);
  }

  /**
   * List files in folder (alias for listFolder)
   */
  async listFilesInFolder(folderId) {
    return this.listFolder(folderId);
  }

  // ============================================================
  // Sync Methods (Required by stores and syncCoordinator)
  // ============================================================

  /**
   * Warmup - preload and validate folder IDs
   * Called by syncCoordinator before sync operations
   * Validates that cached folder IDs are still valid, reinitializes if not
   */
  async warmup() {
    console.log('OneDrive warmup: preloading folder IDs...');

    // Get folder IDs with validation (will reinitialize if root folder is invalid)
    const folderIds = await this.getFolderIds(false); // false = validate

    // Validate all critical folder IDs exist
    const criticalFolders = ['root', 'customersData'];
    const foldersToValidate = criticalFolders
      .filter(key => folderIds[key])
      .map(key => folderIds[key]);

    const validationResults = await this.batchValidateFolderIds(foldersToValidate);
    const allValid = foldersToValidate.every(id => validationResults.get(id));

    if (!allValid) {
      console.warn('OneDrive warmup: Some critical folders are invalid, reinitializing...');
      this.clearCache();
      await this.initializeCrmStructure();
    }

    console.log('OneDrive warmup complete');
  }

  /**
   * Sync Excel templates with OneDrive
   * Merges local templates with Drive templates (Drive is source of truth)
   */
  async syncExcel(localTemplates) {
    try {
      // Load templates from Drive
      const driveData = await this.loadExcelTemplates();
      const driveTemplates = driveData.templates || {};

      // Merge: Drive templates override local, but keep local-only templates
      const merged = { ...localTemplates };

      // Add/update from Drive
      for (const [id, template] of Object.entries(driveTemplates)) {
        merged[id] = template;
      }

      // Save merged back to Drive
      await this.saveExcelTemplates(merged);

      return merged;
    } catch (error) {
      console.error('Error syncing Excel templates:', error);
      throw error;
    }
  }

  /**
   * Save Excel templates to Drive
   * Alias used by useExcelStore
   */
  async saveExcelToDrive(templates) {
    return this.saveExcelTemplates(templates);
  }

  /**
   * Sync document templates with OneDrive
   * Merges local templates with Drive templates (Drive is source of truth)
   */
  async syncDocumentTemplates(localTemplates) {
    try {
      // Load templates from Drive
      const driveData = await this.loadDocumentTemplatesFromDrive();
      const driveTemplates = driveData.templates || driveData || {};

      // Merge: Drive templates override local, but keep local-only templates
      const merged = { ...localTemplates };

      // Add/update from Drive
      for (const [id, template] of Object.entries(driveTemplates)) {
        merged[id] = template;
      }

      // Save merged back to Drive
      await this.saveDocumentTemplateToDrive(merged);

      return merged;
    } catch (error) {
      console.error('Error syncing document templates:', error);
      throw error;
    }
  }

  /**
   * Delete document template from Drive
   * Note: For OneDrive, we just update the templates file without the deleted template
   * The actual background file cleanup could be done separately if needed
   */
  async deleteDocumentTemplateFromDrive(templateId) {
    try {
      // Load current templates
      const driveData = await this.loadDocumentTemplatesFromDrive();
      const templates = driveData.templates || driveData || {};

      // Remove the template
      delete templates[templateId];

      // Save updated templates
      await this.saveDocumentTemplateToDrive(templates);

      return true;
    } catch (error) {
      console.error('Error deleting document template from Drive:', error);
      throw error;
    }
  }
}

// Create singleton instance
const oneDriveService = new OneDriveService();

export default oneDriveService;
