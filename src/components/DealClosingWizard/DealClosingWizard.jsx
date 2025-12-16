import { useState, useMemo, useCallback, useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, ChevronRight, Printer, FileText, User, Car, CreditCard, ClipboardList, Save, Edit3, Settings, ArrowRightLeft } from 'lucide-react';
import Modal from '../Modal/Modal';
import { VEHICLE_MODELS, BODY_COLOURS, BANKS } from '../../constants/vehicleData';
import './DealClosingWizard.css';

/**
 * DealClosingWizard - Step-by-step guide for closing a deal
 *
 * Ensures all required customer details and documents are ready
 * before the customer leaves, preventing missing items.
 *
 * Step 0: Deal Setup - Configure deal requirements (loan bank, trade-in options)
 * Step 1: Customer Details - Verify and fill customer information
 * Step 2: VSA Details - Verify vehicle and pricing details
 * Step 3: Print Documents - Print all required documents
 * Step 4: Signatures - Collect all signatures
 */

// Banks that require physical paper signatures (not digital)
const PHYSICAL_SIGNATURE_BANKS = ['Hong Leong Finance', 'Motorway Credit'];

// Currency fields that should be stored as plain numbers for Excel compatibility
const CURRENCY_FIELDS = [
  'vsa_sellingWithCOE',
  'vsa_purchasePriceWithCOE',
  'vsa_deposit',
  'vsa_loanAmount',
  'vsa_monthlyRepayment',
  'vsa_tradeInAmount',
];

// Parse currency string to plain number (strips $, commas, spaces)
const parseCurrency = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const numStr = String(value).replace(/[^0-9.-]/g, '');
  const num = parseFloat(numStr);
  return isNaN(num) ? '' : num;
};

// Format number as currency for display (adds $ and commas)
const formatCurrencyDisplay = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const num = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  if (isNaN(num)) return '';
  return `$${num.toLocaleString()}`;
};

// Field configurations with input types
const REQUIRED_CUSTOMER_DETAILS = [
  { key: 'name', label: 'Customer Name', critical: true, type: 'text' },
  { key: 'nric', label: 'NRIC/FIN', critical: true, type: 'text', placeholder: 'S1234567A' },
  { key: 'phone', label: 'Phone Number', critical: true, type: 'tel', placeholder: '+65 9123 4567' },
  { key: 'email', label: 'Email Address', critical: false, type: 'email', placeholder: 'email@example.com' },
  { key: 'address', label: 'Address', critical: true, type: 'text', placeholder: 'Block/Street Address' },
  { key: 'dob', label: 'Date of Birth', critical: false, type: 'date' },
  { key: 'occupation', label: 'Occupation', critical: false, type: 'text' },
];

const REQUIRED_VSA_DETAILS = [
  { key: 'vsa_makeModel', label: 'Make & Model', critical: true, type: 'select', options: VEHICLE_MODELS },
  { key: 'vsa_bodyColour', label: 'Body Colour', critical: true, type: 'select', options: BODY_COLOURS },
  { key: 'vsa_sellingWithCOE', label: 'Selling Price with COE', critical: true, type: 'text', placeholder: '$185,888' },
  { key: 'vsa_purchasePriceWithCOE', label: 'Purchase Price with COE', critical: true, type: 'text', placeholder: '$185,888' },
  { key: 'vsa_deposit', label: 'Deposit Amount', critical: true, type: 'text', placeholder: '$18,588' },
  { key: 'vsa_deliveryDate', label: 'Approximate Delivery Date', critical: false, type: 'date' },
];

const REQUIRED_LOAN_DETAILS = [
  { key: 'vsa_loanAmount', label: 'Loan Amount', critical: false, condition: 'hasLoan', type: 'text', placeholder: '$150,000' },
  { key: 'vsa_interest', label: 'Interest Rate (%)', critical: false, condition: 'hasLoan', type: 'text', placeholder: '2.88' },
  { key: 'vsa_tenure', label: 'Loan Tenure (Months)', critical: false, condition: 'hasLoan', type: 'text', placeholder: '84' },
  { key: 'vsa_monthlyRepayment', label: 'Monthly Repayment', critical: false, condition: 'hasLoan', type: 'text', placeholder: 'Auto-calculated', autoCalculated: true },
];

const REQUIRED_TRADE_IN_DETAILS = [
  { key: 'vsa_tradeInCarNo', label: 'Trade-In Car Number', critical: false, condition: 'hasTradeIn', type: 'text', placeholder: 'SXX1234A' },
  { key: 'vsa_tradeInCarModel', label: 'Trade-In Car Model', critical: false, condition: 'hasTradeIn', type: 'text' },
  { key: 'vsa_tradeInAmount', label: 'Trade-In Amount', critical: false, condition: 'hasTradeIn', type: 'text', placeholder: '$15,000' },
];

