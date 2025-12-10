/**
 * AI Secretary Service
 *
 * Uses Gemini AI to act as a personal secretary for customer communications.
 * Composes personalized messages, suggests follow-ups, and helps with
 * after-sales documentation.
 *
 * Features:
 * - AI-powered message composition
 * - Context-aware responses based on customer data
 * - Document summary generation
 * - Follow-up suggestions based on milestones
 * - Multi-personality support (professional, friendly, formal)
 */

import { getGeminiApiKey, isGeminiAvailable } from './geminiService';

// Gemini API endpoint
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// Personality presets for the AI secretary
export const AI_PERSONALITIES = {
  professional: {
    name: 'Professional',
    description: 'Balanced, business-appropriate tone',
    systemPrompt: `You are a professional automotive sales assistant for BYD Singapore.
Your tone is warm but professional, clear and helpful.
You use proper grammar and avoid excessive emojis (occasional use is fine).
Keep messages concise and action-oriented.`
  },
  friendly: {
    name: 'Friendly',
    description: 'Warm and approachable tone',
    systemPrompt: `You are a friendly automotive sales assistant for BYD Singapore.
Your tone is warm, enthusiastic, and approachable - like talking to a helpful friend.
You can use emojis sparingly to convey warmth 😊
Keep messages conversational but still professional.`
  },
  formal: {
    name: 'Formal',
    description: 'Traditional business tone',
    systemPrompt: `You are a formal automotive sales representative for BYD Singapore.
Your tone is respectful, courteous, and traditionally professional.
Avoid emojis and casual language. Use proper salutations.
Keep messages clear, structured, and business-appropriate.`
  }
};

// Message type contexts for better AI responses
export const MESSAGE_CONTEXTS = {
  test_drive: {
    name: 'Test Drive',
    context: 'Customer is at the test drive stage, interested in experiencing the vehicle'
  },
  coe_bidding: {
    name: 'COE Bidding',
    context: 'Customer has committed, waiting for COE bidding results'
  },
  registration: {
    name: 'Registration',
    context: 'Vehicle purchased, going through registration process'
  },
  delivery: {
    name: 'Delivery',
    context: 'Vehicle registered, preparing for delivery to customer'
  },
  nps: {
    name: 'After Delivery',
    context: 'Customer has received their vehicle, follow-up and satisfaction check'
  },
  document_followup: {
    name: 'Document Follow-up',
    context: 'Following up on required documentation from customer'
  },
  general: {
    name: 'General',
    context: 'General customer communication and relationship building'
  }
};

/**
 * Build customer context string for AI prompts
 * @param {Object} customer - Customer object
 * @returns {string} Context string
 */
function buildCustomerContext(customer) {
  const parts = [];

  if (customer.name) parts.push(`Customer Name: ${customer.name}`);
  if (customer.phone) parts.push(`Phone: ${customer.phone}`);

  // Vehicle info
  const vehicleModel = customer.vsa_vehicleModel || customer.proposal_model;
  if (vehicleModel) parts.push(`Vehicle: ${vehicleModel}`);

  // Current milestone
  if (customer.checklist?.currentMilestone) {
    parts.push(`Current Stage: ${customer.checklist.currentMilestone}`);
  }

  // Sales consultant
  if (customer.salesConsultant) {
    parts.push(`Sales Consultant: ${customer.salesConsultant}`);
  }

  // Registration details if available
  if (customer.vsa_registrationNo) {
    parts.push(`Vehicle Registration: ${customer.vsa_registrationNo}`);
  }

  // Delivery date if set
  if (customer.vsa_deliveryDate) {
    parts.push(`Delivery Date: ${customer.vsa_deliveryDate}`);
  }

  // Notes if any
  if (customer.notes) {
    parts.push(`Notes: ${customer.notes}`);
  }

  return parts.join('\n');
}

/**
 * Compose a message using AI
 * @param {Object} options
 * @param {Object} options.customer - Customer object
 * @param {string} options.messageType - Type of message (from MESSAGE_CONTEXTS)
 * @param {string} options.userPrompt - Additional instructions from user
 * @param {string} options.personality - AI personality to use
 * @param {string} options.replyTo - Message being replied to (for context)
 * @returns {Promise<Object>} { message, suggestions }
 */
