/**
 * Milestone and Checklist Configuration
 * Defines the stages of customer journey in the CRM
 */

export const MILESTONES = [
  {
    id: 'test_drive',
    name: 'Test Drive',
    shortName: 'TD',
    color: '#64748b', // Slate - neutral professional start
    iconName: 'Car',
  },
  {
    id: 'close_deal',
    name: 'COE Bidding',
    shortName: 'COE',
    color: '#0891b2', // Cyan - business progress
    iconName: 'Handshake',
  },
  {
    id: 'registration',
    name: 'Registration',
    shortName: 'REG',
    color: '#6366f1', // Indigo - process/documentation
    iconName: 'ClipboardCheck',
  },
  {
    id: 'delivery',
    name: 'Delivery',
    shortName: 'DEL',
    color: '#059669', // Emerald - completion/success
    iconName: 'Package',
  },
  {
    id: 'nps',
    name: 'NPS',
    shortName: 'NPS',
    color: '#d97706', // Amber - feedback/rating
    iconName: 'Star',
  },
];

export const CHECKLISTS = {
  test_drive: [
    { id: 'customer_details_filled', label: 'Customer Details Filled' },
    { id: 'id_scanned', label: 'ID Scanned' },
    { id: 'test_drive_form', label: 'Test Drive Form' },
    { id: 'input_byd_crm_td', label: 'Input BYD CRM' },
  ],
  close_deal: [
    { id: 'vsa_details_filled', label: 'VSA Details Filled' },
    { id: 'vsa_pdpa_coe_forms', label: 'VSA Form, PDPA Form & COE Bidding Form' },
    { id: 'input_byd_crm_cd', label: 'Input BYD CRM' },
  ],
  registration: [
    { id: 'loan_approved', label: 'Loan Approved' },
    { id: 'insurance_accepted', label: 'Insurance Accepted' },
    { id: 'balance_payment_secured', label: 'Balance Payment Secured, Input BYD CRM' },
    { id: 'insurance_details_filled', label: 'Insurance Details Filled' },
  ],
  delivery: [
    { id: 'delivery_details_filled', label: 'Delivery Details Filled' },
    { id: 'delivery_checklist_form', label: 'Delivery Checklist Form, Declaration of Insurance Cancellation Form' },
    { id: 'input_byd_crm_dlink', label: 'Input BYD CRM (DLink)' },
    { id: 'insurance_forms_printed', label: 'Insurance Forms Printed' },
    { id: 'performa_invoice_copy', label: 'Copy of Performa Invoice for Customer' },
    { id: 'remaining_delivery_items', label: 'Any Remaining Delivery items or gifts to be prepared' },
  ],
  nps: [
    { id: 'nps_survey_sent', label: 'NPS Survey Sent' },
    { id: 'nps_response_received', label: 'NPS Response Received' },
  ],
};

/**
 * Get default checklist state for a new customer
 * All items start as unchecked (false)
 */
export const getDefaultChecklistState = () => {
  const state = {
    currentMilestone: 'test_drive',
  };

  Object.entries(CHECKLISTS).forEach(([milestoneId, items]) => {
    state[milestoneId] = {};
    items.forEach((item) => {
      state[milestoneId][item.id] = false;
    });
  });

  return state;
};

/**
 * Calculate milestone completion percentage
 */
export const getMilestoneProgress = (milestoneId, checklistState) => {
  if (!checklistState || !checklistState[milestoneId]) {
    return 0;
  }

  const items = CHECKLISTS[milestoneId];
  if (!items || items.length === 0) return 0;

  const completed = items.filter((item) => checklistState[milestoneId][item.id]).length;
  return Math.round((completed / items.length) * 100);
};

/**
 * Check if a milestone is complete (all checklist items done)
 */
export const isMilestoneComplete = (milestoneId, checklistState) => {
  return getMilestoneProgress(milestoneId, checklistState) === 100;
};

/**
 * Get overall progress across all milestones
 */
export const getOverallProgress = (checklistState) => {
  if (!checklistState) return 0;

  let totalItems = 0;
  let completedItems = 0;

  Object.entries(CHECKLISTS).forEach(([milestoneId, items]) => {
    totalItems += items.length;
    if (checklistState[milestoneId]) {
      items.forEach((item) => {
        if (checklistState[milestoneId][item.id]) {
          completedItems++;
        }
      });
    }
  });

  return totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
};
