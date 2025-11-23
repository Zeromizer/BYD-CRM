import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../stores/useAuthStore';
import useCustomerStore from '../../stores/useCustomerStore';
import syncCoordinator from '../../services/syncCoordinator';
import SyncProgressModal from '../SyncProgressModal/SyncProgressModal';
import './Header.css';

function Header() {
  const navigate = useNavigate();
  const { isSignedIn, initialize, signIn, signOut, setOnSignInCallback } = useAuthStore();
  const { repairCustomerFolders, createMissingFolders } = useCustomerStore();
  const [showDropdown, setShowDropdown] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [repairing, setRepairing] = useState(false);
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
        await syncCoordinator.syncAll(isSignedIn);
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
  }, [setOnSignInCallback, isSignedIn]);

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
      await syncCoordinator.syncAll(isSignedIn);

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

  const handleRepairFolders = async () => {
    if (!isSignedIn) {
      alert('Please connect to Google Drive first');
      return;
    }

    const confirmed = window.confirm(
      'This will scan all customers and re-link them to their folders in Google Drive.\n\n' +
      'This fixes issues after folder deletion/restoration.\n\n' +
      'Continue?'
    );

    if (!confirmed) return;

    setRepairing(true);
    setShowDropdown(false);

    try {
      console.log('Starting folder repair...');
      const results = await repairCustomerFolders(isSignedIn);

      if (results) {
        // Show detailed results
        let message = '✅ Folder Repair Complete!\n\n';
        message += `Total customers: ${results.total}\n`;
        message += `✅ Already valid: ${results.validated}\n`;
        message += `🔧 Repaired: ${results.repaired}\n`;

        if (results.notFound > 0) {
          message += `⚠️ Not found: ${results.notFound}\n\n`;
          message += 'Would you like to create folders for customers without them?';

          const createNew = window.confirm(message);

          if (createNew) {
            console.log('Creating missing folders...');
            const createResults = await createMissingFolders(isSignedIn);

            if (createResults) {
              alert(
                `✅ Folder Creation Complete!\n\n` +
                `Created: ${createResults.created} folders\n` +
                `Errors: ${createResults.errors.length}`
              );
            }
          }
        } else {
          alert(message);
        }
      }
    } catch (error) {
      console.error('Folder repair failed:', error);
      alert('❌ Folder repair failed. Check console for details.');
    } finally {
      setRepairing(false);
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
                <a
                  className="dropdown-item"
                  onClick={handleRepairFolders}
                  style={{ opacity: repairing ? 0.6 : 1, color: '#e67e22' }}
                  title="Fix customer folder links after folder deletion/restoration"
                >
                  {repairing ? 'Repairing...' : '🔧 Repair Customer Folders'}
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
