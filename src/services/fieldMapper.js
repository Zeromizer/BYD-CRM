/**
 * FieldMapper - Field type definitions and customer data mapping
 *
 * Centralizes all field types, display names, and data extraction logic
 */

/**
 * All available field types with display names and categories
 */
export const FIELD_TYPES = {
  // Basic Customer Information
  name: { label: 'Customer Name', category: 'Basic Info' },
  phone: { label: 'Phone Number', category: 'Basic Info' },
  email: { label: 'Email', category: 'Basic Info' },
  nric: { label: 'NRIC/FIN', category: 'Basic Info' },
  occupation: { label: 'Occupation', category: 'Basic Info' },
  dob: { label: 'Date of Birth', category: 'Basic Info' },
  address: { label: 'Address', category: 'Basic Info' },
  addressContinue: { label: 'Address Continue', category: 'Basic Info' },
  fullAddress: { label: 'Full Address (Combined)', category: 'Basic Info' },
  salesConsultant: { label: 'Sales Consultant', category: 'Basic Info' },
  vsaNo: { label: 'VSA No', category: 'Basic Info' },
  date: { label: "Today's Date", category: 'Basic Info' },

  // VSA Details - BYD New Car Details
  makeModel: { label: 'Make & Model', category: 'Vehicle Details' },
  yom: { label: 'Year of Manufacture', category: 'Vehicle Details' },
  bodyColour: { label: 'Body Colour', category: 'Vehicle Details' },
  upholstery: { label: 'Upholstery', category: 'Vehicle Details' },
  przType: { label: 'P/R/Z Type', category: 'Vehicle Details' },

  // VSA Details - BYD New Car Package
  package: { label: 'Package', category: 'Vehicle Package' },
  sellingWithCOE: { label: 'Selling with COE', category: 'Vehicle Package' },
  sellingPriceList: { label: 'Selling Price on Price List', category: 'Vehicle Package' },
  purchasePriceWithCOE: { label: 'Purchase Price with COE', category: 'Vehicle Package' },
  coeRebateLevel: { label: 'COE Rebate Level', category: 'Vehicle Package' },
  deposit: { label: 'Deposit', category: 'Vehicle Package' },
  lessOthers: { label: 'Less: Others', category: 'Vehicle Package' },
  addOthers: { label: 'Add: Others', category: 'Vehicle Package' },
  deliveryDate: { label: 'Approximate Delivery Date', category: 'Vehicle Package' },

  // VSA Details - Trade In Car Details
  tradeInCarNo: { label: 'Trade in Car No', category: 'Trade-In' },
  tradeInCarModel: { label: 'Trade in Car Model', category: 'Trade-In' },
  tradeInAmount: { label: 'Trade In Amount', category: 'Trade-In' },
  tradeInOwnerNotCustomer: { label: 'Trade In Owner Not Customer', category: 'Trade-In' },
  tradeInOwnerName: { label: 'Trade In Owner Name', category: 'Trade-In' },
  tradeInOwnerNric: { label: 'Trade In Owner NRIC', category: 'Trade-In' },
  tradeInInsuranceCompany: { label: 'Trade In Insurance Company', category: 'Trade-In' },
  tradeInPolicyNumber: { label: 'Trade In Policy Number', category: 'Trade-In' },

  // VSA Details - Delivery Details
  dateOfRegistration: { label: 'Date of Registration', category: 'Delivery' },
  registrationNo: { label: 'Registration No', category: 'Delivery' },
  chassisNo: { label: 'Chassis No', category: 'Delivery' },
  engineNo: { label: 'Engine No', category: 'Delivery' },
  motorNo: { label: 'Motor No', category: 'Delivery' },

  // VSA Details - Insurance
  insuranceCompany: { label: 'Insurance Company', category: 'Insurance' },
  insuranceFee: { label: 'Insurance Fee', category: 'Insurance' },
  insuranceFeeNet: { label: 'Net Insurance Fee', category: 'Insurance' },

  // VSA Details - Remarks
  remarks1: { label: 'Remarks 1', category: 'Remarks & Loan' },
  remarks2: { label: 'Remarks 2', category: 'Remarks & Loan' },
  loanAmount: { label: 'Loan Amount', category: 'Remarks & Loan' },
  interest: { label: 'Interest', category: 'Remarks & Loan' },
  tenure: { label: 'Tenure', category: 'Remarks & Loan' },
  adminFee: { label: 'Admin Fee', category: 'Remarks & Loan' },
  insuranceSubsidy: { label: 'Insurance Subsidy', category: 'Remarks & Loan' },
  monthlyRepayment: { label: 'Monthly Repayment', category: 'Remarks & Loan' },

  // Proposal Details
  proposalModel: { label: 'Model', category: 'Proposal' },
  proposalBank: { label: 'Bank', category: 'Proposal' },
  proposalSellingPrice: { label: 'Selling Price', category: 'Proposal' },
  proposalInterestRate: { label: 'Interest Rate', category: 'Proposal' },
  proposalDownpayment: { label: 'Downpayment', category: 'Proposal' },
  proposalLoanTenure: { label: 'Loan Tenure', category: 'Proposal' },
  proposalLoanAmount: { label: 'Loan Amount', category: 'Proposal' },
  proposalAdminFee: { label: 'Admin Fee', category: 'Proposal' },
  proposalReferralFee: { label: 'Referral Fee', category: 'Proposal' },
  proposalTradeInModel: { label: 'Trade In Model', category: 'Proposal' },
  proposalLowLoanSurcharge: { label: 'Low Loan Surcharge', category: 'Proposal' },
  proposalTradeInCarPlate: { label: 'Trade In Car Plate', category: 'Proposal' },
  proposalNoLoanSurcharge: { label: 'No Loan Surcharge', category: 'Proposal' },
  proposalQuotedTradeInPrice: { label: 'Quoted Trade In Price', category: 'Proposal' },
  proposalBenefit1: { label: 'Benefit 1', category: 'Proposal' },
  proposalBenefit2: { label: 'Benefit 2', category: 'Proposal' },
  proposalBenefit3: { label: 'Benefit 3', category: 'Proposal' },
  proposalBenefit4: { label: 'Benefit 4', category: 'Proposal' },
  proposalBenefit5: { label: 'Benefit 5', category: 'Proposal' },
  proposalBenefitsGiven: { label: 'Benefits Given', category: 'Proposal' },
  proposalRemarks: { label: 'Remarks', category: 'Proposal' },

  // Special
  custom: { label: 'Custom Value', category: 'Other' },
};

