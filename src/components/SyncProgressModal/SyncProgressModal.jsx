import './SyncProgressModal.css';

function SyncProgressModal({ isOpen, progress }) {
  if (!isOpen) return null;

  const { customers, forms, excel, overall } = progress;

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'syncing': return '🔄';
      case 'complete': return '✅';
      case 'error': return '❌';
      default: return '⏳';
    }
  };

  const getStatusText = (status, detail) => {
    switch (status) {
      case 'pending': return 'Waiting...';
      case 'syncing': return detail || 'Syncing...';
      case 'complete': return detail || 'Complete';
      case 'error': return detail || 'Error';
      default: return 'Waiting...';
    }
  };

  return (
    <div className="sync-modal-overlay">
      <div className="sync-modal">
        <div className="sync-modal-header">
          <h3>Syncing with Google Drive</h3>
          <div className="sync-overall-progress">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${overall}%` }}
              ></div>
            </div>
            <div className="progress-text">{Math.round(overall)}%</div>
          </div>
        </div>

        <div className="sync-modal-content">
          <div className="sync-item">
            <div className="sync-item-icon">{getStatusIcon(customers.status)}</div>
            <div className="sync-item-details">
              <div className="sync-item-title">Customer Data</div>
              <div className="sync-item-subtitle">
                {getStatusText(customers.status, customers.detail)}
              </div>
            </div>
            {customers.status === 'syncing' && (
              <div className="sync-spinner"></div>
            )}
          </div>

          <div className="sync-item">
            <div className="sync-item-icon">{getStatusIcon(forms.status)}</div>
            <div className="sync-item-details">
              <div className="sync-item-title">Form Templates</div>
              <div className="sync-item-subtitle">
                {getStatusText(forms.status, forms.detail)}
              </div>
            </div>
            {forms.status === 'syncing' && (
              <div className="sync-spinner"></div>
            )}
          </div>

          <div className="sync-item">
            <div className="sync-item-icon">{getStatusIcon(excel.status)}</div>
            <div className="sync-item-details">
              <div className="sync-item-title">Excel Templates</div>
              <div className="sync-item-subtitle">
                {getStatusText(excel.status, excel.detail)}
              </div>
            </div>
            {excel.status === 'syncing' && (
              <div className="sync-spinner"></div>
            )}
          </div>
        </div>

        {overall === 100 && (
          <div className="sync-modal-footer">
            <p className="sync-complete-message">✨ All data synced successfully!</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default SyncProgressModal;
