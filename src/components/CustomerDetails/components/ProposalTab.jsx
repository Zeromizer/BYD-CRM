import { memo, useCallback } from 'react';
import { VEHICLE_MODELS, BENEFITS_OPTIONS, BANKS } from '../../../constants/vehicleData';

/**
 * ProposalTab - Sales proposal and financing information form
 */
function ProposalTab({
  formData,
  hasChanges,
  isSubmitting,
  onFieldChange,
  onSave,
  onCancel,
}) {
  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    onFieldChange(name, value);
  }, [onFieldChange]);

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
              value={formData.sellingPrice || ''}
              onChange={handleInputChange}
              placeholder="Enter selling price"
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
              value={formData.downpayment || ''}
              onChange={handleInputChange}
              placeholder="Enter downpayment"
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
              value={formData.loanAmount || ''}
              onChange={handleInputChange}
              placeholder="Enter loan amount"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="proposal_adminFee">Admin Fee</label>
            <input
              type="text"
              id="proposal_adminFee"
              name="adminFee"
              value={formData.adminFee || ''}
              onChange={handleInputChange}
              placeholder="Enter admin fee"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="proposal_referralFee">Referral Fee</label>
            <input
              type="text"
              id="proposal_referralFee"
              name="referralFee"
              value={formData.referralFee || ''}
              onChange={handleInputChange}
              placeholder="Enter referral fee"
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
              value={formData.quotedTradeInPrice || ''}
              onChange={handleInputChange}
              placeholder="Enter quoted price"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="proposal_lowLoanSurcharge">Low Loan Surcharge</label>
            <input
              type="text"
              id="proposal_lowLoanSurcharge"
              name="lowLoanSurcharge"
              value={formData.lowLoanSurcharge || ''}
              onChange={handleInputChange}
              placeholder="Enter surcharge"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="proposal_noLoanSurcharge">No Loan Surcharge</label>
            <input
              type="text"
              id="proposal_noLoanSurcharge"
              name="noLoanSurcharge"
              value={formData.noLoanSurcharge || ''}
              onChange={handleInputChange}
              placeholder="Enter surcharge"
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
          <button
            className="btn btn-primary"
            onClick={onSave}
            disabled={isSubmitting || !hasChanges}
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  );
}

export default memo(ProposalTab);
