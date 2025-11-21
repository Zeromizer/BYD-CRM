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
            <button className="btn btn-secondary" onClick={handleEdit}>
              Edit
            </button>
            <button className="btn btn-danger" onClick={handleDelete}>
              Delete
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
