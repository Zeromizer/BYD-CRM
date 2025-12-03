import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import userStorage from '../services/userStorage';
import { getStorageService } from '../services/storageServiceSelector';
import { ONEDRIVE_DATA_FILES } from '../config/msalConfig';

/**
 * Todo Store
 * Manages global and customer-specific todos
 *
 * Features:
 * - Global todos (not tied to any customer)
 * - Customer-specific todos (linked via customerId)
 * - Priority levels (low, medium, high)
 * - Due dates
 * - Cloud sync to OneDrive
 */

const STORAGE_KEY_PREFIX = 'bydCRM_todos_';

// Get user-specific storage key
function getTodoStorageKey(email) {
  if (!email) return 'bydCRM_todos_local';
  return `${STORAGE_KEY_PREFIX}${userStorage.normalizeEmail(email)}`;
}

// Load todos from localStorage
function loadTodosFromStorage(email) {
  try {
    const key = getTodoStorageKey(email);
    const data = localStorage.getItem(key);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading todos from storage:', error);
  }
  return [];
}

// Save todos to localStorage
function saveTodosToStorage(todos, email) {
  try {
    const key = getTodoStorageKey(email);
    localStorage.setItem(key, JSON.stringify(todos));
    return true;
  } catch (error) {
    console.error('Error saving todos to storage:', error);
    return false;
  }
}

