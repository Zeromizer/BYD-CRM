import { useState } from 'react';
import useCustomerStore from '../../stores/useCustomerStore';
import './CustomerList.css';

function CustomerList() {
  const { customers, selectedCustomerId, selectCustomer } = useCustomerStore();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCustomers = customers.filter((customer) => {
    const search = searchTerm.toLowerCase();
    return (
      customer.name?.toLowerCase().includes(search) ||
      customer.phone?.includes(search) ||
      customer.email?.toLowerCase().includes(search)
    );
  });

  const handleAddCustomer = () => {
    // TODO: Open add customer modal
    console.log('Add customer clicked');
  };

  return (
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
  );
}

export default CustomerList;
