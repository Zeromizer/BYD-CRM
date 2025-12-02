import { memo, useCallback } from 'react';
import { VEHICLE_MODELS, BENEFITS_OPTIONS, BANKS } from '../../../constants/vehicleData';

/**
 * ProposalTab - Sales proposal and financing information form
 */
function ProposalTab({
  formData,
  hasChanges,
  onFieldChange,
  onSave,
  onCancel,
}) {
  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    onFieldChange(name, value);
  }, [onFieldChange]);

  return (
    <div className="tab-content proposal-tab">
      {/* Proposal Information */}
      <div className="form-section">
        <h3 className="section-title">Proposal Information</h3>
        <div className="form-grid">
          <div className="form-group">
            <label>Model</label>
            <select
              name="model"
              value={formData.model}
              onChange={handleInputChange}
            >
              <option value="">Select Model</option>
              {VEHICLE_MODELS.map((model) => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Bank</label>
            <select
              name="bank"
              value={formData.bank}
              onChange={handleInputChange}
            >
              <option value="">Select Bank</option>
              {BANKS.map((bank) => (
                <option key={bank} value={bank}>{bank}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Selling Price</label>
            <input
              type="text"
              name="sellingPrice"
              value={formData.sellingPrice}
              onChange={handleInputChange}
              placeholder="Enter selling price"
            />
          </div>
        </div>
      </div>

      {/* Financing Details */}
      <div className="form-section">
        <h3 className="section-title">Financing Details</h3>
        <div className="form-grid">
          <div className="form-group">
            <label>Interest Rate (%)</label>
            <input
              type="text"
              name="interestRate"
              value={formData.interestRate}
              onChange={handleInputChange}
              placeholder="e.g., 2.78"
            />
          </div>

          <div className="form-group">
            <label>Downpayment</label>
            <input
              type="text"
              name="downpayment"
              value={formData.downpayment}
              onChange={handleInputChange}
              placeholder="Enter downpayment"
            />
          </div>

          <div className="form-group">
            <label>Loan Tenure (months)</label>
            <input
              type="text"
              name="loanTenure"
              value={formData.loanTenure}
              onChange={handleInputChange}
              placeholder="e.g., 60"
            />
          </div>
        </div>
      </div>

      {/* Loan & Fee Details */}
      <div className="form-section">
        <h3 className="section-title">Loan & Fee Details</h3>
        <div className="form-grid">
          <div className="form-group">
            <label>Loan Amount</label>
            <input
              type="text"
              name="loanAmount"
              value={formData.loanAmount}
              onChange={handleInputChange}
              placeholder="Enter loan amount"
            />
          </div>

          <div className="form-group">
            <label>Admin Fee</label>
            <input
              type="text"
              name="adminFee"
              value={formData.adminFee}
              onChange={handleInputChange}
              placeholder="Enter admin fee"
            />
          </div>

          <div className="form-group">
            <label>Referral Fee</label>
            <input
              type="text"
              name="referralFee"
              value={formData.referralFee}
              onChange={handleInputChange}
              placeholder="Enter referral fee"
            />
          </div>
        </div>
      </div>

      {/* Trade-In Details */}
      <div className="form-section">
        <h3 className="section-title">Trade-In Details</h3>
        <div className="form-grid">
          <div className="form-group">
            <label>Trade-In Model</label>
            <input
              type="text"
              name="tradeInModel"
              value={formData.tradeInModel}
              onChange={handleInputChange}
              placeholder="Enter trade-in model"
            />
          </div>

          <div className="form-group">
            <label>Trade-In Car Plate</label>
            <input
              type="text"
              name="tradeInCarPlate"
              value={formData.tradeInCarPlate}
              onChange={handleInputChange}
              placeholder="Enter car plate"
            />
          </div>

          <div className="form-group">
            <label>Quoted Trade-In Price</label>
            <input
              type="text"
              name="quotedTradeInPrice"
              value={formData.quotedTradeInPrice}
              onChange={handleInputChange}
              placeholder="Enter quoted price"
            />
          </div>

          <div className="form-group">
            <label>Low Loan Surcharge</label>
            <input
              type="text"
              name="lowLoanSurcharge"
              value={formData.lowLoanSurcharge}
              onChange={handleInputChange}
              placeholder="Enter surcharge"
            />
          </div>

          <div className="form-group">
            <label>No Loan Surcharge</label>
            <input
              type="text"
              name="noLoanSurcharge"
              value={formData.noLoanSurcharge}
              onChange={handleInputChange}
              placeholder="Enter surcharge"
            />
          </div>
        </div>
      </div>

      {/* Benefits */}
      <div className="form-section">
        <h3 className="section-title">Benefits</h3>
        <div className="form-grid">
          {[1, 2, 3, 4, 5].map((num) => (
            <div className="form-group" key={num}>
              <label>Benefit {num}</label>
              <select
                name={`benefit${num}`}
                value={formData[`benefit${num}`]}
                onChange={handleInputChange}
              >
                <option value="">Select Benefit</option>
                {BENEFITS_OPTIONS.map((benefit) => (
                  <option key={benefit} value={benefit}>{benefit}</option>
                ))}
              </select>
            </div>
          ))}

          <div className="form-group full-width">
            <label>Benefits Given (Summary)</label>
            <textarea
              name="benefitsGiven"
              value={formData.benefitsGiven}
              onChange={handleInputChange}
              rows={2}
              placeholder="Summary of all benefits given..."
            />
          </div>
        </div>
      </div>

      {/* Remarks */}
      <div className="form-section">
        <h3 className="section-title">Remarks</h3>
        <div className="form-group full-width">
          <textarea
            name="remarks"
            value={formData.remarks}
            onChange={handleInputChange}
            rows={3}
            placeholder="Additional remarks..."
          />
        </div>
      </div>

      {/* Action Buttons */}
      {hasChanges && (
        <div className="form-actions">
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={onSave}>
            Save Changes
          </button>
        </div>
      )}
    </div>
  );
}

export default memo(ProposalTab);
