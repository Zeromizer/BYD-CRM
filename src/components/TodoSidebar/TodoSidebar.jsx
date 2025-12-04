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

/**
 * TodoSidebar - Task Management Component
 *
 * INTEGRATION WITH STATUS CHECKLIST:
 * - Todos linked to checklist items (via checklistItemId) get completion from customer.checklist
 * - Toggling a linked todo updates the checklist (source of truth)
 * - Standalone todos use their own 'completed' field
 */

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

const FILTER_TABS = [
  { id: 'all', label: 'All', icon: ListTodo },
  { id: 'today', label: 'Today', icon: Calendar },
  { id: 'overdue', label: 'Overdue', icon: AlertCircle },
  { id: 'by-customer', label: 'By Customer', icon: User },
  { id: 'by-milestone', label: 'By Stage', icon: Milestone },
];

// Get milestone info by ID
const getMilestoneInfo = (milestoneId) => MILESTONES.find((m) => m.id === milestoneId);

/**
 * Find the checklistItemId from a todo
 * Uses explicit checklistItemId, or falls back to text pattern matching
 */
const getChecklistItemId = (todo) => {
  if (todo.checklistItemId) return todo.checklistItemId;
  if (!todo.milestoneId) return null;

  const milestone = getMilestoneInfo(todo.milestoneId);
  if (!milestone) return null;

  // Try to match by text pattern: "Milestone Name: Item Label"
  const prefix = `${milestone.name}: `;
  if (!todo.text.startsWith(prefix)) return null;

  const itemLabel = todo.text.substring(prefix.length);
  const items = CHECKLISTS[todo.milestoneId] || [];
  const match = items.find((item) => item.label === itemLabel);
  return match?.id || null;
};

/**
 * Get completion status for a todo
 * Returns: { isCompleted, isLinked, checklistItemId }
 */
const getTodoCompletion = (todo, customers) => {
  const checklistItemId = getChecklistItemId(todo);

  // If linked to a checklist item, get completion from customer's checklist
  if (checklistItemId && todo.customerId && todo.milestoneId) {
    const customer = customers.find((c) => c.id === todo.customerId);
    const checklist = customer?.checklist?.[todo.milestoneId];
    const isCompleted = checklist?.[checklistItemId] || false;
    return { isCompleted, isLinked: true, checklistItemId };
  }

  // Standalone todo - use its own completed field
  return { isCompleted: todo.completed || false, isLinked: false, checklistItemId: null };
};

