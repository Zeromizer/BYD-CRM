import { useState, useEffect } from 'react';
import Modal from '../Modal/Modal';
import { getGeminiApiKey, setGeminiApiKey, isGeminiAvailable } from '../../services/geminiService';
import {
  getWhatsAppConfig,
  setWhatsAppConfig,
  isWhatsAppEnabled,
  WHATSAPP_PROVIDERS,
  initializeWhatsAppService
} from '../../services/whatsappService';
import './SettingsModal.css';

/**
 * Settings Modal
 * Allows users to configure app settings like API keys
 */
function SettingsModal({ isOpen, onClose }) {
  // Gemini AI state
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  // WhatsApp state
  const [whatsappProvider, setWhatsappProvider] = useState('');
  const [whatsappEnabled, setWhatsappEnabledState] = useState(false);
  const [twilioAccountSid, setTwilioAccountSid] = useState('');
  const [twilioAuthToken, setTwilioAuthToken] = useState('');
  const [twilioFromNumber, setTwilioFromNumber] = useState('');
  const [metaPhoneNumberId, setMetaPhoneNumberId] = useState('');
  const [metaAccessToken, setMetaAccessToken] = useState('');
  const [dialogApiKey, setDialogApiKey] = useState('');
  const [showWhatsappSecrets, setShowWhatsappSecrets] = useState(false);

  // UI state
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [activeTab, setActiveTab] = useState('ai'); // 'ai' or 'whatsapp'

  // Load current settings when modal opens
  useEffect(() => {
    if (isOpen) {
      // Load Gemini API key
      const currentKey = getGeminiApiKey();
      setApiKey(currentKey || '');

      // Load WhatsApp config
      const waConfig = getWhatsAppConfig();
      setWhatsappProvider(waConfig.provider || '');
      setWhatsappEnabledState(waConfig.enabled || false);

      // Twilio
      setTwilioAccountSid(waConfig.twilio?.accountSid || '');
      setTwilioAuthToken(waConfig.twilio?.authToken || '');
      setTwilioFromNumber(waConfig.twilio?.fromNumber || '');

      // Meta
      setMetaPhoneNumberId(waConfig.meta?.phoneNumberId || '');
      setMetaAccessToken(waConfig.meta?.accessToken || '');

      // 360dialog
      setDialogApiKey(waConfig.threesixtyDialog?.apiKey || '');

      setMessage(null);
    }
  }, [isOpen]);

  // Save Gemini settings
  const handleSaveGemini = async () => {
    setSaving(true);
    setMessage(null);

    try {
      await setGeminiApiKey(apiKey.trim() || null);
      setMessage({ type: 'success', text: 'Gemini API key saved!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save: ' + error.message });
    } finally {
      setSaving(false);
    }
  };

  // Save WhatsApp settings
  const handleSaveWhatsApp = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const config = getWhatsAppConfig();

      config.provider = whatsappProvider || null;
      config.enabled = whatsappEnabled && !!whatsappProvider;

      // Update provider-specific settings
      config.twilio = {
        accountSid: twilioAccountSid.trim(),
        authToken: twilioAuthToken.trim(),
        fromNumber: twilioFromNumber.trim()
      };

      config.meta = {
        phoneNumberId: metaPhoneNumberId.trim(),
        accessToken: metaAccessToken.trim(),
        businessAccountId: config.meta?.businessAccountId || '',
        webhookVerifyToken: config.meta?.webhookVerifyToken || ''
      };

      config.threesixtyDialog = {
        apiKey: dialogApiKey.trim(),
        channelId: config.threesixtyDialog?.channelId || ''
      };

      await setWhatsAppConfig(config);
      await initializeWhatsAppService();

      setMessage({ type: 'success', text: 'WhatsApp settings saved!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save: ' + error.message });
    } finally {
      setSaving(false);
    }
  };

  // Test WhatsApp connection
  const handleTestConnection = async () => {
    setMessage({ type: 'info', text: 'Testing connection...' });

    // For now, just validate that required fields are filled
    let isValid = false;
    let errorMsg = '';

    switch (whatsappProvider) {
      case WHATSAPP_PROVIDERS.TWILIO:
        isValid = !!(twilioAccountSid && twilioAuthToken && twilioFromNumber);
        errorMsg = 'Please fill in Account SID, Auth Token, and From Number';
        break;
      case WHATSAPP_PROVIDERS.META_CLOUD:
        isValid = !!(metaPhoneNumberId && metaAccessToken);
        errorMsg = 'Please fill in Phone Number ID and Access Token';
        break;
      case WHATSAPP_PROVIDERS.THREESIXTY_DIALOG:
        isValid = !!dialogApiKey;
        errorMsg = 'Please fill in API Key';
        break;
      default:
        errorMsg = 'Please select a provider first';
    }

    if (isValid) {
      setMessage({ type: 'success', text: 'Configuration looks valid! Save to enable.' });
    } else {
      setMessage({ type: 'error', text: errorMsg });
    }
  };

  const handleClearGemini = async () => {
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

  const isGeminiConfigured = isGeminiAvailable();
  const isWhatsappConfigured = isWhatsAppEnabled();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings" size="medium">
      <div className="settings-modal">
        {/* Tab Navigation */}
        <div className="settings-tabs">
          <button
            className={`settings-tab ${activeTab === 'ai' ? 'active' : ''}`}
            onClick={() => { setActiveTab('ai'); setMessage(null); }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
              <path d="M2 17l10 5 10-5"></path>
              <path d="M2 12l10 5 10-5"></path>
            </svg>
            AI Scanner
          </button>
          <button
            className={`settings-tab ${activeTab === 'whatsapp' ? 'active' : ''}`}
            onClick={() => { setActiveTab('whatsapp'); setMessage(null); }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
            </svg>
            WhatsApp
          </button>
        </div>

        {/* AI Scanner Tab */}
        {activeTab === 'ai' && (
          <section className="settings-section">
            <h3 className="settings-section-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                <path d="M2 17l10 5 10-5"></path>
                <path d="M2 12l10 5 10-5"></path>
              </svg>
              AI ID Scanner (Gemini)
            </h3>

            <div className="settings-description">
              <p>
                Configure Google Gemini AI for accurate ID card scanning.
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
                  {showKey ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div className="settings-status">
              <span className={`status-indicator ${isGeminiConfigured ? 'active' : 'inactive'}`}>
                {isGeminiConfigured ? 'AI Scanner Active' : 'AI Scanner Inactive'}
              </span>
            </div>

            {message && (
              <div className={`settings-message ${message.type}`}>
                {message.text}
              </div>
            )}

            <div className="settings-actions">
              <button
                className="btn btn-secondary"
                onClick={handleClearGemini}
                disabled={saving || !apiKey}
              >
                Clear Key
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveGemini}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </section>
        )}

        {/* WhatsApp Tab */}
        {activeTab === 'whatsapp' && (
          <section className="settings-section">
            <h3 className="settings-section-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
              </svg>
              WhatsApp Business API
            </h3>

            <div className="settings-description">
              <p>
                Connect your WhatsApp Business API to send messages and documents to customers.
              </p>
            </div>

            {/* Enable Toggle */}
            <div className="settings-field">
              <label className="settings-checkbox-label">
                <input
                  type="checkbox"
                  checked={whatsappEnabled}
                  onChange={(e) => setWhatsappEnabledState(e.target.checked)}
                  disabled={saving}
                />
                <span>Enable WhatsApp Integration</span>
              </label>
            </div>

            {/* Provider Selection */}
            <div className="settings-field">
              <label htmlFor="whatsapp-provider">API Provider</label>
              <select
                id="whatsapp-provider"
                value={whatsappProvider}
                onChange={(e) => setWhatsappProvider(e.target.value)}
                className="settings-select"
                disabled={saving}
              >
                <option value="">Select a provider...</option>
                <option value={WHATSAPP_PROVIDERS.TWILIO}>Twilio (Recommended)</option>
                <option value={WHATSAPP_PROVIDERS.META_CLOUD}>Meta Cloud API (Direct)</option>
                <option value={WHATSAPP_PROVIDERS.THREESIXTY_DIALOG}>360dialog</option>
              </select>
            </div>

            {/* Twilio Settings */}
            {whatsappProvider === WHATSAPP_PROVIDERS.TWILIO && (
              <div className="provider-settings">
                <div className="provider-header">
                  <span className="provider-badge twilio">Twilio</span>
                  <a href="https://console.twilio.com" target="_blank" rel="noopener noreferrer" className="provider-link">
                    Open Console →
                  </a>
                </div>

                <div className="settings-field">
                  <label htmlFor="twilio-sid">Account SID</label>
                  <input
                    id="twilio-sid"
                    type="text"
                    value={twilioAccountSid}
                    onChange={(e) => setTwilioAccountSid(e.target.value)}
                    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="settings-input"
                    disabled={saving}
                  />
                </div>

                <div className="settings-field">
                  <label htmlFor="twilio-token">Auth Token</label>
                  <div className="api-key-input-container">
                    <input
                      id="twilio-token"
                      type={showWhatsappSecrets ? 'text' : 'password'}
                      value={twilioAuthToken}
                      onChange={(e) => setTwilioAuthToken(e.target.value)}
                      placeholder="Your auth token..."
                      className="settings-input"
                      disabled={saving}
                    />
                    <button
                      type="button"
                      className="toggle-visibility-btn"
                      onClick={() => setShowWhatsappSecrets(!showWhatsappSecrets)}
                    >
                      {showWhatsappSecrets ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                <div className="settings-field">
                  <label htmlFor="twilio-from">WhatsApp From Number</label>
                  <input
                    id="twilio-from"
                    type="text"
                    value={twilioFromNumber}
                    onChange={(e) => setTwilioFromNumber(e.target.value)}
                    placeholder="whatsapp:+14155238886"
                    className="settings-input"
                    disabled={saving}
                  />
                  <span className="field-hint">Sandbox: whatsapp:+14155238886</span>
                </div>
              </div>
            )}

            {/* Meta Cloud API Settings */}
            {whatsappProvider === WHATSAPP_PROVIDERS.META_CLOUD && (
              <div className="provider-settings">
                <div className="provider-header">
                  <span className="provider-badge meta">Meta Cloud API</span>
                  <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="provider-link">
                    Open Developer →
                  </a>
                </div>

                <div className="settings-field">
                  <label htmlFor="meta-phone-id">Phone Number ID</label>
                  <input
                    id="meta-phone-id"
                    type="text"
                    value={metaPhoneNumberId}
                    onChange={(e) => setMetaPhoneNumberId(e.target.value)}
                    placeholder="Enter Phone Number ID..."
                    className="settings-input"
                    disabled={saving}
                  />
                </div>

                <div className="settings-field">
                  <label htmlFor="meta-token">Access Token</label>
                  <div className="api-key-input-container">
                    <input
                      id="meta-token"
                      type={showWhatsappSecrets ? 'text' : 'password'}
                      value={metaAccessToken}
                      onChange={(e) => setMetaAccessToken(e.target.value)}
                      placeholder="Your access token..."
                      className="settings-input"
                      disabled={saving}
                    />
                    <button
                      type="button"
                      className="toggle-visibility-btn"
                      onClick={() => setShowWhatsappSecrets(!showWhatsappSecrets)}
                    >
                      {showWhatsappSecrets ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 360dialog Settings */}
            {whatsappProvider === WHATSAPP_PROVIDERS.THREESIXTY_DIALOG && (
              <div className="provider-settings">
                <div className="provider-header">
                  <span className="provider-badge dialog">360dialog</span>
                  <a href="https://hub.360dialog.com" target="_blank" rel="noopener noreferrer" className="provider-link">
                    Open Hub →
                  </a>
                </div>

                <div className="settings-field">
                  <label htmlFor="dialog-key">API Key</label>
                  <div className="api-key-input-container">
                    <input
                      id="dialog-key"
                      type={showWhatsappSecrets ? 'text' : 'password'}
                      value={dialogApiKey}
                      onChange={(e) => setDialogApiKey(e.target.value)}
                      placeholder="Your 360dialog API key..."
                      className="settings-input"
                      disabled={saving}
                    />
                    <button
                      type="button"
                      className="toggle-visibility-btn"
                      onClick={() => setShowWhatsappSecrets(!showWhatsappSecrets)}
                    >
                      {showWhatsappSecrets ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="settings-status">
              <span className={`status-indicator ${isWhatsappConfigured ? 'active' : 'inactive'}`}>
                {isWhatsappConfigured ? 'WhatsApp Connected' : 'WhatsApp Not Configured'}
              </span>
            </div>

            {message && (
              <div className={`settings-message ${message.type}`}>
                {message.text}
              </div>
            )}

            <div className="settings-actions">
              <button
                className="btn btn-secondary"
                onClick={handleTestConnection}
                disabled={saving || !whatsappProvider}
              >
                Test
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveWhatsApp}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </section>
        )}
      </div>
    </Modal>
  );
}

export default SettingsModal;
