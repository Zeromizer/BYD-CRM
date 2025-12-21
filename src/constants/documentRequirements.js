/**
 * Document Requirements Configuration
 * Defines required documents for each milestone in the customer journey
 * Used for:
 *  - Document checklist tracking
 *  - AI document classification and routing
 *  - Automated workflow triggers
 */

/**
 * Document types that can be identified by AI
 * Maps to folder destinations and checklist items
 */
export const DOCUMENT_TYPES = {
  // Identity Documents
  NRIC_FRONT: {
    id: 'nric_front',
    name: 'NRIC Front',
    folder: 'NIRC',
    keywords: ['nric', 'identity card', 'singapore id', 'fin'],
    milestone: 'test_drive',
  },
  NRIC_BACK: {
    id: 'nric_back',
    name: 'NRIC Back',
    folder: 'NIRC',
    keywords: ['nric back', 'address', 'identity card back'],
    milestone: 'test_drive',
  },
  DRIVING_LICENSE: {
    id: 'driving_license',
    name: 'Driving License',
    folder: 'NIRC',
    keywords: ['driving license', 'driver license', 'licence'],
    milestone: 'test_drive',
  },
  PASSPORT: {
    id: 'passport',
    name: 'Passport',
    folder: 'NIRC',
    keywords: ['passport', 'travel document'],
    milestone: 'test_drive',
  },

  // Test Drive Documents
  TEST_DRIVE_FORM: {
    id: 'test_drive_form',
    name: 'Test Drive Form',
    folder: 'Test Drive',
    keywords: ['test drive', 'td form', 'test drive agreement'],
    milestone: 'test_drive',
  },

  // Sales Documents
  VSA_FORM: {
    id: 'vsa_form',
    name: 'VSA Form',
    folder: 'VSA',
    keywords: ['vsa', 'vehicle sales agreement', 'sales agreement'],
    milestone: 'close_deal',
  },
  PDPA_FORM: {
    id: 'pdpa_form',
    name: 'PDPA Consent Form',
    folder: 'VSA',
    keywords: ['pdpa', 'data protection', 'consent form', 'privacy'],
    milestone: 'close_deal',
  },
  COE_BIDDING_FORM: {
    id: 'coe_bidding_form',
    name: 'COE Bidding Form',
    folder: 'VSA',
    keywords: ['coe', 'certificate of entitlement', 'bidding'],
    milestone: 'close_deal',
  },

  // Financial Documents
  LOAN_APPROVAL: {
    id: 'loan_approval',
    name: 'Loan Approval Letter',
    folder: 'Finance',
    keywords: ['loan', 'approval', 'financing', 'bank approval', 'credit'],
    milestone: 'close_deal',
  },
  LOAN_APPLICATION: {
    id: 'loan_application',
    name: 'Loan Application',
    folder: 'Finance',
    keywords: ['loan application', 'financing application'],
    milestone: 'close_deal',
  },
  INCOME_PROOF: {
    id: 'income_proof',
    name: 'Income Proof',
    folder: 'Finance',
    keywords: ['payslip', 'income', 'salary', 'cpf statement', 'ir8a'],
    milestone: 'close_deal',
  },

  // Insurance Documents
  INSURANCE_QUOTATION: {
    id: 'insurance_quotation',
    name: 'Insurance Quotation',
    folder: 'Insurance',
    keywords: ['insurance quote', 'quotation', 'motor insurance'],
    milestone: 'registration',
  },
  INSURANCE_ACCEPTANCE: {
    id: 'insurance_acceptance',
    name: 'Insurance Acceptance',
    folder: 'Insurance',
    keywords: ['insurance acceptance', 'insurance confirmation', 'policy'],
    milestone: 'registration',
  },
  INSURANCE_POLICY: {
    id: 'insurance_policy',
    name: 'Insurance Policy',
    folder: 'Insurance',
    keywords: ['insurance policy', 'motor policy', 'coverage'],
    milestone: 'registration',
  },

  // Payment Documents
  PAYMENT_RECEIPT: {
    id: 'payment_receipt',
    name: 'Payment Receipt',
    folder: 'Payments',
    keywords: ['payment', 'receipt', 'deposit', 'downpayment'],
    milestone: 'registration',
  },
  PROFORMA_INVOICE: {
    id: 'proforma_invoice',
    name: 'Proforma Invoice',
    folder: 'Payments',
    keywords: ['proforma', 'invoice', 'balance payment'],
    milestone: 'registration',
  },

  // Delivery Documents
  DELIVERY_CHECKLIST: {
    id: 'delivery_checklist',
    name: 'Delivery Checklist',
    folder: 'Delivery',
    keywords: ['delivery checklist', 'handover', 'pdi'],
    milestone: 'delivery',
  },
  INSURANCE_CANCELLATION: {
    id: 'insurance_cancellation',
    name: 'Insurance Cancellation Declaration',
    folder: 'Delivery',
    keywords: ['insurance cancellation', 'declaration', 'previous insurance'],
    milestone: 'delivery',
  },
  REGISTRATION_CARD: {
    id: 'registration_card',
    name: 'Vehicle Registration Card',
    folder: 'Delivery',
    keywords: ['registration card', 'log card', 'vehicle registration'],
    milestone: 'delivery',
  },

  // Trade-In Documents
  TRADE_IN_VALUATION: {
    id: 'trade_in_valuation',
    name: 'Trade-In Valuation',
    folder: 'Trade In',
    keywords: ['trade in', 'valuation', 'trade-in'],
    milestone: 'close_deal',
  },
  TRADE_IN_AGREEMENT: {
    id: 'trade_in_agreement',
    name: 'Trade-In Agreement',
    folder: 'Trade In',
    keywords: ['trade in agreement', 'trade-in contract'],
    milestone: 'close_deal',
  },

  // Other
  OTHER: {
    id: 'other',
    name: 'Other Document',
    folder: 'Other',
    keywords: [],
    milestone: null,
  },
};

