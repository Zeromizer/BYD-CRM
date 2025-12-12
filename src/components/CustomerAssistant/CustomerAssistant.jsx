/**
 * Customer Assistant Dashboard
 *
 * Main dashboard for AI-powered customer messaging.
 * Features click-to-send via WhatsApp Web, AI message generation,
 * document attachment via shareable links, and comprehensive action tracking.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  MessageCircle,
  Send,
  Sparkles,
  RefreshCw,
  Clock,
  AlertCircle,
  CheckCircle,
  Users,
  Zap,
  SkipForward,
  Edit3,
  ExternalLink,
  Copy,
  Check,
  FileText,
  Paperclip,
  X,
  Folder,
  File,
  Image,
  FileSpreadsheet,
  Loader,
  Plus,
  ChevronDown,
  Trash2,
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
  openWhatsApp,
  generateActionsForAllCustomers,
  AI_PERSONALITIES,
  fillMessageTemplate,
} from '../../services/customerAssistantService';
import { logMessageSent, logMessageQueued } from '../../services/activityLogService';
import { getShareableLink } from '../../services/whatsappDocumentService';
import oneDriveService from '../../services/oneDriveService';
import { MESSAGE_PRIORITY, MESSAGE_FRAMEWORK } from '../../constants/customerAssistantConfig';
import { MILESTONES as MILESTONE_CONFIG } from '../../constants/milestones';
import './CustomerAssistant.css';

/**
 * Get icon for file type
 */
function getFileIcon(filename) {
  const ext = filename?.toLowerCase().split('.').pop();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
    return <Image size={16} />;
  }
  if (['xlsx', 'xls', 'csv'].includes(ext)) {
    return <FileSpreadsheet size={16} />;
  }
  if (ext === 'pdf') {
    return <FileText size={16} />;
  }
  return <File size={16} />;
}

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
 * Document Picker Component
 */
