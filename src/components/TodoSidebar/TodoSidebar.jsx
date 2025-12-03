import { useState, useEffect, memo, useCallback, useMemo } from 'react';
import useTodoStore, { useTodos, useSidebarOpen, useActiveFilter, useTodoActions } from '../../stores/useTodoStore';
import useAuthStore from '../../stores/useAuthStore';
import useCustomerStore from '../../stores/useCustomerStore';
import { MILESTONES, CHECKLISTS } from '../../constants/milestones';
import {
  CheckSquare,
  Square,
  Plus,
  X,
  ChevronRight,
  ChevronLeft,
  Calendar,
  AlertCircle,
  User,
  ListTodo,
  Trash2,
  Flag,
  Milestone,
  RefreshCw,
} from 'lucide-react';
import './TodoSidebar.css';

// Priority colors matching the design system
const PRIORITY_COLORS = {
  high: 'var(--color-error)',
  medium: 'var(--color-warning)',
  low: 'var(--color-success)',
};

const PRIORITY_LABELS = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

// Filter tabs configuration
const FILTER_TABS = [
  { id: 'all', label: 'All', icon: ListTodo },
  { id: 'today', label: 'Today', icon: Calendar },
  { id: 'overdue', label: 'Overdue', icon: AlertCircle },
  { id: 'by-customer', label: 'By Customer', icon: User },
  { id: 'by-milestone', label: 'By Stage', icon: Milestone },
];

// Helper to get milestone info
const getMilestoneInfo = (milestoneId) => {
  return MILESTONES.find(m => m.id === milestoneId);
};

// Helper to get checklistItemId from todo text (fallback matching)
const getChecklistItemIdFromText = (todo) => {
  if (todo.checklistItemId) return todo.checklistItemId;
  if (!todo.milestoneId) return null;

  const milestone = MILESTONES.find(m => m.id === todo.milestoneId);
  if (!milestone) return null;

  const prefix = `${milestone.name}: `;
  if (!todo.text.startsWith(prefix)) return null;

  const itemLabel = todo.text.substring(prefix.length);
  const checklistItems = CHECKLISTS[todo.milestoneId] || [];
  const matchedItem = checklistItems.find(item => item.label === itemLabel);
  return matchedItem?.id || null;
};

