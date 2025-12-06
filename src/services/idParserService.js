/**
 * ID Parser Service
 * Handles OCR processing and extraction of Singapore NRIC/FIN details
 *
 * EXTRACTION METHODS:
 * 1. Primary: Gemini AI (fast, highly accurate when API key is configured)
 * 2. Fallback: Tesseract.js OCR (works offline, lower accuracy)
 *
 * NOTE: tesseract.js is lazy-loaded to reduce initial bundle size (~6.8MB)
 *
 * PERFORMANCE OPTIMIZATIONS:
 * - Worker pooling: Reuses Tesseract workers instead of creating new ones
 * - Image preprocessing: Resizes and enhances images for faster OCR
 * - Parallel processing: Processes front+back images simultaneously
 */

import { isGeminiAvailable, extractIDWithGemini, initializeGeminiService } from './geminiService';

// NRIC/FIN regex patterns
const NRIC_PATTERN = /[STFGM]\d{7}[A-Z]/gi;

// Date patterns (DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY)
const DATE_PATTERN = /(\d{1,2})[-/.]\s*(\d{1,2})[-/.]\s*(\d{4})/g;

// Singapore address pattern (Block, Street, Unit, Postal)
const POSTAL_CODE_PATTERN = /\b\d{6}\b/g;

// Cache the tesseract module after first load
let tesseractModule = null;

// Worker pool for reusing Tesseract workers (major performance improvement)
let workerPool = null;
let isWorkerInitializing = false;
let workerInitPromise = null;

/**
 * Lazy load tesseract.js module
 * @returns {Promise<{createWorker: Function}>}
 */
const loadTesseract = async () => {
  if (!tesseractModule) {
    tesseractModule = await import('tesseract.js');
  }
  return tesseractModule;
};

/**
 * Get or create a reusable Tesseract worker
 * Workers are expensive to create (3-5s), so we reuse them
 * @returns {Promise<Worker>}
 */
const getWorker = async () => {
  // Return existing worker if available
  if (workerPool) return workerPool;

  // If another call is initializing, wait for it
  if (isWorkerInitializing && workerInitPromise) {
    return workerInitPromise;
  }

  // Initialize new worker
  isWorkerInitializing = true;
  workerInitPromise = (async () => {
    const { createWorker } = await loadTesseract();
    workerPool = await createWorker('eng');
    isWorkerInitializing = false;
    return workerPool;
  })();

  return workerInitPromise;
};

/**
 * Cleanup OCR worker - call when done with ID scanning
 * @returns {Promise<void>}
 */
export const cleanupOCRWorker = async () => {
  if (workerPool) {
    try {
      await workerPool.terminate();
    } catch (e) {
      console.error('Worker termination error:', e);
    }
    workerPool = null;
    workerInitPromise = null;
  }
};

/**
 * Preprocess image for optimal OCR performance
 * - Resizes to optimal dimensions (faster processing)
 * - Enhances contrast for better text recognition
 * @param {string} imageDataUrl - Base64 data URL of the image
 * @returns {Promise<string>} - Optimized image data URL
 */
const preprocessImageForOCR = async (imageDataUrl) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');

      // Optimal width for ID card OCR (maintains ~300 DPI equivalent)
      // Smaller than raw camera (1920px) but enough for accurate text recognition
      const targetWidth = 1000;
      const scale = Math.min(targetWidth / img.width, 1); // Don't upscale
      const newWidth = Math.round(img.width * scale);
      const newHeight = Math.round(img.height * scale);

      canvas.width = newWidth;
      canvas.height = newHeight;

      const ctx = canvas.getContext('2d');

      // High-quality downscaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, newWidth, newHeight);

      // Apply contrast enhancement for better OCR
      const imageData = ctx.getImageData(0, 0, newWidth, newHeight);
      const data = imageData.data;

      // Contrast factor (10% increase)
      const contrastFactor = 1.1;
      const brightness = 5;

      for (let i = 0; i < data.length; i += 4) {
        // Apply brightness and contrast
        data[i] = Math.min(255, Math.max(0, contrastFactor * (data[i] - 128) + 128 + brightness));
        data[i + 1] = Math.min(255, Math.max(0, contrastFactor * (data[i + 1] - 128) + 128 + brightness));
        data[i + 2] = Math.min(255, Math.max(0, contrastFactor * (data[i + 2] - 128) + 128 + brightness));
      }

      ctx.putImageData(imageData, 0, 0);

      // High quality JPEG for better print output
      resolve(canvas.toDataURL('image/jpeg', 0.95));
    };
    img.onerror = () => {
      // On error, return original image
      resolve(imageDataUrl);
    };
    img.src = imageDataUrl;
  });
};

