import { useState, useMemo, useCallback } from 'react';
import { CheckCircle, XCircle, AlertCircle, ChevronRight, Printer, FileText, User, Car, CreditCard, ClipboardList } from 'lucide-react';
import Modal from '../Modal/Modal';
import './DealClosingWizard.css';

/**
 * DealClosingWizard - Step-by-step guide for closing a deal
 *
 * Ensures all required customer details and documents are ready
 * before the customer leaves, preventing missing items.
 */

// Required fields for each step
const REQUIRED_CUSTOMER_DETAILS = [
  { key: 'name', label: 'Customer Name', critical: true },
  { key: 'nric', label: 'NRIC/FIN', critical: true },
  { key: 'phone', label: 'Phone Number', critical: true },
  { key: 'email', label: 'Email Address', critical: false },
  { key: 'address', label: 'Address', critical: true },
  { key: 'dob', label: 'Date of Birth', critical: false },
  { key: 'occupation', label: 'Occupation', critical: false },
];

const REQUIRED_VSA_DETAILS = [
  { key: 'vsa_makeModel', label: 'Make & Model', critical: true },
  { key: 'vsa_bodyColour', label: 'Body Colour', critical: true },
  { key: 'vsa_sellingWithCOE', label: 'Selling Price with COE', critical: true },
  { key: 'vsa_purchasePriceWithCOE', label: 'Purchase Price with COE', critical: true },
  { key: 'vsa_deposit', label: 'Deposit Amount', critical: true },
  { key: 'vsa_deliveryDate', label: 'Approximate Delivery Date', critical: false },
];

const REQUIRED_LOAN_DETAILS = [
  { key: 'vsa_loanAmount', label: 'Loan Amount', critical: false, condition: 'hasLoan' },
  { key: 'vsa_interest', label: 'Interest Rate', critical: false, condition: 'hasLoan' },
  { key: 'vsa_tenure', label: 'Loan Tenure', critical: false, condition: 'hasLoan' },
  { key: 'vsa_monthlyRepayment', label: 'Monthly Repayment', critical: false, condition: 'hasLoan' },
];

const REQUIRED_TRADE_IN_DETAILS = [
  { key: 'vsa_tradeInCarNo', label: 'Trade-In Car Number', critical: false, condition: 'hasTradeIn' },
  { key: 'vsa_tradeInCarModel', label: 'Trade-In Car Model', critical: false, condition: 'hasTradeIn' },
  { key: 'vsa_tradeInAmount', label: 'Trade-In Amount', critical: false, condition: 'hasTradeIn' },
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

function DealClosingWizard({ isOpen, onClose, customer, onOpenPrintManager }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [checkedDocuments, setCheckedDocuments] = useState({});
  const [checkedSignatures, setCheckedSignatures] = useState({});

  // Determine if customer has loan or trade-in
  const hasLoan = useMemo(() => {
    return !!(customer?.vsa_loanAmount && parseFloat(customer.vsa_loanAmount.toString().replace(/[^0-9.-]/g, '')) > 0);
  }, [customer?.vsa_loanAmount]);

  const hasTradeIn = useMemo(() => {
    return !!(customer?.vsa_tradeInCarNo || customer?.vsa_tradeInCarModel);
  }, [customer?.vsa_tradeInCarNo, customer?.vsa_tradeInCarModel]);

  // Check if a field has value
  const hasValue = useCallback((key) => {
    if (!customer) return false;
    const value = customer[key];
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    return true;
  }, [customer]);

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

  // Navigation
  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
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

  // Render field status item
  const renderFieldItem = (field, isFilled) => (
    <div key={field.key} className={`field-item ${isFilled ? 'filled' : 'missing'} ${field.critical ? 'critical' : ''}`}>
      {isFilled ? (
        <CheckCircle size={18} className="field-icon success" />
      ) : field.critical ? (
        <XCircle size={18} className="field-icon error" />
      ) : (
        <AlertCircle size={18} className="field-icon warning" />
      )}
      <span className="field-label">{field.label}</span>
      {field.critical && !isFilled && <span className="required-badge">Required</span>}
      {isFilled && customer && (
        <span className="field-value">{customer[field.key]}</span>
      )}
    </div>
  );

  if (!isOpen || !customer) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Deal Closing Checklist"
      size="large"
    >
      <div className="deal-wizard">
        {/* Customer Info Banner */}
        <div className="wizard-customer-info">
          <h3>{customer.name}</h3>
          <div className="customer-quick-info">
            {customer.phone && <span>{customer.phone}</span>}
            {customer.nric && <span>{customer.nric}</span>}
          </div>
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
                onClick={() => setCurrentStep(index)}
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
                <h4>Verify Customer Details</h4>
                <div className={`completion-badge ${customerDetailsStatus.percentage === 100 ? 'complete' : customerDetailsStatus.criticalMissing.length === 0 ? 'warning' : 'error'}`}>
                  {customerDetailsStatus.percentage}% Complete
                </div>
              </div>

              {customerDetailsStatus.criticalMissing.length > 0 && (
                <div className="alert alert-error">
                  <XCircle size={18} />
                  <span><strong>{customerDetailsStatus.criticalMissing.length}</strong> required field(s) missing - must be filled before proceeding!</span>
                </div>
              )}

              <div className="fields-grid">
                {customerDetailsStatus.fields.map(field =>
                  renderFieldItem(field, hasValue(field.key))
                )}
              </div>

              <div className="step-tip">
                <FileText size={16} />
                <span>Tip: Make sure NRIC and address are correctly entered for the VSA form.</span>
              </div>
            </div>
          )}

          {/* Step 1: VSA Details */}
          {currentStep === 1 && (
            <div className="wizard-step">
              <div className="step-header">
                <h4>Verify VSA Details</h4>
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
              <div className="fields-grid">
                {vsaDetailsStatus.fields.map(field =>
                  renderFieldItem(field, hasValue(field.key))
                )}
              </div>

              {hasLoan && loanDetailsStatus && (
                <>
                  <div className="section-title">
                    <CreditCard size={16} />
                    Loan Details
                  </div>
                  <div className="fields-grid">
                    {loanDetailsStatus.fields.map(field =>
                      renderFieldItem(field, hasValue(field.key))
                    )}
                  </div>
                </>
              )}

              {hasTradeIn && tradeInDetailsStatus && (
                <>
                  <div className="section-title">
                    <Car size={16} />
                    Trade-In Details
                  </div>
                  <div className="fields-grid">
                    {tradeInDetailsStatus.fields.map(field =>
                      renderFieldItem(field, hasValue(field.key))
                    )}
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
          <button className="btn btn-secondary" onClick={handleReset}>
            Reset
          </button>

          <div className="footer-nav">
            {currentStep > 0 && (
              <button className="btn btn-secondary" onClick={handleBack}>
                Back
              </button>
            )}

            {currentStep < 3 ? (
              <button
                className="btn btn-primary"
                onClick={handleNext}
                disabled={currentStep === 0 && customerDetailsStatus.criticalMissing.length > 0}
              >
                Next Step
                <ChevronRight size={16} />
              </button>
            ) : (
              <button className="btn btn-success" onClick={onClose}>
                <CheckCircle size={16} />
                Complete
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default DealClosingWizard;
