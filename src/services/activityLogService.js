/**
 * Activity Log Service
 *
 * Tracks customer changes and interactions for AI context.
 * Provides a running log of changes that helps AI generate
 * more contextual and relevant messages.
 */

import userStorage from './userStorage';

// LocalStorage key prefix
const STORAGE_KEY_PREFIX = 'bydcrm_activity_log_';

// Maximum number of activities to keep per customer
const MAX_ACTIVITIES_PER_CUSTOMER = 50;

// Maximum age of activities to keep (in days)
const MAX_ACTIVITY_AGE_DAYS = 90;

/**
 * Activity Types
 */
export const ACTIVITY_TYPES = {
  // Customer record changes
  CUSTOMER_CREATED: 'customer_created',
  CUSTOMER_UPDATED: 'customer_updated',
  FIELD_CHANGED: 'field_changed',

  // Milestone changes
  MILESTONE_CHANGED: 'milestone_changed',
  MILESTONE_DATE_SET: 'milestone_date_set',

  // Checklist changes
  CHECKLIST_ITEM_COMPLETED: 'checklist_item_completed',
  CHECKLIST_ITEM_UNCOMPLETED: 'checklist_item_uncompleted',

  // Communication
  MESSAGE_SENT: 'message_sent',
  MESSAGE_QUEUED: 'message_queued',
  DOCUMENT_SHARED: 'document_shared',

  // Status changes
  DEAL_CLOSED: 'deal_closed',
  CUSTOMER_ARCHIVED: 'customer_archived',
  CUSTOMER_RESTORED: 'customer_restored',

  // Document events
  DOCUMENT_UPLOADED: 'document_uploaded',
  DOCUMENT_GENERATED: 'document_generated',

  // Notes
  NOTE_ADDED: 'note_added',
  NOTE_UPDATED: 'note_updated',
};

/**
 * Field labels for human-readable activity descriptions
 */
const FIELD_LABELS = {
  name: 'Customer Name',
  phone: 'Phone Number',
  email: 'Email',
  nric: 'NRIC',
  occupation: 'Occupation',
  dob: 'Date of Birth',
  licenseStartDate: 'License Start Date',
  salesConsultant: 'Sales Consultant',
  vsaNo: 'VSA Number',
  address: 'Address',
  notes: 'Notes',

  // Proposal fields
  proposal_model: 'Proposed Model',
  proposal_variant: 'Proposed Variant',
  proposal_sellingPrice: 'Selling Price',
  proposal_downpayment: 'Down Payment',
  proposal_loanAmount: 'Loan Amount',
  proposal_loanTenure: 'Loan Tenure',
  proposal_interestRate: 'Interest Rate',

  // VSA fields
  vsa_makeModel: 'Vehicle Model',
  vsa_variant: 'Variant',
  vsa_bodyColour: 'Body Colour',
  vsa_upholstery: 'Upholstery',
  vsa_sellingWithCOE: 'Selling Price with COE',
  vsa_deposit: 'Deposit',
  vsa_loanAmount: 'Loan Amount',
  vsa_monthlyRepayment: 'Monthly Repayment',
  vsa_deliveryDate: 'Delivery Date',
  vsa_registrationNo: 'Registration Number',
  vsa_insuranceCompany: 'Insurance Company',
  vsa_insuranceFee: 'Insurance Fee',

  // Milestone dates
  'milestoneDates.test_drive': 'Test Drive Date',
  'milestoneDates.close_deal': 'COE Bidding Date',
  'milestoneDates.registration': 'Registration Date',
  'milestoneDates.delivery': 'Delivery Date',
  'milestoneDates.nps': 'NPS Follow-up Date',
};

/**
 * Get storage key for a specific customer
 */
const getStorageKey = (customerId) => {
  const email = userStorage.getUserEmail() || 'default';
  return `${STORAGE_KEY_PREFIX}${email.toLowerCase()}_${customerId}`;
};

/**
 * Get global storage key for all customer logs index
 */
const getGlobalStorageKey = () => {
  const email = userStorage.getUserEmail() || 'default';
  return `${STORAGE_KEY_PREFIX}${email.toLowerCase()}_index`;
};

/**
 * Load activities for a customer
 */
export const loadActivities = (customerId) => {
  try {
    const key = getStorageKey(customerId);
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
    return [];
  } catch (error) {
    console.error('Failed to load activities:', error);
    return [];
  }
};

/**
 * Save activities for a customer
 */
const saveActivities = (customerId, activities) => {
  try {
    const key = getStorageKey(customerId);
    localStorage.setItem(key, JSON.stringify(activities));

    // Update index
    updateActivityIndex(customerId);
  } catch (error) {
    console.error('Failed to save activities:', error);
  }
};

/**
 * Update the activity index (tracks which customers have logs)
 */
const updateActivityIndex = (customerId) => {
  try {
    const indexKey = getGlobalStorageKey();
    const stored = localStorage.getItem(indexKey);
    const index = stored ? JSON.parse(stored) : [];

    if (!index.includes(customerId)) {
      index.push(customerId);
      localStorage.setItem(indexKey, JSON.stringify(index));
    }
  } catch (error) {
    console.error('Failed to update activity index:', error);
  }
};

