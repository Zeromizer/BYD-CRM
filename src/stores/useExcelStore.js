import { create } from 'zustand';
import driveService from '../services/driveService';

const useExcelStore = create((set, get) => ({
  excelTemplates: {},
  isLoading: false,
  error: null,
  lastSyncTime: null,

  // Load Excel templates from localStorage
  loadFromLocalStorage: () => {
    try {
      const stored = localStorage.getItem('excelTemplates');
      if (stored) {
        const templates = JSON.parse(stored);
        console.log('Loaded Excel templates from localStorage:', Object.keys(templates).length);
        set({ excelTemplates: templates });
      }
    } catch (error) {
      console.error('Failed to load Excel templates from localStorage:', error);
      set({ error: 'Failed to load Excel templates' });
    }
  },

  // Save Excel templates to localStorage
  saveToLocalStorage: () => {
    try {
      const { excelTemplates } = get();
      localStorage.setItem('excelTemplates', JSON.stringify(excelTemplates));
      console.log('Saved Excel templates to localStorage');
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

      // Update state and localStorage
      set({
        excelTemplates: synced,
        isLoading: false,
        lastSyncTime: new Date().toISOString()
      });
      localStorage.setItem('excelTemplates', JSON.stringify(synced));

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
}));

export default useExcelStore;
