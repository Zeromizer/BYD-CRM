import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../stores/useAuthStore';
import useCustomerStore from '../../stores/useCustomerStore';
import useFormsStore from '../../stores/useFormsStore';
import useExcelStore from '../../stores/useExcelStore';
import syncCoordinator from '../../services/syncCoordinator';
import SyncProgressModal from '../SyncProgressModal/SyncProgressModal';
import './Header.css';

function Header() {
  const navigate = useNavigate();
  const { isSignedIn, initialize, signIn, signOut, setOnSignInCallback } = useAuthStore();
  const customerStore = useCustomerStore();
  const formsStore = useFormsStore();
  const excelStore = useExcelStore();
  const [showDropdown, setShowDropdown] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showSyncProgress, setShowSyncProgress] = useState(false);
  const [syncProgress, setSyncProgress] = useState({
    customers: { status: 'pending', detail: '' },
    forms: { status: 'pending', detail: '' },
    excel: { status: 'pending', detail: '' },
    overall: 0,
  });

  // Set up sync coordinator callback
  useEffect(() => {
    const syncAllData = async () => {
      console.log('Starting parallel sync of all data...');
      setShowSyncProgress(true);
      setSyncing(true);

      try {
        await syncCoordinator.syncAll(customerStore, formsStore, excelStore, isSignedIn);
        console.log('Parallel sync complete');

        // Keep modal visible for 1.5 seconds to show success
        setTimeout(() => {
          setShowSyncProgress(false);
          setSyncing(false);
        }, 1500);
      } catch (error) {
        console.error('Sync failed:', error);
        setTimeout(() => {
          setShowSyncProgress(false);
          setSyncing(false);
        }, 2000);
      }
    };

    setOnSignInCallback(syncAllData);
  }, [setOnSignInCallback, customerStore, formsStore, excelStore, isSignedIn]);

  // Subscribe to progress updates
  useEffect(() => {
    const unsubscribe = syncCoordinator.onProgress((progress) => {
      setSyncProgress(progress);
    });

    return unsubscribe;
  }, []);

  // Initialize authentication on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  const handleAuth = () => {
    if (isSignedIn) {
      // If signed in, sign out
      if (window.confirm('Are you sure you want to disconnect from Google Drive?')) {
        signOut();
      }
    } else {
      // If not signed in, sign in
      signIn();
    }
  };

  const handleForceSync = async () => {
    if (!isSignedIn) {
      alert('Please connect to Google Drive first');
      return;
    }

    setSyncing(true);
    setShowDropdown(false);
    setShowSyncProgress(true);

    try {
      console.log('Force syncing all data...');
      await syncCoordinator.syncAll(customerStore, formsStore, excelStore, isSignedIn);

      // Keep modal visible for 1.5 seconds to show success
      setTimeout(() => {
        setShowSyncProgress(false);
        setSyncing(false);
      }, 1500);
    } catch (error) {
      console.error('Force sync failed:', error);
      setTimeout(() => {
        setShowSyncProgress(false);
        setSyncing(false);
      }, 2000);
    }
  };

  return (
    <header className="header">
      <div className="header-container">
        <div className="header-left">
          <h1 className="header-title" onClick={() => navigate('/')} style={{ cursor: 'pointer' }} title="Go to homepage">
            <span className="byd-logo">BYD</span>
            <span className="divider">|</span>
            <span className="motor-east">MOTOR-EAST</span>
          </h1>
        </div>

        <div className="header-actions">
          <button
            className={`auth-button ${isSignedIn ? 'connected' : ''}`}
            onClick={handleAuth}
            title={isSignedIn ? 'Connected to Google Drive - Click to disconnect' : 'Click to connect to Google Drive'}
          >
            <span className="status-dot"></span>
            <span>{isSignedIn ? 'Connected' : 'Connect Drive'}</span>
          </button>

          <div className="dropdown">
            <button
              className="dropdown-toggle"
              onClick={() => setShowDropdown(!showDropdown)}
              title="More Options"
            >
              ⋮
            </button>
            {showDropdown && (
              <div className="dropdown-menu">
                <a className="dropdown-item" onClick={() => { navigate('/'); setShowDropdown(false); }}>
                  Customer List
                </a>
                <a className="dropdown-item" onClick={() => { navigate('/forms'); setShowDropdown(false); }}>
                  Manage Forms
                </a>
                <a className="dropdown-item" onClick={() => { navigate('/excel'); setShowDropdown(false); }}>
                  Manage Excel
                </a>
                <a className="dropdown-item" onClick={() => console.log('Statistics')}>
                  View Statistics
                </a>
                <a
                  className="dropdown-item"
                  onClick={handleForceSync}
                  style={{ opacity: syncing ? 0.6 : 1 }}
                >
                  {syncing ? 'Syncing...' : 'Force Sync'}
                </a>
                <a className="dropdown-item" onClick={() => console.log('Export')}>
                  Export Data
                </a>
                <a className="dropdown-item" onClick={() => console.log('Import')}>
                  Import Data
                </a>
                <div className="dropdown-divider"></div>
                <a
                  className="dropdown-item"
                  href="../"
                  rel="noopener noreferrer"
                >
                  Switch to Classic Version
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sync Progress Modal */}
      <SyncProgressModal isOpen={showSyncProgress} progress={syncProgress} />
    </header>
  );
}

export default Header;
