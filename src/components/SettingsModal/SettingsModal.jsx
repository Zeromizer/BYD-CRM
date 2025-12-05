import { useState, useEffect } from 'react';
import Modal from '../Modal/Modal';
import { getGeminiApiKey, setGeminiApiKey, isGeminiAvailable } from '../../services/geminiService';
import './SettingsModal.css';

/**
 * Settings Modal
 * Allows users to configure app settings like API keys
 */
function SettingsModal({ isOpen, onClose }) {
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [message, setMessage] = useState(null);

  // Load current API key when modal opens
  useEffect(() => {
    if (isOpen) {
      const currentKey = getGeminiApiKey();
      setApiKey(currentKey || '');
      setMessage(null);
    }
  }, [isOpen]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      await setGeminiApiKey(apiKey.trim() || null);
      setMessage({ type: 'success', text: 'API key saved and synced to cloud!' });

      // Close modal after a brief delay
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save: ' + error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!apiKey) return;

    if (window.confirm('Are you sure you want to remove the API key?')) {
      setSaving(true);
      try {
        await setGeminiApiKey(null);
        setApiKey('');
        setMessage({ type: 'success', text: 'API key removed' });
      } catch (error) {
        setMessage({ type: 'error', text: 'Failed to clear: ' + error.message });
      } finally {
        setSaving(false);
      }
    }
  };

  const isConfigured = isGeminiAvailable();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings" size="medium">
      <div className="settings-modal">
        <section className="settings-section">
          <h3 className="settings-section-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
              <path d="M2 17l10 5 10-5"></path>
              <path d="M2 12l10 5 10-5"></path>
            </svg>
            AI ID Scanner
          </h3>

          <div className="settings-description">
            <p>
              Configure Google Gemini AI for accurate ID card scanning.
              The AI model provides faster and more accurate text extraction compared to traditional OCR.
            </p>
            <p className="settings-note">
              Get a free API key from{' '}
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">
                Google AI Studio
              </a>
            </p>
          </div>

          <div className="settings-field">
            <label htmlFor="gemini-api-key">Gemini API Key</label>
            <div className="api-key-input-container">
              <input
                id="gemini-api-key"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your Gemini API key..."
                className="settings-input"
                disabled={saving}
              />
              <button
                type="button"
                className="toggle-visibility-btn"
                onClick={() => setShowKey(!showKey)}
                title={showKey ? 'Hide API key' : 'Show API key'}
              >
                {showKey ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="settings-status">
            <span className={`status-indicator ${isConfigured ? 'active' : 'inactive'}`}>
              {isConfigured ? 'AI Scanner Active' : 'AI Scanner Inactive (using OCR fallback)'}
            </span>
          </div>

          {message && (
            <div className={`settings-message ${message.type}`}>
              {message.text}
            </div>
          )}
        </section>

        <div className="settings-actions">
          <button
            className="btn btn-secondary"
            onClick={handleClear}
            disabled={saving || !apiKey}
          >
            Clear Key
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default SettingsModal;
