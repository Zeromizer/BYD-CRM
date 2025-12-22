/**
 * DocumentChecklistTab Component
 * Displays required documents for each milestone with status tracking
 * Integrates with AI document classification for auto-routing
 */

import { useState, useMemo } from 'react';
import {
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Upload,
  Eye,
  ChevronDown,
  ChevronRight,
  Sparkles,
  MinusCircle,
  RefreshCw,
} from 'lucide-react';
import { useCustomerActions } from '../../../stores/useCustomerStore';
import {
  REQUIRED_DOCUMENTS,
  DOCUMENT_STATUS,
  getDocumentProgress,
} from '../../../constants/documentRequirements';
import { MILESTONES } from '../../../constants/milestones';

// Status colors and icons
const STATUS_CONFIG = {
  [DOCUMENT_STATUS.PENDING]: {
    color: '#94a3b8',
    bgColor: '#f1f5f9',
    icon: Clock,
    label: 'Pending',
  },
  [DOCUMENT_STATUS.UPLOADED]: {
    color: '#3b82f6',
    bgColor: '#eff6ff',
    icon: Upload,
    label: 'Uploaded',
  },
  [DOCUMENT_STATUS.APPROVED]: {
    color: '#22c55e',
    bgColor: '#f0fdf4',
    icon: CheckCircle,
    label: 'Approved',
  },
  [DOCUMENT_STATUS.REJECTED]: {
    color: '#ef4444',
    bgColor: '#fef2f2',
    icon: XCircle,
    label: 'Rejected',
  },
  [DOCUMENT_STATUS.EXPIRED]: {
    color: '#f97316',
    bgColor: '#fff7ed',
    icon: AlertCircle,
    label: 'Expired',
  },
  [DOCUMENT_STATUS.NOT_APPLICABLE]: {
    color: '#6b7280',
    bgColor: '#f3f4f6',
    icon: MinusCircle,
    label: 'N/A',
  },
};

