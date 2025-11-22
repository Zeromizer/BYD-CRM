import { create } from 'zustand';
import driveService from '../services/driveService';

const useFormsStore = create((set, get) => ({
  formTemplates: {},
  isLoading: false,
  error: null,
  lastSyncTime: null,

  // Load form templates from localStorage
  loadFromLocalStorage: () => {
    try {
      const stored = localStorage.getItem('formTemplates');
      if (stored) {
        const templates = JSON.parse(stored);
        console.log('Loaded form templates from localStorage:', Object.keys(templates).length);
        set({ formTemplates: templates });
      }
    } catch (error) {
      console.error('Failed to load form templates from localStorage:', error);
      set({ error: 'Failed to load form templates' });
    }
  },

  // Save form templates to localStorage
  saveToLocalStorage: () => {
    try {
      const { formTemplates } = get();
      localStorage.setItem('formTemplates', JSON.stringify(formTemplates));
      console.log('Saved form templates to localStorage');
    } catch (error) {
      console.error('Failed to save form templates:', error);
      set({ error: 'Failed to save form templates' });
    }
  },

  // Sync form templates with Google Drive
  syncWithDrive: async () => {
    try {
      set({ isLoading: true, error: null });
      const { formTemplates } = get();

      // Sync with Drive (Drive is source of truth)
      const synced = await driveService.syncForms(formTemplates);

      // Update state and localStorage
      set({
        formTemplates: synced,
        isLoading: false,
        lastSyncTime: new Date().toISOString()
      });
      localStorage.setItem('formTemplates', JSON.stringify(synced));

      console.log('Form templates synced with Drive successfully');
      return synced;
    } catch (error) {
      console.error('Failed to sync form templates with Drive:', error);
      set({ error: 'Failed to sync with Google Drive', isLoading: false });
      throw error;
    }
  },

  // Save to Drive (called after any template modification)
  saveToDrive: async () => {
    try {
      const { formTemplates } = get();
      await driveService.saveFormsToDrive(formTemplates);
      set({ lastSyncTime: new Date().toISOString() });
      console.log('Form templates saved to Drive');
    } catch (error) {
      console.error('Failed to save form templates to Drive:', error);
      // Don't throw - allow local changes to persist
    }
  },

  // Add or update a form template
  addTemplate: (formType, templateData) => {
    set((state) => ({
      formTemplates: {
        ...state.formTemplates,
        [formType]: templateData,
      },
    }));
    get().saveToLocalStorage();
    get().saveToDrive(); // Sync to Drive
  },

  // Delete a form template
  deleteTemplate: (formType) => {
    set((state) => {
      const newTemplates = { ...state.formTemplates };
      delete newTemplates[formType];
      return { formTemplates: newTemplates };
    });
    get().saveToLocalStorage();
    get().saveToDrive(); // Sync to Drive
  },

  // Update field mappings for a template
  updateFieldMappings: (formType, fieldMappings) => {
    set((state) => ({
      formTemplates: {
        ...state.formTemplates,
        [formType]: {
          ...state.formTemplates[formType],
          fieldMappings,
        },
      },
    }));
    get().saveToLocalStorage();
    get().saveToDrive(); // Sync to Drive
  },

  // Get a specific template
  getTemplate: (formType) => {
    return get().formTemplates[formType];
  },

  // Get all templates
  getAllTemplates: () => {
    return get().formTemplates;
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

  // Clear all form templates (for sign out or account switching)
  clearAllData: () => {
    console.log('Clearing all form templates');
    set({
      formTemplates: {},
      isLoading: false,
      error: null,
      lastSyncTime: null,
    });
    localStorage.removeItem('formTemplates');
  },
}));

export default useFormsStore;