/**
 * Perform OCR on an image using Tesseract.js
 * Uses worker pooling for performance (avoids 3-5s worker creation overhead)
 * @param {string} imageDataUrl - Base64 data URL of the image
 * @param {function} onProgress - Progress callback
 * @returns {Promise<string>} - Extracted text
 */
export const performOCR = async (imageDataUrl, onProgress = null) => {
  try {
    if (onProgress) onProgress(5);

    // Preprocess image for faster OCR
    const optimizedImage = await preprocessImageForOCR(imageDataUrl);

    if (onProgress) onProgress(15);

    // Get reusable worker (fast if already initialized)
    const worker = await getWorker();

    if (onProgress) onProgress(30);

    const result = await worker.recognize(optimizedImage);

    if (onProgress) onProgress(100);

    // Don't terminate worker - keep it for next use
    return result.data.text;
  } catch (error) {
    // On error, cleanup worker so next call creates fresh one
    await cleanupOCRWorker();
    throw new Error(`OCR failed: ${error.message || 'Unknown error'}`);
  }
};

/**
 * Extract NRIC/FIN from text
 * @param {string} text - OCR text
 * @returns {string|null} - Extracted NRIC/FIN
 */
export const extractNRIC = (text) => {
  const matches = text.match(NRIC_PATTERN);
  if (matches && matches.length > 0) {
    // Return the first valid NRIC found (uppercase)
    return matches[0].toUpperCase();
  }
  return null;
};

/**
 * Extract name from Singapore IC text
 * Names on Singapore ICs appear after "Name" label
 * @param {string} text - OCR text
 * @returns {string|null} - Extracted name
 */
export const extractName = (text) => {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  console.log('Extracting name from lines:', lines);

  // Look for name after "Name" label - Singapore IC specific
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upperLine = line.toUpperCase();

    // Check if this line contains "NAME" label
    if (upperLine.includes('NAME') && !upperLine.includes('SURNAME')) {
      // Try to get name from the same line after "Name"
      const nameMatch = line.match(/NAME\s*[:\.]?\s*(.+)/i);
      if (nameMatch && nameMatch[1] && nameMatch[1].length > 3) {
        const potentialName = nameMatch[1].trim();
        // Make sure it's not another label
        if (!potentialName.match(/^(NRIC|RACE|SEX|DATE|BIRTH)/i)) {
          console.log('Found name on same line:', potentialName);
          return cleanName(potentialName);
        }
      }

      // Name is likely on the next line(s)
      // Singapore ICs often have the name on 1-2 lines after "Name"
      for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
        const nextLine = lines[j].trim();
        // Skip if it's another label or contains NRIC pattern
        if (nextLine.match(/^(RACE|SEX|DATE|BIRTH|COUNTRY|NRIC)/i)) continue;
        if (nextLine.match(NRIC_PATTERN)) continue;
        if (nextLine.length < 3) continue;

        // Check if line looks like a name (has letters, possibly comma for surname)
        if (nextLine.match(/[A-Za-z]{2,}/)) {
          // If it contains Chinese characters in parentheses, it's likely the name line
          if (nextLine.includes('(') || nextLine.match(/[A-Z]{2,}\s+[A-Z]{2,}/)) {
            console.log('Found name on next line:', nextLine);
            return cleanName(nextLine);
          }
        }
      }
    }
  }

  // Fallback: Look for lines that look like full names (SURNAME, GIVEN NAME format)
  for (const line of lines) {
    // Singapore IC names are often in format: "SURNAME, GIVEN NAME" or "GIVEN NAME SURNAME"
    // They're usually in ALL CAPS and may have Chinese name in parentheses
    if (line.match(/^[A-Z][A-Z\s,]+[A-Z]$/)) {
      // All caps with possibly comma - likely a name
      const words = line.replace(/,/g, ' ').split(/\s+/).filter(w => w.length > 0);
      if (words.length >= 2 && words.length <= 5) {
        // Check it's not a label
        const isLabel = /^(REPUBLIC|SINGAPORE|IDENTITY|CARD)/i.test(line);
        if (!isLabel) {
          console.log('Found name by pattern:', line);
          return cleanName(line);
        }
      }
    }
  }

  // Last resort: find any line with comma that looks like "SURNAME, FIRSTNAME"
  for (const line of lines) {
    if (line.includes(',') && line.match(/^[A-Z]/)) {
      const parts = line.split(',');
      if (parts.length === 2 && parts[0].length > 1 && parts[1].trim().length > 1) {
        if (!line.match(/SINGAPORE|REPUBLIC|IDENTITY|CARD|DATE|NRIC/i)) {
          console.log('Found name with comma:', line);
          return cleanName(line);
        }
      }
    }
  }

  return null;
};

