import { useState, useEffect, memo, useRef, useCallback } from 'react';
import Modal from '../Modal/Modal';
import oneDriveService from '../../services/oneDriveService';
import './DocumentViewer.css';

// Cache for preview URLs to avoid repeated API calls
const previewUrlCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const DocumentViewer = memo(function DocumentViewer({ isOpen, onClose, document }) {
  const [loading, setLoading] = useState(true);
  const [imageUrl, setImageUrl] = useState(null);
  const [embedUrl, setEmbedUrl] = useState(null);
  const [editUrl, setEditUrl] = useState(null);
  const [error, setError] = useState(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });

  // Cleanup blob URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (imageUrl && imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl]);

  const MIN_ZOOM = 25;
  const MAX_ZOOM = 300;
  const ZOOM_STEP = 25;

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

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + ZOOM_STEP, MAX_ZOOM));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - ZOOM_STEP, MIN_ZOOM));
  };

  const handleZoomReset = () => {
    setZoomLevel(100);
    setPanPosition({ x: 0, y: 0 });
  };

  // Drag/pan handlers
  const handleMouseDown = (e) => {
    if (zoomLevel <= 100) return; // Only allow dragging when zoomed in
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { x: panPosition.x, y: panPosition.y };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    setPanPosition({
      x: panStartRef.current.x + deltaX,
      y: panStartRef.current.y + deltaY,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers for mobile
  const handleTouchStart = (e) => {
    if (zoomLevel <= 100 || e.touches.length !== 1) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    panStartRef.current = { x: panPosition.x, y: panPosition.y };
  };

  const handleTouchMove = (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    const deltaX = e.touches[0].clientX - dragStartRef.current.x;
    const deltaY = e.touches[0].clientY - dragStartRef.current.y;
    setPanPosition({
      x: panStartRef.current.x + deltaX,
      y: panStartRef.current.y + deltaY,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isOpen && document) {
      setLoading(true);
      setError(null);
      setImageUrl(null);
      setEmbedUrl(null);
      setEditUrl(null);
      setIframeLoaded(false);
      setZoomLevel(100);
      setPanPosition({ x: 0, y: 0 });
      setIsDragging(false);

      // Try to load image files directly
      if (isImageFile(document.mimeType)) {
        loadImageFile();
      } else if (canEmbedPreview(document.mimeType)) {
        // For embeddable files, we'll use iframe - set loading false when iframe loads
        loadEmbedUrl();
        // For Excel files, also load the edit URL
        if (isSpreadsheet(document.mimeType)) {
          loadEditUrl();
        }
      } else {
        setLoading(false);
      }
    }
  }, [isOpen, document]);

  if (!document) return null;

  // Load embed URL for OneDrive (with caching)
  const loadEmbedUrl = async () => {
    try {
      // Check cache first
      const cacheKey = `preview_${document.id}`;
      const cached = previewUrlCache.get(cacheKey);
      if (cached && Date.now() - cached.time < CACHE_TTL) {
        setEmbedUrl(cached.url);
        return;
      }

      const url = await oneDriveService.getPreviewUrl(document.id);
      if (url) {
        // Cache the URL
        previewUrlCache.set(cacheKey, { url, time: Date.now() });
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

  // Load edit URL for Excel files (opens directly in Excel Online)
  const loadEditUrl = async () => {
    try {
      const url = await oneDriveService.getEditUrl(document.id);
      if (url) {
        setEditUrl(url);
      }
    } catch (err) {
      console.error('Failed to get edit URL:', err);
      // Don't show error - edit button just won't appear
    }
  };

  const handleOpenInExcel = () => {
    if (editUrl) {
      window.open(editUrl, '_blank');
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
              <div className="zoom-controls">
                <button
                  className="zoom-btn"
                  onClick={handleZoomOut}
                  disabled={zoomLevel <= MIN_ZOOM}
                  title="Zoom out"
                >
                  −
                </button>
                <button className="zoom-level" onClick={handleZoomReset} title="Reset zoom">
                  {zoomLevel}%
                </button>
                <button
                  className="zoom-btn"
                  onClick={handleZoomIn}
                  disabled={zoomLevel >= MAX_ZOOM}
                  title="Zoom in"
                >
                  +
                </button>
              </div>
              <div
                className={`viewer-image-wrapper ${zoomLevel > 100 ? 'zoomable' : ''} ${isDragging ? 'dragging' : ''}`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <img
                  src={imageUrl}
                  alt={document.name}
                  className="viewer-image"
                  style={{
                    transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoomLevel / 100})`,
                  }}
                  draggable={false}
                />
              </div>
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

        {/* Action Bar - Show action buttons for all previewable files */}
        {!error && (imageUrl || (showEmbedPreview && iframeLoaded)) && (
          <div className="document-viewer-actions">
            {/* Edit in Excel Online button - only for spreadsheets */}
            {isSpreadsheet(document.mimeType) && editUrl && (
              <button className="btn btn-primary" onClick={handleOpenInExcel}>
                <span className="btn-icon">📝</span>
                Edit in Excel Online
              </button>
            )}
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
