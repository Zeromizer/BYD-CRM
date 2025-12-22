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
