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

// Counter to ensure unique IDs even within same millisecond
let todoIdCounter = 0;

// Generate unique todo ID
function generateTodoId() {
  const timestamp = Date.now();
  todoIdCounter = (todoIdCounter + 1) % 1000;
  return timestamp * 1000 + todoIdCounter;
}

// Debounce timer for sync
let syncDebounceTimer = null;

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
      id: generateTodoId(), // Use unique ID generator to prevent collisions
      text: todoData.text || '',
      completed: false,
      priority: todoData.priority || 'medium',
      dueDate: todoData.dueDate || null,
      customerId: todoData.customerId || null, // null = global todo
      customerName: todoData.customerName || null,
      milestoneId: todoData.milestoneId || null, // Link to milestone (e.g., 'close_deal', 'registration')
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    };

    set((state) => {
      const newTodos = [...state.todos, newTodo];
      saveTodosToStorage(newTodos, email);
      return { todos: newTodos };
    });

    // Sync to Drive if signed in (debounced via scheduleSyncToDrive)
    if (isSignedIn) {
      get().scheduleSyncToDrive();
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

    // Sync to Drive if signed in (debounced)
    if (isSignedIn) {
      get().scheduleSyncToDrive();
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

    // Sync to Drive if signed in (debounced)
    if (isSignedIn) {
      get().scheduleSyncToDrive();
    }
  },

  // Delete a todo
  deleteTodo: async (todoId, email, isSignedIn = false) => {
    set((state) => {
      const newTodos = state.todos.filter((todo) => todo.id !== todoId);
      saveTodosToStorage(newTodos, email);
      return { todos: newTodos };
    });

    // Sync to Drive if signed in (debounced)
    if (isSignedIn) {
      get().scheduleSyncToDrive();
    }
  },

  // Delete all completed todos
  clearCompleted: async (email, isSignedIn = false) => {
    set((state) => {
      const newTodos = state.todos.filter((todo) => !todo.completed);
      saveTodosToStorage(newTodos, email);
      return { todos: newTodos };
    });

    // Sync to Drive if signed in (debounced)
    if (isSignedIn) {
      get().scheduleSyncToDrive();
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

  // Get todos for a specific milestone
  getMilestoneTodos: (milestoneId) => {
    return get().todos.filter((todo) => todo.milestoneId === milestoneId);
  },

  // Get todos for a customer's milestone
  getCustomerMilestoneTodos: (customerId, milestoneId) => {
    return get().todos.filter(
      (todo) => todo.customerId === customerId && todo.milestoneId === milestoneId
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

  // Schedule a debounced sync to OneDrive (waits for rapid changes to settle)
  scheduleSyncToDrive: () => {
    if (syncDebounceTimer) {
      clearTimeout(syncDebounceTimer);
    }
    syncDebounceTimer = setTimeout(() => {
      get().syncToDrive();
      syncDebounceTimer = null;
    }, 500); // Wait 500ms after last change before syncing
  },

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
        console.log('Todos synced to OneDrive:', todos.length, 'todos');
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

          // CRITICAL: Deduplicate by content to prevent duplicates with different IDs
          // This can happen if todos were created before sync completed
          const deduplicatedTodos = [];
          const seenContent = new Set();

          for (const todo of mergedTodos) {
            // Create a content key: text + customerId + milestoneId
            const contentKey = `${todo.text}|${todo.customerId || ''}|${todo.milestoneId || ''}`;

            if (!seenContent.has(contentKey)) {
              seenContent.add(contentKey);
              deduplicatedTodos.push(todo);
            } else {
              // Duplicate content found - keep the newer one
              const existingIndex = deduplicatedTodos.findIndex(t =>
                `${t.text}|${t.customerId || ''}|${t.milestoneId || ''}` === contentKey
              );
              if (existingIndex !== -1) {
                const existing = deduplicatedTodos[existingIndex];
                const existingTime = new Date(existing.lastModified || 0).getTime();
                const currentTime = new Date(todo.lastModified || 0).getTime();
                if (currentTime > existingTime) {
                  deduplicatedTodos[existingIndex] = todo;
                }
              }
            }
          }

          // Sort by createdAt (newest first)
          deduplicatedTodos.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );

          console.log(`Todos merged: ${localTodos.length} local + ${driveTodos.length} drive = ${deduplicatedTodos.length} final`);

          set({ todos: deduplicatedTodos });
          saveTodosToStorage(deduplicatedTodos, email);
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
      getMilestoneTodos: state.getMilestoneTodos,
      getCustomerMilestoneTodos: state.getCustomerMilestoneTodos,
      saveToLocalStorage: state.saveToLocalStorage,
      setTodos: state.setTodos,
      scheduleSyncToDrive: state.scheduleSyncToDrive,
      syncToDrive: state.syncToDrive,
      syncFromDrive: state.syncFromDrive,
      syncWithDrive: state.syncWithDrive,
    }))
  );

export default useTodoStore;
