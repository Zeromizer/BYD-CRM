import { useState, useEffect, useRef } from 'react';
import Modal from '../../Modal/Modal';
import {
  FIELD_TYPES,
  getFieldTypesByCategory,
  getFieldLabel,
  getSampleCustomerData,
  FONT_SIZES,
  FONT_FAMILIES,
  TEXT_ALIGNMENTS,
} from '../../../services/fieldMapper';
import documentRenderer from '../../../services/documentRenderer';
import './FormEditor.css';

/**
 * FormEditor - WYSIWYG Editor for Document Field Mapping
 *
 * Features:
 * - Click to place fields on form
 * - Live preview with real customer data
 * - Drag to reposition fields
 * - Font sizes in Points (pt)
 * - Print-accurate preview (WYSIWYG)
 */
function FormEditor({ isOpen, onClose, template, onSave }) {
  // State
  const [fields, setFields] = useState({});
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [selectedFieldType, setSelectedFieldType] = useState('name');
  const [fontSize, setFontSize] = useState(12);
  const [fontFamily, setFontFamily] = useState('Arial');
  const [fontWeight, setFontWeight] = useState('normal');
  const [color, setColor] = useState('#000000');
  const [alignment, setAlignment] = useState('left');
  const [customValue, setCustomValue] = useState('');
  const [showPreview, setShowPreview] = useState(true);
  const [previewData, setPreviewData] = useState(getSampleCustomerData());

  // Canvas state
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [imageUrl, setImageUrl] = useState(null);
  const [scale, setScale] = useState(1);

  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const containerRef = useRef(null);

  // Load template data and image when modal opens
  useEffect(() => {
    if (isOpen && template) {
      setFields({ ...(template.fields || {}) });
      loadFormImage();
      setSelectedFieldId(null);
    }

    if (!isOpen) {
      // Cleanup
      setFields({});
      setImageLoaded(false);
      setImageUrl(null);
      setSelectedFieldId(null);
    }
  }, [isOpen, template?.fileId]);

  // Load form image
  const loadFormImage = async () => {
    if (!template?.fileId) return;

    try {
      const blob = await documentRenderer.fetchImageFromDrive(template.fileId);
      const url = URL.createObjectURL(blob);
      setImageUrl(url);
    } catch (error) {
      console.error('Error loading form image:', error);
      alert('Failed to load form image: ' + error.message);
    }
  };

  // Handle image load
  const handleImageLoad = (e) => {
    const img = e.target;
    setImageDimensions({
      width: img.naturalWidth,
      height: img.naturalHeight,
    });
    setImageLoaded(true);

    // Calculate scale to fit container
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth - 40;
      const scale = containerWidth / img.naturalWidth;
      setScale(Math.min(scale, 1)); // Never scale up beyond 100%
    }
  };

  // Handle canvas click to place field
  const handleCanvasClick = (e) => {
    if (!canvasRef.current || !imageLoaded) return;

    // Don't place if clicking on existing field
    if (e.target.classList.contains('field-marker')) return;

    // Get click coordinates relative to canvas
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    // Validate custom value if custom field type
    if (selectedFieldType === 'custom' && !customValue.trim()) {
      alert('Please enter a custom value');
      return;
    }

    // Create new field
    const fieldId = `field_${Date.now()}`;
    const newField = {
      id: fieldId,
      fieldType: selectedFieldType,
      x: Math.round(x),
      y: Math.round(y),
      fontSize,
      fontFamily,
      fontWeight,
      color,
      alignment,
    };

    if (selectedFieldType === 'custom') {
      newField.customValue = customValue.trim();
    }

    setFields({ ...fields, [fieldId]: newField });
    setSelectedFieldId(fieldId);

    // Clear custom value after placing
    if (selectedFieldType === 'custom') {
      setCustomValue('');
    }
  };

  // Handle field click to select
  const handleFieldClick = (e, fieldId) => {
    e.stopPropagation();
    setSelectedFieldId(fieldId);
  };

  // Handle field drag
  const handleFieldDrag = (fieldId, newX, newY) => {
    setFields({
      ...fields,
      [fieldId]: {
        ...fields[fieldId],
        x: Math.round(newX),
        y: Math.round(newY),
      },
    });
  };

  // Delete field
  const deleteField = (fieldId) => {
    const newFields = { ...fields };
    delete newFields[fieldId];
    setFields(newFields);
    if (selectedFieldId === fieldId) {
      setSelectedFieldId(null);
    }
  };

  // Update selected field properties
  const updateSelectedField = (updates) => {
    if (!selectedFieldId) return;

    setFields({
      ...fields,
      [selectedFieldId]: {
        ...fields[selectedFieldId],
        ...updates,
      },
    });
  };

  // Clear all fields
  const clearAllFields = () => {
    if (window.confirm('Remove all fields?')) {
      setFields({});
      setSelectedFieldId(null);
    }
  };

  // Save fields
  const handleSave = () => {
    onSave(template.id, fields);
    onClose();
  };

  // Handle zoom controls
  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3)); // Max 300%
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.25)); // Min 25%
  };

  const handleZoomReset = () => {
    if (containerRef.current && imageDimensions.width > 0) {
      const containerWidth = containerRef.current.clientWidth - 40;
      const fitScale = containerWidth / imageDimensions.width;
      setScale(Math.min(fitScale, 1)); // Fit to container
    }
  };

  const handleZoom100 = () => {
    setScale(1); // 100% actual size
  };

  // Get field value for preview
  const getFieldValue = (field) => {
    if (field.customValue) {
      return field.customValue;
    }
    return previewData[field.fieldType] || getFieldLabel(field.fieldType);
  };

  if (!isOpen) return null;

  const selectedField = selectedFieldId ? fields[selectedFieldId] : null;
  const fieldsByCategory = getFieldTypesByCategory();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Configure Document Fields"
      size="fullscreen"
    >
      <div className="form-editor">
        {/* Left Sidebar - Field Palette */}
        <div className="form-editor-sidebar">
          <div className="sidebar-section">
            <h3>Add Field</h3>

            <div className="form-group">
              <label>Field Type</label>
              <select
                value={selectedFieldType}
                onChange={(e) => {
                  setSelectedFieldType(e.target.value);
                  if (e.target.value !== 'custom') {
                    setCustomValue('');
                  }
                }}
              >
                {Object.entries(fieldsByCategory).map(([category, fields]) => (
                  <optgroup key={category} label={category}>
                    {fields.map((field) => (
                      <option key={field.key} value={field.key}>
                        {field.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {selectedFieldType === 'custom' && (
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
              <label>Font Size (pt)</label>
              <select
                value={fontSize}
                onChange={(e) => setFontSize(parseInt(e.target.value))}
              >
                {FONT_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}pt
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Font Family</label>
              <select
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
              >
                {FONT_FAMILIES.map((font) => (
                  <option key={font.value} value={font.value}>
                    {font.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Font Weight</label>
              <select
                value={fontWeight}
                onChange={(e) => setFontWeight(e.target.value)}
              >
                <option value="normal">Normal</option>
                <option value="bold">Bold</option>
              </select>
            </div>

            <div className="form-group">
              <label>Alignment</label>
              <div className="alignment-buttons">
                {TEXT_ALIGNMENTS.map((align) => (
                  <button
                    key={align.value}
                    className={`btn-alignment ${alignment === align.value ? 'active' : ''}`}
                    onClick={() => setAlignment(align.value)}
                    title={align.label}
                  >
                    {align.icon}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Text Color</label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </div>

            <div className="field-hint">
              Click on the form to place this field
            </div>
          </div>

          {/* Fields List */}
          <div className="sidebar-section">
            <div className="fields-list-header">
              <h3>Fields ({Object.keys(fields).length})</h3>
              {Object.keys(fields).length > 0 && (
                <button className="btn btn-small btn-danger" onClick={clearAllFields}>
                  Clear All
                </button>
              )}
            </div>

            <div className="fields-list">
              {Object.keys(fields).length === 0 ? (
                <p className="no-fields">No fields added yet</p>
              ) : (
                Object.entries(fields).map(([fieldId, field]) => (
                  <div
                    key={fieldId}
                    className={`field-list-item ${
                      selectedFieldId === fieldId ? 'selected' : ''
                    }`}
                    onClick={() => setSelectedFieldId(fieldId)}
                  >
                    <div className="field-list-label">
                      {getFieldLabel(field.fieldType)}
                      {field.customValue && (
                        <span className="custom-badge">Custom</span>
                      )}
                    </div>
                    <div className="field-list-meta">
                      {field.fontSize}pt, {field.fontFamily}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Center - Canvas */}
        <div className="form-editor-canvas" ref={containerRef}>
          <div className="canvas-header">
            <h3>Form Template</h3>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={showPreview}
                onChange={(e) => setShowPreview(e.target.checked)}
              />
              Show Preview Data
            </label>
          </div>

          <div className="canvas-container">
            {imageUrl ? (
              <div
                className="canvas-wrapper"
                ref={canvasRef}
                onClick={handleCanvasClick}
                style={{
                  width: imageDimensions.width * scale,
                  height: imageDimensions.height * scale,
                }}
              >
                <img
                  ref={imageRef}
                  src={imageUrl}
                  alt="Form template"
                  onLoad={handleImageLoad}
                  className="form-base-image"
                  draggable={false}
                />

                {imageLoaded &&
                  Object.entries(fields).map(([fieldId, field]) => (
                    <FieldMarker
                      key={fieldId}
                      field={field}
                      value={showPreview ? getFieldValue(field) : getFieldLabel(field.fieldType)}
                      isSelected={selectedFieldId === fieldId}
                      scale={scale}
                      dpi={template.dpi || 300}
                      onClick={(e) => handleFieldClick(e, fieldId)}
                      onDrag={(newX, newY) => handleFieldDrag(fieldId, newX, newY)}
                    />
                  ))}
              </div>
            ) : (
              <div className="canvas-loading">
                <div className="loading"></div>
                <p>Loading form image...</p>
              </div>
            )}

            {/* Floating Zoom Toolbar */}
            <div className="floating-zoom-toolbar">
              <button
                className="zoom-btn"
                onClick={handleZoomOut}
                title="Zoom Out (−)"
                disabled={scale <= 0.25}
              >
                −
              </button>
              <span className="zoom-level">{Math.round(scale * 100)}%</span>
              <button
                className="zoom-btn"
                onClick={handleZoomIn}
                title="Zoom In (+)"
                disabled={scale >= 3}
              >
                +
              </button>
              <div className="zoom-divider" />
              <button
                className="zoom-btn zoom-btn-text"
                onClick={handleZoomReset}
                title="Fit to Screen"
              >
                Fit
              </button>
              <button
                className="zoom-btn zoom-btn-text"
                onClick={handleZoom100}
                title="Actual Size (100%)"
              >
                100%
              </button>
            </div>
          </div>
        </div>

        {/* Right Sidebar - Selected Field Editor */}
        <div className="form-editor-info">
          {selectedField ? (
            <div className="info-section selected-field-panel">
              <h3>Edit Field</h3>
              <div className="selected-field-info">
                <strong>{getFieldLabel(selectedField.fieldType)}</strong>
                {selectedField.customValue && (
                  <span className="custom-value">"{selectedField.customValue}"</span>
                )}
              </div>

              <div className="form-group">
                <label>Font Size (pt)</label>
                <select
                  value={selectedField.fontSize}
                  onChange={(e) =>
                    updateSelectedField({ fontSize: parseInt(e.target.value) })
                  }
                >
                  {FONT_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}pt
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Font Family</label>
                <select
                  value={selectedField.fontFamily}
                  onChange={(e) => updateSelectedField({ fontFamily: e.target.value })}
                >
                  {FONT_FAMILIES.map((font) => (
                    <option key={font.value} value={font.value}>
                      {font.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Font Weight</label>
                <select
                  value={selectedField.fontWeight}
                  onChange={(e) => updateSelectedField({ fontWeight: e.target.value })}
                >
                  <option value="normal">Normal</option>
                  <option value="bold">Bold</option>
                </select>
              </div>

              <div className="form-group">
                <label>Alignment</label>
                <div className="alignment-buttons">
                  {TEXT_ALIGNMENTS.map((align) => (
                    <button
                      key={align.value}
                      className={`btn-alignment ${
                        selectedField.alignment === align.value ? 'active' : ''
                      }`}
                      onClick={() => updateSelectedField({ alignment: align.value })}
                      title={align.label}
                    >
                      {align.icon}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Text Color</label>
                <input
                  type="color"
                  value={selectedField.color}
                  onChange={(e) => updateSelectedField({ color: e.target.value })}
                />
              </div>

              <div className="form-group field-position">
                <label>Position (pixels)</label>
                <div className="position-inputs">
                  <div className="position-input">
                    <span>X:</span>
                    <input
                      type="number"
                      value={Math.round(selectedField.x)}
                      onChange={(e) => updateSelectedField({ x: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="position-input">
                    <span>Y:</span>
                    <input
                      type="number"
                      value={Math.round(selectedField.y)}
                      onChange={(e) => updateSelectedField({ y: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </div>

              <button
                className="btn btn-danger btn-block"
                onClick={() => deleteField(selectedFieldId)}
              >
                Delete Field
              </button>
            </div>
          ) : (
            <div className="info-section no-field-selected">
              <div className="no-selection-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18M9 21V9" />
                </svg>
              </div>
              <h3>No Field Selected</h3>
              <p className="no-selection-hint">Click on a field in the form to edit its properties, or add a new field from the left panel.</p>
              <div className="quick-tips">
                <p><strong>Quick Tips:</strong></p>
                <ul>
                  <li>Use + / - to zoom in/out</li>
                  <li>Drag fields to reposition</li>
                  <li>Click field to select and edit</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="form-editor-footer">
        <button className="btn btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={handleSave}>
          Save Configuration
        </button>
      </div>
    </Modal>
  );
}

/**
 * FieldMarker - Draggable field marker with preview text
 */
function FieldMarker({ field, value, isSelected, scale, dpi, onClick, onDrag }) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const markerRef = useRef(null);

  const handleMouseDown = (e) => {
    e.stopPropagation();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - field.x * scale,
      y: e.clientY - field.y * scale,
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;

    const newX = (e.clientX - dragStart.x) / scale;
    const newY = (e.clientY - dragStart.y) / scale;

    onDrag(newX, newY);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  // Convert font size from points to pixels at display scale
  const fontSizePx = documentRenderer.pointsToPixels(field.fontSize, dpi) * scale;

  // Get alignment class for CSS transform-based positioning
  const alignmentClass = `align-${field.alignment || 'left'}`;

  return (
    <div
      ref={markerRef}
      className={`field-marker ${alignmentClass} ${isSelected ? 'selected' : ''} ${
        isDragging ? 'dragging' : ''
      }`}
      style={{
        left: field.x * scale,
        top: field.y * scale,
        color: field.color,
        fontSize: fontSizePx,
        fontFamily: field.fontFamily,
        fontWeight: field.fontWeight,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      onClick={onClick}
      onMouseDown={handleMouseDown}
    >
      {value}
    </div>
  );
}

export default FormEditor;
