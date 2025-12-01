import { CONFIG } from '../config/config.js';
import driveService from './driveService.js';
import { generateCodeVerifier, generateCodeChallenge, storePkceVerifier, retrievePkceVerifier } from '../utils/pkce.js';

/**
 * Google Drive Authentication Service
 * Uses Authorization Code flow with PKCE for proper refresh token support
 * Refresh tokens last 7 days in testing mode, 6 months in production
 */

// Google OAuth endpoints
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';

class AuthService {
  constructor() {
    this.codeClient = null;
    this.accessToken = null;
    this.refreshToken = null;
    this.gapiInitialized = false;
    this.gisInitialized = false;
    this.refreshTimer = null;
    this.periodicRefreshTimer = null;
    this.healthCheckTimer = null;
    this.refreshRetryCount = 0;
    this.onAuthChangeCallbacks = [];
    this.pendingSignIn = null; // Promise for pending sign-in
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

      // Initialize GIS with Authorization Code flow
      await this.initializeGis();

      // Try to restore session from storage
      const restored = await this.restoreSession();

      // If persistent auth is enabled and session wasn't restored, try silent refresh
      if (CONFIG.ENABLE_PERSISTENT_AUTH && !restored) {
        const hasRefreshToken = this.getRefreshTokenFromStorage();
        if (hasRefreshToken) {
          console.log('Found refresh token, attempting silent refresh...');
          try {
            await this.refreshAccessToken();
          } catch (error) {
            console.log('Silent refresh failed, user needs to sign in:', error);
          }
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
   * Initialize Google Identity Services with Authorization Code flow
   */
  async initializeGis() {
    return new Promise(async (resolve, reject) => {
      try {
        // Generate PKCE code verifier and challenge
        const codeVerifier = generateCodeVerifier();
        const codeChallenge = await generateCodeChallenge(codeVerifier);

        // Store verifier for token exchange
        storePkceVerifier(codeVerifier);

        this.codeClient = window.google.accounts.oauth2.initCodeClient({
          client_id: CONFIG.CLIENT_ID,
          scope: CONFIG.SCOPES,
          ux_mode: 'popup',
          callback: async (response) => {
            if (response.error) {
              console.error('Authorization error:', response);
              if (this.pendingSignIn) {
                this.pendingSignIn.reject(response.error);
                this.pendingSignIn = null;
              }
              this.notifyAuthChange(false);
              return;
            }

            try {
              // Exchange authorization code for tokens
              await this.exchangeCodeForTokens(response.code);

              if (this.pendingSignIn) {
                this.pendingSignIn.resolve();
                this.pendingSignIn = null;
              }
            } catch (error) {
              console.error('Token exchange failed:', error);
              if (this.pendingSignIn) {
                this.pendingSignIn.reject(error);
                this.pendingSignIn = null;
              }
              this.notifyAuthChange(false);
            }
          },
        });

        this.gisInitialized = true;
        console.log('GIS initialized with Authorization Code flow + PKCE');
        resolve();
      } catch (error) {
        console.error('GIS initialization error:', error);
        reject(error);
      }
    });
  }

  /**
   * Reinitialize GIS client with fresh PKCE values
   * Called before each sign-in to ensure fresh PKCE challenge
   */
  async reinitializeGisForSignIn() {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    storePkceVerifier(codeVerifier);

    return new Promise((resolve, reject) => {
      try {
        this.codeClient = window.google.accounts.oauth2.initCodeClient({
          client_id: CONFIG.CLIENT_ID,
          scope: CONFIG.SCOPES,
          ux_mode: 'popup',
          callback: async (response) => {
            if (response.error) {
              console.error('Authorization error:', response);
              if (this.pendingSignIn) {
                this.pendingSignIn.reject(response.error);
                this.pendingSignIn = null;
              }
              this.notifyAuthChange(false);
              return;
            }

            try {
              await this.exchangeCodeForTokens(response.code);

              if (this.pendingSignIn) {
                this.pendingSignIn.resolve();
                this.pendingSignIn = null;
              }
            } catch (error) {
              console.error('Token exchange failed:', error);
              if (this.pendingSignIn) {
                this.pendingSignIn.reject(error);
                this.pendingSignIn = null;
              }
              this.notifyAuthChange(false);
            }
          },
        });
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Exchange authorization code for access and refresh tokens
   */
  async exchangeCodeForTokens(code) {
    const codeVerifier = retrievePkceVerifier();

    if (!codeVerifier) {
      throw new Error('PKCE code verifier not found');
    }

    const params = new URLSearchParams({
      client_id: CONFIG.CLIENT_ID,
      code: code,
      code_verifier: codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: window.location.origin + window.location.pathname,
    });

    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Token exchange failed: ${error.error_description || error.error}`);
    }

    const tokens = await response.json();

    console.log('Token exchange successful, refresh_token received:', !!tokens.refresh_token);

    // Store refresh token if provided
    if (tokens.refresh_token) {
      this.refreshToken = tokens.refresh_token;
      this.saveRefreshTokenToStorage(tokens.refresh_token);
    }

    // Set access token
    await this.setAccessToken(tokens.access_token, tokens.expires_in);
    this.notifyAuthChange(true);
  }

  /**
   * Sign in to Google Drive
   */
  async signIn() {
    if (!this.codeClient) {
      throw new Error('Code client not initialized');
    }

    // Enable persistent session if configured
    if (CONFIG.ENABLE_PERSISTENT_AUTH) {
      this.enablePersistentSession();
    }

    // Reinitialize with fresh PKCE values before sign-in
    await this.reinitializeGisForSignIn();

    // Create a promise to track sign-in completion
    return new Promise((resolve, reject) => {
      this.pendingSignIn = { resolve, reject };

      // Request authorization code
      this.codeClient.requestCode();
    });
  }

  /**
   * Sign out from Google Drive
   */
  async signOut() {
    // Revoke the refresh token if available
    if (this.refreshToken) {
      try {
        await fetch(`${REVOKE_ENDPOINT}?token=${this.refreshToken}`, {
          method: 'POST',
        });
        console.log('Refresh token revoked');
      } catch (error) {
        console.error('Failed to revoke refresh token:', error);
      }
    } else if (this.accessToken) {
      try {
        await fetch(`${REVOKE_ENDPOINT}?token=${this.accessToken}`, {
          method: 'POST',
        });
        console.log('Access token revoked');
      } catch (error) {
        console.error('Failed to revoke access token:', error);
      }
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
   * Save access token to localStorage
   */
  saveTokenToStorage(token, expiresIn) {
    const expiryTime = Date.now() + (expiresIn * 1000);
    localStorage.setItem('googleAccessToken', token);
    localStorage.setItem('googleTokenExpiry', expiryTime.toString());
    console.log('Token saved, expires in', expiresIn, 'seconds');
  }

  /**
   * Save refresh token to localStorage
   */
  saveRefreshTokenToStorage(refreshToken) {
    localStorage.setItem('googleRefreshToken', refreshToken);
    console.log('Refresh token saved');
  }

  /**
   * Get refresh token from localStorage
   */
  getRefreshTokenFromStorage() {
    return localStorage.getItem('googleRefreshToken');
  }

  /**
   * Clear refresh token from localStorage
   */
  clearRefreshTokenFromStorage() {
    localStorage.removeItem('googleRefreshToken');
  }

  /**
   * Get access token from localStorage
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
      console.log('Access token expired or expiring soon');
      this.clearTokenFromStorage();
      return null;
    }

    return { token, expiryTime };
  }

  /**
   * Clear access token from localStorage
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
  async restoreSession() {
    const tokenData = this.getTokenFromStorage();
    const refreshToken = this.getRefreshTokenFromStorage();

    // If we have a valid access token, use it
    if (tokenData && this.gapiInitialized) {
      this.accessToken = tokenData.token;
      this.refreshToken = refreshToken;
      window.gapi.client.setToken({ access_token: tokenData.token });

      // Calculate remaining time
      const remainingTime = Math.floor((tokenData.expiryTime - Date.now()) / 1000);
      this.scheduleTokenRefresh(remainingTime);

      // Start periodic refresh and health checks
      this.startPeriodicRefresh();
      this.startHealthCheck();

      // Ensure user email is cached (needed for multi-user storage)
      const cachedEmail = localStorage.getItem('googleUserEmail');
      if (!cachedEmail) {
        console.log('User email not cached, fetching...');
        await this.fetchAndCacheUserEmail();
      }

      this.notifyAuthChange(true);
      console.log('Session restored from storage');
      return true;
    }

    // If access token expired but we have a refresh token, try to refresh
    if (refreshToken && this.gapiInitialized) {
      this.refreshToken = refreshToken;
      console.log('Access token expired, attempting refresh with stored refresh token...');
      try {
        await this.refreshAccessToken();
        return true;
      } catch (error) {
        console.error('Failed to refresh with stored refresh token:', error);
        // Clear invalid refresh token
        this.clearRefreshTokenFromStorage();
        return false;
      }
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
        this.refreshAccessToken();
      }, refreshTime);
    } else {
      // Token expires in less than 5 minutes, refresh now
      console.log('Token expiring soon, refreshing now...');
      this.refreshAccessToken();
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken() {
    const refreshToken = this.refreshToken || this.getRefreshTokenFromStorage();

    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    console.log('Refreshing access token...');

    const params = new URLSearchParams({
      client_id: CONFIG.CLIENT_ID,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    try {
      const response = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const error = await response.json();

        // If refresh token is invalid/expired, clear it
        if (error.error === 'invalid_grant') {
          console.error('Refresh token expired or revoked');
          this.clearRefreshTokenFromStorage();
          this.refreshToken = null;
          throw new Error('Refresh token expired. Please sign in again.');
        }

        throw new Error(`Token refresh failed: ${error.error_description || error.error}`);
      }

      const tokens = await response.json();

      // Update refresh token if a new one is provided
      if (tokens.refresh_token) {
        this.refreshToken = tokens.refresh_token;
        this.saveRefreshTokenToStorage(tokens.refresh_token);
      }

      // Set new access token
      await this.setAccessToken(tokens.access_token, tokens.expires_in);
      this.refreshRetryCount = 0;

      console.log('Access token refreshed successfully');
      this.notifyAuthChange(true);

    } catch (error) {
      console.error('Token refresh failed:', error);

      // Retry with exponential backoff
      if (this.refreshRetryCount < CONFIG.MAX_REFRESH_RETRIES) {
        this.refreshRetryCount++;
        const retryDelay = Math.min(5000 * Math.pow(2, this.refreshRetryCount - 1), 30000);
        console.log(`Retrying token refresh in ${retryDelay}ms (attempt ${this.refreshRetryCount}/${CONFIG.MAX_REFRESH_RETRIES})`);

        return new Promise((resolve, reject) => {
          setTimeout(async () => {
            try {
              await this.refreshAccessToken();
              resolve();
            } catch (retryError) {
              reject(retryError);
            }
          }, retryDelay);
        });
      }

      // All retries failed
      this.refreshRetryCount = 0;

      // If refresh token is invalid, user needs to sign in again
      if (error.message.includes('Refresh token expired')) {
        this.clearSession();
        this.notifyAuthChange(false);
        throw error;
      }

      throw error;
    }
  }

  /**
   * Start periodic token refresh
   */
  startPeriodicRefresh() {
    if (this.periodicRefreshTimer) {
      clearInterval(this.periodicRefreshTimer);
    }

    this.periodicRefreshTimer = setInterval(async () => {
      console.log('Periodic token refresh...');
      try {
        await this.refreshAccessToken();
      } catch (error) {
        console.error('Periodic refresh failed:', error);
      }
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
        try {
          await this.refreshAccessToken();
        } catch (refreshError) {
          console.error('Health check refresh failed:', refreshError);
        }
      }
    }
  }

  /**
   * Clear session and stop all timers
   */
  clearSession() {
    this.accessToken = null;
    this.refreshToken = null;
    this.clearTokenFromStorage();
    this.clearRefreshTokenFromStorage();

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
