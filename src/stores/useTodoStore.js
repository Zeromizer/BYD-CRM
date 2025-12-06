import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import userStorage from '../services/userStorage';
import { getStorageService } from '../services/storageServiceSelector';
import { ONEDRIVE_DATA_FILES } from '../config/msalConfig';

/**
 * Todo Store - Task Reminder System
 *
 * ARCHITECTURE:
 * - Todos are task reminders, NOT the source of truth for completion
 * - For todos linked to checklist items (via checklistItemId):
 *   → Completion is determined by the customer's checklist state
 *   → Toggling updates the checklist, not the todo
 * - For standalone todos (no checklistItemId):
 *   → The todo's own 'completed' field is used
 *
 * INTEGRATION WITH STATUS CHECKLIST:
 * - "Create Tasks from Checklist" in MilestoneTracker creates todos with checklistItemId
 * - TodoSidebar reads checklist state to show correct completion status
 * - Toggling a linked todo updates customer.checklist (source of truth)
 */

const STORAGE_KEY_PREFIX = 'bydCRM_todos_';

// Counter for unique IDs within same millisecond
let todoIdCounter = 0;

function generateTodoId() {
  const timestamp = Date.now();
  todoIdCounter = (todoIdCounter + 1) % 1000;
  return timestamp * 1000 + todoIdCounter;
}

// Debounce timer for sync
let syncDebounceTimer = null;
// Flag to track pending sync-to-drive request
let pendingSyncToDrive = null;

function getTodoStorageKey(email) {
  if (!email) return 'bydCRM_todos_local';
  return `${STORAGE_KEY_PREFIX}${userStorage.normalizeEmail(email)}`;
}

function loadTodosFromStorage(email) {
  try {
    const key = getTodoStorageKey(email);
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading todos:', error);
    return [];
  }
}

function saveTodosToStorage(todos, email) {
  try {
    const key = getTodoStorageKey(email);
    localStorage.setItem(key, JSON.stringify(todos));
    return true;
  } catch (error) {
    console.error('Error saving todos:', error);
    return false;
  }
}

// Track last sync timestamp
function getLastSyncTimestamp(email) {
  try {
    const key = `${getTodoStorageKey(email)}_lastSync`;
    return localStorage.getItem(key) || null;
  } catch {
    return null;
  }
}

function setLastSyncTimestamp(email, timestamp) {
  try {
    const key = `${getTodoStorageKey(email)}_lastSync`;
    localStorage.setItem(key, timestamp);
  } catch {
    // Ignore
  }
}

