import { useState, useEffect } from 'react';
import useCustomerStore from '../../stores/useCustomerStore';
import useAuthStore from '../../stores/useAuthStore';
import {
  MILESTONES,
  CHECKLISTS,
  getMilestoneProgress,
  isMilestoneComplete,
  getDefaultChecklistState,
} from '../../constants/milestones';
import './MilestoneTracker.css';

function MilestoneTracker({ customer, onSave }) {
  const { updateCustomer, saveToLocalStorage, saveCustomerToFolder } = useCustomerStore();
  const { isSignedIn } = useAuthStore();
  const [expandedMilestone, setExpandedMilestone] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Local state for editing (not synced until save)
  const [localChecklist, setLocalChecklist] = useState(() => {
    return customer?.checklist || getDefaultChecklistState();
  });

  // Track if there are unsaved changes
  const [hasChanges, setHasChanges] = useState(false);

  // Reset local state when customer changes
  useEffect(() => {
    const newChecklist = customer?.checklist || getDefaultChecklistState();
    setLocalChecklist(newChecklist);
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

  // Save all changes to store and sync
  const handleSaveChanges = async () => {
    if (!customer || !hasChanges) return;

    setIsSaving(true);
    try {
      // Update the customer with new checklist
      updateCustomer(customer.id, { checklist: localChecklist });
      saveToLocalStorage();

      // Sync to Drive if signed in
      if (isSignedIn && customer.driveFolderId) {
        const updatedCustomer = {
          ...customer,
          checklist: localChecklist,
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
    setLocalChecklist(savedChecklist);
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

      {/* Progress Bar */}
      <div className="milestone-progress-container">
        <div className="milestone-progress-bar">
          {MILESTONES.map((milestone, index) => {
            const isComplete = isMilestoneComplete(milestone.id, localChecklist);
            const isCurrent = milestone.id === currentMilestone;
            const isPast = index < currentMilestoneIndex;
            const progress = getMilestoneProgress(milestone.id, localChecklist);

            return (
              <div
                key={milestone.id}
                className={`milestone-step ${isCurrent ? 'current' : ''} ${isComplete ? 'complete' : ''} ${isPast ? 'past' : ''}`}
                onClick={() => handleMilestoneClick(milestone.id)}
              >
                {/* Connector line (except for first item) */}
                {index > 0 && (
                  <div
                    className={`milestone-connector ${isPast || (isCurrent && index <= currentMilestoneIndex) ? 'filled' : ''}`}
                    style={{
                      background: isPast || isComplete
                        ? MILESTONES[index - 1].color
                        : 'var(--color-border-light)',
                    }}
                  />
                )}

                {/* Milestone Circle */}
                <div
                  className={`milestone-circle ${isCurrent ? 'current' : ''} ${isComplete ? 'complete' : ''}`}
                  style={{
                    borderColor: milestone.color,
                    background: isComplete || isCurrent ? milestone.color : 'transparent',
                  }}
                  title={`${milestone.name} - ${progress}% complete`}
                >
                  {isComplete ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  ) : (
                    <span className="milestone-number" style={{ color: isCurrent ? 'white' : milestone.color }}>
                      {index + 1}
                    </span>
                  )}
                </div>

                {/* Milestone Label */}
                <div className="milestone-label">
                  <span
                    className="milestone-name"
                    style={{ color: isCurrent || isComplete ? milestone.color : 'var(--color-text-secondary)' }}
                  >
                    {milestone.name}
                  </span>
                  <span className="milestone-progress-text">{progress}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

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
                {milestone.icon} {milestone.name}
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
                      <span style={{ color: milestone.color }}>{milestone.icon}</span>
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
}

export default MilestoneTracker;
