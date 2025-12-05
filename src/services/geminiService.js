/**
 * Gemini AI Service
 * Uses Google's Gemini Flash model for accurate ID document parsing
 *
 * Features:
 * - High accuracy ID card text extraction
 * - Structured data extraction (name, NRIC, DOB, address)
 * - Falls back gracefully when offline or API unavailable
 * - API key synced across devices via OneDrive
 */

import oneDriveService from './oneDriveService';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// LocalStorage key for API key (cached locally for offline use)
const API_KEY_STORAGE_KEY = 'bydcrm_gemini_api_key';

// In-memory cache for API key (loaded from OneDrive)
let cachedApiKey = null;
let isInitialized = false;

/**
 * Get the Gemini API key from cache or localStorage
 * @returns {string|null}
 */
export function getGeminiApiKey() {
  // Return cached key if available
  if (cachedApiKey) {
    return cachedApiKey;
  }
  // Fallback to localStorage (for offline access)
  return localStorage.getItem(API_KEY_STORAGE_KEY);
}

/**
 * Set the Gemini API key (saves to both localStorage and OneDrive)
 * @param {string} apiKey
 * @param {boolean} syncToCloud - Whether to sync to OneDrive (default: true)
 */
export async function setGeminiApiKey(apiKey, syncToCloud = true) {
  // Update in-memory cache
  cachedApiKey = apiKey || null;

  // Update localStorage (for offline access)
  if (apiKey) {
    localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
  } else {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
  }

  // Sync to OneDrive for cross-device access
  if (syncToCloud && navigator.onLine) {
    try {
      await oneDriveService.updateSetting('geminiApiKey', apiKey || null);
      console.log('Gemini API key synced to OneDrive');
    } catch (error) {
      console.warn('Failed to sync Gemini API key to OneDrive:', error);
      // Key is still saved locally, will sync on next opportunity
    }
  }
}

/**
 * Initialize Gemini service - loads API key from OneDrive
 * Called on app startup after user signs in
 */
export async function initializeGeminiService() {
  if (isInitialized) return;

  try {
    if (navigator.onLine) {
      const settings = await oneDriveService.loadSettings();
      if (settings.geminiApiKey) {
        cachedApiKey = settings.geminiApiKey;
        // Update localStorage for offline access
        localStorage.setItem(API_KEY_STORAGE_KEY, settings.geminiApiKey);
        console.log('Gemini API key loaded from OneDrive');
      }
    }
    isInitialized = true;
  } catch (error) {
    console.warn('Failed to load Gemini settings from OneDrive:', error);
    // Will use localStorage as fallback
    isInitialized = true;
  }
}

/**
 * Check if Gemini AI is available (has API key and online)
 * @returns {boolean}
 */
export function isGeminiAvailable() {
  return !!getGeminiApiKey() && navigator.onLine;
}

/**
 * Convert base64 data URL to base64 string (without prefix)
 * @param {string} dataUrl
 * @returns {string}
 */
function dataUrlToBase64(dataUrl) {
  // Remove the data:image/...;base64, prefix
  const base64Index = dataUrl.indexOf('base64,');
  if (base64Index !== -1) {
    return dataUrl.substring(base64Index + 7);
  }
  return dataUrl;
}

/**
 * Extract ID details using Gemini AI
 * @param {string} frontImageData - Base64 data URL of front of ID
 * @param {string} backImageData - Base64 data URL of back of ID (optional)
 * @param {function} onProgress - Progress callback
 * @returns {Promise<object>} - Extracted data
 */
export async function extractIDWithGemini(frontImageData, backImageData = null, onProgress = null) {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    throw new Error('Gemini API key not configured');
  }

  if (onProgress) onProgress({ stage: 'Analyzing ID with AI...', progress: 10 });

  // Build the prompt for structured extraction
  const prompt = `You are analyzing a Singapore NRIC/FIN identity card. Extract the following information from the image(s):

1. Full Name (as shown on the card)
2. NRIC/FIN number (format: S/T/F/G/M followed by 7 digits and a letter, e.g., S1234567A)
3. Date of Birth (convert to YYYY-MM-DD format)
4. Address (from the back of the card if provided)

IMPORTANT:
- Return ONLY valid JSON, no markdown or explanations
- If a field is not visible or readable, use empty string ""
- For the address, split into two parts: main address and "SINGAPORE XXXXXX" (postal code)

Return the data in this exact JSON format:
{
  "name": "FULL NAME HERE",
  "nric": "S1234567A",
  "dob": "1990-01-15",
  "address": "BLK 123 STREET NAME #01-234",
  "addressContinue": "SINGAPORE 123456",
  "confidence": 95
}

The confidence should be 0-100 based on how clearly you could read the information.`;

  // Prepare the request with images
  const imageParts = [];

  // Add front image
  imageParts.push({
    inlineData: {
      mimeType: 'image/jpeg',
      data: dataUrlToBase64(frontImageData)
    }
  });

  // Add back image if provided
  if (backImageData) {
    imageParts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: dataUrlToBase64(backImageData)
      }
    });
  }

  if (onProgress) onProgress({ stage: 'Processing with AI...', progress: 30 });

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            ...imageParts
          ]
        }],
        generationConfig: {
          temperature: 0.1, // Low temperature for more consistent extraction
          maxOutputTokens: 1024,
        }
      })
    });

    if (onProgress) onProgress({ stage: 'Parsing results...', progress: 80 });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();

    // Extract the text response
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textResponse) {
      throw new Error('No response from Gemini');
    }

    // Parse the JSON from the response (handle markdown code blocks)
    let jsonStr = textResponse.trim();

    // Remove markdown code blocks if present
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();

    const result = JSON.parse(jsonStr);

    if (onProgress) onProgress({ stage: 'Complete', progress: 100 });

    return {
      name: result.name || '',
      nric: result.nric?.toUpperCase() || '',
      dob: result.dob || '',
      address: result.address || '',
      addressContinue: result.addressContinue || '',
      confidence: result.confidence || 0,
      rawTextFront: `[Extracted by Gemini AI]`,
      rawTextBack: backImageData ? `[Extracted by Gemini AI]` : '',
      method: 'gemini'
    };

  } catch (error) {
    console.error('Gemini extraction failed:', error);
    throw error;
  }
}

export default {
  getGeminiApiKey,
  setGeminiApiKey,
  isGeminiAvailable,
  extractIDWithGemini,
  initializeGeminiService
};
