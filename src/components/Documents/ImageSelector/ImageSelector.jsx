import { useState, useEffect } from 'react';
import { getStorageService } from '../../../services/storageServiceSelector';
import documentRenderer from '../../../services/documentRenderer';
import './ImageSelector.css';

/**
 * ImageSelector - Select images from customer's Google Drive folder
 *
 * Used for selecting up to 4 images for the back page of double-sided forms
 */
function ImageSelector({ customerFolderId, selectedImages = [], onSelectionChange, maxImages = 4 }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewUrls, setPreviewUrls] = useState({});

  useEffect(() => {
    if (customerFolderId) {
      loadImagesFromFolder();
    }
  }, [customerFolderId]);

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

  const loadImagePreview = async (fileId) => {
    if (previewUrls[fileId]) return; // Already loaded

    try {
      const blob = await documentRenderer.fetchImageFromDrive(fileId);
      const url = URL.createObjectURL(blob);
      setPreviewUrls(prev => ({ ...prev, [fileId]: url }));
    } catch (err) {
      console.error('Error loading image preview:', err);
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
        <p className="hint">Upload images to the customer's Google Drive folder first</p>
      </div>
    );
  }

  return (
    <div className="image-selector">
      <div className="image-selector-header">
        <h4>Select Images for Back Page ({selectedImages.length}/{maxImages})</h4>
        {selectedImages.length > 0 && (
          <button
            className="btn btn-small btn-secondary"
            onClick={() => onSelectionChange([])}
          >
            Clear All
          </button>
        )}
      </div>

      <div className="image-grid">
        {images.map(image => {
          const isSelected = selectedImages.some(img => img.id === image.id);
          const selectionIndex = getSelectionIndex(image.id);

          return (
            <div
              key={image.id}
              className={`image-card ${isSelected ? 'selected' : ''}`}
              onClick={() => handleImageClick(image)}
              onMouseEnter={() => loadImagePreview(image.id)}
            >
              {previewUrls[image.id] ? (
                <img
                  src={previewUrls[image.id]}
                  alt={image.name}
                  className="image-thumbnail"
                />
              ) : (
                <div className="image-placeholder">
                  <span>📷</span>
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
