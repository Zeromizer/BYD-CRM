import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import userStorage from '../services/userStorage';
import { getStorageService } from '../services/storageServiceSelector';
import { ONEDRIVE_DATA_FILES } from '../config/msalConfig';

/**
 * WhatsApp Store - Message and Conversation Management
 *
 * ARCHITECTURE:
 * - Stores conversation history per customer
 * - Syncs messages to OneDrive for persistence
 * - Manages message queue for offline support
 * - Tracks conversation state and AI suggestions
 *
 * DATA STRUCTURE:
 * - conversations: Map of customerId -> { messages, lastActivity, unreadCount }
 * - messages: Array of { id, type, body, timestamp, status, direction }
 */

const STORAGE_KEY_PREFIX = 'bydCRM_whatsapp_';

// Counter for unique IDs
let messageIdCounter = 0;

function generateMessageId() {
  const timestamp = Date.now();
  messageIdCounter = (messageIdCounter + 1) % 1000;
  return `msg_${timestamp}_${messageIdCounter}`;
}

// Storage key per user
function getWhatsappStorageKey(email) {
  if (!email) return 'bydCRM_whatsapp_local';
  return `${STORAGE_KEY_PREFIX}${userStorage.normalizeEmail(email)}`;
}

function loadConversationsFromStorage(email) {
  try {
    const key = getWhatsappStorageKey(email);
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Error loading WhatsApp conversations:', error);
    return {};
  }
}

function saveConversationsToStorage(conversations, email) {
  try {
    const key = getWhatsappStorageKey(email);
    localStorage.setItem(key, JSON.stringify(conversations));
    return true;
  } catch (error) {
    console.error('Error saving WhatsApp conversations:', error);
    return false;
  }
}

// Sync timestamp tracking
function getLastSyncTimestamp(email) {
  try {
    const key = `${getWhatsappStorageKey(email)}_lastSync`;
    return localStorage.getItem(key) || null;
  } catch {
    return null;
  }
}

function setLastSyncTimestamp(email, timestamp) {
  try {
    const key = `${getWhatsappStorageKey(email)}_lastSync`;
    localStorage.setItem(key, timestamp);
  } catch {
    // Ignore
  }
}

// Debounce timer for sync
let syncDebounceTimer = null;

