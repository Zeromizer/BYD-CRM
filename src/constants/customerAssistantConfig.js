/**
 * Customer Assistant Configuration
 *
 * Comprehensive configuration for AI-powered customer messaging assistant.
 * Defines message types, triggers, document mappings, and AI contexts for
 * each milestone stage from VSA signing to delivery.
 */

/**
 * Message Categories - Types of communications
 */
export const MESSAGE_CATEGORIES = {
  WELCOME: 'welcome',
  CONFIRMATION: 'confirmation',
  REMINDER: 'reminder',
  UPDATE: 'update',
  DOCUMENT_REQUEST: 'document_request',
  DOCUMENT_SHARING: 'document_sharing',
  FOLLOW_UP: 'follow_up',
  CELEBRATION: 'celebration',
  FEEDBACK: 'feedback',
};

/**
 * Message Priority Levels
 */
export const MESSAGE_PRIORITY = {
  URGENT: 'urgent',      // Overdue or critical action needed
  HIGH: 'high',          // Due today or tomorrow
  MEDIUM: 'medium',      // Due within 3 days
  LOW: 'low',            // Scheduled or informational
};

/**
 * Document Categories that can be attached to messages
 */
export const DOCUMENT_CATEGORIES = {
  VSA: 'VSA',
  PDPA: 'PDPA & COE',
  INSURANCE: 'Insurance',
  LOAN: 'Loan',
  TRADE_IN: 'Trade In',
  TEST_DRIVE: 'Test Drive',
  DELIVERY: 'Delivery',
  INVOICE: 'Invoice',
  OTHER: 'Other',
};

/**
 * Comprehensive Message Framework
 *
 * Each milestone has defined message actions with:
 * - id: Unique identifier
 * - category: Type of message
 * - title: Display title
 * - description: What this message is for
 * - trigger: When to show this action (conditions)
 * - template: Base message template with placeholders
 * - aiContext: Context for AI to generate personalized message
 * - documents: Related documents to potentially attach
 * - priority: Default priority calculation
 */
