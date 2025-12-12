/**
 * Customer Assistant Service
 *
 * AI-powered service for generating contextual customer messages.
 * Integrates with activity logs, milestone configuration, and
 * provides WhatsApp Web click-to-send functionality.
 */

import { getGeminiApiKey, isGeminiAvailable } from './geminiService';
import { getActivitySummaryForAI, getMessageHistory } from './activityLogService';
import {
  MESSAGE_FRAMEWORK,
  MESSAGE_PRIORITY,
  getMessageById,
  QUICK_REPLY_SUGGESTIONS,
  AI_CONTEXT_FIELDS,
} from '../constants/customerAssistantConfig';
import { MILESTONES, CHECKLISTS, getDaysUntilMilestone, getMilestoneProgress } from '../constants/milestones';

// Gemini API endpoint
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

/**
 * AI Personality configurations
 */
export const AI_PERSONALITIES = {
  professional: {
    name: 'Professional',
    description: 'Balanced, business-appropriate tone',
    prompt: `You are a professional automotive sales consultant for BYD Singapore.
Your tone is warm but professional, clear and helpful.
You use proper grammar and avoid excessive emojis (occasional use is fine).
Keep messages concise and action-oriented.
Messages should be suitable for WhatsApp (under 300 characters preferred).`,
  },
  friendly: {
    name: 'Friendly',
    description: 'Warm and approachable tone',
    prompt: `You are a friendly automotive sales consultant for BYD Singapore.
Your tone is warm, enthusiastic, and approachable - like talking to a helpful friend.
You can use emojis to convey warmth 😊🚗🎉
Keep messages conversational but still professional.
Messages should be suitable for WhatsApp (under 300 characters preferred).`,
  },
  formal: {
    name: 'Formal',
    description: 'Traditional business tone',
    prompt: `You are a formal automotive sales representative for BYD Singapore.
Your tone is respectful, courteous, and traditionally professional.
Avoid emojis and casual language. Use proper salutations.
Keep messages clear, structured, and business-appropriate.
Messages should be suitable for WhatsApp (under 300 characters preferred).`,
  },
};

/**
 * Build comprehensive customer context for AI
 */
const buildCustomerContext = (customer) => {
  const parts = [];

  // Basic info
  parts.push('=== CUSTOMER INFORMATION ===');
  if (customer.name) parts.push(`Name: ${customer.name}`);
  if (customer.phone) parts.push(`Phone: ${customer.phone}`);
  if (customer.salesConsultant) parts.push(`Sales Consultant: ${customer.salesConsultant}`);

  // Vehicle info
  const vehicleModel = customer.vsa_makeModel || customer.proposal_model;
  const vehicleVariant = customer.vsa_variant || customer.proposal_variant;
  if (vehicleModel || vehicleVariant) {
    parts.push('\n=== VEHICLE ===');
    if (vehicleModel) parts.push(`Model: ${vehicleModel}`);
    if (vehicleVariant) parts.push(`Variant: ${vehicleVariant}`);
    if (customer.vsa_bodyColour) parts.push(`Colour: ${customer.vsa_bodyColour}`);
    if (customer.vsa_registrationNo) parts.push(`Registration: ${customer.vsa_registrationNo}`);
  }

  // Current milestone and progress
  const currentMilestone = customer.checklist?.currentMilestone || 'test_drive';
  const milestone = MILESTONES.find(m => m.id === currentMilestone);
  const progress = getMilestoneProgress(currentMilestone, customer.checklist);

  parts.push('\n=== CURRENT STATUS ===');
  parts.push(`Stage: ${milestone?.name || currentMilestone}`);
  parts.push(`Progress: ${progress}%`);

  // Milestone dates
  if (customer.milestoneDates) {
    const dates = [];
    if (customer.milestoneDates.test_drive) {
      const days = getDaysUntilMilestone(customer.milestoneDates.test_drive);
      dates.push(`Test Drive: ${customer.milestoneDates.test_drive} (${days > 0 ? `in ${days} days` : days === 0 ? 'today' : `${Math.abs(days)} days ago`})`);
    }
    if (customer.milestoneDates.delivery) {
      const days = getDaysUntilMilestone(customer.milestoneDates.delivery);
      dates.push(`Delivery: ${customer.milestoneDates.delivery} (${days > 0 ? `in ${days} days` : days === 0 ? 'today' : `${Math.abs(days)} days ago`})`);
    }
    if (dates.length > 0) {
      parts.push('\n=== KEY DATES ===');
      parts.push(...dates);
    }
  }

  // Financial info (if available)
  if (customer.vsa_loanAmount || customer.vsa_monthlyRepayment) {
    parts.push('\n=== FINANCIAL ===');
    if (customer.vsa_loanAmount) parts.push(`Loan Amount: $${customer.vsa_loanAmount.toLocaleString()}`);
    if (customer.vsa_monthlyRepayment) parts.push(`Monthly Payment: $${customer.vsa_monthlyRepayment.toLocaleString()}`);
    if (customer.vsa_insuranceCompany) parts.push(`Insurance: ${customer.vsa_insuranceCompany}`);
  }

  // Incomplete checklist items for current milestone
  const checklist = customer.checklist?.[currentMilestone] || {};
  const milestoneChecklist = CHECKLISTS[currentMilestone] || [];
  const incompleteItems = milestoneChecklist.filter(item => !checklist[item.id]);

  if (incompleteItems.length > 0) {
    parts.push('\n=== PENDING ITEMS ===');
    incompleteItems.forEach(item => {
      parts.push(`- ${item.label}`);
    });
  }

  // Notes
  if (customer.notes) {
    parts.push('\n=== NOTES ===');
    parts.push(customer.notes);
  }

  return parts.join('\n');
};

