/**
 * OneDrive Service
 *
 * Handles all file operations with Microsoft OneDrive via Microsoft Graph API.
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

    // OPTIMIZATION: Index caching to avoid repeated API calls
    this.indexCache = null;
    this.indexCacheExpiry = null;
    this.INDEX_CACHE_TTL = 30000; // 30 seconds cache TTL

    // OPTIMIZATION: Request deduplication - prevent concurrent identical requests
    this.pendingRequests = new Map();

    // OPTIMIZATION: Track warmup state to skip validation on subsequent syncs
    this.hasWarmedUp = false;
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
   * Clear cached folder IDs and other caches
   */
  clearCache() {
    this.folderIdCache = {};
    this.rootFolderId = null;
    this.indexCache = null;
    this.indexCacheExpiry = null;
    this.hasWarmedUp = false;
    this.pendingRequests.clear();
    localStorage.removeItem('onedrive_folder_ids');
    console.log('OneDrive cache cleared');
  }

  /**
   * OPTIMIZATION: Deduplicated request - prevents concurrent identical API calls
   * If a request to the same endpoint is already in progress, returns the same promise
   */
  async deduplicatedRequest(endpoint, options = {}) {
    // Only deduplicate GET requests (reads)
    const isReadRequest = !options.method || options.method === 'GET';
    const cacheKey = isReadRequest ? endpoint : null;

    if (cacheKey && this.pendingRequests.has(cacheKey)) {
      // Return existing promise for identical concurrent request
      return this.pendingRequests.get(cacheKey);
    }

    const requestPromise = this.request(endpoint, options).finally(() => {
      if (cacheKey) {
        this.pendingRequests.delete(cacheKey);
      }
    });

    if (cacheKey) {
      this.pendingRequests.set(cacheKey, requestPromise);
    }

    return requestPromise;
  }

  // ============================================================
  // Folder Operations
  // ============================================================

  /**
   * Get or create a folder
   * Returns the folder ID string for consistency with Google Drive service
   *
   * @param {string} folderName - The name of the folder to get or create
   * @param {string} parentFolderId - The parent folder ID (defaults to 'root')
   * @returns {string} - The folder ID
   */
  async getOrCreateFolder(folderName, parentFolderId = 'root') {
    const cacheKey = `${parentFolderId}:${folderName}`;

    // Check cache first
    if (this.folderIdCache[cacheKey]) {
      // Return just the ID for consistency with Google Drive
      const cached = this.folderIdCache[cacheKey];
      return typeof cached === 'string' ? cached : cached.id;
    }

    try {
      // Try to find existing folder
      const parentPath = parentFolderId === 'root'
        ? '/me/drive/root/children'
        : `/me/drive/items/${parentFolderId}/children`;

      const result = await this.request(`${parentPath}?$filter=name eq '${encodeURIComponent(folderName)}'`);

      if (result.value && result.value.length > 0) {
        const folder = result.value[0];
        this.folderIdCache[cacheKey] = folder.id;
        return folder.id;
      }

      // Create folder if not exists
      const newFolder = await this.createFolder(parentFolderId, folderName);
      this.folderIdCache[cacheKey] = newFolder.id;
      return newFolder.id;
    } catch (error) {
      console.error(`Error getting/creating folder "${folderName}":`, error);
      throw error;
    }
  }

  /**
   * Get or create a folder with full details (including webUrl)
   * OPTIMIZED: Avoids extra API call by returning creation response directly
   *
   * @param {string} folderName - The name of the folder to get or create
   * @param {string} parentFolderId - The parent folder ID (defaults to 'root')
   * @returns {Object} - { id: string, webUrl: string|null }
   */
  async getOrCreateFolderWithDetails(folderName, parentFolderId = 'root') {
    const cacheKey = `${parentFolderId}:${folderName}`;

    // Check cache for full details
    if (this.folderIdCache[cacheKey] && typeof this.folderIdCache[cacheKey] === 'object') {
      return this.folderIdCache[cacheKey];
    }

    try {
      // Try to find existing folder
      const parentPath = parentFolderId === 'root'
        ? '/me/drive/root/children'
        : `/me/drive/items/${parentFolderId}/children`;

      const result = await this.request(`${parentPath}?$filter=name eq '${encodeURIComponent(folderName)}'`);

      if (result.value && result.value.length > 0) {
        const folder = result.value[0];
        const folderDetails = { id: folder.id, webUrl: folder.webUrl || null };
        this.folderIdCache[cacheKey] = folderDetails;
        return folderDetails;
      }

      // Create folder if not exists - response includes webUrl
      const newFolder = await this.createFolder(parentFolderId, folderName);
      const folderDetails = { id: newFolder.id, webUrl: newFolder.webUrl || null };
      this.folderIdCache[cacheKey] = folderDetails;
      return folderDetails;
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
    // Validate fileId before making request
    if (!fileId || typeof fileId !== 'string' || fileId.trim() === '') {
      throw new Error('Invalid file ID. The file reference may be corrupted.');
    }

    const token = await msAuthService.getAccessToken();

    const response = await fetch(`${GRAPH_BASE_URL}/me/drive/items/${fileId}/content`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 400 || response.status === 404) {
        throw new Error(`File not found in OneDrive (${response.status}). The file may have been deleted or moved. Please re-upload the template.`);
      }
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

    // OPTIMIZATION: Increased batch size from 5 to 15 for faster validation
    // Microsoft Graph API handles concurrent requests well
    const BATCH_SIZE = 15;
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
   * Get direct edit URL for a file (opens in Office Online for editing)
   * For Excel files, this opens directly in Excel Online
   * @param {string} fileId - The file ID
   * @returns {string|null} - The edit URL or null if not available
   */
  async getEditUrl(fileId) {
    try {
      // Get file metadata which includes webUrl for direct editing
      const fileMetadata = await this.request(`/me/drive/items/${fileId}`);

      // The webUrl opens the file directly in the appropriate Office Online app
      if (fileMetadata.webUrl) {
        return fileMetadata.webUrl;
      }

      // Fallback: Create an edit sharing link
      const link = await this.createSharingLink(fileId, 'edit');
      return link?.webUrl || null;
    } catch (error) {
      console.error('Error getting edit URL:', error);
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
    const rootFolderId = await this.getOrCreateFolder(ONEDRIVE_FOLDER_NAMES.ROOT, 'root');
    this.rootFolderId = rootFolderId;

    // Create subfolders
    const folderIds = {
      root: rootFolderId,
    };

    const subfolders = [
      { key: 'customersData', name: ONEDRIVE_FOLDER_NAMES.CUSTOMERS_DATA },
      { key: 'forms', name: ONEDRIVE_FOLDER_NAMES.FORMS },
      { key: 'excelTemplates', name: ONEDRIVE_FOLDER_NAMES.EXCEL_TEMPLATES },
      { key: 'documentTemplates', name: ONEDRIVE_FOLDER_NAMES.DOCUMENT_TEMPLATES },
    ];

    for (const { key, name } of subfolders) {
      const folderId = await this.getOrCreateFolder(name, rootFolderId);
      folderIds[key] = folderId;
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
   * OPTIMIZATION: Invalidates index cache after save
   */
  async saveCustomerIndex(indexData) {
    const folderIds = await this.getFolderIds();
    const result = await this.uploadFile(
      folderIds.root,
      ONEDRIVE_DATA_FILES.CUSTOMERS_INDEX,
      indexData
    );

    // Update cache with new data
    this.indexCache = indexData;
    this.indexCacheExpiry = Date.now() + this.INDEX_CACHE_TTL;

    return result;
  }

  /**
   * Load customer index
   * OPTIMIZATION: Returns cached index if available and not expired
   */
  async loadCustomerIndex() {
    // Check cache first
    if (this.indexCache && this.indexCacheExpiry && Date.now() < this.indexCacheExpiry) {
      return this.indexCache;
    }

    const folderIds = await this.getFolderIds();
    const file = await this.findFile(folderIds.root, ONEDRIVE_DATA_FILES.CUSTOMERS_INDEX);

    if (!file) {
      const emptyIndex = { customers: [], lastModified: null };
      this.indexCache = emptyIndex;
      this.indexCacheExpiry = Date.now() + this.INDEX_CACHE_TTL;
      return emptyIndex;
    }

    const index = await this.downloadFileAsJson(file.id);

    // Cache the result
    this.indexCache = index;
    this.indexCacheExpiry = Date.now() + this.INDEX_CACHE_TTL;

    return index;
  }

  /**
   * Invalidate index cache (call when external changes might have occurred)
   */
  invalidateIndexCache() {
    this.indexCache = null;
    this.indexCacheExpiry = null;
  }

  /**
   * Create customer folder
   */
  async createCustomerFolder(customerId) {
    const folderIds = await this.getFolderIds();
    return this.getOrCreateFolder(customerId, folderIds.customersData);
  }

  /**
   * Save customer data
   */
  async saveCustomer(customer) {
    const folderIds = await this.getFolderIds();

    // Create customer folder
    const customerFolderId = await this.getOrCreateFolder(customer.id, folderIds.customersData);

    // Save customer.json
    await this.uploadFile(customerFolderId, ONEDRIVE_DATA_FILES.CUSTOMER_DETAILS, customer);

    // Update customer index
    const index = await this.loadCustomerIndex();
    const existingIdx = index.customers?.findIndex(c => c.id === customer.id) ?? -1;

    const customerSummary = {
      id: customer.id,
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      lastModified: new Date().toISOString(),
      folderId: customerFolderId,
    };

    if (existingIdx >= 0) {
      index.customers[existingIdx] = customerSummary;
    } else {
      index.customers = index.customers || [];
      index.customers.push(customerSummary);
    }

    index.lastModified = new Date().toISOString();
    await this.saveCustomerIndex(index);

    return { id: customerFolderId };
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
    const customerFolderId = await this.getOrCreateFolder(customerId, folderIds.customersData);
    return this.getOrCreateFolder(subfolderName, customerFolderId);
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
   * IMPORTANT: Saves in { templates: {...} } format for consistency with loadExcelTemplates
   */
  async saveExcelTemplates(templates) {
    const folderIds = await this.getFolderIds();
    // Wrap in { templates: {...} } format if not already wrapped
    const dataToSave = templates && typeof templates === 'object' && !templates.templates
      ? { templates, lastModified: new Date().toISOString() }
      : { ...templates, lastModified: new Date().toISOString() };
    return this.uploadFile(folderIds.root, ONEDRIVE_DATA_FILES.EXCEL, dataToSave);
  }

  /**
   * Load Excel templates
   * Always returns { templates: {...} } format for consistency
   */
  async loadExcelTemplates() {
    const folderIds = await this.getFolderIds();
    const file = await this.findFile(folderIds.root, ONEDRIVE_DATA_FILES.EXCEL);

    if (!file) {
      return { templates: {} };
    }

    const data = await this.downloadFileAsJson(file.id);

    // Handle legacy format where templates were saved without wrapper
    if (data && typeof data === 'object') {
      // If data already has templates property, return as-is
      if (data.templates) {
        return data;
      }
      // If data is the templates object itself (legacy format), wrap it
      // Check if it looks like a templates object (has template entries)
      const keys = Object.keys(data);
      const looksLikeTemplates = keys.length > 0 && keys.some(k =>
        data[k]?.name || data[k]?.fieldMappings || data[k]?.masterFileId
      );
      if (looksLikeTemplates) {
        return { templates: data };
      }
    }

    return data || { templates: {} };
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

  /**
   * Upload an image to a folder from base64 data
   * Used for ID photo uploads in CustomerList
   *
   * @param {string} base64Data - The base64 encoded image data (without data URL prefix)
   * @param {string} filename - The filename for the image
   * @param {string} folderId - The target folder ID
   * @param {string} mimeType - The MIME type (default: 'image/jpeg')
   * @returns {Object} - The uploaded file metadata
   */
  async uploadImageToFolder(base64Data, filename, folderId, mimeType = 'image/jpeg') {
    try {
      // Convert base64 to Blob
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });

      // Upload using the existing uploadFileToFolder method
      const fileId = await this.uploadFileToFolder(filename, blob, folderId);

      return { id: fileId, name: filename };
    } catch (error) {
      console.error('Error uploading image to folder:', error);
      throw error;
    }
  }

  // ============================================================
  // Compatibility Methods (matching Google Drive service API)
  // ============================================================

  /**
   * Create customer folder structure
   * Matches Google Drive service API
   * Only creates the main customer folder - subfolders are created on demand by other features
   * OPTIMIZED: Uses getOrCreateFolderWithDetails to avoid extra getFolder() API call
   */
  async createCustomerFolderStructure(customerName, customerId) {
    const folderIds = await this.getFolderIds(true); // Skip validation for speed

    // Create customer folder using customer name
    // Sanitize name to remove characters not allowed in folder names
    const sanitizedName = (customerName || customerId)
      .replace(/[<>:"/\\|?*]/g, '') // Remove invalid characters
      .replace(/\s+/g, ' ')          // Normalize spaces
      .trim()
      || customerId;                 // Fallback to ID if name is empty

    // OPTIMIZED: Get folder ID and webUrl in one call (no extra getFolder() needed)
    const folderDetails = await this.getOrCreateFolderWithDetails(sanitizedName, folderIds.customersData);

    // Subfolders (NIRC, Test Drive, etc.) are created on demand when needed

    return {
      folderId: folderDetails.id,
      folderUrl: folderDetails.webUrl,
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
   * Search for a customer folder by name in the Customers Data folder
   * @param {string} customerName - The customer name to search for
   * @returns {Object|null} - { folderId, folderUrl } or null if not found
   */
  async findCustomerFolderByName(customerName) {
    try {
      const folderIds = await this.getFolderIds();
      const customersDataFolderId = folderIds.customersData;

      if (!customersDataFolderId) {
        console.warn('OneDrive: Customers data folder not found');
        return null;
      }

      // List all folders in the customers data folder
      const items = await this.listFolder(customersDataFolderId);

      // Search for folder with matching name (case-insensitive)
      const normalizedSearchName = customerName.toLowerCase().trim();
      const matchingFolder = items.find(item =>
        item.folder && item.name.toLowerCase().trim() === normalizedSearchName
      );

      if (matchingFolder) {
        console.log(`OneDrive: Found existing folder for "${customerName}":`, matchingFolder.id);
        return {
          folderId: matchingFolder.id,
          folderUrl: matchingFolder.webUrl || null,
        };
      }

      console.log(`OneDrive: No folder found for "${customerName}"`);
      return null;
    } catch (error) {
      console.error(`OneDrive: Error searching for folder "${customerName}":`, error);
      return null;
    }
  }

  /**
   * Import customers from OneDrive folders
   * Scans the BYD Customers Data folder and reads customer.json from each subfolder
   * @returns {Object} - { customers: Array, imported: number, errors: Array }
   */
  async importCustomersFromFolders() {
    console.log('OneDrive: Importing customers from folders...');
    const customers = [];
    const errors = [];
    let imported = 0;

    try {
      const folderIds = await this.getFolderIds();
      const customersDataFolderId = folderIds.customersData;

      if (!customersDataFolderId) {
        throw new Error('Customers data folder not found');
      }

      // List all folders in the customers data folder
      const items = await this.listFolder(customersDataFolderId);
      const customerFolders = items.filter(item => item.folder);

      console.log(`OneDrive: Found ${customerFolders.length} customer folders`);

      // Process each folder
      for (const folder of customerFolders) {
        try {
          // Try to find and read customer.json
          const customerFile = await this.findFile(folder.id, ONEDRIVE_DATA_FILES.CUSTOMER_DETAILS);

          if (customerFile) {
            const customerData = await this.downloadFileAsJson(customerFile.id);

            // Add folder reference to customer data
            const customer = {
              ...customerData,
              driveFolderId: folder.id,
              driveFolderLink: folder.webUrl,
            };

            customers.push(customer);
            imported++;
            console.log(`OneDrive: Imported customer "${customer.name || folder.name}" from folder`);
          } else {
            console.warn(`OneDrive: No customer.json found in folder "${folder.name}"`);
            errors.push({ folder: folder.name, error: 'No customer.json file found' });
          }
        } catch (error) {
          console.error(`OneDrive: Error reading folder "${folder.name}":`, error);
          errors.push({ folder: folder.name, error: error.message });
        }
      }

      console.log(`OneDrive: Import complete - imported: ${imported}, errors: ${errors.length}`);
      return { customers, imported, errors };
    } catch (error) {
      console.error('OneDrive: Import failed:', error);
      throw error;
    }
  }

  /**
   * Rebuild customers index from OneDrive folders
   * Imports all customers from folders and updates the index
   * @returns {Object} - { customers: Array, results: { imported, errors } }
   */
  async rebuildCustomersIndexFromFolders() {
    console.log('OneDrive: Rebuilding customers index from folders...');

    // Import all customers from folders
    const { customers, imported, errors } = await this.importCustomersFromFolders();

    if (customers.length > 0) {
      // Build index entries
      const indexEntries = customers.map(customer => ({
        id: customer.id,
        name: customer.name || '',
        phone: customer.phone || '',
        email: customer.email || '',
        vsaNo: customer.vsaNo || '',
        driveFolderId: customer.driveFolderId,
        driveFolderLink: customer.driveFolderLink,
        lastModified: customer.lastModified || new Date().toISOString(),
      }));

      // Save the new index
      await this.saveCustomersIndex(indexEntries);
      console.log(`OneDrive: Saved index with ${indexEntries.length} customers`);
    }

    return { customers, results: { imported, errors: errors.length } };
  }

  /**
   * Get or create document templates folder
   * Returns the folder ID string for compatibility with DocumentManager
   */
  async getOrCreateDocumentTemplatesFolder() {
    const folderIds = await this.getFolderIds();
    // Return just the ID string for compatibility with DocumentManager
    return folderIds.documentTemplates;
  }

  /**
   * Upload file to a specific folder - compatibility method for DocumentManager
   * IMPORTANT: This method signature matches what DocumentManager expects
   * @param {string} fileName - The name for the file
   * @param {File|Blob} file - The file to upload
   * @param {string} folderId - The target folder ID
   * @returns {string} The file ID of the uploaded file
   */
  async uploadFileToFolder(fileName, file, folderId) {
    try {
      const token = await msAuthService.getAccessToken();
      const path = `/me/drive/items/${folderId}:/${encodeURIComponent(fileName)}:/content`;

      const response = await fetch(`${GRAPH_BASE_URL}${path}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'File upload failed');
      }

      const result = await response.json();
      // Return just the file ID for compatibility
      return result.id;
    } catch (error) {
      console.error('Error uploading file to folder:', error);
      throw error;
    }
  }

  /**
   * Delete a file by ID - compatibility method for DocumentManager
   * @param {string} fileId - The file ID to delete
   */
  async deleteFileById(fileId) {
    try {
      await this.deleteFile(fileId);
      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  /**
   * Save document templates to Drive
   * IMPORTANT: Saves in { templates: {...} } format for consistency with loadDocumentTemplatesFromDrive
   */
  async saveDocumentTemplateToDrive(templates) {
    const folderIds = await this.getFolderIds();
    // Wrap in { templates: {...} } format if not already wrapped
    const dataToSave = templates && typeof templates === 'object' && !templates.templates
      ? { templates, lastModified: new Date().toISOString() }
      : { ...templates, lastModified: new Date().toISOString() };
    return this.uploadFile(folderIds.root, 'document_templates.json', dataToSave);
  }

  /**
   * Load document templates from Drive
   * Always returns { templates: {...} } format for consistency
   */
  async loadDocumentTemplatesFromDrive() {
    const folderIds = await this.getFolderIds();
    const file = await this.findFile(folderIds.root, 'document_templates.json');

    if (!file) {
      return { templates: {} };
    }

    const data = await this.downloadFileAsJson(file.id);

    // Handle legacy format where templates were saved without wrapper
    if (data && typeof data === 'object') {
      // If data already has templates property, return as-is
      if (data.templates) {
        return data;
      }
      // If data is the templates object itself (legacy format), wrap it
      // Check if it looks like a templates object (has template IDs as keys)
      const keys = Object.keys(data);
      if (keys.length > 0 && keys.some(k => k.startsWith('template_') || data[k]?.name || data[k]?.fields)) {
        return { templates: data };
      }
    }

    return data || { templates: {} };
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

  // ============================================================
  // App Settings Operations (cross-device sync)
  // ============================================================

  /**
   * Save app settings to OneDrive
   * Used for API keys and other settings that need to sync across devices
   */
  async saveSettings(settings) {
    const folderIds = await this.getFolderIds();
    return this.uploadFile(
      folderIds.root,
      ONEDRIVE_DATA_FILES.SETTINGS,
      { ...settings, lastModified: new Date().toISOString() }
    );
  }

  /**
   * Load app settings from OneDrive
   * Returns empty object if no settings file exists
   * @param {Object} options - Options for loading settings
   * @param {boolean} options.skipValidation - Skip folder validation for performance (use during parallel warmup)
   */
  async loadSettings(options = {}) {
    const { skipValidation = false } = options;
    try {
      const folderIds = await this.getFolderIds(skipValidation);
      const file = await this.findFile(folderIds.root, ONEDRIVE_DATA_FILES.SETTINGS);

      if (!file) {
        return {};
      }

      return await this.downloadFileAsJson(file.id);
    } catch (error) {
      console.error('Error loading settings from OneDrive:', error);
      return {};
    }
  }

  /**
   * Update a single setting (merges with existing settings)
   */
  async updateSetting(key, value) {
    const currentSettings = await this.loadSettings();
    const updatedSettings = { ...currentSettings, [key]: value };
    return this.saveSettings(updatedSettings);
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

  /**
   * Get file content by folder ID and filename
   * Matches Google Drive API for compatibility
   * @param {string} folderId - The folder containing the file
   * @param {string} fileName - The name of the file to read
   * @returns {Object|null} - Parsed JSON content or null if not found
   */
  async getFileContent(folderId, fileName) {
    try {
      const file = await this.findFile(folderId, fileName);
      if (!file) {
        return null;
      }
      return await this.downloadFileAsJson(file.id);
    } catch (error) {
      // File not found is expected for new users
      if (error.message?.includes('404') || error.message?.includes('not found')) {
        return null;
      }
      throw error;
    }
  }

  // ============================================================
  // Sync Methods (Required by stores and syncCoordinator)
  // ============================================================

  /**
   * Warmup - preload and validate folder IDs
   * Called by syncCoordinator before sync operations
   * OPTIMIZATION: Skips validation on subsequent syncs (only validates on first warmup)
   *
   * @param {boolean} force - Force full validation even if already warmed up
   */
  async warmup(force = false) {
    // OPTIMIZATION: Skip validation if already warmed up (unless forced)
    if (this.hasWarmedUp && !force) {
      console.log('OneDrive warmup: using cached folder IDs (fast path)');

      // Just ensure folder IDs are available (no validation)
      await this.getFolderIds(true); // true = skip validation
      return;
    }

    console.log('OneDrive warmup: preloading folder IDs with validation...');
    const startTime = Date.now();

    // Get folder IDs with validation (will reinitialize if root folder is invalid)
    // NOTE: getFolderIds(false) already validates the root folder, so we only need
    // to validate additional critical folders (customersData) afterwards
    const folderIds = await this.getFolderIds(false); // false = validate root folder

    // OPTIMIZATION: Only validate additional folders (root was already validated by getFolderIds)
    const additionalFolders = ['customersData'];
    const foldersToValidate = additionalFolders
      .filter(key => folderIds[key])
      .map(key => folderIds[key]);

    if (foldersToValidate.length > 0) {
      const validationResults = await this.batchValidateFolderIds(foldersToValidate);
      const allValid = foldersToValidate.every(id => validationResults.get(id));

      if (!allValid) {
        console.warn('OneDrive warmup: Some critical folders are invalid, reinitializing...');
        this.clearCache();
        await this.initializeCrmStructure();
      }
    }

    // Mark as warmed up for subsequent syncs
    this.hasWarmedUp = true;

    console.log(`OneDrive warmup complete (${Date.now() - startTime}ms)`);
  }

  /**
   * Sync Excel templates with OneDrive
   * Merges local templates with Drive templates with intelligent conflict resolution
   *
   * FIXES for multi-device sync issues:
   * 1. Deduplication: Detects templates with same name but different IDs (keeps the newer one)
   * 2. Conflict resolution: When same ID exists with different content, keeps the newer version
   * 3. Prevents unnecessary writes to avoid race conditions
   */
  async syncExcel(localTemplates) {
    try {
      // Load templates from Drive (always returns { templates: {...} } format)
      const driveData = await this.loadExcelTemplates();
      const driveTemplates = driveData.templates || {};

      // Ensure localTemplates is an object
      const safeLocalTemplates = localTemplates && typeof localTemplates === 'object'
        ? (localTemplates.templates || localTemplates)
        : {};

      // Step 1: Build a name-to-templates map for deduplication
      // This helps detect duplicate templates (same name, different IDs)
      const templatesByName = new Map();

      // First, add all Drive templates to the map
      for (const [id, template] of Object.entries(driveTemplates)) {
        if (template && typeof template === 'object' && template.name) {
          const name = template.name.toLowerCase().trim();
          if (!templatesByName.has(name)) {
            templatesByName.set(name, []);
          }
          templatesByName.get(name).push({ id, template, source: 'drive' });
        }
      }

      // Then, add local templates to the map
      for (const [id, template] of Object.entries(safeLocalTemplates)) {
        if (template && typeof template === 'object' && template.name) {
          const name = template.name.toLowerCase().trim();
          if (!templatesByName.has(name)) {
            templatesByName.set(name, []);
          }
          // Only add if this ID doesn't already exist in the map
          const existing = templatesByName.get(name);
          if (!existing.some(t => t.id === id)) {
            templatesByName.get(name).push({ id, template, source: 'local' });
          }
        }
      }

      // Step 2: Deduplicate and merge
      // For each template name, keep only the newest version
      const merged = {};
      let needsSave = false;
      const deduplicatedIds = new Set(); // Track IDs that were removed due to deduplication

      for (const [name, templates] of templatesByName.entries()) {
        if (templates.length === 1) {
          // No duplicates, keep as-is
          const { id, template } = templates[0];
          merged[id] = { ...template, id };
        } else {
          // Multiple templates with same name - keep the newest one
          let newest = templates[0];
          for (const t of templates.slice(1)) {
            const newestTime = new Date(newest.template.updatedAt || newest.template.createdAt || 0).getTime();
            const currentTime = new Date(t.template.updatedAt || t.template.createdAt || 0).getTime();

            if (currentTime > newestTime) {
              // Mark the older one as deduplicated
              deduplicatedIds.add(newest.id);
              newest = t;
            } else {
              deduplicatedIds.add(t.id);
            }
          }

          merged[newest.id] = { ...newest.template, id: newest.id };

          // If we removed duplicates that existed in Drive, we need to save
          for (const t of templates) {
            if (t.id !== newest.id && driveTemplates[t.id]) {
              needsSave = true;
              console.log(`OneDrive: Deduplicating Excel template "${name}" - keeping ${newest.id}, removing ${t.id}`);
            }
          }
        }
      }

      // Step 3: Add local-only templates (not in Drive and not deduplicated)
      for (const [id, template] of Object.entries(safeLocalTemplates)) {
        if (!driveTemplates[id] && !merged[id] && !deduplicatedIds.has(id) && template && typeof template === 'object') {
          merged[id] = { ...template, id };
          needsSave = true;
          console.log(`OneDrive: Adding local-only Excel template ${id}`);
        }
      }

      // Step 4: Check for templates that exist in both places with different content
      // Keep the newer version based on updatedAt timestamp
      for (const [id, localTemplate] of Object.entries(safeLocalTemplates)) {
        if (driveTemplates[id] && merged[id]) {
          const driveTime = new Date(driveTemplates[id].updatedAt || driveTemplates[id].createdAt || 0).getTime();
          const localTime = new Date(localTemplate.updatedAt || localTemplate.createdAt || 0).getTime();

          if (localTime > driveTime) {
            // Local is newer, update the merged version
            merged[id] = { ...localTemplate, id };
            needsSave = true;
            console.log(`OneDrive: Local Excel template ${id} is newer, updating Drive`);
          }
        }
      }

      // Only save back to Drive if there are changes
      if (needsSave) {
        await this.saveExcelTemplates(merged);
        console.log('OneDrive: Saved merged Excel templates to Drive');
      }

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
   * Merges local templates with Drive templates with intelligent conflict resolution
   *
   * FIXES for multi-device sync issues:
   * 1. Deduplication: Detects templates with same name but different IDs (keeps the newer one)
   * 2. Conflict resolution: When same ID exists with different content, keeps the newer version
   * 3. Prevents unnecessary writes to avoid race conditions
   */
  async syncDocumentTemplates(localTemplates) {
    try {
      // Load templates from Drive (always returns { templates: {...} } format)
      const driveData = await this.loadDocumentTemplatesFromDrive();
      const driveTemplates = driveData.templates || {};

      // Ensure localTemplates is an object
      const safeLocalTemplates = localTemplates && typeof localTemplates === 'object'
        ? (localTemplates.templates || localTemplates)
        : {};

      // Step 1: Build a name-to-templates map for deduplication
      // This helps detect duplicate templates (same name, different IDs)
      const templatesByName = new Map();

      // First, add all Drive templates to the map
      for (const [id, template] of Object.entries(driveTemplates)) {
        if (template && typeof template === 'object' && template.name) {
          const name = template.name.toLowerCase().trim();
          if (!templatesByName.has(name)) {
            templatesByName.set(name, []);
          }
          templatesByName.get(name).push({ id, template, source: 'drive' });
        }
      }

      // Then, add local templates to the map
      for (const [id, template] of Object.entries(safeLocalTemplates)) {
        if (template && typeof template === 'object' && template.name) {
          const name = template.name.toLowerCase().trim();
          if (!templatesByName.has(name)) {
            templatesByName.set(name, []);
          }
          // Only add if this ID doesn't already exist in the map
          const existing = templatesByName.get(name);
          if (!existing.some(t => t.id === id)) {
            templatesByName.get(name).push({ id, template, source: 'local' });
          }
        }
      }

      // Step 2: Deduplicate and merge
      // For each template name, keep only the newest version
      const merged = {};
      let needsSave = false;
      const deduplicatedIds = new Set(); // Track IDs that were removed due to deduplication

      for (const [name, templates] of templatesByName.entries()) {
        if (templates.length === 1) {
          // No duplicates, keep as-is
          const { id, template } = templates[0];
          merged[id] = { ...template, id };
        } else {
          // Multiple templates with same name - keep the newest one
          let newest = templates[0];
          for (const t of templates.slice(1)) {
            const newestTime = new Date(newest.template.updatedAt || newest.template.createdAt || 0).getTime();
            const currentTime = new Date(t.template.updatedAt || t.template.createdAt || 0).getTime();

            if (currentTime > newestTime) {
              // Mark the older one as deduplicated
              deduplicatedIds.add(newest.id);
              newest = t;
            } else {
              deduplicatedIds.add(t.id);
            }
          }

          merged[newest.id] = { ...newest.template, id: newest.id };

          // If we removed duplicates that existed in Drive, we need to save
          for (const t of templates) {
            if (t.id !== newest.id && driveTemplates[t.id]) {
              needsSave = true;
              console.log(`OneDrive: Deduplicating template "${name}" - keeping ${newest.id}, removing ${t.id}`);
            }
          }
        }
      }

      // Step 3: Add local-only templates (not in Drive and not deduplicated)
      for (const [id, template] of Object.entries(safeLocalTemplates)) {
        if (!driveTemplates[id] && !merged[id] && !deduplicatedIds.has(id) && template && typeof template === 'object') {
          merged[id] = { ...template, id };
          needsSave = true;
          console.log(`OneDrive: Adding local-only template ${id}`);
        }
      }

      // Step 4: Check for templates that exist in both places with different content
      // Keep the newer version based on updatedAt timestamp
      for (const [id, localTemplate] of Object.entries(safeLocalTemplates)) {
        if (driveTemplates[id] && merged[id]) {
          const driveTime = new Date(driveTemplates[id].updatedAt || driveTemplates[id].createdAt || 0).getTime();
          const localTime = new Date(localTemplate.updatedAt || localTemplate.createdAt || 0).getTime();

          if (localTime > driveTime) {
            // Local is newer, update the merged version
            merged[id] = { ...localTemplate, id };
            needsSave = true;
            console.log(`OneDrive: Local template ${id} is newer, updating Drive`);
          }
        }
      }

      // Only save back to Drive if there are changes
      if (needsSave) {
        await this.saveDocumentTemplateToDrive(merged);
        console.log('OneDrive: Saved merged templates to Drive');
      }

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
   * FIXED: Properly handles the { templates: {...} } format
   */
  async deleteDocumentTemplateFromDrive(templateId) {
    try {
      // Load current templates (returns { templates: {...} } format)
      const driveData = await this.loadDocumentTemplatesFromDrive();
      const templates = driveData.templates || {};

      // Check if template exists before deletion
      if (!templates[templateId]) {
        console.warn(`Template ${templateId} not found in Drive, skipping deletion`);
        return true;
      }

      // Remove the template
      delete templates[templateId];

      // Save updated templates (will be wrapped in { templates: {...} } format)
      await this.saveDocumentTemplateToDrive(templates);

      console.log(`Successfully deleted template ${templateId} from Drive`);
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
