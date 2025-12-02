import { create } from 'zustand';
import { getStorageService } from '../services/storageServiceSelector';
import userStorage from '../services/userStorage';

/**
 * Document Store - State management for document templates
 *
 * Manages:
 * - Document templates (forms)
 * - Field configurations
 * - Cloud storage sync (Google Drive or OneDrive)
 * - Template CRUD operations
 */

const useDocumentStore = create((set, get) => ({
  // State
  templates: {},
  loading: false,
  error: null,
  syncQueue: [],
  isSyncing: false,
  lastSyncTime: null,

  /**
   * Load templates from localStorage
   * Uses userStorage for consistent email key management
   */
  loadFromLocalStorage: () => {
    try {
      const userEmail = userStorage.getUserEmail();
      if (!userEmail) {
        return;
      }

      const storageKey = `byd_crm_documents_${userEmail.toLowerCase().trim()}`;
      const stored = localStorage.getItem(storageKey);

      if (stored) {
        const templates = JSON.parse(stored);
        // Ensure each template has a valid ID matching its key
        const validatedTemplates = {};
        for (const [key, template] of Object.entries(templates)) {
          if (template && typeof template === 'object') {
            // Ensure id property matches the key
            validatedTemplates[key] = {
              ...template,
              id: template.id || key,
            };
          }
        }
        set({ templates: validatedTemplates });
      }
    } catch (error) {
      set({ error: error.message });
    }
  },

  /**
   * Save templates to localStorage
   * Uses userStorage for consistent email key management
   */
  saveToLocalStorage: (templates) => {
    try {
      const userEmail = userStorage.getUserEmail();
      if (!userEmail) {
        return;
      }

      const storageKey = `byd_crm_documents_${userEmail.toLowerCase().trim()}`;
      localStorage.setItem(storageKey, JSON.stringify(templates));
    } catch (error) {
      set({ error: error.message });
    }
  },

  /**
   * Sync template to cloud storage
   * FIXED: Saves ALL templates to maintain collection integrity
   * Uses the centralized storageService method for consistency
   */
  syncTemplateToDrive: async (templateId) => {
    const { templates } = get();
    const template = templates[templateId];

    if (!template) return;

    try {
      // Update the specific template with new timestamp
      const updatedTemplates = {
        ...templates,
        [templateId]: {
          ...template,
          id: templateId,
          updatedAt: new Date().toISOString(),
        },
      };

      // Save ALL templates (storageService will handle the format)
      await getStorageService().saveDocumentTemplateToDrive(updatedTemplates);
    } catch (error) {
      throw error;
    }
  },

  /**
   * Add sync operation to queue
   */
  queueSync: (templateId) => {
    const { syncQueue } = get();
    if (!syncQueue.includes(templateId)) {
      set({ syncQueue: [...syncQueue, templateId] });
    }
    get().processSyncQueue();
  },

  /**
   * Process sync queue
   */
  processSyncQueue: async () => {
    const { syncQueue, isSyncing } = get();

    if (isSyncing || syncQueue.length === 0) return;

    set({ isSyncing: true });

    while (get().syncQueue.length > 0) {
      const templateId = get().syncQueue[0];

      try {
        await get().syncTemplateToDrive(templateId);
        set({ syncQueue: get().syncQueue.slice(1) });
      } catch {
        // Remove failed item and continue
        set({ syncQueue: get().syncQueue.slice(1) });
      }
    }

    set({ isSyncing: false });
  },

  /**
   * Create new template
   */
  createTemplate: async (templateData) => {
    try {
      set({ loading: true, error: null });

      const templateId = `template_${Date.now()}`;
      const newTemplate = {
        id: templateId,
        name: templateData.name,
        category: templateData.category || 'other',
        fileId: templateData.fileId,
        fileName: templateData.fileName,
        dpi: templateData.dpi || 300,
        fields: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const { templates } = get();
      const updatedTemplates = {
        ...templates,
        [templateId]: newTemplate,
      };

      set({ templates: updatedTemplates, loading: false });
      get().saveToLocalStorage(updatedTemplates);
      get().queueSync(templateId);

      return templateId;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  /**
   * Update template
   */
  updateTemplate: (templateId, updates) => {
    try {
      const { templates } = get();
      const template = templates[templateId];

      if (!template) {
        throw new Error('Template not found');
      }

      const updatedTemplate = {
        ...template,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      const updatedTemplates = {
        ...templates,
        [templateId]: updatedTemplate,
      };

      set({ templates: updatedTemplates });
      get().saveToLocalStorage(updatedTemplates);
      get().queueSync(templateId);

      return updatedTemplate;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  /**
   * Update template fields
   */
  updateTemplateFields: (templateId, fields) => {
    return get().updateTemplate(templateId, { fields });
  },

  /**
   * Delete template from both localStorage and cloud storage
   */
  deleteTemplate: async (templateId) => {
    try {
      set({ loading: true, error: null });

      const { templates } = get();
      const updatedTemplates = { ...templates };
      delete updatedTemplates[templateId];

      // Update local state and localStorage first
      set({ templates: updatedTemplates, loading: false });
      get().saveToLocalStorage(updatedTemplates);

      // Delete from cloud storage
      try {
        await getStorageService().deleteDocumentTemplateFromDrive(templateId);
      } catch {
        // Don't throw - local deletion succeeded, cloud deletion is best-effort
      }

      return true;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  /**
   * Get template by ID
   */
  getTemplate: (templateId) => {
    const { templates } = get();
    return templates[templateId];
  },

  /**
   * Get all templates as array
   */
  getTemplatesArray: () => {
    const { templates } = get();
    return Object.values(templates).sort(
      (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
    );
  },

  /**
   * Get templates by category
   */
  getTemplatesByCategory: (category) => {
    const { templates } = get();
    return Object.values(templates)
      .filter((t) => t.category === category)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  },

  /**
   * Search templates
   */
  searchTemplates: (query) => {
    const { templates } = get();
    const lowerQuery = query.toLowerCase();

    return Object.values(templates)
      .filter(
        (t) =>
          t.name.toLowerCase().includes(lowerQuery) ||
          t.category.toLowerCase().includes(lowerQuery) ||
          t.fileName.toLowerCase().includes(lowerQuery)
      )
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  },

  /**
   * Load templates from cloud storage
   * Uses storageService for consistent folder location
   * FIXED: Properly extracts templates from { templates: {...} } format
   */
  loadFromDrive: async () => {
    try {
      set({ loading: true, error: null });

      // Use storageService to load templates (ensures correct folder location)
      const driveData = await getStorageService().loadDocumentTemplatesFromDrive();

      // Extract templates from the wrapper format
      const templates = driveData?.templates || driveData || {};

      set({ templates, loading: false });
      get().saveToLocalStorage(templates);

      return templates;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  /**
   * Sync templates with cloud storage
   * IMPORTANT: Loads from localStorage first before syncing to prevent data loss
   * This is the primary sync function that should be called on app init
   * Uses getStorageService().syncDocumentTemplates for consistent behavior with forms/excel
   * FIXED: Properly handles template format and ensures all templates are preserved
   */
  syncWithDrive: async () => {
    try {
      set({ loading: true, error: null });

      // IMPORTANT: Load from localStorage first before syncing
      // This ensures we don't lose locally-created templates when sync runs
      // before the component has mounted and called loadFromLocalStorage
      get().loadFromLocalStorage();

      const localTemplates = get().templates;

      // Use storageService for sync (ensures correct folder location)
      // syncDocumentTemplates now handles the format properly and returns templates object
      const mergedTemplates = await getStorageService().syncDocumentTemplates(localTemplates);

      // Ensure we have a valid templates object
      const validTemplates = mergedTemplates && typeof mergedTemplates === 'object'
        ? (mergedTemplates.templates || mergedTemplates)
        : {};

      // Update state and localStorage
      set({
        templates: validTemplates,
        loading: false,
        lastSyncTime: new Date().toISOString()
      });
      get().saveToLocalStorage(validTemplates);

      return validTemplates;
    } catch {
      set({ error: 'Failed to sync with cloud storage', loading: false });
      // Don't throw - return local templates as fallback (same pattern as forms/excel)
      return get().templates;
    }
  },

  /**
   * Clear error
   */
  clearError: () => {
    set({ error: null });
  },

  /**
   * Reset store
   */
  reset: () => {
    set({
      templates: {},
      loading: false,
      error: null,
      syncQueue: [],
      isSyncing: false,
    });
  },
}));

export default useDocumentStore;
