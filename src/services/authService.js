import { CONFIG } from '../config/config.js';
import driveService from './driveService.js';

/**
 * Google Drive Authentication Service
 * Handles OAuth authentication, token management, and refresh logic
 * Compatible with vanilla JS app using same localStorage keys
 */

class AuthService {
  constructor() {
    this.tokenClient = null;
    this.accessToken = null;
    this.gapiInitialized = false;
    this.gisInitialized = false;
    this.refreshTimer = null;
    this.periodicRefreshTimer = null;
    this.healthCheckTimer = null;
    this.refreshRetryCount = 0;
    this.onAuthChangeCallbacks = [];
  }

  /**
   * Initialize Google API and Google Identity Services
   */
  async initialize() {
    try {
      // Wait for both libraries to load
      await this.waitForGoogleLibraries();

      // Initialize GAPI
      await this.initializeGapi();

      // Initialize GIS
      await this.initializeGis();

      // Try to restore session from storage
      const restored = this.restoreSession();

      // If persistent auth is enabled and session wasn't restored, try silent sign-in
      if (CONFIG.ENABLE_PERSISTENT_AUTH && CONFIG.AUTO_SIGNIN_ON_STARTUP && !restored) {
        const hasPersistentSession = this.hasPersistentSession();
        if (hasPersistentSession) {
          console.log('Attempting silent sign-in for persistent session...');
          // OPTIMIZED: Use microtask instead of 1-second delay for faster startup
          // This still allows initialization to complete but triggers sign-in immediately after
          Promise.resolve().then(() => {
            this.attemptSilentSignIn();
          });
        }
      }

      return true;
    } catch (error) {
      console.error('Auth initialization error:', error);
      throw error;
    }
  }

  /**
   * Wait for Google libraries to load
   */
  waitForGoogleLibraries() {
    return new Promise((resolve) => {
      const checkLibraries = () => {
        if (window.gapi && window.google?.accounts?.oauth2) {
          resolve();
        } else {
          setTimeout(checkLibraries, 100);
        }
      };
      checkLibraries();
    });
  }

  /**
   * Initialize Google API Client
   */
  async initializeGapi() {
    return new Promise((resolve, reject) => {
      window.gapi.load('client', async () => {
        try {
          await window.gapi.client.init({
            discoveryDocs: CONFIG.DISCOVERY_DOCS,
          });
          this.gapiInitialized = true;
          console.log('GAPI initialized');
          resolve();
        } catch (error) {
          console.error('GAPI initialization error:', error);
          reject(error);
        }
      });
    });
  }

