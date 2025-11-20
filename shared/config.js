/**
 * Shared Configuration
 * Used by both vanilla JS app and React app
 */

export const CONFIG = {
  // Google Drive API Configuration
  CLIENT_ID: '876961148543-8sdj3cti6q9tc523natb3g6jt789qlbr.apps.googleusercontent.com',
  DISCOVERY_DOCS: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
  SCOPES: 'https://www.googleapis.com/auth/drive.file',

  // File Names
  DATA_FILE_NAME: 'BYD_CRM_Data.json',
  FORMS_DATA_FILE_NAME: 'forms_metadata.json',
  EXCEL_DATA_FILE_NAME: 'excel_templates.json',

  // Folder Names
  ROOT_FOLDER_NAME: 'BYD CRM Data',
  FORMS_FOLDER_NAME: 'Form Templates',
  EXCEL_FOLDER_NAME: 'Excel Templates',

  // Authentication Constants
  MAX_REFRESH_RETRIES: 3,
  PERIODIC_REFRESH_INTERVAL: 45 * 60 * 1000, // 45 minutes
  HEALTH_CHECK_INTERVAL: 10 * 60 * 1000, // 10 minutes

  // Sync Constants
  SYNC_QUEUE_KEY: 'syncQueue',
  LAST_SYNC_TIME_KEY: 'lastSyncTime',

  // Local Storage Keys
  STORAGE_KEYS: {
    CUSTOMERS: 'customers',
    FORMS_METADATA: 'formsMetadata',
    EXCEL_TEMPLATES: 'excelTemplates',
    FIELD_MAPPINGS: 'fieldMappings',
    EXCEL_FIELD_MAPPINGS: 'excelFieldMappings',
    ROOT_FOLDER_ID: 'rootFolderId',
    FORMS_FOLDER_ID: 'formsFolderId',
    EXCEL_FOLDER_ID: 'excelTemplatesFolderId',
    DATA_FILE_ID: 'dataFileId',
    FORMS_DATA_FILE_ID: 'formsDataFileId',
    EXCEL_DATA_FILE_ID: 'excelDataFileId',
    ACCESS_TOKEN: 'accessToken',
    TOKEN_EXPIRY: 'tokenExpiry',
  },

  // BYD Car Models
  CAR_MODELS: [
    'BYD Atto3 Extended Range 100kw',
    'BYD Atto3 Carbon Edge 100kw',
    'BYD Seal Dynamic 100kw',
    'BYD Seal Premium',
    'BYD Seal Performance',
    'BYD Seal 6 Premium',
    'BYD Dolphin Premium',
    'BYD E6 7-Seater',
    'BYD M6 7-Seater',
    'BYD M6 Carbon Edge',
    'BYD Sealion 7 Premium',
    'BYD Sealion 7 Performance',
  ],

  // BYD Car Colors
  CAR_COLORS: [
    'Ski White',
    'Surf Blue',
    'Cosmos Black',
    'Boulder Grey',
    'Atlantis Grey',
    'Arctic Blue',
    'Aurora While',
    'Maldive Purple',
    'Coral Pink',
    'Sand White',
    'Urban Grey',
    'Crystal White',
    'Harbor Grey',
    'Inkstone Blue',
    'Shark Grey',
    'Whale Sea Blue',
    'Arctic White',
  ],

  // Form Types
  FORM_TYPES: {
    TEST_DRIVE: 'test_drive',
    VSA: 'vsa',
    PDPA: 'pdpa',
    COE_BIDDING_1: 'coe_bidding_1',
    COE_BIDDING_2: 'coe_bidding_2',
    PDPA_CONSENT_1: 'pdpa_consent_1',
    PDPA_CONSENT_2: 'pdpa_consent_2',
    DELIVERY_CHECKLIST_1: 'delivery_checklist_1',
    DELIVERY_CHECKLIST_2: 'delivery_checklist_2',
    OTHER: 'other',
  },

  // Form Type Labels
  FORM_TYPE_LABELS: {
    test_drive: 'Test Drive Agreement Form',
    vsa: 'Vehicle Sales Agreement',
    pdpa: 'PDPA Consent Form',
    coe_bidding_1: 'COE Bidding 1',
    coe_bidding_2: 'COE Bidding 2',
    pdpa_consent_1: 'PDPA Consent 1',
    pdpa_consent_2: 'PDPA Consent 2',
    delivery_checklist_1: 'Delivery Checklist Form (1 of 2)',
    delivery_checklist_2: 'Delivery Checklist Form (2 of 2)',
    other: 'Other Form',
  },
};

// For backward compatibility with vanilla JS app
if (typeof window !== 'undefined') {
  window.SHARED_CONFIG = CONFIG;
}
