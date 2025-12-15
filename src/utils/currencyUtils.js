/**
 * Currency utilities for consistent formatting across the application
 * Values are stored as plain numbers for Excel compatibility
 */

// Currency fields across all tabs
export const CURRENCY_FIELDS = {
  // Proposal tab fields
  proposal: [
    'sellingPrice',
    'downpayment',
    'loanAmount',
    'adminFee',
    'referralFee',
    'quotedTradeInPrice',
    'lowLoanSurcharge',
    'noLoanSurcharge',
  ],
  // VSA tab fields (stored with vsa_ prefix in customer data)
  vsa: [
    'sellingWithCOE',
    'sellingPriceList',
    'purchasePriceWithCOE',
    'deposit',
    'lessOthers',
    'addOthers',
    'tradeInAmount',
    'tradeInSettlementCost',
    'insuranceFee',
    'insuranceSubsidy',
    'loanAmount',
    'adminFee',
    'monthlyRepayment',
  ],
  // Invoice tab fields
  invoice: [
    'roadTax',
    'transferFee',
    'inspectionFee',
    'processingFee',
    'accessories1',
    'accessories2',
    'depositPaid',
    'othersDeduction',
    'tradeInPrice',
    'tradeInSettlement',
    'tradeInBalance',
  ],
};

// All currency fields flat list (for quick lookup)
export const ALL_CURRENCY_FIELDS = [
  ...CURRENCY_FIELDS.proposal,
  ...CURRENCY_FIELDS.vsa,
  ...CURRENCY_FIELDS.invoice,
];

/**
 * Parse currency string to plain number
 * Strips $, commas, spaces and returns numeric value
 * @param {string|number} value - The value to parse
 * @returns {number|''} - Plain number or empty string if invalid
 */
export const parseCurrency = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const numStr = String(value).replace(/[^0-9.-]/g, '');
  const num = parseFloat(numStr);
  return isNaN(num) ? '' : num;
};

/**
 * Format number as currency for display
 * Adds $ prefix and thousand separators
 * @param {string|number} value - The value to format
 * @returns {string} - Formatted currency string (e.g., "$1,234")
 */
export const formatCurrency = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const num = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  if (isNaN(num)) return '';
  return `$${num.toLocaleString()}`;
};

/**
 * Format number with decimal places (for prices)
 * @param {string|number} value - The value to format
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} - Formatted string with decimals
 */
export const formatCurrencyWithDecimals = (value, decimals = 2) => {
  if (value === null || value === undefined || value === '') return '';
  const num = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  if (isNaN(num)) return '';
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
};

/**
 * Check if a field name is a currency field
 * @param {string} fieldName - The field name to check
 * @param {string} tab - Optional tab name to check specific tab fields
 * @returns {boolean} - True if the field is a currency field
 */
export const isCurrencyField = (fieldName, tab = null) => {
  if (tab && CURRENCY_FIELDS[tab]) {
    return CURRENCY_FIELDS[tab].includes(fieldName);
  }
  return ALL_CURRENCY_FIELDS.includes(fieldName);
};

/**
 * Create a field change handler that parses currency values
 * @param {Function} onFieldChange - Original field change handler
 * @param {string} tab - Tab name for currency field lookup
 * @returns {Function} - Enhanced handler that parses currency
 */
export const createCurrencyAwareHandler = (onFieldChange, tab) => {
  return (name, value) => {
    const fieldName = name;
    if (isCurrencyField(fieldName, tab)) {
      onFieldChange(name, parseCurrency(value));
    } else {
      onFieldChange(name, value);
    }
  };
};