const REQUIRED_DOCUMENTS = [
  {
    id: 'vsa',
    name: 'Vehicle Sales Agreement (VSA)',
    description: 'Main sales contract with vehicle and pricing details',
    copies: 2,
    critical: true
  },
  {
    id: 'pdpa',
    name: 'PDPA Consent Form',
    description: 'Personal Data Protection Act consent',
    copies: 1,
    critical: true
  },
  {
    id: 'coe',
    name: 'COE Bidding Form',
    description: 'Certificate of Entitlement bidding authorization',
    copies: 1,
    critical: true
  },
  {
    id: 'id_copy',
    name: 'Customer ID (NRIC/Passport)',
    description: 'Copy of customer identification document',
    copies: 1,
    critical: true
  },
];

// Conditional documents based on deal setup
const CONDITIONAL_DOCUMENTS = [
  // Loan documents - only physical form for Hong Leong Finance & Motorway Credit
  {
    id: 'loan_physical',
    name: 'Loan Application Form (Physical)',
    description: 'Physical paper loan application - MUST be signed by customer',
    copies: 2,
    condition: 'requiresPhysicalLoanDocs',
    highlight: true
  },
  // Trade-in documents
  {
    id: 'trade_in',
    name: 'Trade-In Agreement',
    description: 'Trade-in vehicle documentation',
    copies: 1,
    condition: 'hasTradeIn'
  },
  {
    id: 'finance_auth_letter',
    name: 'Finance Authorized Letter',
    description: 'Finance authorization for trade-in vehicle',
    copies: 1,
    condition: 'hasTradeIn'
  },
  {
    id: 'ncd_transfer',
    name: 'NCD Transfer Form',
    description: 'No Claim Discount transfer (owner is not buyer)',
    copies: 1,
    condition: 'needsNcdTransfer'
  },
];

