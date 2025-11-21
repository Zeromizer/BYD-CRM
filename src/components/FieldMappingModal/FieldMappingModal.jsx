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
  const canvasRef = useRef(null);
  const imageRef = useRef(null);

  const [mappings, setMappings] = useState({});
  const [selectedField, setSelectedField] = useState('name');
  const [fontSize, setFontSize] = useState(14);
  const [textColor, setTextColor] = useState('#000000');
  const [customValue, setCustomValue] = useState('');
  const [editingFieldId, setEditingFieldId] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load existing mappings when modal opens
  useEffect(() => {
    if (isOpen && template) {
      setMappings({ ...(template.fieldMappings || {}) });
      loadFormImage();
    }
  }, [isOpen, template]);

  // Redraw canvas whenever mappings change
  useEffect(() => {
    if (isOpen && imageRef.current) {
      redrawCanvas();
    }
  }, [mappings, isOpen]);

  const loadFormImage = async () => {
    if (!template || !template.fileId) {
      console.error('No template or file ID');
      return;
    }

    setLoading(true);

    try {
      // Fetch image from Google Drive
      const token = authService.getAccessToken();
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${template.fileId}?alt=media`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch image from Drive');
      }

      const blob = await response.blob();
      const imageUrl = URL.createObjectURL(blob);

      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
        setupCanvas();
        redrawCanvas();
        setLoading(false);
      };
      img.onerror = () => {
        console.error('Failed to load image');
        setLoading(false);
      };
      img.src = imageUrl;
    } catch (error) {
      console.error('Error loading form image:', error);
      alert('Failed to load form image: ' + error.message);
      setLoading(false);
    }
  };

  const setupCanvas = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;

    if (!canvas || !img) return;

    // Scale to fit screen while maintaining aspect ratio
    const maxWidth = Math.min(window.innerWidth * 0.7, 1000);
    const scale = maxWidth / img.width;
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
  };

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;

    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    const scale = canvas.width / img.width;

    // Clear and draw image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Draw field markers
    Object.entries(mappings).forEach(([fieldId, field]) => {
      const x = field.x * scale;
      const y = field.y * scale;

      // Draw marker circle
      ctx.fillStyle = 'rgba(0, 188, 212, 0.3)';
      ctx.beginPath();
      ctx.arc(x, y, 15, 0, 2 * Math.PI);
      ctx.fill();

      ctx.strokeStyle = '#00bcd4';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 15, 0, 2 * Math.PI);
      ctx.stroke();

      // Draw field label
      ctx.fillStyle = '#00bcd4';
      ctx.font = 'bold 12px Arial';
      const labelText = field.customValue || FIELD_NAMES[field.type] || field.type;
      ctx.fillText(labelText, x + 20, y + 5);
    });
  };

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    const img = imageRef.current;

    if (!canvas || !img) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Convert to original image coordinates
    const scale = canvas.width / img.width;
    const originalX = x / scale;
    const originalY = y / scale;

    // Check if custom value is required but empty
    if (selectedField === 'custom' && !customValue.trim()) {
      alert('Please enter a custom value');
      return;
    }

    // Add field mapping
    const fieldId = 'field_' + Date.now();
    const newMapping = {
      type: selectedField,
      x: originalX,
      y: originalY,
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
    // Reset state
    setMappings({});
    setEditingFieldId(null);
    setCustomValue('');
    imageRef.current = null;
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Configure Field Mappings" size="large">
      <div className="field-mapping-modal">
        <div className="field-mapping-content">
          {/* Left Panel: Canvas */}
          <div className="canvas-panel">
            <div className="canvas-header">
              <h4>Click on the form to place fields</h4>
              <button className="btn btn-small btn-danger" onClick={clearAllMappings}>
                Clear All
              </button>
            </div>
            <div className="canvas-container">
              {loading ? (
                <div className="canvas-loading">
                  <div className="loading"></div>
                  <p>Loading form image...</p>
                </div>
              ) : (
                <canvas ref={canvasRef} onClick={handleCanvasClick} className="mapping-canvas" />
              )}
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