  /**
   * Initialize Google Identity Services
   */
  initializeGis() {
    return new Promise((resolve, reject) => {
      try {
        this.tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: CONFIG.CLIENT_ID,
          scope: CONFIG.SCOPES,
          callback: async (response) => {
            if (response.error) {
              console.error('Token response error:', response);
              this.notifyAuthChange(false);
              reject(response.error);
              return;
            }

            const expiresIn = response.expires_in || 3600;
            await this.setAccessToken(response.access_token, expiresIn);
            this.notifyAuthChange(true);
          },
        });

        this.gisInitialized = true;
        console.log('GIS initialized');
        resolve();
      } catch (error) {
        console.error('GIS initialization error:', error);
        reject(error);
      }
    });
  }

  /**
   * Sign in to Google Drive
   */
  signIn() {
    if (!this.tokenClient) {
      throw new Error('Token client not initialized');
    }

    // Enable persistent session if configured
    if (CONFIG.ENABLE_PERSISTENT_AUTH) {
      this.enablePersistentSession();
    }

    // Request access token
    // Use 'select_account' instead of 'consent' for better UX on return visits
    this.tokenClient.requestAccessToken({ prompt: 'select_account' });
  }

  /**
   * Attempt silent sign-in (no user interaction)
   */
  attemptSilentSignIn() {
    if (!this.tokenClient) {
      console.error('Token client not initialized');
      return;
    }

    try {
      console.log('Attempting silent sign-in...');
      // prompt: '' or 'none' for completely silent authentication
      this.tokenClient.requestAccessToken({ prompt: '' });
    } catch (error) {
      console.log('Silent sign-in failed:', error);
      // Silently fail - user will need to sign in manually
    }
  }

  /**
   * Sign out from Google Drive
   */
  signOut() {
    if (this.accessToken) {
      // Revoke the token
      window.google.accounts.oauth2.revoke(this.accessToken, () => {
        console.log('Token revoked');
      });
    }

    // Disable persistent session on explicit sign-out
    this.disablePersistentSession();

    this.clearSession();
    this.clearAllAppData();
    this.notifyAuthChange(false);
  }

  /**
   * Clear all application data from localStorage
   */
  clearAllAppData() {
    console.log('Clearing all application data');
    // Clear customer data
    localStorage.removeItem('bydCRM');
    // Clear form templates
    localStorage.removeItem('formTemplates');
    // Clear Excel templates
    localStorage.removeItem('excelTemplates');
    // Clear folder IDs
    localStorage.removeItem('formsFolderId');
    localStorage.removeItem('excelTemplatesFolderId');
    // Clear cached user email (CRITICAL for account switching!)
    localStorage.removeItem('googleUserEmail');
    // Clear Drive service cached IDs
    driveService.clearCache();
  }

  /**
   * Set access token and schedule refresh
   */
  async setAccessToken(token, expiresIn) {
    this.accessToken = token;
    window.gapi.client.setToken({ access_token: token });

    // Save to localStorage (same keys as vanilla JS)
    this.saveTokenToStorage(token, expiresIn);

    // Fetch and cache user email - awaited to ensure email is available
    // before auth change is notified (critical for multi-user storage)
    await this.fetchAndCacheUserEmail();

    // Schedule token refresh
    this.scheduleTokenRefresh(expiresIn);

    // Start periodic refresh and health checks
    this.startPeriodicRefresh();
    this.startHealthCheck();

    console.log('Access token set with auto-refresh enabled');
  }

  /**
   * Save token to localStorage
   */
  saveTokenToStorage(token, expiresIn) {
    const expiryTime = Date.now() + (expiresIn * 1000);
    localStorage.setItem('googleAccessToken', token);
    localStorage.setItem('googleTokenExpiry', expiryTime.toString());
    console.log('Token saved, expires in', expiresIn, 'seconds');
  }

  /**
   * Get token from localStorage
   */
  getTokenFromStorage() {
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
      this.clearTokenFromStorage();
      return null;
    }

    return { token, expiryTime };
  }

  /**
   * Clear token from localStorage
   * Note: googleUserEmail is NOT cleared here - it should persist across token refreshes
   * and only be cleared on explicit sign-out (in clearAllAppData)
   */
  clearTokenFromStorage() {
    localStorage.removeItem('googleAccessToken');
    localStorage.removeItem('googleTokenExpiry');
    // DO NOT clear googleUserEmail here - it's needed for multi-user storage
    // and should only be cleared on explicit sign-out
  }

  /**
   * Restore session from localStorage
   */
  restoreSession() {
    const tokenData = this.getTokenFromStorage();

    if (tokenData && this.gapiInitialized) {
      this.accessToken = tokenData.token;
      window.gapi.client.setToken({ access_token: tokenData.token });

      // Calculate remaining time
      const remainingTime = Math.floor((tokenData.expiryTime - Date.now()) / 1000);
      this.scheduleTokenRefresh(remainingTime);

      // Start periodic refresh and health checks
      this.startPeriodicRefresh();
      this.startHealthCheck();

      // Ensure user email is cached (needed for multi-user storage)
      // This is a safety measure in case the email was somehow cleared
      const cachedEmail = localStorage.getItem('googleUserEmail');
      if (!cachedEmail) {
        console.log('User email not cached, fetching...');
        this.fetchAndCacheUserEmail();
      }

      this.notifyAuthChange(true);
      console.log('Session restored from storage');
      return true;
    }

    return false;
  }

  /**
   * Schedule token refresh before expiry
   */
  scheduleTokenRefresh(expiresIn) {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    // Schedule refresh 5 minutes before expiry
    const refreshTime = (expiresIn - 300) * 1000;

    if (refreshTime > 0) {
      console.log('Token refresh scheduled in', refreshTime / 1000, 'seconds');
      this.refreshTimer = setTimeout(() => {
        this.refreshToken();
      }, refreshTime);
    }
  }

  /**
   * Refresh token silently
   */
  refreshToken() {
    if (!this.tokenClient) {
      console.error('Token client not initialized');
      return;
    }

    try {
      console.log('Refreshing token...');
      // Use prompt: '' for silent refresh (no user interaction)
      this.tokenClient.requestAccessToken({ prompt: '' });
      this.refreshRetryCount = 0;
    } catch (error) {
      console.error('Token refresh failed:', error);

      // Retry with exponential backoff
      if (this.refreshRetryCount < CONFIG.MAX_REFRESH_RETRIES) {
        this.refreshRetryCount++;
        const retryDelay = Math.min(5000 * Math.pow(2, this.refreshRetryCount - 1), 30000);
        console.log(`Retrying token refresh in ${retryDelay}ms (attempt ${this.refreshRetryCount}/${CONFIG.MAX_REFRESH_RETRIES})`);
        setTimeout(() => this.refreshToken(), retryDelay);
      } else {
        // Only clear session if not using persistent auth
        if (!CONFIG.ENABLE_PERSISTENT_AUTH || !this.hasPersistentSession()) {
          this.clearSession();
          this.notifyAuthChange(false);
          alert('Your Google Drive session has expired. Please reconnect.');
        } else {
          console.log('Persistent session enabled - will retry on next periodic refresh');
          // Reset retry count for next attempt
          this.refreshRetryCount = 0;
        }
      }
    }
  }

  /**
   * Start periodic token refresh
   */
  startPeriodicRefresh() {
    if (this.periodicRefreshTimer) {
      clearInterval(this.periodicRefreshTimer);
    }

    this.periodicRefreshTimer = setInterval(() => {
      console.log('Periodic token refresh...');
      this.refreshToken();
    }, CONFIG.PERIODIC_REFRESH_INTERVAL);
  }

  /**
   * Start token health check
   */
  startHealthCheck() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(async () => {
      await this.checkTokenHealth();
    }, CONFIG.HEALTH_CHECK_INTERVAL);
  }

  /**
   * Check if token is still valid
   */
  async checkTokenHealth() {
    if (!this.accessToken) return;

    try {
      await window.gapi.client.drive.about.get({ fields: 'user' });
      console.log('Token health check passed');
    } catch (error) {
      console.error('Token health check failed:', error);
      if (error.status === 401) {
        this.refreshToken();
      }
    }
  }

  /**
   * Clear session and stop all timers
   */
  clearSession() {
    this.accessToken = null;
    this.clearTokenFromStorage();

    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (this.periodicRefreshTimer) {
      clearInterval(this.periodicRefreshTimer);
      this.periodicRefreshTimer = null;
    }
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    console.log('Session cleared');
  }

  /**
   * Check if user is signed in
   */
  isSignedIn() {
    return !!this.accessToken;
  }

  /**
   * Get current access token
   */
  getAccessToken() {
    return this.accessToken;
  }

  /**
   * Get current user's email
   * Returns null if not signed in or if email cannot be retrieved
   */
  getUserEmail() {
    if (!this.accessToken) {
      return null;
    }

    try {
      // Try to get from localStorage cache first
      const cachedEmail = localStorage.getItem('googleUserEmail');
      if (cachedEmail) {
        return cachedEmail;
      }

      // If not cached, fetch from API (async, so return cached value or null for now)
      this.fetchAndCacheUserEmail();
      return null;
    } catch (error) {
      console.error('Failed to get user email:', error);
      return null;
    }
  }

  /**
   * Fetch user email from Google API and cache it
   */
  async fetchAndCacheUserEmail() {
    try {
      const response = await window.gapi.client.drive.about.get({
        fields: 'user(emailAddress)'
      });
      const email = response.result.user.emailAddress;
      localStorage.setItem('googleUserEmail', email);
      console.log('User email cached:', email);
      return email;
    } catch (error) {
      console.error('Failed to fetch user email:', error);
      return null;
    }
  }

  /**
   * Subscribe to authentication state changes
   */
  onAuthChange(callback) {
    this.onAuthChangeCallbacks.push(callback);
    return () => {
      this.onAuthChangeCallbacks = this.onAuthChangeCallbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Notify all subscribers of auth state change
   */
  notifyAuthChange(isSignedIn) {
    this.onAuthChangeCallbacks.forEach(callback => {
      callback(isSignedIn);
    });
  }

  /**
   * Enable persistent session
   */
  enablePersistentSession() {
    localStorage.setItem('persistentSessionEnabled', 'true');
    console.log('Persistent session enabled');
  }

  /**
   * Disable persistent session
   */
  disablePersistentSession() {
    localStorage.removeItem('persistentSessionEnabled');
    console.log('Persistent session disabled');
  }

  /**
   * Check if persistent session is enabled
   */
  hasPersistentSession() {
    return localStorage.getItem('persistentSessionEnabled') === 'true';
  }
}

// Create singleton instance
const authService = new AuthService();

export default authService;