// Single Todo Item Component
const TodoItem = memo(function TodoItem({ todo, onToggle, onDelete, showCustomer, showMilestone = true }) {
  const isOverdue = todo.dueDate && new Date(todo.dueDate) < new Date() && !todo.completed;
  const milestone = todo.milestoneId ? getMilestoneInfo(todo.milestoneId) : null;

  return (
    <div className={`todo-item ${todo.completed ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}`}>
      <button
        className="todo-checkbox"
        onClick={() => onToggle(todo.id)}
        aria-label={todo.completed ? 'Mark as incomplete' : 'Mark as complete'}
      >
        {todo.completed ? (
          <CheckSquare size={18} className="check-icon checked" />
        ) : (
          <Square size={18} className="check-icon" />
        )}
      </button>

      <div className="todo-content">
        <span className="todo-text">{todo.text}</span>
        <div className="todo-meta">
          {todo.dueDate && (
            <span className={`todo-due ${isOverdue ? 'overdue' : ''}`}>
              <Calendar size={12} />
              {new Date(todo.dueDate).toLocaleDateString()}
            </span>
          )}
          {showCustomer && todo.customerName && (
            <span className="todo-customer">
              <User size={12} />
              {todo.customerName}
            </span>
          )}
          {showMilestone && milestone && (
            <span
              className="todo-milestone"
              style={{ background: milestone.color, color: 'white' }}
            >
              <Milestone size={10} />
              {milestone.shortName}
            </span>
          )}
          <span
            className="todo-priority"
            style={{ color: PRIORITY_COLORS[todo.priority] }}
          >
            <Flag size={12} />
            {PRIORITY_LABELS[todo.priority]}
          </span>
        </div>
      </div>

      <button
        className="todo-delete"
        onClick={() => onDelete(todo.id)}
        aria-label="Delete todo"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
});

// Quick Add Form Component
const QuickAddForm = memo(function QuickAddForm({ onAdd, customers }) {
  const [text, setText] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [milestoneId, setMilestoneId] = useState('');
  const [showOptions, setShowOptions] = useState(false);

  // Get selected customer's milestone dates for auto-filling due date
  const selectedCustomer = customers.find((c) => c.id === Number(customerId));

  // When milestone changes and customer is selected, auto-fill due date
  const handleMilestoneChange = (newMilestoneId) => {
    setMilestoneId(newMilestoneId);
    if (selectedCustomer?.milestoneDates?.[newMilestoneId]) {
      setDueDate(selectedCustomer.milestoneDates[newMilestoneId]);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;

    onAdd({
      text: text.trim(),
      priority,
      dueDate: dueDate || null,
      customerId: customerId ? Number(customerId) : null,
      customerName: selectedCustomer?.name || null,
      milestoneId: milestoneId || null,
    });

    setText('');
    setPriority('medium');
    setDueDate('');
    setCustomerId('');
    setMilestoneId('');
    setShowOptions(false);
  };

  return (
    <form className="quick-add-form" onSubmit={handleSubmit}>
      <div className="quick-add-input-row">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a new task..."
          className="quick-add-input"
        />
        <button type="submit" className="quick-add-btn" disabled={!text.trim()}>
          <Plus size={18} />
        </button>
      </div>

      <button
        type="button"
        className="toggle-options-btn"
        onClick={() => setShowOptions(!showOptions)}
      >
        {showOptions ? 'Less options' : 'More options'}
        <ChevronRight size={14} className={showOptions ? 'rotated' : ''} />
      </button>

      {showOptions && (
        <div className="quick-add-options">
          <div className="option-row">
            <label>Priority:</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="option-row">
            <label>Due Date:</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="option-row">
            <label>Customer:</label>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Global (No customer)</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>

          <div className="option-row">
            <label>Stage:</label>
            <select value={milestoneId} onChange={(e) => handleMilestoneChange(e.target.value)}>
              <option value="">No stage</option>
              {MILESTONES.map((milestone) => (
                <option key={milestone.id} value={milestone.id}>
                  {milestone.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </form>
  );
});

// Customer Group Component
const CustomerGroup = memo(function CustomerGroup({ customerName, todos, onToggle, onDelete }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="customer-group">
      <button className="customer-group-header" onClick={() => setExpanded(!expanded)}>
        <ChevronRight size={16} className={expanded ? 'rotated' : ''} />
        <User size={14} />
        <span>{customerName || 'Global Tasks'}</span>
        <span className="todo-count">{todos.length}</span>
      </button>
      {expanded && (
        <div className="customer-group-items">
          {todos.map((todo) => (
            <TodoItem
              key={todo.id}
              todo={todo}
              onToggle={onToggle}
              onDelete={onDelete}
              showCustomer={false}
            />
          ))}
        </div>
      )}
    </div>
  );
});

// Milestone Group Component
const MilestoneGroup = memo(function MilestoneGroup({ milestone, todos, onToggle, onDelete }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="milestone-group">
      <button
        className="milestone-group-header"
        onClick={() => setExpanded(!expanded)}
        style={{ '--milestone-color': milestone?.color || '#64748b' }}
      >
        <ChevronRight size={16} className={expanded ? 'rotated' : ''} />
        <span
          className="milestone-badge"
          style={{ background: milestone?.color || '#64748b' }}
        >
          {milestone?.shortName || 'N/A'}
        </span>
        <span>{milestone?.name || 'No Stage'}</span>
        <span className="todo-count">{todos.length}</span>
      </button>
      {expanded && (
        <div className="milestone-group-items">
          {todos.map((todo) => (
            <TodoItem
              key={todo.id}
              todo={todo}
              onToggle={onToggle}
              onDelete={onDelete}
              showCustomer={true}
              showMilestone={false}
            />
          ))}
        </div>
      )}
    </div>
  );
});

// Main TodoSidebar Component
const TodoSidebar = memo(function TodoSidebar() {
  const todos = useTodos();
  const sidebarOpen = useSidebarOpen();
  const activeFilter = useActiveFilter();
  const {
    addTodo,
    deleteTodo,
    clearCompleted,
    toggleSidebar,
    setActiveFilter,
    initializeTodos,
    syncToDrive,
    saveToLocalStorage: saveTodosToLocalStorage,
  } = useTodoActions();

  const { userEmail, isSignedIn } = useAuthStore();
  const customers = useCustomerStore((state) => state.customers);
  const { updateCustomer, saveToLocalStorage: saveCustomersToLocalStorage, saveCustomerToFolder, syncAllToOneDrive } = useCustomerStore();

  const [isSyncing, setIsSyncing] = useState(false);

  // Initialize todos on mount
  useEffect(() => {
    initializeTodos(userEmail);
  }, [userEmail, initializeTodos]);

  // Derive completion status from checklist for linked todos
  const todosWithDerivedCompletion = useMemo(() => {
    return todos.map(todo => {
      // Get checklistItemId (direct or via text matching)
      const checklistItemId = getChecklistItemIdFromText(todo);

      // If todo is linked to a checklist item, derive completion from checklist
      if (checklistItemId && todo.customerId && todo.milestoneId) {
        const customer = customers.find(c => c.id === todo.customerId);
        if (customer?.checklist?.[todo.milestoneId]) {
          const isCompleted = customer.checklist[todo.milestoneId][checklistItemId] || false;
          return { ...todo, completed: isCompleted, checklistItemId };
        }
      }

      // For non-linked todos, keep original completed state
      return todo;
    });
  }, [todos, customers]);

  // Handle add todo
  const handleAddTodo = useCallback(
    (todoData) => {
      // Don't sync to OneDrive on add - wait for manual sync
      addTodo(todoData, userEmail, false);
    },
    [addTodo, userEmail]
  );

  // Handle toggle todo - updates checklist directly, saves to localStorage immediately
  const handleToggleTodo = useCallback(
    (todoId) => {
      const todo = todosWithDerivedCompletion.find(t => t.id === todoId);
      if (!todo) return;

      const checklistItemId = getChecklistItemIdFromText(todo);

      // If linked to checklist, update checklist (source of truth)
      if (checklistItemId && todo.customerId && todo.milestoneId) {
        const customer = customers.find(c => c.id === todo.customerId);
        if (customer) {
          const currentState = customer.checklist?.[todo.milestoneId]?.[checklistItemId] || false;
          const newState = !currentState;

          const updatedChecklist = {
            ...customer.checklist,
            [todo.milestoneId]: {
              ...(customer.checklist?.[todo.milestoneId] || {}),
              [checklistItemId]: newState,
            },
          };

          // Update customer checklist and save to localStorage immediately
          updateCustomer(customer.id, { checklist: updatedChecklist });
          saveCustomersToLocalStorage();
        }
      } else {
        // For non-linked todos, we need to track completion separately
        // Update the todo in store and save to localStorage (not OneDrive yet)
        const todoStore = useTodoStore.getState();
        const newTodos = todoStore.todos.map(t =>
          t.id === todoId
            ? { ...t, completed: !t.completed, lastModified: new Date().toISOString() }
            : t
        );
        todoStore.setTodos(newTodos);
        saveTodosToLocalStorage(userEmail);
      }
    },
    [todosWithDerivedCompletion, customers, updateCustomer, saveCustomersToLocalStorage, saveTodosToLocalStorage, userEmail]
  );

  // Handle delete todo
  const handleDeleteTodo = useCallback(
    (todoId) => {
      // Don't sync to OneDrive on delete - wait for manual sync
      deleteTodo(todoId, userEmail, false);
    },
    [deleteTodo, userEmail]
  );

  // Handle clear completed
  const handleClearCompleted = useCallback(() => {
    // Don't sync to OneDrive - wait for manual sync
    clearCompleted(userEmail, false);
  }, [clearCompleted, userEmail]);

  // Handle manual sync to OneDrive
  const handleSyncToCloud = useCallback(async () => {
    if (!isSignedIn || isSyncing) return;

    setIsSyncing(true);
    try {
      // Sync todos to OneDrive
      await syncToDrive();

      // Sync all customers with their checklists to OneDrive
      if (syncAllToOneDrive) {
        await syncAllToOneDrive();
      } else {
        // Fallback: sync customers individually
        for (const customer of customers) {
          if (customer.driveFolderId) {
            await saveCustomerToFolder(customer, isSignedIn);
          }
        }
      }

      console.log('Manual sync completed');
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [isSignedIn, isSyncing, syncToDrive, syncAllToOneDrive, customers, saveCustomerToFolder]);

  // Filter todos based on active filter (use derived completion)
  const filteredTodos = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];

    switch (activeFilter) {
      case 'today':
        return todosWithDerivedCompletion.filter((t) => t.dueDate === today && !t.completed);
      case 'overdue':
        return todosWithDerivedCompletion.filter((t) => t.dueDate && t.dueDate < today && !t.completed);
      case 'by-customer':
        return todosWithDerivedCompletion; // Will be grouped separately
      case 'by-milestone':
        return todosWithDerivedCompletion; // Will be grouped separately
      case 'all':
      default:
        return todosWithDerivedCompletion;
    }
  }, [activeFilter, todosWithDerivedCompletion]);

  // Group todos by customer for "by-customer" view
  const groupedTodos = useMemo(() => {
    if (activeFilter !== 'by-customer') return null;

    const groups = {};

    // Global todos first
    groups['__global__'] = todosWithDerivedCompletion.filter((t) => !t.customerId);

    // Group by customer
    todosWithDerivedCompletion
      .filter((t) => t.customerId)
      .forEach((todo) => {
        const key = todo.customerId;
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(todo);
      });

    return groups;
  }, [activeFilter, todosWithDerivedCompletion]);

  // Group todos by milestone for "by-milestone" view
  const milestoneGroupedTodos = useMemo(() => {
    if (activeFilter !== 'by-milestone') return null;

    const groups = {};

    // No milestone first
    groups['__none__'] = todosWithDerivedCompletion.filter((t) => !t.milestoneId);

    // Group by milestone (in order of MILESTONES)
    MILESTONES.forEach((milestone) => {
      const milestoneTodos = todosWithDerivedCompletion.filter((t) => t.milestoneId === milestone.id);
      if (milestoneTodos.length > 0) {
        groups[milestone.id] = milestoneTodos;
      }
    });

    return groups;
  }, [activeFilter, todosWithDerivedCompletion]);

  // Stats (use derived completion)
  const completedCount = todosWithDerivedCompletion.filter((t) => t.completed).length;
  const pendingCount = todosWithDerivedCompletion.length - completedCount;
  const today = new Date().toISOString().split('T')[0];
  const overdueCount = todosWithDerivedCompletion.filter((t) => t.dueDate && t.dueDate < today && !t.completed).length;

  return (
    <>
      {/* Toggle Button (visible when sidebar is closed) */}
      {!sidebarOpen && (
        <button className="todo-sidebar-toggle" onClick={toggleSidebar} aria-label="Open todo sidebar">
          <ListTodo size={20} />
          {pendingCount > 0 && <span className="todo-badge">{pendingCount}</span>}
        </button>
      )}

      {/* Sidebar Panel */}
      <div className={`todo-sidebar ${sidebarOpen ? 'open' : ''}`}>
        {/* Header */}
        <div className="todo-sidebar-header">
          <h2>
            <ListTodo size={20} />
            Tasks
          </h2>
          <div className="header-actions">
            {isSignedIn && (
              <button
                className={`sync-btn ${isSyncing ? 'syncing' : ''}`}
                onClick={handleSyncToCloud}
                disabled={isSyncing}
                aria-label="Sync to cloud"
                title="Sync changes to OneDrive"
              >
                <RefreshCw size={18} className={isSyncing ? 'spinning' : ''} />
              </button>
            )}
            <button className="close-btn" onClick={toggleSidebar} aria-label="Close sidebar">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="todo-stats">
          <span className="stat">
            <span className="stat-value">{pendingCount}</span> pending
          </span>
          <span className="stat">
            <span className="stat-value">{completedCount}</span> done
          </span>
          {overdueCount > 0 && (
            <span className="stat overdue">
              <span className="stat-value">{overdueCount}</span> overdue
            </span>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="todo-filters">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              className={`filter-tab ${activeFilter === tab.id ? 'active' : ''}`}
              onClick={() => setActiveFilter(tab.id)}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Quick Add Form */}
        <QuickAddForm onAdd={handleAddTodo} customers={customers} />

        {/* Todo List */}
        <div className="todo-list">
          {activeFilter === 'by-customer' && groupedTodos ? (
            // Grouped by customer view
            <>
              {groupedTodos['__global__']?.length > 0 && (
                <CustomerGroup
                  customerName={null}
                  todos={groupedTodos['__global__']}
                  onToggle={handleToggleTodo}
                  onDelete={handleDeleteTodo}
                />
              )}
              {Object.entries(groupedTodos)
                .filter(([key]) => key !== '__global__')
                .map(([customerId, customerTodos]) => (
                  <CustomerGroup
                    key={customerId}
                    customerName={customerTodos[0]?.customerName}
                    todos={customerTodos}
                    onToggle={handleToggleTodo}
                    onDelete={handleDeleteTodo}
                  />
                ))}
            </>
          ) : activeFilter === 'by-milestone' && milestoneGroupedTodos ? (
            // Grouped by milestone view
            <>
              {milestoneGroupedTodos['__none__']?.length > 0 && (
                <MilestoneGroup
                  milestone={null}
                  todos={milestoneGroupedTodos['__none__']}
                  onToggle={handleToggleTodo}
                  onDelete={handleDeleteTodo}
                />
              )}
              {MILESTONES.map((milestone) => {
                const milestoneTodos = milestoneGroupedTodos[milestone.id];
                if (!milestoneTodos || milestoneTodos.length === 0) return null;
                return (
                  <MilestoneGroup
                    key={milestone.id}
                    milestone={milestone}
                    todos={milestoneTodos}
                    onToggle={handleToggleTodo}
                    onDelete={handleDeleteTodo}
                  />
                );
              })}
            </>
          ) : (
            // Flat list view
            <>
              {filteredTodos.length === 0 ? (
                <div className="empty-state">
                  {activeFilter === 'today' && 'No tasks due today'}
                  {activeFilter === 'overdue' && 'No overdue tasks'}
                  {activeFilter === 'all' && 'No tasks yet. Add one above!'}
                </div>
              ) : (
                filteredTodos.map((todo) => (
                  <TodoItem
                    key={todo.id}
                    todo={todo}
                    onToggle={handleToggleTodo}
                    onDelete={handleDeleteTodo}
                    showCustomer={true}
                  />
                ))
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        {completedCount > 0 && (
          <div className="todo-footer">
            <button className="clear-completed-btn" onClick={handleClearCompleted}>
              <Trash2 size={14} />
              Clear {completedCount} completed
            </button>
          </div>
        )}
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && <div className="todo-sidebar-overlay" onClick={toggleSidebar} />}
    </>
  );
});

export default TodoSidebar;
