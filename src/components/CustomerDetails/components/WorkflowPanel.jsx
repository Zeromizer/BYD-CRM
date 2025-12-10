import { useState, useEffect } from 'react';
import {
  Workflow,
  FileSignature,
  Calendar,
  MessageSquare,
  Play,
  CheckCircle,
  Clock,
  AlertCircle,
  Settings,
  ChevronDown,
  ChevronUp,
  Loader2
} from 'lucide-react';
import workflowService, {
  isWorkflowEnabled,
  triggerDocumentSigning,
  triggerAppointmentConfirmation,
  triggerFollowUp,
  getWorkflowHistory,
  saveWorkflowToHistory,
  WORKFLOW_TYPES,
  WORKFLOW_STATUS
} from '../../../services/workflowService';
import './WorkflowPanel.css';

// Status badge component
function StatusBadge({ status }) {
  const statusConfig = {
    [WORKFLOW_STATUS.PENDING]: { icon: Clock, color: 'gray', label: 'Pending' },
    [WORKFLOW_STATUS.IN_PROGRESS]: { icon: Loader2, color: 'blue', label: 'In Progress' },
    [WORKFLOW_STATUS.WAITING_RESPONSE]: { icon: Clock, color: 'yellow', label: 'Waiting' },
    [WORKFLOW_STATUS.COMPLETED]: { icon: CheckCircle, color: 'green', label: 'Completed' },
    [WORKFLOW_STATUS.FAILED]: { icon: AlertCircle, color: 'red', label: 'Failed' }
  };

  const config = statusConfig[status] || statusConfig[WORKFLOW_STATUS.PENDING];
  const Icon = config.icon;

  return (
    <span className={`workflow-status-badge status-${config.color}`}>
      <Icon size={12} className={status === WORKFLOW_STATUS.IN_PROGRESS ? 'spinning' : ''} />
      {config.label}
    </span>
  );
}

// Workflow card component
function WorkflowCard({ workflow, customer, onTrigger, isLoading }) {
  const [expanded, setExpanded] = useState(false);
  const [customMessage, setCustomMessage] = useState('');

  const handleTrigger = () => {
    onTrigger(workflow.type, { message: customMessage });
  };

  return (
    <div className="workflow-card">
      <div className="workflow-card-header" onClick={() => setExpanded(!expanded)}>
        <div className="workflow-info">
          <workflow.icon size={20} className="workflow-icon" />
          <div>
            <h4>{workflow.title}</h4>
            <p>{workflow.description}</p>
          </div>
        </div>
        <div className="workflow-actions">
          <button
            className="btn-trigger"
            onClick={(e) => {
              e.stopPropagation();
              handleTrigger();
            }}
            disabled={isLoading || !isWorkflowEnabled()}
          >
            {isLoading ? <Loader2 size={16} className="spinning" /> : <Play size={16} />}
            Trigger
          </button>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {expanded && (
        <div className="workflow-card-body">
          <div className="workflow-field">
            <label>Custom Message (optional)</label>
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder={workflow.messagePlaceholder}
              rows={2}
            />
          </div>
          <div className="workflow-preview">
            <strong>Will send to:</strong> {customer.phone || 'No phone number'}
          </div>
        </div>
      )}
    </div>
  );
}