/**
 * Fill template placeholders with customer data
 */
export const fillMessageTemplate = (template, customer) => {
  if (!template) return '';

  const replacements = {
    customerName: customer.name || 'Customer',
    vehicleModel: customer.vsa_makeModel || customer.proposal_model || 'your BYD',
    vehicleVariant: customer.vsa_variant || customer.proposal_variant || '',
    registrationNo: customer.vsa_registrationNo || '',
    salesConsultant: customer.salesConsultant || 'your sales consultant',
    deliveryDate: customer.vsa_deliveryDate || customer.milestoneDates?.delivery || '',
    testDriveDate: customer.milestoneDates?.test_drive || '',
    loanAmount: customer.vsa_loanAmount ? `$${customer.vsa_loanAmount.toLocaleString()}` : '',
    monthlyRepayment: customer.vsa_monthlyRepayment ? `$${customer.vsa_monthlyRepayment.toLocaleString()}` : '',
    tenure: customer.vsa_tenure || '',
    insuranceCompany: customer.vsa_insuranceCompany || '',
    insuranceDetails: customer.vsa_insuranceCompany || 'to be confirmed',
    balanceAmount: customer.vsa_sellingWithCOE
      ? `$${(customer.vsa_sellingWithCOE - (customer.vsa_deposit || 0) - (customer.vsa_loanAmount || 0)).toLocaleString()}`
      : '',
    deliveryTime: 'your scheduled time',
  };

  let filled = template;
  for (const [key, value] of Object.entries(replacements)) {
    filled = filled.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '');
  }

  return filled;
};

/**
 * Generate AI-powered message for a customer action
 */
