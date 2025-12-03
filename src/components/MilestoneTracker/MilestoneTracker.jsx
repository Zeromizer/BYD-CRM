import { useState, useEffect, memo, useCallback, useMemo } from 'react';
import useCustomerStore from '../../stores/useCustomerStore';
import useAuthStore from '../../stores/useAuthStore';
import useTodoStore from '../../stores/useTodoStore';
import {
  MILESTONES,
  CHECKLISTS,
  getMilestoneProgress,
  isMilestoneComplete,
  getDefaultChecklistState,
  getDefaultMilestoneDates,
  getDaysUntilMilestone,
  getMilestoneUrgency,
} from '../../constants/milestones';
import { Car, Handshake, ClipboardCheck, Package, Star, Calendar, Clock, Plus, ListTodo } from 'lucide-react';
import './MilestoneTracker.css';

// Map icon names to components
const iconComponents = {
  Car,
  Handshake,
  ClipboardCheck,
  Package,
  Star,
};

// Helper to get icon component
const getMilestoneIcon = (iconName, size = 16, color = 'currentColor') => {
  const IconComponent = iconComponents[iconName];
  return IconComponent ? <IconComponent size={size} color={color} strokeWidth={2} /> : null;
};

const MilestoneTracker = memo(function MilestoneTracker({ customer, onSave }) {
  const { updateCustomer, saveToLocalStorage, saveCustomerToFolder } = useCustomerStore();
  const { isSignedIn, userEmail } = useAuthStore();
  const { addTodo } = useTodoStore();
  const [expandedMilestone, setExpandedMilestone] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Local state for editing (not synced until save)
  const [localChecklist, setLocalChecklist] = useState(() => {
    return customer?.checklist || getDefaultChecklistState();
  });

  // Local state for milestone dates
  const [localMilestoneDates, setLocalMilestoneDates] = useState(() => {
    return customer?.milestoneDates || getDefaultMilestoneDates();
  });

  // Track if there are unsaved changes
  const [hasChanges, setHasChanges] = useState(false);

  // Reset local state when customer changes
  useEffect(() => {
    const newChecklist = customer?.checklist || getDefaultChecklistState();
    const newMilestoneDates = customer?.milestoneDates || getDefaultMilestoneDates();
    setLocalChecklist(newChecklist);
    setLocalMilestoneDates(newMilestoneDates);
    setHasChanges(false);
  }, [customer?.id]);

  // Get current milestone from local state
  const currentMilestone = localChecklist.currentMilestone || 'test_drive';

  // Auto-expand the current milestone on first render
  useEffect(() => {
    if (!expandedMilestone) {
      setExpandedMilestone(currentMilestone);
    }
  }, [currentMilestone]);

  const handleMilestoneClick = (milestoneId) => {
    setExpandedMilestone(expandedMilestone === milestoneId ? null : milestoneId);
  };

  // Update local state only (no sync)
  const handleSetCurrentMilestone = (milestoneId) => {
    setLocalChecklist((prev) => ({
      ...prev,
      currentMilestone: milestoneId,
    }));
    setHasChanges(true);
  };

  // Update local state only (no sync)
  const handleChecklistToggle = (milestoneId, itemId, checked) => {
    setLocalChecklist((prev) => ({
      ...prev,
      [milestoneId]: {
        ...(prev[milestoneId] || {}),
        [itemId]: checked,
      },
    }));
    setHasChanges(true);
  };

  // Update milestone date (local only until save)
  const handleMilestoneDateChange = (milestoneId, date) => {
    setLocalMilestoneDates((prev) => ({
      ...prev,
      [milestoneId]: date || null,
    }));
    setHasChanges(true);
  };

  // Create todos from checklist items for a milestone
  const handleCreateTodosFromChecklist = (milestoneId) => {
    const items = CHECKLISTS[milestoneId] || [];
    const milestone = MILESTONES.find(m => m.id === milestoneId);
    const milestoneDate = localMilestoneDates[milestoneId];

    // Get uncompleted items only
    const uncompletedItems = items.filter(
      item => !localChecklist[milestoneId]?.[item.id]
    );

    if (uncompletedItems.length === 0) {
      alert('All checklist items are already completed!');
      return;
    }

    // Create a todo for each uncompleted item
    uncompletedItems.forEach(item => {
      addTodo({
        text: `${milestone?.name}: ${item.label}`,
        priority: milestoneDate ? 'high' : 'medium',
        dueDate: milestoneDate || null,
        customerId: customer?.id || null,
        customerName: customer?.name || null,
        milestoneId: milestoneId,
      }, userEmail, isSignedIn);
    });

    alert(`Created ${uncompletedItems.length} task(s) for ${milestone?.name}`);
  };

  // Save all changes to store and sync
  const handleSaveChanges = async () => {
    if (!customer || !hasChanges) return;

    setIsSaving(true);
    try {
      // Update the customer with new checklist and milestone dates
      updateCustomer(customer.id, {
        checklist: localChecklist,
        milestoneDates: localMilestoneDates,
      });
      saveToLocalStorage();

      // Sync to Drive if signed in
      if (isSignedIn && customer.driveFolderId) {
        const updatedCustomer = {
          ...customer,
          checklist: localChecklist,
          milestoneDates: localMilestoneDates,
        };
        await saveCustomerToFolder(updatedCustomer, isSignedIn);
      }

      setHasChanges(false);
      if (onSave) onSave();
    } finally {
      setIsSaving(false);
    }
  };

  // Cancel and revert to saved state
  const handleCancel = () => {
    const savedChecklist = customer?.checklist || getDefaultChecklistState();
    const savedMilestoneDates = customer?.milestoneDates || getDefaultMilestoneDates();
    setLocalChecklist(savedChecklist);
    setLocalMilestoneDates(savedMilestoneDates);
    setHasChanges(false);
  };

  const getMilestoneIndex = (milestoneId) => {
    return MILESTONES.findIndex((m) => m.id === milestoneId);
  };

  const currentMilestoneIndex = getMilestoneIndex(currentMilestone);

  return (
    <div className="milestone-tracker">
      {/* Save/Cancel Actions Bar */}
      {hasChanges && (
        <div className="milestone-actions-bar">
          <span className="unsaved-indicator">You have unsaved changes</span>
          <div className="milestone-actions-buttons">
            <button
              className="btn btn-secondary"
              onClick={handleCancel}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSaveChanges}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Current Stage Selector */}
      <div className="current-stage-selector">
        <label>Current Stage:</label>
        <div className="stage-buttons">
          {MILESTONES.map((milestone) => {
            const isCurrent = milestone.id === currentMilestone;
            const isComplete = isMilestoneComplete(milestone.id, localChecklist);

            return (
              <button
                key={milestone.id}
                className={`stage-button ${isCurrent ? 'active' : ''} ${isComplete ? 'complete' : ''}`}
                style={{
                  '--stage-color': milestone.color,
                  borderColor: isCurrent ? milestone.color : 'var(--color-border-light)',
                  background: isCurrent ? milestone.color : 'transparent',
                  color: isCurrent ? 'white' : milestone.color,
                }}
                onClick={() => handleSetCurrentMilestone(milestone.id)}
              >
                {getMilestoneIcon(milestone.iconName, 16, isCurrent ? 'white' : milestone.color)}
                <span className="stage-name-full">{milestone.name}</span>
                <span className="stage-name-short">{isCurrent ? milestone.name : milestone.shortName}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Expandable Checklists */}
      <div className="milestone-checklists">
        {MILESTONES.map((milestone) => {
          const isExpanded = expandedMilestone === milestone.id;
          const items = CHECKLISTS[milestone.id] || [];
          const progress = getMilestoneProgress(milestone.id, localChecklist);
          const isComplete = isMilestoneComplete(milestone.id, localChecklist);
          const isCurrent = milestone.id === currentMilestone;

          return (
            <div
              key={milestone.id}
              className={`checklist-section ${isExpanded ? 'expanded' : ''} ${isCurrent ? 'current' : ''}`}
            >
              <button
                className="checklist-header"
                onClick={() => handleMilestoneClick(milestone.id)}
                style={{
                  '--milestone-color': milestone.color,
                }}
              >
                <div className="checklist-header-left">
                  <div
                    className={`checklist-indicator ${isComplete ? 'complete' : ''}`}
                    style={{ background: isComplete ? milestone.color : 'transparent', borderColor: milestone.color }}
                  >
                    {isComplete ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    ) : (
                      getMilestoneIcon(milestone.iconName, 14, milestone.color)
                    )}
                  </div>
                  <span className="checklist-title" style={{ color: isCurrent ? milestone.color : 'inherit' }}>
                    {milestone.name}
                  </span>
                  {isCurrent && <span className="current-badge" style={{ background: milestone.color }}>Current</span>}
                </div>
                <div className="checklist-header-right">
                  <div className="checklist-progress-bar">
                    <div
                      className="checklist-progress-fill"
                      style={{ width: `${progress}%`, background: milestone.color }}
                    />
                  </div>
                  <span className="checklist-progress-text">{progress}%</span>
                  <svg
                    className={`chevron ${isExpanded ? 'expanded' : ''}`}
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>
              </button>

              {isExpanded && (
                <div className="checklist-items">
                  {/* Milestone Date Input */}
                  <div className="milestone-date-section">
                    <div className="milestone-date-input-row">
                      <label className="milestone-date-label">
                        <Calendar size={14} />
                        Target Date:
                      </label>
                      <input
                        type="date"
                        className="milestone-date-input"
                        value={localMilestoneDates[milestone.id] || ''}
                        onChange={(e) => handleMilestoneDateChange(milestone.id, e.target.value)}
                      />
                      {(() => {
                        const days = getDaysUntilMilestone(localMilestoneDates[milestone.id]);
                        const urgency = getMilestoneUrgency(localMilestoneDates[milestone.id]);
                        if (days === null) return null;
                        return (
                          <span className={`days-remaining ${urgency}`}>
                            <Clock size={12} />
                            {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `${days}d left`}
                          </span>
                        );
                      })()}
                    </div>
                    <button
                      type="button"
                      className="create-todos-btn"
                      onClick={() => handleCreateTodosFromChecklist(milestone.id)}
                      style={{ '--milestone-color': milestone.color }}
                    >
                      <ListTodo size={14} />
                      Create Tasks from Checklist
                    </button>
                  </div>

                  {/* Checklist Items */}
                  {items.map((item) => {
                    const isChecked = localChecklist[milestone.id]?.[item.id] || false;

                    return (
                      <label key={item.id} className={`checklist-item ${isChecked ? 'checked' : ''}`}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => handleChecklistToggle(milestone.id, item.id, e.target.checked)}
                        />
                        <span
                          className="custom-checkbox"
                          style={{
                            borderColor: isChecked ? milestone.color : '#cbd5e1',
                            background: isChecked ? milestone.color : 'transparent',
                          }}
                        >
                          {isChecked && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          )}
                        </span>
                        <span className="checklist-item-label">{item.label}</span>
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
  );
});

export default MilestoneTracker;
