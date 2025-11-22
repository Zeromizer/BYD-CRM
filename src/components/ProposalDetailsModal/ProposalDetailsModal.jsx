import { useState, useEffect } from 'react';
import Modal from '../Modal/Modal';
import './ProposalDetailsModal.css';

const VEHICLE_MODELS = [
  'BYD Atto3 Extended Range 100kw',
  'BYD Atto3 Carbon Edge 100kw',
  'BYD Seal Dynamic 100kw',
  'BYD Seal Premium',
  'BYD Seal Performance',
  'BYD Seal 6 Premium',
  'BYD Dolphin Premium',
  'BYD E6 7-Seater',
  'BYD M6 7-Seater',
  'BYD M6 Carbon Edge',
  'BYD Sealion 7 Premium',
  'BYD Sealion 7 Performance',
];

function ProposalDetailsModal({ isOpen, onClose, customer, onSave }) {
  const [isSaving, setIsSaving] = useState(false);
  const [proposalData, setProposalData] = useState({
    model: '',
    bank: '',
    sellingPrice: '',
    interestRate: '',
    downpayment: '',
    loanTenure: '',
    loanAmount: '',
    adminFee: '',
    referralFee: '',
    tradeInModel: '',
    lowLoanSurcharge: '',
    tradeInCarPlate: '',
    noLoanSurcharge: '',
    quotedTradeInPrice: '',
    benefitsGiven: '',
    remarks: '',
  });

  useEffect(() => {
    if (isOpen && customer) {
      // Load existing proposal data from customer
      setProposalData({
        model: customer.proposal_model || '',
        bank: customer.proposal_bank || '',
        sellingPrice: customer.proposal_sellingPrice || '',
        interestRate: customer.proposal_interestRate || '',
        downpayment: customer.proposal_downpayment || '',
        loanTenure: customer.proposal_loanTenure || '',
        loanAmount: customer.proposal_loanAmount || '',
        adminFee: customer.proposal_adminFee || '',
        referralFee: customer.proposal_referralFee || '',
        tradeInModel: customer.proposal_tradeInModel || '',
        lowLoanSurcharge: customer.proposal_lowLoanSurcharge || '',
        tradeInCarPlate: customer.proposal_tradeInCarPlate || '',
        noLoanSurcharge: customer.proposal_noLoanSurcharge || '',
        quotedTradeInPrice: customer.proposal_quotedTradeInPrice || '',
        benefitsGiven: customer.proposal_benefitsGiven || '',
        remarks: customer.proposal_remarks || '',
      });
    }
  }, [isOpen, customer]);

  const handleChange = (field, value) => {
    setProposalData({
      ...proposalData,
      [field]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      // Convert proposalData to customer fields with proposal_ prefix
      const updates = {};
      Object.keys(proposalData).forEach((key) => {
        updates[`proposal_${key}`] = proposalData[key];
      });

      await onSave(updates);
      onClose();
    } catch (error) {
      console.error('Error saving proposal details:', error);
      alert('Failed to save proposal details');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Proposal Details">
      <form onSubmit={handleSubmit} className="vsa-details-form">
        <div className="modal-content">
          <div className="tab-panel">
            <h3>Proposal Information</h3>

            {/* Vehicle and Finance Details */}
            <div className="form-row">
              <div className="form-group">
                <label>Model</label>
                <select
                  value={proposalData.model}
                  onChange={(e) => handleChange('model', e.target.value)}
                >
                  <option value="">Select Model</option>
                  {VEHICLE_MODELS.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Bank</label>
                <input
                  type="text"
                  value={proposalData.bank}
                  onChange={(e) => handleChange('bank', e.target.value)}
                  placeholder="e.g., DBS, OCBC, UOB"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Selling Price</label>
                <input
                  type="text"
                  value={proposalData.sellingPrice}
                  onChange={(e) => handleChange('sellingPrice', e.target.value)}
                  placeholder="e.g., $200,000"
                />
              </div>
              <div className="form-group">
                <label>Interest Rate</label>
                <input
                  type="text"
                  value={proposalData.interestRate}
                  onChange={(e) => handleChange('interestRate', e.target.value)}
                  placeholder="e.g., 2.88%"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Downpayment</label>
                <input
                  type="text"
                  value={proposalData.downpayment}
                  onChange={(e) => handleChange('downpayment', e.target.value)}
                  placeholder="e.g., $50,000"
                />
              </div>
              <div className="form-group">
                <label>Loan Tenure</label>
                <input
                  type="text"
                  value={proposalData.loanTenure}
                  onChange={(e) => handleChange('loanTenure', e.target.value)}
                  placeholder="e.g., 84 months"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Loan Amount</label>
                <input
                  type="text"
                  value={proposalData.loanAmount}
                  onChange={(e) => handleChange('loanAmount', e.target.value)}
                  placeholder="e.g., $150,000"
                />
              </div>
              <div className="form-group">
                <label>Admin Fee</label>
                <input
                  type="text"
                  value={proposalData.adminFee}
                  onChange={(e) => handleChange('adminFee', e.target.value)}
                  placeholder="e.g., $500"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Referral Fee</label>
                <input
                  type="text"
                  value={proposalData.referralFee}
                  onChange={(e) => handleChange('referralFee', e.target.value)}
                  placeholder="e.g., $1,000"
                />
              </div>
              <div className="form-group">
                <label>Trade In Model</label>
                <input
                  type="text"
                  value={proposalData.tradeInModel}
                  onChange={(e) => handleChange('tradeInModel', e.target.value)}
                  placeholder="e.g., Toyota Camry"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Low Loan Surcharge</label>
                <input
                  type="text"
                  value={proposalData.lowLoanSurcharge}
                  onChange={(e) => handleChange('lowLoanSurcharge', e.target.value)}
                  placeholder="e.g., $2,000"
                />
              </div>
              <div className="form-group">
                <label>Trade In Car Plate</label>
                <input
                  type="text"
                  value={proposalData.tradeInCarPlate}
                  onChange={(e) => handleChange('tradeInCarPlate', e.target.value)}
                  placeholder="e.g., SXX1234A"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>No Loan Surcharge</label>
                <input
                  type="text"
                  value={proposalData.noLoanSurcharge}
                  onChange={(e) => handleChange('noLoanSurcharge', e.target.value)}
                  placeholder="e.g., $3,000"
                />
              </div>
              <div className="form-group">
                <label>Quoted Trade In Price</label>
                <input
                  type="text"
                  value={proposalData.quotedTradeInPrice}
                  onChange={(e) => handleChange('quotedTradeInPrice', e.target.value)}
                  placeholder="e.g., $30,000"
                />
              </div>
            </div>

            {/* Notes Fields */}
            <div className="form-group">
              <label>Benefits Given</label>
              <textarea
                rows="3"
                value={proposalData.benefitsGiven}
                onChange={(e) => handleChange('benefitsGiven', e.target.value)}
                placeholder="List any benefits or promotions included in this proposal..."
              />
            </div>

            <div className="form-group">
              <label>Remarks</label>
              <textarea
                rows="3"
                value={proposalData.remarks}
                onChange={(e) => handleChange('remarks', e.target.value)}
                placeholder="Additional notes or remarks about this proposal..."
              />
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-success"
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Proposal Details'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default ProposalDetailsModal;