function DocumentChecklistTab({ customer, onScanDocument, isSignedIn }) {
  const [expandedMilestones, setExpandedMilestones] = useState({});
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [showActionMenu, setShowActionMenu] = useState(null);

  const {
    approveDocument,
    rejectDocument,
    markDocumentNotApplicable,
    saveToLocalStorage,
    saveCustomerToFolder,
  } = useCustomerActions();

  // Initialize with current milestone expanded
  const currentMilestone = customer?.checklist?.currentMilestone || 'test_drive';

  // Toggle milestone expansion
  const toggleMilestone = (milestoneId) => {
    setExpandedMilestones((prev) => ({
      ...prev,
      [milestoneId]: !prev[milestoneId],
    }));
  };

  // Get document checklist state with defaults
  const documentChecklist = useMemo(() => {
    return customer?.documentChecklist || {};
  }, [customer?.documentChecklist]);

  // Handle document actions
  const handleApprove = (milestoneId, documentId) => {
    approveDocument(customer.id, milestoneId, documentId);
    saveToLocalStorage();
    if (isSignedIn) {
      saveCustomerToFolder(customer, isSignedIn);
    }
    setShowActionMenu(null);
  };

  const handleReject = (milestoneId, documentId) => {
    const reason = prompt('Rejection reason (optional):');
    rejectDocument(customer.id, milestoneId, documentId, reason || '');
    saveToLocalStorage();
    if (isSignedIn) {
      saveCustomerToFolder(customer, isSignedIn);
    }
    setShowActionMenu(null);
  };

  const handleMarkNA = (milestoneId, documentId) => {
    markDocumentNotApplicable(customer.id, milestoneId, documentId);
    saveToLocalStorage();
    if (isSignedIn) {
      saveCustomerToFolder(customer, isSignedIn);
    }
    setShowActionMenu(null);
  };

  const handleScanForDocument = (milestoneId, documentId) => {
    if (onScanDocument) {
      onScanDocument({ milestoneId, documentId });
    }
    setShowActionMenu(null);
  };

  // Render document status badge
  const renderStatusBadge = (status) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG[DOCUMENT_STATUS.PENDING];
    const StatusIcon = config.icon;

    return (
      <span
        className="doc-status-badge"
        style={{
          color: config.color,
          backgroundColor: config.bgColor,
        }}
      >
        <StatusIcon size={12} />
        <span>{config.label}</span>
      </span>
    );
  };

  // Render milestone section
  const renderMilestoneSection = (milestone) => {
    const documents = REQUIRED_DOCUMENTS[milestone.id] || [];
    if (documents.length === 0) return null;

    const progress = getDocumentProgress(milestone.id, documentChecklist);
    const isExpanded = expandedMilestones[milestone.id] ?? (milestone.id === currentMilestone);
    const isCurrent = milestone.id === currentMilestone;

    return (
      <div
        key={milestone.id}
        className={`doc-milestone-section ${isCurrent ? 'current' : ''}`}
      >
        {/* Milestone Header */}
        <div
          className="doc-milestone-header"
          onClick={() => toggleMilestone(milestone.id)}
        >
          <div className="doc-milestone-left">
            {isExpanded ? (
              <ChevronDown size={18} />
            ) : (
              <ChevronRight size={18} />
            )}
            <span
              className="doc-milestone-indicator"
              style={{ backgroundColor: milestone.color }}
            />
            <span className="doc-milestone-name">{milestone.name}</span>
            {isCurrent && <span className="doc-current-badge">Current</span>}
          </div>
          <div className="doc-milestone-right">
            <div className="doc-progress-bar">
              <div
                className="doc-progress-fill"
                style={{
                  width: `${progress}%`,
                  backgroundColor: progress === 100 ? '#22c55e' : milestone.color,
                }}
              />
            </div>
            <span className="doc-progress-text">{progress}%</span>
          </div>
        </div>

        {/* Document List */}
        {isExpanded && (
          <div className="doc-list">
            {documents.map((doc) => {
              const docState = documentChecklist[milestone.id]?.[doc.id] || {
                status: DOCUMENT_STATUS.PENDING,
                uploadedFiles: [],
              };
              const menuKey = `${milestone.id}-${doc.id}`;

              return (
                <div
                  key={doc.id}
                  className={`doc-item ${docState.status}`}
                >
                  <div className="doc-item-main">
                    <div className="doc-item-icon">
                      <FileText size={18} />
                    </div>
                    <div className="doc-item-info">
                      <div className="doc-item-header">
                        <span className="doc-item-name">
                          {doc.name}
                          {doc.required && (
                            <span className="doc-required">*</span>
                          )}
                        </span>
                        {renderStatusBadge(docState.status)}
                      </div>
                      <p className="doc-item-description">{doc.description}</p>

                      {/* Uploaded files */}
                      {docState.uploadedFiles && docState.uploadedFiles.length > 0 && (
                        <div className="doc-uploaded-files">
                          {docState.uploadedFiles.map((file, idx) => (
                            <span key={idx} className="doc-file-chip">
                              <FileText size={12} />
                              {file.fileName}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Notes/rejection reason */}
                      {docState.notes && (
                        <p className="doc-item-notes">
                          <AlertCircle size={12} />
                          {docState.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="doc-item-actions">
                    <button
                      className="doc-action-btn scan"
                      onClick={() => handleScanForDocument(milestone.id, doc.id)}
                      title="Scan document"
                    >
                      <Sparkles size={16} />
                    </button>
                    <button
                      className="doc-action-btn menu"
                      onClick={() =>
                        setShowActionMenu(showActionMenu === menuKey ? null : menuKey)
                      }
                      title="More actions"
                    >
                      <ChevronDown size={16} />
                    </button>

                    {/* Action Menu */}
                    {showActionMenu === menuKey && (
                      <div className="doc-action-menu">
                        {docState.status === DOCUMENT_STATUS.UPLOADED && (
                          <>
                            <button
                              onClick={() => handleApprove(milestone.id, doc.id)}
                            >
                              <CheckCircle size={14} />
                              Approve
                            </button>
                            <button
                              onClick={() => handleReject(milestone.id, doc.id)}
                            >
                              <XCircle size={14} />
                              Reject
                            </button>
                          </>
                        )}
                        {docState.status === DOCUMENT_STATUS.REJECTED && (
                          <button
                            onClick={() => handleScanForDocument(milestone.id, doc.id)}
                          >
                            <RefreshCw size={14} />
                            Resubmit
                          </button>
                        )}
                        {!doc.required && docState.status === DOCUMENT_STATUS.PENDING && (
                          <button onClick={() => handleMarkNA(milestone.id, doc.id)}>
                            <MinusCircle size={14} />
                            Mark N/A
                          </button>
                        )}
                        {docState.uploadedFiles?.length > 0 && (
                          <button onClick={() => setSelectedDocument(doc)}>
                            <Eye size={14} />
                            View Files
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="document-checklist-tab">
      <div className="doc-checklist-header">
        <h3>
          <FileText size={20} />
          Document Checklist
        </h3>
        <p className="doc-checklist-subtitle">
          Track required documents for each stage of the customer journey
        </p>
      </div>

      <div className="doc-checklist-content">
        {MILESTONES.map(renderMilestoneSection)}
      </div>

      {/* Document Viewer Modal (placeholder) */}
      {selectedDocument && (
        <div
          className="doc-viewer-overlay"
          onClick={() => setSelectedDocument(null)}
        >
          <div className="doc-viewer-modal" onClick={(e) => e.stopPropagation()}>
            <h4>{selectedDocument.name}</h4>
            <p>Document viewer coming soon...</p>
            <button onClick={() => setSelectedDocument(null)}>Close</button>
          </div>
        </div>
      )}

      <style>{`
        .document-checklist-tab {
          padding: 16px;
          max-width: 800px;
        }

        .doc-checklist-header {
          margin-bottom: 20px;
        }

        .doc-checklist-header h3 {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 18px;
          font-weight: 600;
          margin: 0 0 4px 0;
          color: var(--text-primary);
        }

        .doc-checklist-subtitle {
          color: var(--text-secondary);
          font-size: 14px;
          margin: 0;
        }

        .doc-milestone-section {
          background: var(--bg-card);
          border-radius: 8px;
          margin-bottom: 12px;
          border: 1px solid var(--border-light);
          overflow: hidden;
        }

        .doc-milestone-section.current {
          border-color: var(--color-info);
          box-shadow: 0 0 0 1px var(--color-info);
        }

        .doc-milestone-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          cursor: pointer;
          background: var(--bg-secondary);
          user-select: none;
          color: var(--text-primary);
        }

        .doc-milestone-header:hover {
          background: var(--bg-tertiary);
        }

        .doc-milestone-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .doc-milestone-indicator {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }

        .doc-milestone-name {
          font-weight: 500;
          color: var(--text-primary);
        }

        .doc-current-badge {
          font-size: 11px;
          padding: 2px 6px;
          background: var(--color-info);
          color: white;
          border-radius: 4px;
        }

        .doc-milestone-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .doc-progress-bar {
          width: 80px;
          height: 6px;
          background: var(--bg-tertiary);
          border-radius: 3px;
          overflow: hidden;
        }

        .doc-progress-fill {
          height: 100%;
          transition: width 0.3s ease;
        }

        .doc-progress-text {
          font-size: 12px;
          color: var(--text-tertiary);
          min-width: 36px;
          text-align: right;
        }

        .doc-list {
          padding: 8px;
          background: var(--bg-card);
        }

        .doc-item {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 12px;
          border-radius: 6px;
          margin-bottom: 6px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-light);
        }

        .doc-item:last-child {
          margin-bottom: 0;
        }

        .doc-item.uploaded {
          background: rgba(59, 130, 246, 0.1);
          border-color: rgba(59, 130, 246, 0.3);
        }

        .doc-item.approved {
          background: rgba(34, 197, 94, 0.1);
          border-color: rgba(34, 197, 94, 0.3);
        }

        .doc-item.rejected {
          background: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.3);
        }

        .doc-item-main {
          display: flex;
          gap: 12px;
          flex: 1;
        }

        .doc-item-icon {
          color: var(--text-tertiary);
          padding-top: 2px;
        }

        .doc-item-info {
          flex: 1;
        }

        .doc-item-header {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .doc-item-name {
          font-weight: 500;
          font-size: 14px;
          color: var(--text-primary);
        }

        .doc-required {
          color: var(--color-error);
          margin-left: 2px;
        }

        .doc-status-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 500;
        }

        .doc-item-description {
          color: var(--text-secondary);
          font-size: 12px;
          margin: 4px 0 0 0;
        }

        .doc-uploaded-files {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 8px;
        }

        .doc-file-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          background: var(--bg-card);
          border: 1px solid var(--border-light);
          border-radius: 4px;
          font-size: 11px;
          color: var(--text-secondary);
        }

        .doc-item-notes {
          display: flex;
          align-items: flex-start;
          gap: 4px;
          margin-top: 8px;
          padding: 8px;
          background: rgba(249, 115, 22, 0.1);
          border-radius: 4px;
          font-size: 12px;
          color: #f97316;
        }

        .doc-item-actions {
          display: flex;
          gap: 4px;
          position: relative;
        }

        .doc-action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          background: var(--bg-card);
          color: var(--text-tertiary);
          transition: all 0.2s;
        }

        .doc-action-btn:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }

        .doc-action-btn.scan {
          color: #8b5cf6;
        }

        .doc-action-btn.scan:hover {
          background: rgba(139, 92, 246, 0.1);
          color: #a78bfa;
        }

        .doc-action-menu {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 4px;
          background: var(--bg-card);
          border: 1px solid var(--border-light);
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 10;
          min-width: 140px;
          overflow: hidden;
        }

        .doc-action-menu button {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 10px 12px;
          border: none;
          background: none;
          cursor: pointer;
          font-size: 13px;
          text-align: left;
          color: var(--text-primary);
        }

        .doc-action-menu button:hover {
          background: var(--bg-secondary);
        }

        .doc-viewer-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: var(--overlay-bg);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
        }

        .doc-viewer-modal {
          background: var(--bg-card);
          padding: 24px;
          border-radius: 8px;
          min-width: 300px;
          color: var(--text-primary);
        }

        @media (max-width: 640px) {
          .document-checklist-tab {
            padding: 12px;
          }

          .doc-milestone-header {
            padding: 10px 12px;
          }

          .doc-progress-bar {
            width: 60px;
          }

          .doc-item {
            flex-direction: column;
            gap: 12px;
          }

          .doc-item-actions {
            width: 100%;
            justify-content: flex-end;
          }
        }
      `}</style>
    </div>
  );
}

export default DocumentChecklistTab;
