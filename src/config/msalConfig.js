/**
 * Microsoft Authentication Library (MSAL) Configuration
 *
 * Azure AD Application Registration Details:
 * - Application (client) ID: a8827ae1-8d14-45fe-b6cc-c2aabd5f9b86
 *
 * PERSONAL ACCOUNTS ONLY:
 * Using "consumers" authority to allow only personal Microsoft accounts
 * (outlook.com, hotmail.com, live.com, personal accounts)
 *
 * This does NOT require SharePoint Online license - uses personal OneDrive storage.
 */

// Determine redirect URI based on environment
const getRedirectUri = () => {
  if (typeof window !== 'undefined') {
    // Check if running locally
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return window.location.origin;
    }
    // Production - GitHub Pages
    return 'https://zeromizer.github.io/BYD-CRM';
  }
  return 'https://zeromizer.github.io/BYD-CRM';
};

export const msalConfig = {
  auth: {
    // Your Azure AD Application (client) ID
    clientId: 'a8827ae1-8d14-45fe-b6cc-c2aabd5f9b86',

    // PERSONAL ACCOUNTS ONLY - uses "consumers" authority
    // This allows personal Microsoft accounts (outlook.com, hotmail.com, live.com, etc.)
    // Does NOT require SharePoint Online license
    authority: 'https://login.microsoftonline.com/consumers',

    // Redirect URI - must match what's registered in Azure portal
    redirectUri: getRedirectUri(),

    // Where to redirect after logout
    postLogoutRedirectUri: getRedirectUri(),

    // Navigate to this URI after login
    navigateToLoginRequestUrl: true,
  },
  cache: {
    // Store tokens in localStorage for persistence across sessions
    cacheLocation: 'localStorage',

    // Set to true for IE11 or Edge legacy
    storeAuthStateInCookie: false,
  },
  system: {
    // Logging for debugging (set to 0 in production)
    loggerOptions: {
      logLevel: 0, // 0=Error, 1=Warning, 2=Info, 3=Verbose
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        switch (level) {
          case 0: console.error(message); break;
          case 1: console.warn(message); break;
          case 2: console.info(message); break;
          case 3: console.debug(message); break;
        }
      },
    },
  },
};

// Scopes for Microsoft Graph API - OneDrive Personal access
// Note: Personal accounts only need Files.ReadWrite (not Files.ReadWrite.All)
export const loginRequest = {
  scopes: [
    'User.Read',       // Read user profile
    'Files.ReadWrite', // Read and write user's OneDrive files
  ],
};

// Microsoft Graph API endpoints
export const graphConfig = {
  graphMeEndpoint: 'https://graph.microsoft.com/v1.0/me',
  graphDriveEndpoint: 'https://graph.microsoft.com/v1.0/me/drive',
  graphFilesEndpoint: 'https://graph.microsoft.com/v1.0/me/drive/root/children',
};

// OneDrive Folder Names (matching Google Drive structure)
export const ONEDRIVE_FOLDER_NAMES = {
  ROOT: 'BYD CRM',
  FORMS: 'BYD CRM - Form Templates',
  EXCEL_TEMPLATES: 'BYD CRM - Excel Master Files',
  CUSTOMER_FILES: 'BYD CRM - Customer Files',
  CUSTOMERS_DATA: 'BYD Customers Data',
  DOCUMENT_TEMPLATES: 'Document Templates',
  DOCUMENT_SUBFOLDERS: ['NIRC', 'Test Drive', 'Other Documents', 'VSA', 'Trade In'],
};

// Data File Names
export const ONEDRIVE_DATA_FILES = {
  CUSTOMERS_INDEX: 'customers_index.json',
  CUSTOMER_DETAILS: 'customer.json',
  FORMS: 'forms.json',
  EXCEL: 'excel.json',
};
