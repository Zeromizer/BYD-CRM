import { useState, useEffect } from 'react';
import useAuthStore from '../../stores/useAuthStore';
import './Header.css';

function Header() {
  const { isSignedIn, initialize, signIn, signOut } = useAuthStore();
  const [showDropdown, setShowDropdown] = useState(false);

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

  return (
    <header className="header">
      <div className="header-container">
        <div className="header-left">
          <h1 className="header-title">
            BYD MotorEast CRM
            <span className="version-badge">React</span>
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
                <a className="dropdown-item" onClick={() => console.log('Statistics')}>
                  View Statistics
                </a>
                <a className="dropdown-item" onClick={() => console.log('Forms')}>
                  Manage Forms
                </a>
                <a className="dropdown-item" onClick={() => console.log('Excel')}>
                  Manage Excel
                </a>
                <a className="dropdown-item" onClick={() => console.log('Force Sync')}>
                  Force Sync
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
    </header>
  );
}

export default Header;