/**
 * Add a new activity entry
 */
export const logActivity = (customerId, type, data = {}) => {
  if (!customerId) return null;

  const activities = loadActivities(customerId);

  const newActivity = {
    id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    timestamp: new Date().toISOString(),
    data,
  };

  // Add new activity at the beginning
  activities.unshift(newActivity);

  // Prune old activities
  const prunedActivities = pruneActivities(activities);

  // Save
  saveActivities(customerId, prunedActivities);

  return newActivity;
};

/**
 * Prune old activities to keep storage manageable
 */
const pruneActivities = (activities) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - MAX_ACTIVITY_AGE_DAYS);

  // Filter by age
  let filtered = activities.filter(activity => {
    const activityDate = new Date(activity.timestamp);
    return activityDate >= cutoffDate;
  });

  // Limit count
  if (filtered.length > MAX_ACTIVITIES_PER_CUSTOMER) {
    filtered = filtered.slice(0, MAX_ACTIVITIES_PER_CUSTOMER);
  }

  return filtered;
};

/**
 * Log customer creation
 */
export const logCustomerCreated = (customerId, customerName) => {
  return logActivity(customerId, ACTIVITY_TYPES.CUSTOMER_CREATED, {
    customerName,
    description: `Customer "${customerName}" was created`,
  });
};

/**
 * Log field change
 */
export const logFieldChange = (customerId, fieldName, oldValue, newValue) => {
  const label = FIELD_LABELS[fieldName] || fieldName;

  // Don't log if values are effectively the same
  if (oldValue === newValue) return null;
  if (!oldValue && !newValue) return null;

  // Mask sensitive data in logs
  const maskedOld = maskSensitiveData(fieldName, oldValue);
  const maskedNew = maskSensitiveData(fieldName, newValue);

  return logActivity(customerId, ACTIVITY_TYPES.FIELD_CHANGED, {
    field: fieldName,
    fieldLabel: label,
    oldValue: maskedOld,
    newValue: maskedNew,
    description: `${label} ${oldValue ? 'changed' : 'set'} to "${maskedNew}"`,
  });
};

/**
 * Mask sensitive data in activity logs
 */
const maskSensitiveData = (fieldName, value) => {
  if (!value) return value;

  // Mask NRIC
  if (fieldName === 'nric' && typeof value === 'string' && value.length > 4) {
    return value.substring(0, 1) + '****' + value.substring(value.length - 4);
  }

  // Mask phone (partial)
  if (fieldName === 'phone' && typeof value === 'string' && value.length > 4) {
    return value.substring(0, 4) + '****';
  }

  return value;
};

/**
 * Log milestone change
 */
export const logMilestoneChange = (customerId, fromMilestone, toMilestone) => {
  const milestoneNames = {
    test_drive: 'Test Drive',
    close_deal: 'COE Bidding',
    registration: 'Registration',
    delivery: 'Delivery',
    nps: 'NPS',
  };

  return logActivity(customerId, ACTIVITY_TYPES.MILESTONE_CHANGED, {
    fromMilestone,
    toMilestone,
    fromMilestoneName: milestoneNames[fromMilestone] || fromMilestone,
    toMilestoneName: milestoneNames[toMilestone] || toMilestone,
    description: `Moved to ${milestoneNames[toMilestone] || toMilestone} stage`,
  });
};

/**
 * Log milestone date set
 */
export const logMilestoneDateSet = (customerId, milestoneId, date) => {
  const milestoneNames = {
    test_drive: 'Test Drive',
    close_deal: 'COE Bidding',
    registration: 'Registration',
    delivery: 'Delivery',
    nps: 'NPS Follow-up',
  };

  return logActivity(customerId, ACTIVITY_TYPES.MILESTONE_DATE_SET, {
    milestoneId,
    milestoneName: milestoneNames[milestoneId] || milestoneId,
    date,
    description: `${milestoneNames[milestoneId] || milestoneId} date set to ${date}`,
  });
};

/**
 * Log checklist item completion
 */
export const logChecklistItemCompleted = (customerId, milestoneId, itemId, itemLabel) => {
  return logActivity(customerId, ACTIVITY_TYPES.CHECKLIST_ITEM_COMPLETED, {
    milestoneId,
    itemId,
    itemLabel,
    description: `Completed: ${itemLabel}`,
  });
};

/**
 * Log checklist item uncompleted
 */
export const logChecklistItemUncompleted = (customerId, milestoneId, itemId, itemLabel) => {
  return logActivity(customerId, ACTIVITY_TYPES.CHECKLIST_ITEM_UNCOMPLETED, {
    milestoneId,
    itemId,
    itemLabel,
    description: `Unchecked: ${itemLabel}`,
  });
};

/**
 * Log message sent
 */
