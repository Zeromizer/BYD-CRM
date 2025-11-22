import { create } from 'zustand';
import authService from '../services/authService';
import driveService from '../services/driveService';
import useCustomerStore from './useCustomerStore';
import useFormsStore from './useFormsStore';
import useExcelStore from './useExcelStore';

/**
 * Authentication Store
 * Manages Google Drive authentication state
 */
const useAuthStore = create((set, get) => ({
  // State
  isSignedIn: false,
  isInitialized: false,
  isInitializing: false,
  error: null,

  // Drive Folder IDs (for future use)
  rootFolderId: null,
  formsFolderId: null,
  excelTemplatesFolderId: null,
  dataFileId: null,
  formsDataFileId: null,
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
      // Subscribe to auth changes
      authService.onAuthChange(async (isSignedIn) => {
        const previousSignInState = get().isSignedIn;
        set({ isSignedIn });

        // When user signs in (transition from false to true)
        if (isSignedIn && !previousSignInState) {
          console.log('User signing in - clearing old data before sync');
          // Clear all existing data before loading new user's data
          useCustomerStore.getState().clearAllData();
          useFormsStore.getState().clearAllData();
          useExcelStore.getState().clearAllData();
          // Clear Drive service cache to prevent using old user's folder IDs
          driveService.clearCache();
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
      useFormsStore.getState().clearAllData();
      useExcelStore.getState().clearAllData();

      // Clear Drive service cache
      driveService.clearCache();

      // Sign out from auth service (clears localStorage and Drive cache)
      authService.signOut();

      // Clear auth state
      set({
        isSignedIn: false,
        rootFolderId: null,
        formsFolderId: null,
        excelTemplatesFolderId: null,
        dataFileId: null,
        formsDataFileId: null,
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
}));

export default useAuthStore;