// Main WorkflowPanel component
function WorkflowPanel({ customer }) {
  const [loading, setLoading] = useState({});
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const enabled = isWorkflowEnabled();

  // Available workflows
  const workflows = [
    {
      type: WORKFLOW_TYPES.DOCUMENT_SIGNING,
      icon: FileSignature,
      title: 'Document Signing',
      description: 'Send document for customer signature via WhatsApp',
      messagePlaceholder: 'Hi {name}, please sign your VSA document...'
    },
    {
      type: WORKFLOW_TYPES.APPOINTMENT_CONFIRMATION,
      icon: Calendar,
      title: 'Appointment Confirmation',
      description: 'Confirm test drive or delivery appointment',
      messagePlaceholder: 'Hi {name}, please confirm your appointment...'
    },
    {
      type: WORKFLOW_TYPES.FOLLOW_UP,
      icon: MessageSquare,
      title: 'AI Follow-up',
      description: 'Start AI-powered conversation to follow up with customer',
      messagePlaceholder: 'Hi {name}, just checking in...'
    }
  ];

  // Load workflow history
  useEffect(() => {
    if (customer?.id) {
      setHistory(getWorkflowHistory(customer.id));
    }
  }, [customer?.id]);

  // Listen for workflow callbacks
  useEffect(() => {
    const handleCallback = (event) => {
      const { customerId, workflowType, status, result } = event.detail;
      if (customerId === customer?.id) {
        setHistory(getWorkflowHistory(customer.id));
        if (status === WORKFLOW_STATUS.COMPLETED) {
          setSuccess(`${workflowType} workflow completed successfully!`);
        }
      }
    };

    window.addEventListener('workflowCallback', handleCallback);
    return () => window.removeEventListener('workflowCallback', handleCallback);
  }, [customer?.id]);

  // Handle workflow trigger
  const handleTrigger = async (workflowType, options = {}) => {
    if (!customer?.phone) {
      setError('Customer has no phone number');
      return;
    }

    setLoading(prev => ({ ...prev, [workflowType]: true }));
    setError(null);
    setSuccess(null);

    try {
      let result;

      switch (workflowType) {
        case WORKFLOW_TYPES.DOCUMENT_SIGNING:
          result = await triggerDocumentSigning(customer, {
            type: 'VSA',
            name: 'Vehicle Sales Agreement',
            message: options.message
          });
          break;

        case WORKFLOW_TYPES.APPOINTMENT_CONFIRMATION:
          result = await triggerAppointmentConfirmation(customer, {
            type: customer.checklist?.currentMilestone === 'test_drive' ? 'test_drive' : 'delivery',
            date: customer.vsa_deliveryDate || 'TBD',
            time: '10:00 AM',
            message: options.message
          });
          break;

        case WORKFLOW_TYPES.FOLLOW_UP:
          result = await triggerFollowUp(customer, {
            type: 'general',
            message: options.message,
            aiEnabled: true
          });
          break;

        default:
          throw new Error(`Unknown workflow type: ${workflowType}`);
      }

      // Save to history
      saveWorkflowToHistory(customer.id, result);
      setHistory(getWorkflowHistory(customer.id));
      setSuccess(`${workflowType.replace('_', ' ')} workflow triggered successfully!`);

    } catch (err) {
      console.error('Workflow trigger failed:', err);
      setError(err.message);
    } finally {
      setLoading(prev => ({ ...prev, [workflowType]: false }));
    }
  };

  if (!customer) {
    return null;
  }

  return (
    <div className="workflow-panel">
      <div className="workflow-panel-header">
        <div className="header-title">
          <Workflow size={20} />
          <h3>Automated Workflows</h3>
        </div>
        {!enabled && (
          <div className="setup-required">
            <Settings size={14} />
            <span>Configure in Settings</span>
          </div>
        )}
      </div>

      {/* Success/Error Messages */}
      {error && (
        <div className="workflow-alert error">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}
      {success && (
        <div className="workflow-alert success">
          <CheckCircle size={16} />
          <span>{success}</span>
          <button onClick={() => setSuccess(null)}>×</button>
        </div>
      )}

      {/* Workflow Cards */}
      <div className="workflow-list">
        {workflows.map(workflow => (
          <WorkflowCard
            key={workflow.type}
            workflow={workflow}
            customer={customer}
            onTrigger={handleTrigger}
            isLoading={loading[workflow.type]}
          />
        ))}
      </div>

      {/* Workflow History */}
      <div className="workflow-history-section">
        <button
          className="history-toggle"
          onClick={() => setShowHistory(!showHistory)}
        >
          <Clock size={16} />
          <span>Workflow History ({history.length})</span>
          {showHistory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showHistory && (
          <div className="workflow-history">
            {history.length === 0 ? (
              <p className="no-history">No workflow history yet</p>
            ) : (
              history.slice(0, 10).map((execution, idx) => (
                <div key={idx} className="history-item">
                  <div className="history-info">
                    <span className="history-type">
                      {execution.workflowType?.replace('_', ' ')}
                    </span>
                    <span className="history-time">
                      {new Date(execution.triggeredAt).toLocaleString()}
                    </span>
                  </div>
                  <StatusBadge status={execution.status} />
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default WorkflowPanel;
