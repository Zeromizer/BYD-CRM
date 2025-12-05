import { memo, useCallback } from 'react';
import { VEHICLE_MODELS, BODY_COLOURS, INSURANCE_COMPANIES, PRZ_TYPES } from '../../../constants/vehicleData';
import { SaveButton } from '../../AnimatedButton/AnimatedButton';

/**
 * VsaTab - Vehicle Sales Agreement form
 */
function VsaTab({
  formData,
  customerName,
  customerNric,
  customerPhone,
  hasChanges,
  isSubmitting,
  onFieldChange,
  onSave,
  onCancel,
}) {
  const handleInputChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    onFieldChange(name, type === 'checkbox' ? checked : value);
  }, [onFieldChange]);

  return (
    <>
      {/* Vehicle Details */}
      <div className="info-section">
        <h3>BYD New Car Details</h3>
        <div className="inline-edit-grid">
          <div className="inline-edit-item">
            <label htmlFor="vsa_makeModel">Make & Model</label>
            <select
              id="vsa_makeModel"
              name="makeModel"
              value={formData.makeModel || ''}
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
            <label htmlFor="vsa_yom">Year of Manufacture</label>
            <input
              type="text"
              id="vsa_yom"
              name="yom"
              value={formData.yom || ''}
              onChange={handleInputChange}
              placeholder="e.g., 2024"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="vsa_bodyColour">Body Colour</label>
            <select
              id="vsa_bodyColour"
              name="bodyColour"
              value={formData.bodyColour || ''}
              onChange={handleInputChange}
              disabled={isSubmitting}
            >
              <option value="">Select Colour</option>
              {BODY_COLOURS.map((colour) => (
                <option key={colour} value={colour}>{colour}</option>
              ))}
            </select>
          </div>
          <div className="inline-edit-item">
            <label htmlFor="vsa_upholstery">Upholstery</label>
            <input
              type="text"
              id="vsa_upholstery"
              name="upholstery"
              value={formData.upholstery || ''}
              onChange={handleInputChange}
              placeholder="Interior colour/material"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="vsa_przType">P/R/Z Type</label>
            <select
              id="vsa_przType"
              name="przType"
              value={formData.przType || ''}
              onChange={handleInputChange}
              disabled={isSubmitting}
            >
              <option value="">Select Type</option>
              {PRZ_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
          <div className="inline-edit-item">
            <label htmlFor="vsa_package">Package</label>
            <input
              type="text"
              id="vsa_package"
              name="package"
              value={formData.package || ''}
              onChange={handleInputChange}
              placeholder="Package details"
              disabled={isSubmitting}
            />
          </div>
        </div>
      </div>

      {/* Pricing & Deposit */}
      <div className="info-section">
        <h3>Pricing & Deposit</h3>
        <div className="inline-edit-grid">
          <div className="inline-edit-item">
            <label htmlFor="vsa_sellingWithCOE">Selling with COE</label>
            <input
              type="text"
              id="vsa_sellingWithCOE"
              name="sellingWithCOE"
              value={formData.sellingWithCOE || ''}
              onChange={handleInputChange}
              placeholder="Price with COE"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="vsa_sellingPriceList">Selling Price on Price List</label>
            <input
              type="text"
              id="vsa_sellingPriceList"
              name="sellingPriceList"
              value={formData.sellingPriceList || ''}
              onChange={handleInputChange}
              placeholder="List price"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="vsa_purchasePriceWithCOE">Purchase Price with COE</label>
            <input
              type="text"
              id="vsa_purchasePriceWithCOE"
              name="purchasePriceWithCOE"
              value={formData.purchasePriceWithCOE || ''}
              onChange={handleInputChange}
              placeholder="Final purchase price"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="vsa_coeRebateLevel">COE Rebate Level</label>
            <input
              type="text"
              id="vsa_coeRebateLevel"
              name="coeRebateLevel"
              value={formData.coeRebateLevel || ''}
              onChange={handleInputChange}
              placeholder="Rebate level"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="vsa_deposit">Deposit</label>
            <input
              type="text"
              id="vsa_deposit"
              name="deposit"
              value={formData.deposit || ''}
              onChange={handleInputChange}
              placeholder="Deposit amount"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="vsa_lessOthers">Less: Others</label>
            <input
              type="text"
              id="vsa_lessOthers"
              name="lessOthers"
              value={formData.lessOthers || ''}
              onChange={handleInputChange}
              placeholder="Other deductions"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="vsa_addOthers">Add: Others</label>
            <input
              type="text"
              id="vsa_addOthers"
              name="addOthers"
              value={formData.addOthers || ''}
              onChange={handleInputChange}
              placeholder="Other additions"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="vsa_deliveryDate">Approximate Delivery Date</label>
            <input
              type="text"
              id="vsa_deliveryDate"
              name="deliveryDate"
              value={formData.deliveryDate || ''}
              onChange={handleInputChange}
              placeholder="e.g., Mid Jan 2025"
              disabled={isSubmitting}
            />
          </div>
        </div>
      </div>

      {/* Trade-In Details */}
      <div className="info-section">
        <h3>Trade-In Car Details</h3>
        <div className="inline-edit-grid">
          <div className="inline-edit-item">
            <label htmlFor="vsa_tradeInCarNo">Trade-In Car No</label>
            <input
              type="text"
              id="vsa_tradeInCarNo"
              name="tradeInCarNo"
              value={formData.tradeInCarNo || ''}
              onChange={handleInputChange}
              placeholder="Vehicle registration number"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="vsa_tradeInCarModel">Trade-In Car Model</label>
            <input
              type="text"
              id="vsa_tradeInCarModel"
              name="tradeInCarModel"
              value={formData.tradeInCarModel || ''}
              onChange={handleInputChange}
              placeholder="Make and model"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="vsa_tradeInAmount">Trade-In Amount</label>
            <input
              type="text"
              id="vsa_tradeInAmount"
              name="tradeInAmount"
              value={formData.tradeInAmount || ''}
              onChange={handleInputChange}
              placeholder="Trade-in value"
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div className="inline-edit-grid" style={{ marginTop: '16px' }}>
          <div className="inline-edit-item">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="tradeInOwnerNotCustomer"
                checked={formData.tradeInOwnerNotCustomer || false}
                onChange={handleInputChange}
                disabled={isSubmitting}
              />
              <span style={{ marginLeft: '8px' }}>Trade-in owner is different from customer</span>
            </label>
          </div>
        </div>

        {formData.tradeInOwnerNotCustomer && (
          <div className="inline-edit-grid" style={{ marginTop: '16px' }}>
            <div className="inline-edit-item">
              <label htmlFor="vsa_tradeInOwnerName">Trade-In Owner Name</label>
              <input
                type="text"
                id="vsa_tradeInOwnerName"
                name="tradeInOwnerName"
                value={formData.tradeInOwnerName || ''}
                onChange={handleInputChange}
                placeholder="Owner name"
                disabled={isSubmitting}
              />
            </div>
            <div className="inline-edit-item">
              <label htmlFor="vsa_tradeInOwnerNric">Trade-In Owner NRIC</label>
              <input
                type="text"
                id="vsa_tradeInOwnerNric"
                name="tradeInOwnerNric"
                value={formData.tradeInOwnerNric || ''}
                onChange={handleInputChange}
                placeholder="Owner NRIC"
                disabled={isSubmitting}
              />
            </div>
            <div className="inline-edit-item">
              <label htmlFor="vsa_tradeInOwnerMobile">Trade-In Owner Mobile</label>
              <input
                type="tel"
                id="vsa_tradeInOwnerMobile"
                name="tradeInOwnerMobile"
                value={formData.tradeInOwnerMobile || ''}
                onChange={handleInputChange}
                placeholder="Owner mobile"
                disabled={isSubmitting}
              />
            </div>
          </div>
        )}

        <div className="inline-edit-grid" style={{ marginTop: '16px' }}>
          <div className="inline-edit-item">
            <label htmlFor="vsa_tradeInInsuranceCompany">Trade-In Insurance Company</label>
            <select
              id="vsa_tradeInInsuranceCompany"
              name="tradeInInsuranceCompany"
              value={formData.tradeInInsuranceCompany || ''}
              onChange={handleInputChange}
              disabled={isSubmitting}
            >
              <option value="">Select Company</option>
              {INSURANCE_COMPANIES.map((company) => (
                <option key={company} value={company}>{company}</option>
              ))}
            </select>
          </div>
          <div className="inline-edit-item">
            <label htmlFor="vsa_tradeInPolicyNumber">Trade-In Policy Number</label>
            <input
              type="text"
              id="vsa_tradeInPolicyNumber"
              name="tradeInPolicyNumber"
              value={formData.tradeInPolicyNumber || ''}
              onChange={handleInputChange}
              placeholder="Policy number"
              disabled={isSubmitting}
            />
          </div>
        </div>
      </div>

      {/* Delivery Details */}
      <div className="info-section">
        <h3>Delivery Details</h3>
        <div className="inline-edit-grid">
          <div className="inline-edit-item">
            <label htmlFor="vsa_dateOfRegistration">Date of Registration</label>
            <input
              type="date"
              id="vsa_dateOfRegistration"
              name="dateOfRegistration"
              value={formData.dateOfRegistration || ''}
              onChange={handleInputChange}
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="vsa_registrationNo">Registration No</label>
            <input
              type="text"
              id="vsa_registrationNo"
              name="registrationNo"
              value={formData.registrationNo || ''}
              onChange={handleInputChange}
              placeholder="Vehicle registration"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="vsa_chassisNo">Chassis No</label>
            <input
              type="text"
              id="vsa_chassisNo"
              name="chassisNo"
              value={formData.chassisNo || ''}
              onChange={handleInputChange}
              placeholder="Chassis number"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="vsa_engineNo">Engine No</label>
            <input
              type="text"
              id="vsa_engineNo"
              name="engineNo"
              value={formData.engineNo || ''}
              onChange={handleInputChange}
              placeholder="Engine number"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="vsa_motorNo">Motor No</label>
            <input
              type="text"
              id="vsa_motorNo"
              name="motorNo"
              value={formData.motorNo || ''}
              onChange={handleInputChange}
              placeholder="Motor number"
              disabled={isSubmitting}
            />
          </div>
        </div>
      </div>

      {/* Insurance */}
      <div className="info-section">
        <h3>Insurance</h3>
        <div className="inline-edit-grid">
          <div className="inline-edit-item">
            <label htmlFor="vsa_insuranceCompany">Insurance Company</label>
            <select
              id="vsa_insuranceCompany"
              name="insuranceCompany"
              value={formData.insuranceCompany || ''}
              onChange={handleInputChange}
              disabled={isSubmitting}
            >
              <option value="">Select Company</option>
              {INSURANCE_COMPANIES.map((company) => (
                <option key={company} value={company}>{company}</option>
              ))}
            </select>
          </div>
          <div className="inline-edit-item">
            <label htmlFor="vsa_insuranceFee">Insurance Fee</label>
            <input
              type="text"
              id="vsa_insuranceFee"
              name="insuranceFee"
              value={formData.insuranceFee || ''}
              onChange={handleInputChange}
              placeholder="Insurance premium"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="vsa_insuranceSubsidy">Insurance Subsidy</label>
            <input
              type="text"
              id="vsa_insuranceSubsidy"
              name="insuranceSubsidy"
              value={formData.insuranceSubsidy || ''}
              onChange={handleInputChange}
              placeholder="Subsidy amount"
              disabled={isSubmitting}
            />
          </div>
        </div>
      </div>

      {/* Remarks & Loan */}
      <div className="info-section">
        <h3>Remarks</h3>
        <div className="inline-edit-full">
          <label htmlFor="vsa_remarks1">Remarks 1</label>
          <textarea
            id="vsa_remarks1"
            name="remarks1"
            value={formData.remarks1 || ''}
            onChange={handleInputChange}
            rows="2"
            placeholder="Remarks..."
            disabled={isSubmitting}
          />
        </div>
        <div className="inline-edit-full" style={{ marginTop: '16px' }}>
          <label htmlFor="vsa_remarks2">Remarks 2</label>
          <textarea
            id="vsa_remarks2"
            name="remarks2"
            value={formData.remarks2 || ''}
            onChange={handleInputChange}
            rows="2"
            placeholder="Additional remarks..."
            disabled={isSubmitting}
          />
        </div>
      </div>

      {/* Loan Details */}
      <div className="info-section">
        <h3>Loan Details</h3>
        <div className="inline-edit-grid">
          <div className="inline-edit-item">
            <label htmlFor="vsa_loanAmount">Loan Amount</label>
            <input
              type="text"
              id="vsa_loanAmount"
              name="loanAmount"
              value={formData.loanAmount || ''}
              onChange={handleInputChange}
              placeholder="Loan amount"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="vsa_interest">Interest (%)</label>
            <input
              type="text"
              id="vsa_interest"
              name="interest"
              value={formData.interest || ''}
              onChange={handleInputChange}
              placeholder="Interest rate"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="vsa_tenure">Tenure (months)</label>
            <input
              type="text"
              id="vsa_tenure"
              name="tenure"
              value={formData.tenure || ''}
              onChange={handleInputChange}
              placeholder="Loan tenure"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="vsa_adminFee">Admin Fee</label>
            <input
              type="text"
              id="vsa_adminFee"
              name="adminFee"
              value={formData.adminFee || ''}
              onChange={handleInputChange}
              placeholder="Admin fee"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="vsa_monthlyRepayment">Monthly Repayment</label>
            <input
              type="text"
              id="vsa_monthlyRepayment"
              name="monthlyRepayment"
              value={formData.monthlyRepayment || ''}
              onChange={handleInputChange}
              placeholder="Monthly payment"
              disabled={isSubmitting}
            />
          </div>
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

export default memo(VsaTab);