/**
 * Clean and format name
 * @param {string} name - Raw name string
 * @returns {string} - Cleaned name
 */
const cleanName = (name) => {
  // Remove Chinese characters in parentheses but keep the English name
  let cleaned = name.replace(/\([^)]*[\u4e00-\u9fff][^)]*\)/g, '').trim();

  // Remove common OCR artifacts
  cleaned = cleaned
    .replace(/[^A-Za-z\s,@'.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Remove common misreads and labels
  cleaned = cleaned.replace(/^(NAME|THE|IC|NO|CARD)\s*/i, '');

  // If name has comma (SURNAME, GIVEN), keep as is but title case
  if (cleaned.includes(',')) {
    return cleaned
      .split(',')
      .map(part => part.trim().toLowerCase().split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' '))
      .join(', ');
  }

  // Title case the name
  return cleaned
    .toUpperCase()
    .split(' ')
    .filter(w => w.length > 0)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Extract date of birth from text
 * @param {string} text - OCR text
 * @returns {string|null} - Date in YYYY-MM-DD format for input type="date"
 */
export const extractDateOfBirth = (text) => {
  // Look for "DATE OF BIRTH" or "DOB" context
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toUpperCase();
    if (line.includes('BIRTH') || line.includes('DOB')) {
      // Search this line and next few lines for a date
      const searchText = lines.slice(i, i + 3).join(' ');
      const dateMatch = searchText.match(DATE_PATTERN);
      if (dateMatch) {
        return parseDate(dateMatch[0]);
      }
    }
  }

  // If no DOB context found, look for any date in the text
  const allDates = text.match(DATE_PATTERN);
  if (allDates && allDates.length > 0) {
    // Return the first date that looks like a birth date (year between 1920-2010)
    for (const dateStr of allDates) {
      const parsed = parseDate(dateStr);
      if (parsed) {
        const year = parseInt(parsed.split('-')[0]);
        if (year >= 1920 && year <= 2010) {
          return parsed;
        }
      }
    }
  }

  return null;
};

/**
 * Parse date string to YYYY-MM-DD format
 * @param {string} dateStr - Date string in DD-MM-YYYY format
 * @returns {string|null} - Date in YYYY-MM-DD format
 */
const parseDate = (dateStr) => {
  const match = dateStr.match(/(\d{1,2})[-/.]\s*(\d{1,2})[-/.]\s*(\d{4})/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const year = match[3];

    // Validate date
    const dateObj = new Date(`${year}-${month}-${day}`);
    if (!isNaN(dateObj.getTime())) {
      return `${year}-${month}-${day}`;
    }
  }
  return null;
};

/**
 * Extract address from text (typically from back of IC)
 * @param {string} text - OCR text
 * @returns {object} - { address: string, addressContinue: string }
 */
