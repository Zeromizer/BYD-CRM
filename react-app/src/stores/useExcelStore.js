import { create } from 'zustand';

const useExcelStore = create((set, get) => ({
  excelTemplates: {},
  isLoading: false,
  error: null,

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

  // Add or update an Excel template
  addTemplate: (templateId, templateData) => {
    set((state) => ({
      excelTemplates: {
        ...state.excelTemplates,
        [templateId]: templateData,
      },
    }));
    get().saveToLocalStorage();
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
  },

  // Delete an Excel template
  deleteTemplate: (templateId) => {
    set((state) => {
      const newTemplates = { ...state.excelTemplates };
      delete newTemplates[templateId];
      return { excelTemplates: newTemplates };
    });
    get().saveToLocalStorage();
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
