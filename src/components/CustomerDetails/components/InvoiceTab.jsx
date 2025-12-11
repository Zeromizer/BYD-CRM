import { memo, useCallback, useMemo, useState } from 'react';
import { SaveButton } from '../../AnimatedButton/AnimatedButton';

/**
 * InvoiceTab - Pricing section for invoice
 * Price Sold = Purchase Price with COE (from VSA)
 * Loan Amount = Loan Amount (from VSA)
 * First Payment = Price Sold - Loan Amount
 * Insurance Fee = VSA Insurance Fee - Insurance Subsidy
 * Installment = Monthly Repayment (only included if interest rate > 2.5%)
 * Sub-Total = First Payment + conditional fees
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
  const [activeTooltip, setActiveTooltip] = useState(null);

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    onFieldChange(name, value);
  }, [onFieldChange]);

  // Toggle tooltip (for mobile click)
  const toggleTooltip = useCallback((field) => {
    setActiveTooltip(prev => prev === field ? null : field);
  }, []);

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

  // Price Sold: Purchase Price with COE from VSA
  const priceSoldData = useMemo(() => {
    const value = parseNum(vsaData?.purchasePriceWithCOE);
    return {
      value,
      tooltip: `From VSA Vehicle Package`,
      source: 'VSA'
    };
  }, [vsaData?.purchasePriceWithCOE]);

  // Loan Amount from VSA
  const loanAmountData = useMemo(() => {
    const value = parseNum(vsaData?.loanAmount);
    return {
      value,
      tooltip: `From VSA Remarks & Loan`,
      source: 'VSA'
    };
  }, [vsaData?.loanAmount]);

  // Calculate First Payment: Price Sold - Loan Amount
  const firstPaymentData = useMemo(() => {
    const value = priceSoldData.value - loanAmountData.value;
    return {
      value,
      tooltip: `Price Sold: $${formatNum(priceSoldData.value)}\nLoan Amount: -$${formatNum(loanAmountData.value)}`,
      source: 'Calculated'
    };
  }, [priceSoldData.value, loanAmountData.value]);

  // Interest rate and installment logic
  // If interest rate > 2.5%, include installment in sub-total
  // If interest rate <= 2.5%, exclude installment from sub-total
  const installmentData = useMemo(() => {
    const interestRate = parseNum(vsaData?.interest);
    const monthlyRepayment = parseNum(vsaData?.monthlyRepayment || formData.installment);
    const includeInSubtotal = interestRate > 2.5;

    return {
      value: monthlyRepayment,
      interestRate,
      includeInSubtotal,
      tooltip: includeInSubtotal
        ? `Monthly Repayment: $${formatNum(monthlyRepayment)}\nInterest Rate: ${interestRate}% (> 2.5%)\n✓ Included in Sub-Total`
        : `Monthly Repayment: $${formatNum(monthlyRepayment)}\nInterest Rate: ${interestRate}% (≤ 2.5%)\n✗ Not included in Sub-Total`,
      source: 'VSA Remarks & Loan'
    };
  }, [vsaData?.interest, vsaData?.monthlyRepayment, formData.installment]);

  // Calculate Insurance Fee: VSA Insurance Fee - Insurance Subsidy
  const insuranceFeeData = useMemo(() => {
    const insuranceFee = parseNum(vsaData?.insuranceFee);
    const insuranceSubsidy = parseNum(vsaData?.insuranceSubsidy);
    return {
      value: insuranceFee - insuranceSubsidy,
      tooltip: `Insurance Fee: $${formatNum(insuranceFee)}\nInsurance Subsidy: -$${formatNum(insuranceSubsidy)}`,
      source: 'VSA Insurance'
    };
  }, [vsaData?.insuranceFee, vsaData?.insuranceSubsidy]);

  // Calculate sub-total: First Payment + fees (installment only if interest > 2.5%)
  const subTotal = useMemo(() => {
    const firstPayment = firstPaymentData.value;
    // Only include installment if interest rate > 2.5%
    const installment = installmentData.includeInSubtotal ? installmentData.value : 0;
    const insuranceFee = insuranceFeeData.value;
    const roadTax = parseNum(formData.roadTax);
    const transferFee = parseNum(formData.transferFee);
    const inspectionFee = parseNum(formData.inspectionFee);
    const processingFee = parseNum(formData.processingFee);
    const others = parseNum(formData.others);
    const accessories1 = parseNum(formData.accessories1);
    const accessories2 = parseNum(formData.accessories2);

    return firstPayment + installment + insuranceFee + roadTax + transferFee + inspectionFee + processingFee + others + accessories1 + accessories2;
  }, [formData, firstPaymentData.value, installmentData, insuranceFeeData.value]);

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

  // Tooltip component
  const PriceTooltip = ({ field, tooltip, source, children }) => (
    <div
      className="price-with-tooltip"
      onClick={() => toggleTooltip(field)}
      onMouseEnter={() => setActiveTooltip(field)}
      onMouseLeave={() => setActiveTooltip(null)}
    >
      {children}
      {activeTooltip === field && (
        <div className="price-tooltip">
          <div className="tooltip-source">Source: {source}</div>
          <div className="tooltip-content">{tooltip}</div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Pricing Section */}
      <div className="info-section">
        <h3>Pricing</h3>
        <div className="invoice-pricing-grid">
          <div className="pricing-row">
            <label>PRICE SOLD</label>
            <PriceTooltip
              field="priceSold"
              tooltip={priceSoldData.tooltip}
              source={priceSoldData.source}
            >
              <div className="price-input">
                <span>$</span>
                <span className="price-value-text">{formatNum(priceSoldData.value)}</span>
              </div>
              <span className="tooltip-icon">ⓘ</span>
            </PriceTooltip>
          </div>
          <div className="pricing-row">
            <label>LOAN AMOUNT</label>
            <PriceTooltip
              field="loanAmount"
              tooltip={loanAmountData.tooltip}
              source={loanAmountData.source}
            >
              <div className="price-input">
                <span>$</span>
                <span className="price-value-text">{formatNum(loanAmountData.value)}</span>
              </div>
              <span className="tooltip-icon">ⓘ</span>
            </PriceTooltip>
          </div>
          <div className="pricing-row">
            <label>FIRST PAYMENT</label>
            <PriceTooltip
              field="firstPayment"
              tooltip={firstPaymentData.tooltip}
              source={firstPaymentData.source}
            >
              <div className="price-input">
                <span>$</span>
                <span className="price-value-text">{formatNum(firstPaymentData.value)}</span>
              </div>
              <span className="tooltip-icon">ⓘ</span>
            </PriceTooltip>
          </div>
          <div className={`pricing-row ${!installmentData.includeInSubtotal ? 'excluded-from-total' : ''}`}>
            <label>INSTALLMENT</label>
            <PriceTooltip
              field="installment"
              tooltip={installmentData.tooltip}
              source={installmentData.source}
            >
              <div className="price-input">
                <span>$</span>
                <span className="price-value-text">{formatNum(installmentData.value)}</span>
              </div>
              <span className="tooltip-icon">ⓘ</span>
            </PriceTooltip>
          </div>
          <div className="pricing-row">
            <label>INSURANCE FEE</label>
            <PriceTooltip
              field="insuranceFee"
              tooltip={insuranceFeeData.tooltip}
              source={insuranceFeeData.source}
            >
              <div className="price-input">
                <span>$</span>
                <span className="price-value-text">{formatNum(insuranceFeeData.value)}</span>
              </div>
              <span className="tooltip-icon">ⓘ</span>
            </PriceTooltip>
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
              <span className="price-value-text bold-value">{formatNum(subTotal)}</span>
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
