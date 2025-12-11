import { memo, useCallback, useMemo } from 'react';
import { SaveButton } from '../../AnimatedButton/AnimatedButton';

/**
 * InvoiceTab - Pricing section for invoice
 * First Payment is calculated as Purchase Price with COE - Loan Amount
 */
function InvoiceTab({
  formData,
  vsaData,
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

  // Parse number helper
  const parseNum = (val) => {
    const num = parseFloat(String(val).replace(/,/g, ''));
    return isNaN(num) ? 0 : num;
  };

  // Format number with commas
  const formatNum = (num) => {
    if (num === 0) return '0.00';
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Calculate First Payment: Purchase Price with COE - Loan Amount
  const firstPayment = useMemo(() => {
    const purchasePriceWithCOE = parseNum(vsaData?.purchasePriceWithCOE || formData.priceSold);
    const loanAmount = parseNum(formData.financeAmount || vsaData?.loanAmount);
    return purchasePriceWithCOE - loanAmount;
  }, [vsaData?.purchasePriceWithCOE, vsaData?.loanAmount, formData.priceSold, formData.financeAmount]);

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
  }, [formData.tradeInPrice, formData.tradeInSettlement]);

  // Calculate final balance
  const balance = useMemo(() => {
    const deposit = parseNum(formData.depositPaid);
    const othersDeduction = parseNum(formData.othersDeduction);
    const tradeIn = parseNum(formData.tradeInBalance) || tradeInBalance;

    return subTotal - deposit - othersDeduction - tradeIn;
  }, [subTotal, formData.depositPaid, formData.othersDeduction, formData.tradeInBalance, tradeInBalance]);

  return (
    <>
      {/* Pricing Section */}
      <div className="info-section">
        <h3>Pricing</h3>
        <div className="invoice-pricing-grid">
          <div className="pricing-row">
            <label>FIRST PAYMENT</label>
            <div className="price-display">
              <span>$</span>
              <span className="calculated-value bold-value">{formatNum(firstPayment)}</span>
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
          <div className="pricing-row subtotal-row-simple">
            <label>SUB-TOTAL</label>
            <div className="price-input">
              <span>$</span>
              <span className="bold-value">{formatNum(subTotal)}</span>
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
