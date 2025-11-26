import { create } from 'zustand';
import authService from '../services/authService';
import driveService from '../services/driveService';
import userStorage from '../services/userStorage';
import useCustomerStore from './useCustomerStore';
import useExcelStore from './useExcelStore';

/**
 * Authentication Store
 * Manages Google Drive authentication state and multi-user data isolation
 */
const useAuthStore = create((set, get) => ({
  // State
  isSignedIn: false,
  isInitialized: false,
  isInitializing: false,
  error: null,
  currentUserEmail: null,  // Track current Google account
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
        const summary = userStorage.getLegacyDataSummary();
        console.log('📦 Legacy data detected:', summary);
        set({ migrationPending: true });
      }

      // Subscribe to auth changes
      authService.onAuthChange(async (isSignedIn) => {
        const previousSignInState = get().isSignedIn;
        const previousUserEmail = get().currentUserEmail;
        const currentDataOwner = userStorage.getCurrentDataOwner();

        // Get current user email if signed in (await to ensure we have it)
        let currentUserEmail = null;
        if (isSignedIn) {
          currentUserEmail = authService.getUserEmail();
          // If not cached, fetch it now
          if (!currentUserEmail) {
            currentUserEmail = await authService.fetchAndCacheUserEmail();
          }
        }

        // Check if account switched (different user email)
        const isDifferentUser = previousUserEmail && currentUserEmail &&
                                previousUserEmail !== currentUserEmail;

        // Check if current user doesn't match the data owner (multi-user scenario)
        const isDataOwnerMismatch = currentUserEmail && currentDataOwner &&
                                     userStorage.normalizeEmail(currentUserEmail) !== currentDataOwner;

        if (isDifferentUser || isDataOwnerMismatch) {
          const reason = isDifferentUser ? 'account switched' : 'data owner mismatch';
          console.log(`👤 ${reason}: clearing old data for new user ${currentUserEmail}`);

          // Clear all existing data before loading new user's data
          useCustomerStore.getState().clearAllData();
          useExcelStore.getState().clearAllData();
          // Clear Drive service cache to prevent using old user's folder IDs
          driveService.clearCache();
          // Clear the data owner since we're switching users
          userStorage.setCurrentDataOwner(null);
        }

        // Handle legacy data migration for new user
        if (isSignedIn && currentUserEmail && get().migrationPending) {
          console.log(`🔄 Migrating legacy data to user: ${currentUserEmail}`);
          const migrationResult = userStorage.migrateLegacyData(currentUserEmail);
          if (migrationResult.success) {
            console.log('✅ Legacy data migration successful:', migrationResult.migrated);
          } else {
            console.error('❌ Legacy data migration failed:', migrationResult.errors);
          }
          set({ migrationPending: false });
        }

        // Set current data owner when user signs in
        if (isSignedIn && currentUserEmail) {
          userStorage.setCurrentDataOwner(currentUserEmail);
        }

        set({ isSignedIn, currentUserEmail, isUserVerified: isSignedIn });

        // When user signs in and it's the same user
        if (isSignedIn && !previousSignInState && !isDifferentUser && !isDataOwnerMismatch && currentUserEmail) {
          console.log(`✅ Same user signing in (${currentUserEmail}) - keeping local data, will merge with Drive`);
        }

        // Trigger template sync when user signs in
        if (isSignedIn && get().onSignInCallback) {
          try {
            await get().onSignInCallback();
          } catch (error) {
            console.error('Template sync on sign-in failed:', error);
          }
        }
      });

      // Initialize auth service
      await authService.initialize();

      // Set initial state
      const isSignedIn = authService.isSignedIn();
      set({
        isSignedIn,
        isInitialized: true,
        isInitializing: false,
      });

      // If already signed in, trigger sync
      if (isSignedIn && get().onSignInCallback) {
        try {
          await get().onSignInCallback();
        } catch (error) {
          console.error('Initial template sync failed:', error);
        }
      }

      console.log('Auth store initialized');
    } catch (error) {
      console.error('Auth initialization failed:', error);
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
      authService.signIn();
    } catch (error) {
      console.error('Sign in failed:', error);
      set({ error: error.message });
    }
  },

  signOut: () => {
    try {
      set({ error: null });

      // Clear all application data
      useCustomerStore.getState().clearAllData();
      useExcelStore.getState().clearAllData();

      // Clear Drive service cache
      driveService.clearCache();

      // Clear data owner tracking
      userStorage.setCurrentDataOwner(null);

      // Sign out from auth service (clears localStorage and Drive cache)
      authService.signOut();

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

      console.log('Signed out successfully - all data cleared');
    } catch (error) {
      console.error('Sign out failed:', error);
      set({ error: error.message });
    }
  },

  getAccessToken: () => {
    return authService.getAccessToken();
  },

  setFolderIds: (folderIds) => set(folderIds),

  setError: (error) => set({ error }),

  /**
   * Check if it's safe to load data for the current session
   * Returns true if:
   * - User is signed in and verified, OR
   * - No data owner is set (fresh start), OR
   * - Data owner matches the cached googleUserEmail
   */
  canLoadData: () => {
    const currentDataOwner = userStorage.getCurrentDataOwner();
    const cachedEmail = localStorage.getItem('googleUserEmail');

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

export default useAuthStore;