const useTodoStore = create((set, get) => ({
  // State
  todos: [],
  isLoading: false,
  isSyncing: false,
  sidebarOpen: false,
  activeFilter: 'all', // 'all' | 'today' | 'overdue' | 'by-customer'

  // Initialize todos from storage
  initializeTodos: (email) => {
    const todos = loadTodosFromStorage(email);
    set({ todos });
  },

  // Toggle sidebar
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  // Set active filter
  setActiveFilter: (filter) => set({ activeFilter: filter }),

  // Add a new todo
  addTodo: async (todoData, email, isSignedIn = false) => {
    const newTodo = {
      id: Date.now(),
      text: todoData.text || '',
      completed: false,
      priority: todoData.priority || 'medium',
      dueDate: todoData.dueDate || null,
      customerId: todoData.customerId || null, // null = global todo
      customerName: todoData.customerName || null,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    };

    set((state) => {
      const newTodos = [...state.todos, newTodo];
      saveTodosToStorage(newTodos, email);
      return { todos: newTodos };
    });

    // Sync to Drive if signed in
    if (isSignedIn) {
      get().syncToDrive();
    }

    return newTodo;
  },

  // Update a todo
  updateTodo: async (todoId, updates, email, isSignedIn = false) => {
    set((state) => {
      const newTodos = state.todos.map((todo) =>
        todo.id === todoId
          ? { ...todo, ...updates, lastModified: new Date().toISOString() }
          : todo
      );
      saveTodosToStorage(newTodos, email);
      return { todos: newTodos };
    });

    // Sync to Drive if signed in
    if (isSignedIn) {
      get().syncToDrive();
    }
  },

  // Toggle todo completion
  toggleTodo: async (todoId, email, isSignedIn = false) => {
    set((state) => {
      const newTodos = state.todos.map((todo) =>
        todo.id === todoId
          ? { ...todo, completed: !todo.completed, lastModified: new Date().toISOString() }
          : todo
      );
      saveTodosToStorage(newTodos, email);
      return { todos: newTodos };
    });

    // Sync to Drive if signed in
    if (isSignedIn) {
      get().syncToDrive();
    }
  },

  // Delete a todo
  deleteTodo: async (todoId, email, isSignedIn = false) => {
    set((state) => {
      const newTodos = state.todos.filter((todo) => todo.id !== todoId);
      saveTodosToStorage(newTodos, email);
      return { todos: newTodos };
    });

    // Sync to Drive if signed in
    if (isSignedIn) {
      get().syncToDrive();
    }
  },

  // Delete all completed todos
  clearCompleted: async (email, isSignedIn = false) => {
    set((state) => {
      const newTodos = state.todos.filter((todo) => !todo.completed);
      saveTodosToStorage(newTodos, email);
      return { todos: newTodos };
    });

    // Sync to Drive if signed in
    if (isSignedIn) {
      get().syncToDrive();
    }
  },

  // Get todos for a specific customer
  getCustomerTodos: (customerId) => {
    return get().todos.filter((todo) => todo.customerId === customerId);
  },

  // Get global todos (not tied to any customer)
  getGlobalTodos: () => {
    return get().todos.filter((todo) => todo.customerId === null);
  },

  // Get todos due today
  getTodayTodos: () => {
    const today = new Date().toISOString().split('T')[0];
    return get().todos.filter((todo) => todo.dueDate === today && !todo.completed);
  },

  // Get overdue todos
  getOverdueTodos: () => {
    const today = new Date().toISOString().split('T')[0];
    return get().todos.filter(
      (todo) => todo.dueDate && todo.dueDate < today && !todo.completed
    );
  },

  // Save to localStorage
  saveToLocalStorage: (email) => {
    const { todos } = get();
    saveTodosToStorage(todos, email);
  },

  // Set todos directly (for sync)
  setTodos: (todos) => set({ todos }),

  // Sync status
  setSyncing: (isSyncing) => set({ isSyncing }),

  // Sync todos to OneDrive
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
      }
    } catch (error) {
      console.error('Error syncing todos to Drive:', error);
    } finally {
      set({ isSyncing: false });
    }
  },

  // Sync todos from OneDrive
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
          // Merge: Use newer lastModified per todo
          const localTodos = loadTodosFromStorage(email);
          const driveTodos = driveData.todos;

          // Create maps for efficient lookup
          const localMap = new Map(localTodos.map(t => [t.id, t]));
          const driveMap = new Map(driveTodos.map(t => [t.id, t]));

          // Merge todos (newer wins)
          const mergedTodos = [];
          const allIds = new Set([...localMap.keys(), ...driveMap.keys()]);

          for (const id of allIds) {
            const local = localMap.get(id);
            const drive = driveMap.get(id);

            if (local && drive) {
              // Both exist - use newer
              const localTime = new Date(local.lastModified || 0).getTime();
              const driveTime = new Date(drive.lastModified || 0).getTime();
              mergedTodos.push(driveTime > localTime ? drive : local);
            } else {
              // Only one exists
              mergedTodos.push(local || drive);
            }
          }

          // Sort by createdAt (newest first)
          mergedTodos.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );

          set({ todos: mergedTodos });
          saveTodosToStorage(mergedTodos, email);
        }
      }
    } catch (error) {
      // File might not exist yet - that's OK
      if (!error.message?.includes('404')) {
        console.error('Error syncing todos from Drive:', error);
      }
    } finally {
      set({ isSyncing: false, isLoading: false });
    }
  },

  // Full sync (from Drive first, then initialize from local)
  syncWithDrive: async (email, isSignedIn) => {
    if (isSignedIn) {
      await get().syncFromDrive(email);
    } else {
      get().initializeTodos(email);
    }
  },
}));

// Selectors for granular subscriptions
export const useTodos = () => useTodoStore(useShallow((state) => state.todos));
export const useSidebarOpen = () => useTodoStore((state) => state.sidebarOpen);
export const useActiveFilter = () => useTodoStore((state) => state.activeFilter);
export const useTodoActions = () =>
  useTodoStore(
    useShallow((state) => ({
      addTodo: state.addTodo,
      updateTodo: state.updateTodo,
      toggleTodo: state.toggleTodo,
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
      saveToLocalStorage: state.saveToLocalStorage,
      setTodos: state.setTodos,
      syncToDrive: state.syncToDrive,
      syncFromDrive: state.syncFromDrive,
      syncWithDrive: state.syncWithDrive,
    }))
  );

export default useTodoStore;
