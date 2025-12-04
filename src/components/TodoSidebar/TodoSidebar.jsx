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

// Helper to find checklistItemId from todo text pattern
const findChecklistItemId = (todo) => {
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

  const selectedCustomer = customers.find((c) => c.id === Number(customerId));

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
    toggleSidebar,
    setActiveFilter,
    initializeTodos,
    syncToDrive,
    saveToLocalStorage: saveTodosToLocal,
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

  // Enrich todos with completion status from checklist (for checklist-linked todos)
  const enrichedTodos = useMemo(() => {
    return todos.map(todo => {
      const checklistItemId = findChecklistItemId(todo);

      // If linked to a checklist item, get completion from checklist
      if (checklistItemId && todo.customerId && todo.milestoneId) {
        const customer = customers.find(c => c.id === todo.customerId);
        if (customer?.checklist?.[todo.milestoneId]) {
          const isCompleted = customer.checklist[todo.milestoneId][checklistItemId] || false;
          return { ...todo, completed: isCompleted, _checklistItemId: checklistItemId };
        }
      }

      return { ...todo, _checklistItemId: checklistItemId };
    });
  }, [todos, customers]);

  // Handle add todo - save to localStorage immediately
  const handleAddTodo = useCallback(
    (todoData) => {
      addTodo(todoData, userEmail, false); // false = don't sync to OneDrive yet
    },
    [addTodo, userEmail]
  );

  // Handle toggle todo - update checklist if linked, always save immediately
  const handleToggleTodo = useCallback(
    (todoId) => {
      const todo = enrichedTodos.find(t => t.id === todoId);
      if (!todo) return;

      const checklistItemId = todo._checklistItemId;
      const newCompletedState = !todo.completed;

      // If linked to checklist, update the checklist (source of truth)
      if (checklistItemId && todo.customerId && todo.milestoneId) {
        const customer = customers.find(c => c.id === todo.customerId);
        if (customer) {
          const updatedChecklist = {
            ...customer.checklist,
            [todo.milestoneId]: {
              ...(customer.checklist?.[todo.milestoneId] || {}),
              [checklistItemId]: newCompletedState,
            },
          };

          // Update customer checklist and save to localStorage
          updateCustomer(customer.id, { checklist: updatedChecklist });
          saveCustomersToLocal();
          console.log(`Checklist updated: ${checklistItemId} = ${newCompletedState}`);
        }
      } else {
        // For non-linked todos, update the todo's completed state directly
        const todoStore = useTodoStore.getState();
        const updatedTodos = todoStore.todos.map(t =>
          t.id === todoId
            ? { ...t, completed: newCompletedState, lastModified: new Date().toISOString() }
            : t
        );
        todoStore.setTodos(updatedTodos);
        saveTodosToLocal(userEmail);
      }
    },
    [enrichedTodos, customers, updateCustomer, saveCustomersToLocal, saveTodosToLocal, userEmail]
  );

  // Handle delete todo - remove from todo list, save immediately
  const handleDeleteTodo = useCallback(
    (todoId) => {
      // Simply delete the todo - this removes it from the list
      // The checklist item remains (customer can still see it in Status tab)
      const todoStore = useTodoStore.getState();
      const updatedTodos = todoStore.todos.filter(t => t.id !== todoId);
      todoStore.setTodos(updatedTodos);
      saveTodosToLocal(userEmail);
      console.log(`Todo deleted: ${todoId}`);
    },
    [saveTodosToLocal, userEmail]
  );

  // Handle clear completed - remove all completed todos
  const handleClearCompleted = useCallback(() => {
    const completedIds = enrichedTodos.filter(t => t.completed).map(t => t.id);
    const todoStore = useTodoStore.getState();
    const updatedTodos = todoStore.todos.filter(t => !completedIds.includes(t.id));
    todoStore.setTodos(updatedTodos);
    saveTodosToLocal(userEmail);
    console.log(`Cleared ${completedIds.length} completed todos`);
  }, [enrichedTodos, saveTodosToLocal, userEmail]);

  // Handle manual sync to OneDrive
  const handleSyncToCloud = useCallback(async () => {
    if (!isSignedIn || isSyncing) return;

    setIsSyncing(true);
    try {
      // Sync todos
      await syncToDrive();

      // Sync customers (they have the checklist data)
      const customerStore = useCustomerStore.getState();
      if (customerStore.syncAllToOneDrive) {
        await customerStore.syncAllToOneDrive();
      }

      console.log('Sync to OneDrive completed');
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [isSignedIn, isSyncing, syncToDrive]);

  // Filter todos based on active filter
  const filteredTodos = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];

    switch (activeFilter) {
      case 'today':
        return enrichedTodos.filter(t => t.dueDate === today && !t.completed);
      case 'overdue':
        return enrichedTodos.filter(t => t.dueDate && t.dueDate < today && !t.completed);
      case 'by-customer':
      case 'by-milestone':
        return enrichedTodos;
      case 'all':
      default:
        return enrichedTodos;
    }
  }, [activeFilter, enrichedTodos]);

  // Group todos by customer
  const groupedByCustomer = useMemo(() => {
    if (activeFilter !== 'by-customer') return null;

    const groups = { '__global__': [] };
    enrichedTodos.forEach(todo => {
      const key = todo.customerId || '__global__';
      if (!groups[key]) groups[key] = [];
      groups[key].push(todo);
    });
    return groups;
  }, [activeFilter, enrichedTodos]);

  // Group todos by milestone
  const groupedByMilestone = useMemo(() => {
    if (activeFilter !== 'by-milestone') return null;

    const groups = { '__none__': [] };
    MILESTONES.forEach(m => { groups[m.id] = []; });

    enrichedTodos.forEach(todo => {
      const key = todo.milestoneId || '__none__';
      if (groups[key]) groups[key].push(todo);
    });

    return groups;
  }, [activeFilter, enrichedTodos]);

  // Stats
  const completedCount = enrichedTodos.filter(t => t.completed).length;
  const pendingCount = enrichedTodos.length - completedCount;
  const today = new Date().toISOString().split('T')[0];
  const overdueCount = enrichedTodos.filter(t => t.dueDate && t.dueDate < today && !t.completed).length;

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
          {FILTER_TABS.map(tab => (
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
              {MILESTONES.map(milestone => {
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
                filteredTodos.map(todo => (
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
