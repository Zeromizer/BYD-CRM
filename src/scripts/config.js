/**
 * Global Configuration and State Variables
 *
 * This file contains all global variables, constants, and state management
 * for the BYD CRM application.
 */

// ============ API Configuration ============
let CLIENT_ID = '876961148543-8sdj3cti6q9tc523natb3g6jt789qlbr.apps.googleusercontent.com';
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

// ============ Customer Data ============
let customers = [];
let selectedCustomerId = null;
let customerBackup = null; // Backup of customer data for cancel functionality

// ============ Google Drive State ============
let isSignedIn = false;
let rootFolderId = null;
let formsFolderId = null; // Google Drive folder ID for form templates
let excelTemplatesFolderId = null; // Google Drive folder ID for Excel template files
let dataFileId = null; // Google Drive file ID for synced data
let formsDataFileId = null; // Google Drive file ID for forms metadata
let excelDataFileId = null; // Google Drive file ID for Excel templates metadata

// ============ Authentication State ============
let tokenClient = null;
let accessToken = null;
let gapiInited = false;
let gisInited = false;
let tokenRefreshTimer = null;
let periodicRefreshTimer = null; // Timer for periodic token refresh
let tokenHealthCheckTimer = null; // Timer for periodic token validation
let refreshRetryCount = 0; // Track retry attempts

// ============ Authentication Constants ============
const MAX_REFRESH_RETRIES = 3;
const PERIODIC_REFRESH_INTERVAL = 45 * 60 * 1000; // 45 minutes
const HEALTH_CHECK_INTERVAL = 10 * 60 * 1000; // 10 minutes

// ============ Sync State ============
let isSyncing = false; // Prevent concurrent syncs
let lastSyncTime = null; // Track last successful sync
const DATA_FILE_NAME = 'BYD_CRM_Data.json';

// ============ Form Templates ============
let formTemplates = {}; // Store form template file IDs
let formImageCache = {}; // In-memory cache for form images from Drive
let currentMappingFormType = null;
let currentMappingCanvas = null;
let currentMappingImage = null;
let tempFieldMappings = {};
let currentCombineCustomerId = null;

// ============ Excel Templates ============
let excelTemplates = {}; // Store Excel template data
let currentExcelTemplateId = null;
let tempExcelMappings = {};
let currentPopulateCustomerId = null;

// ============ UI State ============
let manualMode = false;
let isAddingCustomer = false; // Prevent duplicate customer creation
let isCreatingFolder = false; // Prevent duplicate folder operations

// ============ Statistics Cache ============
// Cache for file counts to avoid repeated API calls
let statsCache = {
    totalFiles: 0,
    lastUpdate: 0,
    cacheTimeout: 30000 // 30 seconds cache
};

// ============ Document Folder Categories ============
const documentFolders = [
    { id: 'nirc_fin', name: 'NIRC_FIN' },
    { id: 'test_drive', name: 'Test_Drive' },
    { id: 'vsa', name: 'VSA' },
    { id: 'trade_in', name: 'Trade_In' },
    { id: 'pdpa_coe', name: 'PDPA_COE_Bidding' },
    { id: 'other', name: 'Other_Documents' }
];

// ============ Document Checklist Template ============
const documentChecklist = [
    { id: 'ic_copy', name: 'IC Copy (Front & Back)', required: true },
    { id: 'nirc_fin', name: 'NIRC/FIN', required: true },
    { id: 'driving_license', name: 'Driving License Copy', required: true },
    { id: 'contact_form', name: 'Customer Contact Form', required: true },
    { id: 'quotation', name: 'Price Quotation', required: true },
    { id: 'pdpa_coe', name: 'PDPA & COE Bidding', required: true },
    { id: 'test_drive', name: 'Test Drive Agreement Form', required: true },
    { id: 'vsa', name: 'VSA (Vehicle Sales Agreement)', required: true },
    { id: 'coe_deposit_receipt', name: 'COE Deposit Receipt ($16,350)', required: true },
    { id: 'insurance_payment', name: 'Insurance Payment Receipt ($1,500-$3,000)', required: true },
    { id: 'product_specs', name: 'Product Specifications', required: false },
    { id: 'finance_application', name: 'Finance Application Form', required: false },
    { id: 'finance_approval', name: 'Finance Approval Letter (if bank loan)', required: false },
    { id: 'admin_fee_receipt', name: 'Admin Fee Receipt ($500 if no bank loan)', required: false },
    { id: 'first_installment', name: 'First Month Installment (if no bank loan)', required: false },
    { id: 'trade_in', name: 'Trade In (if required)', required: false },
    { id: 'log_card', name: 'Vehicle Log Card (if trade-in)', required: false }
];

