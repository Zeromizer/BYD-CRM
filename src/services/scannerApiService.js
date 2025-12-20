/**
 * Scanner API Service
 * Integrates with external document scanner API for professional document scanning
 *
 * Features:
 * - Professional document scanning via external API
 * - Returns high-quality scanned PDFs
 * - API key synced across devices via OneDrive
 * - Configurable API endpoint URL
 */

import oneDriveService from './oneDriveService';

// LocalStorage key for Scanner API config
const CONFIG_STORAGE_KEY = 'bydcrm_scanner_api_config';

// Default configuration
const DEFAULT_CONFIG = {
  enabled: false,
  apiUrl: 'http://localhost:5000/api/v1',
  apiKey: ''
};

// In-memory cache
let cachedConfig = null;
let isInitialized = false;

/**
 * Get the Scanner API configuration from cache or localStorage
 * @returns {object}
 */
export function getScannerApiConfig() {
  // Return cached config if available
  if (cachedConfig) {
    return { ...cachedConfig };
  }
  // Fallback to localStorage (for offline access)
  const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
  if (stored) {
    try {
      return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
    } catch (e) {
      console.warn('Failed to parse scanner API config:', e);
    }
  }
  return { ...DEFAULT_CONFIG };
}

/**
 * Set the Scanner API configuration (saves to both localStorage and OneDrive)
 * @param {object} config
 * @param {boolean} syncToCloud - Whether to sync to OneDrive (default: true)
 */
export async function setScannerApiConfig(config, syncToCloud = true) {
  const newConfig = { ...DEFAULT_CONFIG, ...config };

  // Update in-memory cache
  cachedConfig = newConfig;

  // Update localStorage (for offline access)
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(newConfig));

  // Sync to OneDrive for cross-device access
  if (syncToCloud && navigator.onLine) {
    try {
      await oneDriveService.updateSetting('scannerApiConfig', newConfig);
      console.log('Scanner API config synced to OneDrive');
    } catch (error) {
      console.warn('Failed to sync Scanner API config to OneDrive:', error);
      // Config is still saved locally, will sync on next opportunity
    }
  }
}

/**
 * Initialize Scanner API service - loads config from OneDrive
 * Called on app startup after user signs in
 */
export async function initializeScannerApiService() {
  if (isInitialized) return;

  try {
    // FAST PATH: Check localStorage first
    const localConfig = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (localConfig) {
      try {
        cachedConfig = { ...DEFAULT_CONFIG, ...JSON.parse(localConfig) };
        isInitialized = true;
        console.log('Scanner API config loaded from localStorage (fast path)');

        // Schedule background sync from OneDrive (non-blocking)
        if (navigator.onLine) {
          setTimeout(async () => {
            try {
              const settings = await oneDriveService.loadSettings({ skipValidation: true });
              if (settings.scannerApiConfig) {
                cachedConfig = { ...DEFAULT_CONFIG, ...settings.scannerApiConfig };
                localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(cachedConfig));
                console.log('Scanner API config updated from OneDrive (background sync)');
              }
            } catch (e) {
              // Ignore background sync errors
            }
          }, 5000);
        }
        return;
      } catch (e) {
        console.warn('Failed to parse local scanner config:', e);
      }
    }

    // SLOW PATH: No local config, must load from OneDrive
    if (navigator.onLine) {
      const settings = await oneDriveService.loadSettings({ skipValidation: true });
      if (settings.scannerApiConfig) {
        cachedConfig = { ...DEFAULT_CONFIG, ...settings.scannerApiConfig };
        localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(cachedConfig));
        console.log('Scanner API config loaded from OneDrive');
      }
    }
    isInitialized = true;
  } catch (error) {
    console.warn('Failed to load Scanner API config from OneDrive:', error);
    isInitialized = true;
  }
}

/**
 * Check if Scanner API is available and configured
 * @returns {boolean}
 */
export function isScannerApiAvailable() {
  const config = getScannerApiConfig();
  return config.enabled && !!config.apiKey && !!config.apiUrl && navigator.onLine;
}

/**
 * Check if Scanner API is enabled (regardless of online status)
 * @returns {boolean}
 */
export function isScannerApiEnabled() {
  const config = getScannerApiConfig();
  return config.enabled && !!config.apiKey && !!config.apiUrl;
}

/**
 * Convert base64 data URL to Blob
 * @param {string} dataUrl - Base64 data URL
 * @returns {Blob}
 */
