import { useState, useEffect } from 'react';
import useExcelStore from '../../stores/useExcelStore';
import syncQueueService, { SYNC_STATUS } from '../../services/syncQueueService';
import './SyncStatusIndicator.css';

function SyncStatusIndicator() {
  const excelSyncStatus = useExcelStore((state) => state.syncStatus);
  const excelSyncError = useExcelStore((state) => state.syncError);

  const [showTooltip, setShowTooltip] = useState(false);
  const [overallStatus, setOverallStatus] = useState(SYNC_STATUS.SYNCED);

  // Calculate overall status
  useEffect(() => {
    const statuses = [excelSyncStatus];

    if (statuses.includes(SYNC_STATUS.FAILED)) {
      setOverallStatus(SYNC_STATUS.FAILED);
    } else if (statuses.includes(SYNC_STATUS.SYNCING)) {
      setOverallStatus(SYNC_STATUS.SYNCING);
    } else if (statuses.includes(SYNC_STATUS.PENDING)) {
      setOverallStatus(SYNC_STATUS.PENDING);
    } else if (statuses.includes(SYNC_STATUS.OFFLINE)) {
      setOverallStatus(SYNC_STATUS.OFFLINE);
    } else {
      setOverallStatus(SYNC_STATUS.SYNCED);
    }
  }, [excelSyncStatus]);

  // Handle retry
  const handleRetry = async () => {
    setShowTooltip(false);

    if (excelSyncStatus === SYNC_STATUS.FAILED) {
      await useExcelStore.getState().retrySyncToDrive();
    }
  };

  // Get icon and styling based on status
  const getStatusIcon = () => {
    switch (overallStatus) {
      case SYNC_STATUS.SYNCED:
        return (
          <svg className="sync-icon synced" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        );
      case SYNC_STATUS.SYNCING:
        return (
          <svg className="sync-icon syncing" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
        );
      case SYNC_STATUS.PENDING:
        return (
          <svg className="sync-icon pending" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        );
      case SYNC_STATUS.OFFLINE:
        return (
          <svg className="sync-icon offline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="1" y1="1" x2="23" y2="23"></line>
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
            <path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path>
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path>
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
            <line x1="12" y1="20" x2="12.01" y2="20"></line>
          </svg>
        );
      case SYNC_STATUS.FAILED:
        return (
          <svg className="sync-icon failed" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        );
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (overallStatus) {
      case SYNC_STATUS.SYNCED:
        return 'All changes synced';
      case SYNC_STATUS.SYNCING:
        return 'Syncing...';
      case SYNC_STATUS.PENDING:
        return 'Changes pending';
      case SYNC_STATUS.OFFLINE:
        return 'Offline - will sync when connected';
      case SYNC_STATUS.FAILED:
        return 'Sync failed - click to retry';
      default:
        return '';
    }
  };

  // Don't show if everything is synced and user hasn't interacted
  if (overallStatus === SYNC_STATUS.SYNCED && !showTooltip) {
    return null;
  }

  return (
    <div className="sync-status-indicator">
      <button
        className={`sync-status-button ${overallStatus}`}
        onClick={() => {
          if (overallStatus === SYNC_STATUS.FAILED) {
            handleRetry();
          } else {
            setShowTooltip(!showTooltip);
          }
        }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        title={getStatusText()}
      >
        {getStatusIcon()}
      </button>

      {showTooltip && (
        <div className="sync-status-tooltip">
          <div className="tooltip-header">{getStatusText()}</div>
          <div className="tooltip-details">
            <div className={`detail-row ${excelSyncStatus}`}>
              <span className="detail-label">Excel:</span>
              <span className="detail-status">{excelSyncStatus}</span>
              {excelSyncError && <span className="detail-error">{excelSyncError}</span>}
            </div>
          </div>
          {overallStatus === SYNC_STATUS.FAILED && (
            <button className="retry-button" onClick={handleRetry}>
              Retry Now
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default SyncStatusIndicator;
