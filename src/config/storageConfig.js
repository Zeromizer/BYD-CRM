/**
 * Storage Provider Configuration
 *
 * Toggle between Google Drive and OneDrive storage backends.
 * This allows you to test OneDrive while keeping Google Drive as a fallback.
 */

// Storage provider options
export const STORAGE_PROVIDERS = {
  GOOGLE_DRIVE: 'google_drive',
  ONEDRIVE: 'onedrive',
};

/**
 * Current storage provider setting
 *
 * Change this to switch between providers:
 * - STORAGE_PROVIDERS.GOOGLE_DRIVE (default, current implementation)
 * - STORAGE_PROVIDERS.ONEDRIVE (new Microsoft/Azure implementation)
 */
export const CURRENT_STORAGE_PROVIDER = STORAGE_PROVIDERS.GOOGLE_DRIVE;

/**
 * Check if using OneDrive
 */
export const isUsingOneDrive = () => {
  return CURRENT_STORAGE_PROVIDER === STORAGE_PROVIDERS.ONEDRIVE;
};

/**
 * Check if using Google Drive
 */
export const isUsingGoogleDrive = () => {
  return CURRENT_STORAGE_PROVIDER === STORAGE_PROVIDERS.GOOGLE_DRIVE;
};

/**
 * Get current storage provider name for display
 */
export const getStorageProviderName = () => {
  switch (CURRENT_STORAGE_PROVIDER) {
    case STORAGE_PROVIDERS.GOOGLE_DRIVE:
      return 'Google Drive';
    case STORAGE_PROVIDERS.ONEDRIVE:
      return 'OneDrive';
    default:
      return 'Unknown';
  }
};