export const extractAddress = (text) => {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  console.log('Extracting address from lines:', lines);

  // Singapore address keywords to look for
  const addressKeywords = /\b(BLK|BLOCK|APT|STREET|ST|AVE|AVENUE|ROAD|RD|DRIVE|DR|LANE|LN|TERRACE|TER|CRESCENT|CRES|WALK|PLACE|PL|CLOSE|CL|RISE|HILL|PARK|GARDEN|GDN|COURT|CT|HEIGHTS|HTS|VIEW|LORONG|LOR|JALAN|JLN|TAMAN|TMN|KAMPONG|KG)\b/i;
  const unitPattern = /#\d{1,2}-\d{1,4}/;

  let addressLines = [];
  let foundAddressStart = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upperLine = line.toUpperCase();

    // Look for address indicators
    const hasAddressKeyword = addressKeywords.test(line);
    const hasUnit = unitPattern.test(line);
    const hasPostalCode = POSTAL_CODE_PATTERN.test(line);

    // Skip obvious non-address lines
    if (upperLine.match(/^(NRIC|NAME|RACE|SEX|DATE|BIRTH|COUNTRY|ISSUE|EXPIRY|IDENTITY|REPUBLIC)/)) {
      continue;
    }

    // If we find an address keyword, unit number, or postal code, start collecting
    if (hasAddressKeyword || hasUnit || hasPostalCode) {
      foundAddressStart = true;

      // Clean the line - remove obvious garbage
      let cleanedLine = line
        .replace(/^[-—_=~|]+/, '')  // Remove leading dashes/lines
        .replace(/[-—_=~|]+$/, '')  // Remove trailing dashes/lines
        .replace(/[^\w\s#,.-]/g, ' ')  // Remove special chars except common address ones
        .replace(/\s+/g, ' ')
        .trim();

      if (cleanedLine.length > 3) {
        addressLines.push(cleanedLine);
      }

      // If we found postal code, we're at the end of address
      if (hasPostalCode) {
        break;
      }
    } else if (foundAddressStart) {
      // Continue collecting until we hit something that's clearly not address
      if (upperLine.match(/(SINGAPORE|S'PORE)/) || line.match(/^\d{6}$/)) {
        addressLines.push(line);
        break;
      }
    }
  }

  // If no address found with keywords, look for postal code and work backwards
  if (addressLines.length === 0) {
    for (let i = 0; i < lines.length; i++) {
      const postalMatch = lines[i].match(/\b(\d{6})\b/);
      if (postalMatch) {
        // Found postal code, look for address lines before it
        const postalLine = lines[i];

        // Check 1-3 lines before for address content
        for (let j = Math.max(0, i - 3); j <= i; j++) {
          const checkLine = lines[j];
          if (addressKeywords.test(checkLine) || unitPattern.test(checkLine) || j === i) {
            let cleanedLine = checkLine
              .replace(/^[-—_=~|]+/, '')
              .replace(/[-—_=~|]+$/, '')
              .replace(/[^\w\s#,.-]/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();

            if (cleanedLine.length > 3 && !cleanedLine.match(/^(NRIC|DATE|ISSUE)/i)) {
              addressLines.push(cleanedLine);
            }
          }
        }
        break;
      }
    }
  }

  // Format address into two parts
  if (addressLines.length === 0) {
    return { address: '', addressContinue: '' };
  }

  // Join and clean the full address
  let fullAddress = addressLines.join(' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .trim()
    .toUpperCase();

  console.log('Full address before split:', fullAddress);

  // Extract postal code
  const postalMatch = fullAddress.match(/\b(\d{6})\b/);
  if (postalMatch) {
    const postalCode = postalMatch[1];
    const postalIndex = fullAddress.indexOf(postalCode);

    // Everything before postal is street address
    let streetAddress = fullAddress.substring(0, postalIndex).trim();
    // Remove trailing "SINGAPORE" if present
    streetAddress = streetAddress.replace(/,?\s*SINGAPORE\s*$/i, '').trim();
    // Remove trailing punctuation
    streetAddress = streetAddress.replace(/[,\s]+$/, '').trim();

    return {
      address: streetAddress,
      addressContinue: `SINGAPORE ${postalCode}`
    };
  }

  // No postal code found, return as-is
  return {
    address: fullAddress,
    addressContinue: ''
  };
};

/**
 * Process ID images using Tesseract OCR (fallback method)
 * @param {string} frontImageData - Base64 data URL of front image
 * @param {string} backImageData - Base64 data URL of back image (optional)
 * @param {function} onProgress - Progress callback ({ stage, progress })
 * @returns {Promise<object>} - Extracted data
 */
const processIDImagesWithTesseract = async (frontImageData, backImageData = null, onProgress = null) => {
  const result = {
    name: '',
    nric: '',
    dob: '',
    address: '',
    addressContinue: '',
    rawTextFront: '',
    rawTextBack: '',
    confidence: 0,
    method: 'tesseract'
  };

  let fieldsFound = 0;
  const totalFields = 4; // name, nric, dob, address

  // Process front image
  if (onProgress) onProgress({ stage: 'Processing front of ID...', progress: 0 });

  const frontText = await performOCR(frontImageData, (progress) => {
    if (onProgress) onProgress({ stage: 'Processing front of ID...', progress: progress * 0.4 });
  });
  result.rawTextFront = frontText;

  // Extract from front
  const nric = extractNRIC(frontText);
  if (nric) {
    result.nric = nric;
    fieldsFound++;
  }

  const name = extractName(frontText);
  if (name) {
    result.name = name;
    fieldsFound++;
  }

  const dob = extractDateOfBirth(frontText);
  if (dob) {
    result.dob = dob;
    fieldsFound++;
  }

  // Process back image if provided
  if (backImageData) {
    if (onProgress) onProgress({ stage: 'Processing back of ID...', progress: 50 });

    const backText = await performOCR(backImageData, (progress) => {
      if (onProgress) onProgress({ stage: 'Processing back of ID...', progress: 50 + (progress * 0.4) });
    });
    result.rawTextBack = backText;

    // Extract address from back
    const addressData = extractAddress(backText);
    if (addressData.address || addressData.addressContinue) {
      result.address = addressData.address;
      result.addressContinue = addressData.addressContinue;
      fieldsFound++;
    }

    // Also check front for address if not found on back
    if (!result.address) {
      const frontAddressData = extractAddress(frontText);
      if (frontAddressData.address) {
        result.address = frontAddressData.address;
        result.addressContinue = frontAddressData.addressContinue;
        fieldsFound++;
      }
    }
  }

  // Calculate confidence based on fields extracted
  result.confidence = Math.round((fieldsFound / totalFields) * 100);

  if (onProgress) onProgress({ stage: 'Complete', progress: 100 });

  return result;
};

/**
 * Process ID images and extract all relevant information
 * Uses Gemini AI when available (faster, more accurate), falls back to Tesseract OCR
 *
 * @param {string} frontImageData - Base64 data URL of front image
 * @param {string} backImageData - Base64 data URL of back image (optional)
 * @param {function} onProgress - Progress callback ({ stage, progress })
 * @returns {Promise<object>} - Extracted data
 */
export const processIDImages = async (frontImageData, backImageData = null, onProgress = null) => {
  try {
    // Ensure Gemini service is initialized (loads API key from OneDrive if not already loaded)
    // This is important for cross-device sync - the key might not be in localStorage on this device
    await initializeGeminiService();

    // Try Gemini AI first if available (fast, accurate, requires API key + internet)
    if (isGeminiAvailable()) {
      try {
        console.log('Using Gemini AI for ID extraction...');
        if (onProgress) onProgress({ stage: 'Using AI scanner...', progress: 5 });

        const geminiResult = await extractIDWithGemini(frontImageData, backImageData, onProgress);

        // If Gemini returned good results, use them
        if (geminiResult && (geminiResult.nric || geminiResult.name)) {
          console.log('Gemini AI extraction successful:', geminiResult.confidence + '% confidence');
          return geminiResult;
        }

        // If Gemini returned empty results, fall through to Tesseract
        console.log('Gemini returned no results, falling back to Tesseract...');
      } catch (geminiError) {
        console.warn('Gemini AI extraction failed, falling back to Tesseract:', geminiError.message);
        // Fall through to Tesseract
      }
    } else {
      console.log('Gemini AI not available (no API key or offline), using Tesseract OCR...');
    }

    // Fallback to Tesseract OCR
    if (onProgress) onProgress({ stage: 'Using OCR scanner...', progress: 5 });
    return await processIDImagesWithTesseract(frontImageData, backImageData, onProgress);
  } catch (error) {
    console.error('ID processing error:', error);
    throw error;
  }
};

export default {
  performOCR,
  extractNRIC,
  extractName,
  extractDateOfBirth,
  extractAddress,
  processIDImages,
  cleanupOCRWorker
};