export async function composeMessage({
  customer,
  messageType = 'general',
  userPrompt = '',
  personality = 'professional',
  replyTo = null
}) {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    throw new Error('Gemini API key not configured. Please set it in Settings.');
  }

  const personalityConfig = AI_PERSONALITIES[personality] || AI_PERSONALITIES.professional;
  const messageContext = MESSAGE_CONTEXTS[messageType] || MESSAGE_CONTEXTS.general;
  const customerContext = buildCustomerContext(customer);

  const prompt = `${personalityConfig.systemPrompt}

CUSTOMER CONTEXT:
${customerContext}

MESSAGE CONTEXT:
${messageContext.context}

${replyTo ? `REPLYING TO CUSTOMER MESSAGE:\n"${replyTo}"\n` : ''}
${userPrompt ? `ADDITIONAL INSTRUCTIONS:\n${userPrompt}\n` : ''}
TASK:
Compose a WhatsApp message for this customer. The message should be:
- Personalized with their name and vehicle details
- Appropriate for WhatsApp (concise, conversational)
- Under 300 characters for readability
- Clear about any action items or next steps

Also suggest 2-3 quick reply options the sales consultant might want to use.

IMPORTANT: Return ONLY valid JSON, no markdown or explanations.

Return in this exact JSON format:
{
  "message": "The composed message here",
  "suggestions": ["Quick reply 1", "Quick reply 2", "Quick reply 3"],
  "sentiment": "positive|neutral|urgent",
  "actionItems": ["Any action items mentioned"]
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
          temperature: 0.7, // Slightly creative for natural messages
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
      message: result.message || '',
      suggestions: result.suggestions || [],
      sentiment: result.sentiment || 'neutral',
      actionItems: result.actionItems || []
    };

  } catch (error) {
    console.error('AI message composition failed:', error);
    throw error;
  }
}

/**
 * Generate a document summary for WhatsApp
 * @param {string} documentType - Type of document
 * @param {Object} customer - Customer object
 * @returns {Promise<string>} Summary message
 */
export async function generateDocumentSummary(documentType, customer) {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    // Fallback to simple template
    return `Hi ${customer.name || 'there'}! Please find the attached ${documentType}. Let me know if you have any questions.`;
  }

  const prompt = `You are a professional automotive sales assistant for BYD Singapore.
Generate a brief, friendly WhatsApp message to accompany a ${documentType} being sent to a customer.

Customer: ${customer.name || 'Customer'}
Vehicle: ${customer.vsa_vehicleModel || customer.proposal_model || 'BYD vehicle'}

The message should:
- Be under 150 characters
- Mention the document type naturally
- Invite questions if needed
- Be warm but professional

Return ONLY the message text, nothing else.`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.5, maxOutputTokens: 256 }
      })
    });

    if (!response.ok) throw new Error('API error');

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      `Hi ${customer.name}! Please find the attached ${documentType}.`;

  } catch (error) {
    console.warn('Document summary generation failed:', error);
    return `Hi ${customer.name || 'there'}! Please find the attached ${documentType}. Let me know if you have any questions.`;
  }
}

/**
 * Suggest follow-up actions based on customer milestone
 * @param {Object} customer - Customer object
 * @returns {Promise<Object>} { suggestions, urgency }
 */
export async function suggestFollowUps(customer) {
  const apiKey = getGeminiApiKey();

  if (!apiKey || !isGeminiAvailable()) {
    // Return default suggestions based on milestone
    return getDefaultFollowUps(customer);
  }

  const customerContext = buildCustomerContext(customer);

  const prompt = `You are an AI assistant helping a BYD sales consultant manage customer follow-ups.

CUSTOMER CONTEXT:
${customerContext}

Based on this customer's current stage and data, suggest:
1. What follow-up messages should be sent
2. What documents might need to be shared
3. Any urgent actions needed

