import { useState, useEffect, useRef } from 'react';
import useAuthStore from '../../stores/useAuthStore';
import authService from '../../services/authService';
import Modal from '../Modal/Modal';
import './FieldMappingModal.css';

const FIELD_NAMES = {
  name: 'Customer Name',
  phone: 'Phone Number',
  email: 'Email',
  nric: 'NRIC/FIN',
  occupation: 'Occupation',
  dob: 'Date of Birth',
  address: 'Address',
  addressContinue: 'Address Continue',
  fullAddress: 'Full Address (Combined)',
  salesConsultant: 'Sales Consultant',
  vsaNo: 'VSA No',
  date: "Today's Date",
  custom: 'Custom Value',
};

function FieldMappingModal({ isOpen, onClose, formType, template, onSave }) {
  const { isSignedIn } = useAuthStore();
  const svgRef = useRef(null);

  const [mappings, setMappings] = useState({});
  const [selectedField, setSelectedField] = useState('name');
  const [fontSize, setFontSize] = useState(14);
  const [textColor, setTextColor] = useState('#000000');
  const [customValue, setCustomValue] = useState('');
  const [editingFieldId, setEditingFieldId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });

  // Load existing mappings and image when modal opens
  useEffect(() => {
    if (isOpen && template) {
      console.log('Loading template mappings:', template.fieldMappings);
      setMappings({ ...(template.fieldMappings || {}) });
      loadFormImage();
    }

    // Reset state when modal closes
    if (!isOpen) {
      setMappings({});
      setEditingFieldId(null);
      setCustomValue('');
      setImageUrl(null);
      setImageDimensions({ width: 0, height: 0 });
    }
  }, [isOpen, template?.fileId]);

  const loadFormImage = async () => {
    if (!template || !template.fileId) {
      console.error('No template or file ID');
      alert('No form template found. Please upload a form first.');
      return;
    }

    if (!isSignedIn) {
      alert('Please sign in to Google Drive first to configure form fields.');
      return;
    }

    setLoading(true);

    try {
      const token = authService.getAccessToken();

      if (!token) {
        throw new Error('No access token available. Please sign in again.');
      }

      console.log('Loading form image from Drive:', template.fileId);

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${template.fileId}?alt=media`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Drive API error:', response.status, errorText);
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setImageUrl(url);
      setLoading(false);
      console.log('Form image loaded successfully');
    } catch (error) {
      console.error('Error loading form image:', error);
      alert('Failed to load form image: ' + error.message + '\n\nPlease make sure you are signed in to Google Drive.');
      setLoading(false);
    }
  };

  const handleImageLoad = (e) => {
    const img = e.target;
    setImageDimensions({
      width: img.naturalWidth,
      height: img.naturalHeight,
    });
    console.log('Image dimensions:', img.naturalWidth, 'x', img.naturalHeight);
    console.log('Current mappings count:', Object.keys(mappings).length);
  };

  const handleSvgClick = (e) => {
    if (!svgRef.current) return;

    // Check if custom value is required but empty
    if (selectedField === 'custom' && !customValue.trim()) {
      alert('Please enter a custom value');
      return;
    }

    // Get click coordinates in SVG coordinate system
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;

    // Transform to SVG coordinates (automatically handles scaling)
    const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());

    // Add field mapping
    const fieldId = 'field_' + Date.now();
    const newMapping = {
      type: selectedField,
      x: svgP.x,
      y: svgP.y,
      fontSize: fontSize,
      color: textColor,
    };

    if (selectedField === 'custom') {
      newMapping.customValue = customValue.trim();
    }

    setMappings({
      ...mappings,
      [fieldId]: newMapping,
    });

    // Clear custom value after adding
    if (selectedField === 'custom') {
      setCustomValue('');
    }
  };

  const removeMapping = (fieldId) => {
    const newMappings = { ...mappings };
    delete newMappings[fieldId];
    setMappings(newMappings);
  };

  const startEditMapping = (fieldId) => {
    setEditingFieldId(fieldId);
  };

  const saveEditMapping = (fieldId, newFontSize, newColor) => {
    setMappings({
      ...mappings,
      [fieldId]: {
        ...mappings[fieldId],
        fontSize: parseInt(newFontSize),
        color: newColor,
      },
    });
    setEditingFieldId(null);
  };

  const cancelEditMapping = () => {
    setEditingFieldId(null);
  };

  const clearAllMappings = () => {
    if (window.confirm('Remove all field mappings?')) {
      setMappings({});
    }
  };

  const handleSave = () => {
    onSave(formType, mappings);
    onClose();
  };

  const handleClose = () => {
    setMappings({});
    setEditingFieldId(null);
    setCustomValue('');
    setImageUrl(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Configure Field Mappings" size="large">
      <div className="field-mapping-modal">
        <div className="field-mapping-content">
          {/* Left Panel: Image with SVG Overlay */}
          <div className="canvas-panel">
            <div className="canvas-header">
              <h4>Click on the form to place fields</h4>
              <button className="btn btn-small btn-danger" onClick={clearAllMappings}>
                Clear All
              </button>
            </div>
            <div className="image-container">
              {loading ? (
                <div className="canvas-loading">
                  <div className="loading"></div>
                  <p>Loading form image...</p>
                </div>
              ) : imageUrl ? (
                <div className="image-wrapper">
                  <img
                    src={imageUrl}
                    alt="Form template"
                    onLoad={handleImageLoad}
                    className="form-image"
                  />
                  {imageDimensions.width > 0 && (
                    <svg
                      ref={svgRef}
                      className="mapping-overlay"
                      viewBox={`0 0 ${imageDimensions.width} ${imageDimensions.height}`}
                      onClick={handleSvgClick}
                    >
                      {Object.entries(mappings).map(([fieldId, field]) => (
                        <FieldMarker
                          key={fieldId}
                          fieldId={fieldId}
                          field={field}
                        />
                      ))}
                    </svg>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {/* Right Panel: Controls and List */}
          <div className="controls-panel">
            {/* Field Configuration */}
            <div className="field-config">
              <h4>Add Field</h4>

              <div className="form-group">
                <label>Field Type</label>
                <select
                  value={selectedField}
                  onChange={(e) => {
                    setSelectedField(e.target.value);
                    if (e.target.value !== 'custom') {
                      setCustomValue('');
                    }
                  }}
                >
                  {Object.entries(FIELD_NAMES).map(([key, name]) => (
                    <option key={key} value={key}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedField === 'custom' && (
                <div className="form-group">
                  <label>Custom Value</label>
                  <input
                    type="text"
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    placeholder="Enter custom text..."
                  />
                </div>
              )}

              <div className="form-group">
                <label>Font Size</label>
                <select value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value))}>
                  {Array.from({ length: 21 }, (_, i) => (i + 1) * 2 + 6).map((size) => (
                    <option key={size} value={size}>
                      {size}px
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Text Color</label>
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                />
              </div>

              <p className="field-hint">Click on the form image to place this field</p>
            </div>

            {/* Mapped Fields List */}
            <div className="mapped-fields">
              <h4>Mapped Fields ({Object.keys(mappings).length})</h4>
              {Object.keys(mappings).length === 0 ? (
                <p className="no-mappings">No fields mapped yet. Click on the form to add fields.</p>
              ) : (
                <div className="mappings-list">
                  {Object.entries(mappings).map(([fieldId, field]) => (
                    <MappingItem
                      key={fieldId}
                      fieldId={fieldId}
                      field={field}
                      isEditing={editingFieldId === fieldId}
                      onEdit={() => startEditMapping(fieldId)}
                      onSave={(newFontSize, newColor) =>
                        saveEditMapping(fieldId, newFontSize, newColor)
                      }
                      onCancel={cancelEditMapping}
                      onRemove={() => removeMapping(fieldId)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={handleClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Save Mappings
          </button>
        </div>
      </div>
    </Modal>
  );
}

// SVG Marker Component
function FieldMarker({ fieldId, field }) {
  const displayText = field.customValue || FIELD_NAMES[field.type] || field.type;

  return (
    <g className="field-marker">
      {/* Marker circle with fill */}
      <circle
        cx={field.x}
        cy={field.y}
        r="15"
        fill="rgba(0, 188, 212, 0.3)"
        stroke="#00bcd4"
        strokeWidth="3"
      />
      {/* Label text */}
      <text
        x={field.x + 20}
        y={field.y + 5}
        fill="#00bcd4"
        fontSize="12"
        fontWeight="bold"
        fontFamily="Arial"
      >
        {displayText}
      </text>
    </g>
  );
}

// Individual Mapping Item Component
function MappingItem({ fieldId, field, isEditing, onEdit, onSave, onCancel, onRemove }) {
  const [editFontSize, setEditFontSize] = useState(field.fontSize);
  const [editColor, setEditColor] = useState(field.color);

  const displayText = field.customValue
    ? `Custom: "${field.customValue}"`
    : FIELD_NAMES[field.type] || field.type;

  if (isEditing) {
    return (
      <div className="mapping-item editing">
        <div className="mapping-info">
          <strong>{displayText}</strong>
        </div>
        <div className="mapping-edit-controls">
          <div className="form-group">
            <label>Font Size</label>
            <select value={editFontSize} onChange={(e) => setEditFontSize(e.target.value)}>
              {Array.from({ length: 21 }, (_, i) => (i + 1) * 2 + 6).map((size) => (
                <option key={size} value={size}>
                  {size}px
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Color</label>
            <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} />
          </div>
          <div className="edit-actions">
            <button className="btn btn-small btn-success" onClick={() => onSave(editFontSize, editColor)}>
              Save
            </button>
            <button className="btn btn-small btn-secondary" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mapping-item">
      <div className="mapping-info">
        <strong>{displayText}</strong>
        <span className="mapping-details">
          Size: {field.fontSize}px, Color:{' '}
          <span
            className="color-box"
            style={{ backgroundColor: field.color }}
            title={field.color}
          ></span>
        </span>
      </div>
      <div className="mapping-actions">
        <button className="btn btn-small btn-primary" onClick={onEdit}>
          Edit
        </button>
        <button className="btn btn-small btn-danger" onClick={onRemove}>
          Remove
        </button>
      </div>
    </div>
  );
}

export default FieldMappingModal;