function DocumentPicker({
  isOpen,
  onClose,
  customerId,
  customerFolderId,
  onSelectDocument,
  isSignedIn
}) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [folderPath, setFolderPath] = useState([]);

  // Load documents when picker opens
  useEffect(() => {
    if (isOpen && customerFolderId && isSignedIn) {
      loadDocuments(customerFolderId);
      setCurrentFolder({ id: customerFolderId, name: 'Customer Folder' });
      setFolderPath([{ id: customerFolderId, name: 'Customer Folder' }]);
    }
  }, [isOpen, customerFolderId, isSignedIn]);

  const loadDocuments = async (folderId) => {
    setLoading(true);
    setError(null);
    try {
      const files = await oneDriveService.listFolder(folderId);
      setDocuments(files || []);
    } catch (err) {
      console.error('Failed to load documents:', err);
      setError('Failed to load documents');
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFolderClick = (folder) => {
    setFolderPath([...folderPath, { id: folder.id, name: folder.name }]);
    setCurrentFolder(folder);
    loadDocuments(folder.id);
  };

  const handleBreadcrumbClick = (index) => {
    const newPath = folderPath.slice(0, index + 1);
    setFolderPath(newPath);
    const folder = newPath[newPath.length - 1];
    setCurrentFolder(folder);
    loadDocuments(folder.id);
  };

  const handleSelectFile = async (file) => {
    try {
      setLoading(true);
      // Generate shareable link
      const shareLink = await getShareableLink(file.id);
      onSelectDocument({
        id: file.id,
        name: file.name,
        shareLink,
      });
      onClose();
    } catch (err) {
      console.error('Failed to get shareable link:', err);
      setError('Failed to create shareable link');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="document-picker-overlay" onClick={onClose}>
      <div className="document-picker" onClick={(e) => e.stopPropagation()}>
        <div className="document-picker-header">
          <h3><Paperclip size={18} /> Attach Document</h3>
          <button className="btn-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Breadcrumb navigation */}
        <div className="document-picker-breadcrumb">
          {folderPath.map((folder, index) => (
            <span key={folder.id}>
              {index > 0 && <span className="breadcrumb-separator">/</span>}
              <button
                className="breadcrumb-item"
                onClick={() => handleBreadcrumbClick(index)}
              >
                {folder.name}
              </button>
            </span>
          ))}
        </div>

        <div className="document-picker-content">
          {!isSignedIn ? (
            <div className="picker-message">
              <AlertCircle size={24} />
              <p>Please connect to OneDrive to access documents</p>
            </div>
          ) : !customerFolderId ? (
            <div className="picker-message">
              <Folder size={24} />
              <p>No folder found for this customer</p>
            </div>
          ) : loading ? (
            <div className="picker-message">
              <Loader size={24} className="spinning" />
              <p>Loading documents...</p>
            </div>
          ) : error ? (
            <div className="picker-message picker-error">
              <AlertCircle size={24} />
              <p>{error}</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="picker-message">
              <FileText size={24} />
              <p>No documents in this folder</p>
            </div>
          ) : (
            <ul className="document-list">
              {/* Folders first */}
              {documents.filter(d => d.folder).map((folder) => (
                <li
                  key={folder.id}
                  className="document-item folder-item"
                  onClick={() => handleFolderClick(folder)}
                >
                  <Folder size={18} />
                  <span className="document-name">{folder.name}</span>
                </li>
              ))}
              {/* Then files */}
              {documents.filter(d => !d.folder).map((file) => (
                <li
                  key={file.id}
                  className="document-item file-item"
                  onClick={() => handleSelectFile(file)}
                >
                  {getFileIcon(file.name)}
                  <span className="document-name">{file.name}</span>
                  <span className="document-size">
                    {file.size ? `${(file.size / 1024).toFixed(1)} KB` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="document-picker-footer">
          <p className="picker-hint">
            Select a document to attach a shareable link to your message
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Compose Message Modal Component
 */
function ComposeMessageModal({
  isOpen,
  onClose,
  customers,
  isSignedIn,
  personality,
}) {
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedMessageType, setSelectedMessageType] = useState('');
  const [message, setMessage] = useState('');
  const [attachedDocuments, setAttachedDocuments] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showDocPicker, setShowDocPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Get selected customer
  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId);
  }, [customers, selectedCustomerId]);

  // Filter customers based on search
  const filteredCustomers = useMemo(() => {
    if (!searchQuery) return customers.filter(c => !c.archiveStatus);
    const query = searchQuery.toLowerCase();
    return customers.filter(c =>
      !c.archiveStatus &&
      (c.name?.toLowerCase().includes(query) || c.phone?.includes(query))
    );
  }, [customers, searchQuery]);

  // Get message templates for selected customer's milestone
  const messageTemplates = useMemo(() => {
    if (!selectedCustomer) return [];
    const milestone = selectedCustomer.checklist?.currentMilestone || 'test_drive';
    const milestoneConfig = MESSAGE_FRAMEWORK[milestone];
    if (!milestoneConfig) return [];
    return milestoneConfig.messages.map(m => ({
      id: m.id,
      title: m.title,
      template: m.template,
      config: m,
    }));
  }, [selectedCustomer]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedCustomerId('');
      setSelectedMessageType('');
      setMessage('');
      setAttachedDocuments([]);
      setSearchQuery('');
    }
  }, [isOpen]);

  // Handle AI message generation
  const handleGenerate = async () => {
    if (!selectedCustomer) return;

    setIsGenerating(true);
    try {
      // Find message config
      const messageConfig = messageTemplates.find(m => m.id === selectedMessageType)?.config;

      if (messageConfig) {
        const result = await generateMessage(selectedCustomer, messageConfig, { personality });
        setMessage(result.message);
      } else {
        // Generate a general message
        const generalConfig = {
          title: 'General Message',
          description: 'A general follow-up message',
          template: `Hi {customerName}! Hope you're doing well. Just checking in regarding your ${selectedCustomer.vsa_makeModel || selectedCustomer.proposal_model || 'BYD'} journey. Let me know if you have any questions!`,
          aiContext: 'Generate a friendly, professional follow-up message for this customer based on their current stage.',
        };
        const result = await generateMessage(selectedCustomer, generalConfig, { personality });
        setMessage(result.message);
      }

      // Log activity
      logMessageQueued(selectedCustomer.id, selectedMessageType || 'manual', message);
    } catch (error) {
      console.error('Failed to generate message:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle document selection
  const handleDocumentSelect = (doc) => {
    if (!attachedDocuments.some(d => d.id === doc.id)) {
      setAttachedDocuments([...attachedDocuments, doc]);
    }
  };

  // Handle document removal
  const handleRemoveDocument = (docId) => {
    setAttachedDocuments(attachedDocuments.filter(d => d.id !== docId));
  };

  // Build full message with attachments
  const fullMessage = useMemo(() => {
    let msg = message;
    if (attachedDocuments.length > 0) {
      msg += '\n\n📎 Documents:';
      attachedDocuments.forEach((doc) => {
        msg += `\n• ${doc.name}: ${doc.shareLink}`;
      });
    }
    return msg;
  }, [message, attachedDocuments]);

  // Handle send
  const handleSend = () => {
    if (!selectedCustomer?.phone || !message) return;

    const opened = openWhatsApp(selectedCustomer.phone, fullMessage);

    if (opened) {
      // Log activity
      logMessageSent(
        selectedCustomer.id,
        selectedMessageType || 'manual',
        fullMessage,
        'whatsapp_web'
      );
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="compose-modal-overlay" onClick={onClose}>
      <div className="compose-modal" onClick={(e) => e.stopPropagation()}>
        <div className="compose-modal-header">
          <h2><Plus size={20} /> Compose Message</h2>
          <button className="btn-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="compose-modal-body">
          {/* Customer Selector */}
          <div className="compose-field">
            <label>Select Customer</label>
            <div className="customer-selector">
              <input
                type="text"
                placeholder="Search customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="customer-search"
              />
              {!selectedCustomer ? (
                <div className="customer-list-dropdown">
                  {filteredCustomers.length === 0 ? (
                    <div className="no-customers">No customers found</div>
                  ) : (
                    filteredCustomers.slice(0, 10).map(customer => (
                      <div
                        key={customer.id}
                        className="customer-option"
                        onClick={() => {
                          setSelectedCustomerId(customer.id);
                          setSearchQuery('');
                        }}
                      >
                        <div className="customer-option-avatar">
                          {customer.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div className="customer-option-info">
                          <span className="customer-option-name">{customer.name}</span>
                          <span className="customer-option-phone">{customer.phone || 'No phone'}</span>
                        </div>
                        <MilestoneBadge milestoneId={customer.checklist?.currentMilestone} />
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="selected-customer">
                  <div className="customer-option selected">
                    <div className="customer-option-avatar">
                      {selectedCustomer.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="customer-option-info">
                      <span className="customer-option-name">{selectedCustomer.name}</span>
                      <span className="customer-option-phone">{selectedCustomer.phone || 'No phone'}</span>
                    </div>
                    <MilestoneBadge milestoneId={selectedCustomer.checklist?.currentMilestone} />
                    <button
                      className="btn-clear-customer"
                      onClick={() => setSelectedCustomerId('')}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Message Type Selector (optional) */}
          {selectedCustomer && messageTemplates.length > 0 && (
            <div className="compose-field">
              <label>Message Type (optional)</label>
              <select
                value={selectedMessageType}
                onChange={(e) => setSelectedMessageType(e.target.value)}
              >
                <option value="">Custom Message</option>
                {messageTemplates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Message Input */}
          <div className="compose-field">
            <label>
              Message
              {selectedCustomer && (
                <button
                  className="btn-generate-inline"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                >
                  <Sparkles size={14} />
                  {isGenerating ? 'Generating...' : 'AI Generate'}
                </button>
              )}
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={selectedCustomer ? "Type your message or click 'AI Generate'..." : "Select a customer first..."}
              rows={6}
              disabled={!selectedCustomer}
            />
          </div>

          {/* Attach Documents */}
          {selectedCustomer && (
            <div className="compose-field">
              <label>Attachments</label>
              <div className="compose-attachments">
                {attachedDocuments.map((doc) => (
                  <div key={doc.id} className="attached-doc">
                    <Paperclip size={12} />
                    <span>{doc.name}</span>
                    <button
                      className="btn-remove-doc"
                      onClick={() => handleRemoveDocument(doc.id)}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <button
                  className="btn-attach"
                  onClick={() => setShowDocPicker(true)}
                  disabled={!isSignedIn || !selectedCustomer?.driveFolderId}
                >
                  <Paperclip size={14} />
                  Attach File
                </button>
              </div>
              {!isSignedIn && (
                <p className="attach-hint">Connect to OneDrive to attach files</p>
              )}
            </div>
          )}

          {/* Preview */}
          {message && (
            <div className="compose-field">
              <label>Preview</label>
              <div className="message-preview">
                <p>{fullMessage}</p>
              </div>
            </div>
          )}
        </div>

        <div className="compose-modal-footer">
          <button className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-send-compose"
            onClick={handleSend}
            disabled={!selectedCustomer?.phone || !message}
          >
            <Send size={16} />
            Send via WhatsApp
            <ExternalLink size={12} />
          </button>
        </div>

        {/* Document Picker */}
        <DocumentPicker
          isOpen={showDocPicker}
          onClose={() => setShowDocPicker(false)}
          customerId={selectedCustomerId}
          customerFolderId={selectedCustomer?.driveFolderId}
          onSelectDocument={handleDocumentSelect}
          isSignedIn={isSignedIn}
        />
      </div>
    </div>
  );
}

/**
 * Action Card Component
 */
function ActionCard({
  action,
  customer,
  isSelected,
  isGenerating,
  isSignedIn,
  onSelect,
  onGenerate,
  onSend,
  onSkip,
  onEdit,
  onAttachDocument,
}) {
  const [editMode, setEditMode] = useState(false);
  const [editedMessage, setEditedMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [showDocPicker, setShowDocPicker] = useState(false);

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

  const handleDocumentSelect = useCallback((doc) => {
    onAttachDocument(action.id, doc);
  }, [action.id, onAttachDocument]);

  // Build display message with attachments
  const displayMessage = useMemo(() => {
    let msg = action.generatedMessage || '';
    if (action.attachedDocuments?.length > 0) {
      msg += '\n\n📎 Attached Documents:';
      action.attachedDocuments.forEach((doc) => {
        msg += `\n• ${doc.name}: ${doc.shareLink}`;
      });
    }
    return msg;
  }, [action.generatedMessage, action.attachedDocuments]);

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
            <p>{displayMessage}</p>
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

        {/* Attached documents display */}
        {action.attachedDocuments?.length > 0 && !editMode && (
          <div className="attached-documents">
            {action.attachedDocuments.map((doc, index) => (
              <div key={index} className="attached-doc">
                <Paperclip size={12} />
                <span>{doc.name}</span>
              </div>
            ))}
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
                  setShowDocPicker(true);
                }}
                title="Attach document"
                disabled={!isSignedIn || !customer?.driveFolderId}
              >
                <Paperclip size={14} />
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

      {/* Document Picker Modal */}
      <DocumentPicker
        isOpen={showDocPicker}
        onClose={() => setShowDocPicker(false)}
        customerId={action.customerId}
        customerFolderId={customer?.driveFolderId}
        onSelectDocument={handleDocumentSelect}
        isSignedIn={isSignedIn}
      />
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
  const [showComposeModal, setShowComposeModal] = useState(false);

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

  // Create customer lookup map
  const customerMap = useMemo(() => {
    const map = {};
    customers.forEach(c => { map[c.id] = c; });
    return map;
  }, [customers]);

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

    // Build full message with attachments
    let fullMessage = action.generatedMessage;
    if (action.attachedDocuments?.length > 0) {
      fullMessage += '\n\n📎 Documents:';
      action.attachedDocuments.forEach((doc) => {
        fullMessage += `\n• ${doc.name}: ${doc.shareLink}`;
      });
    }

    // Open WhatsApp Web
    const opened = openWhatsApp(action.customerPhone, fullMessage);

    if (opened) {
      // Mark as sent
      markAsSent(action.id);

      // Log the activity
      if (customer) {
        logMessageSent(
          customer.id,
          action.messageConfig?.id || 'manual',
          fullMessage,
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

  /**
   * Attach document to action
   */
  const handleAttachDocument = useCallback((actionId, document) => {
    const action = actionQueue.find(a => a.id === actionId);
    const currentDocs = action?.attachedDocuments || [];

    // Don't add duplicate
    if (currentDocs.some(d => d.id === document.id)) return;

    updateAction(actionId, {
      attachedDocuments: [...currentDocs, document],
    });
  }, [actionQueue, updateAction]);

  return (
    <div className="customer-assistant">
      {/* Header */}
      <div className="assistant-header">
        <div className="header-title">
          <MessageCircle size={24} />
          <h1>Customer Assistant</h1>
        </div>
        <div className="header-actions">
          <button
            className="btn-compose"
            onClick={() => setShowComposeModal(true)}
          >
            <Plus size={16} />
            Compose
          </button>
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
                customer={customerMap[action.customerId]}
                isSelected={selectedActionId === action.id}
                isGenerating={isGenerating && generatingActionId === action.id}
                isSignedIn={isSignedIn}
                onSelect={selectAction}
                onGenerate={handleGenerate}
                onSend={handleSend}
                onSkip={handleSkip}
                onEdit={handleEdit}
                onAttachDocument={handleAttachDocument}
              />
            ))}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="assistant-instructions">
        <h4>How it works:</h4>
        <ol>
          <li><strong>Compose</strong> - Click to manually select a customer and write your message</li>
          <li><strong>Refresh Actions</strong> - Scan customers and generate suggested messages</li>
          <li><strong>Generate</strong> - AI creates a personalized message based on customer context</li>
          <li><strong>Attach Documents</strong> - Click <Paperclip size={12} style={{display: 'inline', verticalAlign: 'middle'}} /> to attach OneDrive files as shareable links</li>
          <li><strong>Send via WhatsApp</strong> - Opens WhatsApp Web with the message pre-filled</li>
        </ol>
      </div>

      {/* Compose Message Modal */}
      <ComposeMessageModal
        isOpen={showComposeModal}
        onClose={() => setShowComposeModal(false)}
        customers={customers}
        isSignedIn={isSignedIn}
        personality={personality}
      />
    </div>
  );
}

export default CustomerAssistant;
