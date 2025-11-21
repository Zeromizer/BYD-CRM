import { useEffect } from 'react';
import useCustomerStore from '../../stores/useCustomerStore';
import useAuthStore from '../../stores/useAuthStore';
import CustomerList from '../CustomerList/CustomerList';
import CustomerDetails from '../CustomerDetails/CustomerDetails';
import './Dashboard.css';

function Dashboard() {
  const { loadFromLocalStorage, syncFromDrive } = useCustomerStore();
  const { isSignedIn } = useAuthStore();

  useEffect(() => {
    // Load customer data from localStorage on mount
    loadFromLocalStorage();
  }, [loadFromLocalStorage]);

  useEffect(() => {
    // Sync with Google Drive when user signs in
    if (isSignedIn) {
      console.log('User signed in, syncing from Google Drive...');
      syncFromDrive(isSignedIn);
    }
  }, [isSignedIn, syncFromDrive]);

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
