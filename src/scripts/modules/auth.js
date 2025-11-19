/**
 * Authentication Module
 *
 * Handles Google OAuth authentication and token management.
 * Functions:
 * - Token storage and retrieval
 * - Token refresh and health checks
 * - Sign in/out functionality
 */

// ============ Token Storage and Management Functions ============

function saveTokenToStorage(token, expiresIn) {
    const expiryTime = Date.now() + (expiresIn * 1000);
    localStorage.setItem('googleAccessToken', token);
    localStorage.setItem('googleTokenExpiry', expiryTime.toString());
    console.log('Token saved to localStorage, expires in', expiresIn, 'seconds');
}

function getTokenFromStorage() {
    const token = localStorage.getItem('googleAccessToken');
    const expiry = localStorage.getItem('googleTokenExpiry');

    if (!token || !expiry) {
        return null;
    }

    const expiryTime = parseInt(expiry);
    const now = Date.now();

    // Check if token is still valid (with 5 minute buffer)
    if (now >= expiryTime - (5 * 60 * 1000)) {
        console.log('Token expired or expiring soon');
        clearTokenFromStorage();
        return null;
    }

    console.log('Valid token found in storage');
    return { token, expiryTime };
}

function clearTokenFromStorage() {
    localStorage.removeItem('googleAccessToken');
    localStorage.removeItem('googleTokenExpiry');
    localStorage.removeItem('tokenExpiry'); // Clean up old key
    console.log('Token cleared from storage');
}

function scheduleTokenRefresh(expiresIn) {
    // Clear any existing timer
    if (tokenRefreshTimer) {
        clearTimeout(tokenRefreshTimer);
    }

    // Schedule refresh 5 minutes before expiry
    const refreshTime = (expiresIn - 300) * 1000; // 5 minutes before expiry

    if (refreshTime > 0) {
        console.log('Token refresh scheduled in', refreshTime / 1000, 'seconds');
        tokenRefreshTimer = setTimeout(() => {
            console.log('Auto-refreshing token...');
            refreshTokenSilently();
        }, refreshTime);
    }
}

function refreshTokenSilently(isRetry = false) {
    if (!tokenClient) {
        console.error('Token client not initialized');
        return;
    }

    try {
        console.log(`Attempting token refresh (retry count: ${refreshRetryCount})...`);
        // Try to refresh silently (no user prompt)
        tokenClient.requestAccessToken({ prompt: '' });
        // Reset retry count on successful attempt
        refreshRetryCount = 0;
    } catch (error) {
        console.error('Silent token refresh failed:', error);

        // Retry logic
        if (!isRetry && refreshRetryCount < MAX_REFRESH_RETRIES) {
            refreshRetryCount++;
            console.log(`Retrying token refresh (attempt ${refreshRetryCount}/${MAX_REFRESH_RETRIES})...`);
            setTimeout(() => refreshTokenSilently(true), 5000); // Retry after 5 seconds
            return;
        }

        // If all retries failed, user will need to re-authenticate manually
        console.error('All token refresh attempts failed');
        clearTokenFromStorage();
        accessToken = null;
        isSignedIn = false;
        updateSigninStatus(false);
        alert('Your Google Drive session has expired. Please reconnect.');

        // Clear all timers
        stopAllRefreshTimers();
    }
}

function startPeriodicRefresh() {
    // Clear any existing timer
    if (periodicRefreshTimer) {
        clearInterval(periodicRefreshTimer);
    }

    console.log(`Starting periodic token refresh every ${PERIODIC_REFRESH_INTERVAL / 60000} minutes`);
    periodicRefreshTimer = setInterval(() => {
        console.log('Periodic token refresh triggered...');
        refreshTokenSilently();
    }, PERIODIC_REFRESH_INTERVAL);
}

function startTokenHealthCheck() {
    // Clear any existing timer
    if (tokenHealthCheckTimer) {
        clearInterval(tokenHealthCheckTimer);
    }

    console.log(`Starting token health check every ${HEALTH_CHECK_INTERVAL / 60000} minutes`);
    tokenHealthCheckTimer = setInterval(() => {
        checkTokenHealth();
    }, HEALTH_CHECK_INTERVAL);
}

