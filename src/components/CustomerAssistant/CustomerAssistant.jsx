/**
 * Customer Assistant Dashboard
 *
 * Main dashboard for AI-powered customer messaging.
 * Features click-to-send via WhatsApp Web, AI message generation,
 * and comprehensive action tracking.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  MessageCircle,
  Send,
  Sparkles,
  RefreshCw,
  Filter,
  Clock,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Users,
  Calendar,
  Zap,
  SkipForward,
  Edit3,
  ExternalLink,
  Copy,
  Check,
  Bell,
  Settings,
  History,
  FileText,
} from 'lucide-react';
import useCustomerStore, { useCustomers } from '../../stores/useCustomerStore';
import useCustomerAssistantStore, {
  useAssistantActions,
  useIsGenerating,
  ACTION_STATUS,
} from '../../stores/useCustomerAssistantStore';
import useAuthStore from '../../stores/useAuthStore';
import {
  generateMessage,
  generateWhatsAppUrl,
  openWhatsApp,
  generateActionsForAllCustomers,
  AI_PERSONALITIES,
} from '../../services/customerAssistantService';
import { logMessageSent, logMessageQueued } from '../../services/activityLogService';
import { MESSAGE_PRIORITY, MESSAGE_FRAMEWORK, MILESTONES } from '../../constants/customerAssistantConfig';
import { MILESTONES as MILESTONE_CONFIG } from '../../constants/milestones';
import './CustomerAssistant.css';

/**
 * Priority Badge Component
 */
function PriorityBadge({ priority }) {
  const config = {
    [MESSAGE_PRIORITY.URGENT]: { label: 'Urgent', className: 'priority-urgent' },
    [MESSAGE_PRIORITY.HIGH]: { label: 'High', className: 'priority-high' },
    [MESSAGE_PRIORITY.MEDIUM]: { label: 'Medium', className: 'priority-medium' },
    [MESSAGE_PRIORITY.LOW]: { label: 'Low', className: 'priority-low' },
  };

  const { label, className } = config[priority] || config[MESSAGE_PRIORITY.MEDIUM];

  return <span className={`priority-badge ${className}`}>{label}</span>;
}

/**
 * Milestone Badge Component
 */
function MilestoneBadge({ milestoneId }) {
  const milestone = MILESTONE_CONFIG.find(m => m.id === milestoneId);
  if (!milestone) return null;

  return (
    <span
      className="milestone-badge"
      style={{ backgroundColor: milestone.color }}
    >
      {milestone.shortName}
    </span>
  );
}

/**
 * Action Card Component
 */