/**
 * Required documents for each milestone
 * Used to build the document checklist
 */
export const REQUIRED_DOCUMENTS = {
  test_drive: [
    {
      id: 'nric',
      name: 'NRIC / ID',
      description: 'Front and back of Singapore NRIC or FIN card',
      documentTypes: [DOCUMENT_TYPES.NRIC_FRONT.id, DOCUMENT_TYPES.NRIC_BACK.id],
      required: true,
    },
    {
      id: 'driving_license',
      name: 'Driving License',
      description: 'Valid Singapore driving license',
      documentTypes: [DOCUMENT_TYPES.DRIVING_LICENSE.id],
      required: true,
    },
    {
      id: 'test_drive_form',
      name: 'Test Drive Form',
      description: 'Signed test drive agreement form',
      documentTypes: [DOCUMENT_TYPES.TEST_DRIVE_FORM.id],
      required: true,
    },
  ],

  close_deal: [
    {
      id: 'vsa',
      name: 'VSA Form',
      description: 'Vehicle Sales Agreement signed by customer',
      documentTypes: [DOCUMENT_TYPES.VSA_FORM.id],
      required: true,
    },
    {
      id: 'pdpa',
      name: 'PDPA Consent',
      description: 'Personal Data Protection Act consent form',
      documentTypes: [DOCUMENT_TYPES.PDPA_FORM.id],
      required: true,
    },
    {
      id: 'coe_bidding',
      name: 'COE Bidding Form',
      description: 'COE bidding authorization form',
      documentTypes: [DOCUMENT_TYPES.COE_BIDDING_FORM.id],
      required: true,
    },
    {
      id: 'loan_approval',
      name: 'Loan Approval',
      description: 'Bank loan approval letter (if financing)',
      documentTypes: [DOCUMENT_TYPES.LOAN_APPROVAL.id, DOCUMENT_TYPES.LOAN_APPLICATION.id],
      required: false, // Only required if financing
    },
    {
      id: 'trade_in_docs',
      name: 'Trade-In Documents',
      description: 'Trade-in valuation and agreement (if applicable)',
      documentTypes: [DOCUMENT_TYPES.TRADE_IN_VALUATION.id, DOCUMENT_TYPES.TRADE_IN_AGREEMENT.id],
      required: false, // Only required if trading in
    },
  ],

  registration: [
    {
      id: 'insurance_quotation',
      name: 'Insurance Quotation',
      description: 'Motor insurance quotation',
      documentTypes: [DOCUMENT_TYPES.INSURANCE_QUOTATION.id],
      required: true,
    },
    {
      id: 'insurance_acceptance',
      name: 'Insurance Acceptance',
      description: 'Signed insurance acceptance',
      documentTypes: [DOCUMENT_TYPES.INSURANCE_ACCEPTANCE.id, DOCUMENT_TYPES.INSURANCE_POLICY.id],
      required: true,
    },
    {
      id: 'payment_proof',
      name: 'Balance Payment',
      description: 'Proof of balance payment or payment arrangement',
      documentTypes: [DOCUMENT_TYPES.PAYMENT_RECEIPT.id, DOCUMENT_TYPES.PROFORMA_INVOICE.id],
      required: true,
    },
  ],

  delivery: [
    {
      id: 'delivery_checklist',
      name: 'Delivery Checklist',
      description: 'Completed delivery inspection checklist',
      documentTypes: [DOCUMENT_TYPES.DELIVERY_CHECKLIST.id],
      required: true,
    },
    {
      id: 'insurance_cancellation',
      name: 'Insurance Cancellation',
      description: 'Declaration of previous insurance cancellation (if applicable)',
      documentTypes: [DOCUMENT_TYPES.INSURANCE_CANCELLATION.id],
      required: false,
    },
    {
      id: 'registration_card',
      name: 'Registration Card',
      description: 'Vehicle registration card copy for customer',
      documentTypes: [DOCUMENT_TYPES.REGISTRATION_CARD.id],
      required: true,
    },
  ],

  nps: [
    // NPS milestone typically doesn't require documents
  ],
};