/**
 * Get field types grouped by category
 */
export function getFieldTypesByCategory() {
  const grouped = {};

  Object.entries(FIELD_TYPES).forEach(([key, value]) => {
    const category = value.category;
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push({ key, ...value });
  });

  return grouped;
}

/**
 * Get field display name
 */
export function getFieldLabel(fieldType) {
  return FIELD_TYPES[fieldType]?.label || fieldType;
}

/**
 * Helper function to parse currency strings to numbers
 */
function parseCurrency(value) {
  if (!value) return 0;
  const numericValue = parseFloat(value.toString().replace(/[^0-9.-]/g, ''));
  return isNaN(numericValue) ? 0 : numericValue;
}

/**
 * Extract customer data mapping from customer object
 * This creates a flat object with all possible field values
 */
export function getCustomerDataMapping(customer) {
  if (!customer) return {};

  const today = new Date().toLocaleDateString();

  // Calculate net insurance fee
  const insuranceFee = parseCurrency(customer.vsa_insuranceFee);
  const subsidy = parseCurrency(customer.vsa_insuranceSubsidy);
  const netInsuranceFee = insuranceFee - subsidy;

  return {
    // Basic Customer Information
    name: customer.name || '',
    phone: customer.phone || '',
    email: customer.email || '',
    nric: customer.nric || '',
    occupation: customer.occupation || '',
    dob: customer.dob || '',
    address: customer.address || '',
    addressContinue: customer.addressContinue || '',
    fullAddress: ((customer.address || '') + (customer.addressContinue ? ', ' + customer.addressContinue : '')).trim(),
    salesConsultant: customer.salesConsultant || '',
    vsaNo: customer.vsaNo || '',
    date: today,

    // VSA Details - BYD New Car Details
    makeModel: customer.vsa_makeModel || '',
    yom: customer.vsa_yom || '',
    bodyColour: customer.vsa_bodyColour || '',
    upholstery: customer.vsa_upholstery || '',
    przType: customer.vsa_przType || '',

    // VSA Details - BYD New Car Package
    package: customer.vsa_package || '',
    sellingWithCOE: customer.vsa_sellingWithCOE || '',
    sellingPriceList: customer.vsa_sellingPriceList || '',
    purchasePriceWithCOE: customer.vsa_purchasePriceWithCOE || '',
    coeRebateLevel: customer.vsa_coeRebateLevel || '',
    deposit: customer.vsa_deposit || '',
    lessOthers: customer.vsa_lessOthers || '',
    addOthers: customer.vsa_addOthers || '',
    deliveryDate: customer.vsa_deliveryDate || '',

    // VSA Details - Trade In Car Details
    tradeInCarNo: customer.vsa_tradeInCarNo || '',
    tradeInCarModel: customer.vsa_tradeInCarModel || '',
    tradeInAmount: customer.vsa_tradeInAmount || '',

    // VSA Details - Delivery Details
    dateOfRegistration: customer.vsa_dateOfRegistration || '',
    registrationNo: customer.vsa_registrationNo || '',
    chassisNo: customer.vsa_chassisNo || '',
    engineNo: customer.vsa_engineNo || '',
    motorNo: customer.vsa_motorNo || '',

    // VSA Details - Insurance
    insuranceCompany: customer.vsa_insuranceCompany || '',
    insuranceFee: customer.vsa_insuranceFee || '',
    insuranceFeeNet: netInsuranceFee.toFixed(2),

    // VSA Details - Remarks
    remarks1: customer.vsa_remarks1 || '',
    remarks2: customer.vsa_remarks2 || '',
    loanAmount: customer.vsa_loanAmount || '',
    interest: customer.vsa_interest || '',
    tenure: customer.vsa_tenure || '',
    adminFee: customer.vsa_adminFee || '',
    insuranceSubsidy: customer.vsa_insuranceSubsidy || '',
    monthlyRepayment: customer.vsa_monthlyRepayment || '',

    // Proposal Details
    proposalModel: customer.proposal_model || '',
    proposalBank: customer.proposal_bank || '',
    proposalSellingPrice: customer.proposal_sellingPrice || '',
    proposalInterestRate: customer.proposal_interestRate || '',
    proposalDownpayment: customer.proposal_downpayment || '',
    proposalLoanTenure: customer.proposal_loanTenure || '',
    proposalLoanAmount: customer.proposal_loanAmount || '',
    proposalAdminFee: customer.proposal_adminFee || '',
    proposalReferralFee: customer.proposal_referralFee || '',
    proposalTradeInModel: customer.proposal_tradeInModel || '',
    proposalLowLoanSurcharge: customer.proposal_lowLoanSurcharge || '',
    proposalTradeInCarPlate: customer.proposal_tradeInCarPlate || '',
    proposalNoLoanSurcharge: customer.proposal_noLoanSurcharge || '',
    proposalQuotedTradeInPrice: customer.proposal_quotedTradeInPrice || '',
    proposalBenefit1: customer.proposal_benefit1 || '',
    proposalBenefit2: customer.proposal_benefit2 || '',
    proposalBenefit3: customer.proposal_benefit3 || '',
    proposalBenefit4: customer.proposal_benefit4 || '',
    proposalBenefit5: customer.proposal_benefit5 || '',
    proposalBenefitsGiven: customer.proposal_benefitsGiven || '',
    proposalRemarks: customer.proposal_remarks || '',
  };
}