export const MESSAGE_FRAMEWORK = {
  // ============================================
  // STAGE 1: TEST DRIVE
  // ============================================
  test_drive: {
    stageName: 'Test Drive',
    stageDescription: 'Customer inquiry and test drive phase',
    messages: [
      {
        id: 'td_welcome',
        category: MESSAGE_CATEGORIES.WELCOME,
        title: 'Welcome & Introduction',
        description: 'Initial greeting after customer inquiry',
        trigger: {
          type: 'manual',
          condition: 'New customer added to CRM',
        },
        template: `Hi {customerName}! Thank you for your interest in BYD. I'm {salesConsultant}, and I'll be assisting you with your BYD journey. Would you like to schedule a test drive to experience the {vehicleModel}?`,
        aiContext: 'New potential customer showing interest. Be welcoming and professional. Focus on scheduling a test drive.',
        documents: [],
        priority: (customer) => MESSAGE_PRIORITY.HIGH,
      },
      {
        id: 'td_scheduled',
        category: MESSAGE_CATEGORIES.CONFIRMATION,
        title: 'Test Drive Confirmation',
        description: 'Confirm scheduled test drive appointment',
        trigger: {
          type: 'checklist',
          milestoneId: 'test_drive',
          itemId: 'test_drive_form',
          condition: 'completed',
        },
        template: `Hi {customerName}! Your test drive for the {vehicleModel} is confirmed for {testDriveDate}. Please bring your valid driving license. I'll meet you at our showroom. Any questions, just reply here!`,
        aiContext: 'Test drive has been scheduled. Confirm details and remind about requirements (driving license). Be enthusiastic about them experiencing the car.',
        documents: ['Test Drive'],
        priority: (customer) => MESSAGE_PRIORITY.MEDIUM,
      },
      {
        id: 'td_reminder',
        category: MESSAGE_CATEGORIES.REMINDER,
        title: 'Test Drive Reminder (Day Before)',
        description: 'Remind customer about upcoming test drive',
        trigger: {
          type: 'date',
          dateField: 'milestoneDates.test_drive',
          daysBefore: 1,
        },
        template: `Hi {customerName}! Just a friendly reminder about your test drive tomorrow for the {vehicleModel}. Looking forward to showing you what BYD has to offer! See you soon.`,
        aiContext: 'Test drive is tomorrow. Send a friendly reminder. Build excitement about the experience.',
        documents: [],
        priority: (customer) => MESSAGE_PRIORITY.HIGH,
      },
      {
        id: 'td_followup',
        category: MESSAGE_CATEGORIES.FOLLOW_UP,
        title: 'Post Test Drive Follow-up',
        description: 'Follow up after test drive to gauge interest',
        trigger: {
          type: 'checklist',
          milestoneId: 'test_drive',
          itemId: 'input_byd_crm_td',
          condition: 'completed',
        },
        template: `Hi {customerName}! Thank you for taking the time to test drive the {vehicleModel} today. What did you think of the driving experience? I'd love to hear your thoughts and answer any questions you might have.`,
        aiContext: 'Customer just completed test drive. Ask about their experience, address any concerns, and gently move towards discussing purchase options.',
        documents: [],
        priority: (customer) => MESSAGE_PRIORITY.HIGH,
      },
      {
        id: 'td_brochure',
        category: MESSAGE_CATEGORIES.DOCUMENT_SHARING,
        title: 'Share Vehicle Brochure',
        description: 'Send vehicle specifications and features',
        trigger: {
          type: 'manual',
          condition: 'Customer interested in specifications',
        },
        template: `Hi {customerName}! As requested, here's the detailed brochure for the {vehicleModel}. It covers all the specifications, features, and pricing. Let me know if you have any questions!`,
        aiContext: 'Customer wants more information about the vehicle. Share brochure and offer to explain any features in detail.',
        documents: ['VSA'],
        priority: (customer) => MESSAGE_PRIORITY.MEDIUM,
      },
    ],
  },

  // ============================================
  // STAGE 2: COE BIDDING (Close Deal)
  // ============================================
  close_deal: {
    stageName: 'COE Bidding',
    stageDescription: 'Customer committed, processing VSA and COE bidding',
    messages: [
      {
        id: 'cd_congratulations',
        category: MESSAGE_CATEGORIES.CELEBRATION,
        title: 'Congratulations on Decision',
        description: 'Celebrate customer decision to purchase',
        trigger: {
          type: 'milestone_change',
          fromMilestone: 'test_drive',
          toMilestone: 'close_deal',
        },
        template: `Hi {customerName}! Congratulations on your decision to join the BYD family with the {vehicleModel}! I'm excited to help you through the next steps. Let's get your paperwork sorted!`,
        aiContext: 'Customer has decided to purchase. Celebrate their decision and assure them of a smooth process ahead.',
        documents: [],
        priority: (customer) => MESSAGE_PRIORITY.HIGH,
      },
      {
        id: 'cd_vsa_documents',
        category: MESSAGE_CATEGORIES.DOCUMENT_REQUEST,
        title: 'VSA Documents Required',
        description: 'Request documents for VSA signing',
        trigger: {
          type: 'checklist',
          milestoneId: 'close_deal',
          itemId: 'vsa_details_filled',
          condition: 'not_completed',
        },
        template: `Hi {customerName}! To proceed with your {vehicleModel} purchase, I'll need the following documents:\n\n📋 NRIC (front & back)\n📋 Proof of address\n📋 Driving license\n\nPlease send them when ready, and I'll prepare your VSA.`,
        aiContext: 'Need to collect documents for VSA. List the required documents clearly and professionally.',
        documents: ['PDPA & COE'],
        priority: (customer) => MESSAGE_PRIORITY.HIGH,
      },
      {
        id: 'cd_vsa_ready',
        category: MESSAGE_CATEGORIES.DOCUMENT_SHARING,
        title: 'VSA Ready for Signing',
        description: 'Share VSA document for review and signing',
        trigger: {
          type: 'checklist',
          milestoneId: 'close_deal',
          itemId: 'vsa_pdpa_coe_forms',
          condition: 'completed',
        },
        template: `Hi {customerName}! Great news - your Vehicle Sales Agreement for the {vehicleModel} is ready! Please review the attached VSA and let me know if everything looks correct. We can arrange a time for signing.`,
        aiContext: 'VSA is prepared and ready for customer review. Invite them to review and schedule signing.',
        documents: ['VSA', 'PDPA & COE'],
        priority: (customer) => MESSAGE_PRIORITY.HIGH,
      },
      {
        id: 'cd_insurance_quote',
        category: MESSAGE_CATEGORIES.UPDATE,
        title: 'Insurance Quotation',
        description: 'Share insurance quotation options',
        trigger: {
          type: 'checklist',
          milestoneId: 'close_deal',
          itemId: 'submit_insurance_quotation',
          condition: 'completed',
        },
        template: `Hi {customerName}! I've got the insurance quotations for your {vehicleModel}. Here are your options:\n\n{insuranceDetails}\n\nLet me know which one works best for you!`,
        aiContext: 'Insurance quotations are ready. Present options clearly and help customer make a decision.',
        documents: ['Insurance'],
        priority: (customer) => MESSAGE_PRIORITY.MEDIUM,
      },
      {
        id: 'cd_loan_update',
        category: MESSAGE_CATEGORIES.UPDATE,
        title: 'Loan Application Update',
        description: 'Update on loan application status',
        trigger: {
          type: 'checklist',
          milestoneId: 'close_deal',
          itemId: 'loan_approved',
          condition: 'completed',
        },
        template: `Hi {customerName}! Great news! Your loan application has been approved! 🎉\n\nLoan Amount: ${'{loanAmount}'}\nTenure: {tenure} months\nMonthly: ${'{monthlyRepayment}'}\n\nWe're one step closer to getting you your {vehicleModel}!`,
        aiContext: 'Loan has been approved. Share the good news with enthusiasm and provide key loan details.',
        documents: ['Loan'],
        priority: (customer) => MESSAGE_PRIORITY.HIGH,
      },
      {
        id: 'cd_coe_bidding',
        category: MESSAGE_CATEGORIES.UPDATE,
        title: 'COE Bidding Update',
        description: 'Update on COE bidding status',
        trigger: {
          type: 'date',
          dateField: 'milestoneDates.close_deal',
          daysBefore: 0,
        },
        template: `Hi {customerName}! Just to update you - we're bidding for your COE today. I'll keep you posted on the results. Fingers crossed! 🤞`,
        aiContext: 'COE bidding is happening. Keep customer informed and manage expectations.',
        documents: [],
        priority: (customer) => MESSAGE_PRIORITY.HIGH,
      },
      {
        id: 'cd_coe_success',
        category: MESSAGE_CATEGORIES.CELEBRATION,
        title: 'COE Successfully Obtained',
        description: 'Celebrate successful COE bidding',
        trigger: {
          type: 'milestone_change',
          fromMilestone: 'close_deal',
          toMilestone: 'registration',
        },
        template: `Hi {customerName}! GREAT NEWS! 🎉 We've successfully secured the COE for your {vehicleModel}! Your car is now being prepared for registration. I'll update you on the next steps soon!`,
        aiContext: 'COE bidding successful. Celebrate with customer and explain next steps.',
        documents: [],
        priority: (customer) => MESSAGE_PRIORITY.HIGH,
      },
    ],
  },

  // ============================================
  // STAGE 3: REGISTRATION
  // ============================================
  registration: {
    stageName: 'Registration',
    stageDescription: 'Vehicle registration and final payment processing',
    messages: [
      {
        id: 'reg_started',
        category: MESSAGE_CATEGORIES.UPDATE,
        title: 'Registration Process Started',
        description: 'Inform customer registration has begun',
        trigger: {
          type: 'milestone_change',
          fromMilestone: 'close_deal',
          toMilestone: 'registration',
        },
        template: `Hi {customerName}! Your {vehicleModel} is now in the registration process! This usually takes about 1-2 weeks. I'll keep you updated on the progress. Exciting times ahead! 🚗`,
        aiContext: 'Vehicle is being registered. Set expectations on timeline and keep enthusiasm high.',
        documents: [],
        priority: (customer) => MESSAGE_PRIORITY.MEDIUM,
      },
      {
        id: 'reg_insurance_confirm',
        category: MESSAGE_CATEGORIES.CONFIRMATION,
        title: 'Insurance Confirmation',
        description: 'Confirm insurance acceptance and details',
        trigger: {
          type: 'checklist',
          milestoneId: 'registration',
          itemId: 'insurance_accepted',
          condition: 'completed',
        },
        template: `Hi {customerName}! Your insurance for the {vehicleModel} has been confirmed:\n\nInsurer: {insuranceCompany}\nCoverage: Comprehensive\n\nYour vehicle is protected from day one of delivery!`,
        aiContext: 'Insurance is confirmed. Reassure customer their vehicle will be protected.',
        documents: ['Insurance'],
        priority: (customer) => MESSAGE_PRIORITY.MEDIUM,
      },
      {
        id: 'reg_balance_payment',
        category: MESSAGE_CATEGORIES.DOCUMENT_REQUEST,
        title: 'Balance Payment Request',
        description: 'Request balance payment before delivery',
        trigger: {
          type: 'checklist',
          milestoneId: 'registration',
          itemId: 'balance_payment_secured',
          condition: 'not_completed',
        },
        template: `Hi {customerName}! Your {vehicleModel} is almost ready! To proceed with delivery, the balance payment of ${'{balanceAmount}'} is due.\n\nPayment options:\n💳 Bank transfer\n💳 Cheque\n💳 Cashier's order\n\nPlease let me know once done!`,
        aiContext: 'Balance payment is needed. Be clear about amount and payment options while maintaining positive tone.',
        documents: ['Invoice'],
        priority: (customer) => MESSAGE_PRIORITY.HIGH,
      },
      {
        id: 'reg_invoice_share',
        category: MESSAGE_CATEGORIES.DOCUMENT_SHARING,
        title: 'Share Performa Invoice',
        description: 'Send invoice for balance payment',
        trigger: {
          type: 'checklist',
          milestoneId: 'registration',
          itemId: 'performa_invoice_balance_payment',
          condition: 'completed',
        },
        template: `Hi {customerName}! Please find attached the performa invoice for your {vehicleModel} balance payment. Let me know if you have any questions about the breakdown.`,
        aiContext: 'Sharing invoice document. Offer to explain any items if needed.',
        documents: ['Invoice'],
        priority: (customer) => MESSAGE_PRIORITY.MEDIUM,
      },
      {
        id: 'reg_payment_received',
        category: MESSAGE_CATEGORIES.CONFIRMATION,
        title: 'Payment Received Confirmation',
        description: 'Confirm balance payment received',
        trigger: {
          type: 'checklist',
          milestoneId: 'registration',
          itemId: 'balance_payment_secured',
          condition: 'completed',
        },
        template: `Hi {customerName}! Thank you! We've received your balance payment for the {vehicleModel}. Your car is now being prepared for delivery. I'll confirm the delivery date with you very soon! 🎉`,
        aiContext: 'Payment received. Thank customer and build excitement for upcoming delivery.',
        documents: [],
        priority: (customer) => MESSAGE_PRIORITY.MEDIUM,
      },
      {
        id: 'reg_number_assigned',
        category: MESSAGE_CATEGORIES.CELEBRATION,
        title: 'Vehicle Number Assigned',
        description: 'Share the registered vehicle number',
        trigger: {
          type: 'field_updated',
          field: 'vsa_registrationNo',
        },
        template: `Hi {customerName}! Exciting news! Your {vehicleModel} has been registered! 🎉\n\nYour vehicle number is: {registrationNo}\n\nWe're now preparing for delivery!`,
        aiContext: 'Vehicle is registered with number plate. Share the exciting news and vehicle number.',
        documents: [],
        priority: (customer) => MESSAGE_PRIORITY.HIGH,
      },
    ],
  },

  // ============================================
  // STAGE 4: DELIVERY
  // ============================================
  delivery: {
    stageName: 'Delivery',
    stageDescription: 'Final preparation and vehicle handover',
    messages: [
      {
        id: 'del_schedule',
        category: MESSAGE_CATEGORIES.CONFIRMATION,
        title: 'Delivery Date Scheduling',
        description: 'Schedule and confirm delivery date',
        trigger: {
          type: 'milestone_change',
          fromMilestone: 'registration',
          toMilestone: 'delivery',
        },
        template: `Hi {customerName}! The big day is approaching! Your {vehicleModel} ({registrationNo}) is ready for delivery! 🎉\n\nLet's schedule your delivery. When would be a good time for you? We're available:\n📅 Weekdays: 10am - 7pm\n📅 Weekends: 10am - 5pm`,
        aiContext: 'Vehicle is ready for delivery. Help schedule a convenient time for handover.',
        documents: [],
        priority: (customer) => MESSAGE_PRIORITY.HIGH,
      },
      {
        id: 'del_confirmed',
        category: MESSAGE_CATEGORIES.CONFIRMATION,
        title: 'Delivery Confirmed',
        description: 'Confirm scheduled delivery date and time',
        trigger: {
          type: 'checklist',
          milestoneId: 'delivery',
          itemId: 'delivery_details_filled',
          condition: 'completed',
        },
        template: `Hi {customerName}! Your delivery is confirmed! 🎉\n\n📅 Date: {deliveryDate}\n📍 Location: BYD Showroom\n🚗 Vehicle: {vehicleModel} ({registrationNo})\n\nPlease bring:\n✅ NRIC\n✅ Driving license\n\nSee you soon!`,
        aiContext: 'Delivery is scheduled. Confirm all details and remind what to bring.',
        documents: ['Delivery'],
        priority: (customer) => MESSAGE_PRIORITY.HIGH,
      },
      {
        id: 'del_reminder_3days',
        category: MESSAGE_CATEGORIES.REMINDER,
        title: 'Delivery Reminder (3 Days)',
        description: 'Reminder 3 days before delivery',
        trigger: {
          type: 'date',
          dateField: 'milestoneDates.delivery',
          daysBefore: 3,
        },
        template: `Hi {customerName}! Just 3 days until you receive your {vehicleModel}! 🎉 We're getting everything ready for your special day. Don't forget to bring your NRIC and driving license!`,
        aiContext: 'Delivery is in 3 days. Build excitement and remind about requirements.',
        documents: [],
        priority: (customer) => MESSAGE_PRIORITY.MEDIUM,
      },
      {
        id: 'del_reminder_1day',
        category: MESSAGE_CATEGORIES.REMINDER,
        title: 'Delivery Reminder (Day Before)',
        description: 'Reminder day before delivery',
        trigger: {
          type: 'date',
          dateField: 'milestoneDates.delivery',
          daysBefore: 1,
        },
        template: `Hi {customerName}! Tomorrow is the big day! 🎉 Can't wait to hand you the keys to your brand new {vehicleModel} ({registrationNo})!\n\nRemember to bring:\n✅ NRIC\n✅ Driving license\n\nSee you tomorrow!`,
        aiContext: 'Delivery is tomorrow. Maximum excitement, final reminders.',
        documents: [],
        priority: (customer) => MESSAGE_PRIORITY.HIGH,
      },
      {
        id: 'del_day_of',
        category: MESSAGE_CATEGORIES.CONFIRMATION,
        title: 'Delivery Day Message',
        description: 'Message on delivery day',
        trigger: {
          type: 'date',
          dateField: 'milestoneDates.delivery',
          daysBefore: 0,
        },
        template: `Hi {customerName}! Today's the day! 🎉🚗 Your {vehicleModel} is polished and ready for you! We can't wait to see you at {deliveryTime}. Safe travels on your way here!`,
        aiContext: 'It\'s delivery day! Maximum excitement and warm welcome.',
        documents: [],
        priority: (customer) => MESSAGE_PRIORITY.HIGH,
      },
      {
        id: 'del_checklist',
        category: MESSAGE_CATEGORIES.DOCUMENT_SHARING,
        title: 'Delivery Checklist',
        description: 'Share delivery checklist and documents',
        trigger: {
          type: 'checklist',
          milestoneId: 'delivery',
          itemId: 'delivery_checklist_form',
          condition: 'completed',
        },
        template: `Hi {customerName}! Here's your delivery checklist and insurance documents for your {vehicleModel}. Please keep these for your records. Let me know if you need anything else!`,
        aiContext: 'Sharing delivery documentation. Be helpful and organized.',
        documents: ['Delivery', 'Insurance'],
        priority: (customer) => MESSAGE_PRIORITY.MEDIUM,
      },
      {
        id: 'del_congratulations',
        category: MESSAGE_CATEGORIES.CELEBRATION,
        title: 'Delivery Congratulations',
        description: 'Congratulate after successful delivery',
        trigger: {
          type: 'milestone_change',
          fromMilestone: 'delivery',
          toMilestone: 'nps',
        },
        template: `Congratulations {customerName}! 🎉🚗 Welcome to the BYD family!\n\nYour {vehicleModel} ({registrationNo}) is now officially yours! Thank you for trusting us with your car journey.\n\nIf you have any questions about your new car, I'm just a message away! Enjoy the ride! 🙌`,
        aiContext: 'Delivery completed successfully. Celebrate with customer and welcome them to the BYD family.',
        documents: [],
        priority: (customer) => MESSAGE_PRIORITY.HIGH,
      },
    ],
  },

  // ============================================
  // STAGE 5: NPS (After Delivery)
  // ============================================
  nps: {
    stageName: 'NPS',
    stageDescription: 'Post-delivery follow-up and customer satisfaction',
    messages: [
      {
        id: 'nps_day1',
        category: MESSAGE_CATEGORIES.FOLLOW_UP,
        title: 'Day 1 Check-in',
        description: 'Check in one day after delivery',
        trigger: {
          type: 'date',
          dateField: 'milestoneDates.nps',
          daysBefore: -1, // 1 day after
        },
        template: `Hi {customerName}! How's your first day with your new {vehicleModel}? 🚗 Hope you're enjoying the drive! If you have any questions about the features or controls, feel free to ask!`,
        aiContext: 'First day after delivery. Check if they\'re enjoying the car and offer help with features.',
        documents: [],
        priority: (customer) => MESSAGE_PRIORITY.MEDIUM,
      },
      {
        id: 'nps_week1',
        category: MESSAGE_CATEGORIES.FOLLOW_UP,
        title: 'Week 1 Follow-up',
        description: 'Follow up after one week of ownership',
        trigger: {
          type: 'date',
          dateField: 'milestoneDates.nps',
          daysBefore: -7, // 7 days after
        },
        template: `Hi {customerName}! It's been a week since you got your {vehicleModel}! How are you finding it? Any features you're particularly enjoying? Let me know if you need any tips or have questions!`,
        aiContext: 'One week into ownership. Check satisfaction, offer tips, build relationship.',
        documents: [],
        priority: (customer) => MESSAGE_PRIORITY.MEDIUM,
      },
      {
        id: 'nps_survey',
        category: MESSAGE_CATEGORIES.FEEDBACK,
        title: 'NPS Survey Request',
        description: 'Request customer satisfaction feedback',
        trigger: {
          type: 'checklist',
          milestoneId: 'nps',
          itemId: 'nps_survey_sent',
          condition: 'not_completed',
        },
        template: `Hi {customerName}! We hope you're loving your {vehicleModel}! 🚗\n\nWe'd really appreciate your feedback on your experience with us. Would you mind taking a quick survey?\n\n[Survey Link]\n\nYour feedback helps us serve you and future customers better! Thank you! 🙏`,
        aiContext: 'Requesting NPS survey. Be appreciative and explain the value of their feedback.',
        documents: [],
        priority: (customer) => MESSAGE_PRIORITY.MEDIUM,
      },
      {
        id: 'nps_thank_you',
        category: MESSAGE_CATEGORIES.CELEBRATION,
        title: 'Thank You for Feedback',
        description: 'Thank customer for completing survey',
        trigger: {
          type: 'checklist',
          milestoneId: 'nps',
          itemId: 'nps_response_received',
          condition: 'completed',
        },
        template: `Hi {customerName}! Thank you so much for your feedback! 🙏 We really appreciate you taking the time. If there's ever anything we can help with, don't hesitate to reach out. Enjoy your {vehicleModel}! 🚗`,
        aiContext: 'Customer completed survey. Thank them sincerely.',
        documents: [],
        priority: (customer) => MESSAGE_PRIORITY.LOW,
      },
      {
        id: 'nps_referral',
        category: MESSAGE_CATEGORIES.FOLLOW_UP,
        title: 'Referral Request',
        description: 'Ask for referrals if customer is satisfied',
        trigger: {
          type: 'manual',
          condition: 'Positive NPS response received',
        },
        template: `Hi {customerName}! So glad you're enjoying your {vehicleModel}! 😊 If you know anyone who might be interested in a BYD, I'd be happy to take care of them the same way. We also have a referral program with benefits for you! Let me know if you'd like details.`,
        aiContext: 'Customer is happy. Gently ask for referrals and mention referral benefits.',
        documents: [],
        priority: (customer) => MESSAGE_PRIORITY.LOW,
      },
      {
        id: 'nps_service_reminder',
        category: MESSAGE_CATEGORIES.REMINDER,
        title: 'First Service Reminder',
        description: 'Remind about first service appointment',
        trigger: {
          type: 'date',
          dateField: 'milestoneDates.nps',
          daysBefore: -30, // 30 days after (roughly when first service might be due)
        },
        template: `Hi {customerName}! Just a heads up - your {vehicleModel} might be due for its first service soon! Would you like me to help you schedule an appointment at the service center? 🔧`,
        aiContext: 'First service might be approaching. Offer to help schedule.',
        documents: [],
        priority: (customer) => MESSAGE_PRIORITY.LOW,
      },
    ],
  },
};

