import { useState, useEffect } from 'react';
import Modal from '../Modal/Modal';
import './VsaDetailsModal.css';

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

const BODY_COLOURS = [
  'Ski White',
  'Surf Blue',
  'Cosmos Black',
  'Boulder Grey',
  'Atlantis Grey',
  'Arctic Blue',
  'Aurora While',
  'Maldive Purple',
  'Coral Pink',
  'Sand White',
  'Urban Grey',
  'Crystal White',
  'Harbor Grey',
  'Inkstone Blue',
  'Shark Grey',
  'Whale Sea Blue',
  'Arctic White',
];

function VsaDetailsModal({ isOpen, onClose, customer, onSave }) {
  const [activeTab, setActiveTab] = useState('newCarDetails');
  const [isSaving, setIsSaving] = useState(false);
  const [vsaData, setVsaData] = useState({
    // BYD New Car Details
    makeModel: '',
    yom: '',
    bodyColour: '',
    upholstery: 'Standard',
    przType: '',

    // BYD New Car Package
    package: 'Excite',
    sellingWithCOE: 'WITH',
    sellingPriceList: '',
    purchasePriceWithCOE: '',
    coeRebateLevel: '',
    deposit: '',
    lessOthers: '',
    addOthers: '',
    deliveryDate: '',

    // Trade in Car Details
    tradeInCarNo: '',
    tradeInCarModel: '',
    tradeInAmount: '',

    // Delivery Details
    dateOfRegistration: '',
    registrationNo: '',
    chassisNo: '',
    engineNo: '',

    // Insurance
    insuranceCompany: '',
    insuranceFee: '',

    // Remarks
    remarks1: '',
    remarks2: '',
    loanAmount: '',
    interest: '',
    tenure: '',
    adminFee: '',
    insuranceSubsidy: '',
  });

  useEffect(() => {
    if (isOpen && customer) {
      // Load existing VSA data from customer
      setVsaData({
        makeModel: customer.vsa_makeModel || '',
        yom: customer.vsa_yom || '',
        bodyColour: customer.vsa_bodyColour || '',
        upholstery: customer.vsa_upholstery || 'Standard',
        przType: customer.vsa_przType || '',
        package: customer.vsa_package || 'Excite',
        sellingWithCOE: customer.vsa_sellingWithCOE || 'WITH',
        sellingPriceList: customer.vsa_sellingPriceList || '',
        purchasePriceWithCOE: customer.vsa_purchasePriceWithCOE || '',
        coeRebateLevel: customer.vsa_coeRebateLevel || '',
        deposit: customer.vsa_deposit || '',
        lessOthers: customer.vsa_lessOthers || '',
        addOthers: customer.vsa_addOthers || '',
        deliveryDate: customer.vsa_deliveryDate || '',
        tradeInCarNo: customer.vsa_tradeInCarNo || '',
        tradeInCarModel: customer.vsa_tradeInCarModel || '',
        tradeInAmount: customer.vsa_tradeInAmount || '',
        dateOfRegistration: customer.vsa_dateOfRegistration || '',
        registrationNo: customer.vsa_registrationNo || '',
        chassisNo: customer.vsa_chassisNo || '',
        engineNo: customer.vsa_engineNo || '',
        insuranceCompany: customer.vsa_insuranceCompany || '',
        insuranceFee: customer.vsa_insuranceFee || '',
        remarks1: customer.vsa_remarks1 || '',
        remarks2: customer.vsa_remarks2 || '',
        loanAmount: customer.vsa_loanAmount || '',
        interest: customer.vsa_interest || '',
        tenure: customer.vsa_tenure || '',
        adminFee: customer.vsa_adminFee || '',
        insuranceSubsidy: customer.vsa_insuranceSubsidy || '',
      });
      setActiveTab('newCarDetails');
    }
  }, [isOpen, customer]);

  const handleChange = (field, value) => {
    setVsaData({
      ...vsaData,
      [field]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      // Convert vsaData to customer fields with vsa_ prefix
      const updates = {};
      Object.keys(vsaData).forEach((key) => {
        updates[`vsa_${key}`] = vsaData[key];
      });

      await onSave(updates);
      onClose();
    } catch (error) {
      console.error('Error saving VSA details:', error);
      alert('Failed to save VSA details');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="VSA Details" size="xl">
      <form onSubmit={handleSubmit} className="vsa-details-form">
        {/* Tabs */}
        <div className="vsa-tabs">
          <button
            type="button"
            className={`vsa-tab ${activeTab === 'newCarDetails' ? 'active' : ''}`}
            onClick={() => setActiveTab('newCarDetails')}
          >
            BYD New Car Details
          </button>
          <button
            type="button"
            className={`vsa-tab ${activeTab === 'newCarPackage' ? 'active' : ''}`}
            onClick={() => setActiveTab('newCarPackage')}
          >
            BYD New Car Package
          </button>
          <button
            type="button"
            className={`vsa-tab ${activeTab === 'tradeInCar' ? 'active' : ''}`}
            onClick={() => setActiveTab('tradeInCar')}
          >
            Trade in Car Details
          </button>
          <button
            type="button"
            className={`vsa-tab ${activeTab === 'deliveryDetails' ? 'active' : ''}`}
            onClick={() => setActiveTab('deliveryDetails')}
          >
            Delivery Details
          </button>
          <button
            type="button"
            className={`vsa-tab ${activeTab === 'insurance' ? 'active' : ''}`}
            onClick={() => setActiveTab('insurance')}
          >
            Insurance
          </button>
          <button
            type="button"
            className={`vsa-tab ${activeTab === 'remarks' ? 'active' : ''}`}
            onClick={() => setActiveTab('remarks')}
          >
            Remarks
          </button>
        </div>

        {/* Tab Content */}
        <div className="vsa-tab-content">
          {/* BYD New Car Details Tab */}
          {activeTab === 'newCarDetails' && (
            <div className="tab-panel">
              <h3>BYD New Car Details</h3>

              <div className="form-row">
                <div className="form-group">
                  <label>Make & Model</label>
                  <select
                    value={vsaData.makeModel}
                    onChange={(e) => handleChange('makeModel', e.target.value)}
                  >
                    <option value="">Select a model...</option>
                    {VEHICLE_MODELS.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>YOM (Year of Manufacture)</label>
                  <input
                    type="text"
                    value={vsaData.yom}
                    onChange={(e) => handleChange('yom', e.target.value)}
                    placeholder="e.g., 2024"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Body Colour</label>
                  <select
                    value={vsaData.bodyColour}
                    onChange={(e) => handleChange('bodyColour', e.target.value)}
                  >
                    <option value="">Select a colour...</option>
                    {BODY_COLOURS.map((colour) => (
                      <option key={colour} value={colour}>
                        {colour}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Upholstery</label>
                  <input
                    type="text"
                    value={vsaData.upholstery}
                    onChange={(e) => handleChange('upholstery', e.target.value)}
                    placeholder="e.g., Black Leather"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>P/R/Z Type</label>
                <select
                  value={vsaData.przType}
                  onChange={(e) => handleChange('przType', e.target.value)}
                >
                  <option value="">Select type...</option>
                  <option value="P - Passenger Motor Car">P - Passenger Motor Car</option>
                  <option value="R - Rental / Leasing">R - Rental / Leasing</option>
                  <option value="Z - Private Hire">Z - Private Hire</option>
                </select>
              </div>
            </div>
          )}

          {/* BYD New Car Package Tab */}
          {activeTab === 'newCarPackage' && (
            <div className="tab-panel">
              <h3>BYD New Car Package</h3>

              <div className="form-group">
                <label>Package</label>
                <input
                  type="text"
                  value={vsaData.package}
                  onChange={(e) => handleChange('package', e.target.value)}
                  placeholder="e.g., Premium Package"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Selling with COE</label>
                  <select
                    value={vsaData.sellingWithCOE}
                    onChange={(e) => handleChange('sellingWithCOE', e.target.value)}
                  >
                    <option value="WITH">WITH</option>
                    <option value="WITHOUT">WITHOUT</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Selling Price on Price List</label>
                  <input
                    type="text"
                    value={vsaData.sellingPriceList}
                    onChange={(e) => handleChange('sellingPriceList', e.target.value)}
                    placeholder="e.g., $245,000"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Purchase Price with COE</label>
                  <input
                    type="text"
                    value={vsaData.purchasePriceWithCOE}
                    onChange={(e) => handleChange('purchasePriceWithCOE', e.target.value)}
                    placeholder="e.g., $250,000"
                  />
                </div>
                <div className="form-group">
                  <label>COE Rebate Level</label>
                  <input
                    type="text"
                    value={vsaData.coeRebateLevel}
                    onChange={(e) => handleChange('coeRebateLevel', e.target.value)}
                    placeholder="e.g., Level 1"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Deposit</label>
                  <input
                    type="text"
                    value={vsaData.deposit}
                    onChange={(e) => handleChange('deposit', e.target.value)}
                    placeholder="e.g., $25,000"
                  />
                </div>
                <div className="form-group">
                  <label>Less: Others</label>
                  <input
                    type="text"
                    value={vsaData.lessOthers}
                    onChange={(e) => handleChange('lessOthers', e.target.value)}
                    placeholder="e.g., $5,000"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Add: Others</label>
                <input
                  type="text"
                  value={vsaData.addOthers}
                  onChange={(e) => handleChange('addOthers', e.target.value)}
                  placeholder="e.g., $2,000"
                />
              </div>

              <div className="form-group">
                <label>Approximate Delivery Date</label>
                <input
                  type="text"
                  value={vsaData.deliveryDate}
                  onChange={(e) => handleChange('deliveryDate', e.target.value)}
                  placeholder="e.g., NOV/DEC 2025"
                />
              </div>
            </div>
          )}

          {/* Trade in Car Details Tab */}
          {activeTab === 'tradeInCar' && (
            <div className="tab-panel">
              <h3>Trade in Car Details</h3>

              <div className="form-row">
                <div className="form-group">
                  <label>Trade in Car No</label>
                  <input
                    type="text"
                    value={vsaData.tradeInCarNo}
                    onChange={(e) => handleChange('tradeInCarNo', e.target.value)}
                    placeholder="e.g., ABC1234X"
                  />
                </div>
                <div className="form-group">
                  <label>Trade in Car Model</label>
                  <input
                    type="text"
                    value={vsaData.tradeInCarModel}
                    onChange={(e) => handleChange('tradeInCarModel', e.target.value)}
                    placeholder="e.g., Toyota Corolla"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Trade In Amount</label>
                <input
                  type="text"
                  value={vsaData.tradeInAmount}
                  onChange={(e) => handleChange('tradeInAmount', e.target.value)}
                  placeholder="e.g., $50,000"
                />
              </div>
            </div>
          )}

          {/* Delivery Details Tab */}
          {activeTab === 'deliveryDetails' && (
            <div className="tab-panel">
              <h3>Delivery Details</h3>

              <div className="form-row">
                <div className="form-group">
                  <label>Date of Registration</label>
                  <input
                    type="date"
                    value={vsaData.dateOfRegistration}
                    onChange={(e) => handleChange('dateOfRegistration', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Registration No</label>
                  <input
                    type="text"
                    value={vsaData.registrationNo}
                    onChange={(e) => handleChange('registrationNo', e.target.value)}
                    placeholder="e.g., ABC1234X"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Chassis No</label>
                  <input
                    type="text"
                    value={vsaData.chassisNo}
                    onChange={(e) => handleChange('chassisNo', e.target.value)}
                    placeholder="e.g., LGXXX12345678"
                  />
                </div>
                <div className="form-group">
                  <label>Engine No</label>
                  <input
                    type="text"
                    value={vsaData.engineNo}
                    onChange={(e) => handleChange('engineNo', e.target.value)}
                    placeholder="e.g., ENG123456"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Insurance Tab */}
          {activeTab === 'insurance' && (
            <div className="tab-panel">
              <h3>Insurance</h3>

              <div className="form-row">
                <div className="form-group">
                  <label>Insurance Company</label>
                  <input
                    type="text"
                    value={vsaData.insuranceCompany}
                    onChange={(e) => handleChange('insuranceCompany', e.target.value)}
                    placeholder="e.g., AIG Insurance"
                  />
                </div>
                <div className="form-group">
                  <label>Insurance Fee</label>
                  <input
                    type="text"
                    value={vsaData.insuranceFee}
                    onChange={(e) => handleChange('insuranceFee', e.target.value)}
                    placeholder="e.g., $1,200"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Remarks Tab */}
          {activeTab === 'remarks' && (
            <div className="tab-panel">
              <h3>Remarks</h3>

              <div className="form-group">
                <label>Remarks 1</label>
                <textarea
                  rows="2"
                  value={vsaData.remarks1}
                  onChange={(e) => handleChange('remarks1', e.target.value)}
                  placeholder="e.g., 4 BIDS GUARANTEED COE. $1000 INSURANCE SUBSIDY FOR THE FIRST YEAR."
                />
              </div>

              <div className="form-group">
                <label>Remarks 2</label>
                <textarea
                  rows="2"
                  value={vsaData.remarks2}
                  onChange={(e) => handleChange('remarks2', e.target.value)}
                  placeholder="e.g., BALANCE DEPOSIT TO BE PAID UPON LOAN APPROVAL BEFORE COE BIDDING."
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Loan Amount</label>
                  <input
                    type="text"
                    value={vsaData.loanAmount}
                    onChange={(e) => handleChange('loanAmount', e.target.value)}
                    placeholder="e.g., $200,000"
                  />
                </div>
                <div className="form-group">
                  <label>Interest</label>
                  <input
                    type="text"
                    value={vsaData.interest}
                    onChange={(e) => handleChange('interest', e.target.value)}
                    placeholder="e.g., 2.88%"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Tenure</label>
                <input
                  type="text"
                  value={vsaData.tenure}
                  onChange={(e) => handleChange('tenure', e.target.value)}
                  placeholder="e.g., 84 months"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Admin Fee</label>
                  <input
                    type="text"
                    value={vsaData.adminFee}
                    onChange={(e) => handleChange('adminFee', e.target.value)}
                    placeholder="e.g., $500"
                  />
                </div>
                <div className="form-group">
                  <label>Insurance Subsidy</label>
                  <input
                    type="text"
                    value={vsaData.insuranceSubsidy}
                    onChange={(e) => handleChange('insuranceSubsidy', e.target.value)}
                    placeholder="e.g., $1000"
                  />
                </div>
              </div>
            </div>
          )}
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
            {isSaving ? 'Saving...' : 'Save VSA Details'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default VsaDetailsModal;