const useTodoStore = create((set, get) => ({
  // State
  todos: [],
  isLoading: false,
  isSyncingFrom: false, // Syncing from OneDrive
  isSyncingTo: false, // Syncing to OneDrive
  sidebarOpen: false,
  activeFilter: 'all',

  // Initialize from storage
  initializeTodos: (email) => {
    const todos = loadTodosFromStorage(email);
    set({ todos });
  },

  // Sidebar controls
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setActiveFilter: (filter) => set({ activeFilter: filter }),

  // Add a new todo
  addTodo: (todoData, email, isSignedIn = false) => {
    const newTodo = {
      id: generateTodoId(),
      text: todoData.text || '',
      completed: false, // Only used for standalone todos
      priority: todoData.priority || 'medium',
      dueDate: todoData.dueDate || null,
      customerId: todoData.customerId || null,
      customerName: todoData.customerName || null,
      milestoneId: todoData.milestoneId || null,
      checklistItemId: todoData.checklistItemId || null, // Link to checklist item
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    };

    set((state) => {
      const newTodos = [...state.todos, newTodo];
      saveTodosToStorage(newTodos, email);
      return { todos: newTodos };
    });

    if (isSignedIn) {
      get().scheduleSyncToDrive(email);
    }

    return newTodo;
  },

  // Update a todo's properties
  updateTodo: (todoId, updates, email, isSignedIn = false) => {
    set((state) => {
      const newTodos = state.todos.map((todo) =>
        todo.id === todoId
          ? { ...todo, ...updates, lastModified: new Date().toISOString() }
          : todo
      );
      saveTodosToStorage(newTodos, email);
      return { todos: newTodos };
    });

    if (isSignedIn) {
      get().scheduleSyncToDrive(email);
    }
  },

  // Toggle standalone todo (NOT linked to checklist)
  toggleStandaloneTodo: (todoId, email, isSignedIn = false) => {
    set((state) => {
      const newTodos = state.todos.map((todo) =>
        todo.id === todoId
          ? { ...todo, completed: !todo.completed, lastModified: new Date().toISOString() }
          : todo
      );
      saveTodosToStorage(newTodos, email);
      return { todos: newTodos };
    });

    if (isSignedIn) {
      get().scheduleSyncToDrive(email);
    }
  },

  // Delete a todo
  deleteTodo: (todoId, email, isSignedIn = false) => {
    set((state) => {
      const newTodos = state.todos.filter((todo) => todo.id !== todoId);
      saveTodosToStorage(newTodos, email);
      return { todos: newTodos };
    });

    if (isSignedIn) {
      get().scheduleSyncToDrive(email);
    }
  },

  // Clear all completed todos
  clearCompleted: (completedIds, email, isSignedIn = false) => {
    set((state) => {
      const newTodos = state.todos.filter((todo) => !completedIds.includes(todo.id));
      saveTodosToStorage(newTodos, email);
      return { todos: newTodos };
    });

    if (isSignedIn) {
      get().scheduleSyncToDrive(email);
    }
  },

  // Getters
  getCustomerTodos: (customerId) => get().todos.filter((t) => t.customerId === customerId),
  getGlobalTodos: () => get().todos.filter((t) => t.customerId === null),

  getTodayTodos: () => {
    const today = new Date().toISOString().split('T')[0];
    return get().todos.filter((t) => t.dueDate === today);
  },

  getOverdueTodos: () => {
    const today = new Date().toISOString().split('T')[0];
    return get().todos.filter((t) => t.dueDate && t.dueDate < today);
  },

  getMilestoneTodos: (milestoneId) => get().todos.filter((t) => t.milestoneId === milestoneId),

  // Storage operations
  saveToLocalStorage: (email) => saveTodosToStorage(get().todos, email),
  setTodos: (todos) => set({ todos }),
  setSyncingFrom: (isSyncingFrom) => set({ isSyncingFrom }),
  setSyncingTo: (isSyncingTo) => set({ isSyncingTo }),

  // Debounced sync
  scheduleSyncToDrive: (email) => {
    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(() => {
      get().syncToDrive(email);
      syncDebounceTimer = null;
    }, 500);
  },

  // Sync to OneDrive
  syncToDrive: async (email) => {
    const { todos, isSyncingTo, isSyncingFrom } = get();

    // If already syncing TO drive, skip (debounce will handle retry)
    if (isSyncingTo) {
      console.log('Todos syncToDrive: already syncing to drive, skipping');
      return;
    }

    // If currently syncing FROM drive, queue this sync for later
    if (isSyncingFrom) {
      console.log('Todos syncToDrive: syncFromDrive in progress, queuing sync');
      pendingSyncToDrive = email;
      return;
    }

    set({ isSyncingTo: true });
    try {
      const storageService = getStorageService();
      const folderIds = await storageService.getFolderIds();

      if (folderIds?.root) {
        // Get latest todos state (may have changed during async operations)
        const currentTodos = get().todos;
        const syncTimestamp = new Date().toISOString();
        await storageService.uploadFile(
          folderIds.root,
          ONEDRIVE_DATA_FILES.TODOS,
          { todos: currentTodos, lastModified: syncTimestamp }
        );
        // Save sync timestamp so we know when we last pushed to drive
        if (email) {
          setLastSyncTimestamp(email, syncTimestamp);
        }
        console.log('Todos synced to OneDrive:', currentTodos.length);
      }
    } catch (error) {
      console.error('Error syncing todos to Drive:', error);
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
          ONEDRIVE_DATA_FILES.TODOS
        );

        if (driveData) {
          const driveTodos = driveData.todos || [];
          const driveModified = driveData.lastModified;
          const lastSyncTime = getLastSyncTimestamp(email);

          // If drive was modified after our last sync, trust drive as source of truth
          // This handles the case where todos were deleted and synced
          const driveIsNewer = driveModified && (!lastSyncTime || new Date(driveModified) >= new Date(lastSyncTime));

          if (driveIsNewer) {
            // Drive is authoritative - use its data directly
            console.log(`Todos from OneDrive: ${driveTodos.length} (drive is source of truth)`);
            set({ todos: driveTodos });
            saveTodosToStorage(driveTodos, email);
            setLastSyncTimestamp(email, driveModified);
          } else {
            // Local might have newer changes - merge carefully
            const localTodos = loadTodosFromStorage(email);

            // Merge by ID (newer wins), but only keep items that exist in drive
            // or were created locally after last sync
            const driveMap = new Map(driveTodos.map((t) => [t.id, t]));
            const mergedTodos = [...driveTodos]; // Start with drive todos

            // Add local todos that are newer than last sync (new local additions)
            for (const local of localTodos) {
              if (!driveMap.has(local.id)) {
                const localTime = new Date(local.lastModified || local.createdAt || 0).getTime();
                const syncTime = lastSyncTime ? new Date(lastSyncTime).getTime() : 0;
                if (localTime > syncTime) {
                  // This is a new local todo created after last sync
                  mergedTodos.push(local);
                }
                // Otherwise, it was deleted on drive - don't add it back
              }
            }

            // Deduplicate by content
            const deduped = [];
            const seen = new Set();
            for (const todo of mergedTodos) {
              const key = `${todo.text}|${todo.customerId || ''}|${todo.milestoneId || ''}`;
              if (!seen.has(key)) {
                seen.add(key);
                deduped.push(todo);
              }
            }

            // Sort by creation date (newest first)
            deduped.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            console.log(`Todos merged: ${localTodos.length} local + ${driveTodos.length} drive = ${deduped.length} final`);
            set({ todos: deduped });
            saveTodosToStorage(deduped, email);
          }
        }
      }
    } catch (error) {
      if (!error.message?.includes('404')) {
        console.error('Error syncing todos from Drive:', error);
      }
    } finally {
      set({ isSyncingFrom: false, isLoading: false });

      // Process any pending sync-to-drive request that was queued
      if (pendingSyncToDrive !== null) {
        const pendingEmail = pendingSyncToDrive;
        pendingSyncToDrive = null;
        console.log('Todos: Processing pending syncToDrive after syncFromDrive completed');
        // Small delay to ensure state is settled
        setTimeout(() => {
          get().syncToDrive(pendingEmail);
        }, 100);
      }
    }
  },

  // Full sync
  syncWithDrive: async (email, isSignedIn) => {
    if (isSignedIn) {
      await get().syncFromDrive(email);
    } else {
      get().initializeTodos(email);
    }
  },
}));

