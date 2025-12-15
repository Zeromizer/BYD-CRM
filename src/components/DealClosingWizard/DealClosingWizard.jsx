import { useState, useMemo, useCallback, useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, ChevronRight, Printer, FileText, User, Car, CreditCard, ClipboardList, Save, Edit3 } from 'lucide-react';
import Modal from '../Modal/Modal';
import { VEHICLE_MODELS, BODY_COLOURS } from '../../constants/vehicleData';
import './DealClosingWizard.css';

/**
 * DealClosingWizard - Step-by-step guide for closing a deal
 *
 * Ensures all required customer details and documents are ready
 * before the customer leaves, preventing missing items.
 *
 * Now supports inline editing of fields directly within the wizard!
 */

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

const OPTIONAL_DOCUMENTS = [
  {
    id: 'loan',
    name: 'Loan Application Form',
    description: 'Bank financing application',
    copies: 1,
    condition: 'hasLoan'
  },
  {
    id: 'trade_in',
    name: 'Trade-In Agreement',
    description: 'Trade-in vehicle documentation',
    copies: 1,
    condition: 'hasTradeIn'
  },
  {
    id: 'insurance',
    name: 'Insurance Quotation',
    description: 'Vehicle insurance quote for customer review',
    copies: 1,
    condition: null
  },
];

function DealClosingWizard({ isOpen, onClose, customer, onOpenPrintManager, onUpdateCustomer }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [checkedDocuments, setCheckedDocuments] = useState({});
  const [checkedSignatures, setCheckedSignatures] = useState({});
  const [formData, setFormData] = useState({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize form data from customer when modal opens
  useEffect(() => {
    if (isOpen && customer) {
      const initialData = {};
      [...REQUIRED_CUSTOMER_DETAILS, ...REQUIRED_VSA_DETAILS, ...REQUIRED_LOAN_DETAILS, ...REQUIRED_TRADE_IN_DETAILS].forEach(field => {
        initialData[field.key] = customer[field.key] || '';
      });
      setFormData(initialData);
      setHasUnsavedChanges(false);
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
    }
  }, [isOpen]);

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

  // Determine if customer has loan or trade-in (check both form data and customer)
  const hasLoan = useMemo(() => {
    const loanAmount = getValue('vsa_loanAmount');
    return !!(loanAmount && parseFloat(loanAmount.toString().replace(/[^0-9.-]/g, '')) > 0);
  }, [getValue]);

  const hasTradeIn = useMemo(() => {
    return !!(getValue('vsa_tradeInCarNo') || getValue('vsa_tradeInCarModel'));
  }, [getValue]);

  // Check if condition is met for conditional fields
  const meetsCondition = useCallback((condition) => {
    if (!condition) return true;
    if (condition === 'hasLoan') return hasLoan;
    if (condition === 'hasTradeIn') return hasTradeIn;
    return true;
  }, [hasLoan, hasTradeIn]);

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

  // Get applicable documents
  const applicableDocuments = useMemo(() => {
    const required = REQUIRED_DOCUMENTS;
    const optional = OPTIONAL_DOCUMENTS.filter(doc => meetsCondition(doc.condition));
    return { required, optional, all: [...required, ...optional] };
  }, [meetsCondition]);

  // Check if step is complete
  const isStepComplete = useCallback((stepIndex) => {
    switch (stepIndex) {
      case 0: // Customer Details
        return customerDetailsStatus.criticalMissing.length === 0;
      case 1: // VSA Details
        return vsaDetailsStatus.criticalMissing.length === 0;
      case 2: // Documents
        return applicableDocuments.required.every(doc => checkedDocuments[doc.id]);
      case 3: // Signatures
        return applicableDocuments.required.every(doc => checkedSignatures[doc.id]);
      default:
        return false;
    }
  }, [customerDetailsStatus, vsaDetailsStatus, applicableDocuments, checkedDocuments, checkedSignatures]);

  // Navigation with auto-save
  const handleNext = async () => {
    if (hasUnsavedChanges) {
      await saveChanges();
    }
    if (currentStep < 3) {
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
    { id: 0, title: 'Customer Details', icon: User },
    { id: 1, title: 'VSA Details', icon: Car },
    { id: 2, title: 'Print Documents', icon: Printer },
    { id: 3, title: 'Signatures', icon: ClipboardList },
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
          {/* Step 0: Customer Details */}
          {currentStep === 0 && (
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

          {/* Step 1: VSA Details */}
          {currentStep === 1 && (
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

          {/* Step 2: Print Documents */}
          {currentStep === 2 && (
            <div className="wizard-step">
              <div className="step-header">
                <h4>Print Required Documents</h4>
                <button className="btn btn-primary btn-print-all" onClick={onOpenPrintManager}>
                  <Printer size={16} />
                  Open Print Manager
                </button>
              </div>

              <div className="alert alert-info">
                <FileText size={18} />
                <span>Check off each document after printing. Ensure all copies are ready.</span>
              </div>

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

              {applicableDocuments.optional.length > 0 && (
                <>
                  <div className="section-title">Additional Documents</div>
                  <div className="documents-checklist">
                    {applicableDocuments.optional.map(doc => (
                      <label key={doc.id} className={`document-item optional ${checkedDocuments[doc.id] ? 'checked' : ''}`}>
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

          {/* Step 3: Signatures */}
          {currentStep === 3 && (
            <div className="wizard-step">
              <div className="step-header">
                <h4>Collect Signatures</h4>
                <div className={`completion-badge ${applicableDocuments.required.every(d => checkedSignatures[d.id]) ? 'complete' : 'warning'}`}>
                  {applicableDocuments.required.filter(d => checkedSignatures[d.id]).length} / {applicableDocuments.required.length} Signed
                </div>
              </div>

              <div className="alert alert-warning">
                <AlertCircle size={18} />
                <span>Verify customer signs all documents before they leave!</span>
              </div>

              <div className="section-title">Documents Requiring Signature</div>
              <div className="signatures-checklist">
                {applicableDocuments.required.map(doc => (
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

              {applicableDocuments.required.every(d => checkedSignatures[d.id]) && (
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

            {currentStep < 3 ? (
              <button
                className="btn btn-primary"
                onClick={handleNext}
                disabled={isSaving}
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
