import { create } from 'zustand';
import authService from '../services/authService';

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

  // Actions
  initialize: async () => {
    if (get().isInitializing || get().isInitialized) {
      return;
    }

    set({ isInitializing: true, error: null });

    try {
      // Subscribe to auth changes
      authService.onAuthChange((isSignedIn) => {
        set({ isSignedIn });
      });

      // Initialize auth service
      await authService.initialize();

      // Set initial state
      set({
        isSignedIn: authService.isSignedIn(),
        isInitialized: true,
        isInitializing: false,
      });

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
      authService.signOut();
      set({
        isSignedIn: false,
        rootFolderId: null,
        formsFolderId: null,
        excelTemplatesFolderId: null,
        dataFileId: null,
        formsDataFileId: null,
        excelDataFileId: null,
      });
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
