import { useState } from 'react';
import useAuthStore from '../../stores/useAuthStore';
import './Header.css';

function Header() {
  const { isSignedIn } = useAuthStore();
  const [showDropdown, setShowDropdown] = useState(false);

  const handleAuth = () => {
    // TODO: Implement authentication
    console.log('Authentication clicked');
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
            title="Google Drive Connection"
          >
            <span className="status-dot"></span>
            <span>{isSignedIn ? 'Google Drive' : 'Connect Drive'}</span>
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
                  href="/"
                  target="_blank"
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
