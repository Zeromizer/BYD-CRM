import { useState } from 'react';
import useCustomerStore from '../../stores/useCustomerStore';
import Modal from '../Modal/Modal';
import CustomerForm from '../CustomerForm/CustomerForm';
import './CustomerDetails.css';

function CustomerDetails() {
  const { getSelectedCustomer, updateCustomer, deleteCustomer, saveToLocalStorage } = useCustomerStore();
  const customer = getSelectedCustomer();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEdit = () => {
    setIsEditModalOpen(true);
  };

  const handleDelete = () => {
    setIsDeleteModalOpen(true);
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

  const handleEditSubmit = async (formData) => {
    if (!customer) return;

    setIsSubmitting(true);

    try {
      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Update customer in store
      updateCustomer(customer.id, formData);

      // Save to localStorage
      saveToLocalStorage();

      // Close modal
      setIsEditModalOpen(false);
    } catch (error) {
      console.error('Error updating customer:', error);
      alert('Failed to update customer. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!customer) return;

    setIsSubmitting(true);

    try {
      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Delete customer from store
      deleteCustomer(customer.id);

      // Save to localStorage
      saveToLocalStorage();

      // Close modal
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error('Error deleting customer:', error);
      alert('Failed to delete customer. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
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
            <button className="btn btn-secondary" onClick={handleEdit}>
              Edit
            </button>
            <button className="btn btn-danger" onClick={handleDelete}>
              Delete
            </button>
          </div>
        </div>

        <div className="customer-details-content">
          <div className="info-section">
            <h3>Contact Information</h3>
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
    </>
  );
}

export default CustomerDetails;
