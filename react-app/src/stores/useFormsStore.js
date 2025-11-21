import { create } from 'zustand';

const useFormsStore = create((set, get) => ({
  formTemplates: {},
  isLoading: false,
  error: null,

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

  // Add or update a form template
  addTemplate: (formType, templateData) => {
    set((state) => ({
      formTemplates: {
        ...state.formTemplates,
        [formType]: templateData,
      },
    }));
    get().saveToLocalStorage();
  },

  // Delete a form template
  deleteTemplate: (formType) => {
    set((state) => {
      const newTemplates = { ...state.formTemplates };
      delete newTemplates[formType];
      return { formTemplates: newTemplates };
    });
    get().saveToLocalStorage();
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
}));

export default useFormsStore;
