/**
 * Microsoft Authentication Service
 *
 * Handles authentication with Microsoft identity platform using MSAL.js
 * Provides login, logout, token management, and user info retrieval.
 */

import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser';
import { msalConfig, loginRequest } from '../config/msalConfig';

class MsAuthService {
  constructor() {
    this.msalInstance = null;
    this.initialized = false;
    this.onAuthChangeCallbacks = [];
    this.tokenRefreshTimer = null;
  }

  /**
   * Initialize MSAL instance
   */
  async initialize() {
    if (this.initialized) {
      return true;
    }

    try {
      this.msalInstance = new PublicClientApplication(msalConfig);
      await this.msalInstance.initialize();

      // Handle redirect response (if returning from login redirect)
      const response = await this.msalInstance.handleRedirectPromise();
      if (response) {
        this.msalInstance.setActiveAccount(response.account);
        this.notifyAuthChange(true);
      } else {
        // Check for existing session
        const accounts = this.msalInstance.getAllAccounts();
        if (accounts.length > 0) {
          this.msalInstance.setActiveAccount(accounts[0]);
          // Verify token is still valid
          await this.getAccessToken();
          this.notifyAuthChange(true);
        }
      }

      // Start token refresh timer
      this.startTokenRefreshTimer();

      this.initialized = true;
      console.log('Microsoft Auth Service initialized');
      return true;
    } catch (error) {
      console.error('MSAL initialization error:', error);
      throw error;
    }
  }

  /**
   * Sign in with popup
   */
  async signIn() {
    await this.initialize();

    try {
      const response = await this.msalInstance.loginPopup(loginRequest);
      this.msalInstance.setActiveAccount(response.account);
      this.notifyAuthChange(true);

      console.log('Microsoft sign-in successful:', response.account.username);
      return {
        success: true,
        user: response.account,
      };
    } catch (error) {
      console.error('Microsoft sign-in failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Sign in with redirect (alternative to popup)
   */
  async signInRedirect() {
    await this.initialize();

    try {
      await this.msalInstance.loginRedirect(loginRequest);
    } catch (error) {
      console.error('Microsoft redirect sign-in failed:', error);
      throw error;
    }
  }

  /**
   * Sign out
   */
  async signOut() {
    if (!this.msalInstance) {
      return;
    }

    try {
      // Clear local storage items
      this.clearAllAppData();

      // Stop refresh timer
      if (this.tokenRefreshTimer) {
        clearInterval(this.tokenRefreshTimer);
        this.tokenRefreshTimer = null;
      }

      // Logout with popup
      await this.msalInstance.logoutPopup({
        postLogoutRedirectUri: msalConfig.auth.postLogoutRedirectUri,
      });

      this.notifyAuthChange(false);
      console.log('Microsoft sign-out successful');
    } catch (error) {
      console.error('Microsoft sign-out failed:', error);
      // Still clear local state even if logout fails
      this.notifyAuthChange(false);
    }
  }

  /**
   * Get access token for API calls
   * Automatically handles token refresh
   */
  async getAccessToken() {
    if (!this.msalInstance) {
      await this.initialize();
    }

    const account = this.msalInstance.getActiveAccount();
    if (!account) {
      throw new Error('No active account. Please sign in.');
    }

    try {
      // Try to get token silently
      const response = await this.msalInstance.acquireTokenSilent({
        ...loginRequest,
        account,
      });
      return response.accessToken;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        // Token expired or needs re-consent, require interactive login
        console.log('Token requires interaction, prompting user...');
        try {
          const response = await this.msalInstance.acquireTokenPopup(loginRequest);
          return response.accessToken;
        } catch (popupError) {
          console.error('Interactive token acquisition failed:', popupError);
          this.notifyAuthChange(false);
          throw popupError;
        }
      }
      throw error;
    }
  }

  /**
   * Check if user is signed in
   */
  isSignedIn() {
    if (!this.msalInstance) {
      return false;
    }
    return !!this.msalInstance.getActiveAccount();
  }

  /**
   * Get current user account
   */
  getCurrentUser() {
    if (!this.msalInstance) {
      return null;
    }
    return this.msalInstance.getActiveAccount();
  }

  /**
   * Get current user's email
   */
  getUserEmail() {
    const account = this.getCurrentUser();
    return account?.username || null;
  }

  /**
   * Get current user's name
   */
  getUserName() {
    const account = this.getCurrentUser();
    return account?.name || null;
  }

  /**
   * Start token refresh timer
   * Tokens typically expire after 1 hour, refresh every 50 minutes
   */
  startTokenRefreshTimer() {
    if (this.tokenRefreshTimer) {
      clearInterval(this.tokenRefreshTimer);
    }

    // Refresh token every 50 minutes
    const REFRESH_INTERVAL = 50 * 60 * 1000;

    this.tokenRefreshTimer = setInterval(async () => {
      if (this.isSignedIn()) {
        try {
          console.log('Refreshing Microsoft access token...');
          await this.getAccessToken();
          console.log('Token refresh successful');
        } catch (error) {
          console.error('Token refresh failed:', error);
        }
      }
    }, REFRESH_INTERVAL);
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
      try {
        callback(isSignedIn);
      } catch (error) {
        console.error('Auth change callback error:', error);
      }
    });
  }

  /**
   * Clear all application data from localStorage
   */
  clearAllAppData() {
    console.log('Clearing all Microsoft/OneDrive application data');

    // Clear OneDrive-specific data
    localStorage.removeItem('onedrive_folder_ids');
    localStorage.removeItem('onedrive_customers_index');

    // Clear user-specific data (if using email-based keys)
    const email = this.getUserEmail();
    if (email) {
      const normalizedEmail = email.toLowerCase().replace(/[^a-z0-9]/g, '_');
      localStorage.removeItem(`bydCRM_onedrive_${normalizedEmail}`);
      localStorage.removeItem(`excelTemplates_onedrive_${normalizedEmail}`);
      localStorage.removeItem(`byd_crm_documents_onedrive_${normalizedEmail}`);
    }
  }
}

// Create singleton instance
const msAuthService = new MsAuthService();

export default msAuthService;
