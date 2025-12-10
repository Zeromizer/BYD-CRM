/**
 * Workflow Service for n8n Integration
 *
 * Triggers automated workflows via n8n webhooks for:
 * - Document signing requests
 * - Customer follow-ups
 * - Appointment confirmations
 * - AI-powered conversations
 */

import oneDriveService from './oneDriveService';

// LocalStorage key for workflow config
const STORAGE_KEY = 'bydcrm_workflow_config';

// Workflow types
export const WORKFLOW_TYPES = {
  DOCUMENT_SIGNING: 'document_signing',
  APPOINTMENT_CONFIRMATION: 'appointment_confirmation',
  FOLLOW_UP: 'follow_up',
  CUSTOM: 'custom'
};

// Workflow status
export const WORKFLOW_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  WAITING_RESPONSE: 'waiting_response',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

// Default configuration
const DEFAULT_CONFIG = {
  enabled: false,
  n8nBaseUrl: '', // e.g., https://your-instance.app.n8n.cloud
  webhooks: {
    documentSigning: '',
    appointmentConfirmation: '',
    followUp: '',
    custom: ''
  },
  callbackSecret: '', // Secret for validating callbacks from n8n
  defaultTimeout: 86400000 // 24 hours in ms
};

let cachedConfig = null;

/**
 * Get workflow configuration
 */
export function getWorkflowConfig() {
  if (cachedConfig) return cachedConfig;

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }
  return { ...DEFAULT_CONFIG };
}

/**
 * Save workflow configuration
 */
export async function setWorkflowConfig(config, syncToCloud = true) {
  cachedConfig = { ...DEFAULT_CONFIG, ...config };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedConfig));

  if (syncToCloud && navigator.onLine) {
    try {
      await oneDriveService.updateSetting('workflowConfig', cachedConfig);
      console.log('Workflow config synced to OneDrive');
    } catch (error) {
      console.warn('Failed to sync workflow config:', error);
    }
  }

  return cachedConfig;
}

/**
 * Check if workflows are enabled
 */
export function isWorkflowEnabled() {
  const config = getWorkflowConfig();
  return config.enabled && (
    config.webhooks.documentSigning ||
    config.webhooks.appointmentConfirmation ||
    config.webhooks.followUp ||
    config.webhooks.custom
  );
}

/**
 * Trigger a workflow via n8n webhook
 * @param {string} workflowType - Type of workflow to trigger
 * @param {Object} customer - Customer data
 * @param {Object} payload - Additional payload data
 * @returns {Promise<Object>} Workflow execution result
 */
export async function triggerWorkflow(workflowType, customer, payload = {}) {
  const config = getWorkflowConfig();

  if (!config.enabled) {
    throw new Error('Workflows are not enabled. Please configure in Settings.');
  }

  // Get the webhook URL for this workflow type
  let webhookUrl;
  switch (workflowType) {
    case WORKFLOW_TYPES.DOCUMENT_SIGNING:
      webhookUrl = config.webhooks.documentSigning;
      break;
    case WORKFLOW_TYPES.APPOINTMENT_CONFIRMATION:
      webhookUrl = config.webhooks.appointmentConfirmation;
      break;
    case WORKFLOW_TYPES.FOLLOW_UP:
      webhookUrl = config.webhooks.followUp;
      break;
    case WORKFLOW_TYPES.CUSTOM:
      webhookUrl = config.webhooks.custom || payload.webhookUrl;
      break;
    default:
      throw new Error(`Unknown workflow type: ${workflowType}`);
  }

  if (!webhookUrl) {
    throw new Error(`No webhook URL configured for workflow: ${workflowType}`);
  }

  // Build the payload to send to n8n
  const workflowPayload = {
    // Workflow metadata
    workflowType,
    triggeredAt: new Date().toISOString(),
    callbackUrl: payload.callbackUrl || null,

    // Customer information
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      salesConsultant: customer.salesConsultant,
      currentMilestone: customer.checklist?.currentMilestone,
      vehicleModel: customer.vsa_vehicleModel || customer.proposal_model,
      registrationNo: customer.vsa_registrationNo,
      deliveryDate: customer.vsa_deliveryDate
    },

    // Additional data from payload
    ...payload.data
  };

  console.log('Triggering workflow:', { workflowType, webhookUrl, payload: workflowPayload });

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(workflowPayload)
    });

    const responseText = await response.text();
    let result;

    try {
      result = JSON.parse(responseText);
    } catch {
      result = { message: responseText };
    }

    if (!response.ok) {
      throw new Error(result.message || `Workflow trigger failed: ${response.status}`);
    }

    console.log('Workflow triggered successfully:', result);

    return {
      success: true,
      workflowType,
      executionId: result.executionId || result.id || null,
      status: WORKFLOW_STATUS.IN_PROGRESS,
      triggeredAt: workflowPayload.triggeredAt,
      response: result
    };
  } catch (error) {
    console.error('Failed to trigger workflow:', error);
    throw error;
  }
}

