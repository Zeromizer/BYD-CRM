import { CONFIG } from '../config/config.js';

/**
 * Google Drive Service
 * Handles syncing customer data between localStorage and Google Drive
 *
 * IMPORTANT: Folder IDs are persisted to localStorage per user to prevent
 * duplicate folders from being created when cache is lost.
 */
class DriveService {
  constructor() {
    this.customersFileId = null;
    this.excelFileId = null;
    this.rootFolderId = null;
    this.customersFolderId = null;
    this.customersDataFolderId = null;

    // OPTIMIZATION Phase 2: TTL-based validation cache (5 minutes)
    // Maps folder ID -> timestamp when validated
    this._validatedIds = new Map();
    this._validationTTL = 5 * 60 * 1000; // 5 minutes in milliseconds

    // Track if warmup has been done this session
    this._warmedUp = false;

    // Load persisted folder IDs on construction
    this._loadPersistedIds();
  }

  /**
   * Get the current user's email for per-user storage
   */
  _getUserEmail() {
    return localStorage.getItem('googleUserEmail')?.toLowerCase() || null;
  }

  /**
   * Get the storage key for persisted folder IDs
   */
  _getStorageKey() {
    const email = this._getUserEmail();
    return email ? `driveFolderIds_${email}` : null;
  }