export const generateMessage = async (customer, messageConfig, options = {}) => {
  const {
    personality = 'professional',
    additionalContext = '',
    useTemplate = true,
  } = options;

  const apiKey = getGeminiApiKey();

  // If no API key, use template fallback
  if (!apiKey || !isGeminiAvailable()) {
    if (useTemplate && messageConfig.template) {
      return {
        message: fillMessageTemplate(messageConfig.template, customer),
        suggestions: QUICK_REPLY_SUGGESTIONS[messageConfig.category] || [],
        source: 'template',
      };
    }
    throw new Error('Gemini API key not configured and no template available');
  }

  // Build comprehensive context
  const customerContext = buildCustomerContext(customer);
  const activityLog = getActivitySummaryForAI(customer.id, 10);
  const personalityConfig = AI_PERSONALITIES[personality] || AI_PERSONALITIES.professional;

  const prompt = `${personalityConfig.prompt}

=== TASK ===
Generate a WhatsApp message for the following situation:
${messageConfig.title}: ${messageConfig.description}

AI Context: ${messageConfig.aiContext}

${customerContext}

${activityLog}

${additionalContext ? `\nAdditional Instructions: ${additionalContext}` : ''}

=== REQUIREMENTS ===
1. Message should be personalized with customer's name and vehicle details
2. Keep it concise (under 300 characters if possible, max 500)
3. Be appropriate for WhatsApp (conversational)
4. Include any relevant action items or next steps
5. Match the tone specified above

=== TEMPLATE REFERENCE ===
You can use this as inspiration: "${messageConfig.template}"

Return ONLY valid JSON with this format:
{
  "message": "Your generated message here",
  "suggestions": ["Reply suggestion 1", "Reply suggestion 2", "Reply suggestion 3"],
  "tone": "professional|friendly|formal"
}`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textResponse) {
      throw new Error('No response from AI');
    }

    // Parse JSON response
    let jsonStr = textResponse.trim();
    if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
    else if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
    if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
    jsonStr = jsonStr.trim();

    const result = JSON.parse(jsonStr);

    return {
      message: result.message || fillMessageTemplate(messageConfig.template, customer),
      suggestions: result.suggestions || QUICK_REPLY_SUGGESTIONS[messageConfig.category] || [],
      tone: result.tone || personality,
      source: 'ai',
    };

  } catch (error) {
    console.error('AI message generation failed:', error);

    // Fallback to template
    if (useTemplate && messageConfig.template) {
      return {
        message: fillMessageTemplate(messageConfig.template, customer),
        suggestions: QUICK_REPLY_SUGGESTIONS[messageConfig.category] || [],
        source: 'template_fallback',
        error: error.message,
      };
    }

    throw error;
  }
};

/**
 * Generate WhatsApp Web URL for click-to-send
 */
