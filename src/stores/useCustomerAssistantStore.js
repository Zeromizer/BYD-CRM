/**
 * Customer Assistant Store
 *
 * Manages the state for the Customer Assistant dashboard including:
 * - Action queue (pending messages to send)
 * - Message history tracking
 * - Filter and sort preferences
 * - AI generation state
 */

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import userStorage from '../services/userStorage';
import { MESSAGE_PRIORITY } from '../constants/customerAssistantConfig';

// LocalStorage key prefix
const STORAGE_KEY_PREFIX = 'bydcrm_assistant_';

/**
 * Action status
 */
export const ACTION_STATUS = {
  PENDING: 'pending',
  READY: 'ready',       // Message generated, ready to send
  SENT: 'sent',         // User clicked send (opened WhatsApp)
  SKIPPED: 'skipped',   // User chose to skip
  SNOOZED: 'snoozed',   // User snoozed for later
};

/**
 * Get storage key for current user
 */
const getStorageKey = (suffix) => {
  const email = userStorage.getUserEmail() || 'default';
  return `${STORAGE_KEY_PREFIX}${email.toLowerCase()}_${suffix}`;
};

/**
 * Customer Assistant Store
 */
const useCustomerAssistantStore = create((set, get) => ({
  // ============================================
  // STATE
  // ============================================

  // Action queue - messages waiting to be sent
  actionQueue: [],

  // Message history - messages that have been sent/skipped
  messageHistory: [],

  // Current filters
  filters: {
    milestone: 'all',           // Filter by milestone stage
    priority: 'all',            // Filter by priority
    customer: null,             // Filter by specific customer
    showSent: false,            // Show sent messages
    showSkipped: false,         // Show skipped messages
  },

  // Sort preference
  sortBy: 'priority',           // 'priority', 'date', 'customer'

  // UI state
  selectedActionId: null,       // Currently selected action
  isGenerating: false,          // AI is generating a message
  generatingActionId: null,     // Which action is being generated

  // Settings
  settings: {
    autoGenerateMessages: true,  // Auto-generate messages for new actions
    defaultPersonality: 'professional',
    showCompletedActions: false,
  },

  // ============================================
  // ACTIONS
  // ============================================

  /**
   * Initialize store from localStorage
   */
  initialize: () => {
    try {
      // Load action queue
      const queueKey = getStorageKey('queue');
      const storedQueue = localStorage.getItem(queueKey);
      if (storedQueue) {
        set({ actionQueue: JSON.parse(storedQueue) });
      }

      // Load message history
      const historyKey = getStorageKey('history');
      const storedHistory = localStorage.getItem(historyKey);
      if (storedHistory) {
        set({ messageHistory: JSON.parse(storedHistory) });
      }

      // Load settings
      const settingsKey = getStorageKey('settings');
      const storedSettings = localStorage.getItem(settingsKey);
      if (storedSettings) {
        set({ settings: { ...get().settings, ...JSON.parse(storedSettings) } });
      }
    } catch (error) {
      console.error('Failed to initialize CustomerAssistant store:', error);
    }
  },

  /**
   * Save action queue to localStorage
   */
  saveQueue: () => {
    try {
      const key = getStorageKey('queue');
      localStorage.setItem(key, JSON.stringify(get().actionQueue));
    } catch (error) {
      console.error('Failed to save action queue:', error);
    }
  },

  /**
   * Save message history to localStorage
   */
  saveHistory: () => {
    try {
      const key = getStorageKey('history');
      const history = get().messageHistory;
      // Keep only last 500 entries
      const trimmedHistory = history.slice(0, 500);
      localStorage.setItem(key, JSON.stringify(trimmedHistory));
    } catch (error) {
      console.error('Failed to save message history:', error);
    }
  },

  /**
   * Save settings to localStorage
   */
  saveSettings: () => {
    try {
      const key = getStorageKey('settings');
      localStorage.setItem(key, JSON.stringify(get().settings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  },

  /**
   * Add action to queue
   */
  addAction: (action) => {
    const newAction = {
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: ACTION_STATUS.PENDING,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      generatedMessage: null,
      aiSuggestions: [],
      ...action,
    };

    set((state) => ({
      actionQueue: [...state.actionQueue, newAction],
    }));

    get().saveQueue();
    return newAction;
  },

  /**
   * Update action in queue
   */
  updateAction: (actionId, updates) => {
    set((state) => ({
      actionQueue: state.actionQueue.map((action) =>
        action.id === actionId
          ? { ...action, ...updates, updatedAt: new Date().toISOString() }
          : action
      ),
    }));

    get().saveQueue();
  },

  /**
   * Set generated message for an action
   */
  setGeneratedMessage: (actionId, message, suggestions = []) => {
    get().updateAction(actionId, {
      generatedMessage: message,
      aiSuggestions: suggestions,
      status: ACTION_STATUS.READY,
    });
  },

  /**
   * Mark action as sent
   */
  markAsSent: (actionId) => {
    const action = get().actionQueue.find((a) => a.id === actionId);
    if (!action) return;

    // Move to history
    const sentAction = {
      ...action,
      status: ACTION_STATUS.SENT,
      sentAt: new Date().toISOString(),
    };

    set((state) => ({
      actionQueue: state.actionQueue.filter((a) => a.id !== actionId),
      messageHistory: [sentAction, ...state.messageHistory],
    }));

    get().saveQueue();
    get().saveHistory();
  },

  /**
   * Mark action as skipped
   */
  markAsSkipped: (actionId, reason = '') => {
    const action = get().actionQueue.find((a) => a.id === actionId);
    if (!action) return;

    // Move to history
    const skippedAction = {
      ...action,
      status: ACTION_STATUS.SKIPPED,
      skippedAt: new Date().toISOString(),
      skipReason: reason,
    };

    set((state) => ({
      actionQueue: state.actionQueue.filter((a) => a.id !== actionId),
      messageHistory: [skippedAction, ...state.messageHistory],
    }));

    get().saveQueue();
    get().saveHistory();
  },

  /**
   * Snooze action for later
   */
  snoozeAction: (actionId, snoozeUntil) => {
    get().updateAction(actionId, {
      status: ACTION_STATUS.SNOOZED,
      snoozedUntil: snoozeUntil,
    });
  },

  /**
   * Remove action from queue
   */
  removeAction: (actionId) => {
    set((state) => ({
      actionQueue: state.actionQueue.filter((a) => a.id !== actionId),
    }));

    get().saveQueue();
  },

  /**
   * Clear all actions for a customer
   */
  clearActionsForCustomer: (customerId) => {
    set((state) => ({
      actionQueue: state.actionQueue.filter((a) => a.customerId !== customerId),
    }));

    get().saveQueue();
  },

  /**
   * Bulk generate actions for customers
   */
  bulkAddActions: (actions) => {
    const newActions = actions.map((action) => ({
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: ACTION_STATUS.PENDING,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      generatedMessage: null,
      aiSuggestions: [],
      ...action,
    }));

    set((state) => ({
      actionQueue: [...state.actionQueue, ...newActions],
    }));

    get().saveQueue();
    return newActions;
  },

  /**
   * Set generating state
   */
  setGenerating: (isGenerating, actionId = null) => {
    set({
      isGenerating,
      generatingActionId: actionId,
    });
  },

  /**
   * Set filters
   */
  setFilters: (newFilters) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    }));
  },

  /**
   * Set sort preference
   */
  setSortBy: (sortBy) => {
    set({ sortBy });
  },

  /**
   * Select action
   */
  selectAction: (actionId) => {
    set({ selectedActionId: actionId });
  },

  /**
   * Update settings
   */
  updateSettings: (newSettings) => {
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    }));
    get().saveSettings();
  },

  /**
   * Get filtered and sorted actions
   */
  getFilteredActions: () => {
    const { actionQueue, filters, sortBy } = get();
    let filtered = [...actionQueue];

    // Filter by milestone
    if (filters.milestone !== 'all') {
      filtered = filtered.filter((a) => a.milestoneId === filters.milestone);
    }

    // Filter by priority
    if (filters.priority !== 'all') {
      filtered = filtered.filter((a) => a.priority === filters.priority);
    }

    // Filter by customer
    if (filters.customer) {
      filtered = filtered.filter((a) => a.customerId === filters.customer);
    }

    // Filter out snoozed actions that aren't due yet
    filtered = filtered.filter((a) => {
      if (a.status === ACTION_STATUS.SNOOZED && a.snoozedUntil) {
        return new Date(a.snoozedUntil) <= new Date();
      }
      return true;
    });

    // Sort
    const priorityOrder = {
      [MESSAGE_PRIORITY.URGENT]: 0,
      [MESSAGE_PRIORITY.HIGH]: 1,
      [MESSAGE_PRIORITY.MEDIUM]: 2,
      [MESSAGE_PRIORITY.LOW]: 3,
    };

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          const priorityDiff = (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3);
          if (priorityDiff !== 0) return priorityDiff;
          return new Date(a.createdAt) - new Date(b.createdAt);

        case 'date':
          return new Date(a.createdAt) - new Date(b.createdAt);

        case 'customer':
          return (a.customerName || '').localeCompare(b.customerName || '');

        default:
          return 0;
      }
    });

    return filtered;
  },

  /**
   * Get actions grouped by priority
   */
  getActionsGroupedByPriority: () => {
    const filtered = get().getFilteredActions();

    const groups = {
      [MESSAGE_PRIORITY.URGENT]: [],
      [MESSAGE_PRIORITY.HIGH]: [],
      [MESSAGE_PRIORITY.MEDIUM]: [],
      [MESSAGE_PRIORITY.LOW]: [],
    };

    filtered.forEach((action) => {
      const priority = action.priority || MESSAGE_PRIORITY.MEDIUM;
      if (groups[priority]) {
        groups[priority].push(action);
      }
    });

    return groups;
  },

  /**
   * Get actions grouped by milestone
   */
  getActionsGroupedByMilestone: () => {
    const filtered = get().getFilteredActions();

    const groups = {};

    filtered.forEach((action) => {
      const milestone = action.milestoneId || 'other';
      if (!groups[milestone]) {
        groups[milestone] = [];
      }
      groups[milestone].push(action);
    });

    return groups;
  },

  /**
   * Get action counts by status
   */
  getActionCounts: () => {
    const { actionQueue, messageHistory } = get();

    // Filter out snoozed actions for pending count
    const activePending = actionQueue.filter((a) => {
      if (a.status === ACTION_STATUS.SNOOZED && a.snoozedUntil) {
        return new Date(a.snoozedUntil) <= new Date();
      }
      return true;
    });

    return {
      pending: activePending.filter((a) => a.status === ACTION_STATUS.PENDING).length,
      ready: activePending.filter((a) => a.status === ACTION_STATUS.READY).length,
      snoozed: actionQueue.filter((a) => a.status === ACTION_STATUS.SNOOZED).length,
      total: activePending.length,
      sentToday: messageHistory.filter((a) => {
        if (a.status !== ACTION_STATUS.SENT) return false;
        const sentDate = new Date(a.sentAt);
        const today = new Date();
        return sentDate.toDateString() === today.toDateString();
      }).length,
    };
  },

  /**
   * Check if action exists for customer and message
   */
  hasExistingAction: (customerId, messageId) => {
    return get().actionQueue.some(
      (a) => a.customerId === customerId && a.messageId === messageId
    );
  },

  /**
   * Get message history for a customer
   */
  getCustomerHistory: (customerId) => {
    return get().messageHistory.filter((h) => h.customerId === customerId);
  },

  /**
   * Reset store
   */
  reset: () => {
    set({
      actionQueue: [],
      messageHistory: [],
      filters: {
        milestone: 'all',
        priority: 'all',
        customer: null,
        showSent: false,
        showSkipped: false,
      },
      sortBy: 'priority',
      selectedActionId: null,
      isGenerating: false,
      generatingActionId: null,
    });
  },
}));