function ActionCard({
  action,
  isSelected,
  isGenerating,
  onSelect,
  onGenerate,
  onSend,
  onSkip,
  onEdit,
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedMessage, setEditedMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (action.generatedMessage) {
      navigator.clipboard.writeText(action.generatedMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [action.generatedMessage]);

  const handleEdit = useCallback(() => {
    setEditedMessage(action.generatedMessage || '');
    setEditMode(true);
  }, [action.generatedMessage]);

  const handleSaveEdit = useCallback(() => {
    onEdit(action.id, editedMessage);
    setEditMode(false);
  }, [action.id, editedMessage, onEdit]);

  const handleCancelEdit = useCallback(() => {
    setEditMode(false);
    setEditedMessage('');
  }, []);

  return (
    <div
      className={`action-card ${isSelected ? 'selected' : ''} ${action.status === ACTION_STATUS.READY ? 'ready' : ''}`}
      onClick={() => onSelect(action.id)}
    >
      <div className="action-card-header">
        <div className="action-customer-info">
          <div className="customer-avatar">
            {action.customerName?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="customer-details">
            <h4>{action.customerName}</h4>
            <span className="customer-phone">{action.customerPhone || 'No phone'}</span>
          </div>
        </div>
        <div className="action-badges">
          <MilestoneBadge milestoneId={action.milestoneId} />
          <PriorityBadge priority={action.priority} />
        </div>
      </div>

      <div className="action-card-body">
        <div className="action-type">
          <MessageCircle size={14} />
          <span>{action.messageConfig?.title || 'Message'}</span>
        </div>

        {action.generatedMessage && !editMode && (
          <div className="generated-message">
            <p>{action.generatedMessage}</p>
          </div>
        )}

        {editMode && (
          <div className="edit-message">
            <textarea
              value={editedMessage}
              onChange={(e) => setEditedMessage(e.target.value)}
              rows={4}
              autoFocus
            />
            <div className="edit-actions">
              <button className="btn-small btn-secondary" onClick={handleCancelEdit}>
                Cancel
              </button>
              <button className="btn-small btn-primary" onClick={handleSaveEdit}>
                Save
              </button>
            </div>
          </div>
        )}

        {!action.generatedMessage && !isGenerating && (
          <div className="no-message">
            <Sparkles size={16} />
            <span>Click generate to create a personalized message</span>
          </div>
        )}

        {isGenerating && (
          <div className="generating">
            <RefreshCw size={16} className="spinning" />
            <span>Generating message...</span>
          </div>
        )}
      </div>

      <div className="action-card-footer">
        {!action.generatedMessage ? (
          <button
            className="btn-action btn-generate"
            onClick={(e) => {
              e.stopPropagation();
              onGenerate(action);
            }}
            disabled={isGenerating}
          >
            <Sparkles size={16} />
            Generate
          </button>
        ) : (
          <>
            <div className="message-actions">
              <button
                className="btn-icon-small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopy();
                }}
                title="Copy message"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
              <button
                className="btn-icon-small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit();
                }}
                title="Edit message"
              >
                <Edit3 size={14} />
              </button>
              <button
                className="btn-icon-small"
                onClick={(e) => {
                  e.stopPropagation();
                  onGenerate(action);
                }}
                title="Regenerate"
                disabled={isGenerating}
              >
                <RefreshCw size={14} />
              </button>
            </div>
            <div className="send-actions">
              <button
                className="btn-action btn-skip"
                onClick={(e) => {
                  e.stopPropagation();
                  onSkip(action.id);
                }}
              >
                <SkipForward size={16} />
                Skip
              </button>
              <button
                className="btn-action btn-send"
                onClick={(e) => {
                  e.stopPropagation();
                  onSend(action);
                }}
                disabled={!action.customerPhone}
              >
                <Send size={16} />
                Send via WhatsApp
                <ExternalLink size={12} />
              </button>
            </div>
          </>
        )}
      </div>

      {action.messageConfig?.documents?.length > 0 && (
        <div className="action-documents">
          <FileText size={12} />
          <span>Related: {action.messageConfig.documents.join(', ')}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Stats Bar Component
 */
function StatsBar({ counts }) {
  return (
    <div className="stats-bar">
      <div className="stat-item stat-urgent">
        <AlertCircle size={16} />
        <span className="stat-value">{counts.urgent || 0}</span>
        <span className="stat-label">Urgent</span>
      </div>
      <div className="stat-item stat-pending">
        <Clock size={16} />
        <span className="stat-value">{counts.pending || 0}</span>
        <span className="stat-label">Pending</span>
      </div>
      <div className="stat-item stat-ready">
        <Zap size={16} />
        <span className="stat-value">{counts.ready || 0}</span>
        <span className="stat-label">Ready</span>
      </div>
      <div className="stat-item stat-sent">
        <CheckCircle size={16} />
        <span className="stat-value">{counts.sentToday || 0}</span>
        <span className="stat-label">Sent Today</span>
      </div>
    </div>
  );
}

/**
 * Filter Bar Component
 */
function FilterBar({ filters, onFilterChange, milestones }) {
  return (
    <div className="filter-bar">
      <div className="filter-group">
        <label>Milestone:</label>
        <select
          value={filters.milestone}
          onChange={(e) => onFilterChange({ milestone: e.target.value })}
        >
          <option value="all">All Stages</option>
          {milestones.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label>Priority:</label>
        <select
          value={filters.priority}
          onChange={(e) => onFilterChange({ priority: e.target.value })}
        >
          <option value="all">All Priorities</option>
          <option value={MESSAGE_PRIORITY.URGENT}>Urgent</option>
          <option value={MESSAGE_PRIORITY.HIGH}>High</option>
          <option value={MESSAGE_PRIORITY.MEDIUM}>Medium</option>
          <option value={MESSAGE_PRIORITY.LOW}>Low</option>
        </select>
      </div>
    </div>
  );
}

/**
 * Empty State Component
 */
function EmptyState({ hasCustomers, onRefresh }) {
  if (!hasCustomers) {
    return (
      <div className="empty-state">
        <Users size={48} />
        <h3>No Customers Yet</h3>
        <p>Add customers to start using the Customer Assistant</p>
      </div>
    );
  }

  return (
    <div className="empty-state">
      <CheckCircle size={48} />
      <h3>All Caught Up!</h3>
      <p>No pending actions for your customers</p>
      <button className="btn-primary" onClick={onRefresh}>
        <RefreshCw size={16} />
        Refresh Actions
      </button>
    </div>
  );
}

/**
 * Main Customer Assistant Component
 */
function CustomerAssistant() {
  const customers = useCustomers();
  const { isSignedIn } = useAuthStore();
  const { isGenerating, generatingActionId } = useIsGenerating();

  const {
    initialize,
    addAction,
    updateAction,
    setGeneratedMessage,
    markAsSent,
    markAsSkipped,
    setGenerating,
    setFilters,
    selectAction,
    getFilteredActions,
    getActionCounts,
    hasExistingAction,
    bulkAddActions,
  } = useAssistantActions();

  const filters = useCustomerAssistantStore(state => state.filters);
  const actionQueue = useCustomerAssistantStore(state => state.actionQueue);
  const selectedActionId = useCustomerAssistantStore(state => state.selectedActionId);

  const [personality, setPersonality] = useState('professional');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Initialize store on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Get filtered actions and counts
  const filteredActions = useMemo(() => getFilteredActions(), [actionQueue, filters]);
  const counts = useMemo(() => {
    const baseCounts = getActionCounts();
    const urgentCount = actionQueue.filter(a => a.priority === MESSAGE_PRIORITY.URGENT).length;
    return { ...baseCounts, urgent: urgentCount };
  }, [actionQueue, getActionCounts]);

  /**
   * Refresh actions - generate new actions based on customer state
   */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);

    try {
      // Generate actions for all active customers
      const newActions = generateActionsForAllCustomers(customers);

      // Filter out actions that already exist
      const actionsToAdd = newActions.filter(
        action => !hasExistingAction(action.customerId, action.messageId)
      );

      if (actionsToAdd.length > 0) {
        bulkAddActions(actionsToAdd);
      }
    } catch (error) {
      console.error('Failed to refresh actions:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [customers, hasExistingAction, bulkAddActions]);

  /**
   * Generate message for an action
   */
  const handleGenerate = useCallback(async (action) => {
    if (!action.messageConfig) return;

    const customer = customers.find(c => c.id === action.customerId);
    if (!customer) return;

    setGenerating(true, action.id);

    try {
      const result = await generateMessage(customer, action.messageConfig, {
        personality,
      });

      setGeneratedMessage(action.id, result.message, result.suggestions);

      // Log the activity
      logMessageQueued(customer.id, action.messageConfig.id, result.message);
    } catch (error) {
      console.error('Failed to generate message:', error);
    } finally {
      setGenerating(false, null);
    }
  }, [customers, personality, setGenerating, setGeneratedMessage]);

  /**
   * Send message via WhatsApp Web
   */
  const handleSend = useCallback((action) => {
    if (!action.customerPhone || !action.generatedMessage) return;

    const customer = customers.find(c => c.id === action.customerId);

    // Open WhatsApp Web
    const opened = openWhatsApp(action.customerPhone, action.generatedMessage);

    if (opened) {
      // Mark as sent
      markAsSent(action.id);

      // Log the activity
      if (customer) {
        logMessageSent(
          customer.id,
          action.messageConfig?.id || 'manual',
          action.generatedMessage,
          'whatsapp_web'
        );
      }
    }
  }, [customers, markAsSent]);

  /**
   * Skip an action
   */
  const handleSkip = useCallback((actionId) => {
    markAsSkipped(actionId, 'User skipped');
  }, [markAsSkipped]);

  /**
   * Edit message
   */
  const handleEdit = useCallback((actionId, newMessage) => {
    updateAction(actionId, {
      generatedMessage: newMessage,
      editedAt: new Date().toISOString(),
    });
  }, [updateAction]);

  return (
    <div className="customer-assistant">
      {/* Header */}
      <div className="assistant-header">
        <div className="header-title">
          <MessageCircle size={24} />
          <h1>Customer Assistant</h1>
        </div>
        <div className="header-actions">
          <div className="personality-selector">
            <label>Tone:</label>
            <select
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
            >
              {Object.entries(AI_PERSONALITIES).map(([key, config]) => (
                <option key={key} value={key}>{config.name}</option>
              ))}
            </select>
          </div>
          <button
            className="btn-refresh"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw size={16} className={isRefreshing ? 'spinning' : ''} />
            {isRefreshing ? 'Refreshing...' : 'Refresh Actions'}
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <StatsBar counts={counts} />

      {/* Filter Bar */}
      <FilterBar
        filters={filters}
        onFilterChange={setFilters}
        milestones={MILESTONE_CONFIG}
      />

      {/* Action Queue */}
      <div className="action-queue">
        {filteredActions.length === 0 ? (
          <EmptyState
            hasCustomers={customers.length > 0}
            onRefresh={handleRefresh}
          />
        ) : (
          <div className="action-list">
            {filteredActions.map(action => (
              <ActionCard
                key={action.id}
                action={action}
                isSelected={selectedActionId === action.id}
                isGenerating={isGenerating && generatingActionId === action.id}
                onSelect={selectAction}
                onGenerate={handleGenerate}
                onSend={handleSend}
                onSkip={handleSkip}
                onEdit={handleEdit}
              />
            ))}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="assistant-instructions">
        <h4>How it works:</h4>
        <ol>
          <li><strong>Refresh Actions</strong> - Scan customers and generate suggested messages</li>
          <li><strong>Generate</strong> - AI creates a personalized message based on customer context</li>
          <li><strong>Review & Edit</strong> - Review the message and make any adjustments</li>
          <li><strong>Send via WhatsApp</strong> - Opens WhatsApp Web with the message pre-filled</li>
          <li><strong>Press Send</strong> - In WhatsApp, press send to deliver the message</li>
        </ol>
      </div>
    </div>
  );
}

export default CustomerAssistant;
