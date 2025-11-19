/**
 * app.js
 *
 * Application Initialization Module
 * Handles Google API initialization, authentication setup, and application bootstrap.
 * Initializes both GAPI (Google Drive API) and GIS (Google Identity Services).
 */

// Initialize GAPI client for Drive API
function gapiLoaded() {
    console.log('GAPI loaded, initializing client...');
    gapi.load('client', async () => {
        try {
            await gapi.client.init({
                discoveryDocs: DISCOVERY_DOCS,
            });
            gapiInited = true;
            console.log('GAPI client initialized successfully');
            maybeEnableButtons();
        } catch (error) {
            console.error('Error initializing GAPI client:', error);
            showSetupError('Error initializing Google Drive API: ' + error.message);
        }
    });
}

// Initialize GIS (Google Identity Services) for authentication
function gisLoaded() {
    console.log('GIS loaded, creating token client...');

    if (!CLIENT_ID) {
        showSetupError('No Client ID configured. Please configure your Google OAuth Client ID.');
        return;
    }

    try {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: (response) => {
                if (response.error !== undefined) {
                    console.error('Token response error:', response);
                    showSetupError('Authentication error: ' + response.error);
                    return;
                }
                console.log('Access token received');

                // Store token and set up auto-refresh
                const expiresIn = response.expires_in || 3600;
                setAccessToken(response.access_token, expiresIn);

                isSignedIn = true;
                updateSigninStatus(true);

                // Get or create root folder
                getRootFolder();
            },
        });
        gisInited = true;
        console.log('GIS token client initialized successfully');
        maybeEnableButtons();
    } catch (error) {
        console.error('Error initializing GIS:', error);
        showSetupError('Error initializing authentication: ' + error.message);
    }
}

// Enable buttons when both libraries are loaded
function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        console.log('Both GAPI and GIS initialized - ready to authenticate');
        document.getElementById('authButton').disabled = false;

        // Try to restore token from storage
        if (restoreTokenFromStorage()) {
            console.log('Successfully restored session from storage');
            // Get or create root folder
            getRootFolder();
        } else {
            console.log('No valid token in storage, user needs to authenticate');
        }
    }
}

// Show setup error with detailed message
function showSetupError(message) {
    const authButton = document.getElementById('authButton');
    const authButtonText = document.getElementById('authButtonText');

    authButton.style.background = 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)';
    authButton.style.borderColor = 'rgba(231, 76, 60, 0.5)';
    authButton.title = 'Connection Error: ' + message;
    authButtonText.textContent = 'Error';

    console.error('Google Drive setup error:', message);
}

// Initialize
function init() {
    // Set initial sync status
    updateSyncStatus('offline');

    // Initialize sync status popup
    initSyncStatusPopup();

    // Load form templates from localStorage
    loadFormTemplates();

    // Load Excel templates from localStorage
    loadExcelTemplates();

    // Don't load from localStorage yet - wait for Drive connection
    // This ensures Drive is the source of truth
    console.log('Waiting for Google Drive connection...');

    // Initialize both GAPI and GIS
    gapiLoaded();
    gisLoaded();

    // Show empty state until Drive loads
    renderCustomerList();
    updateStats();
}

// Start when page loads
window.onload = init;
