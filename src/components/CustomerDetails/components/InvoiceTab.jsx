import { memo, useCallback, useMemo } from 'react';
import { VEHICLE_MODELS, INSURANCE_COMPANIES, BANKS } from '../../../constants/vehicleData';
import { SaveButton } from '../../AnimatedButton/AnimatedButton';

// Car type options
const CAR_TYPES = ['NEW CAR', 'PRE-OWNED'];

// Vehicle type options matching the screenshot
const VEHICLE_TYPES = [
  { value: 'NORMAL', label: 'NORMAL' },
  { value: 'GRAB', label: 'GRAB (Z)' },
  { value: 'LEASING', label: 'LEASING (R)' },
  { value: 'DEALER', label: 'DEALER' },
];

// Payment modes
const PAYMENT_MODES = [
  'BUYER PAID DIRECT',
  'CREDIT CARD / PAYNOW',
  'CASH',
  'BANK TRANSFER',
];

// Advance/Arrears options
const ADVANCE_ARREARS = ['ADVANCE', 'ARREARS'];

/**
 * InvoiceTab - Performa Invoice display with financial details
 * Pulls data from customer details to populate the invoice
 */
function InvoiceTab({
  formData,
  customerName,
  customerNric,
  customerPhone,
  customerEmail,
  salesConsultant,
  vsaData,
  hasChanges,
  isSubmitting,
  onFieldChange,
  onSave,
  onCancel,
  customerId,
}) {
  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    onFieldChange(name, value);
  }, [onFieldChange]);

  // Generate running invoice number based on customer ID and date
  const invoiceNumber = useMemo(() => {
    if (formData.invoiceNumber) return formData.invoiceNumber;
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const paddedId = String(customerId || 1).padStart(4, '0');
    return `PI-${year}${month}-${paddedId}`;
  }, [formData.invoiceNumber, customerId]);

  // Parse number helper
  const parseNum = (val) => {
    const num = parseFloat(String(val).replace(/,/g, ''));
    return isNaN(num) ? 0 : num;
  };

  // Format number with commas
  const formatNum = (num) => {
    if (num === 0) return '-';
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Calculate sub-total
  const subTotal = useMemo(() => {
    const priceSold = parseNum(formData.priceSold);
    const insuranceFee = parseNum(formData.insuranceFee);
    const roadTax = parseNum(formData.roadTax);
    const transferFee = parseNum(formData.transferFee);
    const inspectionFee = parseNum(formData.inspectionFee);
    const processingFee = parseNum(formData.processingFee);
    const others = parseNum(formData.others);
    const accessories1 = parseNum(formData.accessories1);
    const accessories2 = parseNum(formData.accessories2);

    return priceSold + insuranceFee + roadTax + transferFee + inspectionFee + processingFee + others + accessories1 + accessories2;
  }, [formData]);

  // Calculate trade-in balance
  const tradeInBalance = useMemo(() => {
    const tradeInPrice = parseNum(formData.tradeInPrice);
    const settlement = parseNum(formData.tradeInSettlement);
    return tradeInPrice - settlement;
  }, [formData]);

  // Calculate final balance
  const balance = useMemo(() => {
    const deposit = parseNum(formData.depositPaid);
    const othersDeduction = parseNum(formData.othersDeduction);
    const tradeIn = parseNum(formData.tradeInBalance) || tradeInBalance;

    return subTotal - deposit - othersDeduction - tradeIn;
  }, [subTotal, formData.depositPaid, formData.othersDeduction, formData.tradeInBalance, tradeInBalance]);

  return (
    <>
      {/* Invoice Header */}
      <div className="info-section invoice-header-section">
        <div className="invoice-header">
          <h3>Performa Invoice</h3>
          <div className="invoice-number">
            <label>Invoice No:</label>
            <input
              type="text"
              name="invoiceNumber"
              value={formData.invoiceNumber || invoiceNumber}
              onChange={handleInputChange}
              disabled={isSubmitting}
              className="invoice-number-input"
            />
          </div>
        </div>

        <div className="inline-edit-grid">
          <div className="inline-edit-item">
            <label htmlFor="invoice_carType">Car Type</label>
            <select
              id="invoice_carType"
              name="carType"
              value={formData.carType || 'NEW CAR'}
              onChange={handleInputChange}
              disabled={isSubmitting}
            >
              {CAR_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div className="inline-edit-item">
            <label htmlFor="invoice_vehicleType">Vehicle Type</label>
            <select
              id="invoice_vehicleType"
              name="vehicleType"
              value={formData.vehicleType || 'NORMAL'}
              onChange={handleInputChange}
              disabled={isSubmitting}
            >
              {VEHICLE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
          <div className="inline-edit-item">
            <label htmlFor="invoice_salesPerson">Sales Person</label>
            <input
              type="text"
              id="invoice_salesPerson"
              name="salesPerson"
              value={formData.salesPerson || salesConsultant || ''}
              onChange={handleInputChange}
              placeholder="Sales person name"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="invoice_promoCode">Promo Code</label>
            <input
              type="text"
              id="invoice_promoCode"
              name="promoCode"
              value={formData.promoCode || ''}
              onChange={handleInputChange}
              placeholder="Promo code"
              disabled={isSubmitting}
            />
          </div>
        </div>
      </div>

      {/* Vehicle & Customer Details */}
      <div className="info-section">
        <h3>Vehicle & Customer Details</h3>
        <div className="inline-edit-grid">
          <div className="inline-edit-item">
            <label htmlFor="invoice_vehicleNo">Vehicle No.</label>
            <input
              type="text"
              id="invoice_vehicleNo"
              name="vehicleNo"
              value={formData.vehicleNo || ''}
              onChange={handleInputChange}
              placeholder="Registration number"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="invoice_regDate">Reg Date</label>
            <input
              type="date"
              id="invoice_regDate"
              name="regDate"
              value={formData.regDate || ''}
              onChange={handleInputChange}
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="invoice_makeModel">Make / Model</label>
            <select
              id="invoice_makeModel"
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
            <label htmlFor="invoice_coeExpDate">COE Exp Date</label>
            <input
              type="text"
              id="invoice_coeExpDate"
              name="coeExpDate"
              value={formData.coeExpDate || ''}
              onChange={handleInputChange}
              placeholder="COE expiry date"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label>Name</label>
            <input
              type="text"
              value={customerName || ''}
              disabled
              className="readonly-field"
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="invoice_transferCount">Transfer Count</label>
            <input
              type="text"
              id="invoice_transferCount"
              name="transferCount"
              value={formData.transferCount || ''}
              onChange={handleInputChange}
              placeholder="Transfer count"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label>NRIC / ROC</label>
            <input
              type="text"
              value={customerNric || ''}
              disabled
              className="readonly-field"
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="invoice_deliveryDate">Est. Delivery Date</label>
            <input
              type="text"
              id="invoice_deliveryDate"
              name="deliveryDate"
              value={formData.deliveryDate || ''}
              onChange={handleInputChange}
              placeholder="Estimated delivery date"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label>Contact No</label>
            <input
              type="text"
              value={customerPhone || ''}
              disabled
              className="readonly-field"
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="invoice_mileage">Mileage (KM)</label>
            <input
              type="text"
              id="invoice_mileage"
              name="mileage"
              value={formData.mileage || ''}
              onChange={handleInputChange}
              placeholder="Mileage"
              disabled={isSubmitting}
            />
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div className="info-section">
        <h3>Pricing</h3>
        <div className="invoice-pricing-grid">
          <div className="pricing-row">
            <label>PRICE SOLD</label>
            <div className="price-input">
              <span>$</span>
              <input
                type="text"
                name="priceSold"
                value={formData.priceSold || ''}
                onChange={handleInputChange}
                placeholder="0.00"
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div className="pricing-row">
            <label>FINANCE AMT</label>
            <div className="price-input">
              <span>$</span>
              <input
                type="text"
                name="financeAmount"
                value={formData.financeAmount || ''}
                onChange={handleInputChange}
                placeholder="0.00"
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div className="pricing-row">
            <label>FIRST PAYMENT</label>
            <div className="price-input">
              <span>$</span>
              <input
                type="text"
                name="firstPayment"
                value={formData.firstPayment || ''}
                onChange={handleInputChange}
                placeholder="0.00"
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div className="pricing-row">
            <label>INSTALLMENT</label>
            <div className="price-input">
              <span>$</span>
              <input
                type="text"
                name="installment"
                value={formData.installment || ''}
                onChange={handleInputChange}
                placeholder="0.00"
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div className="pricing-row">
            <label>INSURANCE FEE</label>
            <div className="price-input">
              <span>$</span>
              <input
                type="text"
                name="insuranceFee"
                value={formData.insuranceFee || ''}
                onChange={handleInputChange}
                placeholder="0.00"
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div className="pricing-row">
            <label>ROAD TAX</label>
            <div className="price-input">
              <span>$</span>
              <input
                type="text"
                name="roadTax"
                value={formData.roadTax || ''}
                onChange={handleInputChange}
                placeholder="0.00"
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div className="pricing-row">
            <label>T/FER / CONVERSION</label>
            <div className="price-input">
              <span>$</span>
              <input
                type="text"
                name="transferFee"
                value={formData.transferFee || ''}
                onChange={handleInputChange}
                placeholder="0.00"
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div className="pricing-row">
            <label>INSPECTION FEE</label>
            <div className="price-input">
              <span>$</span>
              <input
                type="text"
                name="inspectionFee"
                value={formData.inspectionFee || ''}
                onChange={handleInputChange}
                placeholder="0.00"
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div className="pricing-row">
            <label>PROCESSING FEE</label>
            <div className="price-input">
              <span>$</span>
              <input
                type="text"
                name="processingFee"
                value={formData.processingFee || ''}
                onChange={handleInputChange}
                placeholder="0.00"
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div className="pricing-row">
            <label>OTHERS</label>
            <div className="price-input">
              <span>$</span>
              <input
                type="text"
                name="others"
                value={formData.others || ''}
                onChange={handleInputChange}
                placeholder="0.00"
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div className="pricing-row">
            <label>ACCESSORIES / ADD ON</label>
            <div className="price-input">
              <span>$</span>
              <input
                type="text"
                name="accessories1"
                value={formData.accessories1 || ''}
                onChange={handleInputChange}
                placeholder="0.00"
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div className="pricing-row">
            <label>ACCESSORIES / ADD ON</label>
            <div className="price-input">
              <span>$</span>
              <input
                type="text"
                name="accessories2"
                value={formData.accessories2 || ''}
                onChange={handleInputChange}
                placeholder="0.00"
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div className="pricing-row subtotal-row">
            <label>SUB-TOTAL</label>
            <div className="price-display">
              <span>$</span>
              <span className="calculated-value">{formatNum(subTotal)}</span>
            </div>
          </div>
          <div className="pricing-row">
            <label>DEPOSIT PAID (-)</label>
            <div className="price-input">
              <span>$</span>
              <input
                type="text"
                name="depositPaid"
                value={formData.depositPaid || ''}
                onChange={handleInputChange}
                placeholder="0.00"
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div className="pricing-row">
            <label>OTHERS (-)</label>
            <div className="price-input">
              <span>$</span>
              <input
                type="text"
                name="othersDeduction"
                value={formData.othersDeduction || ''}
                onChange={handleInputChange}
                placeholder="0.00"
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div className="pricing-row">
            <label>TRADE-IN-BAL (-)</label>
            <div className="price-input">
              <span>$</span>
              <input
                type="text"
                name="tradeInBalance"
                value={formData.tradeInBalance || (tradeInBalance > 0 ? formatNum(tradeInBalance) : '')}
                onChange={handleInputChange}
                placeholder="0.00"
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div className="pricing-row balance-row">
            <label>BALANCE</label>
            <div className="price-display balance-display">
              <span>$</span>
              <span className="calculated-value">{formatNum(balance)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Finance & Insurance Details */}
      <div className="info-section">
        <h3>Finance Details</h3>
        <div className="inline-edit-grid">
          <div className="inline-edit-item">
            <label htmlFor="invoice_financeCompany">Finance Company</label>
            <select
              id="invoice_financeCompany"
              name="financeCompany"
              value={formData.financeCompany || ''}
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
            <label htmlFor="invoice_financeMode">Payment Mode</label>
            <select
              id="invoice_financeMode"
              name="financeMode"
              value={formData.financeMode || ''}
              onChange={handleInputChange}
              disabled={isSubmitting}
            >
              <option value="">Select Mode</option>
              <option value="ONLINE">ONLINE</option>
              <option value="MANUAL">MANUAL</option>
            </select>
          </div>
          <div className="inline-edit-item">
            <label htmlFor="invoice_interestRate">Interest Rate (%)</label>
            <input
              type="text"
              id="invoice_interestRate"
              name="interestRate"
              value={formData.interestRate || ''}
              onChange={handleInputChange}
              placeholder="e.g., 2.28"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="invoice_tenure">Tenure (MTH)</label>
            <input
              type="text"
              id="invoice_tenure"
              name="tenure"
              value={formData.tenure || ''}
              onChange={handleInputChange}
              placeholder="e.g., 84"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="invoice_advanceArrears">Advance / Arrears</label>
            <select
              id="invoice_advanceArrears"
              name="advanceArrears"
              value={formData.advanceArrears || 'ADVANCE'}
              onChange={handleInputChange}
              disabled={isSubmitting}
            >
              {ADVANCE_ARREARS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div className="inline-edit-item">
            <label htmlFor="invoice_monthlyPayment">Monthly ($)</label>
            <input
              type="text"
              id="invoice_monthlyPayment"
              name="monthlyPayment"
              value={formData.monthlyPayment || ''}
              onChange={handleInputChange}
              placeholder="Monthly payment"
              disabled={isSubmitting}
            />
          </div>
        </div>
      </div>

      {/* Insurance Details */}
      <div className="info-section">
        <h3>Insurance Details</h3>
        <div className="inline-edit-grid">
          <div className="inline-edit-item">
            <label htmlFor="invoice_insuranceCompany">Insurance Company</label>
            <select
              id="invoice_insuranceCompany"
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
            <label htmlFor="invoice_insurancePremium">Insurance Premium ($)</label>
            <input
              type="text"
              id="invoice_insurancePremium"
              name="insurancePremium"
              value={formData.insurancePremium || ''}
              onChange={handleInputChange}
              placeholder="Premium amount"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="invoice_buyerPaymentMode">Buyer Payment Mode</label>
            <select
              id="invoice_buyerPaymentMode"
              name="buyerPaymentMode"
              value={formData.buyerPaymentMode || ''}
              onChange={handleInputChange}
              disabled={isSubmitting}
            >
              <option value="">Select Mode</option>
              {PAYMENT_MODES.map((mode) => (
                <option key={mode} value={mode}>{mode}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Trade-In Details */}
      <div className="info-section">
        <h3>Trade-In Details</h3>
        <div className="inline-edit-grid">
          <div className="inline-edit-item">
            <label htmlFor="invoice_tradeInVehicleNo">Trade-In Vehicle No</label>
            <input
              type="text"
              id="invoice_tradeInVehicleNo"
              name="tradeInVehicleNo"
              value={formData.tradeInVehicleNo || ''}
              onChange={handleInputChange}
              placeholder="Vehicle registration"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="invoice_tradeInMakeModel">Make & Model</label>
            <input
              type="text"
              id="invoice_tradeInMakeModel"
              name="tradeInMakeModel"
              value={formData.tradeInMakeModel || ''}
              onChange={handleInputChange}
              placeholder="Make and model"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="invoice_tradeInRegDate">Reg Date</label>
            <input
              type="text"
              id="invoice_tradeInRegDate"
              name="tradeInRegDate"
              value={formData.tradeInRegDate || ''}
              onChange={handleInputChange}
              placeholder="Registration date"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="invoice_tradeInPrice">Trade-In Price ($)</label>
            <input
              type="text"
              id="invoice_tradeInPrice"
              name="tradeInPrice"
              value={formData.tradeInPrice || ''}
              onChange={handleInputChange}
              placeholder="Trade-in price"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="invoice_tradeInSettlement">(-) F/Settlement ($)</label>
            <input
              type="text"
              id="invoice_tradeInSettlement"
              name="tradeInSettlement"
              value={formData.tradeInSettlement || ''}
              onChange={handleInputChange}
              placeholder="Finance settlement"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label>Trade-In Balance ($)</label>
            <input
              type="text"
              value={formatNum(tradeInBalance)}
              disabled
              className="readonly-field calculated-field"
            />
          </div>
        </div>
      </div>

      {/* Overtrade Section */}
      <div className="info-section">
        <h3>Overtrade</h3>
        <div className="inline-edit-grid">
          <div className="inline-edit-item">
            <label htmlFor="invoice_overtrade">Overtrade Amount ($)</label>
            <input
              type="text"
              id="invoice_overtrade"
              name="overtrade"
              value={formData.overtrade || ''}
              onChange={handleInputChange}
              placeholder="Overtrade amount"
              disabled={isSubmitting}
            />
          </div>
        </div>
      </div>

      {/* Remarks */}
      <div className="info-section">
        <h3>Remarks</h3>
        <div className="inline-edit-full">
          <textarea
            name="remarks"
            value={formData.remarks || ''}
            onChange={handleInputChange}
            rows="3"
            placeholder="e.g., $500 CHARGING CREDIT"
            disabled={isSubmitting}
          />
        </div>
      </div>

      {/* Disclaimer */}
      <div className="info-section invoice-disclaimer">
        <p className="disclaimer-text">
          VEH SOLD AT PROMOTION PRICE CUSTOMER AGREED NO FURTHER REPAIR FROM MOTOR EAST PTE LTD
        </p>
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
            Save Invoice
          </SaveButton>
        </div>
      </div>
    </>
  );
}

export default memo(InvoiceTab);