/**
 * Document status values
 */
export const DOCUMENT_STATUS = {
  PENDING: 'pending',           // Not yet submitted
  UPLOADED: 'uploaded',         // Uploaded, awaiting review
  APPROVED: 'approved',         // Reviewed and approved
  REJECTED: 'rejected',         // Rejected, needs resubmission
  EXPIRED: 'expired',           // Document has expired
  NOT_APPLICABLE: 'not_applicable', // Not required for this customer
};

/**
 * Get default document checklist state for a new customer
 */
export const getDefaultDocumentChecklist = () => {
  const state = {};

  Object.entries(REQUIRED_DOCUMENTS).forEach(([milestoneId, documents]) => {
    state[milestoneId] = {};
    documents.forEach((doc) => {
      state[milestoneId][doc.id] = {
        status: DOCUMENT_STATUS.PENDING,
        uploadedAt: null,
        uploadedFiles: [], // Array of { fileId, fileName, uploadedAt }
        reviewedAt: null,
        reviewedBy: null,
        notes: '',
      };
    });
  });

  return state;
};

/**
 * Calculate document completion percentage for a milestone
 */
export const getDocumentProgress = (milestoneId, documentChecklist) => {
  if (!documentChecklist || !documentChecklist[milestoneId]) {
    return 0;
  }

  const requiredDocs = REQUIRED_DOCUMENTS[milestoneId];
  if (!requiredDocs || requiredDocs.length === 0) {
    return 100; // No documents required
  }

  const required = requiredDocs.filter(doc => doc.required);
  if (required.length === 0) {
    return 100; // No required documents
  }

  const completed = required.filter(doc => {
    const status = documentChecklist[milestoneId][doc.id]?.status;
    return status === DOCUMENT_STATUS.APPROVED || status === DOCUMENT_STATUS.NOT_APPLICABLE;
  }).length;

  return Math.round((completed / required.length) * 100);
};

/**
 * Check if all required documents are complete for a milestone
 */
export const isDocumentChecklistComplete = (milestoneId, documentChecklist) => {
  return getDocumentProgress(milestoneId, documentChecklist) === 100;
};

/**
 * Get folder name for a document type
 */
export const getDocumentFolder = (documentTypeId) => {
  const docType = Object.values(DOCUMENT_TYPES).find(dt => dt.id === documentTypeId);
  return docType?.folder || 'Other';
};

/**
 * Get all document types as an array for AI classification
 */
export const getDocumentTypesForClassification = () => {
  return Object.values(DOCUMENT_TYPES).map(dt => ({
    id: dt.id,
    name: dt.name,
    keywords: dt.keywords,
    folder: dt.folder,
    milestone: dt.milestone,
  }));
};