// Selectors
export const useTodos = () => useTodoStore(useShallow((state) => state.todos));
export const useSidebarOpen = () => useTodoStore((state) => state.sidebarOpen);
export const useActiveFilter = () => useTodoStore((state) => state.activeFilter);

export const useTodoActions = () =>
  useTodoStore(
    useShallow((state) => ({
      addTodo: state.addTodo,
      updateTodo: state.updateTodo,
      toggleStandaloneTodo: state.toggleStandaloneTodo,
      deleteTodo: state.deleteTodo,
      clearCompleted: state.clearCompleted,
      toggleSidebar: state.toggleSidebar,
      setSidebarOpen: state.setSidebarOpen,
      setActiveFilter: state.setActiveFilter,
      initializeTodos: state.initializeTodos,
      getCustomerTodos: state.getCustomerTodos,
      getGlobalTodos: state.getGlobalTodos,
      getTodayTodos: state.getTodayTodos,
      getOverdueTodos: state.getOverdueTodos,
      getMilestoneTodos: state.getMilestoneTodos,
      saveToLocalStorage: state.saveToLocalStorage,
      setTodos: state.setTodos,
      scheduleSyncToDrive: state.scheduleSyncToDrive,
      syncToDrive: state.syncToDrive,
      syncFromDrive: state.syncFromDrive,
      syncWithDrive: state.syncWithDrive,
    }))
  );

export default useTodoStore;
