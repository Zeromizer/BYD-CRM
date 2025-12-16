import { memo, useCallback } from 'react';
import { ArrowRightCircle } from 'lucide-react';
import { VEHICLE_MODELS, BENEFITS_OPTIONS, BANKS } from '../../../constants/vehicleData';
import { SaveButton } from '../../AnimatedButton/AnimatedButton';
import { parseCurrency, formatCurrency, isCurrencyField } from '../../../utils/currencyUtils';

/**
 * ProposalTab - Sales proposal and financing information form
 * Currency fields are stored as plain numbers for Excel compatibility
 */
function ProposalTab({
  formData,
  hasChanges,
  isSubmitting,
  onFieldChange,
  onSave,
  onCancel,
  onTransferToVsa,
}) {
  // Handle input change - parse currency fields to store as plain numbers
  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    if (isCurrencyField(name, 'proposal')) {
      onFieldChange(name, parseCurrency(value));
    } else {
      onFieldChange(name, value);
    }
  }, [onFieldChange]);

  // Get display value - format currency fields for display
  const getDisplayValue = useCallback((fieldName) => {
    const value = formData[fieldName];
    if (isCurrencyField(fieldName, 'proposal') && value !== '' && value !== null && value !== undefined) {
      return formatCurrency(value);
    }
    return value || '';
  }, [formData]);

  return (
    <>
      {/* Proposal Information */}
      <div className="info-section">
        <h3>Proposal Information</h3>
        <div className="inline-edit-grid">
          <div className="inline-edit-item">
            <label htmlFor="proposal_model">Model</label>
            <select
              id="proposal_model"
              name="model"
              value={formData.model || ''}
              onChange={handleInputChange}
              disabled={isSubmitting}
            >
              <option value="">Select Model</option>
              {VEHICLE_MODELS.map((model) => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
          </div>
          <div className="inline-edit-item">
            <label htmlFor="proposal_bank">Bank</label>
            <select
              id="proposal_bank"
              name="bank"
              value={formData.bank || ''}
              onChange={handleInputChange}
              disabled={isSubmitting}
            >
              <option value="">Select Bank</option>
              {BANKS.map((bank) => (
                <option key={bank} value={bank}>{bank}</option>
              ))}
            </select>
          </div>
          <div className="inline-edit-item">
            <label htmlFor="proposal_sellingPrice">Selling Price</label>
            <input
              type="text"
              id="proposal_sellingPrice"
              name="sellingPrice"
              value={getDisplayValue('sellingPrice')}
              onChange={handleInputChange}
              placeholder="$185,888"
              disabled={isSubmitting}
            />
          </div>
        </div>
      </div>

      {/* Financing Details */}
      <div className="info-section">
        <h3>Financing Details</h3>
        <div className="inline-edit-grid">
          <div className="inline-edit-item">
            <label htmlFor="proposal_interestRate">Interest Rate (%)</label>
            <input
              type="text"
              id="proposal_interestRate"
              name="interestRate"
              value={formData.interestRate || ''}
              onChange={handleInputChange}
              placeholder="e.g., 2.78"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="proposal_downpayment">Downpayment</label>
            <input
              type="text"
              id="proposal_downpayment"
              name="downpayment"
              value={getDisplayValue('downpayment')}
              onChange={handleInputChange}
              placeholder="$18,588"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="proposal_loanTenure">Loan Tenure (months)</label>
            <input
              type="text"
              id="proposal_loanTenure"
              name="loanTenure"
              value={formData.loanTenure || ''}
              onChange={handleInputChange}
              placeholder="e.g., 60"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="proposal_loanAmount">Loan Amount</label>
            <input
              type="text"
              id="proposal_loanAmount"
              name="loanAmount"
              value={getDisplayValue('loanAmount')}
              onChange={handleInputChange}
              placeholder="$150,000"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="proposal_adminFee">Admin Fee</label>
            <input
              type="text"
              id="proposal_adminFee"
              name="adminFee"
              value={getDisplayValue('adminFee')}
              onChange={handleInputChange}
              placeholder="$500"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="proposal_referralFee">Referral Fee</label>
            <input
              type="text"
              id="proposal_referralFee"
              name="referralFee"
              value={getDisplayValue('referralFee')}
              onChange={handleInputChange}
              placeholder="$500"
              disabled={isSubmitting}
            />
          </div>
        </div>
      </div>

      {/* Trade-In Details */}
      <div className="info-section">
        <h3>Trade-In Details</h3>
        <div className="inline-edit-grid">
          <div className="inline-edit-item">
            <label htmlFor="proposal_tradeInModel">Trade-In Model</label>
            <input
              type="text"
              id="proposal_tradeInModel"
              name="tradeInModel"
              value={formData.tradeInModel || ''}
              onChange={handleInputChange}
              placeholder="Enter trade-in model"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="proposal_tradeInCarPlate">Trade-In Car Plate</label>
            <input
              type="text"
              id="proposal_tradeInCarPlate"
              name="tradeInCarPlate"
              value={formData.tradeInCarPlate || ''}
              onChange={handleInputChange}
              placeholder="Enter car plate"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="proposal_quotedTradeInPrice">Quoted Trade-In Price</label>
            <input
              type="text"
              id="proposal_quotedTradeInPrice"
              name="quotedTradeInPrice"
              value={getDisplayValue('quotedTradeInPrice')}
              onChange={handleInputChange}
              placeholder="$15,000"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="proposal_lowLoanSurcharge">Low Loan Surcharge</label>
            <input
              type="text"
              id="proposal_lowLoanSurcharge"
              name="lowLoanSurcharge"
              value={getDisplayValue('lowLoanSurcharge')}
              onChange={handleInputChange}
              placeholder="$1,000"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="proposal_noLoanSurcharge">No Loan Surcharge</label>
            <input
              type="text"
              id="proposal_noLoanSurcharge"
              name="noLoanSurcharge"
              value={getDisplayValue('noLoanSurcharge')}
              onChange={handleInputChange}
              placeholder="$2,000"
              disabled={isSubmitting}
            />
          </div>
        </div>
      </div>

      {/* Benefits */}
      <div className="info-section">
        <h3>Benefits</h3>
        <div className="inline-edit-grid">
          {[1, 2, 3, 4, 5].map((num) => (
            <div className="inline-edit-item" key={num}>
              <label htmlFor={`proposal_benefit${num}`}>Benefit {num}</label>
              <select
                id={`proposal_benefit${num}`}
                name={`benefit${num}`}
                value={formData[`benefit${num}`] || ''}
                onChange={handleInputChange}
                disabled={isSubmitting}
              >
                <option value="">Select Benefit</option>
                {BENEFITS_OPTIONS.map((benefit) => (
                  <option key={benefit} value={benefit}>{benefit}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Benefits Summary & Remarks */}
      <div className="info-section">
        <h3>Summary & Remarks</h3>
        <div className="inline-edit-full">
          <label htmlFor="proposal_benefitsGiven">Benefits Given (Summary)</label>
          <textarea
            id="proposal_benefitsGiven"
            name="benefitsGiven"
            value={formData.benefitsGiven || ''}
            onChange={handleInputChange}
            rows="2"
            placeholder="Summary of all benefits given..."
            disabled={isSubmitting}
          />
        </div>
        <div className="inline-edit-full" style={{ marginTop: '16px' }}>
          <label htmlFor="proposal_remarks">Remarks</label>
          <textarea
            id="proposal_remarks"
            name="remarks"
            value={formData.remarks || ''}
            onChange={handleInputChange}
            rows="3"
            placeholder="Additional remarks..."
            disabled={isSubmitting}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="details-actions">
        <div className="details-actions-left">
          {onTransferToVsa && (
            <button
              className="btn btn-outline-primary"
              onClick={onTransferToVsa}
              disabled={isSubmitting}
              title="Transfer proposal details to VSA"
            >
              <ArrowRightCircle size={16} />
              Transfer to VSA
            </button>
          )}
        </div>
        <div className="details-actions-right">
          {hasChanges && (
            <button
              className="btn btn-secondary"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </button>
          )}
          <SaveButton
            onClick={onSave}
            isSubmitting={isSubmitting}
            hasChanges={hasChanges}
          >
            Save Changes
          </SaveButton>
        </div>
      </div>
    </>
  );
}

export default memo(ProposalTab);
