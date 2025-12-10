import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageCircle,
  Send,
  Paperclip,
  Sparkles,
  Clock,
  Check,
  CheckCheck,
  AlertCircle,
  FileText,
  Image,
  Settings,
  ChevronDown,
  RefreshCw,
  Zap
} from 'lucide-react';
import useWhatsappStore, { useWhatsappActions } from '../../../stores/useWhatsappStore';
import useAuthStore from '../../../stores/useAuthStore';
import whatsappService, {
  isWhatsAppEnabled,
  sendTextMessage,
  sendDocument,
  fillTemplate,
  getMessageTemplates,
  MESSAGE_STATUS
} from '../../../services/whatsappService';
import aiSecretaryService, {
  composeMessage,
  generateDocumentSummary,
  suggestFollowUps,
  AI_PERSONALITIES,
  MESSAGE_CONTEXTS
} from '../../../services/aiSecretaryService';
import { isGeminiAvailable } from '../../../services/geminiService';
import './WhatsappTab.css';

// Status icon component
function StatusIcon({ status }) {
  switch (status) {
    case MESSAGE_STATUS.SENT:
      return <Check size={14} className="status-icon status-sent" />;
    case MESSAGE_STATUS.DELIVERED:
      return <CheckCheck size={14} className="status-icon status-delivered" />;
    case MESSAGE_STATUS.READ:
      return <CheckCheck size={14} className="status-icon status-read" />;
    case MESSAGE_STATUS.FAILED:
      return <AlertCircle size={14} className="status-icon status-failed" />;
    case MESSAGE_STATUS.PENDING:
    default:
      return <Clock size={14} className="status-icon status-pending" />;
  }
}

// Message bubble component
function MessageBubble({ message }) {
  const isOutgoing = message.direction === 'outgoing';
  const time = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className={`message-bubble ${isOutgoing ? 'outgoing' : 'incoming'}`}>
      {message.aiGenerated && (
        <div className="ai-badge">
          <Sparkles size={10} />
          <span>AI</span>
        </div>
      )}

      {message.type === 'document' && (
        <div className="message-attachment">
          <FileText size={20} />
          <span>{message.filename || 'Document'}</span>
        </div>
      )}

      {message.type === 'image' && (
        <div className="message-attachment">
          <Image size={20} />
          <span>Image</span>
        </div>
      )}

      <p className="message-text">{message.body || message.caption}</p>

      <div className="message-meta">
        <span className="message-time">{time}</span>
        {isOutgoing && <StatusIcon status={message.status} />}
      </div>
    </div>
  );
}

