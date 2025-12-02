/**
 * Formatting Utility Functions
 */

/**
 * Format file size to human readable string
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
export function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Format date to locale string
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date
 */
export function formatDate(dateString) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString();
}

/**
 * Format customer date (handles various date formats)
 * @param {string} dateString - Date string
 * @returns {string} Formatted date or original string
 */
export function formatCustomerDate(dateString) {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString();
  } catch {
    return dateString;
  }
}

/**
 * Format currency value
 * @param {number|string} value - Currency value
 * @param {string} currency - Currency symbol (default: '$')
 * @returns {string} Formatted currency
 */
export function formatCurrency(value, currency = '$') {
  if (value === null || value === undefined || value === '') return '';
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return `${currency}${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format phone number
 * @param {string} phone - Phone number
 * @returns {string} Formatted phone or original
 */
export function formatPhone(phone) {
  if (!phone) return '';
  // Remove non-digits
  const digits = phone.replace(/\D/g, '');
  // Format as Singapore number if 8 digits
  if (digits.length === 8) {
    return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  }
  return phone;
}
