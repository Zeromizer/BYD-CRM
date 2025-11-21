import { useState, useEffect } from 'react';
import Modal from '../Modal/Modal';
import './DocumentViewer.css';

function DocumentViewer({ isOpen, onClose, document }) {
  const [loading, setLoading] = useState(true);
  const [imageUrl, setImageUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && document) {
      setLoading(true);
      setError(null);
      setImageUrl(null);

      // Try to load image files directly
      if (isImageFile(document.mimeType)) {
        loadImageFile();
      } else {
        setLoading(false);
      }
    }
  }, [isOpen, document]);

  if (!document) return null;

  const isImageFile = (mimeType) => {
    return mimeType?.startsWith('image/');
  };

  const isPdfFile = (mimeType) => {
    return mimeType === 'application/pdf';
  };

  const isGoogleDoc = (mimeType) => {
    return mimeType?.startsWith('application/vnd.google-apps.');
  };

  const loadImageFile = async () => {
    try {
      // Get the access token
      const token = window.gapi.auth.getToken();
      if (!token) {
        throw new Error('No access token available');
      }

      // Fetch the file using the Drive API download URL
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${document.id}?alt=media`,
        {
          headers: {
            Authorization: `Bearer ${token.access_token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status}`);
      }

      // Convert response to blob
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setImageUrl(url);
      setLoading(false);
    } catch (err) {
      console.error('Error loading image:', err);
      setError('Unable to load image preview');
      setLoading(false);
    }
  };

  const handleOpenInDrive = () => {
    if (document.webViewLink) {
      window.open(document.webViewLink, '_blank');
    }
  };

  const getFileTypeLabel = () => {
    if (isImageFile(document.mimeType)) return 'Image';
    if (isPdfFile(document.mimeType)) return 'PDF';
    if (isGoogleDoc(document.mimeType)) return 'Google Document';
    if (document.mimeType?.includes('spreadsheet')) return 'Spreadsheet';
    if (document.mimeType?.includes('excel')) return 'Excel File';
    return 'Document';
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={document.name || 'Document'} size="large">
      <div className="document-viewer">
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

          {!loading && !error && (
            <>
              {imageUrl ? (
                <div className="viewer-image-container">
                  <img src={imageUrl} alt={document.name} className="viewer-image" />
                </div>
              ) : (
                <div className="viewer-fallback">
                  <div className="fallback-icon">
                    {isImageFile(document.mimeType) && '🖼️'}
                    {isPdfFile(document.mimeType) && '📄'}
                    {isGoogleDoc(document.mimeType) && '📝'}
                    {!isImageFile(document.mimeType) && !isPdfFile(document.mimeType) && !isGoogleDoc(document.mimeType) && '📎'}
                  </div>
                  <h3>{document.name}</h3>
                  <p className="file-type-label">{getFileTypeLabel()}</p>
                  <p className="fallback-message">
                    Preview not available for this file type. Click below to view in Google Drive.
                  </p>
                  <button className="btn btn-primary" onClick={handleOpenInDrive}>
                    Open in Google Drive
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default DocumentViewer;