Return ONLY valid JSON:
{
  "suggestions": [
    { "type": "message|document|action", "title": "Brief title", "description": "What to do", "priority": "high|medium|low" }
  ],
  "urgency": "urgent|soon|normal",
  "nextMilestoneHint": "What to prepare for next stage"
}`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024 }
      })
    });

    if (!response.ok) throw new Error('API error');

    const data = await response.json();
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

    let jsonStr = textResponse.trim();
    if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
    else if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
    if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);

    return JSON.parse(jsonStr.trim());

  } catch (error) {
    console.warn('Follow-up suggestion failed:', error);
    return getDefaultFollowUps(customer);
  }
}

/**
 * Get default follow-up suggestions based on milestone
 * @param {Object} customer
 * @returns {Object}
 */
function getDefaultFollowUps(customer) {
  const milestone = customer.checklist?.currentMilestone || 'test_drive';

  const suggestions = {
    test_drive: [
      { type: 'message', title: 'Test Drive Follow-up', description: 'Send thank you and next steps', priority: 'high' },
      { type: 'document', title: 'Brochure', description: 'Share vehicle brochure', priority: 'medium' }
    ],
    close_deal: [
      { type: 'message', title: 'COE Update', description: 'Update on COE bidding status', priority: 'high' },
      { type: 'document', title: 'VSA Document', description: 'Share Vehicle Sales Agreement', priority: 'high' }
    ],
    registration: [
      { type: 'message', title: 'Registration Status', description: 'Update on registration progress', priority: 'high' },
      { type: 'document', title: 'Registration Documents', description: 'Share registration confirmation', priority: 'medium' }
    ],
    delivery: [
      { type: 'message', title: 'Delivery Confirmation', description: 'Confirm delivery date and time', priority: 'high' },
      { type: 'document', title: 'Delivery Checklist', description: 'Share what to bring', priority: 'medium' }
    ],
    nps: [
      { type: 'message', title: 'Satisfaction Check', description: 'Follow up on ownership experience', priority: 'medium' },
      { type: 'message', title: 'Service Reminder', description: 'Remind about first service', priority: 'low' }
    ]
  };

  return {
    suggestions: suggestions[milestone] || suggestions.test_drive,
    urgency: 'normal',
    nextMilestoneHint: 'Keep customer engaged and informed'
  };
}

/**
 * Analyze incoming customer message and suggest response
 * @param {string} customerMessage - Message from customer
 * @param {Object} customer - Customer object
 * @returns {Promise<Object>} Analysis and suggested response
 */
export async function analyzeCustomerMessage(customerMessage, customer) {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    return {
      intent: 'unknown',
      sentiment: 'neutral',
      suggestedResponse: `Thank you for your message. Let me check on that for you.`,
      requiresHumanReview: true
    };
  }

  const customerContext = buildCustomerContext(customer);

  const prompt = `You are an AI assistant analyzing a WhatsApp message from a BYD customer.

CUSTOMER CONTEXT:
${customerContext}

CUSTOMER MESSAGE:
"${customerMessage}"

Analyze this message and provide:
1. Intent: What does the customer want? (inquiry, complaint, confirmation, question, appreciation, other)
2. Sentiment: How do they feel? (positive, negative, neutral, urgent)
3. A suggested response that is helpful and appropriate
4. Whether this needs human review (complaints, complex issues, negotiations)

Return ONLY valid JSON:
{
  "intent": "inquiry",
  "sentiment": "neutral",
  "topics": ["pricing", "delivery"],
  "suggestedResponse": "The response here",
  "requiresHumanReview": false,
  "reviewReason": "Only if review needed"
}`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024 }
      })
    });

    if (!response.ok) throw new Error('API error');

    const data = await response.json();
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

    let jsonStr = textResponse.trim();
    if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
    else if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
    if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);

    return JSON.parse(jsonStr.trim());

  } catch (error) {
    console.warn('Message analysis failed:', error);
    return {
      intent: 'unknown',
      sentiment: 'neutral',
      suggestedResponse: `Thank you for your message. I'll get back to you shortly.`,
      requiresHumanReview: true
    };
  }
}

/**
 * Check if AI Secretary is available
 * @returns {boolean}
 */
export function isAISecretaryAvailable() {
  return isGeminiAvailable();
}

export default {
  composeMessage,
  generateDocumentSummary,
  suggestFollowUps,
  analyzeCustomerMessage,
  isAISecretaryAvailable,
  AI_PERSONALITIES,
  MESSAGE_CONTEXTS
};