const useWhatsappStore = create((set, get) => ({
  // State
  conversations: {},        // { [customerId]: { messages, lastActivity, unreadCount } }
  activeConversation: null, // Currently viewed customer ID
  isLoading: false,
  isSyncingFrom: false,
  isSyncingTo: false,
  isSending: false,
  error: null,

  // AI State
  aiComposing: false,
  aiSuggestions: [],
  pendingMessage: '',       // Message being composed

  // Initialize from storage
  initializeWhatsapp: (email) => {
    const conversations = loadConversationsFromStorage(email);
    set({ conversations });
  },

  // Set active conversation
  setActiveConversation: (customerId) => {
    set({ activeConversation: customerId });

    // Mark messages as read when opening conversation
    if (customerId) {
      const { conversations } = get();
      if (conversations[customerId]?.unreadCount > 0) {
        set({
          conversations: {
            ...conversations,
            [customerId]: {
              ...conversations[customerId],
              unreadCount: 0
            }
          }
        });
      }
    }
  },

  // Get conversation for a customer
  getConversation: (customerId) => {
    const { conversations } = get();
    return conversations[customerId] || { messages: [], lastActivity: null, unreadCount: 0 };
  },

  // Add a message to a conversation
  addMessage: (customerId, message, email, isSignedIn = false) => {
    const newMessage = {
      id: generateMessageId(),
      type: message.type || 'text',
      body: message.body || '',
      caption: message.caption || '',
      documentUrl: message.documentUrl || null,
      filename: message.filename || null,
      direction: message.direction || 'outgoing', // 'incoming' or 'outgoing'
      status: message.status || 'sent',
      timestamp: message.timestamp || new Date().toISOString(),
      aiGenerated: message.aiGenerated || false,
      templateUsed: message.templateUsed || null
    };

    set((state) => {
      const existingConvo = state.conversations[customerId] || {
        messages: [],
        lastActivity: null,
        unreadCount: 0
      };

      const newConversations = {
        ...state.conversations,
        [customerId]: {
          messages: [...existingConvo.messages, newMessage],
          lastActivity: newMessage.timestamp,
          unreadCount: message.direction === 'incoming'
            ? existingConvo.unreadCount + 1
            : existingConvo.unreadCount
        }
      };

      saveConversationsToStorage(newConversations, email);
      return { conversations: newConversations };
    });

    if (isSignedIn) {
      get().scheduleSyncToDrive(email);
    }

    return newMessage;
  },

  // Update message status
  updateMessageStatus: (customerId, messageId, status, email, isSignedIn = false) => {
    set((state) => {
      const convo = state.conversations[customerId];
      if (!convo) return state;

      const updatedMessages = convo.messages.map((msg) =>
        msg.id === messageId ? { ...msg, status } : msg
      );

      const newConversations = {
        ...state.conversations,
        [customerId]: {
          ...convo,
          messages: updatedMessages
        }
      };

      saveConversationsToStorage(newConversations, email);
      return { conversations: newConversations };
    });

    if (isSignedIn) {
      get().scheduleSyncToDrive(email);
    }
  },

  // Delete a message
  deleteMessage: (customerId, messageId, email, isSignedIn = false) => {
    set((state) => {
      const convo = state.conversations[customerId];
      if (!convo) return state;

      const filteredMessages = convo.messages.filter((msg) => msg.id !== messageId);

      const newConversations = {
        ...state.conversations,
        [customerId]: {
          ...convo,
          messages: filteredMessages
        }
      };

      saveConversationsToStorage(newConversations, email);
      return { conversations: newConversations };
    });

    if (isSignedIn) {
      get().scheduleSyncToDrive(email);
    }
  },

  // Clear conversation history for a customer
  clearConversation: (customerId, email, isSignedIn = false) => {
    set((state) => {
      const newConversations = { ...state.conversations };
      delete newConversations[customerId];
      saveConversationsToStorage(newConversations, email);
      return { conversations: newConversations };
    });

    if (isSignedIn) {
      get().scheduleSyncToDrive(email);
    }
  },

  // Set pending message (for composition)
  setPendingMessage: (message) => set({ pendingMessage: message }),

  // Set AI state
  setAIComposing: (composing) => set({ aiComposing: composing }),
  setAISuggestions: (suggestions) => set({ aiSuggestions: suggestions }),

  // Set sending state
  setSending: (sending) => set({ isSending: sending }),
  setError: (error) => set({ error }),

  // Get total unread count across all conversations
  getTotalUnreadCount: () => {
    const { conversations } = get();
    return Object.values(conversations).reduce((total, convo) => total + (convo.unreadCount || 0), 0);
  },

  // Get recent conversations sorted by last activity
  getRecentConversations: () => {
    const { conversations } = get();
    return Object.entries(conversations)
      .map(([customerId, convo]) => ({
        customerId,
        ...convo
      }))
      .sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
  },

  // Storage operations
  saveToLocalStorage: (email) => saveConversationsToStorage(get().conversations, email),
  setConversations: (conversations) => set({ conversations }),
  setSyncingFrom: (isSyncingFrom) => set({ isSyncingFrom }),
  setSyncingTo: (isSyncingTo) => set({ isSyncingTo }),

  // Debounced sync to drive
  scheduleSyncToDrive: (email) => {
    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(() => {
      get().syncToDrive(email);
      syncDebounceTimer = null;
    }, 1000); // 1 second debounce for messages
  },

  // Sync to OneDrive
  syncToDrive: async (email) => {
    const { conversations, isSyncingTo, isSyncingFrom } = get();

    if (isSyncingTo || isSyncingFrom) {
      console.log('WhatsApp syncToDrive: sync in progress, skipping');
      return;
    }

    set({ isSyncingTo: true });
    try {
      const storageService = getStorageService();
      const folderIds = await storageService.getFolderIds();

      if (folderIds?.root) {
        const syncTimestamp = new Date().toISOString();
        await storageService.uploadFile(
          folderIds.root,
          ONEDRIVE_DATA_FILES.WHATSAPP || 'whatsapp_messages.json',
          { conversations, lastModified: syncTimestamp }
        );
        if (email) {
          setLastSyncTimestamp(email, syncTimestamp);
        }
        console.log('WhatsApp conversations synced to OneDrive');
      }
    } catch (error) {
      console.error('Error syncing WhatsApp to Drive:', error);
    } finally {
      set({ isSyncingTo: false });
    }
  },

  // Sync from OneDrive
  syncFromDrive: async (email) => {
    const { isSyncingFrom } = get();
    if (isSyncingFrom) return;

    set({ isSyncingFrom: true, isLoading: true });
    try {
      const storageService = getStorageService();
      const folderIds = await storageService.getFolderIds();

      if (folderIds?.root) {
        const driveData = await storageService.getFileContent(
          folderIds.root,
          ONEDRIVE_DATA_FILES.WHATSAPP || 'whatsapp_messages.json'
        );

        if (driveData) {
          const driveConversations = driveData.conversations || {};
          const driveModified = driveData.lastModified;
          const lastSyncTime = getLastSyncTimestamp(email);

          // Merge conversations - newer wins per conversation
          const localConversations = loadConversationsFromStorage(email);
          const mergedConversations = { ...driveConversations };

          // Merge local conversations that might be newer
          for (const [customerId, localConvo] of Object.entries(localConversations)) {
            const driveConvo = driveConversations[customerId];

            if (!driveConvo) {
              // Local only - check if created after last sync
              const localTime = new Date(localConvo.lastActivity || 0).getTime();
              const syncTime = lastSyncTime ? new Date(lastSyncTime).getTime() : 0;
              if (localTime > syncTime) {
                mergedConversations[customerId] = localConvo;
              }
            } else {
              // Merge messages from both sources
              const messageMap = new Map();

              // Add drive messages
              for (const msg of driveConvo.messages || []) {
                messageMap.set(msg.id, msg);
              }

              // Add/update with local messages
              for (const msg of localConvo.messages || []) {
                const existing = messageMap.get(msg.id);
                if (!existing || new Date(msg.timestamp) > new Date(existing.timestamp)) {
                  messageMap.set(msg.id, msg);
                }
              }

              // Sort by timestamp
              const mergedMessages = Array.from(messageMap.values())
                .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

              mergedConversations[customerId] = {
                messages: mergedMessages,
                lastActivity: mergedMessages[mergedMessages.length - 1]?.timestamp || localConvo.lastActivity,
                unreadCount: Math.max(localConvo.unreadCount || 0, driveConvo.unreadCount || 0)
              };
            }
          }

          console.log('WhatsApp conversations loaded from OneDrive');
          set({ conversations: mergedConversations });
          saveConversationsToStorage(mergedConversations, email);
          if (driveModified) {
            setLastSyncTimestamp(email, driveModified);
          }
        }
      }
    } catch (error) {
      if (!error.message?.includes('404')) {
        console.error('Error syncing WhatsApp from Drive:', error);
      }
    } finally {
      set({ isSyncingFrom: false, isLoading: false });
    }
  },

  // Full sync
  syncWithDrive: async (email, isSignedIn) => {
    if (isSignedIn) {
      await get().syncFromDrive(email);
    } else {
      get().initializeWhatsapp(email);
    }
  }
}));

