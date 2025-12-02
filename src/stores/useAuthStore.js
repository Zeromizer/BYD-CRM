import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import msAuthService from '../services/msAuthService';
import oneDriveService from '../services/oneDriveService';
import userStorage from '../services/userStorage';
import useCustomerStore from './useCustomerStore';
import useExcelStore from './useExcelStore';

/**
 * Authentication Store
 * Manages authentication state for OneDrive cloud storage
 */
const useAuthStore = create((set, get) => ({
  // State
  isSignedIn: false,
  isInitialized: false,
  isInitializing: false,
  error: null,
  currentUserEmail: null,  // Track current user account
  isUserVerified: false,   // Track if current user has been verified against data owner
  migrationPending: false, // Track if legacy data migration is pending

  // Drive Folder IDs (for future use)
  rootFolderId: null,
  excelTemplatesFolderId: null,
  dataFileId: null,
  excelDataFileId: null,

  // Callback for when templates need to sync
  onSignInCallback: null,

  // Actions
  initialize: async () => {
    if (get().isInitializing || get().isInitialized) {
      return;
    }

    set({ isInitializing: true, error: null });

    try {
      // Check for legacy data before auth initialization
      const hasLegacy = userStorage.hasLegacyData();
      if (hasLegacy) {
        set({ migrationPending: true });
      }

      // Subscribe to auth changes
      msAuthService.onAuthChange(async (isSignedIn) => {
        const previousSignInState = get().isSignedIn;
        const previousUserEmail = get().currentUserEmail;
        const currentDataOwner = userStorage.getCurrentDataOwner();

        // Get current user email if signed in (await to ensure we have it)
        let currentUserEmail = null;
        if (isSignedIn) {
          currentUserEmail = msAuthService.getUserEmail();
        }

        // Check if account switched (different user email)
        const isDifferentUser = previousUserEmail && currentUserEmail &&
                                previousUserEmail !== currentUserEmail;

        // Check if current user doesn't match the data owner (multi-user scenario)
        const isDataOwnerMismatch = currentUserEmail && currentDataOwner &&
                                     userStorage.normalizeEmail(currentUserEmail) !== currentDataOwner;

        if (isDifferentUser || isDataOwnerMismatch) {
          // Clear all existing data before loading new user's data
          useCustomerStore.getState().clearAllData();
          useExcelStore.getState().clearAllData();
          // Clear Drive service cache to prevent using old user's folder IDs
          oneDriveService.clearCache();
          // Clear the data owner since we're switching users
          userStorage.setCurrentDataOwner(null);
        }

        // Handle legacy data migration for new user
        if (isSignedIn && currentUserEmail && get().migrationPending) {
          userStorage.migrateLegacyData(currentUserEmail);
          set({ migrationPending: false });
        }

        // Set current data owner and user email when user signs in
        if (isSignedIn && currentUserEmail) {
          userStorage.setCurrentDataOwner(currentUserEmail);
          userStorage.setUserEmail(currentUserEmail);
        }

        set({ isSignedIn, currentUserEmail, isUserVerified: isSignedIn });

        // CRITICAL FIX: Only trigger sync when transitioning from signed-out → signed-in
        // NOT on token refreshes or when already signed in
        if (isSignedIn && !previousSignInState && get().onSignInCallback) {
          try {
            await get().onSignInCallback();
          } catch {
            // Template sync failed, but continue initialization
          }
        }
      });

      // Initialize auth service
      await msAuthService.initialize();

      // Set initial state
      const isSignedIn = msAuthService.isSignedIn();
      set({
        isSignedIn,
        isInitialized: true,
        isInitializing: false,
      });
    } catch (error) {
      set({
        error: error.message,
        isInitialized: false,
        isInitializing: false,
      });
    }
  },

  // Set callback for template sync
  setOnSignInCallback: (callback) => {
    set({ onSignInCallback: callback });
  },

  signIn: async () => {
    try {
      set({ error: null });
      await msAuthService.signIn();
    } catch (error) {
      // User may have cancelled the popup - don't show error for that
      if (error !== 'popup_closed_by_user' && error?.type !== 'popup_closed') {
        set({ error: error.message || error });
      }
    }
  },

  signOut: async () => {
    try {
      set({ error: null });

      // Clear all application data
      useCustomerStore.getState().clearAllData();
      useExcelStore.getState().clearAllData();

      // Clear Drive service cache
      oneDriveService.clearCache();

      // Clear data owner tracking and user email
      userStorage.setCurrentDataOwner(null);
      userStorage.clearUserEmail();

      // Sign out from auth service (clears localStorage and Drive cache)
      await msAuthService.signOut();

      // Clear auth state (including currentUserEmail for account switching detection)
      set({
        isSignedIn: false,
        isUserVerified: false,
        currentUserEmail: null,
        rootFolderId: null,
        excelTemplatesFolderId: null,
        dataFileId: null,
        excelDataFileId: null,
      });
    } catch (error) {
      set({ error: error.message });
    }
  },

  getAccessToken: () => {
    return msAuthService.getAccessToken();
  },

  setFolderIds: (folderIds) => set(folderIds),

  setError: (error) => set({ error }),

  /**
   * Check if it's safe to load data for the current session
   * Returns true if:
   * - User is signed in and verified, OR
   * - No data owner is set (fresh start), OR
   * - Data owner matches the cached user email
   */
  canLoadData: () => {
    const currentDataOwner = userStorage.getCurrentDataOwner();
    // Check for cached user email
    const cachedEmail = userStorage.getUserEmail() || msAuthService.getUserEmail();

    // No data owner set - safe to load (fresh start or offline mode)
    if (!currentDataOwner) {
      return true;
    }

    // No cached email - can't verify, wait for sign-in
    if (!cachedEmail) {
      return false;
    }

    // Check if cached email matches data owner
    return userStorage.normalizeEmail(cachedEmail) === currentDataOwner;
  },

  /**
   * Get migration status for UI display
   */
  getMigrationInfo: () => {
    const hasLegacy = userStorage.hasLegacyData();
    const summary = hasLegacy ? userStorage.getLegacyDataSummary() : null;
    return {
      hasPendingMigration: hasLegacy,
      summary,
    };
  },
}));

// ==========================================
// SELECTORS - Use these for granular subscriptions to prevent unnecessary re-renders
// ==========================================

// Selector for sign-in status only (most commonly needed)
export const useIsSignedIn = () => useAuthStore((state) => state.isSignedIn);

// Selector for initialization status
export const useAuthInitState = () => useAuthStore(
  useShallow((state) => ({
    isInitialized: state.isInitialized,
    isInitializing: state.isInitializing,
  }))
);

// Selector for current user email
export const useCurrentUserEmail = () => useAuthStore((state) => state.currentUserEmail);

// Selector for auth actions (stable reference)
export const useAuthActions = () => useAuthStore(
  useShallow((state) => ({
    initialize: state.initialize,
    signIn: state.signIn,
    signOut: state.signOut,
    getAccessToken: state.getAccessToken,
    setOnSignInCallback: state.setOnSignInCallback,
    canLoadData: state.canLoadData,
  }))
);

export default useAuthStore;