// Single Todo Item Component
const TodoItem = memo(function TodoItem({ todo, isCompleted, onToggle, onDelete, showCustomer, showMilestone = true }) {
  const isOverdue = todo.dueDate && new Date(todo.dueDate) < new Date() && !isCompleted;
  const milestone = todo.milestoneId ? getMilestoneInfo(todo.milestoneId) : null;

  return (
    <div className={`todo-item ${isCompleted ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}`}>
      <button
        className="todo-checkbox"
        onClick={() => onToggle(todo)}
        aria-label={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
      >
        {isCompleted ? (
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
            <span className="todo-milestone" style={{ background: milestone.color, color: 'white' }}>
              <Milestone size={10} />
              {milestone.shortName}
            </span>
          )}
          <span className="todo-priority" style={{ color: PRIORITY_COLORS[todo.priority] }}>
            <Flag size={12} />
            {PRIORITY_LABELS[todo.priority]}
          </span>
        </div>
      </div>

      <button className="todo-delete" onClick={() => onDelete(todo.id)} aria-label="Delete todo">
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

  const selectedCustomer = customers.find((c) => c.id === Number(customerId));

  const handleMilestoneChange = (newMilestoneId) => {
    setMilestoneId(newMilestoneId);
    // Auto-fill due date from customer's milestone date
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

      <button type="button" className="toggle-options-btn" onClick={() => setShowOptions(!showOptions)}>
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
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
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
              isCompleted={todo._isCompleted}
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
        <span className="milestone-badge" style={{ background: milestone?.color || '#64748b' }}>
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
              isCompleted={todo._isCompleted}
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
    toggleStandaloneTodo,
    clearCompleted,
    toggleSidebar,
    setActiveFilter,
    initializeTodos,
    syncToDrive,
    saveToLocalStorage,
  } = useTodoActions();

  const { userEmail, isSignedIn } = useAuthStore();
  const customers = useCustomerStore((state) => state.customers);
  const updateCustomer = useCustomerStore((state) => state.updateCustomer);
  const saveCustomersToLocal = useCustomerStore((state) => state.saveToLocalStorage);

  const [isSyncing, setIsSyncing] = useState(false);

  // Initialize todos on mount
  useEffect(() => {
    initializeTodos(userEmail);
  }, [userEmail, initializeTodos]);

  // Enrich todos with completion status from checklist
  const enrichedTodos = useMemo(() => {
    return todos.map((todo) => {
      const { isCompleted, isLinked, checklistItemId } = getTodoCompletion(todo, customers);
      return {
        ...todo,
        _isCompleted: isCompleted,
        _isLinked: isLinked,
        _checklistItemId: checklistItemId,
      };
    });
  }, [todos, customers]);

  // Handle add todo
  const handleAddTodo = useCallback(
    (todoData) => {
      addTodo(todoData, userEmail, isSignedIn);
    },
    [addTodo, userEmail, isSignedIn]
  );

  // Handle toggle todo - updates checklist if linked, otherwise updates todo
  const handleToggleTodo = useCallback(
    (todo) => {
      const newState = !todo._isCompleted;

      if (todo._isLinked && todo._checklistItemId && todo.customerId && todo.milestoneId) {
        // Update the checklist (source of truth)
        const customer = customers.find((c) => c.id === todo.customerId);
        if (customer) {
          const updatedChecklist = {
            ...customer.checklist,
            [todo.milestoneId]: {
              ...(customer.checklist?.[todo.milestoneId] || {}),
              [todo._checklistItemId]: newState,
            },
          };
          updateCustomer(customer.id, { checklist: updatedChecklist });
          saveCustomersToLocal();
        }
      } else {
        // Standalone todo - update the todo itself
        toggleStandaloneTodo(todo.id, userEmail, isSignedIn);
      }
    },
    [customers, updateCustomer, saveCustomersToLocal, toggleStandaloneTodo, userEmail, isSignedIn]
  );

  // Handle delete todo
  const handleDeleteTodo = useCallback(
    (todoId) => {
      deleteTodo(todoId, userEmail, isSignedIn);
    },
    [deleteTodo, userEmail, isSignedIn]
  );

  // Handle clear completed
  const handleClearCompleted = useCallback(() => {
    const completedIds = enrichedTodos.filter((t) => t._isCompleted).map((t) => t.id);
    if (completedIds.length > 0) {
      clearCompleted(completedIds, userEmail, isSignedIn);
    }
  }, [enrichedTodos, clearCompleted, userEmail, isSignedIn]);

  // Handle clear all tasks (with confirmation)
  const handleClearAll = useCallback(() => {
    const count = enrichedTodos.length;
    if (count === 0) return;

    const confirmed = window.confirm(`Delete all ${count} task(s)? This cannot be undone.`);
    if (confirmed) {
      const allIds = enrichedTodos.map((t) => t.id);
      clearCompleted(allIds, userEmail, isSignedIn);
    }
  }, [enrichedTodos, clearCompleted, userEmail, isSignedIn]);

  // Handle manual sync to OneDrive
  const handleSyncToCloud = useCallback(async () => {
    if (!isSignedIn || isSyncing) return;

    setIsSyncing(true);
    try {
      await syncToDrive(userEmail);
      const customerStore = useCustomerStore.getState();
      if (customerStore.syncAllToOneDrive) {
        await customerStore.syncAllToOneDrive();
      }
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [isSignedIn, isSyncing, syncToDrive, userEmail]);

  // Filter todos based on active filter
  const filteredTodos = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];

    switch (activeFilter) {
      case 'today':
        return enrichedTodos.filter((t) => t.dueDate === today && !t._isCompleted);
      case 'overdue':
        return enrichedTodos.filter((t) => t.dueDate && t.dueDate < today && !t._isCompleted);
      case 'by-customer':
      case 'by-milestone':
      case 'all':
      default:
        return enrichedTodos;
    }
  }, [activeFilter, enrichedTodos]);

  // Group todos by customer
  const groupedByCustomer = useMemo(() => {
    if (activeFilter !== 'by-customer') return null;

    const groups = { __global__: [] };
    enrichedTodos.forEach((todo) => {
      const key = todo.customerId || '__global__';
      if (!groups[key]) groups[key] = [];
      groups[key].push(todo);
    });
    return groups;
  }, [activeFilter, enrichedTodos]);

  // Group todos by milestone
  const groupedByMilestone = useMemo(() => {
    if (activeFilter !== 'by-milestone') return null;

    const groups = { __none__: [] };
    MILESTONES.forEach((m) => {
      groups[m.id] = [];
    });

    enrichedTodos.forEach((todo) => {
      const key = todo.milestoneId || '__none__';
      if (groups[key]) groups[key].push(todo);
    });

    return groups;
  }, [activeFilter, enrichedTodos]);

  // Stats
  const completedCount = enrichedTodos.filter((t) => t._isCompleted).length;
  const pendingCount = enrichedTodos.length - completedCount;
  const today = new Date().toISOString().split('T')[0];
  const overdueCount = enrichedTodos.filter((t) => t.dueDate && t.dueDate < today && !t._isCompleted).length;

  return (
    <>
      {/* Toggle Button */}
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
                title="Sync to OneDrive"
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
          {activeFilter === 'by-customer' && groupedByCustomer ? (
            <>
              {groupedByCustomer['__global__']?.length > 0 && (
                <CustomerGroup
                  customerName={null}
                  todos={groupedByCustomer['__global__']}
                  onToggle={handleToggleTodo}
                  onDelete={handleDeleteTodo}
                />
              )}
              {Object.entries(groupedByCustomer)
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
          ) : activeFilter === 'by-milestone' && groupedByMilestone ? (
            <>
              {groupedByMilestone['__none__']?.length > 0 && (
                <MilestoneGroup
                  milestone={null}
                  todos={groupedByMilestone['__none__']}
                  onToggle={handleToggleTodo}
                  onDelete={handleDeleteTodo}
                />
              )}
              {MILESTONES.map((milestone) => {
                const milestoneTodos = groupedByMilestone[milestone.id];
                if (!milestoneTodos?.length) return null;
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
                    isCompleted={todo._isCompleted}
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
        {(enrichedTodos.length > 0) && (
          <div className="todo-footer">
            {completedCount > 0 && (
              <button className="clear-completed-btn" onClick={handleClearCompleted}>
                <Trash2 size={14} />
                Clear {completedCount} completed
              </button>
            )}
            <button className="clear-all-btn" onClick={handleClearAll}>
              <Trash2 size={14} />
              Clear all ({enrichedTodos.length})
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