export const generateWhatsAppUrl = (phone, message) => {
  if (!phone) return null;

  // Clean phone number
  let cleanPhone = phone.replace(/[^\d+]/g, '');

  // Add country code if not present
  if (!cleanPhone.startsWith('+')) {
    if (cleanPhone.startsWith('65')) {
      cleanPhone = '+' + cleanPhone;
    } else if (cleanPhone.length === 8) {
      // Singapore 8-digit number
      cleanPhone = '+65' + cleanPhone;
    } else {
      cleanPhone = '+' + cleanPhone;
    }
  }

  // Remove the + for the URL
  const phoneNumber = cleanPhone.replace('+', '');

  // Encode the message
  const encodedMessage = encodeURIComponent(message);

  return `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
};

/**
 * Open WhatsApp Web with pre-filled message
 */
export const openWhatsApp = (phone, message) => {
  const url = generateWhatsAppUrl(phone, message);
  if (url) {
    // Use a hidden iframe to trigger WhatsApp without navigating away or opening a visible tab
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:absolute;width:0;height:0;border:none;visibility:hidden;';
    iframe.src = url;
    document.body.appendChild(iframe);

    // Clean up iframe after protocol handler triggers
    setTimeout(() => {
      if (iframe.parentNode) {
        document.body.removeChild(iframe);
      }
    }, 2000);

    return true;
  }
  return false;
};

/**
 * Calculate action priority based on customer state
 */
export const calculatePriority = (customer, messageConfig) => {
  // Check if messageConfig has a priority function
  if (typeof messageConfig.priority === 'function') {
    return messageConfig.priority(customer);
  }

  const currentMilestone = customer.checklist?.currentMilestone || 'test_drive';

  // Check milestone dates for urgency
  if (customer.milestoneDates) {
    const milestoneDate = customer.milestoneDates[currentMilestone];
    if (milestoneDate) {
      const days = getDaysUntilMilestone(milestoneDate);

      if (days !== null) {
        if (days < 0) return MESSAGE_PRIORITY.URGENT;  // Overdue
        if (days === 0) return MESSAGE_PRIORITY.URGENT; // Today
        if (days <= 1) return MESSAGE_PRIORITY.HIGH;    // Tomorrow
        if (days <= 3) return MESSAGE_PRIORITY.MEDIUM;  // Within 3 days
      }
    }
  }

  return MESSAGE_PRIORITY.MEDIUM;
};

/**
 * Check if a message action should be triggered for a customer
 */
export const shouldTriggerAction = (customer, messageConfig) => {
  const { trigger } = messageConfig;

  if (!trigger) return false;

  switch (trigger.type) {
    case 'manual':
      // Manual triggers are always available
      return true;

    case 'checklist':
      // Check if checklist item matches condition
      const checklist = customer.checklist?.[trigger.milestoneId] || {};
      const itemCompleted = checklist[trigger.itemId];

      if (trigger.condition === 'completed') {
        return itemCompleted === true;
      } else if (trigger.condition === 'not_completed') {
        return itemCompleted !== true;
      }
      return false;

    case 'date':
      // Check if date trigger matches
      const dateValue = trigger.dateField.includes('.')
        ? trigger.dateField.split('.').reduce((obj, key) => obj?.[key], customer)
        : customer[trigger.dateField];

      if (!dateValue) return false;

      const days = getDaysUntilMilestone(dateValue);
      if (days === null) return false;

      // daysBefore: 1 means trigger when 1 day before
      // daysBefore: 0 means trigger on the day
      // daysBefore: -1 means trigger 1 day after
      return days === trigger.daysBefore;

    case 'milestone_change':
      // This would be triggered by an event, not a check
      // Return false for regular checks
      return false;

    case 'field_updated':
      // This would be triggered by an event
      // For checking, see if the field has a value
      return customer[trigger.field] ? true : false;

    default:
      return false;
  }
};

/**
 * Generate all applicable actions for a customer
 */
export const generateActionsForCustomer = (customer) => {
  const actions = [];
  const currentMilestone = customer.checklist?.currentMilestone || 'test_drive';

  // Get messages for current milestone and adjacent milestones
  const milestonesToCheck = [currentMilestone];

  // Add previous milestone for follow-ups
  const milestoneIds = ['test_drive', 'close_deal', 'registration', 'delivery', 'nps'];
  const currentIndex = milestoneIds.indexOf(currentMilestone);
  if (currentIndex > 0) {
    milestonesToCheck.push(milestoneIds[currentIndex - 1]);
  }

  for (const milestoneId of milestonesToCheck) {
    const milestoneConfig = MESSAGE_FRAMEWORK[milestoneId];
    if (!milestoneConfig) continue;

    for (const messageConfig of milestoneConfig.messages) {
      // Check if this message should be triggered
      const shouldTrigger = shouldTriggerAction(customer, messageConfig);

      if (shouldTrigger || messageConfig.trigger?.type === 'manual') {
        const priority = calculatePriority(customer, messageConfig);

        actions.push({
          customerId: customer.id,
          customerName: customer.name,
          customerPhone: customer.phone,
          milestoneId,
          milestoneName: milestoneConfig.stageName,
          messageId: messageConfig.id,
          messageConfig,
          priority,
          shouldAutoTrigger: shouldTrigger,
          documents: messageConfig.documents || [],
        });
      }
    }
  }

  return actions;
};

/**
 * Generate actions for all customers
 */
export const generateActionsForAllCustomers = (customers) => {
  const allActions = [];

  for (const customer of customers) {
    // Skip archived customers
    if (customer.archiveStatus) continue;

    const customerActions = generateActionsForCustomer(customer);
    allActions.push(...customerActions);
  }

  // Sort by priority
  const priorityOrder = {
    [MESSAGE_PRIORITY.URGENT]: 0,
    [MESSAGE_PRIORITY.HIGH]: 1,
    [MESSAGE_PRIORITY.MEDIUM]: 2,
    [MESSAGE_PRIORITY.LOW]: 3,
  };

  allActions.sort((a, b) => {
    const priorityDiff = (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3);
    if (priorityDiff !== 0) return priorityDiff;
    return (a.customerName || '').localeCompare(b.customerName || '');
  });

  return allActions;
};

/**
 * Get suggested actions (high priority only)
 */
export const getSuggestedActions = (customers, limit = 10) => {
  const allActions = generateActionsForAllCustomers(customers);

  // Filter for auto-trigger actions with high/urgent priority
  const suggested = allActions.filter(
    action => action.shouldAutoTrigger &&
      (action.priority === MESSAGE_PRIORITY.URGENT || action.priority === MESSAGE_PRIORITY.HIGH)
  );

  return suggested.slice(0, limit);
};

/**
 * Export service functions
 */
export default {
  AI_PERSONALITIES,
  generateMessage,
  fillMessageTemplate,
  generateWhatsAppUrl,
  openWhatsApp,
  calculatePriority,
  shouldTriggerAction,
  generateActionsForCustomer,
  generateActionsForAllCustomers,
  getSuggestedActions,
};