/**
 * Get sample data for preview purposes
 */
export function getSampleCustomerData() {
  return {
    name: 'John Tan Wei Ming',
    phone: '+65 9123 4567',
    email: 'john.tan@example.com',
    nric: 'S1234567A',
    occupation: 'Software Engineer',
    dob: '15/03/1985',
    address: '123 Orchard Road #12-34',
    addressContinue: 'Singapore 238858',
    fullAddress: '123 Orchard Road #12-34, Singapore 238858',
    salesConsultant: 'Jane Lee',
    vsaNo: 'VSA2025-001',
    date: new Date().toLocaleDateString(),

    // Vehicle details
    makeModel: 'BYD ATTO 3',
    yom: '2025',
    bodyColour: 'Boulder Grey',
    upholstery: 'Black Leather',
    przType: 'P',

    // Package
    package: 'Premium',
    sellingWithCOE: '$185,888',
    sellingPriceList: '$180,000',
    purchasePriceWithCOE: '$185,888',
    coeRebateLevel: 'Level 1',
    deposit: '$18,588',
    lessOthers: '$0',
    addOthers: '$0',
    deliveryDate: '30/06/2025',

    // Trade-in
    tradeInCarNo: 'SXX1234A',
    tradeInCarModel: 'Honda Civic 2018',
    tradeInAmount: '$15,000',

    // Delivery
    dateOfRegistration: '15/06/2025',
    registrationNo: 'SYY9876B',
    chassisNo: 'BYD2025ABC123456',
    engineNo: 'ENG2025XYZ789',
    motorNo: 'MOT2025LMN456',

    // Insurance
    insuranceCompany: 'AIG Insurance',
    insuranceFee: '$1,800',
    insuranceFeeNet: '1650.00',

    // Remarks & Loan
    remarks1: 'Customer prefers early delivery',
    remarks2: 'VIP customer',
    loanAmount: '$150,000',
    interest: '2.88%',
    tenure: '7 years',
    adminFee: '$500',
    insuranceSubsidy: '$150',
    monthlyRepayment: '$1,950',

    // Proposal
    proposalModel: 'BYD ATTO 3 Premium',
    proposalBank: 'DBS Bank',
    proposalSellingPrice: '$185,888',
    proposalInterestRate: '2.88%',
    proposalDownpayment: '$35,888',
    proposalLoanTenure: '7 years',
    proposalLoanAmount: '$150,000',
    proposalAdminFee: '$500',
    proposalReferralFee: '$300',
    proposalTradeInModel: 'Honda Civic',
    proposalLowLoanSurcharge: '$0',
    proposalTradeInCarPlate: 'SXX1234A',
    proposalNoLoanSurcharge: '$0',
    proposalQuotedTradeInPrice: '$15,000',
    proposalBenefit1: 'Free charging cable',
    proposalBenefit2: 'Extended warranty',
    proposalBenefit3: 'Free tinting',
    proposalBenefit4: 'Free floor mats',
    proposalBenefit5: 'Complimentary first service',
    proposalBenefitsGiven: 'Charging cable, Extended warranty, Tinting',
    proposalRemarks: 'Customer is very interested, follow up in 2 days',
  };
}

/**
 * Standard font sizes in points (pt)
 */
export const FONT_SIZES = [
  6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 44, 48, 54, 60, 72
];

/**
 * Standard font families
 */
export const FONT_FAMILIES = [
  { value: 'Arial', label: 'Arial' },
  { value: 'Helvetica', label: 'Helvetica' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Courier', label: 'Courier' },
  { value: 'Verdana', label: 'Verdana' },
  { value: 'Georgia', label: 'Georgia' },
];

/**
 * Text alignments
 */
export const TEXT_ALIGNMENTS = [
  { value: 'left', label: 'Left', icon: '⬅️' },
  { value: 'center', label: 'Center', icon: '↔️' },
  { value: 'right', label: 'Right', icon: '➡️' },
];