function DealClosingWizard({ isOpen, onClose, customer, onOpenPrintManager, onUpdateCustomer }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [checkedDocuments, setCheckedDocuments] = useState({});
  const [checkedSignatures, setCheckedSignatures] = useState({});
  const [formData, setFormData] = useState({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Deal configuration from setup step
  const [dealConfig, setDealConfig] = useState({
    // Loan section
    hasLoan: false,
    loanBank: '',
    // Trade-in section
    hasTradeIn: false,
    tradeInBuyerIsOwner: true,
    tradeInStillFinanced: false,
    needsNumberRetention: false,
    needsNcdTransfer: false,
  });

  // Initialize form data from customer when modal opens
  useEffect(() => {
    if (isOpen && customer) {
      const initialData = {};
      [...REQUIRED_CUSTOMER_DETAILS, ...REQUIRED_VSA_DETAILS, ...REQUIRED_LOAN_DETAILS, ...REQUIRED_TRADE_IN_DETAILS].forEach(field => {
        initialData[field.key] = customer[field.key] || '';
      });
      setFormData(initialData);
      setHasUnsavedChanges(false);

      // Pre-populate deal config based on existing customer data
      const hasLoanData = !!(customer.vsa_loanAmount && parseFloat(String(customer.vsa_loanAmount).replace(/[^0-9.-]/g, '')) > 0);
      const hasTradeInData = !!(customer.vsa_tradeInCarNo || customer.vsa_tradeInCarModel);
      setDealConfig(prev => ({
        ...prev,
        hasLoan: hasLoanData,
        hasTradeIn: hasTradeInData,
        tradeInBuyerIsOwner: !customer.vsa_tradeInOwnerNotCustomer,
      }));
    }
  }, [isOpen, customer]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(0);
      setCheckedDocuments({});
      setCheckedSignatures({});
      setFormData({});
      setHasUnsavedChanges(false);
      setDealConfig({
        hasLoan: false,
        loanBank: '',
        hasTradeIn: false,
        tradeInBuyerIsOwner: true,
        tradeInStillFinanced: false,
        needsNumberRetention: false,
        needsNcdTransfer: false,
      });
    }
  }, [isOpen]);

  // Handle deal config changes
  const handleDealConfigChange = useCallback((key, value) => {
    setDealConfig(prev => {
      const newConfig = { ...prev, [key]: value };
      // Reset dependent options
      if (key === 'hasTradeIn' && !value) {
        newConfig.tradeInBuyerIsOwner = true;
        newConfig.tradeInStillFinanced = false;
        newConfig.needsNumberRetention = false;
        newConfig.needsNcdTransfer = false;
      }
      if (key === 'hasLoan' && !value) {
        newConfig.loanBank = '';
      }
      if (key === 'tradeInBuyerIsOwner' && value) {
        newConfig.needsNcdTransfer = false;
      }
      return newConfig;
    });
  }, []);

  // Derived conditions for documents
  const requiresPhysicalLoanDocs = useMemo(() => {
    return dealConfig.hasLoan && PHYSICAL_SIGNATURE_BANKS.includes(dealConfig.loanBank);
  }, [dealConfig.hasLoan, dealConfig.loanBank]);

  const tradeInBuyerNotOwner = useMemo(() => {
    return dealConfig.hasTradeIn && !dealConfig.tradeInBuyerIsOwner;
  }, [dealConfig.hasTradeIn, dealConfig.tradeInBuyerIsOwner]);

  // Calculate monthly repayment based on loan details using FLAT RATE method
  // (commonly used for car loans in Singapore)
  // Formula: Monthly = (Principal + Total Interest) / Months
  // Where Total Interest = Principal × Annual Rate × Years
  // Returns plain number for Excel compatibility
  const calculateMonthlyRepayment = useCallback((loanAmount, interestRate, tenureMonths) => {
    // Parse values - remove any non-numeric characters except decimal point
    const principal = parseFloat(String(loanAmount).replace(/[^0-9.-]/g, '')) || 0;
    const annualRate = parseFloat(String(interestRate).replace(/[^0-9.-]/g, '')) || 0;
    const months = parseFloat(String(tenureMonths).replace(/[^0-9.-]/g, '')) || 0;

    if (principal <= 0 || annualRate <= 0 || months <= 0) {
      return '';
    }

    // Convert months to years for interest calculation
    const years = months / 12;

    // Flat rate calculation
    const totalInterest = principal * (annualRate / 100) * years;
    const totalAmount = principal + totalInterest;
    const monthlyPayment = totalAmount / months;

    // Round up to nearest whole number - return plain number for Excel compatibility
    return Math.ceil(monthlyPayment);
  }, []);

  // Handle field change with auto-calculation for monthly repayment
  // Currency fields are stored as plain numbers for Excel compatibility
  const handleFieldChange = useCallback((key, value) => {
    setFormData(prev => {
      // Parse currency fields to store as plain numbers
      const storedValue = CURRENCY_FIELDS.includes(key) ? parseCurrency(value) : value;
      const newData = { ...prev, [key]: storedValue };

      // Auto-calculate monthly repayment when loan details change
      if (key === 'vsa_loanAmount' || key === 'vsa_interest' || key === 'vsa_tenure') {
        const loanAmount = key === 'vsa_loanAmount' ? storedValue : prev.vsa_loanAmount;
        const interestRate = key === 'vsa_interest' ? value : prev.vsa_interest;
        const tenure = key === 'vsa_tenure' ? value : prev.vsa_tenure;

        const calculatedRepayment = calculateMonthlyRepayment(loanAmount, interestRate, tenure);
        if (calculatedRepayment) {
          newData.vsa_monthlyRepayment = calculatedRepayment;
        }
      }

      return newData;
    });
    setHasUnsavedChanges(true);
  }, [calculateMonthlyRepayment]);

  // Save changes
  const saveChanges = useCallback(async () => {
    if (!hasUnsavedChanges || !onUpdateCustomer) return;

    setIsSaving(true);
    try {
      await onUpdateCustomer(formData);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setIsSaving(false);
    }
  }, [formData, hasUnsavedChanges, onUpdateCustomer]);

  // Get current value (from formData if edited, otherwise from customer)
  const getValue = useCallback((key) => {
    if (formData[key] !== undefined) return formData[key];
    return customer?.[key] || '';
  }, [formData, customer]);

  // Check if a field has value
  const hasValue = useCallback((key) => {
    const value = getValue(key);
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    return true;
  }, [getValue]);

  // Use dealConfig for loan/trade-in status (from setup step)
  const hasLoan = dealConfig.hasLoan;
  const hasTradeIn = dealConfig.hasTradeIn;

  // Check if condition is met for conditional fields/documents
  const meetsCondition = useCallback((condition, excludeCondition = null) => {
    if (!condition) return true;

    // Check exclude condition first
    if (excludeCondition) {
      const excludeResult = meetsCondition(excludeCondition);
      if (excludeResult) return false;
    }

    switch (condition) {
      case 'hasLoan':
        return dealConfig.hasLoan;
      case 'hasTradeIn':
        return dealConfig.hasTradeIn;
      case 'requiresPhysicalLoanDocs':
        return requiresPhysicalLoanDocs;
      case 'tradeInBuyerNotOwner':
        return tradeInBuyerNotOwner;
      case 'tradeInStillFinanced':
        return dealConfig.hasTradeIn && dealConfig.tradeInStillFinanced;
      case 'needsNcdTransfer':
        return tradeInBuyerNotOwner && dealConfig.needsNcdTransfer;
      default:
        return true;
    }
  }, [dealConfig, requiresPhysicalLoanDocs, tradeInBuyerNotOwner]);

  // Calculate field completeness for each section
  const customerDetailsStatus = useMemo(() => {
    const fields = REQUIRED_CUSTOMER_DETAILS;
    const filled = fields.filter(f => hasValue(f.key));
    const missing = fields.filter(f => !hasValue(f.key));
    const criticalMissing = missing.filter(f => f.critical);
    return { fields, filled, missing, criticalMissing, percentage: Math.round((filled.length / fields.length) * 100) };
  }, [hasValue]);

  const vsaDetailsStatus = useMemo(() => {
    const fields = REQUIRED_VSA_DETAILS;
    const filled = fields.filter(f => hasValue(f.key));
    const missing = fields.filter(f => !hasValue(f.key));
    const criticalMissing = missing.filter(f => f.critical);
    return { fields, filled, missing, criticalMissing, percentage: Math.round((filled.length / fields.length) * 100) };
  }, [hasValue]);

  const loanDetailsStatus = useMemo(() => {
    if (!hasLoan) return null;
    const fields = REQUIRED_LOAN_DETAILS.filter(f => meetsCondition(f.condition));
    const filled = fields.filter(f => hasValue(f.key));
    const missing = fields.filter(f => !hasValue(f.key));
    return { fields, filled, missing, percentage: Math.round((filled.length / fields.length) * 100) };
  }, [hasValue, hasLoan, meetsCondition]);

  const tradeInDetailsStatus = useMemo(() => {
    if (!hasTradeIn) return null;
    const fields = REQUIRED_TRADE_IN_DETAILS.filter(f => meetsCondition(f.condition));
    const filled = fields.filter(f => hasValue(f.key));
    const missing = fields.filter(f => !hasValue(f.key));
    return { fields, filled, missing, percentage: Math.round((filled.length / fields.length) * 100) };
  }, [hasValue, hasTradeIn, meetsCondition]);

  // Get applicable documents based on deal configuration
  const applicableDocuments = useMemo(() => {
    const required = REQUIRED_DOCUMENTS;
    const conditional = CONDITIONAL_DOCUMENTS.filter(doc =>
      meetsCondition(doc.condition, doc.excludeCondition)
    );
    // Separate highlighted (important) documents
    const highlighted = conditional.filter(doc => doc.highlight);
    const regular = conditional.filter(doc => !doc.highlight);
    return { required, conditional, highlighted, regular, all: [...required, ...conditional] };
  }, [meetsCondition]);

  // Check if step is complete
  const isStepComplete = useCallback((stepIndex) => {
    switch (stepIndex) {
      case 0: // Deal Setup - always complete once bank is selected if has loan
        return !dealConfig.hasLoan || (dealConfig.hasLoan && dealConfig.loanBank);
      case 1: // Customer Details
        return customerDetailsStatus.criticalMissing.length === 0;
      case 2: // VSA Details
        return vsaDetailsStatus.criticalMissing.length === 0;
      case 3: // Documents
        return applicableDocuments.all.every(doc => checkedDocuments[doc.id]);
      case 4: // Signatures
        return applicableDocuments.all.every(doc => checkedSignatures[doc.id]);
      default:
        return false;
    }
  }, [dealConfig, customerDetailsStatus, vsaDetailsStatus, applicableDocuments, checkedDocuments, checkedSignatures]);

  // Total number of steps
  const totalSteps = 5;

  // Navigation with auto-save
  const handleNext = async () => {
    if (hasUnsavedChanges) {
      await saveChanges();
    }
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = async () => {
    if (hasUnsavedChanges) {
      await saveChanges();
    }
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = async () => {
    if (hasUnsavedChanges) {
      await saveChanges();
    }
    onClose();
  };

  const handleReset = () => {
    setCurrentStep(0);
    setCheckedDocuments({});
    setCheckedSignatures({});
  };

  // Toggle document checkbox
  const toggleDocument = (docId) => {
    setCheckedDocuments(prev => ({ ...prev, [docId]: !prev[docId] }));
  };

  const toggleSignature = (docId) => {
    setCheckedSignatures(prev => ({ ...prev, [docId]: !prev[docId] }));
  };

  // Steps configuration
  const steps = [
    { id: 0, title: 'Deal Setup', icon: Settings },
    { id: 1, title: 'Customer Details', icon: User },
    { id: 2, title: 'VSA Details', icon: Car },
    { id: 3, title: 'Print Documents', icon: Printer },
    { id: 4, title: 'Signatures', icon: ClipboardList },
  ];

  // Render editable field
  // Currency fields display formatted values but store plain numbers
  const renderEditableField = (field) => {
    const rawValue = getValue(field.key);
    const isCurrency = CURRENCY_FIELDS.includes(field.key);
    // Display formatted currency, but use raw value for non-currency fields
    const displayValue = isCurrency ? formatCurrencyDisplay(rawValue) : rawValue;
    const isFilled = hasValue(field.key);

    return (
      <div key={field.key} className={`field-item editable ${isFilled ? 'filled' : 'missing'} ${field.critical ? 'critical' : ''} ${field.autoCalculated ? 'auto-calculated' : ''}`}>
        <div className="field-status-icon">
          {isFilled ? (
            <CheckCircle size={18} className="field-icon success" />
          ) : field.critical ? (
            <XCircle size={18} className="field-icon error" />
          ) : (
            <AlertCircle size={18} className="field-icon warning" />
          )}
        </div>

        <div className="field-content">
          <label className="field-label">
            {field.label}
            {field.critical && !isFilled && <span className="required-badge">Required</span>}
            {field.autoCalculated && <span className="auto-calc-badge">Auto-calculated</span>}
          </label>

          {field.type === 'select' ? (
            <select
              value={rawValue}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              className={`field-input ${!isFilled && field.critical ? 'error' : ''}`}
            >
              <option value="">Select {field.label}</option>
              {field.options?.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : (
            <input
              type={field.type || 'text'}
              value={displayValue}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
              className={`field-input ${!isFilled && field.critical ? 'error' : ''} ${field.autoCalculated ? 'auto-calc-input' : ''}`}
              readOnly={field.autoCalculated}
            />
          )}
        </div>
      </div>
    );
  };

  if (!isOpen || !customer) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Deal Closing Checklist"
      size="large"
    >
      <div className="deal-wizard">
        {/* Customer Info Banner */}
        <div className="wizard-customer-info">
          <h3>{getValue('name') || customer.name}</h3>
          <div className="customer-quick-info">
            {getValue('phone') && <span>{getValue('phone')}</span>}
            {getValue('nric') && <span>{getValue('nric')}</span>}
          </div>
          {hasUnsavedChanges && (
            <div className="unsaved-indicator">
              <Edit3 size={14} />
              <span>Unsaved changes</span>
            </div>
          )}
        </div>

        {/* Progress Steps */}
        <div className="wizard-progress">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === index;
            const isComplete = isStepComplete(index);
            const isPast = index < currentStep;

            return (
              <div
                key={step.id}
                className={`progress-step ${isActive ? 'active' : ''} ${isComplete ? 'complete' : ''} ${isPast ? 'past' : ''}`}
                onClick={() => {
                  if (hasUnsavedChanges) saveChanges();
                  setCurrentStep(index);
                }}
              >
                <div className="step-indicator">
                  {isComplete ? <CheckCircle size={20} /> : <Icon size={20} />}
                </div>
                <span className="step-title">{step.title}</span>
                {index < steps.length - 1 && <ChevronRight size={16} className="step-arrow" />}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="wizard-content">
          {/* Step 0: Deal Setup */}
          {currentStep === 0 && (
            <div className="wizard-step">
              <div className="step-header">
                <h4>Configure Deal Requirements</h4>
              </div>

              <div className="alert alert-info">
                <Settings size={18} />
                <span>Select the options that apply to this deal. This will customize the checklist.</span>
              </div>

              {/* Loan Section */}
              <div className="setup-section">
                <div className="setup-section-header">
                  <CreditCard size={18} />
                  <h5>Loan / Financing</h5>
                </div>

                <div className="setup-option">
                  <label className="setup-toggle">
                    <input
                      type="checkbox"
                      checked={dealConfig.hasLoan}
                      onChange={(e) => handleDealConfigChange('hasLoan', e.target.checked)}
                    />
                    <span className="toggle-label">Customer has loan / financing</span>
                  </label>
                </div>

                {dealConfig.hasLoan && (
                  <div className="setup-suboptions">
                    <div className="setup-option">
                      <label className="setup-select-label">Select Bank</label>
                      <select
                        value={dealConfig.loanBank}
                        onChange={(e) => handleDealConfigChange('loanBank', e.target.value)}
                        className="setup-select"
                      >
                        <option value="">-- Select Bank --</option>
                        {BANKS.map(bank => (
                          <option key={bank} value={bank}>{bank}</option>
                        ))}
                      </select>
                    </div>

                    {requiresPhysicalLoanDocs && (
                      <div className="alert alert-warning setup-alert">
                        <AlertCircle size={16} />
                        <span><strong>{dealConfig.loanBank}</strong> requires physical paper loan documents to be signed!</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Trade-In Section */}
              <div className="setup-section">
                <div className="setup-section-header">
                  <ArrowRightLeft size={18} />
                  <h5>Trade-In</h5>
                </div>

                <div className="setup-option">
                  <label className="setup-toggle">
                    <input
                      type="checkbox"
                      checked={dealConfig.hasTradeIn}
                      onChange={(e) => handleDealConfigChange('hasTradeIn', e.target.checked)}
                    />
                    <span className="toggle-label">Customer has trade-in vehicle</span>
                  </label>
                </div>

                {dealConfig.hasTradeIn && (
                  <div className="setup-suboptions">
                    <div className="setup-option">
                      <label className="setup-toggle">
                        <input
                          type="checkbox"
                          checked={dealConfig.tradeInBuyerIsOwner}
                          onChange={(e) => handleDealConfigChange('tradeInBuyerIsOwner', e.target.checked)}
                        />
                        <span className="toggle-label">Buyer is the owner of trade-in vehicle</span>
                      </label>
                    </div>

                    <div className="setup-option">
                      <label className="setup-toggle">
                        <input
                          type="checkbox"
                          checked={dealConfig.tradeInStillFinanced}
                          onChange={(e) => handleDealConfigChange('tradeInStillFinanced', e.target.checked)}
                        />
                        <span className="toggle-label">Trade-in car is still being financed</span>
                      </label>
                    </div>

                    <div className="setup-option">
                      <label className="setup-toggle">
                        <input
                          type="checkbox"
                          checked={dealConfig.needsNumberRetention}
                          onChange={(e) => handleDealConfigChange('needsNumberRetention', e.target.checked)}
                        />
                        <span className="toggle-label">Customer needs Number Retention</span>
                      </label>
                    </div>

                    {!dealConfig.tradeInBuyerIsOwner && (
                      <div className="setup-option">
                        <label className="setup-toggle">
                          <input
                            type="checkbox"
                            checked={dealConfig.needsNcdTransfer}
                            onChange={(e) => handleDealConfigChange('needsNcdTransfer', e.target.checked)}
                          />
                          <span className="toggle-label">NCD Transfer required (owner is not buyer)</span>
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Summary of required documents */}
              <div className="setup-summary">
                <h5>Documents Required for This Deal:</h5>
                <ul className="setup-doc-list">
                  {applicableDocuments.all.map(doc => (
                    <li key={doc.id} className={doc.highlight ? 'highlight' : ''}>
                      {doc.name}
                      {doc.highlight && <span className="physical-badge">Physical Signature</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Step 1: Customer Details */}
          {currentStep === 1 && (
            <div className="wizard-step">
              <div className="step-header">
                <h4>Verify & Fill Customer Details</h4>
                <div className={`completion-badge ${customerDetailsStatus.percentage === 100 ? 'complete' : customerDetailsStatus.criticalMissing.length === 0 ? 'warning' : 'error'}`}>
                  {customerDetailsStatus.percentage}% Complete
                </div>
              </div>

              {customerDetailsStatus.criticalMissing.length > 0 && (
                <div className="alert alert-error">
                  <XCircle size={18} />
                  <span><strong>{customerDetailsStatus.criticalMissing.length}</strong> required field(s) missing - fill them in below!</span>
                </div>
              )}

              <div className="fields-list">
                {customerDetailsStatus.fields.map(field => renderEditableField(field))}
              </div>

              <div className="step-tip">
                <FileText size={16} />
                <span>Tip: Fill in any missing details directly here. Changes are auto-saved when you proceed.</span>
              </div>
            </div>
          )}

          {/* Step 2: VSA Details */}
          {currentStep === 2 && (
            <div className="wizard-step">
              <div className="step-header">
                <h4>Verify & Fill VSA Details</h4>
                <div className={`completion-badge ${vsaDetailsStatus.percentage === 100 ? 'complete' : vsaDetailsStatus.criticalMissing.length === 0 ? 'warning' : 'error'}`}>
                  {vsaDetailsStatus.percentage}% Complete
                </div>
              </div>

              {vsaDetailsStatus.criticalMissing.length > 0 && (
                <div className="alert alert-error">
                  <XCircle size={18} />
                  <span><strong>{vsaDetailsStatus.criticalMissing.length}</strong> required field(s) missing!</span>
                </div>
              )}

              <div className="section-title">Vehicle Details</div>
              <div className="fields-list">
                {vsaDetailsStatus.fields.map(field => renderEditableField(field))}
              </div>

              {(hasLoan || !getValue('vsa_loanAmount')) && (
                <>
                  <div className="section-title">
                    <CreditCard size={16} />
                    Loan Details
                    <span className="section-hint">(Fill loan amount if customer has financing)</span>
                  </div>
                  <div className="fields-list">
                    {REQUIRED_LOAN_DETAILS.map(field => renderEditableField(field))}
                  </div>
                </>
              )}

              {(hasTradeIn || (!getValue('vsa_tradeInCarNo') && !getValue('vsa_tradeInCarModel'))) && (
                <>
                  <div className="section-title">
                    <Car size={16} />
                    Trade-In Details
                    <span className="section-hint">(Fill if customer is trading in a vehicle)</span>
                  </div>
                  <div className="fields-list">
                    {REQUIRED_TRADE_IN_DETAILS.map(field => renderEditableField(field))}
                  </div>
                </>
              )}

              <div className="step-tip">
                <FileText size={16} />
                <span>Tip: Double-check the selling price and deposit amount with the customer.</span>
              </div>
            </div>
          )}

          {/* Step 3: Print Documents */}
          {currentStep === 3 && (
            <div className="wizard-step">
              <div className="step-header">
                <h4>Print Required Documents</h4>
                <button className="btn btn-primary btn-print-all" onClick={onOpenPrintManager}>
                  <Printer size={16} />
                  Open Print Manager
                </button>
              </div>

              {/* Number Retention Reminder */}
              {dealConfig.needsNumberRetention && (
                <div className="alert alert-warning number-retention-reminder">
                  <AlertCircle size={20} />
                  <div className="reminder-content">
                    <strong>NUMBER RETENTION REQUIRED</strong>
                    <span>This customer needs to retain their existing plate number. Ensure LTA number retention is processed before vehicle registration.</span>
                  </div>
                </div>
              )}

              <div className="alert alert-info">
                <FileText size={18} />
                <span>Check off each document after printing. Ensure all copies are ready.</span>
              </div>

              {/* Highlighted documents (physical signature required) */}
              {applicableDocuments.highlighted.length > 0 && (
                <>
                  <div className="section-title highlight-section">
                    <AlertCircle size={16} />
                    Physical Signature Required
                  </div>
                  <div className="documents-checklist">
                    {applicableDocuments.highlighted.map(doc => (
                      <label key={doc.id} className={`document-item highlight ${checkedDocuments[doc.id] ? 'checked' : ''}`}>
                        <input
                          type="checkbox"
                          checked={checkedDocuments[doc.id] || false}
                          onChange={() => toggleDocument(doc.id)}
                        />
                        <div className="document-info">
                          <span className="document-name">{doc.name}</span>
                          <span className="document-desc">{doc.description}</span>
                        </div>
                        <span className="document-copies">{doc.copies} copies</span>
                      </label>
                    ))}
                  </div>
                </>
              )}

              <div className="section-title">Required Documents</div>
              <div className="documents-checklist">
                {applicableDocuments.required.map(doc => (
                  <label key={doc.id} className={`document-item ${checkedDocuments[doc.id] ? 'checked' : ''}`}>
                    <input
                      type="checkbox"
                      checked={checkedDocuments[doc.id] || false}
                      onChange={() => toggleDocument(doc.id)}
                    />
                    <div className="document-info">
                      <span className="document-name">{doc.name}</span>
                      <span className="document-desc">{doc.description}</span>
                    </div>
                    <span className="document-copies">{doc.copies} copy</span>
                  </label>
                ))}
              </div>

              {applicableDocuments.regular.length > 0 && (
                <>
                  <div className="section-title">Additional Documents (Based on Deal Setup)</div>
                  <div className="documents-checklist">
                    {applicableDocuments.regular.map(doc => (
                      <label key={doc.id} className={`document-item conditional ${checkedDocuments[doc.id] ? 'checked' : ''}`}>
                        <input
                          type="checkbox"
                          checked={checkedDocuments[doc.id] || false}
                          onChange={() => toggleDocument(doc.id)}
                        />
                        <div className="document-info">
                          <span className="document-name">{doc.name}</span>
                          <span className="document-desc">{doc.description}</span>
                        </div>
                        <span className="document-copies">{doc.copies} copy</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 4: Signatures */}
          {currentStep === 4 && (
            <div className="wizard-step">
              <div className="step-header">
                <h4>Collect Signatures</h4>
                <div className={`completion-badge ${applicableDocuments.all.every(d => checkedSignatures[d.id]) ? 'complete' : 'warning'}`}>
                  {applicableDocuments.all.filter(d => checkedSignatures[d.id]).length} / {applicableDocuments.all.length} Signed
                </div>
              </div>

              {/* Number Retention Reminder */}
              {dealConfig.needsNumberRetention && (
                <div className="alert alert-warning number-retention-reminder">
                  <AlertCircle size={20} />
                  <div className="reminder-content">
                    <strong>REMINDER: NUMBER RETENTION</strong>
                    <span>Do not forget - this customer requires number retention before registration!</span>
                  </div>
                </div>
              )}

              <div className="alert alert-warning">
                <AlertCircle size={18} />
                <span>Verify customer signs all documents before they leave!</span>
              </div>

              {/* Highlighted signatures (physical paper) */}
              {applicableDocuments.highlighted.length > 0 && (
                <>
                  <div className="section-title highlight-section">
                    <AlertCircle size={16} />
                    Physical Paper Signatures
                  </div>
                  <div className="signatures-checklist">
                    {applicableDocuments.highlighted.map(doc => (
                      <label key={doc.id} className={`signature-item highlight ${checkedSignatures[doc.id] ? 'signed' : ''}`}>
                        <input
                          type="checkbox"
                          checked={checkedSignatures[doc.id] || false}
                          onChange={() => toggleSignature(doc.id)}
                        />
                        <div className="signature-info">
                          <span className="signature-name">{doc.name}</span>
                          {checkedSignatures[doc.id] && (
                            <span className="signed-badge">
                              <CheckCircle size={14} /> Signed
                            </span>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </>
              )}

              <div className="section-title">Documents Requiring Signature</div>
              <div className="signatures-checklist">
                {[...applicableDocuments.required, ...applicableDocuments.regular].map(doc => (
                  <label key={doc.id} className={`signature-item ${checkedSignatures[doc.id] ? 'signed' : ''}`}>
                    <input
                      type="checkbox"
                      checked={checkedSignatures[doc.id] || false}
                      onChange={() => toggleSignature(doc.id)}
                    />
                    <div className="signature-info">
                      <span className="signature-name">{doc.name}</span>
                      {checkedSignatures[doc.id] && (
                        <span className="signed-badge">
                          <CheckCircle size={14} /> Signed
                        </span>
                      )}
                    </div>
                  </label>
                ))}
              </div>

              {applicableDocuments.all.every(d => checkedSignatures[d.id]) && (
                <div className="success-message">
                  <CheckCircle size={24} />
                  <div>
                    <strong>All documents signed!</strong>
                    <p>The deal closing process is complete. Remember to:</p>
                    <ul>
                      <li>Give customer their copies of signed documents</li>
                      <li>Upload scanned copies to the customer folder</li>
                      <li>Update the CRM milestone status</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="wizard-footer">
          <div className="footer-left">
            <button className="btn btn-secondary" onClick={handleReset}>
              Reset
            </button>
            {hasUnsavedChanges && (
              <button className="btn btn-save" onClick={saveChanges} disabled={isSaving}>
                <Save size={16} />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </div>

          <div className="footer-nav">
            {currentStep > 0 && (
              <button className="btn btn-secondary" onClick={handleBack} disabled={isSaving}>
                Back
              </button>
            )}

            {currentStep < totalSteps - 1 ? (
              <button
                className="btn btn-primary"
                onClick={handleNext}
                disabled={isSaving || (currentStep === 0 && dealConfig.hasLoan && !dealConfig.loanBank)}
              >
                {hasUnsavedChanges ? 'Save & Next' : 'Next Step'}
                <ChevronRight size={16} />
              </button>
            ) : (
              <button className="btn btn-success" onClick={handleClose} disabled={isSaving}>
                <CheckCircle size={16} />
                {hasUnsavedChanges ? 'Save & Complete' : 'Complete'}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default DealClosingWizard;
