import { useState, useEffect, memo } from 'react';
import Modal from '../Modal/Modal';
import oneDriveService from '../../services/oneDriveService';
import './DocumentViewer.css';

const DocumentViewer = memo(function DocumentViewer({ isOpen, onClose, document }) {
  const [loading, setLoading] = useState(true);
  const [imageUrl, setImageUrl] = useState(null);
  const [embedUrl, setEmbedUrl] = useState(null);
  const [error, setError] = useState(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  // Check file type helpers
  const isImageFile = (mimeType) => mimeType?.startsWith('image/');
  const isPdfFile = (mimeType) => mimeType === 'application/pdf';
  const isSpreadsheet = (mimeType) =>
    mimeType?.includes('spreadsheet') ||
    mimeType?.includes('excel') ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.ms-excel';
  const isWordDoc = (mimeType) =>
    mimeType?.includes('word') ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword';
  const isPowerPoint = (mimeType) =>
    mimeType?.includes('presentation') ||
    mimeType?.includes('powerpoint') ||
    mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

  // Check if file can be previewed with embed
  const canEmbedPreview = (mimeType) => {
    return isPdfFile(mimeType) ||
           isSpreadsheet(mimeType) ||
           isWordDoc(mimeType) ||
           isPowerPoint(mimeType);
  };

  useEffect(() => {
    if (isOpen && document) {
      setLoading(true);
      setError(null);
      setImageUrl(null);
      setEmbedUrl(null);
      setIframeLoaded(false);

      // Try to load image files directly
      if (isImageFile(document.mimeType)) {
        loadImageFile();
      } else if (canEmbedPreview(document.mimeType)) {
        // For embeddable files, we'll use iframe - set loading false when iframe loads
        loadEmbedUrl();
      } else {
        setLoading(false);
      }
    }
  }, [isOpen, document]);

  if (!document) return null;

  // Load embed URL for OneDrive
  const loadEmbedUrl = async () => {
    try {
      const url = await oneDriveService.getPreviewUrl(document.id);
      if (url) {
        setEmbedUrl(url);
      } else {
        // Preview not available, show fallback
        setLoading(false);
      }
    } catch (err) {
      console.error('Failed to get OneDrive preview URL:', err);
      setEmbedUrl(null);
      setLoading(false);
    }
  };

  const loadImageFile = async () => {
    try {
      const blob = await oneDriveService.downloadFileAsBlob(document.id);
      const url = URL.createObjectURL(blob);
      setImageUrl(url);
      setLoading(false);
    } catch (err) {
      setError('Unable to load image preview');
      setLoading(false);
    }
  };

  const handleOpenInDrive = () => {
    if (document.webViewLink) {
      window.open(document.webViewLink, '_blank');
    }
  };

  const handleIframeLoad = () => {
    setIframeLoaded(true);
    setLoading(false);
  };

  const getFileTypeLabel = () => {
    if (isImageFile(document.mimeType)) return 'Image';
    if (isPdfFile(document.mimeType)) return 'PDF';
    if (isSpreadsheet(document.mimeType)) return 'Spreadsheet';
    if (isWordDoc(document.mimeType)) return 'Word Document';
    if (isPowerPoint(document.mimeType)) return 'Presentation';
    return 'Document';
  };

  const getFileIcon = () => {
    if (isImageFile(document.mimeType)) return '🖼️';
    if (isPdfFile(document.mimeType)) return '📄';
    if (isSpreadsheet(document.mimeType)) return '📊';
    if (isWordDoc(document.mimeType)) return '📝';
    if (isPowerPoint(document.mimeType)) return '📽️';
    return '📎';
  };

  const showEmbedPreview = canEmbedPreview(document.mimeType);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={document.name || 'Document'} size="large">
      <div className="document-viewer">
        <div className="document-viewer-content">
          {/* Loading State */}
          {loading && (
            <div className="viewer-loading">
              <div className="loading"></div>
              <p>Loading preview...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="viewer-error">
              <p>{error}</p>
              <button className="btn btn-primary" onClick={handleOpenInDrive}>
                Open in OneDrive
              </button>
            </div>
          )}

          {/* Image Preview */}
          {!error && imageUrl && (
            <div className="viewer-image-container">
              <img src={imageUrl} alt={document.name} className="viewer-image" />
            </div>
          )}

          {/* Embed Preview (PDF, Excel, Word, etc.) */}
          {!error && showEmbedPreview && embedUrl && (
            <iframe
              src={embedUrl}
              className="document-viewer-frame"
              onLoad={handleIframeLoad}
              title={document.name}
              allow="autoplay"
              style={{ display: iframeLoaded ? 'block' : 'none' }}
            />
          )}

          {/* Fallback for unsupported types */}
          {!loading && !error && !imageUrl && !showEmbedPreview && (
            <div className="viewer-fallback">
              <div className="fallback-icon">{getFileIcon()}</div>
              <h3>{document.name}</h3>
              <p className="file-type-label">{getFileTypeLabel()}</p>
              <p className="fallback-message">
                Preview not available for this file type. Click below to view in OneDrive.
              </p>
              <button className="btn btn-primary" onClick={handleOpenInDrive}>
                Open in OneDrive
              </button>
            </div>
          )}
        </div>

        {/* Action Bar - Show "Open in Drive" for all previewable files */}
        {!error && (imageUrl || (showEmbedPreview && iframeLoaded)) && (
          <div className="document-viewer-actions">
            <button className="btn btn-secondary" onClick={handleOpenInDrive}>
              <span className="btn-icon">↗️</span>
              Open in OneDrive
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
});

export default DocumentViewer;
