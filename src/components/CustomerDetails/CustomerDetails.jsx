import { useState, useEffect } from 'react';
import useCustomerStore from '../../stores/useCustomerStore';
import useAuthStore from '../../stores/useAuthStore';
import authService from '../../services/authService';
import Modal from '../Modal/Modal';
import CustomerForm from '../CustomerForm/CustomerForm';
import VsaDetailsModal from '../VsaDetailsModal/VsaDetailsModal';
import ExcelPopulateModal from '../ExcelPopulateModal/ExcelPopulateModal';
import FormPrintModal from '../FormPrintModal/FormPrintModal';
import CombinePrintModal from '../CombinePrintModal/CombinePrintModal';
import './CustomerDetails.css';

function CustomerDetails() {
  const { getSelectedCustomer, updateCustomer, deleteCustomer, syncToDrive } = useCustomerStore();
  const { isSignedIn } = useAuthStore();
  const customer = getSelectedCustomer();

  const [activeTab, setActiveTab] = useState('details');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isVsaModalOpen, setIsVsaModalOpen] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isFormPrintModalOpen, setIsFormPrintModalOpen] = useState(false);
  const [isCombinePrintModalOpen, setIsCombinePrintModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Documents state
  const [documents, setDocuments] = useState([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);

  // Load documents when Documents tab is active
  useEffect(() => {
    if (activeTab === 'documents' && customer && isSignedIn) {
      loadCustomerDocuments();
    }
  }, [activeTab, customer, isSignedIn]);

  const loadCustomerDocuments = async () => {
    if (!customer.driveFolderId) {
      setDocuments([]);
      return;
    }

    setLoadingDocuments(true);

    try {
      const response = await window.gapi.client.drive.files.list({
        q: `'${customer.driveFolderId}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType, size, createdTime, webViewLink, iconLink)',
        orderBy: 'createdTime desc',
      });

      setDocuments(response.result.files || []);
    } catch (error) {
      console.error('Error loading documents:', error);
      setDocuments([]);
    } finally {
      setLoadingDocuments(false);
    }
  };

  const handleEdit = () => {
    setIsEditModalOpen(true);
  };

  const handleDelete = () => {
    setIsDeleteModalOpen(true);
  };

  const handleVsaDetails = () => {
    setIsVsaModalOpen(true);
  };

  const handleExcelPopulate = () => {
    setIsExcelModalOpen(true);
  };

  const handleCloseExcelModal = () => {
    setIsExcelModalOpen(false);
  };

  const handleFormPrint = () => {
    setIsFormPrintModalOpen(true);
  };

  const handleCloseFormPrintModal = () => {
    setIsFormPrintModalOpen(false);
  };

  const handleCombinePrint = () => {
    setIsCombinePrintModalOpen(true);
  };

  const handleCloseCombinePrintModal = () => {
    setIsCombinePrintModalOpen(false);
  };

  const handleCloseEditModal = () => {
    if (!isSubmitting) {
      setIsEditModalOpen(false);
    }
  };

  const handleCloseDeleteModal = () => {
    if (!isSubmitting) {
      setIsDeleteModalOpen(false);
    }
  };

  const handleCloseVsaModal = () => {
    if (!isSubmitting) {
      setIsVsaModalOpen(false);
    }
  };

  const handleEditSubmit = async (formData) => {
    if (!customer) return;

    setIsSubmitting(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      updateCustomer(customer.id, formData);
      await syncToDrive(isSignedIn);
      setIsEditModalOpen(false);
    } catch (error) {
      console.error('Error updating customer:', error);
      alert('Failed to update customer. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVsaSave = async (vsaUpdates) => {
    if (!customer) return;

    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      updateCustomer(customer.id, vsaUpdates);
      await syncToDrive(isSignedIn);
    } catch (error) {
      console.error('Error updating VSA details:', error);
      throw error;
    }
  };

  const handleDeleteConfirm = async () => {
    if (!customer) return;

    setIsSubmitting(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      deleteCustomer(customer.id);
      await syncToDrive(isSignedIn);
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error('Error deleting customer:', error);
      alert('Failed to delete customer. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDocument = (doc) => {
    if (doc.webViewLink) {
      window.open(doc.webViewLink, '_blank');
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    const kb = bytes / 1024;
    if (kb < 1024) return kb.toFixed(2) + ' KB';
    return (kb / 1024).toFixed(2) + ' MB';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  if (!customer) {
    return (
      <div className="customer-details">
        <div className="empty-state">
          <p>Select a customer to view details</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="customer-details">
        <div className="customer-details-header">
          <h2>{customer.name}</h2>
          <div className="customer-actions">
            <button className="btn btn-info" onClick={handleVsaDetails}>
              🚗 VSA Details
            </button>
            <button className="btn btn-success" onClick={handleFormPrint}>
              📄 Print Form
            </button>
            <button className="btn btn-success" onClick={handleCombinePrint}>
              📋 Combine & Print
            </button>
            <button className="btn btn-success" onClick={handleExcelPopulate}>
              📊 Populate Excel
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="customer-tabs">
          <button
            className={`tab ${activeTab === 'details' ? 'active' : ''}`}
            onClick={() => setActiveTab('details')}
          >
            Details
          </button>
          <button
            className={`tab ${activeTab === 'vsa' ? 'active' : ''}`}
            onClick={() => setActiveTab('vsa')}
          >
            VSA
          </button>
          <button
            className={`tab ${activeTab === 'documents' ? 'active' : ''}`}
            onClick={() => setActiveTab('documents')}
          >
            Documents {!isSignedIn && '🔒'}
          </button>
        </div>

        {/* Tab Content */}
        <div className="customer-details-content">
          {activeTab === 'details' ? (
            <>
              <div className="vsa-section">
                <div className="vsa-section-header">
                  <h3>Contact Information</h3>
                  <button className="btn btn-small btn-primary" onClick={handleEdit}>
                    Edit Details
                  </button>
                </div>
                <div className="info-grid">
                  <div className="info-item">
                    <label>Phone</label>
                    <div className="info-value">{customer.phone || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Email</label>
                    <div className="info-value">{customer.email || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>NRIC/FIN</label>
                    <div className="info-value">{customer.nric || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Date of Birth</label>
                    <div className="info-value">{customer.dob || 'N/A'}</div>
                  </div>
                </div>
              </div>

              <div className="info-section">
                <h3>Additional Information</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <label>Occupation</label>
                    <div className="info-value">{customer.occupation || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Sales Consultant</label>
                    <div className="info-value">{customer.salesConsultant || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>VSA No</label>
                    <div className="info-value">{customer.vsaNo || 'N/A'}</div>
                  </div>
                </div>
              </div>

              {customer.address && (
                <div className="info-section">
                  <h3>Address</h3>
                  <div className="info-value">
                    {customer.address}
                    {customer.addressContinue && (
                      <>
                        <br />
                        {customer.addressContinue}
                      </>
                    )}
                  </div>
                </div>
              )}

              {customer.notes && (
                <div className="info-section">
                  <h3>Notes</h3>
                  <div className="info-value">{customer.notes}</div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #f0f0f0' }}>
                <button className="btn btn-danger" onClick={handleDelete}>
                  Delete Customer
                </button>
              </div>
            </>
          ) : activeTab === 'vsa' ? (
            /* VSA Tab */
            <>
              <div className="vsa-section">
                <div className="vsa-section-header">
                  <h3>BYD New Car Details</h3>
                  <button className="btn btn-small btn-primary" onClick={handleVsaDetails}>
                    Edit VSA Details
                  </button>
                </div>
                <div className="info-grid">
                  <div className="info-item">
                    <label>Make & Model</label>
                    <div className="info-value">{customer.vsa_makeModel || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Year of Manufacture</label>
                    <div className="info-value">{customer.vsa_yom || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Body Colour</label>
                    <div className="info-value">{customer.vsa_bodyColour || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Upholstery</label>
                    <div className="info-value">{customer.vsa_upholstery || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>P/R/Z Type</label>
                    <div className="info-value">{customer.vsa_przType || 'N/A'}</div>
                  </div>
                </div>
              </div>

              <div className="info-section">
                <h3>BYD New Car Package</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <label>Package</label>
                    <div className="info-value">{customer.vsa_package || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Selling with COE</label>
                    <div className="info-value">{customer.vsa_sellingWithCOE || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Selling Price on Price List</label>
                    <div className="info-value">{customer.vsa_sellingPriceList || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Purchase Price with COE</label>
                    <div className="info-value">{customer.vsa_purchasePriceWithCOE || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>COE Rebate Level</label>
                    <div className="info-value">{customer.vsa_coeRebateLevel || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Deposit</label>
                    <div className="info-value">{customer.vsa_deposit || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Less: Others</label>
                    <div className="info-value">{customer.vsa_lessOthers || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Add: Others</label>
                    <div className="info-value">{customer.vsa_addOthers || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Approximate Delivery Date</label>
                    <div className="info-value">{customer.vsa_deliveryDate || 'N/A'}</div>
                  </div>
                </div>
              </div>

              <div className="info-section">
                <h3>Trade In Car Details</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <label>Trade in Car No</label>
                    <div className="info-value">{customer.vsa_tradeInCarNo || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Trade in Car Model</label>
                    <div className="info-value">{customer.vsa_tradeInCarModel || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Trade In Amount</label>
                    <div className="info-value">{customer.vsa_tradeInAmount || 'N/A'}</div>
                  </div>
                </div>
              </div>

              <div className="info-section">
                <h3>Delivery Details</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <label>Date of Registration</label>
                    <div className="info-value">{customer.vsa_dateOfRegistration || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Registration No</label>
                    <div className="info-value">{customer.vsa_registrationNo || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Chassis No</label>
                    <div className="info-value">{customer.vsa_chassisNo || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Engine No</label>
                    <div className="info-value">{customer.vsa_engineNo || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Motor No</label>
                    <div className="info-value">{customer.vsa_motorNo || 'N/A'}</div>
                  </div>
                </div>
              </div>

              <div className="info-section">
                <h3>Insurance</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <label>Insurance Company</label>
                    <div className="info-value">{customer.vsa_insuranceCompany || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Insurance Fee</label>
                    <div className="info-value">{customer.vsa_insuranceFee || 'N/A'}</div>
                  </div>
                </div>
              </div>

              <div className="info-section">
                <h3>Remarks & Loan Details</h3>
                {customer.vsa_remarks1 && (
                  <div className="info-item" style={{ marginBottom: '1rem' }}>
                    <label>Remarks 1</label>
                    <div className="info-value">{customer.vsa_remarks1}</div>
                  </div>
                )}
                {customer.vsa_remarks2 && (
                  <div className="info-item" style={{ marginBottom: '1rem' }}>
                    <label>Remarks 2</label>
                    <div className="info-value">{customer.vsa_remarks2}</div>
                  </div>
                )}
                <div className="info-grid">
                  <div className="info-item">
                    <label>Loan Amount</label>
                    <div className="info-value">{customer.vsa_loanAmount || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Interest</label>
                    <div className="info-value">{customer.vsa_interest || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Tenure</label>
                    <div className="info-value">{customer.vsa_tenure || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Admin Fee</label>
                    <div className="info-value">{customer.vsa_adminFee || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Insurance Subsidy</label>
                    <div className="info-value">{customer.vsa_insuranceSubsidy || 'N/A'}</div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Documents Tab */
            <div className="documents-section">
              {!isSignedIn ? (
                <div className="warning-banner">
                  <p>⚠️ Please sign in to Google Drive to view customer documents</p>
                </div>
              ) : !customer.driveFolderId ? (
                <div className="empty-state">
                  <p>No Google Drive folder for this customer yet</p>
                  <p className="empty-state-hint">
                    Documents will be saved here when you generate forms or Excel files
                  </p>
                </div>
              ) : loadingDocuments ? (
                <div className="loading-state">
                  <div className="loading"></div>
                  <p>Loading documents...</p>
                </div>
              ) : documents.length === 0 ? (
                <div className="empty-state">
                  <p>No documents found</p>
                  <p className="empty-state-hint">
                    Documents you generate will appear here
                  </p>
                </div>
              ) : (
                <div className="documents-list">
                  {documents.map((doc) => (
                    <div key={doc.id} className="document-item" onClick={() => openDocument(doc)}>
                      <div className="document-icon">
                        {doc.iconLink ? (
                          <img src={doc.iconLink} alt="" />
                        ) : (
                          <span>📄</span>
                        )}
                      </div>
                      <div className="document-info">
                        <h4>{doc.name}</h4>
                        <p>
                          {formatFileSize(doc.size)} • {formatDate(doc.createdTime)}
                        </p>
                      </div>
                      <div className="document-actions">
                        <button className="btn btn-small btn-primary" onClick={() => openDocument(doc)}>
                          Open
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit Customer Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        title="Edit Customer"
        size="large"
      >
        <CustomerForm
          customer={customer}
          onSubmit={handleEditSubmit}
          onCancel={handleCloseEditModal}
          isSubmitting={isSubmitting}
        />
      </Modal>

      {/* VSA Details Modal */}
      <VsaDetailsModal
        isOpen={isVsaModalOpen}
        onClose={handleCloseVsaModal}
        customer={customer}
        onSave={handleVsaSave}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={handleCloseDeleteModal}
        title="Delete Customer"
        size="small"
      >
        <div className="delete-confirmation">
          <p className="delete-warning">
            Are you sure you want to delete <strong>{customer.name}</strong>?
          </p>
          <p className="delete-info">
            This action cannot be undone. All customer data will be permanently removed.
          </p>
          <div className="delete-actions">
            <button
              className="btn btn-danger"
              onClick={handleDeleteConfirm}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Deleting...' : 'Yes, Delete'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleCloseDeleteModal}
              disabled={isSubmitting}
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Excel Populate Modal */}
      <ExcelPopulateModal
        isOpen={isExcelModalOpen}
        onClose={handleCloseExcelModal}
        customer={customer}
      />

      {/* Form Print Modal */}
      <FormPrintModal
        isOpen={isFormPrintModalOpen}
        onClose={handleCloseFormPrintModal}
        customer={customer}
      />

      {/* Combine Print Modal */}
      <CombinePrintModal
        isOpen={isCombinePrintModalOpen}
        onClose={handleCloseCombinePrintModal}
        customer={customer}
      />
    </>
  );
}

export default CustomerDetails;
