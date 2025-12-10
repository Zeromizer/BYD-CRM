/**
 * WhatsApp Business API Service
 *
 * Handles WhatsApp messaging integration for the BYD CRM.
 * Supports multiple providers: Twilio, 360dialog, or Meta Cloud API direct.
 *
 * Features:
 * - Send text messages to customers
 * - Send document attachments (PDF, Excel, images)
 * - AI-powered message composition via Gemini
 * - Message templates for milestone follow-ups
 * - Configuration synced via OneDrive
 */

import oneDriveService from './oneDriveService';

// Supported WhatsApp API providers
export const WHATSAPP_PROVIDERS = {
  META_CLOUD: 'meta_cloud',      // Direct Meta Cloud API
  TWILIO: 'twilio',              // Twilio WhatsApp API
  THREESIXTY_DIALOG: '360dialog' // 360dialog Business API
};

// LocalStorage keys for offline caching
const STORAGE_KEYS = {
  CONFIG: 'bydcrm_whatsapp_config',
  MESSAGE_QUEUE: 'bydcrm_whatsapp_queue'
};

// Message types
export const MESSAGE_TYPES = {
  TEXT: 'text',
  DOCUMENT: 'document',
  IMAGE: 'image',
  TEMPLATE: 'template'
};

// Message status
export const MESSAGE_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed'
};

// In-memory state
let cachedConfig = null;
let isInitialized = false;
let messageQueue = [];

/**
 * Default configuration structure
 */
const DEFAULT_CONFIG = {
  provider: null,
  enabled: false,
  // Meta Cloud API settings
  meta: {
    phoneNumberId: '',
    accessToken: '',
    businessAccountId: '',
    webhookVerifyToken: ''
  },
  // Twilio settings
  twilio: {
    accountSid: '',
    authToken: '',
    fromNumber: '' // WhatsApp sender number (e.g., whatsapp:+14155238886)
  },
  // 360dialog settings
  threesixtyDialog: {
    apiKey: '',
    channelId: ''
  },
  // AI Secretary settings
  aiSecretary: {
    enabled: true,
    autoRespond: false,
    responseDelay: 5000, // ms delay before auto-response
    personality: 'professional' // professional, friendly, formal
  },
  // Message templates
  templates: {
    test_drive_confirmation: 'Hi {customerName}! Your test drive for the {vehicleModel} is confirmed for {date}. Looking forward to seeing you!',
    test_drive_reminder: 'Hi {customerName}! Just a reminder about your test drive tomorrow. See you at {time}!',
    registration_docs: 'Hi {customerName}! Great news - we\'re processing your {vehicleModel} registration. Please prepare these documents: {documentList}',
    delivery_confirmation: 'Hi {customerName}! 🎉 Your {vehicleModel} is ready for delivery on {date}! We can\'t wait to hand you the keys.',
    delivery_reminder: 'Hi {customerName}! Tomorrow is the big day! Your {vehicleModel} delivery is scheduled for {time}. Any questions, just reply here!',
    nps_followup: 'Hi {customerName}! We hope you\'re enjoying your {vehicleModel}. We\'d love to hear about your experience - your feedback helps us improve!',
    document_sent: 'Hi {customerName}! Please find the attached {documentType}. Let me know if you have any questions.',
    general_followup: 'Hi {customerName}! Just checking in to see how everything is going with your {vehicleModel}. Any questions or concerns?'
  }
};

/**
 * Get WhatsApp configuration
 * @returns {Object} Current configuration
 */
export function getWhatsAppConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }
  // Fallback to localStorage
  const stored = localStorage.getItem(STORAGE_KEYS.CONFIG);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }
  return { ...DEFAULT_CONFIG };
}

/**
 * Save WhatsApp configuration
 * @param {Object} config - Configuration to save
 * @param {boolean} syncToCloud - Whether to sync to OneDrive
 */
