import { useState, useEffect, memo, useCallback } from 'react';
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
import {
  REQUIRED_DOCUMENTS,
  DOCUMENT_STATUS,
} from '../../constants/documentRequirements';
import { Car, Handshake, ClipboardCheck, Package, Star, Calendar, Clock, ListTodo, FileText, Upload, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { SaveButton } from '../AnimatedButton/AnimatedButton';
import './MilestoneTracker.css';

/**
 * MilestoneTracker - Status Checklist Component
 *
 * ARCHITECTURE:
 * - This component manages the customer's Status Checklist (the source of truth)
 * - Uses local state for editing, saved on explicit "Save" action
 * - "Create Tasks from Checklist" creates todos linked to checklist items
 * - Todos linked to this checklist will automatically reflect completion status
 */

const iconComponents = { Car, Handshake, ClipboardCheck, Package, Star };

const getMilestoneIcon = (iconName, size = 16, color = 'currentColor') => {
  const IconComponent = iconComponents[iconName];
  return IconComponent ? <IconComponent size={size} color={color} strokeWidth={2} /> : null;
};

const MilestoneTracker = memo(function MilestoneTracker({ customer, onSave }) {
  const { updateCustomer, saveToLocalStorage, saveCustomerToFolder } = useCustomerStore();
  const { isSignedIn, userEmail } = useAuthStore();
  const { addTodo, todos } = useTodoStore();

  const [expandedMilestone, setExpandedMilestone] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingTodos, setIsCreatingTodos] = useState(false);

  // Local state for editing (saved on explicit action)
  const [localChecklist, setLocalChecklist] = useState(() => customer?.checklist || getDefaultChecklistState());
  const [localMilestoneDates, setLocalMilestoneDates] = useState(() => customer?.milestoneDates || getDefaultMilestoneDates());
  const [hasChanges, setHasChanges] = useState(false);

  // Reset local state when customer changes
  useEffect(() => {
    setLocalChecklist(customer?.checklist || getDefaultChecklistState());
    setLocalMilestoneDates(customer?.milestoneDates || getDefaultMilestoneDates());
    setHasChanges(false);
  }, [customer?.id]);

  const currentMilestone = localChecklist.currentMilestone || 'test_drive';

  // Auto-expand current milestone on first render
  useEffect(() => {
    if (!expandedMilestone) {
      setExpandedMilestone(currentMilestone);
    }
  }, [currentMilestone, expandedMilestone]);

  const handleMilestoneClick = useCallback((milestoneId) => {
    setExpandedMilestone((prev) => (prev === milestoneId ? null : milestoneId));
  }, []);

  const handleSetCurrentMilestone = useCallback((milestoneId) => {
    setLocalChecklist((prev) => ({ ...prev, currentMilestone: milestoneId }));
    setHasChanges(true);
  }, []);

  const handleChecklistToggle = useCallback((milestoneId, itemId, checked) => {
    setLocalChecklist((prev) => ({
      ...prev,
      [milestoneId]: { ...(prev[milestoneId] || {}), [itemId]: checked },
    }));
    setHasChanges(true);
  }, []);

  const handleMilestoneDateChange = useCallback((milestoneId, date) => {
    setLocalMilestoneDates((prev) => ({ ...prev, [milestoneId]: date || null }));
    setHasChanges(true);
  }, []);

  // Create todos from uncompleted checklist items
  const handleCreateTodosFromChecklist = useCallback(
    (milestoneId) => {
      if (isCreatingTodos) return;

      const items = CHECKLISTS[milestoneId] || [];
      const milestone = MILESTONES.find((m) => m.id === milestoneId);
      const milestoneDate = localMilestoneDates[milestoneId];

      // Get uncompleted items
      const uncompletedItems = items.filter((item) => !localChecklist[milestoneId]?.[item.id]);

      if (uncompletedItems.length === 0) {
        alert('All checklist items are already completed!');
        return;
      }

      // Check for existing todos to prevent duplicates
      const existingTodos = todos.filter(
        (t) => t.customerId === customer?.id && t.milestoneId === milestoneId && !t.completed
      );
      const existingTexts = new Set(existingTodos.map((t) => t.text));

      const itemsToCreate = uncompletedItems.filter((item) => {
        const todoText = `${milestone?.name}: ${item.label}`;
        return !existingTexts.has(todoText);
      });

      if (itemsToCreate.length === 0) {
        alert('Tasks already exist for all uncompleted checklist items.');
        return;
      }

      setIsCreatingTodos(true);

      itemsToCreate.forEach((item) => {
        addTodo(
          {
            text: `${milestone?.name}: ${item.label}`,
            priority: milestoneDate ? 'high' : 'medium',
            dueDate: milestoneDate || null,
            customerId: customer?.id || null,
            customerName: customer?.name || null,
            milestoneId: milestoneId,
            checklistItemId: item.id,
          },
          userEmail,
          isSignedIn
        );
      });

      setIsCreatingTodos(false);
      alert(`Created ${itemsToCreate.length} task(s) for ${milestone?.name}`);
    },
    [isCreatingTodos, localChecklist, localMilestoneDates, todos, customer, addTodo, userEmail, isSignedIn]
  );

  // Save changes to store and sync
  const handleSaveChanges = useCallback(async () => {
    if (!customer || !hasChanges) return;

    setIsSaving(true);
    try {
      updateCustomer(customer.id, {
        checklist: localChecklist,
        milestoneDates: localMilestoneDates,
      });
      saveToLocalStorage();

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
  }, [customer, hasChanges, localChecklist, localMilestoneDates, updateCustomer, saveToLocalStorage, isSignedIn, saveCustomerToFolder, onSave]);

  // Cancel and revert
  const handleCancel = useCallback(() => {
    setLocalChecklist(customer?.checklist || getDefaultChecklistState());
    setLocalMilestoneDates(customer?.milestoneDates || getDefaultMilestoneDates());
    setHasChanges(false);
  }, [customer]);

  return (
    <div className="milestone-tracker">
      {/* Save/Cancel Actions Bar */}
      {hasChanges && (
        <div className="milestone-actions-bar animate-fadeInDown">
          <span className="unsaved-indicator">You have unsaved changes</span>
          <div className="milestone-actions-buttons">
            <button className="btn btn-secondary" onClick={handleCancel} disabled={isSaving}>
              Cancel
            </button>
            <SaveButton
              onClick={handleSaveChanges}
              isSubmitting={isSaving}
              hasChanges={hasChanges}
            >
              Save Changes
            </SaveButton>
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
                style={{ '--milestone-color': milestone.color }}
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
                  <span className="checklist-title" style={{ color: isCurrent ? milestone.color : undefined }}>
                    {milestone.name}
                  </span>
                  {isCurrent && (
                    <span className="current-badge" style={{ background: milestone.color }}>
                      Current
                    </span>
                  )}
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
                      disabled={isCreatingTodos}
                      style={{ '--milestone-color': milestone.color }}
                    >
                      <ListTodo size={14} />
                      {isCreatingTodos ? 'Creating...' : 'Create Tasks from Checklist'}
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

                  {/* Document Status Section */}
                  {REQUIRED_DOCUMENTS[milestone.id]?.length > 0 && (
                    <div className="milestone-documents-section">
                      <div className="milestone-documents-header">
                        <FileText size={14} />
                        <span>Required Documents</span>
                      </div>
                      <div className="milestone-documents-list">
                        {REQUIRED_DOCUMENTS[milestone.id].map((doc) => {
                          const docState = customer?.documentChecklist?.[milestone.id]?.[doc.id];
                          const status = docState?.status || DOCUMENT_STATUS.PENDING;
                          const uploadedFiles = docState?.uploadedFiles || [];

                          const getStatusIcon = () => {
                            switch (status) {
                              case DOCUMENT_STATUS.UPLOADED:
                                return <Upload size={12} className="doc-status-icon uploaded" />;
                              case DOCUMENT_STATUS.APPROVED:
                                return <CheckCircle size={12} className="doc-status-icon approved" />;
                              case DOCUMENT_STATUS.REJECTED:
                                return <XCircle size={12} className="doc-status-icon rejected" />;
                              case DOCUMENT_STATUS.EXPIRED:
                                return <AlertCircle size={12} className="doc-status-icon expired" />;
                              default:
                                return <Clock size={12} className="doc-status-icon pending" />;
                            }
                          };

                          return (
                            <div key={doc.id} className={`milestone-doc-item ${status}`}>
                              <div className="milestone-doc-info">
                                {getStatusIcon()}
                                <span className="milestone-doc-name">
                                  {doc.name}
                                  {doc.required && <span className="doc-required">*</span>}
                                </span>
                              </div>
                              {uploadedFiles.length > 0 && (
                                <span className="milestone-doc-count">
                                  {uploadedFiles.length} file{uploadedFiles.length > 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
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
