import { useMemo, useState, useCallback } from 'react';
import { Car, Handshake, ClipboardCheck, Package, Star, Calendar, Clock, CheckCircle2, Circle, ChevronDown, ChevronUp, ListTodo } from 'lucide-react';
import useTodoStore from '../../../stores/useTodoStore';
import useCustomerStore from '../../../stores/useCustomerStore';
import useAuthStore from '../../../stores/useAuthStore';
import {
  MILESTONES,
  CHECKLISTS,
  getMilestoneProgress,
  isMilestoneComplete,
  getDefaultChecklistState,
  getDaysUntilMilestone,
  getMilestoneUrgency,
} from '../../../constants/milestones';
import './CustomerStatusPanel.css';

const iconComponents = { Car, Handshake, ClipboardCheck, Package, Star };

const getMilestoneIcon = (iconName, size = 16, color = 'currentColor') => {
  const IconComponent = iconComponents[iconName];
  return IconComponent ? <IconComponent size={size} color={color} strokeWidth={2} /> : null;
};

function CustomerStatusPanel({ customer }) {
  const { todos } = useTodoStore();
  const { updateCustomer, saveToLocalStorage, saveCustomerToFolder } = useCustomerStore();
  const { isSignedIn } = useAuthStore();
  const [expandedMilestone, setExpandedMilestone] = useState(null);

  const checklist = customer?.checklist || getDefaultChecklistState();
  const milestoneDates = customer?.milestoneDates || {};
  const currentMilestoneId = checklist.currentMilestone || 'test_drive';
  const currentMilestoneIndex = MILESTONES.findIndex(m => m.id === currentMilestoneId);

  // Get tasks for this customer
  const customerTasks = useMemo(() => {
    if (!customer?.id) return [];
    return todos.filter(t => t.customerId === customer.id);
  }, [todos, customer?.id]);

  // Get uncompleted items from current milestone
  const currentMilestoneItems = useMemo(() => {
    const items = CHECKLISTS[currentMilestoneId] || [];
    return items.map(item => ({
      ...item,
      completed: checklist[currentMilestoneId]?.[item.id] || false,
    }));
  }, [currentMilestoneId, checklist]);

  const uncompletedItems = currentMilestoneItems.filter(item => !item.completed);
  const currentMilestone = MILESTONES.find(m => m.id === currentMilestoneId);

  // Get todo completion status (considering linked checklist items)
  const getTodoCompletion = useCallback((todo) => {
    if (todo.checklistItemId && todo.milestoneId && customer) {
      return customer.checklist?.[todo.milestoneId]?.[todo.checklistItemId] || false;
    }
    return todo.completed || false;
  }, [customer]);

  // Handle checklist item toggle
  const handleChecklistToggle = useCallback(async (milestoneId, itemId, checked) => {
    if (!customer) return;

    const updatedChecklist = {
      ...checklist,
      [milestoneId]: {
        ...(checklist[milestoneId] || {}),
        [itemId]: checked,
      },
    };

    updateCustomer(customer.id, { checklist: updatedChecklist });
    saveToLocalStorage();

    if (isSignedIn && customer.driveFolderId) {
      try {
        await saveCustomerToFolder({ ...customer, checklist: updatedChecklist }, isSignedIn);
      } catch (error) {
        console.error('Error saving checklist to cloud:', error);
      }
    }
  }, [customer, checklist, updateCustomer, saveToLocalStorage, saveCustomerToFolder, isSignedIn]);

  return (
    <div className="customer-status-panel">
      {/* Milestone Progress Bar */}
      <div className="status-section">
        <h4 className="status-section-title">
          <ListTodo size={16} />
          Progress
        </h4>
        <div className="milestone-progress-bar">
          {MILESTONES.map((milestone, index) => {
            const isComplete = isMilestoneComplete(milestone.id, checklist);
            const isCurrent = index === currentMilestoneIndex;
            const isPast = index < currentMilestoneIndex;
            const progress = getMilestoneProgress(milestone.id, checklist);

            return (
              <div
                key={milestone.id}
                className={`milestone-segment ${isComplete ? 'complete' : ''} ${isCurrent ? 'current' : ''} ${isPast ? 'past' : ''}`}
                style={{
                  '--milestone-color': milestone.color,
                  flex: isCurrent ? 2 : 1,
                }}
                title={`${milestone.name}: ${progress}%`}
              >
                <div
                  className="milestone-fill"
                  style={{
                    width: isComplete || isPast ? '100%' : isCurrent ? `${progress}%` : '0%',
                    background: milestone.color,
                  }}
                />
                <span className="milestone-label">{milestone.shortName}</span>
              </div>
            );
          })}
        </div>

        {/* Current Stage Indicator */}
        <div className="current-stage-info">
          <div
            className="current-stage-badge"
            style={{ background: currentMilestone?.color }}
          >
            {getMilestoneIcon(currentMilestone?.iconName, 14, 'white')}
            <span>{currentMilestone?.name}</span>
          </div>
          {milestoneDates[currentMilestoneId] && (
            <div className={`target-date ${getMilestoneUrgency(milestoneDates[currentMilestoneId])}`}>
              <Calendar size={12} />
              {(() => {
                const days = getDaysUntilMilestone(milestoneDates[currentMilestoneId]);
                if (days === null) return null;
                if (days < 0) return `${Math.abs(days)}d overdue`;
                if (days === 0) return 'Due today';
                return `${days}d left`;
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Next Required Checklist Items */}
      <div className="status-section">
        <h4 className="status-section-title">
          <ClipboardCheck size={16} />
          Next Steps
          {uncompletedItems.length > 0 && (
            <span className="count-badge">{uncompletedItems.length}</span>
          )}
        </h4>

        {uncompletedItems.length === 0 ? (
          <div className="all-complete-message">
            <CheckCircle2 size={20} color={currentMilestone?.color} />
            <span>All items completed for {currentMilestone?.name}!</span>
          </div>
        ) : (
          <ul className="checklist-items-compact">
            {uncompletedItems.slice(0, 5).map(item => (
              <li key={item.id} className="checklist-item-compact">
                <label className="checklist-label">
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={(e) => handleChecklistToggle(currentMilestoneId, item.id, e.target.checked)}
                  />
                  <span
                    className="custom-checkbox-small"
                    style={{ borderColor: currentMilestone?.color }}
                  >
                    {item.completed && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    )}
                  </span>
                  <span className="item-text">{item.label}</span>
                </label>
              </li>
            ))}
            {uncompletedItems.length > 5 && (
              <li className="more-items">+{uncompletedItems.length - 5} more items</li>
            )}
          </ul>
        )}
      </div>

      {/* All Milestones Quick View */}
      <div className="status-section milestones-quick-view">
        <h4 className="status-section-title">
          <Package size={16} />
          All Milestones
        </h4>
        <div className="milestones-list">
          {MILESTONES.map(milestone => {
            const progress = getMilestoneProgress(milestone.id, checklist);
            const isComplete = isMilestoneComplete(milestone.id, checklist);
            const isCurrent = milestone.id === currentMilestoneId;
            const isExpanded = expandedMilestone === milestone.id;
            const items = CHECKLISTS[milestone.id] || [];

            return (
              <div
                key={milestone.id}
                className={`milestone-quick-item ${isComplete ? 'complete' : ''} ${isCurrent ? 'current' : ''}`}
              >
                <button
                  className="milestone-quick-header"
                  onClick={() => setExpandedMilestone(isExpanded ? null : milestone.id)}
                >
                  <div className="milestone-quick-left">
                    <div
                      className="milestone-icon-small"
                      style={{
                        background: isComplete ? milestone.color : 'transparent',
                        borderColor: milestone.color,
                      }}
                    >
                      {isComplete ? (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      ) : (
                        getMilestoneIcon(milestone.iconName, 12, milestone.color)
                      )}
                    </div>
                    <span className="milestone-quick-name">{milestone.shortName}</span>
                  </div>
                  <div className="milestone-quick-right">
                    <div className="mini-progress-bar">
                      <div
                        className="mini-progress-fill"
                        style={{ width: `${progress}%`, background: milestone.color }}
                      />
                    </div>
                    <span className="mini-progress-text">{progress}%</span>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="milestone-expanded-items">
                    {items.map(item => {
                      const itemCompleted = checklist[milestone.id]?.[item.id] || false;
                      return (
                        <label key={item.id} className="expanded-checklist-item">
                          <input
                            type="checkbox"
                            checked={itemCompleted}
                            onChange={(e) => handleChecklistToggle(milestone.id, item.id, e.target.checked)}
                          />
                          <span
                            className="custom-checkbox-tiny"
                            style={{
                              borderColor: itemCompleted ? milestone.color : '#cbd5e1',
                              background: itemCompleted ? milestone.color : 'transparent',
                            }}
                          >
                            {itemCompleted && (
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                            )}
                          </span>
                          <span className={`expanded-item-text ${itemCompleted ? 'completed' : ''}`}>
                            {item.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Customer Tasks */}
      <div className="status-section">
        <h4 className="status-section-title">
          <Clock size={16} />
          Tasks
          {customerTasks.length > 0 && (
            <span className="count-badge">{customerTasks.filter(t => !getTodoCompletion(t)).length}</span>
          )}
        </h4>

        {customerTasks.length === 0 ? (
          <div className="empty-tasks">
            <span>No tasks for this customer</span>
          </div>
        ) : (
          <ul className="tasks-list-compact">
            {customerTasks.slice(0, 5).map(task => {
              const isCompleted = getTodoCompletion(task);
              const milestone = MILESTONES.find(m => m.id === task.milestoneId);
              const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !isCompleted;

              return (
                <li key={task.id} className={`task-item-compact ${isCompleted ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}`}>
                  {isCompleted ? (
                    <CheckCircle2 size={14} className="task-check" style={{ color: milestone?.color || '#10b981' }} />
                  ) : (
                    <Circle size={14} className="task-check" />
                  )}
                  <span className="task-text">{task.text}</span>
                  {task.dueDate && (
                    <span className={`task-due ${isOverdue ? 'overdue' : ''}`}>
                      {new Date(task.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                  {milestone && (
                    <span
                      className="task-milestone-badge"
                      style={{ background: milestone.color }}
                    >
                      {milestone.shortName}
                    </span>
                  )}
                </li>
              );
            })}
            {customerTasks.length > 5 && (
              <li className="more-items">+{customerTasks.length - 5} more tasks</li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

export default CustomerStatusPanel;
