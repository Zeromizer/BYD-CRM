import { useState, useEffect } from 'react';
import Modal from '../Modal/Modal';
import './DocumentViewer.css';

function DocumentViewer({ isOpen, onClose, document }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setError(null);
    }
  }, [isOpen, document]);

  if (!document) return null;

  const handleIframeLoad = () => {
    setLoading(false);
  };

  const handleIframeError = () => {
    setLoading(false);
    setError('Unable to load document preview');
  };

  const getPreviewUrl = () => {
    if (!document.id) return null;

    // For Google Drive files, use the embed preview URL
    // This works for most file types including PDFs, images, Google Docs, Sheets, etc.
    return `https://drive.google.com/file/d/${document.id}/preview`;
  };

  const handleDownload = () => {
    if (document.webViewLink) {
      window.open(document.webViewLink, '_blank');
    }
  };

  const handleOpenInDrive = () => {
    if (document.webViewLink) {
      window.open(document.webViewLink, '_blank');
    }
  };

  const previewUrl = getPreviewUrl();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={document.name || 'Document'} size="large">
      <div className="document-viewer">
        <div className="document-viewer-actions">
          <button className="btn btn-secondary btn-small" onClick={handleOpenInDrive}>
            Open in Drive
          </button>
          <button className="btn btn-action btn-small" onClick={handleDownload}>
            View Full Document
          </button>
        </div>

        <div className="document-viewer-content">
          {loading && (
            <div className="viewer-loading">
              <div className="loading"></div>
              <p>Loading preview...</p>
            </div>
          )}

          {error && (
            <div className="viewer-error">
              <p>{error}</p>
              <button className="btn btn-primary" onClick={handleOpenInDrive}>
                Open in Google Drive
              </button>
            </div>
          )}

          {previewUrl && (
            <iframe
              src={previewUrl}
              className="document-viewer-frame"
              title={document.name}
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              allow="autoplay"
            />
          )}
        </div>
      </div>
    </Modal>
  );
}

export default DocumentViewer;