// ============ Document Classification Patterns ============
// Document classification patterns - maps keywords to document types
// Patterns are checked in order - more specific patterns first!
const documentClassificationPatterns = {
    // Financial documents (check these first to avoid "fin" matching FIN/NIRC)
    'finance_application': {
        folderId: 'other',
        checklistId: 'finance_application',
        keywords: ['finance application', 'loan application', 'bank application', 'credit application', 'hire purchase'],
        excludeKeywords: [],
        displayName: 'Finance Application',
        priority: 1
    },
    'finance_approval': {
        folderId: 'other',
        checklistId: 'finance_approval',
        keywords: ['finance approval', 'loan approval', 'bank approval', 'credit approval', 'approval letter'],
        excludeKeywords: [],
        displayName: 'Finance Approval',
        priority: 1
    },
    'insurance': {
        folderId: 'other',
        checklistId: 'insurance_payment',
        keywords: ['insurance', 'coverage', 'policy', 'premium'],
        excludeKeywords: [],
        displayName: 'Insurance',
        priority: 1
    },
    'receipt': {
        folderId: 'other',
        checklistId: null,
        keywords: ['receipt', 'payment receipt', 'deposit receipt', 'admin fee receipt'],
        excludeKeywords: [],
        displayName: 'Receipt',
        priority: 1
    },

    // Specific ID documents (higher priority, more specific)
    'ic_copy': {
        folderId: 'nirc_fin',
        checklistId: 'ic_copy',
        keywords: ['ic copy', 'ic front', 'ic back', 'identity card copy', 'nric copy', 'nric front', 'nric back'],
        excludeKeywords: ['application', 'form', 'loan', 'finance'],
        displayName: 'IC Copy',
        priority: 2
    },
    'nirc_fin': {
        folderId: 'nirc_fin',
        checklistId: 'nirc_fin',
        keywords: ['nirc', 'nric', 'fin number', 'fin card', 'foreign identification'],
        excludeKeywords: ['application', 'form', 'loan', 'finance', 'bank'],
        displayName: 'NIRC/FIN',
        priority: 2
    },
    'driving_license': {
        folderId: 'test_drive',
        checklistId: 'driving_license',
        keywords: ['driving license', 'driving licence', 'driver license', 'driver licence', 'driving permit'],
        excludeKeywords: ['application', 'form'],
        displayName: 'Driving License',
        priority: 2
    },

    // Vehicle documents
    'vsa': {
        folderId: 'vsa',
        checklistId: 'vsa',
        keywords: ['vsa', 'vehicle sales agreement', 'sales agreement', 'purchase agreement'],
        excludeKeywords: [],
        displayName: 'VSA',
        priority: 3
    },
    'test_drive': {
        folderId: 'test_drive',
        checklistId: 'test_drive',
        keywords: ['test drive', 'testdrive', 'test-drive', 'trial drive'],
        excludeKeywords: [],
        displayName: 'Test Drive',
        priority: 3
    },
    'trade_in': {
        folderId: 'trade_in',
        checklistId: 'trade_in',
        keywords: ['trade in', 'tradein', 'trade-in', 'vehicle exchange', 'car exchange'],
        excludeKeywords: [],
        displayName: 'Trade In',
        priority: 3
    },
    'log_card': {
        folderId: 'trade_in',
        checklistId: 'log_card',
        keywords: ['log card', 'logcard', 'vehicle log'],
        excludeKeywords: [],
        displayName: 'Vehicle Log Card',
        priority: 3
    },

    // Forms and agreements
    'pdpa_coe': {
        folderId: 'pdpa_coe',
        checklistId: 'pdpa_coe',
        keywords: ['pdpa', 'coe', 'coe bidding', 'consent form', 'data protection'],
        excludeKeywords: [],
        displayName: 'PDPA & COE Bidding',
        priority: 4
    },
    'quotation': {
        folderId: 'other',
        checklistId: 'quotation',
        keywords: ['quotation', 'quote', 'price quotation', 'pricing'],
        excludeKeywords: [],
        displayName: 'Quotation',
        priority: 4
    },
    'contact_form': {
        folderId: 'other',
        checklistId: 'contact_form',
        keywords: ['contact form', 'customer form', 'customer information'],
        excludeKeywords: [],
        displayName: 'Contact Form',
        priority: 4
    }
};
