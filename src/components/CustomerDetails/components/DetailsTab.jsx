import { memo, useCallback, useMemo } from 'react';

/**
 * DetailsTab - Customer contact and personal information form
 */
function DetailsTab({
  formData,
  errors,
  guarantors,
  expandedGuarantors,
  hasChanges,
  hasGuarantorChanges,
  onFieldChange,
  onGuarantorChange,
  onAddGuarantor,
  onRemoveGuarantor,
  onToggleGuarantor,
  onSave,
  onCancel,
  canAddMoreGuarantors,
}) {
  // Memoized change handler
  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    onFieldChange(name, value);
  }, [onFieldChange]);

  const totalChanges = hasChanges || hasGuarantorChanges;

  return (
    <div className="tab-content details-tab">
      {/* Contact Information Section */}
      <div className="form-section">
        <h3 className="section-title">Contact Information</h3>
        <div className="form-grid">
          <div className="form-group">
            <label>Full Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className={errors.name ? 'error' : ''}
              placeholder="Enter customer name"
            />
            {errors.name && <span className="error-message">{errors.name}</span>}
          </div>

          <div className="form-group">
            <label>Phone Number</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              placeholder="Enter phone number"
            />
          </div>

          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="Enter email address"
            />
          </div>

          <div className="form-group">
            <label>NRIC/FIN</label>
            <input
              type="text"
              name="nric"
              value={formData.nric}
              onChange={handleInputChange}
              placeholder="Enter NRIC/FIN"
            />
          </div>
        </div>
      </div>

      {/* Additional Information Section */}
      <div className="form-section">
        <h3 className="section-title">Additional Information</h3>
        <div className="form-grid">
          <div className="form-group">
            <label>Occupation</label>
            <input
              type="text"
              name="occupation"
              value={formData.occupation}
              onChange={handleInputChange}
              placeholder="Enter occupation"
            />
          </div>

          <div className="form-group">
            <label>Date of Birth</label>
            <input
              type="date"
              name="dob"
              value={formData.dob}
              onChange={handleInputChange}
            />
          </div>

          <div className="form-group">
            <label>Sales Consultant</label>
            <input
              type="text"
              name="salesConsultant"
              value={formData.salesConsultant}
              onChange={handleInputChange}
              placeholder="Enter sales consultant name"
            />
          </div>

          <div className="form-group">
            <label>VSA No</label>
            <input
              type="text"
              name="vsaNo"
              value={formData.vsaNo}
              onChange={handleInputChange}
              placeholder="Enter VSA number"
            />
          </div>
        </div>
      </div>

      {/* Address Section */}
      <div className="form-section">
        <h3 className="section-title">Address</h3>
        <div className="form-grid full-width">
          <div className="form-group">
            <label>Address</label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              placeholder="Enter street address"
            />
          </div>

          <div className="form-group">
            <label>Address (continued)</label>
            <input
              type="text"
              name="addressContinue"
              value={formData.addressContinue}
              onChange={handleInputChange}
              placeholder="Unit/Block number, postal code"
            />
          </div>
        </div>
      </div>

      {/* Notes Section */}
      <div className="form-section">
        <h3 className="section-title">Notes</h3>
        <div className="form-group full-width">
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleInputChange}
            rows={4}
            placeholder="Add any additional notes..."
          />
        </div>
      </div>

      {/* Guarantors Section */}
      <GuarantorsSection
        guarantors={guarantors}
        expandedGuarantors={expandedGuarantors}
        onGuarantorChange={onGuarantorChange}
        onAddGuarantor={onAddGuarantor}
        onRemoveGuarantor={onRemoveGuarantor}
        onToggleGuarantor={onToggleGuarantor}
        canAddMore={canAddMoreGuarantors}
      />

      {/* Action Buttons */}
      {totalChanges && (
        <div className="form-actions">
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={onSave}>
            Save Changes
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * GuarantorsSection - Expandable list of guarantors (max 5)
 */
const GuarantorsSection = memo(function GuarantorsSection({
  guarantors,
  expandedGuarantors,
  onGuarantorChange,
  onAddGuarantor,
  onRemoveGuarantor,
  onToggleGuarantor,
  canAddMore,
}) {
  return (
    <div className="form-section guarantors-section">
      <div className="section-header">
        <h3 className="section-title">Guarantors ({guarantors.length}/5)</h3>
        {canAddMore && (
          <button
            type="button"
            className="btn btn-small btn-secondary"
            onClick={onAddGuarantor}
          >
            + Add Guarantor
          </button>
        )}
      </div>

      {guarantors.length === 0 ? (
        <p className="empty-message">No guarantors added yet.</p>
      ) : (
        <div className="guarantors-list">
          {guarantors.map((guarantor, index) => (
            <GuarantorCard
              key={index}
              index={index}
              guarantor={guarantor}
              isExpanded={expandedGuarantors[index]}
              onToggle={() => onToggleGuarantor(index)}
              onChange={(field, value) => onGuarantorChange(index, field, value)}
              onRemove={() => onRemoveGuarantor(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
});

/**
 * GuarantorCard - Individual guarantor form card
 */
const GuarantorCard = memo(function GuarantorCard({
  index,
  guarantor,
  isExpanded,
  onToggle,
  onChange,
  onRemove,
}) {
  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    onChange(name, value);
  }, [onChange]);

  return (
    <div className={`guarantor-card ${isExpanded ? 'expanded' : ''}`}>
      <div className="guarantor-header" onClick={onToggle}>
        <div className="guarantor-title">
          <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
          <span className="guarantor-name">
            {guarantor.name || `Guarantor ${index + 1}`}
          </span>
        </div>
        <button
          type="button"
          className="btn btn-small btn-danger"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          Remove
        </button>
      </div>

      {isExpanded && (
        <div className="guarantor-form">
          <div className="form-grid">
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                name="name"
                value={guarantor.name || ''}
                onChange={handleInputChange}
                placeholder="Enter guarantor name"
              />
            </div>

            <div className="form-group">
              <label>Phone</label>
              <input
                type="tel"
                name="phone"
                value={guarantor.phone || ''}
                onChange={handleInputChange}
                placeholder="Enter phone number"
              />
            </div>

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                name="email"
                value={guarantor.email || ''}
                onChange={handleInputChange}
                placeholder="Enter email"
              />
            </div>

            <div className="form-group">
              <label>NRIC/FIN</label>
              <input
                type="text"
                name="nric"
                value={guarantor.nric || ''}
                onChange={handleInputChange}
                placeholder="Enter NRIC/FIN"
              />
            </div>

            <div className="form-group">
              <label>Occupation</label>
              <input
                type="text"
                name="occupation"
                value={guarantor.occupation || ''}
                onChange={handleInputChange}
                placeholder="Enter occupation"
              />
            </div>

            <div className="form-group">
              <label>Date of Birth</label>
              <input
                type="date"
                name="dob"
                value={guarantor.dob || ''}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group full-width">
              <label>Address</label>
              <input
                type="text"
                name="address"
                value={guarantor.address || ''}
                onChange={handleInputChange}
                placeholder="Enter address"
              />
            </div>

            <div className="form-group full-width">
              <label>Address (continued)</label>
              <input
                type="text"
                name="addressContinue"
                value={guarantor.addressContinue || ''}
                onChange={handleInputChange}
                placeholder="Unit/Block number, postal code"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default memo(DetailsTab);