/**
 * Document Mapping per Milestone
 * Defines which document folders are relevant at each stage
 */
export const MILESTONE_DOCUMENT_MAPPING = {
  test_drive: {
    primary: ['Test Drive'],
    secondary: [],
    canAttach: ['Test Drive'],
  },
  close_deal: {
    primary: ['VSA', 'PDPA & COE'],
    secondary: ['Insurance', 'Loan'],
    canAttach: ['VSA', 'PDPA & COE', 'Insurance', 'Loan'],
  },
  registration: {
    primary: ['Insurance', 'Invoice'],
    secondary: ['VSA'],
    canAttach: ['Insurance', 'Invoice', 'VSA'],
  },
  delivery: {
    primary: ['Delivery', 'Insurance'],
    secondary: ['Invoice'],
    canAttach: ['Delivery', 'Insurance', 'Invoice'],
  },
  nps: {
    primary: [],
    secondary: ['Delivery'],
    canAttach: [],
  },
};

/**
 * AI Context Builder Configuration
 * Additional context to provide AI for better message generation
 */
export const AI_CONTEXT_FIELDS = {
  // Basic customer info always included
  basic: ['name', 'phone', 'email', 'salesConsultant'],

  // Vehicle info
  vehicle: [
    'vsa_makeModel',
    'vsa_variant',
    'vsa_bodyColour',
    'vsa_registrationNo',
    'proposal_model',
  ],

  // Financial info
  financial: [
    'vsa_sellingWithCOE',
    'vsa_deposit',
    'vsa_loanAmount',
    'vsa_monthlyRepayment',
    'vsa_insuranceCompany',
  ],

  // Dates
  dates: [
    'vsa_deliveryDate',
    'milestoneDates',
  ],

  // Progress info
  progress: [
    'checklist',
    'dealClosed',
  ],
};

