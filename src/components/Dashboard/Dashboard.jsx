import { useEffect } from 'react';
import useCustomerStore from '../../stores/useCustomerStore';
import CustomerList from '../CustomerList/CustomerList';
import CustomerDetails from '../CustomerDetails/CustomerDetails';
import './Dashboard.css';

function Dashboard() {
  const { loadFromLocalStorage, selectedCustomerId } = useCustomerStore();

  useEffect(() => {
    // Load customer data from localStorage on mount
    // Syncing with Drive is now handled centrally by syncCoordinator in Header
    loadFromLocalStorage();
  }, [loadFromLocalStorage]);

  return (
    <div className="dashboard">
      <div className="dashboard-grid">
        {/* Customer List - Hidden on mobile when customer selected */}
        <div className={`dashboard-card customer-list-panel ${selectedCustomerId ? 'mobile-hidden' : ''}`}>
          <CustomerList />
        </div>

        {/* Customer Details - Hidden on mobile when no customer selected */}
        <div className={`dashboard-card customer-details-panel ${!selectedCustomerId ? 'mobile-hidden' : ''}`}>
          <CustomerDetails />
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
