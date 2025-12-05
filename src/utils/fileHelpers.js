/**
 * File Type Helper Functions
 */

/**
 * Check if mime type represents a folder
 * @param {string} mimeType - MIME type
 * @returns {boolean}
 */
export function isFolder(mimeType) {
  return mimeType === 'application/vnd.google-apps.folder' || mimeType === 'folder';
}

/**
 * Check if mime type represents an image
 * @param {string} mimeType - MIME type
 * @returns {boolean}
 */
export function isImage(mimeType) {
  return mimeType?.startsWith('image/');
}

/**
 * Check if mime type represents a PDF
 * @param {string} mimeType - MIME type
 * @returns {boolean}
 */
export function isPdf(mimeType) {
  return mimeType === 'application/pdf';
}

/**
 * Check if mime type represents a spreadsheet
 * @param {string} mimeType - MIME type
 * @returns {boolean}
 */
export function isSpreadsheet(mimeType) {
  return mimeType?.includes('spreadsheet') ||
    mimeType?.includes('excel') ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.ms-excel';
}

/**
 * Check if mime type represents a Word document
 * @param {string} mimeType - MIME type
 * @returns {boolean}
 */
export function isWordDoc(mimeType) {
  return mimeType?.includes('word') ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword';
}

/**
 * Get file icon based on mime type
 * @param {string} mimeType - MIME type
 * @returns {string} Emoji icon
 */
export function getFileIcon(mimeType) {
  if (isFolder(mimeType)) return '📁';
  if (isImage(mimeType)) return '🖼️';
  if (isPdf(mimeType)) return '📄';
  if (isSpreadsheet(mimeType)) return '📊';
  if (isWordDoc(mimeType)) return '📝';
  return '📎';
}

