import { createWorker } from 'tesseract.js';

/**
 * ID Parser Service
 * Handles OCR processing and extraction of Singapore NRIC/FIN details
 */

// NRIC/FIN regex patterns
const NRIC_PATTERN = /[STFGM]\d{7}[A-Z]/gi;

// Date patterns (DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY)
const DATE_PATTERN = /(\d{1,2})[-/.]\s*(\d{1,2})[-/.]\s*(\d{4})/g;

// Singapore address pattern (Block, Street, Unit, Postal)
const POSTAL_CODE_PATTERN = /\b\d{6}\b/g;

// Singleton worker instance for better performance
let workerInstance = null;
let workerInitializing = false;
let workerInitPromise = null;

/**
 * Get or create the Tesseract worker
 */
const getWorker = async () => {
  if (workerInstance) {
    return workerInstance;
  }

  if (workerInitializing) {
    return workerInitPromise;
  }

  workerInitializing = true;
  workerInitPromise = (async () => {
    try {
      console.log('Initializing Tesseract worker...');
      const worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status) {
            console.log(`Tesseract: ${m.status} ${m.progress ? Math.round(m.progress * 100) + '%' : ''}`);
          }
        }
      });
      workerInstance = worker;
      console.log('Tesseract worker initialized successfully');
      return worker;
    } catch (error) {
      console.error('Failed to initialize Tesseract worker:', error);
      workerInitializing = false;
      throw error;
    }
  })();

  return workerInitPromise;
};

/**
 * Perform OCR on an image
 * @param {string} imageDataUrl - Base64 data URL of the image
 * @param {function} onProgress - Progress callback
 * @returns {Promise<string>} - Extracted text
 */
export const performOCR = async (imageDataUrl, onProgress = null) => {
  try {
    const worker = await getWorker();

    if (onProgress) onProgress(10);

    const result = await worker.recognize(imageDataUrl);

    if (onProgress) onProgress(100);

    return result.data.text;
  } catch (error) {
    console.error('OCR error:', error);
    // Reset worker on error so it can be re-initialized
    workerInstance = null;
    workerInitializing = false;
    throw new Error(`Failed to process image: ${error.message}`);
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
 * Names on Singapore ICs appear after "NAME" label
 * @param {string} text - OCR text
 * @returns {string|null} - Extracted name
 */
export const extractName = (text) => {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Look for name after "NAME" label
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toUpperCase();
    if (line.includes('NAME')) {
      // Name might be on the same line after "NAME" or on the next line
      const afterName = line.split(/NAME\s*/i)[1];
      if (afterName && afterName.length > 2) {
        // Clean up the name
        return cleanName(afterName);
      }
      // Check next line
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        if (nextLine.length > 2 && !nextLine.match(NRIC_PATTERN) && !nextLine.match(/RACE|SEX|DATE/i)) {
          return cleanName(nextLine);
        }
      }
    }
  }

  // Alternative: Look for lines that look like names (all caps, multiple words, no numbers)
  for (const line of lines) {
    const cleaned = line.replace(/[^A-Za-z\s@]/g, '').trim();
    // Names are usually 2-5 words, all letters
    const words = cleaned.split(/\s+/).filter(w => w.length > 1);
    if (words.length >= 2 && words.length <= 6 && cleaned.length > 5) {
      // Check if it's likely a name (not a label)
      const isLabel = /^(NAME|NRIC|DATE|BIRTH|SEX|RACE|ADDRESS|COUNTRY|REPUBLIC|SINGAPORE)$/i.test(cleaned);
      if (!isLabel && !line.match(/\d/)) {
        return cleanName(cleaned);
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
  // Remove common OCR artifacts and IC labels
  let cleaned = name
    .replace(/[^A-Za-z\s@']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

  // Remove common misreads
  cleaned = cleaned.replace(/^(NAME|THE|IC)\s*/i, '');

  // Title case the name
  return cleaned
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
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
  const addressLines = [];
  let isAddressSection = false;

  for (const line of lines) {
    const upperLine = line.toUpperCase();

    // Start collecting after "ADDRESS" label
    if (upperLine.includes('ADDRESS')) {
      isAddressSection = true;
      // Check if address is on the same line
      const afterAddress = line.split(/ADDRESS\s*/i)[1];
      if (afterAddress && afterAddress.length > 3) {
        addressLines.push(afterAddress.trim());
      }
      continue;
    }

    // Collect address lines
    if (isAddressSection) {
      // Stop at certain keywords
      if (upperLine.match(/^(SEX|RACE|DATE|COUNTRY|ISSUE|EXPIRY)/)) {
        break;
      }

      // Check for postal code (indicates end of address)
      const postalMatch = line.match(POSTAL_CODE_PATTERN);
      if (postalMatch) {
        addressLines.push(line);
        break;
      }

      // Add line if it looks like address content
      if (line.length > 2) {
        addressLines.push(line);
      }
    }
  }

  // If no explicit address section found, look for Singapore postal code
  if (addressLines.length === 0) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(POSTAL_CODE_PATTERN)) {
        // Include this line and up to 2 lines before it
        const start = Math.max(0, i - 2);
        addressLines.push(...lines.slice(start, i + 1));
        break;
      }
    }
  }

  // Format address into two parts
  if (addressLines.length === 0) {
    return { address: '', addressContinue: '' };
  }

  const fullAddress = addressLines.join(' ').replace(/\s+/g, ' ').trim();

  // Try to split at postal code for address and addressContinue
  const postalMatch = fullAddress.match(POSTAL_CODE_PATTERN);
  if (postalMatch) {
    const postalIndex = fullAddress.indexOf(postalMatch[0]);
    const beforePostal = fullAddress.substring(0, postalIndex).trim();
    const postalAndAfter = fullAddress.substring(postalIndex).trim();

    return {
      address: beforePostal.toUpperCase(),
      addressContinue: `SINGAPORE ${postalAndAfter}`.toUpperCase()
    };
  }

  // Split in half if no postal code
  const midpoint = Math.ceil(fullAddress.length / 2);
  const spaceIndex = fullAddress.indexOf(' ', midpoint);

  if (spaceIndex > 0) {
    return {
      address: fullAddress.substring(0, spaceIndex).toUpperCase(),
      addressContinue: fullAddress.substring(spaceIndex + 1).toUpperCase()
    };
  }

  return {
    address: fullAddress.toUpperCase(),
    addressContinue: ''
  };
};

/**
 * Process ID images and extract all relevant information
 * @param {string} frontImageData - Base64 data URL of front image
 * @param {string} backImageData - Base64 data URL of back image (optional)
 * @param {function} onProgress - Progress callback ({ stage, progress })
 * @returns {Promise<object>} - Extracted data
 */
export const processIDImages = async (frontImageData, backImageData = null, onProgress = null) => {
  const result = {
    name: '',
    nric: '',
    dob: '',
    address: '',
    addressContinue: '',
    rawTextFront: '',
    rawTextBack: '',
    confidence: 0
  };

  let fieldsFound = 0;
  const totalFields = 4; // name, nric, dob, address

  try {
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
  processIDImages
};
