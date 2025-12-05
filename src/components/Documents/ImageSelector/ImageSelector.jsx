import { useState, useEffect, useRef } from 'react';
import { getStorageService } from '../../../services/storageServiceSelector';
import './ImageSelector.css';

/**
 * ImageSelector - Select images from customer's OneDrive folder
 *
 * Used for selecting up to 4 images for the back page of double-sided forms
 *
 * OPTIMIZED: Uses Microsoft Graph thumbnails API for fast loading
 */
function ImageSelector({ customerFolderId, selectedImages = [], onSelectionChange, maxImages = 4 }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [thumbnailUrls, setThumbnailUrls] = useState({});
  const [loadingThumbnails, setLoadingThumbnails] = useState(false);
  const thumbnailCacheRef = useRef(new Map());

  useEffect(() => {
    if (customerFolderId) {
      loadImagesFromFolder();
    }
  }, [customerFolderId]);

  // OPTIMIZED: Preload all thumbnails in parallel when images are loaded
  useEffect(() => {
    if (images.length > 0) {
      preloadAllThumbnails(images);
    }
  }, [images]);

  const loadImagesFromFolder = async () => {
    setLoading(true);
    setError(null);

    try {
      // Recursively list all images from customer folder and all subfolders
      const imageFiles = await getStorageService().listAllImagesRecursively(customerFolderId);

      console.log(`Found ${imageFiles.length} images in customer folder (including subfolders)`);
      setImages(imageFiles);
    } catch (err) {
      console.error('Error loading images from folder:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // OPTIMIZED: Preload all thumbnails in parallel using Microsoft Graph API
  const preloadAllThumbnails = async (imageList) => {
    setLoadingThumbnails(true);

    // Filter out images that are already cached
    const uncachedImages = imageList.filter(img => !thumbnailCacheRef.current.has(img.id));

    if (uncachedImages.length === 0) {
      // All thumbnails already cached, use them
      const cached = {};
      imageList.forEach(img => {
        if (thumbnailCacheRef.current.has(img.id)) {
          cached[img.id] = thumbnailCacheRef.current.get(img.id);
        }
      });
      setThumbnailUrls(cached);
      setLoadingThumbnails(false);
      return;
    }

    // Load thumbnails in batches of 10 to avoid overwhelming the API
    const BATCH_SIZE = 10;
    const newThumbnails = {};

    for (let i = 0; i < uncachedImages.length; i += BATCH_SIZE) {
      const batch = uncachedImages.slice(i, i + BATCH_SIZE);

      // Fetch all thumbnails in this batch in parallel
      const results = await Promise.allSettled(
        batch.map(async (image) => {
          try {
            const url = await getStorageService().getThumbnailUrl(image.id, 'medium');
            return { id: image.id, url };
          } catch (err) {
            console.warn(`Failed to load thumbnail for ${image.name}:`, err);
            return { id: image.id, url: null };
          }
        })
      );

      // Process results
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value.url) {
          newThumbnails[result.value.id] = result.value.url;
          thumbnailCacheRef.current.set(result.value.id, result.value.url);
        }
      });

      // Update state progressively so users see thumbnails loading
      setThumbnailUrls(prev => ({ ...prev, ...newThumbnails }));
    }

    setLoadingThumbnails(false);
  };

  const handleImageClick = (image) => {
    const isSelected = selectedImages.some(img => img.id === image.id);

    if (isSelected) {
      // Deselect
      const newSelection = selectedImages.filter(img => img.id !== image.id);
      onSelectionChange(newSelection);
    } else {
      // Select (if under max limit)
      if (selectedImages.length < maxImages) {
        onSelectionChange([...selectedImages, image]);
      } else {
        alert(`Maximum ${maxImages} images allowed`);
      }
    }
  };

  const getSelectionIndex = (imageId) => {
    return selectedImages.findIndex(img => img.id === imageId) + 1;
  };

  if (loading) {
    return <div className="image-selector-loading">Loading images from folder...</div>;
  }

  if (error) {
    return <div className="image-selector-error">Error: {error}</div>;
  }

  if (images.length === 0) {
    return (
      <div className="image-selector-empty">
        <p>No images found in customer folder</p>
        <p className="hint">Upload images to the customer's OneDrive folder first</p>
      </div>
    );
  }

  return (
    <div className="image-selector">
      <div className="image-selector-header">
        <h4>Select Images for Back Page ({selectedImages.length}/{maxImages})</h4>
        <div className="header-actions">
          {loadingThumbnails && (
            <span className="thumbnail-loading-indicator">Loading thumbnails...</span>
          )}
          {selectedImages.length > 0 && (
            <button
              className="btn btn-small btn-secondary"
              onClick={() => onSelectionChange([])}
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      <div className="image-grid">
        {images.map(image => {
          const isSelected = selectedImages.some(img => img.id === image.id);
          const selectionIndex = getSelectionIndex(image.id);
          const thumbnailUrl = thumbnailUrls[image.id];

          return (
            <div
              key={image.id}
              className={`image-card ${isSelected ? 'selected' : ''}`}
              onClick={() => handleImageClick(image)}
            >
              {thumbnailUrl ? (
                <img
                  src={thumbnailUrl}
                  alt={image.name}
                  className="image-thumbnail"
                  loading="lazy"
                />
              ) : (
                <div className="image-placeholder">
                  {loadingThumbnails ? (
                    <span className="loading-spinner-small"></span>
                  ) : (
                    <span>📷</span>
                  )}
                  <span className="image-name">{image.name}</span>
                </div>
              )}

              {isSelected && (
                <div className="selection-badge">
                  {selectionIndex}
                </div>
              )}

              <div className="image-info">
                <span className="image-name" title={image.name}>
                  {image.name.length > 20 ? image.name.substring(0, 20) + '...' : image.name}
                </span>
                {image.folderPath && image.folderPath !== 'Root' && (
                  <span className="image-location" title={image.folderPath}>
                    📁 {image.folderPath}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedImages.length > 0 && (
        <div className="selected-images-preview">
          <h5>Selected Images (in order):</h5>
          <div className="selected-images-list">
            {selectedImages.map((image, index) => (
              <div key={image.id} className="selected-image-item">
                <span className="position-label">Slot {index + 1}:</span>
                <span className="image-name">{image.name}</span>
                <button
                  className="btn-icon btn-remove"
                  onClick={() => {
                    const newSelection = selectedImages.filter(img => img.id !== image.id);
                    onSelectionChange(newSelection);
                  }}
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ImageSelector;
