/**
 * User Storage Service
 * Manages user-specific localStorage keys for multi-user support
 *
 * Storage Keys:
 * - bydCRM_${email} - Customer data for specific user
 * - excelTemplates_${email} - Excel templates for specific user
 * - currentDataOwner - Email of user who owns currently loaded data
 *
 * Migration:
 * - Detects old non-user-specific data (bydCRM, excelTemplates)
 * - Migrates to user-specific keys when user signs in
 * - Preserves old data as backup until migration confirmed
 */

// Storage key constants
const STORAGE_KEYS = {
  // Old non-user-specific keys (for migration)
  OLD_CUSTOMERS: 'bydCRM',
  OLD_EXCEL: 'excelTemplates',

  // User tracking
  CURRENT_DATA_OWNER: 'currentDataOwner',
  GOOGLE_USER_EMAIL: 'googleUserEmail',

  // Prefixes for user-specific keys
  CUSTOMERS_PREFIX: 'bydCRM_',
  EXCEL_PREFIX: 'excelTemplates_',

  // Migration tracking
  MIGRATION_COMPLETED: 'multiUserMigrationCompleted',
  MIGRATION_BACKUP: 'migrationBackup',
};

/**
 * Normalize email for use as storage key suffix
 * Converts to lowercase and removes special characters
 */
function normalizeEmail(email) {
  if (!email) return null;
  return email.toLowerCase().trim();
}

/**
 * Get user-specific storage key
 */
function getUserKey(prefix, email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;
  return `${prefix}${normalizedEmail}`;
}

/**
 * Get the current data owner email from localStorage
 */
function getCurrentDataOwner() {
  return localStorage.getItem(STORAGE_KEYS.CURRENT_DATA_OWNER);
}

/**
 * Set the current data owner
 */
function setCurrentDataOwner(email) {
  if (email) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_DATA_OWNER, normalizeEmail(email));
  } else {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_DATA_OWNER);
  }
}

/**
 * Check if there's old non-user-specific data that needs migration
 */
function hasLegacyData() {
  const hasOldCustomers = localStorage.getItem(STORAGE_KEYS.OLD_CUSTOMERS) !== null;
  const hasOldExcel = localStorage.getItem(STORAGE_KEYS.OLD_EXCEL) !== null;
  const migrationDone = localStorage.getItem(STORAGE_KEYS.MIGRATION_COMPLETED) === 'true';

  return (hasOldCustomers || hasOldExcel) && !migrationDone;
}

/**
 * Get legacy data summary for migration UI
 */
function getLegacyDataSummary() {
  const summary = {
    hasData: false,
    customers: 0,
    excel: 0,
  };

  try {
    const oldCustomers = localStorage.getItem(STORAGE_KEYS.OLD_CUSTOMERS);
    if (oldCustomers) {
      const parsed = JSON.parse(oldCustomers);
      summary.customers = Array.isArray(parsed) ? parsed.length : 0;
      summary.hasData = summary.customers > 0;
    }

    const oldExcel = localStorage.getItem(STORAGE_KEYS.OLD_EXCEL);
    if (oldExcel) {
      const parsed = JSON.parse(oldExcel);
      summary.excel = Object.keys(parsed).length;
      summary.hasData = summary.hasData || summary.excel > 0;
    }
  } catch {
    // Error reading legacy data
  }

  return summary;
}

/**
 * Migrate legacy data to user-specific storage
 * Returns migration result with details
 */
function migrateLegacyData(userEmail) {
  const normalizedEmail = normalizeEmail(userEmail);
  if (!normalizedEmail) {
    return { success: false, error: 'No user email provided' };
  }

  const result = {
    success: true,
    migrated: {
      customers: 0,
      excel: 0,
    },
    errors: [],
  };

  // Create backup before migration
  try {
    const backup = {
      timestamp: new Date().toISOString(),
      userEmail: normalizedEmail,
      customers: localStorage.getItem(STORAGE_KEYS.OLD_CUSTOMERS),
      excel: localStorage.getItem(STORAGE_KEYS.OLD_EXCEL),
    };
    localStorage.setItem(STORAGE_KEYS.MIGRATION_BACKUP, JSON.stringify(backup));
  } catch {
    // Could not create backup
  }

  // Migrate customers
  try {
    const oldCustomers = localStorage.getItem(STORAGE_KEYS.OLD_CUSTOMERS);
    if (oldCustomers) {
      const customers = JSON.parse(oldCustomers);
      if (Array.isArray(customers) && customers.length > 0) {
        const userKey = getUserKey(STORAGE_KEYS.CUSTOMERS_PREFIX, normalizedEmail);
        localStorage.setItem(userKey, oldCustomers);
        result.migrated.customers = customers.length;
      }
    }
  } catch (error) {
    result.errors.push(`Customers: ${error.message}`);
  }

  // Migrate Excel templates
  try {
    const oldExcel = localStorage.getItem(STORAGE_KEYS.OLD_EXCEL);
    if (oldExcel) {
      const excel = JSON.parse(oldExcel);
      const excelCount = Object.keys(excel).length;
      if (excelCount > 0) {
        const userKey = getUserKey(STORAGE_KEYS.EXCEL_PREFIX, normalizedEmail);
        localStorage.setItem(userKey, oldExcel);
        result.migrated.excel = excelCount;
      }
    }
  } catch (error) {
    result.errors.push(`Excel: ${error.message}`);
  }

  // Mark migration as completed and clean up old keys
  if (result.errors.length === 0) {
    localStorage.setItem(STORAGE_KEYS.MIGRATION_COMPLETED, 'true');

    // Remove old non-user-specific keys
    localStorage.removeItem(STORAGE_KEYS.OLD_CUSTOMERS);
    localStorage.removeItem(STORAGE_KEYS.OLD_EXCEL);

    // Set current data owner
    setCurrentDataOwner(normalizedEmail);
  } else {
    result.success = false;
  }

  return result;
}

