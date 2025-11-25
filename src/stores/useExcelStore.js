import { create } from 'zustand';
import driveService from '../services/driveService';
import userStorage from '../services/userStorage';

const useExcelStore = create((set, get) => ({
  excelTemplates: {},
  isLoading: false,
  error: null,
  lastSyncTime: null,

  /**
   * Load Excel templates from user-specific localStorage
   * Falls back to legacy storage during migration
   */
  loadFromLocalStorage: () => {
    try {
      const userEmail = localStorage.getItem('googleUserEmail');

      // Try to load from user-specific storage first
      if (userEmail) {
        const templates = userStorage.loadUserData(userEmail, 'excel');
        if (templates && Object.keys(templates).length > 0) {
          console.log(`Loaded ${Object.keys(templates).length} Excel templates for user: ${userEmail}`);
          set({ excelTemplates: templates });
          return;
        }
      }

      // Fall back to legacy storage (for migration)
      const stored = localStorage.getItem('excelTemplates');
      if (stored) {
        const templates = JSON.parse(stored);
        console.log('Loaded Excel templates from legacy localStorage:', Object.keys(templates).length);
        set({ excelTemplates: templates });
      }
    } catch (error) {
      console.error('Failed to load Excel templates from localStorage:', error);
      set({ error: 'Failed to load Excel templates' });
    }
  },

  /**
   * Save Excel templates to user-specific localStorage
   * Falls back to legacy storage if no user is signed in
   */
  saveToLocalStorage: () => {
    try {
      const { excelTemplates } = get();
      const userEmail = localStorage.getItem('googleUserEmail');

      if (userEmail) {
        // Save to user-specific storage
        userStorage.saveUserData(userEmail, 'excel', excelTemplates);
        console.log(`Saved ${Object.keys(excelTemplates).length} Excel templates for user: ${userEmail}`);
      } else {
        // Fall back to legacy storage (offline mode)
        localStorage.setItem('excelTemplates', JSON.stringify(excelTemplates));
        console.log('Saved Excel templates to legacy localStorage');
      }
    } catch (error) {
      console.error('Failed to save Excel templates:', error);
      set({ error: 'Failed to save Excel templates' });
    }
  },

  // Sync Excel templates with Google Drive
  syncWithDrive: async () => {
    try {
      set({ isLoading: true, error: null });
      const { excelTemplates } = get();

      // Sync with Drive (Drive is source of truth)
      const synced = await driveService.syncExcel(excelTemplates);

      // Update state and user-specific localStorage
      set({
        excelTemplates: synced,
        isLoading: false,
        lastSyncTime: new Date().toISOString()
      });
      get().saveToLocalStorage();

      console.log('Excel templates synced with Drive successfully');
      return synced;
    } catch (error) {
      console.error('Failed to sync Excel templates with Drive:', error);
      set({ error: 'Failed to sync with Google Drive', isLoading: false });
      throw error;
    }
  },

  // Save to Drive (called after any template modification)
  saveToDrive: async () => {
    try {
      const { excelTemplates } = get();
      await driveService.saveExcelToDrive(excelTemplates);
      set({ lastSyncTime: new Date().toISOString() });
      console.log('Excel templates saved to Drive');
    } catch (error) {
      console.error('Failed to save Excel templates to Drive:', error);
      // Don't throw - allow local changes to persist
    }
  },

  // Add or update an Excel template
  addTemplate: (templateId, templateData) => {
    set((state) => ({
      excelTemplates: {
        ...state.excelTemplates,
        [templateId]: templateData,
      },
    }));
    get().saveToLocalStorage();
    get().saveToDrive(); // Sync to Drive
  },

  // Update template
  updateTemplate: (templateId, updates) => {
    set((state) => ({
      excelTemplates: {
        ...state.excelTemplates,
        [templateId]: {
          ...state.excelTemplates[templateId],
          ...updates,
        },
      },
    }));
    get().saveToLocalStorage();
    get().saveToDrive(); // Sync to Drive
  },

  // Delete an Excel template
  deleteTemplate: (templateId) => {
    set((state) => {
      const newTemplates = { ...state.excelTemplates };
      delete newTemplates[templateId];
      return { excelTemplates: newTemplates };
    });
    get().saveToLocalStorage();
    get().saveToDrive(); // Sync to Drive
  },

  // Update field mappings for a template
  updateFieldMappings: (templateId, fieldMappings) => {
    set((state) => ({
      excelTemplates: {
        ...state.excelTemplates,
        [templateId]: {
          ...state.excelTemplates[templateId],
          fieldMappings,
        },
      },
    }));
    get().saveToLocalStorage();
    get().saveToDrive(); // Sync to Drive
  },

  // Get a specific template
  getTemplate: (templateId) => {
    return get().excelTemplates[templateId];
  },

  // Get all templates
  getAllTemplates: () => {
    return get().excelTemplates;
  },

  // Set loading state
  setLoading: (isLoading) => {
    set({ isLoading });
  },

  // Set error
  setError: (error) => {
    set({ error });
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },

  /**
   * Clear all Excel templates (for sign out or account switching)
   * Clears both user-specific and legacy storage
   */
  clearAllData: () => {
    console.log('Clearing all Excel templates');
    const userEmail = localStorage.getItem('googleUserEmail');

    set({
      excelTemplates: {},
      isLoading: false,
      error: null,
      lastSyncTime: null,
    });

    // Clear from user-specific storage
    if (userEmail) {
      userStorage.clearUserData(userEmail, 'excel');
    }

    // Also clear legacy storage
    localStorage.removeItem('excelTemplates');
  },
}));

export default useExcelStore;