  /**
   * Load persisted folder IDs from localStorage
   */
  _loadPersistedIds() {
    const key = this._getStorageKey();
    if (!key) return;

    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const ids = JSON.parse(stored);
        this.rootFolderId = ids.rootFolderId || null;
        this.customersDataFolderId = ids.customersDataFolderId || null;
        this.customersFileId = ids.customersFileId || null;
        this.excelFileId = ids.excelFileId || null;
        console.log('[DriveService] Loaded persisted folder IDs for user');
      }
    } catch (error) {
      console.warn('[DriveService] Failed to load persisted IDs:', error);
    }
  }

  /**
   * Save folder IDs to localStorage for persistence
   */
  _persistIds() {
    const key = this._getStorageKey();
    if (!key) return;

    try {
      const ids = {
        rootFolderId: this.rootFolderId,
        customersDataFolderId: this.customersDataFolderId,
        customersFileId: this.customersFileId,
        excelFileId: this.excelFileId,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(key, JSON.stringify(ids));
      console.log('[DriveService] Persisted folder IDs');
    } catch (error) {
      console.warn('[DriveService] Failed to persist IDs:', error);
    }
  }

  /**
   * Check if a cached validation is still valid (within TTL)
   */
  _isValidationCacheValid(fileId) {
    const cachedTime = this._validatedIds.get(fileId);
    if (!cachedTime) return false;

    const elapsed = Date.now() - cachedTime;
    return elapsed < this._validationTTL;
  }

  /**
   * Validate if a folder/file ID still exists and is accessible
   * OPTIMIZED Phase 2: Uses TTL-based cache (5 min) to avoid redundant API calls
   */
  async _validateId(fileId) {
    if (!fileId) return false;

    // OPTIMIZATION: Check TTL-based cache first
    if (this._isValidationCacheValid(fileId)) {
      const remainingTTL = Math.round((this._validationTTL - (Date.now() - this._validatedIds.get(fileId))) / 1000);
      console.log(`[DriveService] ID ${fileId.substring(0, 12)}... valid (TTL: ${remainingTTL}s remaining)`);
      return true;
    }

    try {
      const response = await window.gapi.client.drive.files.get({
        fileId: fileId,
        fields: 'id, trashed',
      });
      const isValid = response.result && !response.result.trashed;

      // Add to cache with current timestamp if valid
      if (isValid) {
        this._validatedIds.set(fileId, Date.now());
        console.log(`[DriveService] ID ${fileId.substring(0, 12)}... validated (TTL: 5min)`);
      }

      return isValid;
    } catch (error) {
      console.log(`[DriveService] ID ${fileId} is invalid:`, error.message);
      // Remove from cache if it was there
      this._validatedIds.delete(fileId);
      return false;
    }
  }

  /**
   * OPTIMIZATION Phase 3: Batch validate multiple file IDs in a single request
   * Uses Google Drive Batch API to reduce HTTP round-trips
   * @param {string[]} fileIds - Array of file IDs to validate
   * @returns {Map<string, boolean>} - Map of fileId -> isValid
   */
  async _batchValidateIds(fileIds) {
    if (!fileIds || fileIds.length === 0) {
      return new Map();
    }

    // Filter out IDs that are already in TTL cache
    const idsToValidate = fileIds.filter(id => id && !this._isValidationCacheValid(id));
    const results = new Map();

    // Add cached results
    fileIds.forEach(id => {
      if (id && this._isValidationCacheValid(id)) {
        results.set(id, true);
        console.log(`[DriveService] Batch: ID ${id.substring(0, 12)}... valid (from cache)`);
      }
    });

    if (idsToValidate.length === 0) {
      console.log('[DriveService] Batch validation: all IDs already cached');
      return results;
    }

    console.log(`[DriveService] 📦 Batch validating ${idsToValidate.length} IDs...`);
    const startTime = Date.now();

    try {
      // Create batch request
      const batch = window.gapi.client.newBatch();

      idsToValidate.forEach((fileId, index) => {
        batch.add(
          window.gapi.client.drive.files.get({
            fileId: fileId,
            fields: 'id, trashed',
          }),
          { id: fileId }
        );
      });

      // Execute batch
      const batchResponse = await batch;

      // Process results
      Object.entries(batchResponse.result).forEach(([fileId, response]) => {
        if (response.result && !response.result.trashed) {
          results.set(fileId, true);
          this._validatedIds.set(fileId, Date.now());
        } else {
          results.set(fileId, false);
          this._validatedIds.delete(fileId);
        }
      });

      const elapsed = Date.now() - startTime;
      const validCount = [...results.values()].filter(v => v).length;
      console.log(`[DriveService] 📦 Batch validation complete in ${elapsed}ms: ${validCount}/${fileIds.length} valid`);

      return results;
    } catch (error) {
      console.error('[DriveService] Batch validation failed:', error);
      // Fall back to individual validation
      for (const fileId of idsToValidate) {
        const isValid = await this._validateId(fileId);
        results.set(fileId, isValid);
      }
      return results;
    }
  }

  /**
   * OPTIMIZATION Phase 3: Batch fetch multiple file contents in a single request
   * Uses Google Drive Batch API for media downloads
   * @param {Array<{id: string, name: string}>} files - Array of file objects with id and name
   * @returns {Map<string, string>} - Map of fileId -> content
   */
  async _batchGetFileContents(files) {
    if (!files || files.length === 0) {
      return new Map();
    }

    // For small batches (1-2 files), use regular parallel fetch
    if (files.length <= 2) {
      const results = new Map();
      await Promise.all(files.map(async (file) => {
        try {
          const content = await this.getFileContent(file.id);
          results.set(file.id, content);
        } catch (error) {
          console.error(`Failed to get content for ${file.name}:`, error);
        }
      }));
      return results;
    }

    console.log(`[DriveService] 📦 Batch fetching ${files.length} file contents...`);
    const startTime = Date.now();
    const results = new Map();

    try {
      // Google Drive batch API doesn't support media downloads directly
      // So we use parallel fetch with the access token instead
      const token = window.gapi.client.getToken()?.access_token;
      if (!token) {
        throw new Error('No access token available');
      }

      // Fetch all files in parallel with a concurrency limit
      const BATCH_SIZE = 5; // Limit concurrent requests to avoid rate limiting
      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);

        const batchPromises = batch.map(async (file) => {
          try {
            const response = await fetch(
              `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
              {
                headers: {
                  'Authorization': `Bearer ${token}`,
                },
              }
            );

            if (response.ok) {
              const content = await response.text();
              return { id: file.id, content };
            } else {
              console.error(`Failed to fetch ${file.name}: ${response.status}`);
              return { id: file.id, content: null };
            }
          } catch (error) {
            console.error(`Error fetching ${file.name}:`, error);
            return { id: file.id, content: null };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(result => {
          if (result.content !== null) {
            results.set(result.id, result.content);
          }
        });
      }

      const elapsed = Date.now() - startTime;
      console.log(`[DriveService] 📦 Batch fetch complete in ${elapsed}ms: ${results.size}/${files.length} files`);

      return results;
    } catch (error) {
      console.error('[DriveService] Batch fetch failed:', error);
      // Fall back to individual fetching
      for (const file of files) {
        try {
          const content = await this.getFileContent(file.id);
          results.set(file.id, content);
        } catch (err) {
          console.error(`Failed to get content for ${file.name}:`, err);
        }
      }
      return results;
    }
  }

  /**
   * Clear all cached folder and file IDs (for sign out or account switching)
   */
  clearCache() {
    console.log('Clearing Drive service cache');
    this.customersFileId = null;
    this.excelFileId = null;
    this.rootFolderId = null;
    this.customersFolderId = null;
    this.customersDataFolderId = null;

    // Clear session validation cache
    this._validatedIds.clear();
    this._warmedUp = false;
    console.log('[DriveService] Cleared session validation cache');

    // Also clear persisted IDs for current user
    const key = this._getStorageKey();
    if (key) {
      localStorage.removeItem(key);
      console.log('[DriveService] Cleared persisted folder IDs');
    }
  }

  /**
   * OPTIMIZATION Phase 2+3: Warmup/preload all folder IDs in parallel
   * Call this before sync operations to resolve all folder structures upfront
   * This prevents sequential folder resolution during sync
   * Phase 3: Uses batch validation for cached IDs
   */
  async warmup() {
    // Skip if already warmed up this session
    if (this._warmedUp) {
      console.log('[DriveService] ⚡ Already warmed up, skipping');
      return true;
    }

    console.log('[DriveService] 🔥 Warming up - preloading all folder IDs in parallel...');
    const startTime = Date.now();

    try {
      // Phase 3: If we have persisted IDs, batch validate them first
      const cachedIds = [
        this.rootFolderId,
        this.customersDataFolderId,
        this.excelFileId,
      ].filter(id => id);

      if (cachedIds.length > 0) {
        console.log(`[DriveService] 📦 Batch validating ${cachedIds.length} cached folder IDs...`);
        await this._batchValidateIds(cachedIds);
      }

      // Resolve all folder IDs in parallel (will use cache if batch validation succeeded)
      const [rootFolderId, customersDataFolderId, excelFileId] = await Promise.all([
        this.getOrCreateRootFolder(),
        this.getOrCreateCustomersDataFolder(),
        this.getOrCreateExcelFile(),
      ]);

      // Also preload document templates folder (nested inside root)
      await this.getOrCreateDocumentTemplatesFolder();

      const elapsed = Date.now() - startTime;
      this._warmedUp = true;
      console.log(`[DriveService] ⚡ Warmup complete in ${elapsed}ms - all folder IDs cached`);

      return true;
    } catch (error) {
      console.error('[DriveService] Warmup failed:', error);
      // Don't throw - warmup is optional optimization
      return false;
    }
  }

  /**
   * Check if service is warmed up
   */
  isWarmedUp() {
    return this._warmedUp;
  }

  /**
   * Get or create the Customers Data folder (new hybrid structure)
   * This folder contains both customer folders AND the index file
   */
  async getOrCreateCustomersDataFolder() {
    // Check if we have a cached ID and validate it
    if (this.customersDataFolderId) {
      const isValid = await this._validateId(this.customersDataFolderId);
      if (isValid) {
        return this.customersDataFolderId;
      }
      console.log('[DriveService] Cached customersDataFolderId is invalid, searching...');
      this.customersDataFolderId = null;
    }

    try {
      const folderName = CONFIG.FOLDER_NAMES.CUSTOMERS_DATA || 'BYD Customers Data';

      // Search for existing folder in Drive root - get ALL matches to handle duplicates
      const response = await window.gapi.client.drive.files.list({
        q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name, createdTime)',
        spaces: 'drive',
        orderBy: 'createdTime', // Oldest first - most likely to have data
      });

      if (response.result.files && response.result.files.length > 0) {
        // Use the oldest folder (first in sorted results) - most likely to have data
        this.customersDataFolderId = response.result.files[0].id;

        if (response.result.files.length > 1) {
          console.warn(`[DriveService] Found ${response.result.files.length} "${folderName}" folders! Using oldest one: ${this.customersDataFolderId}`);
          console.warn('[DriveService] Duplicate folder IDs:', response.result.files.map(f => f.id));
        } else {
          console.log(`[DriveService] Found existing Customers Data folder: ${this.customersDataFolderId}`);
        }

        this._persistIds();
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
      console.log(`[DriveService] Created Customers Data folder: ${this.customersDataFolderId}`);
      this._persistIds();
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
   * Get or create a folder by name in a specific parent folder
   * Returns the folder ID
   */
  async getOrCreateFolder(folderName, parentFolderId = null) {
    try {
      // Build search query
      let query = `name='${folderName.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

      if (parentFolderId) {
        query += ` and '${parentFolderId}' in parents`;
      }

      // Search for existing folder
      const response = await window.gapi.client.drive.files.list({
        q: query,
        fields: 'files(id, name, webViewLink)',
        orderBy: 'createdTime',
      });

      if (response.result.files && response.result.files.length > 0) {
        // Folder exists, return the first one
        console.log(`Found existing folder "${folderName}":`, response.result.files[0].id);
        return response.result.files[0].id;
      }

      // Folder doesn't exist, create it
      const createResponse = await window.gapi.client.drive.files.create({
        resource: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          ...(parentFolderId && { parents: [parentFolderId] }),
        },
        fields: 'id, name, webViewLink',
      });

      console.log(`Created folder "${folderName}":`, createResponse.result.id);
      return createResponse.result.id;
    } catch (error) {
      console.error(`Failed to get/create folder "${folderName}":`, error);
      throw error;
    }
  }

  /**
   * List files in a folder
   */
  async listFiles(folderId) {
    try {
      const response = await window.gapi.client.drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType, createdTime, modifiedTime)',
        orderBy: 'name',
      });

      return response.result.files || [];
    } catch (error) {
      console.error('Failed to list files:', error);
      throw error;
    }
  }

  /**
   * Recursively list all image files from a folder and its subfolders
   * Returns all images with their folder path for context
   */
  async listAllImagesRecursively(folderId, folderPath = '') {
    try {
      const allImages = [];

      // Get all files and folders in current folder
      const items = await this.listFiles(folderId);

      for (const item of items) {
        if (item.mimeType === 'application/vnd.google-apps.folder') {
          // Recursively search subfolder
          const subfolderPath = folderPath ? `${folderPath}/${item.name}` : item.name;
          const subImages = await this.listAllImagesRecursively(item.id, subfolderPath);
          allImages.push(...subImages);
        } else if (item.mimeType && item.mimeType.startsWith('image/')) {
          // Add image with folder path
          allImages.push({
            ...item,
            folderPath: folderPath || 'Root'
          });
        }
      }

      return allImages;
    } catch (error) {
      console.error('Failed to list images recursively:', error);
      throw error;
    }
  }

  /**
   * Recursively list ALL files from a folder and its subfolders
   * Returns all files (excluding folders) with their folder path and additional metadata
   * Used by the Documents tab to show files from all subfolders
   */
  async listAllFilesRecursively(folderId, folderPath = '') {
    try {
      const allFiles = [];

      // Get all files and folders in current folder with full metadata
      const response = await window.gapi.client.drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType, size, createdTime, webViewLink, iconLink)',
        orderBy: 'name',
      });

      const items = response.result.files || [];

      for (const item of items) {
        if (item.mimeType === 'application/vnd.google-apps.folder') {
          // Recursively search subfolder
          const subfolderPath = folderPath ? `${folderPath}/${item.name}` : item.name;
          const subFiles = await this.listAllFilesRecursively(item.id, subfolderPath);
          allFiles.push(...subFiles);
        } else {
          // Add file with folder path for context
          allFiles.push({
            ...item,
            folderPath: folderPath || '',
            parentFolderId: folderId
          });
        }
      }

      return allFiles;
    } catch (error) {
      console.error('Failed to list files recursively:', error);
      throw error;
    }
  }

  /**
   * Get file content as text
   */
  async getFileContent(fileId) {
    try {
      const response = await window.gapi.client.drive.files.get({
        fileId: fileId,
        alt: 'media',
      });

      return response.body;
    } catch (error) {
      console.error('Failed to get file content:', error);
      throw error;
    }
  }

  /**
   * Update file content
   */
  async updateFileContent(fileId, content) {
    try {
      const boundary = '-------314159265358979323846';
      const delimiter = "\r\n--" + boundary + "\r\n";
      const close_delim = "\r\n--" + boundary + "--";

      const contentType = 'application/json';
      const metadata = {
        mimeType: contentType,
      };

      const multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: ' + contentType + '\r\n\r\n' +
        content +
        close_delim;

      const response = await window.gapi.client.request({
        path: '/upload/drive/v3/files/' + fileId,
        method: 'PATCH',
        params: { uploadType: 'multipart' },
        headers: {
          'Content-Type': 'multipart/related; boundary="' + boundary + '"',
        },
        body: multipartRequestBody,
      });

      return response.result;
    } catch (error) {
      console.error('Failed to update file content:', error);
      throw error;
    }
  }

  /**
   * Upload a file to Google Drive
   * @param {string} fileName - Name of the file
   * @param {Blob|File} file - File or Blob to upload
   * @param {string} parentFolderId - Parent folder ID
   * @returns {Promise<string>} - File ID
   */
  async uploadFile(fileName, file, parentFolderId) {
    try {
      // Determine MIME type and prepare file content
      let mimeType;
      let fileContent = file;

      // Handle string content (e.g., JSON data)
      if (typeof file === 'string') {
        if (fileName.endsWith('.json')) {
          mimeType = 'application/json';
        } else {
          mimeType = 'text/plain';
        }
        // Convert string to Blob with correct MIME type
        fileContent = new Blob([file], { type: mimeType });
      } else if (file instanceof Blob || file instanceof File) {
        // Handle Blob/File objects
        mimeType = file.type;
        if (!mimeType) {
          // Default based on file extension
          if (fileName.endsWith('.json')) {
            mimeType = 'application/json';
          } else if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
            mimeType = 'image/jpeg';
          } else if (fileName.endsWith('.png')) {
            mimeType = 'image/png';
          } else if (fileName.endsWith('.pdf')) {
            mimeType = 'application/pdf';
          } else {
            mimeType = 'application/octet-stream';
          }
        }
      } else {
        // Unknown type - treat as binary
        mimeType = 'application/octet-stream';
      }

      const fileMetadata = {
        name: fileName,
        mimeType: mimeType,
        parents: [parentFolderId],
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
      form.append('file', fileContent);

      const token = window.gapi.client.getToken().access_token;
      const uploadResponse = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: form,
        }
      );

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      const result = await uploadResponse.json();
      console.log(`Uploaded file "${fileName}":`, result.id);
      return result.id;
    } catch (error) {
      console.error(`Failed to upload file "${fileName}":`, error);
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
   * This folder stores forms.json, excel.json, and customers.json
   */
  async getOrCreateRootFolder() {
    // Check if we have a cached ID and validate it
    if (this.rootFolderId) {
      const isValid = await this._validateId(this.rootFolderId);
      if (isValid) {
        return this.rootFolderId;
      }
      console.log('[DriveService] Cached rootFolderId is invalid, searching...');
      this.rootFolderId = null;
    }

    try {
      const folderName = CONFIG.FOLDER_NAMES.ROOT || 'BYD CRM';

      // Search for existing folder - get ALL matches to handle duplicates
      const response = await window.gapi.client.drive.files.list({
        q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name, createdTime)',
        spaces: 'drive',
        orderBy: 'createdTime', // Oldest first - most likely to have data
      });

      if (response.result.files && response.result.files.length > 0) {
        // Use the oldest folder (first in sorted results) - most likely to have data
        this.rootFolderId = response.result.files[0].id;

        if (response.result.files.length > 1) {
          console.warn(`[DriveService] Found ${response.result.files.length} "${folderName}" folders! Using oldest one: ${this.rootFolderId}`);
          console.warn('[DriveService] Duplicate folder IDs:', response.result.files.map(f => f.id));
        } else {
          console.log(`[DriveService] Found existing root folder: ${this.rootFolderId}`);
        }

        this._persistIds();
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
      console.log(`[DriveService] Created root folder: ${this.rootFolderId}`);
      this._persistIds();
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
   * Get or create excel.json file in Google Drive
   */
  async getOrCreateExcelFile() {
    // Check if we have a cached ID and validate it
    if (this.excelFileId) {
      const isValid = await this._validateId(this.excelFileId);
      if (isValid) {
        return this.excelFileId;
      }
      console.log('[DriveService] Cached excelFileId is invalid, searching...');
      this.excelFileId = null;
    }

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
        console.log('[DriveService] Found existing excel file:', this.excelFileId);
        this._persistIds();
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
      console.log('[DriveService] Created excel file:', this.excelFileId);
      this._persistIds();
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
   * Save Excel templates to Google Drive with verification
   */
  async saveExcelToDrive(excelTemplates) {
    try {
      // Check if we have a valid token
      const tokenObj = window.gapi?.client?.getToken?.();
      if (!tokenObj?.access_token) {
        throw new Error('Not authenticated - please sign in to Google Drive');
      }

      const fileId = await this.getOrCreateExcelFile();
      const fileContent = JSON.stringify(excelTemplates, null, 2);
      const file = new Blob([fileContent], { type: 'application/json' });

      const token = tokenObj.access_token;
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

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 401 || response.status === 403) {
          throw new Error(`Authentication error (${response.status}): Please sign in again`);
        }
        throw new Error(`Failed to save Excel templates (${response.status}): ${errorText}`);
      }

      // Verify the save by checking file metadata
      const verifyResponse = await window.gapi.client.drive.files.get({
        fileId: fileId,
        fields: 'id, modifiedTime, size',
      });

      const modifiedTime = new Date(verifyResponse.result.modifiedTime);
      const now = new Date();
      const timeDiff = now - modifiedTime;

      // If modified time is within last 30 seconds, consider it verified
      if (timeDiff > 30000) {
        console.warn('Excel save verification: file modified time is older than expected');
      }

      console.log('Saved and verified Excel templates to Drive:', Object.keys(excelTemplates).length);
      return true;
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

  // ==================== DOCUMENT TEMPLATE METHODS ====================

  /**
   * Get or create Document Templates folder inside BYD CRM root folder
   */
  async getOrCreateDocumentTemplatesFolder() {
    try {
      // First get the root BYD CRM folder
      const rootFolderId = await this.getOrCreateRootFolder();

      // Then get or create Document Templates folder inside it
      const folderId = await this.getOrCreateFolder('Document Templates', rootFolderId);
      console.log('[DriveService] Document Templates folder:', folderId);
      return folderId;
    } catch (error) {
      console.error('Failed to get/create Document Templates folder:', error);
      throw error;
    }
  }

  /**
   * Load document templates from Google Drive
   * Returns an object with template IDs as keys
   * OPTIMIZED Phase 3: Uses batch file content fetching for better performance
   */
  async loadDocumentTemplatesFromDrive() {
    try {
      const folderId = await this.getOrCreateDocumentTemplatesFolder();

      // List all template files in the folder
      const files = await this.listFiles(folderId);

      // Filter JSON files
      const jsonFiles = files.filter(file => file.name.endsWith('.json'));

      if (jsonFiles.length === 0) {
        console.log('No document templates found in Drive');
        return {};
      }

      console.log(`Loading ${jsonFiles.length} document templates...`);

      // OPTIMIZATION Phase 3: Use batch file content fetching
      const contentsMap = await this._batchGetFileContents(jsonFiles);

      // Build templates object from fetched contents
      const templates = {};
      for (const file of jsonFiles) {
        const content = contentsMap.get(file.id);
        if (content) {
          try {
            const template = JSON.parse(content);
            if (template && template.id) {
              templates[template.id] = template;
            }
          } catch (parseError) {
            console.error(`Failed to parse document template ${file.name}:`, parseError);
          }
        }
      }

      console.log('Loaded document templates from Drive:', Object.keys(templates).length);
      return templates;
    } catch (error) {
      console.error('Failed to load document templates from Drive:', error);
      return {};
    }
  }

  /**
   * Save a single document template to Google Drive
   */
  async saveDocumentTemplateToDrive(template) {
    try {
      const folderId = await this.getOrCreateDocumentTemplatesFolder();
      const fileName = `${template.id}.json`;
      const fileContent = JSON.stringify(template, null, 2);

      // Check if file exists
      const files = await this.listFiles(folderId);
      const existingFile = files.find(f => f.name === fileName);

      if (existingFile) {
        // Update existing file
        await this.updateFileContent(existingFile.id, fileContent);
        console.log(`Updated document template in Drive: ${template.id}`);
      } else {
        // Create new file
        await this.uploadFile(fileName, fileContent, folderId);
        console.log(`Created document template in Drive: ${template.id}`);
      }

      return true;
    } catch (error) {
      console.error('Failed to save document template to Drive:', error);
      throw error;
    }
  }

  /**
   * Delete a document template from Google Drive
   */
  async deleteDocumentTemplateFromDrive(templateId) {
    try {
      const folderId = await this.getOrCreateDocumentTemplatesFolder();
      const fileName = `${templateId}.json`;

      // Find the file to delete
      const files = await this.listFiles(folderId);
      const fileToDelete = files.find(f => f.name === fileName);

      if (fileToDelete) {
        await window.gapi.client.drive.files.delete({
          fileId: fileToDelete.id,
        });
        console.log(`Deleted document template from Drive: ${templateId}`);
        return true;
      } else {
        console.log(`Document template not found in Drive: ${templateId}`);
        return false;
      }
    } catch (error) {
      console.error('Failed to delete document template from Drive:', error);
      throw error;
    }
  }

  /**
   * Sync document templates: merge localStorage and Drive data
   * Drive is source of truth, but local-only templates are uploaded
   */
  async syncDocumentTemplates(localTemplates) {
    try {
      const driveTemplates = await this.loadDocumentTemplatesFromDrive();

      // Merge: Drive is source of truth, add any local-only templates
      const merged = { ...driveTemplates };

      // Add local templates that don't exist in Drive and queue them for sync
      const localOnlyTemplates = [];
      Object.entries(localTemplates).forEach(([id, template]) => {
        if (!driveTemplates[id]) {
          merged[id] = template;
          localOnlyTemplates.push(template);
        }
      });

      // Upload local-only templates to Drive
      for (const template of localOnlyTemplates) {
        try {
          await this.saveDocumentTemplateToDrive(template);
          console.log(`Synced local document template to Drive: ${template.id}`);
        } catch (error) {
          console.error(`Failed to sync local template ${template.id} to Drive:`, error);
        }
      }

      console.log('Document templates synced successfully');
      return merged;
    } catch (error) {
      console.error('Failed to sync document templates:', error);
      // Return local templates as fallback (same pattern as forms/excel)
      return localTemplates;
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