// ============================================
// SELECTORS
// ============================================

/**
 * Select action queue
 */
export const useActionQueue = () =>
  useCustomerAssistantStore((state) => state.actionQueue);

/**
 * Select message history
 */
export const useMessageHistory = () =>
  useCustomerAssistantStore((state) => state.messageHistory);

/**
 * Select filters
 */
export const useFilters = () =>
  useCustomerAssistantStore((state) => state.filters);

/**
 * Select loading state
 */
export const useIsGenerating = () =>
  useCustomerAssistantStore(
    useShallow((state) => ({
      isGenerating: state.isGenerating,
      generatingActionId: state.generatingActionId,
    }))
  );

/**
 * Select actions (stable reference)
 */
export const useAssistantActions = () =>
  useCustomerAssistantStore(
    useShallow((state) => ({
      initialize: state.initialize,
      addAction: state.addAction,
      updateAction: state.updateAction,
      setGeneratedMessage: state.setGeneratedMessage,
      markAsSent: state.markAsSent,
      markAsSkipped: state.markAsSkipped,
      snoozeAction: state.snoozeAction,
      removeAction: state.removeAction,
      clearActionsForCustomer: state.clearActionsForCustomer,
      bulkAddActions: state.bulkAddActions,
      setGenerating: state.setGenerating,
      setFilters: state.setFilters,
      setSortBy: state.setSortBy,
      selectAction: state.selectAction,
      updateSettings: state.updateSettings,
      getFilteredActions: state.getFilteredActions,
      getActionsGroupedByPriority: state.getActionsGroupedByPriority,
      getActionsGroupedByMilestone: state.getActionsGroupedByMilestone,
      getActionCounts: state.getActionCounts,
      hasExistingAction: state.hasExistingAction,
      getCustomerHistory: state.getCustomerHistory,
    }))
  );

export default useCustomerAssistantStore;
