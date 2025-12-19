import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore, { useCurrentUserName } from '../../stores/useAuthStore';
import useCustomerStore from '../../stores/useCustomerStore';
import syncCoordinator from '../../services/syncCoordinator';
import SyncProgressModal from '../SyncProgressModal/SyncProgressModal';
import SyncStatusIndicator from '../SyncStatusIndicator/SyncStatusIndicator';
import TemplateExportImport from '../TemplateExportImport/TemplateExportImport';
import SettingsModal from '../SettingsModal/SettingsModal';
import { useTheme } from '../../context/ThemeContext';
import './Header.css';

function Header() {
  const navigate = useNavigate();
  const { isSignedIn, initialize, signIn, signOut, setOnSignInCallback } = useAuthStore();
  const currentUserName = useCurrentUserName();
  const { selectCustomer } = useCustomerStore();
  const { theme, toggleTheme, isDark } = useTheme();
  const [showDropdown, setShowDropdown] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showSyncProgress, setShowSyncProgress] = useState(false);
  const [showExportImport, setShowExportImport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [syncProgress, setSyncProgress] = useState({
    customers: { status: 'pending', detail: '' },
    excel: { status: 'pending', detail: '' },
    documents: { status: 'pending', detail: '' },
    overall: 0,
  });

  // Set up sync coordinator callback
  useEffect(() => {
    const syncAllData = async () => {
      // Get the current isSignedIn state from the store (not the stale closure value)
      const currentIsSignedIn = useAuthStore.getState().isSignedIn;
      console.log('Starting parallel sync of all data...', { currentIsSignedIn });
      setShowSyncProgress(true);
      setSyncing(true);

      try {
        await syncCoordinator.syncAll(currentIsSignedIn);
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
  }, [setOnSignInCallback]);

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
      if (window.confirm('Are you sure you want to disconnect from OneDrive?')) {
        signOut();
      }
    } else {
      // If not signed in, sign in
      signIn();
    }
  };

  const handleForceSync = async () => {
    if (!isSignedIn) {
      alert('Please connect to OneDrive first');
      return;
    }

    setSyncing(true);
    setShowDropdown(false);
    setShowSyncProgress(true);

    try {
      console.log('Force syncing all data...');
      // Use force=true to bypass cooldown for manual sync
      await syncCoordinator.syncAll(isSignedIn, true);

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

  const handleToggleDropdown = () => {
    setShowDropdown(!showDropdown);
  };

  return (
    <header className="header">
      <div className="header-container">
        <div className="header-left">
          <h1 className="header-title" onClick={() => { selectCustomer(null); navigate('/'); }} style={{ cursor: 'pointer' }} title="Go to homepage">
            <span className="byd-logo">BYD</span>
            <span className="divider">|</span>
            <span className="motor-east">MOTOR-EAST</span>
          </h1>
        </div>

        <div className="header-actions">
          {/* Sync Status Indicator - shows when there are pending/failed syncs */}
          {isSignedIn && <SyncStatusIndicator />}

          {/* Show account name when signed in */}
          {isSignedIn && currentUserName && (
            <span className="account-name" title={currentUserName}>
              {currentUserName}
            </span>
          )}

          {/* Theme Toggle Button */}
          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDark ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            )}
          </button>

          <button
            className={`auth-button ${isSignedIn ? 'connected' : ''}`}
            onClick={handleAuth}
            title={isSignedIn ? 'Connected to OneDrive - Click to disconnect' : 'Click to connect to OneDrive'}
          >
            <span className="status-dot"></span>
            <span>{isSignedIn ? 'Connected' : 'Connect Drive'}</span>
          </button>

          <div className="mobile-menu">
            <button
              className="mobile-menu-toggle"
              onClick={handleToggleDropdown}
              title="More Options"
              aria-label="Menu"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>

            {/* Backdrop overlay */}
            {showDropdown && (
              <div
                className="mobile-menu-backdrop"
                onClick={() => setShowDropdown(false)}
              ></div>
            )}

            {/* Mobile menu sheet */}
            <div className={`mobile-menu-sheet ${showDropdown ? 'open' : ''}`}>
              <div className="mobile-menu-header">
                <h3>Menu</h3>
                <button
                  className="mobile-menu-close"
                  onClick={() => setShowDropdown(false)}
                  aria-label="Close menu"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>

              <nav className="mobile-menu-content">
                <a
                  className="mobile-menu-item"
                  onClick={() => { navigate('/'); setShowDropdown(false); }}
                >
                  <svg className="menu-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                    <polyline points="9 22 9 12 15 12 15 22"></polyline>
                  </svg>
                  <span>Customer List</span>
                  <svg className="menu-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </a>

                <a
                  className="mobile-menu-item"
                  onClick={() => { navigate('/assistant'); setShowDropdown(false); }}
                >
                  <svg className="menu-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                  <span>Customer Assistant</span>
                  <svg className="menu-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </a>

                <a
                  className="mobile-menu-item"
                  onClick={() => { navigate('/documents'); setShowDropdown(false); }}
                >
                  <svg className="menu-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                  <span>Documents</span>
                  <svg className="menu-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </a>

                <a
                  className="mobile-menu-item"
                  onClick={() => { navigate('/excel'); setShowDropdown(false); }}
                >
                  <svg className="menu-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                    <polyline points="13 2 13 9 20 9"></polyline>
                  </svg>
                  <span>Manage Excel</span>
                  <svg className="menu-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </a>

                <a
                  className="mobile-menu-item"
                  onClick={() => { setShowExportImport(true); setShowDropdown(false); }}
                >
                  <svg className="menu-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  <span>Export/Import Templates</span>
                  <svg className="menu-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </a>

                <a
                  className="mobile-menu-item"
                  onClick={() => { handleForceSync(); setShowDropdown(false); }}
                  style={{ opacity: syncing ? 0.6 : 1 }}
                >
                  <svg className="menu-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="23 4 23 10 17 10"></polyline>
                    <polyline points="1 20 1 14 7 14"></polyline>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                  </svg>
                  <span>{syncing ? 'Syncing...' : 'Force Sync'}</span>
                  <svg className="menu-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </a>

                <a
                  className="mobile-menu-item"
                  onClick={() => { setShowSettings(true); setShowDropdown(false); }}
                >
                  <svg className="menu-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                  </svg>
                  <span>Settings</span>
                  <svg className="menu-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </a>
              </nav>
            </div>
          </div>
        </div>
      </div>

      {/* Sync Progress Modal */}
      <SyncProgressModal isOpen={showSyncProgress} progress={syncProgress} />

      {/* Template Export/Import Modal */}
      <TemplateExportImport
        isOpen={showExportImport}
        onClose={() => setShowExportImport(false)}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </header>
  );
}

export default Header;