// Template selector component
function TemplateSelector({ customer, onSelect, onClose }) {
  const templates = getMessageTemplates();

  const handleSelect = (templateKey) => {
    const filled = fillTemplate(templateKey, customer);
    onSelect(filled, templateKey);
    onClose();
  };

  return (
    <div className="template-selector">
      <div className="template-selector-header">
        <h4>Quick Templates</h4>
        <button className="btn-close-small" onClick={onClose}>×</button>
      </div>
      <div className="template-list">
        {Object.entries(templates).map(([key, template]) => (
          <button
            key={key}
            className="template-item"
            onClick={() => handleSelect(key)}
          >
            <span className="template-name">
              {key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
            </span>
            <span className="template-preview">
              {template.substring(0, 50)}...
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// AI Composer component
function AIComposer({ customer, onCompose, onClose, isComposing }) {
  const [messageType, setMessageType] = useState('general');
  const [personality, setPersonality] = useState('professional');
  const [additionalPrompt, setAdditionalPrompt] = useState('');

  const handleCompose = async () => {
    try {
      const result = await composeMessage({
        customer,
        messageType,
        personality,
        userPrompt: additionalPrompt
      });
      onCompose(result);
    } catch (error) {
      console.error('AI composition failed:', error);
    }
  };

  return (
    <div className="ai-composer">
      <div className="ai-composer-header">
        <Sparkles size={18} />
        <h4>AI Message Composer</h4>
        <button className="btn-close-small" onClick={onClose}>×</button>
      </div>

      <div className="ai-composer-body">
        <div className="composer-field">
          <label>Message Type</label>
          <select
            value={messageType}
            onChange={(e) => setMessageType(e.target.value)}
          >
            {Object.entries(MESSAGE_CONTEXTS).map(([key, ctx]) => (
              <option key={key} value={key}>{ctx.name}</option>
            ))}
          </select>
        </div>

        <div className="composer-field">
          <label>Tone</label>
          <select
            value={personality}
            onChange={(e) => setPersonality(e.target.value)}
          >
            {Object.entries(AI_PERSONALITIES).map(([key, p]) => (
              <option key={key} value={key}>{p.name} - {p.description}</option>
            ))}
          </select>
        </div>

        <div className="composer-field">
          <label>Additional Instructions (optional)</label>
          <textarea
            value={additionalPrompt}
            onChange={(e) => setAdditionalPrompt(e.target.value)}
            placeholder="E.g., Mention the upcoming promotion, ask about trade-in..."
            rows={2}
          />
        </div>

        <button
          className="btn btn-ai-compose"
          onClick={handleCompose}
          disabled={isComposing}
        >
          {isComposing ? (
            <>
              <RefreshCw size={16} className="spinning" />
              Composing...
            </>
          ) : (
            <>
              <Sparkles size={16} />
              Generate Message
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// Main WhatsApp Tab component
function WhatsappTab({ customer }) {
  const { email, isSignedIn } = useAuthStore();
  const {
    getConversation,
    addMessage,
    setPendingMessage,
    setAIComposing,
    setAISuggestions,
    setSending,
    initializeWhatsapp,
    syncFromDrive
  } = useWhatsappActions();

  const [message, setMessage] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAIComposer, setShowAIComposer] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [followUpSuggestions, setFollowUpSuggestions] = useState(null);
  const [error, setError] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const conversation = getConversation(customer?.id);
  const whatsappEnabled = isWhatsAppEnabled();
  const aiAvailable = isGeminiAvailable();

  // Initialize on mount
  useEffect(() => {
    initializeWhatsapp(email);
    if (isSignedIn) {
      syncFromDrive(email);
    }
  }, [email, isSignedIn]);

  // Load follow-up suggestions
  useEffect(() => {
    if (customer && aiAvailable) {
      suggestFollowUps(customer).then(setFollowUpSuggestions).catch(console.error);
    }
  }, [customer?.id, customer?.checklist?.currentMilestone]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation.messages]);

  // Handle sending message
  const handleSend = useCallback(async () => {
    if (!message.trim() || !customer?.phone) return;

    setIsSending(true);
    setError(null);

    try {
      // Add message to local conversation first
      const localMessage = addMessage(
        customer.id,
        {
          type: 'text',
          body: message,
          direction: 'outgoing',
          status: MESSAGE_STATUS.PENDING
        },
        email,
        isSignedIn
      );

      // Try to send via WhatsApp API
      if (whatsappEnabled) {
        await sendTextMessage(customer.phone, message);
        // Update status to sent (would normally be done via webhook)
      }

      setMessage('');
      inputRef.current?.focus();
    } catch (err) {
      setError(err.message || 'Failed to send message');
      console.error('Send error:', err);
    } finally {
      setIsSending(false);
    }
  }, [message, customer, email, isSignedIn, whatsappEnabled, addMessage]);

  // Handle AI compose result
  const handleAICompose = useCallback((result) => {
    setMessage(result.message);
    setAISuggestions(result.suggestions || []);
    setShowAIComposer(false);
    setIsComposing(false);
    inputRef.current?.focus();
  }, [setAISuggestions]);

  // Handle template selection
  const handleTemplateSelect = useCallback((text, templateKey) => {
    setMessage(text);
    inputRef.current?.focus();
  }, []);

  // Handle key press (Enter to send)
  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  if (!customer) {
    return (
      <div className="whatsapp-tab">
        <div className="empty-state">
          <MessageCircle size={48} />
          <p>Select a customer to view messages</p>
        </div>
      </div>
    );
  }

  return (
    <div className="whatsapp-tab">
      {/* Header */}
      <div className="whatsapp-header">
        <div className="wa-customer-info">
          <div className="wa-customer-avatar">
            {customer.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="wa-customer-details">
            <h3>{customer.name}</h3>
            <span className="wa-customer-phone">{customer.phone || 'No phone'}</span>
          </div>
        </div>

        <div className="header-actions">
          {!whatsappEnabled && (
            <div className="setup-badge" title="WhatsApp not configured">
              <Settings size={14} />
              <span>Setup Required</span>
            </div>
          )}
        </div>
      </div>

      {/* Follow-up Suggestions Bar */}
      {followUpSuggestions && followUpSuggestions.suggestions?.length > 0 && (
        <div className="suggestions-bar">
          <div className="suggestions-header">
            <Zap size={14} />
            <span>Suggested Actions</span>
          </div>
          <div className="suggestions-list">
            {followUpSuggestions.suggestions.slice(0, 3).map((suggestion, idx) => (
              <button
                key={idx}
                className={`suggestion-chip priority-${suggestion.priority}`}
                onClick={() => {
                  if (suggestion.type === 'message') {
                    setShowAIComposer(true);
                  }
                }}
              >
                {suggestion.type === 'document' ? <FileText size={12} /> : <MessageCircle size={12} />}
                {suggestion.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="messages-container">
        {conversation.messages.length === 0 ? (
          <div className="no-messages">
            <MessageCircle size={32} />
            <p>No messages yet</p>
            <span>Start a conversation with {customer.name}</span>
          </div>
        ) : (
          conversation.messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error Banner */}
      {error && (
        <div className="error-banner">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Template Selector Popup */}
      {showTemplates && (
        <div className="popup-overlay" onClick={() => setShowTemplates(false)}>
          <div className="popup-content" onClick={(e) => e.stopPropagation()}>
            <TemplateSelector
              customer={customer}
              onSelect={handleTemplateSelect}
              onClose={() => setShowTemplates(false)}
            />
          </div>
        </div>
      )}

      {/* AI Composer Popup */}
      {showAIComposer && (
        <div className="popup-overlay" onClick={() => setShowAIComposer(false)}>
          <div className="popup-content" onClick={(e) => e.stopPropagation()}>
            <AIComposer
              customer={customer}
              onCompose={handleAICompose}
              onClose={() => setShowAIComposer(false)}
              isComposing={isComposing}
            />
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="input-area">
        <div className="input-actions">
          <button
            className="btn-icon"
            onClick={() => setShowTemplates(!showTemplates)}
            title="Quick Templates"
          >
            <ChevronDown size={20} />
          </button>

          <button
            className="btn-icon"
            title="Attach Document"
            disabled={!whatsappEnabled}
          >
            <Paperclip size={20} />
          </button>

          {aiAvailable && (
            <button
              className="btn-icon btn-ai"
              onClick={() => setShowAIComposer(true)}
              title="AI Compose"
            >
              <Sparkles size={20} />
            </button>
          )}
        </div>

        <div className="input-wrapper">
          <textarea
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={customer.phone ? "Type a message..." : "Add customer phone number first"}
            disabled={!customer.phone}
            rows={1}
          />
        </div>

        <button
          className="btn-send"
          onClick={handleSend}
          disabled={!message.trim() || isSending || !customer.phone}
          title="Send Message"
        >
          {isSending ? (
            <RefreshCw size={20} className="spinning" />
          ) : (
            <Send size={20} />
          )}
        </button>
      </div>

      {/* Setup Required Notice */}
      {!whatsappEnabled && (
        <div className="setup-notice">
          <Settings size={20} />
          <div>
            <strong>WhatsApp API not configured</strong>
            <p>Messages will be saved locally. Configure WhatsApp Business API in Settings to send messages.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default WhatsappTab;
