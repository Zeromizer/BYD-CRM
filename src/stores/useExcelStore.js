import { create } from 'zustand';
import { getStorageService } from '../services/storageServiceSelector';
import userStorage from '../services/userStorage';
import syncQueueService, { SYNC_STATUS } from '../services/syncQueueService';

const useExcelStore = create((set, get) => ({
  excelTemplates: {},
  isLoading: false,
  error: null,
  lastSyncTime: null,
  syncStatus: SYNC_STATUS.SYNCED,
  syncError: null,

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
          set({ excelTemplates: templates });
          return;
        }
      }

      // Fall back to legacy storage (for migration)
      const stored = localStorage.getItem('excelTemplates');
      if (stored) {
        const templates = JSON.parse(stored);
        set({ excelTemplates: templates });
      }
    } catch {
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
      } else {
        // Fall back to legacy storage (offline mode)
        localStorage.setItem('excelTemplates', JSON.stringify(excelTemplates));
      }
    } catch {
      set({ error: 'Failed to save Excel templates' });
    }
  },

  // Sync Excel templates with Google Drive
  syncWithDrive: async () => {
    try {
      set({ isLoading: true, error: null });
      const { excelTemplates } = get();

      // Sync with Drive (Drive is source of truth)
      const synced = await getStorageService().syncExcel(excelTemplates);

      // Update state and user-specific localStorage
      set({
        excelTemplates: synced,
        isLoading: false,
        lastSyncTime: new Date().toISOString()
      });
      get().saveToLocalStorage();

      return synced;
    } catch (error) {
      set({ error: 'Failed to sync with Google Drive', isLoading: false });
      throw error;
    }
  },

  // Save to Drive with queue and retry support
  saveToDrive: async () => {
    const { excelTemplates } = get();

    // Update status to syncing
    set({ syncStatus: SYNC_STATUS.SYNCING, syncError: null });

    // Queue the save operation with retry logic
    const result = await syncQueueService.enqueue(
      'excel',
      async () => {
        await getStorageService().saveExcelToDrive(excelTemplates);
      },
      { templateCount: Object.keys(excelTemplates).length }
    );

    if (result.success) {
      set({
        syncStatus: SYNC_STATUS.SYNCED,
        syncError: null,
        lastSyncTime: new Date().toISOString()
      });
    } else if (result.offline) {
      set({
        syncStatus: SYNC_STATUS.OFFLINE,
        syncError: 'Offline - will sync when connected'
      });
    } else {
      set({
        syncStatus: SYNC_STATUS.FAILED,
        syncError: result.error || 'Failed to sync'
      });
    }

    return result;
  },

  // Force retry failed sync
  retrySyncToDrive: async () => {
    set({ syncStatus: SYNC_STATUS.SYNCING, syncError: null });
    await syncQueueService.retryFailed();
    const status = syncQueueService.getStatus('excel');
    set({
      syncStatus: status.status,
      syncError: status.lastError,
      lastSyncTime: status.lastSyncTime
    });
  },

  // Get current sync status
  getSyncStatus: () => {
    return {
      status: get().syncStatus,
      error: get().syncError,
      lastSyncTime: get().lastSyncTime
    };
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
    const userEmail = localStorage.getItem('googleUserEmail');

    set({
      excelTemplates: {},
      isLoading: false,
      error: null,
      lastSyncTime: null,
      syncStatus: SYNC_STATUS.SYNCED,
      syncError: null,
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
