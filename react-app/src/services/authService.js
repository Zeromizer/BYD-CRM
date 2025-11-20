import { CONFIG } from '../../../shared/config.js';

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
      this.restoreSession();

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
          callback: (response) => {
            if (response.error) {
              console.error('Token response error:', response);
              this.notifyAuthChange(false);
              reject(response.error);
              return;
            }

            const expiresIn = response.expires_in || 3600;
            this.setAccessToken(response.access_token, expiresIn);
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

    // Request access token
    this.tokenClient.requestAccessToken({ prompt: 'consent' });
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

    this.clearSession();
    this.notifyAuthChange(false);
  }

  /**
   * Set access token and schedule refresh
   */
  setAccessToken(token, expiresIn) {
    this.accessToken = token;
    window.gapi.client.setToken({ access_token: token });

    // Save to localStorage (same keys as vanilla JS)
    this.saveTokenToStorage(token, expiresIn);

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
   */
  clearTokenFromStorage() {
    localStorage.removeItem('googleAccessToken');
    localStorage.removeItem('googleTokenExpiry');
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
      this.tokenClient.requestAccessToken({ prompt: '' });
      this.refreshRetryCount = 0;
    } catch (error) {
      console.error('Token refresh failed:', error);

      if (this.refreshRetryCount < CONFIG.MAX_REFRESH_RETRIES) {
        this.refreshRetryCount++;
        setTimeout(() => this.refreshToken(), 5000);
      } else {
        this.clearSession();
        this.notifyAuthChange(false);
        alert('Your Google Drive session has expired. Please reconnect.');
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
}

// Create singleton instance
const authService = new AuthService();

export default authService;
