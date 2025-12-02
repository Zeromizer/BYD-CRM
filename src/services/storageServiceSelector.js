/**
 * Storage Service - OneDrive
 *
 * This module exports the OneDrive storage and auth services.
 * Provides a unified interface for cloud storage operations.
 */

import oneDriveService from './oneDriveService';
import msAuthService from './msAuthService';

/**
 * Get the storage service
 */
export const getStorageService = () => oneDriveService;

/**
 * Get the auth service
 */
export const getAuthService = () => msAuthService;

/**
 * Export the storage service instance
 */
export const storageService = oneDriveService;

/**
 * Export the auth service instance
 */
export const authService = msAuthService;

// Default export for convenience
export default {
  getStorageService,
  getAuthService,
  storageService,
  authService,
};