/**
 * Load user-specific data from localStorage
 */
function loadUserData(userEmail, dataType) {
  const normalizedEmail = normalizeEmail(userEmail);
  if (!normalizedEmail) return null;

  let prefix;
  switch (dataType) {
    case 'customers':
      prefix = STORAGE_KEYS.CUSTOMERS_PREFIX;
      break;
    case 'excel':
      prefix = STORAGE_KEYS.EXCEL_PREFIX;
      break;
    default:
      return null;
  }

  const key = getUserKey(prefix, normalizedEmail);
  const data = localStorage.getItem(key);

  if (data) {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Save user-specific data to localStorage
 */
function saveUserData(userEmail, dataType, data) {
  const normalizedEmail = normalizeEmail(userEmail);
  if (!normalizedEmail) {
    return false;
  }

  let prefix;
  switch (dataType) {
    case 'customers':
      prefix = STORAGE_KEYS.CUSTOMERS_PREFIX;
      break;
    case 'excel':
      prefix = STORAGE_KEYS.EXCEL_PREFIX;
      break;
    default:
      return false;
  }

  const key = getUserKey(prefix, normalizedEmail);

  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/**
 * Clear user-specific data from localStorage
 */
function clearUserData(userEmail, dataType) {
  const normalizedEmail = normalizeEmail(userEmail);
  if (!normalizedEmail) return;

  let prefix;
  switch (dataType) {
    case 'customers':
      prefix = STORAGE_KEYS.CUSTOMERS_PREFIX;
      break;
    case 'excel':
      prefix = STORAGE_KEYS.EXCEL_PREFIX;
      break;
    case 'all':
      // Clear all data types for this user
      clearUserData(userEmail, 'customers');
      clearUserData(userEmail, 'excel');
      return;
    default:
      return;
  }

  const key = getUserKey(prefix, normalizedEmail);
  localStorage.removeItem(key);
}

/**
 * Check if user data exists in localStorage
 */
function hasUserData(userEmail) {
  const normalizedEmail = normalizeEmail(userEmail);
  if (!normalizedEmail) return false;

  const customersKey = getUserKey(STORAGE_KEYS.CUSTOMERS_PREFIX, normalizedEmail);
  const excelKey = getUserKey(STORAGE_KEYS.EXCEL_PREFIX, normalizedEmail);

  return (
    localStorage.getItem(customersKey) !== null ||
    localStorage.getItem(excelKey) !== null
  );
}

/**
 * Check if the current session matches the data owner
 */
function isDataOwnerMatch(userEmail) {
  const normalizedEmail = normalizeEmail(userEmail);
  const currentOwner = getCurrentDataOwner();

  if (!normalizedEmail || !currentOwner) return false;
  return normalizedEmail === currentOwner;
}

/**
 * Clear all legacy (non-user-specific) data
 * Used after migration or when explicitly clearing old data
 */
function clearLegacyData() {
  localStorage.removeItem(STORAGE_KEYS.OLD_CUSTOMERS);
  localStorage.removeItem(STORAGE_KEYS.OLD_EXCEL);
  // Also remove old forms data if it exists (legacy cleanup)
  localStorage.removeItem('formTemplates');
}

/**
 * Reset migration state (for testing or recovery)
 */
function resetMigration() {
  localStorage.removeItem(STORAGE_KEYS.MIGRATION_COMPLETED);
  localStorage.removeItem(STORAGE_KEYS.MIGRATION_BACKUP);
}

// Export the service
const userStorage = {
  STORAGE_KEYS,
  normalizeEmail,
  getUserKey,
  getCurrentDataOwner,
  setCurrentDataOwner,
  hasLegacyData,
  getLegacyDataSummary,
  migrateLegacyData,
  loadUserData,
  saveUserData,
  clearUserData,
  hasUserData,
  isDataOwnerMatch,
  clearLegacyData,
  resetMigration,
};

export default userStorage;
