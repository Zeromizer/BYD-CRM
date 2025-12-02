/**
 * Unified Storage Service Selector
 *
 * This module exports the appropriate storage and auth services
 * based on the current storage provider configuration.
 *
 * Usage:
 *   import { storageService, authService } from '../services/storageServiceSelector';
 *
 * This allows seamless switching between Google Drive and OneDrive
 * without changing imports throughout the codebase.
 */

import googleDriveService from './driveService';
import oneDriveService from './oneDriveService';
import googleAuthService from './authService';
import msAuthService from './msAuthService';
import { isUsingOneDrive } from '../config/storageConfig';

/**
 * Get the appropriate storage service based on configuration
 */
export const getStorageService = () => {
  return isUsingOneDrive() ? oneDriveService : googleDriveService;
};

/**
 * Get the appropriate auth service based on configuration
 */
export const getAuthService = () => {
  return isUsingOneDrive() ? msAuthService : googleAuthService;
};

/**
 * Export the current storage service instance
 * Note: This is evaluated at import time, so it's based on the initial config
 */
export const storageService = isUsingOneDrive() ? oneDriveService : googleDriveService;

/**
 * Export the current auth service instance
 */
export const authService = isUsingOneDrive() ? msAuthService : googleAuthService;

/**
 * Check if currently using OneDrive
 */
export { isUsingOneDrive };

// Default export for convenience
export default {
  getStorageService,
  getAuthService,
  storageService,
  authService,
  isUsingOneDrive,
};
