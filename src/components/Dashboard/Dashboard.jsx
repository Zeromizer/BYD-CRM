import { useEffect } from 'react';
import useCustomerStore from '../../stores/useCustomerStore';
import useAuthStore from '../../stores/useAuthStore';
import CustomerList from '../CustomerList/CustomerList';
import CustomerDetails from '../CustomerDetails/CustomerDetails';
import './Dashboard.css';

function Dashboard() {
  const { loadFromLocalStorage, selectedCustomerId } = useCustomerStore();
  const { isInitialized, canLoadData, isUserVerified } = useAuthStore();

  useEffect(() => {
    // Wait for auth to initialize before loading data
    if (!isInitialized) {
      return;
    }

    // Only load data if it's safe (user matches data owner or fresh start)
    if (canLoadData()) {
      console.log('Dashboard: Loading customer data from localStorage');
      loadFromLocalStorage();
    } else {
      console.log('Dashboard: Waiting for user verification before loading data');
    }
  }, [isInitialized, isUserVerified, loadFromLocalStorage, canLoadData]);

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