export async function setWhatsAppConfig(config, syncToCloud = true) {
  cachedConfig = { ...DEFAULT_CONFIG, ...config };

  // Save to localStorage
  localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(cachedConfig));

  // Sync to OneDrive
  if (syncToCloud && navigator.onLine) {
    try {
      await oneDriveService.updateSetting('whatsappConfig', cachedConfig);
      console.log('WhatsApp config synced to OneDrive');
    } catch (error) {
      console.warn('Failed to sync WhatsApp config to OneDrive:', error);
    }
  }

  return cachedConfig;
}

/**
 * Initialize WhatsApp service
 * Loads configuration from OneDrive
 */
export async function initializeWhatsAppService() {
  if (isInitialized) return;

  try {
    if (navigator.onLine) {
      const settings = await oneDriveService.loadSettings();
      if (settings.whatsappConfig) {
        cachedConfig = { ...DEFAULT_CONFIG, ...settings.whatsappConfig };
        localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(cachedConfig));
        console.log('WhatsApp config loaded from OneDrive');
      }
    }

    // Load message queue from localStorage
    const storedQueue = localStorage.getItem(STORAGE_KEYS.MESSAGE_QUEUE);
    if (storedQueue) {
      messageQueue = JSON.parse(storedQueue);
    }

    isInitialized = true;
  } catch (error) {
    console.warn('Failed to initialize WhatsApp service:', error);
    isInitialized = true;
  }
}

/**
 * Check if WhatsApp is configured and enabled
 * @returns {boolean}
 */
export function isWhatsAppEnabled() {
  const config = getWhatsAppConfig();
  if (!config.enabled || !config.provider) return false;

  switch (config.provider) {
    case WHATSAPP_PROVIDERS.META_CLOUD:
      return !!(config.meta.phoneNumberId && config.meta.accessToken);
    case WHATSAPP_PROVIDERS.TWILIO:
      return !!(config.twilio.accountSid && config.twilio.authToken && config.twilio.fromNumber);
    case WHATSAPP_PROVIDERS.THREESIXTY_DIALOG:
      return !!(config.threesixtyDialog.apiKey);
    default:
      return false;
  }
}

/**
 * Format phone number for WhatsApp
 * Ensures proper international format
 * @param {string} phone - Phone number
 * @returns {string} Formatted phone number
 */
export function formatPhoneForWhatsApp(phone) {
  if (!phone) return '';

  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // Ensure it starts with country code
  if (!cleaned.startsWith('+')) {
    // Assume Singapore if no country code
    if (cleaned.startsWith('65')) {
      cleaned = '+' + cleaned;
    } else if (cleaned.length === 8) {
      // Singapore 8-digit number
      cleaned = '+65' + cleaned;
    } else {
      cleaned = '+' + cleaned;
    }
  }

  return cleaned;
}

/**
 * Build API endpoint based on provider
 * @param {string} provider
 * @param {Object} config
 * @returns {Object} { url, headers }
 */
