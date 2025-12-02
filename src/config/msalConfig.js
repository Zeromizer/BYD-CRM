/**
 * Microsoft Authentication Library (MSAL) Configuration
 *
 * Azure AD Application Registration Details:
 * - Application (client) ID: f902f47e-96c8-4d40-9824-db1dd5fe11b7
 * - Directory (tenant) ID: 9362e654-80ce-4843-bc69-1cbc12803829
 * - Primary domain: shawnlycgmail.onmicrosoft.com
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
    clientId: 'f902f47e-96c8-4d40-9824-db1dd5fe11b7',

    // Single tenant - only your organization
    // Format: https://login.microsoftonline.com/{tenant-id}
    authority: 'https://login.microsoftonline.com/9362e654-80ce-4843-bc69-1cbc12803829',

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

// Scopes for Microsoft Graph API - OneDrive access
export const loginRequest = {
  scopes: [
    'User.Read',           // Read user profile
    'Files.ReadWrite',     // Read and write user's files
    'Files.ReadWrite.All', // Read and write all files user can access
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
