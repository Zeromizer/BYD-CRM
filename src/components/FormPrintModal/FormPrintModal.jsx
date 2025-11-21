import { useState, useEffect } from 'react';
import useFormsStore from '../../stores/useFormsStore';
import useAuthStore from '../../stores/useAuthStore';
import authService from '../../services/authService';
import Modal from '../Modal/Modal';
import './FormPrintModal.css';

const FORM_TYPE_NAMES = {
  test_drive: 'Test Drive Agreement',
  vsa: 'Vehicle Sales Agreement',
  pdpa: 'PDPA Consent Form',
  coe_bidding_1: 'COE Bidding 1',
  coe_bidding_2: 'COE Bidding 2',
  pdpa_consent_1: 'PDPA Consent 1',
  pdpa_consent_2: 'PDPA Consent 2',
  delivery_checklist_1: 'Delivery Checklist Form (1 of 2)',
  delivery_checklist_2: 'Delivery Checklist Form (2 of 2)',
  other: 'Other Form',
};

function FormPrintModal({ isOpen, onClose, customer }) {
  const { formTemplates, loadFromLocalStorage } = useFormsStore();
  const { isSignedIn } = useAuthStore();

  const [selectedFormType, setSelectedFormType] = useState('');
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [showPreview, setShowPreview] = useState(false);

  // Test drive form back images
  const [selectedBackImages, setSelectedBackImages] = useState([null, null, null, null]);
  const [availableImages, setAvailableImages] = useState([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [backImageUrls, setBackImageUrls] = useState([null, null, null, null]);

  useEffect(() => {
    if (isOpen) {
      loadFromLocalStorage();
      setSelectedFormType('');
      setImageUrl(null);
      setShowPreview(false);
      setImageDimensions({ width: 0, height: 0 });
      setSelectedBackImages([null, null, null, null]);
      setBackImageUrls([null, null, null, null]);
      setAvailableImages([]);
    }
  }, [isOpen, loadFromLocalStorage]);

  // Load customer images when test drive form is selected
  useEffect(() => {
    if (selectedFormType === 'test_drive' && customer?.driveFolderId && isSignedIn) {
      loadCustomerImages();
    }
  }, [selectedFormType, customer, isSignedIn]);

  const loadCustomerImages = async () => {
    if (!customer?.driveFolderId) return;

    setLoadingImages(true);
    try {
      // Fetch all files from customer's folder recursively
      const allFiles = await getAllFilesInFolder(customer.driveFolderId);

      // Filter only image files
      const imageFiles = allFiles.filter(file =>
        file.mimeType.startsWith('image/') &&
        !file.mimeType.includes('google-apps')
      );

      setAvailableImages(imageFiles);
    } catch (error) {
      console.error('Error loading customer images:', error);
    } finally {
      setLoadingImages(false);
    }
  };

  const getAllFilesInFolder = async (folderId) => {
    let allFiles = [];

    try {
      // Get files in current folder
      let pageToken = null;
      do {
        const response = await window.gapi.client.drive.files.list({
          q: `'${folderId}' in parents and trashed=false`,
          fields: 'nextPageToken, files(id, name, mimeType, size, webViewLink)',
          pageSize: 1000,
          pageToken: pageToken,
        });

        const files = response.result.files || [];

        // Add non-folder files
        const nonFolderFiles = files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
        allFiles = allFiles.concat(nonFolderFiles);

        // Recursively get files from subfolders
        const folders = files.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
        for (const folder of folders) {
          const subFiles = await getAllFilesInFolder(folder.id);
          allFiles = allFiles.concat(subFiles);
        }

        pageToken = response.result.nextPageToken;
      } while (pageToken);
    } catch (error) {
      console.error('Error fetching files from folder:', error);
    }

    return allFiles;
  };

  const getCustomerDataMapping = (customer) => {
    const today = new Date().toLocaleDateString();

    return {
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      nric: customer.nric || '',
      occupation: customer.occupation || '',
      dob: customer.dob || '',
      address: customer.address || '',
      addressContinue: customer.addressContinue || '',
      fullAddress: ((customer.address || '') + (customer.addressContinue ? ', ' + customer.addressContinue : '')).trim(),
      salesConsultant: customer.salesConsultant || '',
      vsaNo: customer.vsaNo || '',
      date: today,
    };
  };

  const getAvailableForms = () => {
    const available = [];

    for (const [formType, template] of Object.entries(formTemplates)) {
      // Allow all image forms, even without field mappings (for back pages, static forms, etc.)
      if (template.fileType === 'image') {
        available.push({
          formType,
          name: FORM_TYPE_NAMES[formType] || formType,
          template,
        });
      }
    }

    console.log('[FormPrintModal] Available forms:', available.map(f => ({ type: f.formType, name: f.name })));
    return available;
  };

  const availableForms = getAvailableForms();

  // Debug logging for test drive form selection
  console.log('[FormPrintModal] Selected form type:', selectedFormType);
  console.log('[FormPrintModal] Is test_drive?', selectedFormType === 'test_drive');
  console.log('[FormPrintModal] Customer drive folder:', customer?.driveFolderId);

  const loadFormImage = async (fileId) => {
    try {
      const token = authService.getAccessToken();

      if (!token) {
        throw new Error('No access token available. Please sign in again.');
      }

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      return url;
    } catch (error) {
      console.error('Error loading form image:', error);
      throw error;
    }
  };

  const handleGeneratePreview = async () => {
    if (!selectedFormType) {
      alert('Please select a form to preview');
      return;
    }

    if (!isSignedIn) {
      alert('Please sign in to Google Drive to access form templates');
      return;
    }

    setLoading(true);

    try {
      const template = formTemplates[selectedFormType];
      const url = await loadFormImage(template.fileId);
      setImageUrl(url);
      setShowPreview(true);
    } catch (error) {
      console.error('Error generating preview:', error);
      alert('Failed to generate preview: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImageLoad = (e) => {
    const img = e.target;
    setImageDimensions({
      width: img.naturalWidth,
      height: img.naturalHeight,
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleBackToSelection = () => {
    setShowPreview(false);
    setImageUrl(null);
    setImageDimensions({ width: 0, height: 0 });
    // Clear back image URLs to free memory
    backImageUrls.forEach(url => {
      if (url) URL.revokeObjectURL(url);
    });
    setBackImageUrls([null, null, null, null]);
  };

  const handleBackImageSelect = async (index, fileId) => {
    const newSelectedImages = [...selectedBackImages];
    newSelectedImages[index] = fileId;
    setSelectedBackImages(newSelectedImages);

    // Load the image if a file is selected
    if (fileId) {
      try {
        const url = await loadFormImage(fileId);
        const newUrls = [...backImageUrls];
        // Revoke old URL if exists
        if (newUrls[index]) {
          URL.revokeObjectURL(newUrls[index]);
        }
        newUrls[index] = url;
        setBackImageUrls(newUrls);
      } catch (error) {
        console.error('Error loading back image:', error);
        alert('Failed to load image: ' + error.message);
      }
    } else {
      // Clear the image
      const newUrls = [...backImageUrls];
      if (newUrls[index]) {
        URL.revokeObjectURL(newUrls[index]);
      }
      newUrls[index] = null;
      setBackImageUrls(newUrls);
    }
  };

  if (!isOpen) return null;

  const template = selectedFormType ? formTemplates[selectedFormType] : null;
  const customerData = getCustomerDataMapping(customer);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Print Form with Customer Data" size="large">
      <div className="form-print-modal">
        {!showPreview ? (
          /* Selection View */
          <div className="form-selection">
            <div className="customer-info">
              <h4>Customer: {customer.name}</h4>
              <p>Select a form template to populate with customer data</p>
            </div>

            {!isSignedIn && (
              <div className="warning-banner">
                ⚠️ Please sign in to Google Drive to access form templates
              </div>
            )}

            {availableForms.length === 0 ? (
              <div className="empty-state">
                <p>No forms available</p>
                <p className="empty-state-hint">
                  Upload image form templates and configure field mappings in Forms Management
                </p>
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label htmlFor="formSelect">Select Form Template</label>
                  <select
                    id="formSelect"
                    value={selectedFormType}
                    onChange={(e) => {
                      console.log('[FormPrintModal] Form type changed to:', e.target.value);
                      setSelectedFormType(e.target.value);
                    }}
                    disabled={loading || !isSignedIn}
                  >
                    <option value="">-- Select a form --</option>
                    {availableForms.map(({ formType, name, template }) => {
                      const fieldCount = Object.keys(template.fieldMappings || {}).length;
                      return (
                        <option key={formType} value={formType}>
                          {name} ({fieldCount} fields)
                        </option>
                      );
                    })}
                  </select>
                </div>

                {selectedFormType && (
                  <div className="form-info">
                    <h4>Form Details</h4>
                    <div className="info-grid">
                      <div className="info-item">
                        <label>Template:</label>
                        <span>{FORM_TYPE_NAMES[selectedFormType] || selectedFormType}</span>
                      </div>
                      <div className="info-item">
                        <label>Fields Mapped:</label>
                        <span>
                          {Object.keys(formTemplates[selectedFormType].fieldMappings || {}).length}
                        </span>
                      </div>
                      <div className="info-item">
                        <label>Type:</label>
                        <span>Image Form</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Back Images Selection for Test Drive Form */}
                {(() => {
                  const shouldShow = selectedFormType === 'test_drive';
                  console.log('[FormPrintModal] Checking back images section - shouldShow:', shouldShow, 'selectedFormType:', selectedFormType);
                  return shouldShow;
                })() && (
                  <div className="back-images-section">
                    <h4>Attach Images to Back of Form (Optional)</h4>
                    <p className="back-images-hint">
                      Select up to 4 images to print on the back of the test drive form
                    </p>

                    {loadingImages ? (
                      <div className="loading-state">
                        <p>Loading available images...</p>
                      </div>
                    ) : availableImages.length === 0 ? (
                      <div className="empty-state-small">
                        <p>No images found in customer's folder</p>
                      </div>
                    ) : (
                      <div className="back-images-grid">
                        {[0, 1, 2, 3].map((index) => (
                          <div key={index} className="back-image-selector">
                            <label>Image {index + 1}</label>
                            <select
                              value={selectedBackImages[index] || ''}
                              onChange={(e) => handleBackImageSelect(index, e.target.value || null)}
                            >
                              <option value="">-- No image --</option>
                              {availableImages.map((img) => (
                                <option key={img.id} value={img.id}>
                                  {img.name}
                                </option>
                              ))}
                            </select>
                            {backImageUrls[index] && (
                              <div className="image-preview-small">
                                <img src={backImageUrls[index]} alt={`Preview ${index + 1}`} />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleGeneratePreview}
                disabled={!selectedFormType || loading || !isSignedIn}
              >
                {loading ? 'Loading...' : 'Generate Preview'}
              </button>
            </div>
          </div>
        ) : (
          /* Preview View */
          <div className="form-preview">
            <div className="preview-header no-print">
              <h4>{FORM_TYPE_NAMES[selectedFormType] || selectedFormType}</h4>
              <button className="btn btn-small btn-secondary" onClick={handleBackToSelection}>
                ← Back to Selection
              </button>
            </div>

            <div className="preview-container">
              {/* Front Page */}
              {imageUrl && (
                <div className="filled-form-wrapper">
                  <img
                    src={imageUrl}
                    alt="Form template"
                    onLoad={handleImageLoad}
                    className="form-image"
                  />
                  {imageDimensions.width > 0 && template?.fieldMappings && (
                    <svg
                      className="form-text-overlay"
                      viewBox={`0 0 ${imageDimensions.width} ${imageDimensions.height}`}
                    >
                      {Object.entries(template.fieldMappings).map(([fieldId, field]) => {
                        // Get the text value for this field
                        let text = '';
                        if (field.customValue) {
                          text = field.customValue;
                        } else {
                          text = customerData[field.type] || '';
                        }

                        if (!text) return null;

                        return (
                          <text
                            key={fieldId}
                            x={field.x}
                            y={field.y}
                            fill={field.color || '#000000'}
                            fontSize={field.fontSize || 14}
                            fontFamily="Arial"
                          >
                            {text}
                          </text>
                        );
                      })}
                    </svg>
                  )}
                </div>
              )}

              {/* Back Page - 4 Image Quarters (Test Drive Only) */}
              {selectedFormType === 'test_drive' && backImageUrls.some(url => url !== null) && (
                <div className="filled-form-wrapper back-page">
                  <div className="four-quarter-grid">
                    {backImageUrls.map((url, index) => (
                      <div key={index} className="quarter-image">
                        {url ? (
                          <img src={url} alt={`Back image ${index + 1}`} />
                        ) : (
                          <div className="empty-quarter">
                            <span>Image {index + 1}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="preview-actions no-print">
              <button className="btn btn-primary" onClick={handlePrint}>
                🖨️ Print Form
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default FormPrintModal;
