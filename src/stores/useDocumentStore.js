import { create } from 'zustand';
import driveService from '../services/driveService';

/**
 * Document Store - State management for document templates
 *
 * Manages:
 * - Document templates (forms)
 * - Field configurations
 * - Google Drive sync
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
   * Uses googleUserEmail key for consistency with rest of app
   */
  loadFromLocalStorage: () => {
    try {
      const userEmail = localStorage.getItem('googleUserEmail');
      if (!userEmail) {
        console.log('No googleUserEmail found, skipping document templates load');
        return;
      }

      const storageKey = `byd_crm_documents_${userEmail.toLowerCase().trim()}`;
      const stored = localStorage.getItem(storageKey);

      if (stored) {
        const templates = JSON.parse(stored);
        console.log(`Loaded ${Object.keys(templates).length} document templates for user: ${userEmail}`);
        set({ templates });
      }
    } catch (error) {
      console.error('Error loading templates from localStorage:', error);
      set({ error: error.message });
    }
  },

  /**
   * Save templates to localStorage
   * Uses googleUserEmail key for consistency with rest of app
   */
  saveToLocalStorage: (templates) => {
    try {
      const userEmail = localStorage.getItem('googleUserEmail');
      if (!userEmail) {
        console.warn('Cannot save document templates: no googleUserEmail');
        return;
      }

      const storageKey = `byd_crm_documents_${userEmail.toLowerCase().trim()}`;
      localStorage.setItem(storageKey, JSON.stringify(templates));
      console.log(`Saved ${Object.keys(templates).length} document templates for user: ${userEmail}`);
    } catch (error) {
      console.error('Error saving templates to localStorage:', error);
      set({ error: error.message });
    }
  },

  /**
   * Sync template to Google Drive
   * Uses the centralized driveService method for consistency
   */
  syncTemplateToDrive: async (templateId) => {
    const { templates } = get();
    const template = templates[templateId];

    if (!template) return;

    try {
      const templateData = {
        id: templateId,
        name: template.name,
        category: template.category,
        fields: template.fields,
        dpi: template.dpi,
        fileId: template.fileId,
        fileName: template.fileName,
        updatedAt: new Date().toISOString(),
      };

      // Use driveService method which ensures correct folder location
      await driveService.saveDocumentTemplateToDrive(templateData);
    } catch (error) {
      console.error('Error syncing template to Drive:', error);
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
      } catch (error) {
        console.error('Error processing sync queue:', error);
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
      console.error('Error creating template:', error);
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
      console.error('Error updating template:', error);
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
   * Delete template from both localStorage and Google Drive
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

      // Delete from Google Drive
      try {
        await driveService.deleteDocumentTemplateFromDrive(templateId);
        console.log(`Successfully deleted template ${templateId} from Drive`);
      } catch (driveError) {
        console.error('Failed to delete from Drive (template already deleted locally):', driveError);
        // Don't throw - local deletion succeeded, Drive deletion is best-effort
      }

      return true;
    } catch (error) {
      console.error('Error deleting template:', error);
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
   * Load templates from Google Drive
   * Uses driveService for consistent folder location
   */
  loadFromDrive: async () => {
    try {
      set({ loading: true, error: null });

      // Use driveService to load templates (ensures correct folder location)
      const templates = await driveService.loadDocumentTemplatesFromDrive();

      set({ templates, loading: false });
      get().saveToLocalStorage(templates);

      return templates;
    } catch (error) {
      console.error('Error loading templates from Drive:', error);
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  /**
   * Sync templates with Google Drive
   * IMPORTANT: Loads from localStorage first before syncing to prevent data loss
   * This is the primary sync function that should be called on app init
   * Uses driveService.syncDocumentTemplates for consistent behavior with forms/excel
   */
  syncWithDrive: async () => {
    try {
      set({ loading: true, error: null });

      // IMPORTANT: Load from localStorage first before syncing
      // This ensures we don't lose locally-created templates when sync runs
      // before the component has mounted and called loadFromLocalStorage
      get().loadFromLocalStorage();

      const localTemplates = get().templates;
      console.log('Syncing document templates with Drive, local templates:', Object.keys(localTemplates).length);

      // Use driveService for sync (ensures correct folder location in BYD_CRM_Data)
      const mergedTemplates = await driveService.syncDocumentTemplates(localTemplates);

      // Update state and localStorage
      set({
        templates: mergedTemplates,
        loading: false,
        lastSyncTime: new Date().toISOString()
      });
      get().saveToLocalStorage(mergedTemplates);

      console.log('Document templates synced with Drive successfully:', Object.keys(mergedTemplates).length);
      return mergedTemplates;
    } catch (error) {
      console.error('Failed to sync document templates with Drive:', error);
      set({ error: 'Failed to sync with Google Drive', loading: false });
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