function dataUrlToBlob(dataUrl) {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Scan a document using the external Scanner API
 * @param {string|Blob} imageData - Base64 data URL or Blob of the image to scan
 * @param {object} options - Scan options
 * @param {function} onProgress - Progress callback
 * @returns {Promise<Blob>} - Scanned PDF as Blob
 */
export async function scanDocument(imageData, options = {}, onProgress = null) {
  const config = getScannerApiConfig();

  if (!config.enabled) {
    throw new Error('Scanner API is not enabled');
  }

  if (!config.apiKey) {
    throw new Error('Scanner API key not configured');
  }

  if (!config.apiUrl) {
    throw new Error('Scanner API URL not configured');
  }

  if (onProgress) onProgress({ stage: 'Preparing document...', progress: 10 });

  // Create FormData with the image
  const formData = new FormData();

  // Convert dataUrl to Blob if necessary
  let imageBlob;
  if (typeof imageData === 'string' && imageData.startsWith('data:')) {
    imageBlob = dataUrlToBlob(imageData);
  } else if (imageData instanceof Blob) {
    imageBlob = imageData;
  } else {
    throw new Error('Invalid image data format');
  }

  formData.append('image', imageBlob, 'document.jpg');

  // Add any additional options
  if (options.format) {
    formData.append('format', options.format);
  }
  if (options.quality) {
    formData.append('quality', options.quality);
  }
  if (options.dpi) {
    formData.append('dpi', options.dpi);
  }

  if (onProgress) onProgress({ stage: 'Sending to scanner...', progress: 30 });

  // Set up timeout (30 seconds for document scanning)
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const apiEndpoint = config.apiUrl.endsWith('/')
      ? `${config.apiUrl}scan`
      : `${config.apiUrl}/scan`;

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'X-API-Key': config.apiKey
      },
      body: formData,
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (onProgress) onProgress({ stage: 'Processing response...', progress: 70 });

    if (!response.ok) {
      let errorMessage = `Scanner API error: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch (e) {
        // Ignore JSON parse error
      }
      throw new Error(errorMessage);
    }

    // Get the scanned PDF as blob
    const pdfBlob = await response.blob();

    if (onProgress) onProgress({ stage: 'Scan complete', progress: 100 });

    return pdfBlob;

  } catch (error) {
    clearTimeout(timeout);

    if (error.name === 'AbortError') {
      throw new Error('Scanner API request timed out');
    }

    console.error('Scanner API error:', error);
    throw error;
  }
}

/**
 * Test the Scanner API connection
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function testScannerApiConnection() {
  const config = getScannerApiConfig();

  if (!config.apiKey) {
    return { success: false, message: 'API key not configured' };
  }

  if (!config.apiUrl) {
    return { success: false, message: 'API URL not configured' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    // Try to reach the API health endpoint (if available) or just check if URL is reachable
    const healthUrl = config.apiUrl.endsWith('/')
      ? `${config.apiUrl}health`
      : `${config.apiUrl}/health`;

    const response = await fetch(healthUrl, {
      method: 'GET',
      headers: {
        'X-API-Key': config.apiKey
      },
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (response.ok) {
      return { success: true, message: 'Connection successful!' };
    } else if (response.status === 401 || response.status === 403) {
      return { success: false, message: 'Invalid API key' };
    } else if (response.status === 404) {
      // Health endpoint might not exist, but API might still work
      return { success: true, message: 'API reachable (health endpoint not found)' };
    } else {
      return { success: false, message: `API returned status ${response.status}` };
    }
  } catch (error) {
    clearTimeout(timeout);

    if (error.name === 'AbortError') {
      return { success: false, message: 'Connection timed out' };
    }

    // Check for CORS or network errors
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      return {
        success: false,
        message: 'Cannot reach API. Check if the server is running and CORS is enabled.'
      };
    }

    return { success: false, message: error.message };
  }
}

/**
 * Download a scanned PDF
 * @param {Blob} pdfBlob - The PDF blob to download
 * @param {string} filename - The filename for the download
 */
export function downloadScannedPdf(pdfBlob, filename = 'scanned_document.pdf') {
  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default {
  getScannerApiConfig,
  setScannerApiConfig,
  initializeScannerApiService,
  isScannerApiAvailable,
  isScannerApiEnabled,
  scanDocument,
  testScannerApiConnection,
  downloadScannedPdf
};