export const logMessageSent = (customerId, messageType, messagePreview, channel = 'whatsapp') => {
  return logActivity(customerId, ACTIVITY_TYPES.MESSAGE_SENT, {
    messageType,
    messagePreview: messagePreview?.substring(0, 100),
    channel,
    description: `Message sent via ${channel}: "${messagePreview?.substring(0, 50)}..."`,
  });
};

/**
 * Log message queued (for click-to-send)
 */
export const logMessageQueued = (customerId, messageType, messagePreview) => {
  return logActivity(customerId, ACTIVITY_TYPES.MESSAGE_QUEUED, {
    messageType,
    messagePreview: messagePreview?.substring(0, 100),
    description: `Message prepared: "${messagePreview?.substring(0, 50)}..."`,
  });
};

/**
 * Log document shared
 */
export const logDocumentShared = (customerId, documentName, documentType) => {
  return logActivity(customerId, ACTIVITY_TYPES.DOCUMENT_SHARED, {
    documentName,
    documentType,
    description: `Document shared: ${documentName}`,
  });
};

/**
 * Log deal closed
 */
export const logDealClosed = (customerId, vehicleModel) => {
  return logActivity(customerId, ACTIVITY_TYPES.DEAL_CLOSED, {
    vehicleModel,
    description: `Deal closed for ${vehicleModel || 'vehicle'}`,
  });
};

/**
 * Log customer archived
 */
export const logCustomerArchived = (customerId, status, reason) => {
  return logActivity(customerId, ACTIVITY_TYPES.CUSTOMER_ARCHIVED, {
    status, // 'lost' or 'completed'
    reason,
    description: `Customer marked as ${status}${reason ? `: ${reason}` : ''}`,
  });
};

/**
 * Log note added/updated
 */
export const logNoteUpdated = (customerId, notePreview) => {
  return logActivity(customerId, ACTIVITY_TYPES.NOTE_UPDATED, {
    notePreview: notePreview?.substring(0, 100),
    description: `Notes updated`,
  });
};

/**
 * Get activity summary for AI context
 * Returns a formatted string summarizing recent activities
 */
export const getActivitySummaryForAI = (customerId, maxActivities = 10) => {
  const activities = loadActivities(customerId);

  if (activities.length === 0) {
    return 'No recent activity recorded.';
  }

  const recentActivities = activities.slice(0, maxActivities);

  const summaryLines = recentActivities.map(activity => {
    const date = new Date(activity.timestamp);
    const dateStr = date.toLocaleDateString('en-SG', {
      day: 'numeric',
      month: 'short',
    });
    const timeStr = date.toLocaleTimeString('en-SG', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return `- ${dateStr} ${timeStr}: ${activity.data.description || activity.type}`;
  });

  return `Recent Activity Log:\n${summaryLines.join('\n')}`;
};

/**
 * Get activities grouped by date
 */
export const getActivitiesGroupedByDate = (customerId) => {
  const activities = loadActivities(customerId);

  const groups = {};

  activities.forEach(activity => {
    const date = new Date(activity.timestamp);
    const dateKey = date.toISOString().split('T')[0];

    if (!groups[dateKey]) {
      groups[dateKey] = {
        date: dateKey,
        label: date.toLocaleDateString('en-SG', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
        activities: [],
      };
    }

    groups[dateKey].activities.push(activity);
  });

  // Convert to array sorted by date (newest first)
  return Object.values(groups).sort((a, b) =>
    new Date(b.date) - new Date(a.date)
  );
};

/**
 * Get key milestones from activity log
 */
export const getKeyMilestones = (customerId) => {
  const activities = loadActivities(customerId);

  const keyTypes = [
    ACTIVITY_TYPES.CUSTOMER_CREATED,
    ACTIVITY_TYPES.MILESTONE_CHANGED,
    ACTIVITY_TYPES.DEAL_CLOSED,
    ACTIVITY_TYPES.MESSAGE_SENT,
  ];

  return activities.filter(activity => keyTypes.includes(activity.type));
};

/**
 * Get message history from activity log
 */
export const getMessageHistory = (customerId) => {
  const activities = loadActivities(customerId);

  return activities.filter(activity =>
    activity.type === ACTIVITY_TYPES.MESSAGE_SENT ||
    activity.type === ACTIVITY_TYPES.MESSAGE_QUEUED
  );
};

/**
 * Clear all activities for a customer
 */
export const clearActivities = (customerId) => {
  try {
    const key = getStorageKey(customerId);
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Failed to clear activities:', error);
  }
};

/**
 * Export activity log service
 */
export default {
  ACTIVITY_TYPES,
  loadActivities,
  logActivity,
  logCustomerCreated,
  logFieldChange,
  logMilestoneChange,
  logMilestoneDateSet,
  logChecklistItemCompleted,
  logChecklistItemUncompleted,
  logMessageSent,
  logMessageQueued,
  logDocumentShared,
  logDealClosed,
  logCustomerArchived,
  logNoteUpdated,
  getActivitySummaryForAI,
  getActivitiesGroupedByDate,
  getKeyMilestones,
  getMessageHistory,
  clearActivities,
};
