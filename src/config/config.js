/**
 * Google Drive API Configuration
 *
 * IMPORTANT: You MUST create your own Google OAuth credentials!
 * The default credentials below will NOT work for your deployment.
 *
 * Follow the setup guide: GOOGLE_OAUTH_SETUP.md
 *
 * Quick Steps:
 * 1. Go to https://console.cloud.google.com/
 * 2. Create a new project
 * 3. Enable Google Drive API
 * 4. Create OAuth 2.0 Client ID (Web application)
 * 5. Add authorized origin: https://zeromizer.github.io
 * 6. Add redirect URI: https://zeromizer.github.io/BYD-CRM/
 * 7. Create API Key and restrict it to Google Drive API
 * 8. Replace CLIENT_ID and API_KEY below with your values
 * 9. Commit and push changes
 */
export const CONFIG = {
  // Google OAuth 2.0 Client ID
  // Get this from: https://console.cloud.google.com/apis/credentials
  // Format: xxxxx-xxxxx.apps.googleusercontent.com
  CLIENT_ID: '876961148543-8sdj3cti6q9tc523natb3g6jt789qlbr.apps.googleusercontent.com',

  // Google API Key
  // Get this from: https://console.cloud.google.com/apis/credentials
  // Format: AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  API_KEY: 'AIzaSyDH6E6B4u1m_uvr0mSdCxaCYIkzjSqUuY8',

  // OAuth Scopes
  // drive: Full access to all Drive files (needed to view files uploaded outside the app AND create folders/files)
  // drive.appdata: Access to app-specific data storage
  SCOPES: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.appdata',

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
