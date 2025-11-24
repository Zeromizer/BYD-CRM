import { useEffect } from 'react';
import useCustomerStore from '../../stores/useCustomerStore';
import CustomerList from '../CustomerList/CustomerList';
import CustomerDetails from '../CustomerDetails/CustomerDetails';
import './Dashboard.css';

function Dashboard() {
  const { loadFromLocalStorage } = useCustomerStore();

  useEffect(() => {
    // Load customer data from localStorage on mount
    // Syncing with Drive is now handled centrally by syncCoordinator in Header
    loadFromLocalStorage();
  }, [loadFromLocalStorage]);

  return (
    <div className="dashboard">
      <div className="dashboard-grid">
        <div className="dashboard-card">
          <CustomerList />
        </div>
        <div className="dashboard-card">
          <CustomerDetails />
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
