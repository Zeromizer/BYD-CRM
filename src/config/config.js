/**
 * Google Drive API Configuration
 */
export const CONFIG = {
  // Google OAuth 2.0 Client ID
  CLIENT_ID: '565047387986-d61n6b2aenll8dsjcdhjr85u1a1ck5ec.apps.googleusercontent.com',

  // Google API Key
  API_KEY: 'AIzaSyCJ6vqWOgQDXpYg09UkfzpbEPAb7WLPxlU',

  // OAuth Scopes
  SCOPES: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata',

  // Discovery Documents
  DISCOVERY_DOCS: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],

  // Token Refresh Settings
  MAX_REFRESH_RETRIES: 3,
  PERIODIC_REFRESH_INTERVAL: 50 * 60 * 1000, // 50 minutes
  HEALTH_CHECK_INTERVAL: 10 * 60 * 1000, // 10 minutes

  // Google Drive Folder Names
  FOLDER_NAMES: {
    ROOT: 'BYD CRM',
    FORMS: 'BYD CRM - Form Templates',
    EXCEL_TEMPLATES: 'BYD CRM - Excel Master Files',
    CUSTOMER_FILES: 'BYD CRM - Customer Files',
    DOCUMENT_SUBFOLDERS: ['VSA', 'Trade In', 'Test Drive', 'PDPA & COE', 'Other'],
  },

  // Data File Names
  DATA_FILE_NAMES: {
    CUSTOMERS: 'customers.json',
    FORMS: 'forms.json',
    EXCEL: 'excel.json',
  },
};