async function checkTokenHealth() {
    if (!isSignedIn || !accessToken) {
        console.log('Not signed in, skipping health check');
        return;
    }

    try {
        console.log('Checking token health...');
        // Make a lightweight API call to verify token is still valid
        const response = await gapi.client.drive.about.get({
            fields: 'user'
        });

        if (response && response.result) {
            console.log('Token health check passed');
        } else {
            console.warn('Token health check returned unexpected result');
        }
    } catch (error) {
        console.error('Token health check failed:', error);

        // If we get a 401, the token is invalid
        if (error.status === 401) {
            console.log('Token is invalid, attempting refresh...');
            refreshTokenSilently();
        }
    }
}

function stopAllRefreshTimers() {
    if (tokenRefreshTimer) {
        clearTimeout(tokenRefreshTimer);
        tokenRefreshTimer = null;
    }
    if (periodicRefreshTimer) {
        clearInterval(periodicRefreshTimer);
        periodicRefreshTimer = null;
    }
    if (tokenHealthCheckTimer) {
        clearInterval(tokenHealthCheckTimer);
        tokenHealthCheckTimer = null;
    }
    console.log('All refresh timers stopped');
}

function setAccessToken(token, expiresIn) {
    accessToken = token;
    gapi.client.setToken({ access_token: token });
    saveTokenToStorage(token, expiresIn);
    scheduleTokenRefresh(expiresIn);

    // Start periodic refresh and health check timers
    startPeriodicRefresh();
    startTokenHealthCheck();

    console.log('Token set with periodic refresh and health monitoring enabled');
}

function restoreTokenFromStorage() {
    const tokenData = getTokenFromStorage();

    if (tokenData) {
        accessToken = tokenData.token;
        gapi.client.setToken({ access_token: tokenData.token });
        isSignedIn = true;

        // Calculate remaining time
        const remainingTime = Math.floor((tokenData.expiryTime - Date.now()) / 1000);
        scheduleTokenRefresh(remainingTime);

        // Start periodic refresh and health check timers
        startPeriodicRefresh();
        startTokenHealthCheck();

        updateSigninStatus(true);
        console.log('Session restored from storage with periodic refresh and health monitoring');
        return true;
    }

    return false;
}

// ============ Sign In/Out Functions ============

function updateSigninStatus(signedIn) {
    isSignedIn = signedIn;
    const authButton = document.getElementById('authButton');
    const authButtonText = document.getElementById('authButtonText');

    if (signedIn) {
        authButton.classList.add('connected');
        authButton.title = 'Connected to Google Drive - Click to disconnect';
        authButtonText.textContent = 'Connected';
        authButton.onclick = handleSignoutClick;

        // Get or create root folder
        getRootFolder();
    } else {
        authButton.classList.remove('connected');
        authButton.title = 'Click to connect to Google Drive';
        authButtonText.textContent = 'Google Drive';
        authButton.onclick = handleAuthClick;
    }
}

function handleAuthClick() {
    console.log('Attempting to sign in to Google...');

    // Check if we're on file:// protocol
    if (window.location.protocol === 'file:') {
        alert('ERROR: Google OAuth does not work with file:// protocol.\n\n' +
              'You need to:\n' +
              '1. Host this file on a web server (even localhost works)\n' +
              '2. For local testing, use: python -m http.server 8000\n' +
              '3. Then open: http://localhost:8000\n\n' +
              'OR upload to GitHub Pages or any web hosting service.');
        return;
    }

    if (!tokenClient) {
        alert('Authentication not initialized yet. Please wait a moment and try again.');
        return;
    }

    try {
        // Request an access token
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (error) {
        console.error('Exception during sign-in:', error);
        alert('Error during sign-in: ' + error.message);
    }
}

function handleSignoutClick() {
    if (confirm('Disconnect from Google Drive? Your files will remain in Drive.')) {
        // Stop all refresh timers
        stopAllRefreshTimers();

        if (accessToken) {
            // Revoke the token
            google.accounts.oauth2.revoke(accessToken, () => {
                console.log('Token revoked');
            });
        }

        accessToken = null;
        isSignedIn = false;
        refreshRetryCount = 0;
        clearTokenFromStorage();
        updateSigninStatus(false);
    }
}

function showSetupError(message) {
    const authButton = document.getElementById('authButton');
    const authButtonText = document.getElementById('authButtonText');

    authButton.style.background = 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)';
    authButton.style.borderColor = 'rgba(231, 76, 60, 0.5)';
    authButton.title = 'Connection Error: ' + message;
    authButtonText.textContent = 'Error';

    console.error('Google Drive setup error:', message);
}
