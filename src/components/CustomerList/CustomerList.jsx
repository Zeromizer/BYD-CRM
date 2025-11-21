import { useState } from 'react';
import useCustomerStore from '../../stores/useCustomerStore';
import Modal from '../Modal/Modal';
import CustomerForm from '../CustomerForm/CustomerForm';
import './CustomerList.css';

function CustomerList() {
  const { customers, selectedCustomerId, selectCustomer, addCustomer, saveToLocalStorage } = useCustomerStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredCustomers = customers.filter((customer) => {
    const search = searchTerm.toLowerCase();
    return (
      customer.name?.toLowerCase().includes(search) ||
      customer.phone?.includes(search) ||
      customer.email?.toLowerCase().includes(search)
    );
  });

  const handleAddCustomer = () => {
    setIsAddModalOpen(true);
  };

  const handleCloseModal = () => {
    if (!isSubmitting) {
      setIsAddModalOpen(false);
    }
  };

  const handleSubmit = async (formData) => {
    setIsSubmitting(true);

    try {
      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Add customer to store
      const newCustomer = addCustomer(formData);

      // Save to localStorage
      saveToLocalStorage();

      // Select the newly added customer
      selectCustomer(newCustomer.id);

      // Close modal
      setIsAddModalOpen(false);
    } catch (error) {
      console.error('Error adding customer:', error);
      alert('Failed to add customer. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="customer-list">
        <div className="customer-list-header">
          <h2>Customer List</h2>
          <button className="btn btn-primary" onClick={handleAddCustomer}>
            + Add Customer
          </button>
        </div>

        <div className="search-box">
          <input
            type="text"
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="customer-items">
          {filteredCustomers.length === 0 ? (
            <div className="empty-state">
              <p>No customers yet</p>
              <p className="empty-hint">Click "Add Customer" to get started</p>
            </div>
          ) : (
            filteredCustomers.map((customer) => (
              <div
                key={customer.id}
                className={`customer-item ${selectedCustomerId === customer.id ? 'active' : ''}`}
                onClick={() => selectCustomer(customer.id)}
              >
                <div className="customer-avatar">
                  {customer.name?.charAt(0).toUpperCase() || '?'}
                </div>
                <div className="customer-info">
                  <div className="customer-name">{customer.name || 'Unnamed'}</div>
                  <div className="customer-phone">{customer.phone || 'No phone'}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Customer Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={handleCloseModal}
        title="Add New Customer"
        size="large"
      >
        <CustomerForm
          onSubmit={handleSubmit}
          onCancel={handleCloseModal}
          isSubmitting={isSubmitting}
        />
      </Modal>
    </>
  );
}

export default CustomerList;