function getProviderEndpoint(provider, config) {
  switch (provider) {
    case WHATSAPP_PROVIDERS.META_CLOUD:
      return {
        url: `https://graph.facebook.com/v18.0/${config.meta.phoneNumberId}/messages`,
        headers: {
          'Authorization': `Bearer ${config.meta.accessToken}`,
          'Content-Type': 'application/json'
        }
      };

    case WHATSAPP_PROVIDERS.TWILIO:
      const auth = btoa(`${config.twilio.accountSid}:${config.twilio.authToken}`);
      return {
        url: `https://api.twilio.com/2010-04-01/Accounts/${config.twilio.accountSid}/Messages.json`,
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      };

    case WHATSAPP_PROVIDERS.THREESIXTY_DIALOG:
      return {
        url: 'https://waba.360dialog.io/v1/messages',
        headers: {
          'D360-API-KEY': config.threesixtyDialog.apiKey,
          'Content-Type': 'application/json'
        }
      };

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Build message payload based on provider
 * @param {string} provider
 * @param {string} to - Recipient phone number
 * @param {Object} message - Message content
 * @param {Object} config
 * @returns {Object|string} Request body
 */
function buildMessagePayload(provider, to, message, config) {
  const formattedTo = formatPhoneForWhatsApp(to);

  switch (provider) {
    case WHATSAPP_PROVIDERS.META_CLOUD:
    case WHATSAPP_PROVIDERS.THREESIXTY_DIALOG:
      // Both use similar WhatsApp Cloud API format
      const payload = {
        messaging_product: 'whatsapp',
        to: formattedTo.replace('+', ''),
        type: message.type || MESSAGE_TYPES.TEXT
      };

      if (message.type === MESSAGE_TYPES.TEXT) {
        payload.text = { body: message.body };
      } else if (message.type === MESSAGE_TYPES.DOCUMENT) {
        payload.document = {
          link: message.documentUrl,
          caption: message.caption || '',
          filename: message.filename || 'document.pdf'
        };
      } else if (message.type === MESSAGE_TYPES.IMAGE) {
        payload.image = {
          link: message.imageUrl,
          caption: message.caption || ''
        };
      } else if (message.type === MESSAGE_TYPES.TEMPLATE) {
        payload.template = {
          name: message.templateName,
          language: { code: message.languageCode || 'en' },
          components: message.components || []
        };
      }

      return payload;

    case WHATSAPP_PROVIDERS.TWILIO:
      // Twilio uses form-encoded data
      const params = new URLSearchParams();
      params.append('From', config.twilio.fromNumber);
      params.append('To', `whatsapp:${formattedTo}`);

      if (message.type === MESSAGE_TYPES.TEXT) {
        params.append('Body', message.body);
      } else if (message.type === MESSAGE_TYPES.DOCUMENT || message.type === MESSAGE_TYPES.IMAGE) {
        params.append('MediaUrl', message.documentUrl || message.imageUrl);
        if (message.caption) {
          params.append('Body', message.caption);
        }
      }

      return params.toString();

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Send a WhatsApp message
 * @param {string} to - Recipient phone number
 * @param {Object} message - Message object { type, body, documentUrl, caption, filename }
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Send result
 */
export async function sendMessage(to, message, options = {}) {
  const config = getWhatsAppConfig();

  if (!isWhatsAppEnabled()) {
    throw new Error('WhatsApp is not configured. Please set up your WhatsApp API credentials in Settings.');
  }

  const { url, headers } = getProviderEndpoint(config.provider, config);
  const body = buildMessagePayload(config.provider, to, message, config);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: typeof body === 'string' ? body : JSON.stringify(body)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('WhatsApp API error:', result);
      throw new Error(result.error?.message || result.message || 'Failed to send message');
    }

    return {
      success: true,
      messageId: result.messages?.[0]?.id || result.sid || result.messageId,
      timestamp: new Date().toISOString(),
      to,
      message
    };
  } catch (error) {
    console.error('Failed to send WhatsApp message:', error);

    // Queue message for retry if offline
    if (!navigator.onLine) {
      queueMessage(to, message, options);
      return {
        success: false,
        queued: true,
        error: 'Message queued for sending when online'
      };
    }

    throw error;
  }
}

/**
 * Send a text message
 * @param {string} to - Recipient phone number
 * @param {string} text - Message text
 * @returns {Promise<Object>}
 */
export async function sendTextMessage(to, text) {
  return sendMessage(to, {
    type: MESSAGE_TYPES.TEXT,
    body: text
  });
}

/**
 * Send a document attachment
 * @param {string} to - Recipient phone number
 * @param {string} documentUrl - Public URL to the document
 * @param {string} filename - Document filename
 * @param {string} caption - Optional caption
 * @returns {Promise<Object>}
 */
export async function sendDocument(to, documentUrl, filename, caption = '') {
  return sendMessage(to, {
    type: MESSAGE_TYPES.DOCUMENT,
    documentUrl,
    filename,
    caption
  });
}

/**
 * Send an image
 * @param {string} to - Recipient phone number
 * @param {string} imageUrl - Public URL to the image
 * @param {string} caption - Optional caption
 * @returns {Promise<Object>}
 */
export async function sendImage(to, imageUrl, caption = '') {
  return sendMessage(to, {
    type: MESSAGE_TYPES.IMAGE,
    imageUrl,
    caption
  });
}

/**
 * Queue a message for later sending (offline support)
 * @param {string} to
 * @param {Object} message
 * @param {Object} options
 */
function queueMessage(to, message, options = {}) {
  messageQueue.push({
    id: Date.now(),
    to,
    message,
    options,
    createdAt: new Date().toISOString(),
    status: MESSAGE_STATUS.PENDING
  });

  localStorage.setItem(STORAGE_KEYS.MESSAGE_QUEUE, JSON.stringify(messageQueue));
}

/**
 * Process queued messages when back online
 * @returns {Promise<Object[]>} Results for each queued message
 */
export async function processMessageQueue() {
  if (!navigator.onLine || messageQueue.length === 0) {
    return [];
  }

  const results = [];
  const remainingQueue = [];

  for (const queuedMsg of messageQueue) {
    try {
      const result = await sendMessage(queuedMsg.to, queuedMsg.message, queuedMsg.options);
      results.push({ ...queuedMsg, result, status: MESSAGE_STATUS.SENT });
    } catch (error) {
      // Keep failed messages in queue for retry
      remainingQueue.push({ ...queuedMsg, lastError: error.message });
      results.push({ ...queuedMsg, error: error.message, status: MESSAGE_STATUS.FAILED });
    }
  }

  messageQueue = remainingQueue;
  localStorage.setItem(STORAGE_KEYS.MESSAGE_QUEUE, JSON.stringify(messageQueue));

  return results;
}

/**
 * Get pending message queue
 * @returns {Array}
 */
export function getMessageQueue() {
  return [...messageQueue];
}

/**
 * Clear the message queue
 */
export function clearMessageQueue() {
  messageQueue = [];
  localStorage.setItem(STORAGE_KEYS.MESSAGE_QUEUE, JSON.stringify(messageQueue));
}

/**
 * Fill a message template with customer data
 * @param {string} templateKey - Template key from config
 * @param {Object} customer - Customer object
 * @param {Object} extraData - Additional data for placeholders
 * @returns {string} Filled template
 */
export function fillTemplate(templateKey, customer, extraData = {}) {
  const config = getWhatsAppConfig();
  let template = config.templates[templateKey];

  if (!template) {
    console.warn(`Template "${templateKey}" not found`);
    return '';
  }

  // Build replacement map
  const replacements = {
    customerName: customer.name || 'Customer',
    vehicleModel: customer.vsa_vehicleModel || customer.proposal_model || 'your vehicle',
    phone: customer.phone || '',
    email: customer.email || '',
    salesConsultant: customer.salesConsultant || '',
    registrationNo: customer.vsa_registrationNo || '',
    deliveryDate: customer.vsa_deliveryDate || '',
    ...extraData
  };

  // Replace all placeholders
  for (const [key, value] of Object.entries(replacements)) {
    template = template.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '');
  }

  return template;
}

/**
 * Get all available message templates
 * @returns {Object}
 */
export function getMessageTemplates() {
  return getWhatsAppConfig().templates;
}

/**
 * Update a message template
 * @param {string} templateKey
 * @param {string} templateText
 */
export async function updateMessageTemplate(templateKey, templateText) {
  const config = getWhatsAppConfig();
  config.templates[templateKey] = templateText;
  await setWhatsAppConfig(config);
}

// Export default object for convenience
export default {
  // Configuration
  getWhatsAppConfig,
  setWhatsAppConfig,
  initializeWhatsAppService,
  isWhatsAppEnabled,

  // Messaging
  sendMessage,
  sendTextMessage,
  sendDocument,
  sendImage,

  // Queue management
  processMessageQueue,
  getMessageQueue,
  clearMessageQueue,

  // Templates
  fillTemplate,
  getMessageTemplates,
  updateMessageTemplate,

  // Utilities
  formatPhoneForWhatsApp,

  // Constants
  WHATSAPP_PROVIDERS,
  MESSAGE_TYPES,
  MESSAGE_STATUS
};