/**
 * Quick Reply Suggestions per Message Category
 */
export const QUICK_REPLY_SUGGESTIONS = {
  [MESSAGE_CATEGORIES.WELCOME]: [
    'Yes, I\'d like to schedule a test drive',
    'Can you tell me more about the vehicle?',
    'What promotions are available?',
  ],
  [MESSAGE_CATEGORIES.CONFIRMATION]: [
    'Confirmed, see you then!',
    'Can we reschedule?',
    'What should I bring?',
  ],
  [MESSAGE_CATEGORIES.REMINDER]: [
    'Thanks for the reminder!',
    'I\'ll be there',
    'Need to reschedule',
  ],
  [MESSAGE_CATEGORIES.DOCUMENT_REQUEST]: [
    'I\'ll send them today',
    'Which documents exactly?',
    'Can I send them tomorrow?',
  ],
  [MESSAGE_CATEGORIES.DOCUMENT_SHARING]: [
    'Received, thank you!',
    'I have a question about...',
    'Looks good!',
  ],
  [MESSAGE_CATEGORIES.UPDATE]: [
    'Thanks for the update!',
    'What\'s the next step?',
    'When will I hear more?',
  ],
  [MESSAGE_CATEGORIES.CELEBRATION]: [
    'Thank you so much!',
    'Very excited!',
    'Can\'t wait!',
  ],
  [MESSAGE_CATEGORIES.FEEDBACK]: [
    'Sure, happy to help!',
    'I\'ll do it now',
    'Remind me later',
  ],
  [MESSAGE_CATEGORIES.FOLLOW_UP]: [
    'Everything is great!',
    'I have a question',
    'All good, thanks!',
  ],
};

/**
 * Get all messages for a specific milestone
 */
export const getMessagesForMilestone = (milestoneId) => {
  return MESSAGE_FRAMEWORK[milestoneId]?.messages || [];
};

/**
 * Get message by ID
 */
export const getMessageById = (messageId) => {
  for (const milestone of Object.values(MESSAGE_FRAMEWORK)) {
    const message = milestone.messages.find(m => m.id === messageId);
    if (message) return message;
  }
  return null;
};

/**
 * Get all messages across all milestones
 */
export const getAllMessages = () => {
  const allMessages = [];
  for (const [milestoneId, milestone] of Object.entries(MESSAGE_FRAMEWORK)) {
    for (const message of milestone.messages) {
      allMessages.push({
        ...message,
        milestoneId,
        milestoneName: milestone.stageName,
      });
    }
  }
  return allMessages;
};

export default MESSAGE_FRAMEWORK;