/**
 * Trigger document signing workflow
 * @param {Object} customer - Customer data
 * @param {Object} document - Document information
 */
export async function triggerDocumentSigning(customer, document) {
  return triggerWorkflow(WORKFLOW_TYPES.DOCUMENT_SIGNING, customer, {
    data: {
      document: {
        type: document.type, // 'vsa', 'contract', 'insurance', etc.
        name: document.name,
        url: document.url,
        fields: document.fields || [] // Fields to be filled/signed
      },
      message: document.message || `Hi ${customer.name}, please review and sign your ${document.type}.`
    }
  });
}

/**
 * Trigger appointment confirmation workflow
 * @param {Object} customer - Customer data
 * @param {Object} appointment - Appointment details
 */
export async function triggerAppointmentConfirmation(customer, appointment) {
  return triggerWorkflow(WORKFLOW_TYPES.APPOINTMENT_CONFIRMATION, customer, {
    data: {
      appointment: {
        type: appointment.type, // 'test_drive', 'delivery', 'service', etc.
        date: appointment.date,
        time: appointment.time,
        location: appointment.location || 'BYD Showroom',
        notes: appointment.notes
      },
      message: appointment.message || `Hi ${customer.name}, please confirm your ${appointment.type} appointment on ${appointment.date} at ${appointment.time}.`
    }
  });
}

/**
 * Trigger follow-up workflow
 * @param {Object} customer - Customer data
 * @param {Object} options - Follow-up options
 */
export async function triggerFollowUp(customer, options = {}) {
  return triggerWorkflow(WORKFLOW_TYPES.FOLLOW_UP, customer, {
    data: {
      followUpType: options.type || 'general',
      reason: options.reason || 'Regular check-in',
      message: options.message,
      aiEnabled: options.aiEnabled !== false, // Enable AI responses by default
      maxMessages: options.maxMessages || 10,
      objectives: options.objectives || ['Check customer satisfaction', 'Answer questions']
    }
  });
}

/**
 * Handle callback from n8n when workflow completes
 * This would be called via a webhook endpoint
 * @param {Object} callbackData - Data from n8n
 */
export function handleWorkflowCallback(callbackData) {
  const { workflowType, customerId, status, result } = callbackData;

  console.log('Workflow callback received:', callbackData);

  // Dispatch event for UI to handle
  window.dispatchEvent(new CustomEvent('workflowCallback', {
    detail: {
      workflowType,
      customerId,
      status,
      result,
      timestamp: new Date().toISOString()
    }
  }));

  return { received: true };
}

/**
 * Get workflow history for a customer
 * @param {string} customerId
 */
export function getWorkflowHistory(customerId) {
  const key = `bydcrm_workflow_history_${customerId}`;
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : [];
}

/**
 * Save workflow execution to history
 * @param {string} customerId
 * @param {Object} execution
 */
export function saveWorkflowToHistory(customerId, execution) {
  const key = `bydcrm_workflow_history_${customerId}`;
  const history = getWorkflowHistory(customerId);
  history.unshift(execution);
  // Keep last 50 executions
  localStorage.setItem(key, JSON.stringify(history.slice(0, 50)));
}

export default {
  // Config
  getWorkflowConfig,
  setWorkflowConfig,
  isWorkflowEnabled,

  // Triggers
  triggerWorkflow,
  triggerDocumentSigning,
  triggerAppointmentConfirmation,
  triggerFollowUp,

  // Callbacks
  handleWorkflowCallback,

  // History
  getWorkflowHistory,
  saveWorkflowToHistory,

  // Constants
  WORKFLOW_TYPES,
  WORKFLOW_STATUS
};
