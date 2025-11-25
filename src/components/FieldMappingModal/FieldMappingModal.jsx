import { useState, useEffect, useRef, useCallback } from 'react';
import useAuthStore from '../../stores/useAuthStore';
import formRenderService, { FONT_SIZE_PRESETS, FIELD_NAMES } from '../../services/formRenderService';
import Modal from '../Modal/Modal';
import './FieldMappingModal.css';

/**
 * Enhanced Field Mapping Modal
 *
 * Features:
 * - Canvas-based rendering for true WYSIWYG preview
 * - DPI-aware font sizing using typographic points
 * - Drag-to-reposition fields
 * - Click to select and edit fields
 * - Real-time preview of text rendering
 */
function FieldMappingModal({ isOpen, onClose, formType, template, onSave }) {
  const { isSignedIn } = useAuthStore();
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // State
  const [mappings, setMappings] = useState({});
  const [selectedField, setSelectedField] = useState('name');
  const [fontSize, setFontSize] = useState(12); // Points
  const [textColor, setTextColor] = useState('#000000');
  const [customValue, setCustomValue] = useState('');
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [formImage, setFormImage] = useState(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragFieldId, setDragFieldId] = useState(null);
  const [mode, setMode] = useState('add'); // 'add' or 'select'

  // Sample data for preview
  const sampleData = {
    name: 'John Doe',
    phone: '+65 9123 4567',
    email: 'john.doe@email.com',
    nric: 'S1234567A',
    occupation: 'Engineer',
    dob: '01/01/1990',
    address: '123 Main Street',
    addressContinue: 'Singapore 123456',
    fullAddress: '123 Main Street, Singapore 123456',
    salesConsultant: 'Jane Smith',
    vsaNo: 'VSA-2024-001',
    date: new Date().toLocaleDateString(),
    makeModel: 'BYD Seal',
    yom: '2024',
    bodyColour: 'Aurora White',
    upholstery: 'Black Leather',
    przType: 'Premium',
    package: 'Performance',
    sellingWithCOE: '$168,888',
    sellingPriceList: '$148,888',
    purchasePriceWithCOE: '$168,888',
    coeRebateLevel: '$20,000',
    deposit: '$10,000',
    lessOthers: '$0',
    addOthers: '$5,000',
    deliveryDate: '01/03/2024',
    tradeInCarNo: 'SBA1234A',
    tradeInCarModel: 'Honda Civic',
    tradeInAmount: '$30,000',
    dateOfRegistration: '01/02/2024',
    registrationNo: 'SGA1234B',
    chassisNo: 'CHASSIS123456',
    engineNo: 'ENGINE123456',
    motorNo: 'MOTOR123456',
    insuranceCompany: 'NTUC Income',
    insuranceFee: '$1,500',
    insuranceFeeNet: '$1,200',
    remarks1: 'Remark line 1',
    remarks2: 'Remark line 2',
    loanAmount: '$100,000',
    interest: '2.78%',
    tenure: '7 years',
    adminFee: '$500',
    insuranceSubsidy: '$300',
    monthlyRepayment: '$1,388',
  };

  // Load existing mappings and image when modal opens
  useEffect(() => {
    if (isOpen && template) {
      // Migrate old pixel-based font sizes to points
      const migratedMappings = {};
      const oldMappings = template.fieldMappings || {};

      for (const [id, field] of Object.entries(oldMappings)) {
        migratedMappings[id] = {
          ...field,
          // If fontSize is larger than 72 (max points), it's likely in pixels
          // Convert to points (pixels / 4.167)
          fontSize: field.fontSize > 72
            ? formRenderService.pixelsToPoints(field.fontSize)
            : field.fontSize || 12,
        };
      }

      setMappings(migratedMappings);
      loadFormImage();
    }

    if (!isOpen) {
      resetState();
    }
  }, [isOpen, template?.fileId]);

  // Redraw canvas when dependencies change
  useEffect(() => {
    if (formImage && canvasRef.current) {
      drawCanvas();
    }
  }, [formImage, mappings, selectedFieldId, scale]);

  // Calculate scale when image loads or container resizes
  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current && imageDimensions.width > 0) {
        const containerWidth = containerRef.current.clientWidth - 40; // Padding
        const maxHeight = window.innerHeight * 0.6;

        const scaleX = containerWidth / imageDimensions.width;
        const scaleY = maxHeight / imageDimensions.height;

        setScale(Math.min(scaleX, scaleY, 1)); // Never upscale
      }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [imageDimensions]);

  const resetState = () => {
    setMappings({});
    setSelectedFieldId(null);
    setCustomValue('');
    setFormImage(null);
    setImageDimensions({ width: 0, height: 0 });
    setScale(1);
    setIsDragging(false);
    setDragFieldId(null);
    setMode('add');
  };

  const loadFormImage = async () => {
    if (!template?.fileId) {
      alert('No form template found. Please upload a form first.');
      return;
    }

    if (!isSignedIn) {
      alert('Please sign in to Google Drive first to configure form fields.');
      return;
    }

    setLoading(true);

    try {
      const base64Data = await formRenderService.fetchFormImage(template.fileId);
      const img = await formRenderService.loadImage(base64Data);

      setFormImage(img);
      setImageDimensions({ width: img.width, height: img.height });
      setLoading(false);

      // Show info about the image
      const estimatedDPI = formRenderService.estimateImageDPI(img.width, img.height);
      console.log(`Form image: ${img.width}x${img.height}px, estimated DPI: ${estimatedDPI}`);
    } catch (error) {
      console.error('Error loading form image:', error);
      alert('Failed to load form image: ' + error.message);
      setLoading(false);
    }
  };

  const drawCanvas = useCallback(() => {
    if (!canvasRef.current || !formImage) return;

    formRenderService.renderFormToCanvas(
      canvasRef.current,
      formImage,
      mappings,
      sampleData,
      {
        scale,
        showMarkers: true,
        selectedFieldId,
        usePoints: true,
      }
    );
  }, [formImage, mappings, scale, selectedFieldId]);

  const getCanvasCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    return { x, y };
  };

  const findFieldAtPosition = (x, y) => {
    const hitRadius = 20 / scale; // Account for scale

    for (const [fieldId, field] of Object.entries(mappings)) {
      const dx = field.x - x;
      const dy = field.y - y;
      if (Math.sqrt(dx * dx + dy * dy) < hitRadius) {
        return fieldId;
      }
    }
    return null;
  };

  const handleCanvasClick = (e) => {
    const coords = getCanvasCoordinates(e);
    if (!coords) return;

    // Check if clicking on existing field
    const clickedFieldId = findFieldAtPosition(coords.x, coords.y);

    if (clickedFieldId) {
      // Select the field
      setSelectedFieldId(clickedFieldId);
      const field = mappings[clickedFieldId];
      setFontSize(field.fontSize || 12);
      setTextColor(field.color || '#000000');
      if (field.customValue) {
        setSelectedField('custom');
        setCustomValue(field.customValue);
      } else {
        setSelectedField(field.type);
        setCustomValue('');
      }
      setMode('select');
    } else if (mode === 'add') {
      // Add new field at click position
      if (selectedField === 'custom' && !customValue.trim()) {
        alert('Please enter a custom value');
        return;
      }

      const fieldId = 'field_' + Date.now();
      const newMapping = {
        type: selectedField,
        x: coords.x,
        y: coords.y,
        fontSize: fontSize,
        color: textColor,
      };

      if (selectedField === 'custom') {
        newMapping.customValue = customValue.trim();
        setCustomValue('');
      }

      setMappings({ ...mappings, [fieldId]: newMapping });
      setSelectedFieldId(fieldId);
    } else {
      // Deselect in select mode
      setSelectedFieldId(null);
      setMode('add');
    }
  };

  const handleCanvasMouseDown = (e) => {
    const coords = getCanvasCoordinates(e);
    if (!coords) return;

    const fieldId = findFieldAtPosition(coords.x, coords.y);
    if (fieldId) {
      setIsDragging(true);
      setDragFieldId(fieldId);
      setSelectedFieldId(fieldId);
      setMode('select');
    }
  };

  const handleCanvasMouseMove = (e) => {
    if (!isDragging || !dragFieldId) return;

    const coords = getCanvasCoordinates(e);
    if (!coords) return;

    setMappings(prev => ({
      ...prev,
      [dragFieldId]: {
        ...prev[dragFieldId],
        x: Math.max(0, Math.min(coords.x, imageDimensions.width)),
        y: Math.max(0, Math.min(coords.y, imageDimensions.height)),
      },
    }));
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
    setDragFieldId(null);
  };

  const handleCanvasMouseLeave = () => {
    if (isDragging) {
      setIsDragging(false);
      setDragFieldId(null);
    }
  };

  const updateSelectedField = () => {
    if (!selectedFieldId || !mappings[selectedFieldId]) return;

    setMappings(prev => ({
      ...prev,
      [selectedFieldId]: {
        ...prev[selectedFieldId],
        type: selectedField,
        fontSize: fontSize,
        color: textColor,
        customValue: selectedField === 'custom' ? customValue.trim() : undefined,
      },
    }));
  };

  const removeSelectedField = () => {
    if (!selectedFieldId) return;

    const newMappings = { ...mappings };
    delete newMappings[selectedFieldId];
    setMappings(newMappings);
    setSelectedFieldId(null);
    setMode('add');
  };

  const clearAllMappings = () => {
    if (window.confirm('Remove all field mappings?')) {
      setMappings({});
      setSelectedFieldId(null);
      setMode('add');
    }
  };

  const handleSave = () => {
    onSave(formType, mappings);
    onClose();
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  // Calculate displayed dimensions
  const displayWidth = imageDimensions.width * scale;
  const displayHeight = imageDimensions.height * scale;

  // Estimate DPI for info display
  const estimatedDPI = imageDimensions.width > 0
    ? formRenderService.estimateImageDPI(imageDimensions.width, imageDimensions.height)
    : 0;

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Configure Field Mappings" size="large">
      <div className="field-mapping-modal">
        {/* Info Banner */}
        <div className="mapping-info-banner">
          <div className="info-item">
            <span className="info-label">Image Size:</span>
            <span className="info-value">{imageDimensions.width} x {imageDimensions.height}px</span>
          </div>
          <div className="info-item">
            <span className="info-label">Est. DPI:</span>
            <span className="info-value">{estimatedDPI}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Preview Scale:</span>
            <span className="info-value">{Math.round(scale * 100)}%</span>
          </div>
          <div className="info-item">
            <span className="info-label">Fields:</span>
            <span className="info-value">{Object.keys(mappings).length}</span>
          </div>
        </div>

        <div className="field-mapping-content">
          {/* Left Panel: Canvas */}
          <div className="canvas-panel" ref={containerRef}>
            <div className="canvas-header">
              <h4>
                {mode === 'add' ? 'Click to place fields' : 'Click field to edit, drag to move'}
              </h4>
              <div className="canvas-header-buttons">
                <button
                  className={`btn btn-small ${mode === 'add' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => { setMode('add'); setSelectedFieldId(null); }}
                >
                  Add Mode
                </button>
                <button
                  className={`btn btn-small ${mode === 'select' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setMode('select')}
                >
                  Select Mode
                </button>
                <button className="btn btn-small btn-danger" onClick={clearAllMappings}>
                  Clear All
                </button>
              </div>
            </div>

            <div className="canvas-container">
              {loading ? (
                <div className="canvas-loading">
                  <div className="loading-spinner"></div>
                  <p>Loading form image...</p>
                </div>
              ) : formImage ? (
                <canvas
                  ref={canvasRef}
                  width={displayWidth}
                  height={displayHeight}
                  className="mapping-canvas"
                  onClick={handleCanvasClick}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseLeave}
                  style={{
                    cursor: isDragging ? 'grabbing' : (mode === 'add' ? 'crosshair' : 'pointer'),
                  }}
                />
              ) : (
                <div className="canvas-empty">
                  <p>No form image loaded</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Controls */}
          <div className="controls-panel">
            {/* Field Configuration */}
            <div className="field-config">
              <h4>{selectedFieldId ? 'Edit Field' : 'Add New Field'}</h4>

              <div className="form-group">
                <label>Field Type</label>
                <select
                  value={selectedField}
                  onChange={(e) => {
                    setSelectedField(e.target.value);
                    if (e.target.value !== 'custom') setCustomValue('');
                  }}
                >
                  <optgroup label="Basic Customer Information">
                    <option value="name">Customer Name</option>
                    <option value="phone">Phone Number</option>
                    <option value="email">Email</option>
                    <option value="nric">NRIC/FIN</option>
                    <option value="occupation">Occupation</option>
                    <option value="dob">Date of Birth</option>
                    <option value="address">Address</option>
                    <option value="addressContinue">Address Continue</option>
                    <option value="fullAddress">Full Address (Combined)</option>
                    <option value="salesConsultant">Sales Consultant</option>
                    <option value="vsaNo">VSA No</option>
                    <option value="date">Today's Date</option>
                  </optgroup>

                  <optgroup label="VSA - New Car Details">
                    <option value="makeModel">Make &amp; Model</option>
                    <option value="yom">Year of Manufacture</option>
                    <option value="bodyColour">Body Colour</option>
                    <option value="upholstery">Upholstery</option>
                    <option value="przType">P/R/Z Type</option>
                  </optgroup>

                  <optgroup label="VSA - New Car Package">
                    <option value="package">Package</option>
                    <option value="sellingWithCOE">Selling with COE</option>
                    <option value="sellingPriceList">Selling Price List</option>
                    <option value="purchasePriceWithCOE">Purchase Price with COE</option>
                    <option value="coeRebateLevel">COE Rebate Level</option>
                    <option value="deposit">Deposit</option>
                    <option value="lessOthers">Less: Others</option>
                    <option value="addOthers">Add: Others</option>
                    <option value="deliveryDate">Delivery Date</option>
                  </optgroup>

                  <optgroup label="VSA - Trade In Details">
                    <option value="tradeInCarNo">Trade in Car No</option>
                    <option value="tradeInCarModel">Trade in Car Model</option>
                    <option value="tradeInAmount">Trade In Amount</option>
                  </optgroup>

                  <optgroup label="VSA - Delivery Details">
                    <option value="dateOfRegistration">Date of Registration</option>
                    <option value="registrationNo">Registration No</option>
                    <option value="chassisNo">Chassis No</option>
                    <option value="engineNo">Engine No</option>
                    <option value="motorNo">Motor No</option>
                  </optgroup>

                  <optgroup label="VSA - Insurance">
                    <option value="insuranceCompany">Insurance Company</option>
                    <option value="insuranceFee">Insurance Fee</option>
                    <option value="insuranceFeeNet">Net Insurance Fee</option>
                  </optgroup>

                  <optgroup label="VSA - Remarks &amp; Loan">
                    <option value="remarks1">Remarks 1</option>
                    <option value="remarks2">Remarks 2</option>
                    <option value="loanAmount">Loan Amount</option>
                    <option value="interest">Interest</option>
                    <option value="tenure">Tenure</option>
                    <option value="adminFee">Admin Fee</option>
                    <option value="insuranceSubsidy">Insurance Subsidy</option>
                    <option value="monthlyRepayment">Monthly Repayment</option>
                  </optgroup>

                  <optgroup label="Proposal">
                    <option value="proposalModel">Model</option>
                    <option value="proposalBank">Bank</option>
                    <option value="proposalSellingPrice">Selling Price</option>
                    <option value="proposalInterestRate">Interest Rate</option>
                    <option value="proposalDownpayment">Downpayment</option>
                    <option value="proposalLoanTenure">Loan Tenure</option>
                    <option value="proposalLoanAmount">Loan Amount</option>
                    <option value="proposalAdminFee">Admin Fee</option>
                    <option value="proposalReferralFee">Referral Fee</option>
                    <option value="proposalTradeInModel">Trade In Model</option>
                    <option value="proposalLowLoanSurcharge">Low Loan Surcharge</option>
                    <option value="proposalTradeInCarPlate">Trade In Car Plate</option>
                    <option value="proposalNoLoanSurcharge">No Loan Surcharge</option>
                    <option value="proposalQuotedTradeInPrice">Quoted Trade In Price</option>
                    <option value="proposalBenefit1">Benefit 1</option>
                    <option value="proposalBenefit2">Benefit 2</option>
                    <option value="proposalBenefit3">Benefit 3</option>
                    <option value="proposalBenefit4">Benefit 4</option>
                    <option value="proposalBenefit5">Benefit 5</option>
                    <option value="proposalBenefitsGiven">Benefits Given</option>
                    <option value="proposalRemarks">Remarks</option>
                  </optgroup>

                  <optgroup label="Other">
                    <option value="custom">Custom Value</option>
                  </optgroup>
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
                <label>
                  Font Size
                  <span className="size-info">
                    ({formRenderService.pointsToPixels(fontSize)}px at 300 DPI)
                  </span>
                </label>
                <select value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value))}>
                  {FONT_SIZE_PRESETS.map((preset) => (
                    <option key={preset.value} value={preset.value}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Text Color</label>
                <div className="color-input-wrapper">
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                  />
                  <span className="color-value">{textColor}</span>
                </div>
              </div>

              {selectedFieldId ? (
                <div className="selected-field-actions">
                  <button className="btn btn-success" onClick={updateSelectedField}>
                    Update Field
                  </button>
                  <button className="btn btn-danger" onClick={removeSelectedField}>
                    Remove Field
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => { setSelectedFieldId(null); setMode('add'); }}
                  >
                    Deselect
                  </button>
                </div>
              ) : (
                <p className="field-hint">
                  Click on the form image to place this field
                </p>
              )}
            </div>

            {/* Mapped Fields List */}
            <div className="mapped-fields">
              <h4>Mapped Fields ({Object.keys(mappings).length})</h4>
              {Object.keys(mappings).length === 0 ? (
                <p className="no-mappings">
                  No fields mapped yet. Click on the form to add fields.
                </p>
              ) : (
                <div className="mappings-list">
                  {Object.entries(mappings).map(([fieldId, field]) => {
                    const displayText = field.customValue
                      ? `Custom: "${field.customValue.substring(0, 20)}${field.customValue.length > 20 ? '...' : ''}"`
                      : (FIELD_NAMES[field.type] || field.type);

                    const isSelected = fieldId === selectedFieldId;

                    return (
                      <div
                        key={fieldId}
                        className={`mapping-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedFieldId(fieldId);
                          setFontSize(field.fontSize || 12);
                          setTextColor(field.color || '#000000');
                          if (field.customValue) {
                            setSelectedField('custom');
                            setCustomValue(field.customValue);
                          } else {
                            setSelectedField(field.type);
                          }
                          setMode('select');
                        }}
                      >
                        <div className="mapping-info">
                          <strong>{displayText}</strong>
                          <span className="mapping-details">
                            {field.fontSize}pt
                            <span
                              className="color-dot"
                              style={{ backgroundColor: field.color || '#000' }}
                            />
                          </span>
                        </div>
                      </div>
                    );
                  })}
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

export default FieldMappingModal;
