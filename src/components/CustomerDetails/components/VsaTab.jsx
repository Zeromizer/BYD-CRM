import { memo, useCallback } from 'react';
import { VEHICLE_MODELS, BODY_COLOURS, INSURANCE_COMPANIES } from '../../../constants/vehicleData';

/**
 * VsaTab - Vehicle Sales Agreement form
 */
function VsaTab({
  formData,
  customerName,
  customerNric,
  customerPhone,
  hasChanges,
  onFieldChange,
  onSave,
  onCancel,
}) {
  const handleInputChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    onFieldChange(name, type === 'checkbox' ? checked : value);
  }, [onFieldChange]);

  // Auto-fill trade-in owner from customer if not different owner
  const tradeInName = formData.tradeInOwnerNotCustomer ? formData.tradeInOwnerName : customerName;
  const tradeInNric = formData.tradeInOwnerNotCustomer ? formData.tradeInOwnerNric : customerNric;
  const tradeInMobile = formData.tradeInOwnerNotCustomer ? formData.tradeInOwnerMobile : customerPhone;

  return (
    <div className="tab-content vsa-tab">
      {/* Vehicle Details */}
      <div className="form-section">
        <h3 className="section-title">BYD New Car Details</h3>
        <div className="form-grid">
          <div className="form-group">
            <label>Make & Model</label>
            <select
              name="makeModel"
              value={formData.makeModel}
              onChange={handleInputChange}
            >
              <option value="">Select Model</option>
              {VEHICLE_MODELS.map((model) => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Year of Manufacture</label>
            <input
              type="text"
              name="yom"
              value={formData.yom}
              onChange={handleInputChange}
              placeholder="e.g., 2024"
            />
          </div>

          <div className="form-group">
            <label>Body Colour</label>
            <select
              name="bodyColour"
              value={formData.bodyColour}
              onChange={handleInputChange}
            >
              <option value="">Select Colour</option>
              {BODY_COLOURS.map((colour) => (
                <option key={colour} value={colour}>{colour}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Upholstery</label>
            <input
              type="text"
              name="upholstery"
              value={formData.upholstery}
              onChange={handleInputChange}
              placeholder="Interior colour/material"
            />
          </div>

          <div className="form-group">
            <label>P/R/Z Type</label>
            <input
              type="text"
              name="przType"
              value={formData.przType}
              onChange={handleInputChange}
              placeholder="Enter P/R/Z type"
            />
          </div>

          <div className="form-group">
            <label>Package</label>
            <input
              type="text"
              name="package"
              value={formData.package}
              onChange={handleInputChange}
              placeholder="Package details"
            />
          </div>
        </div>
      </div>

      {/* Pricing & Deposit */}
      <div className="form-section">
        <h3 className="section-title">Pricing & Deposit</h3>
        <div className="form-grid">
          <div className="form-group">
            <label>Selling with COE</label>
            <input
              type="text"
              name="sellingWithCOE"
              value={formData.sellingWithCOE}
              onChange={handleInputChange}
              placeholder="Price with COE"
            />
          </div>

          <div className="form-group">
            <label>Selling Price on Price List</label>
            <input
              type="text"
              name="sellingPriceList"
              value={formData.sellingPriceList}
              onChange={handleInputChange}
              placeholder="List price"
            />
          </div>

          <div className="form-group">
            <label>Purchase Price with COE</label>
            <input
              type="text"
              name="purchasePriceWithCOE"
              value={formData.purchasePriceWithCOE}
              onChange={handleInputChange}
              placeholder="Final purchase price"
            />
          </div>

          <div className="form-group">
            <label>COE Rebate Level</label>
            <input
              type="text"
              name="coeRebateLevel"
              value={formData.coeRebateLevel}
              onChange={handleInputChange}
              placeholder="Rebate level"
            />
          </div>

          <div className="form-group">
            <label>Deposit</label>
            <input
              type="text"
              name="deposit"
              value={formData.deposit}
              onChange={handleInputChange}
              placeholder="Deposit amount"
            />
          </div>

          <div className="form-group">
            <label>Less: Others</label>
            <input
              type="text"
              name="lessOthers"
              value={formData.lessOthers}
              onChange={handleInputChange}
              placeholder="Other deductions"
            />
          </div>

          <div className="form-group">
            <label>Add: Others</label>
            <input
              type="text"
              name="addOthers"
              value={formData.addOthers}
              onChange={handleInputChange}
              placeholder="Other additions"
            />
          </div>

          <div className="form-group">
            <label>Approximate Delivery Date</label>
            <input
              type="date"
              name="deliveryDate"
              value={formData.deliveryDate}
              onChange={handleInputChange}
            />
          </div>
        </div>
      </div>

      {/* Trade-In Details */}
      <div className="form-section">
        <h3 className="section-title">Trade-In Car Details</h3>
        <div className="form-grid">
          <div className="form-group">
            <label>Trade-In Car No</label>
            <input
              type="text"
              name="tradeInCarNo"
              value={formData.tradeInCarNo}
              onChange={handleInputChange}
              placeholder="Vehicle registration number"
            />
          </div>

          <div className="form-group">
            <label>Trade-In Car Model</label>
            <input
              type="text"
              name="tradeInCarModel"
              value={formData.tradeInCarModel}
              onChange={handleInputChange}
              placeholder="Make and model"
            />
          </div>

          <div className="form-group">
            <label>Trade-In Amount</label>
            <input
              type="text"
              name="tradeInAmount"
              value={formData.tradeInAmount}
              onChange={handleInputChange}
              placeholder="Trade-in value"
            />
          </div>

          <div className="form-group checkbox-group full-width">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="tradeInOwnerNotCustomer"
                checked={formData.tradeInOwnerNotCustomer || false}
                onChange={handleInputChange}
              />
              <span>Trade-in owner is different from customer</span>
            </label>
          </div>

          {formData.tradeInOwnerNotCustomer && (
            <>
              <div className="form-group">
                <label>Trade-In Owner Name</label>
                <input
                  type="text"
                  name="tradeInOwnerName"
                  value={formData.tradeInOwnerName}
                  onChange={handleInputChange}
                  placeholder="Owner name"
                />
              </div>

              <div className="form-group">
                <label>Trade-In Owner NRIC</label>
                <input
                  type="text"
                  name="tradeInOwnerNric"
                  value={formData.tradeInOwnerNric}
                  onChange={handleInputChange}
                  placeholder="Owner NRIC"
                />
              </div>

              <div className="form-group">
                <label>Trade-In Owner Mobile</label>
                <input
                  type="tel"
                  name="tradeInOwnerMobile"
                  value={formData.tradeInOwnerMobile}
                  onChange={handleInputChange}
                  placeholder="Owner mobile"
                />
              </div>
            </>
          )}

          {/* Display auto-filled values */}
          <div className="form-group read-only">
            <label>Trade-In Name (Auto)</label>
            <input type="text" value={tradeInName || ''} readOnly disabled />
          </div>

          <div className="form-group read-only">
            <label>Trade-In NRIC (Auto)</label>
            <input type="text" value={tradeInNric || ''} readOnly disabled />
          </div>

          <div className="form-group read-only">
            <label>Trade-In Mobile (Auto)</label>
            <input type="text" value={tradeInMobile || ''} readOnly disabled />
          </div>

          <div className="form-group">
            <label>Trade-In Insurance Company</label>
            <select
              name="tradeInInsuranceCompany"
              value={formData.tradeInInsuranceCompany}
              onChange={handleInputChange}
            >
              <option value="">Select Company</option>
              {INSURANCE_COMPANIES.map((company) => (
                <option key={company} value={company}>{company}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Trade-In Policy Number</label>
            <input
              type="text"
              name="tradeInPolicyNumber"
              value={formData.tradeInPolicyNumber}
              onChange={handleInputChange}
              placeholder="Policy number"
            />
          </div>
        </div>
      </div>

      {/* Delivery Details */}
      <div className="form-section">
        <h3 className="section-title">Delivery Details</h3>
        <div className="form-grid">
          <div className="form-group">
            <label>Date of Registration</label>
            <input
              type="date"
              name="dateOfRegistration"
              value={formData.dateOfRegistration}
              onChange={handleInputChange}
            />
          </div>

          <div className="form-group">
            <label>Registration No</label>
            <input
              type="text"
              name="registrationNo"
              value={formData.registrationNo}
              onChange={handleInputChange}
              placeholder="Vehicle registration"
            />
          </div>

          <div className="form-group">
            <label>Chassis No</label>
            <input
              type="text"
              name="chassisNo"
              value={formData.chassisNo}
              onChange={handleInputChange}
              placeholder="Chassis number"
            />
          </div>

          <div className="form-group">
            <label>Engine No</label>
            <input
              type="text"
              name="engineNo"
              value={formData.engineNo}
              onChange={handleInputChange}
              placeholder="Engine number"
            />
          </div>

          <div className="form-group">
            <label>Motor No</label>
            <input
              type="text"
              name="motorNo"
              value={formData.motorNo}
              onChange={handleInputChange}
              placeholder="Motor number"
            />
          </div>
        </div>
      </div>

      {/* Insurance */}
      <div className="form-section">
        <h3 className="section-title">Insurance</h3>
        <div className="form-grid">
          <div className="form-group">
            <label>Insurance Company</label>
            <select
              name="insuranceCompany"
              value={formData.insuranceCompany}
              onChange={handleInputChange}
            >
              <option value="">Select Company</option>
              {INSURANCE_COMPANIES.map((company) => (
                <option key={company} value={company}>{company}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Insurance Fee</label>
            <input
              type="text"
              name="insuranceFee"
              value={formData.insuranceFee}
              onChange={handleInputChange}
              placeholder="Insurance premium"
            />
          </div>

          <div className="form-group">
            <label>Insurance Subsidy</label>
            <input
              type="text"
              name="insuranceSubsidy"
              value={formData.insuranceSubsidy}
              onChange={handleInputChange}
              placeholder="Subsidy amount"
            />
          </div>
        </div>
      </div>

      {/* Remarks & Loan */}
      <div className="form-section">
        <h3 className="section-title">Remarks & Loan Details</h3>
        <div className="form-grid">
          <div className="form-group full-width">
            <label>Remarks 1</label>
            <textarea
              name="remarks1"
              value={formData.remarks1}
              onChange={handleInputChange}
              rows={2}
              placeholder="Remarks..."
            />
          </div>

          <div className="form-group full-width">
            <label>Remarks 2</label>
            <textarea
              name="remarks2"
              value={formData.remarks2}
              onChange={handleInputChange}
              rows={2}
              placeholder="Additional remarks..."
            />
          </div>

          <div className="form-group">
            <label>Loan Amount</label>
            <input
              type="text"
              name="loanAmount"
              value={formData.loanAmount}
              onChange={handleInputChange}
              placeholder="Loan amount"
            />
          </div>

          <div className="form-group">
            <label>Interest (%)</label>
            <input
              type="text"
              name="interest"
              value={formData.interest}
              onChange={handleInputChange}
              placeholder="Interest rate"
            />
          </div>

          <div className="form-group">
            <label>Tenure (months)</label>
            <input
              type="text"
              name="tenure"
              value={formData.tenure}
              onChange={handleInputChange}
              placeholder="Loan tenure"
            />
          </div>

          <div className="form-group">
            <label>Admin Fee</label>
            <input
              type="text"
              name="adminFee"
              value={formData.adminFee}
              onChange={handleInputChange}
              placeholder="Admin fee"
            />
          </div>

          <div className="form-group">
            <label>Monthly Repayment</label>
            <input
              type="text"
              name="monthlyRepayment"
              value={formData.monthlyRepayment}
              onChange={handleInputChange}
              placeholder="Monthly payment"
            />
          </div>
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

export default memo(VsaTab);
