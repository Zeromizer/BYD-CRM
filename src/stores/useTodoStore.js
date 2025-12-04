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

const useTodoStore = create((set, get) => ({
  // State
  todos: [],
  isLoading: false,
  isSyncing: false,
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
      get().scheduleSyncToDrive();
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
      get().scheduleSyncToDrive();
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
      get().scheduleSyncToDrive();
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
      get().scheduleSyncToDrive();
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
      get().scheduleSyncToDrive();
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
  setSyncing: (isSyncing) => set({ isSyncing }),

  // Debounced sync
  scheduleSyncToDrive: () => {
    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(() => {
      get().syncToDrive();
      syncDebounceTimer = null;
    }, 500);
  },

  // Sync to OneDrive
  syncToDrive: async () => {
    const { todos, isSyncing } = get();
    if (isSyncing) return;

    set({ isSyncing: true });
    try {
      const storageService = getStorageService();
      const folderIds = await storageService.getFolderIds();

      if (folderIds?.root) {
        await storageService.uploadFile(
          folderIds.root,
          ONEDRIVE_DATA_FILES.TODOS,
          { todos, lastModified: new Date().toISOString() }
        );
        console.log('Todos synced to OneDrive:', todos.length);
      }
    } catch (error) {
      console.error('Error syncing todos to Drive:', error);
    } finally {
      set({ isSyncing: false });
    }
  },

  // Sync from OneDrive
  syncFromDrive: async (email) => {
    const { isSyncing } = get();
    if (isSyncing) return;

    set({ isSyncing: true, isLoading: true });
    try {
      const storageService = getStorageService();
      const folderIds = await storageService.getFolderIds();

      if (folderIds?.root) {
        const driveData = await storageService.getFileContent(
          folderIds.root,
          ONEDRIVE_DATA_FILES.TODOS
        );

        if (driveData?.todos) {
          const localTodos = loadTodosFromStorage(email);
          const driveTodos = driveData.todos;

          // Merge by ID (newer wins)
          const localMap = new Map(localTodos.map((t) => [t.id, t]));
          const driveMap = new Map(driveTodos.map((t) => [t.id, t]));
          const allIds = new Set([...localMap.keys(), ...driveMap.keys()]);

          const mergedTodos = [];
          for (const id of allIds) {
            const local = localMap.get(id);
            const drive = driveMap.get(id);

            if (local && drive) {
              const localTime = new Date(local.lastModified || 0).getTime();
              const driveTime = new Date(drive.lastModified || 0).getTime();
              mergedTodos.push(driveTime > localTime ? drive : local);
            } else {
              mergedTodos.push(local || drive);
            }
          }

          // Deduplicate by content (text + customerId + milestoneId)
          const deduped = [];
          const seen = new Set();

          for (const todo of mergedTodos) {
            const key = `${todo.text}|${todo.customerId || ''}|${todo.milestoneId || ''}`;
            if (!seen.has(key)) {
              seen.add(key);
              deduped.push(todo);
            } else {
              // Keep newer version
              const idx = deduped.findIndex(
                (t) => `${t.text}|${t.customerId || ''}|${t.milestoneId || ''}` === key
              );
              if (idx !== -1) {
                const existing = deduped[idx];
                if (new Date(todo.lastModified || 0) > new Date(existing.lastModified || 0)) {
                  deduped[idx] = todo;
                }
              }
            }
          }

          // Sort by creation date (newest first)
          deduped.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

          console.log(`Todos merged: ${localTodos.length} local + ${driveTodos.length} drive = ${deduped.length} final`);
          set({ todos: deduped });
          saveTodosToStorage(deduped, email);
        }
      }
    } catch (error) {
      if (!error.message?.includes('404')) {
        console.error('Error syncing todos from Drive:', error);
      }
    } finally {
      set({ isSyncing: false, isLoading: false });
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
