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
      const userEmail = userStorage.getUserEmail();

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
      const userEmail = userStorage.getUserEmail();

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

  // Sync Excel templates with cloud storage
  // FIXED: Properly handles template format and ensures all templates are preserved
  // IMPORTANT: Loads from localStorage first to prevent data loss
  syncWithDrive: async () => {
    try {
      set({ isLoading: true, error: null });

      // CRITICAL: Load from localStorage first before syncing
      // This ensures we don't lose locally-created templates when sync runs
      // before the component has mounted and called loadFromLocalStorage
      get().loadFromLocalStorage();

      const { excelTemplates } = get();

      // Sync with Drive (Drive is source of truth)
      // syncExcel now returns the templates object directly (not wrapped)
      const synced = await getStorageService().syncExcel(excelTemplates);

      // Ensure we have a valid templates object
      const validTemplates = synced && typeof synced === 'object'
        ? (synced.templates || synced)
        : {};

      // Update state and user-specific localStorage
      set({
        excelTemplates: validTemplates,
        isLoading: false,
        lastSyncTime: new Date().toISOString()
      });
      get().saveToLocalStorage();

      return validTemplates;
    } catch (error) {
      set({ error: 'Failed to sync with cloud storage', isLoading: false });
      // Return local templates as fallback instead of throwing
      return get().excelTemplates;
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
    const userEmail = userStorage.getUserEmail();

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
