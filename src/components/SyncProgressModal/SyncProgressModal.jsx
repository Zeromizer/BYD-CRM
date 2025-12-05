import { useState } from 'react';
import './SyncProgressModal.css';

function SyncProgressModal({ isOpen, progress }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  if (!isOpen || isDismissed) return null;

  const { customers, excel, documents, overall } = progress;

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

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  // Check if any syncing is in progress
  const isSyncing = customers.status === 'syncing' || excel.status === 'syncing' || documents.status === 'syncing';

  return (
    <>
      {/* Mobile Compact View */}
      <div className="sync-notification-mobile" onClick={toggleExpand}>
        <div className="sync-mobile-spinner"></div>
        <span className="sync-mobile-text">
          {overall === 100 ? 'Done' : 'Sync'}
        </span>
        <button
          className="sync-mobile-close"
          onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
          title="Dismiss"
        >
          ×
        </button>
      </div>

      {/* Desktop Full View */}
      <div className={`sync-notification ${isExpanded ? 'expanded' : 'minimized'}`}>
        {/* Minimized Header - Always visible */}
        <div className="sync-notification-header" onClick={toggleExpand}>
          <div className="sync-notification-icon">
            {isSyncing ? '🔄' : overall === 100 ? '✅' : '⏳'}
          </div>
          <div className="sync-notification-title">
            <div className="sync-notification-title-text">
              {overall === 100 ? 'Sync Complete' : 'Syncing Data'}
            </div>
            <div className="sync-notification-progress-text">{Math.round(overall)}%</div>
          </div>
          <button
            className="sync-notification-close"
            onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
            title="Dismiss"
          >
            ×
          </button>
        </div>

        {/* Progress Bar - Always visible */}
        <div className="sync-notification-progress-bar">
          <div
            className="sync-notification-progress-fill"
            style={{ width: `${overall}%` }}
          ></div>
        </div>

        {/* Expanded Details - Shown when expanded */}
        {isExpanded && (
          <div className="sync-notification-details">
            <div className="sync-detail-item">
              <div className="sync-detail-icon">{getStatusIcon(customers.status)}</div>
              <div className="sync-detail-content">
                <div className="sync-detail-title">Customer Data</div>
                <div className="sync-detail-subtitle">
                  {getStatusText(customers.status, customers.detail)}
                </div>
              </div>
              {customers.status === 'syncing' && (
                <div className="sync-detail-spinner"></div>
              )}
            </div>

            <div className="sync-detail-item">
              <div className="sync-detail-icon">{getStatusIcon(excel.status)}</div>
              <div className="sync-detail-content">
                <div className="sync-detail-title">Excel Templates</div>
                <div className="sync-detail-subtitle">
                  {getStatusText(excel.status, excel.detail)}
                </div>
              </div>
              {excel.status === 'syncing' && (
                <div className="sync-detail-spinner"></div>
              )}
            </div>

            <div className="sync-detail-item">
              <div className="sync-detail-icon">{getStatusIcon(documents.status)}</div>
              <div className="sync-detail-content">
                <div className="sync-detail-title">Document Templates</div>
                <div className="sync-detail-subtitle">
                  {getStatusText(documents.status, documents.detail)}
                </div>
              </div>
              {documents.status === 'syncing' && (
                <div className="sync-detail-spinner"></div>
              )}
            </div>

            {overall === 100 && (
              <div className="sync-notification-footer">
                <p className="sync-complete-message">✨ All data synced successfully!</p>
              </div>
            )}
          </div>
        )}

        {/* Expand/Collapse indicator */}
        <div className="sync-notification-expand-hint" onClick={toggleExpand}>
          {isExpanded ? '▼ Click to minimize' : '▲ Click for details'}
        </div>
      </div>
    </>
  );
}

export default SyncProgressModal;