// Selectors
export const useConversations = () => useWhatsappStore(useShallow((state) => state.conversations));
export const useActiveConversation = () => useWhatsappStore((state) => state.activeConversation);
export const useWhatsappLoading = () => useWhatsappStore((state) => state.isLoading);
export const useWhatsappSending = () => useWhatsappStore((state) => state.isSending);
export const useAIComposing = () => useWhatsappStore((state) => state.aiComposing);
export const useAISuggestions = () => useWhatsappStore((state) => state.aiSuggestions);
export const usePendingMessage = () => useWhatsappStore((state) => state.pendingMessage);

export const useWhatsappActions = () =>
  useWhatsappStore(
    useShallow((state) => ({
      initializeWhatsapp: state.initializeWhatsapp,
      setActiveConversation: state.setActiveConversation,
      getConversation: state.getConversation,
      addMessage: state.addMessage,
      updateMessageStatus: state.updateMessageStatus,
      deleteMessage: state.deleteMessage,
      clearConversation: state.clearConversation,
      setPendingMessage: state.setPendingMessage,
      setAIComposing: state.setAIComposing,
      setAISuggestions: state.setAISuggestions,
      setSending: state.setSending,
      setError: state.setError,
      getTotalUnreadCount: state.getTotalUnreadCount,
      getRecentConversations: state.getRecentConversations,
      saveToLocalStorage: state.saveToLocalStorage,
      setConversations: state.setConversations,
      scheduleSyncToDrive: state.scheduleSyncToDrive,
      syncToDrive: state.syncToDrive,
      syncFromDrive: state.syncFromDrive,
      syncWithDrive: state.syncWithDrive
    }))
  );

export default useWhatsappStore;
