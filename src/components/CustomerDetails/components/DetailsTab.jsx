import { memo, useCallback } from 'react';
import DateInput from './DateInput';

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
  isSubmitting,
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
    <>
      {/* Contact Information Section */}
      <div className="info-section">
        <h3>Contact Information</h3>
        <div className="inline-edit-grid">
          <div className="inline-edit-item">
            <label htmlFor="name">Name <span className="required">*</span></label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name || ''}
              onChange={handleInputChange}
              className={errors.name ? 'error' : ''}
              disabled={isSubmitting}
            />
            {errors.name && <span className="error-message">{errors.name}</span>}
          </div>
          <div className="inline-edit-item">
            <label htmlFor="phone">Phone <span className="required">*</span></label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone || ''}
              onChange={handleInputChange}
              className={errors.phone ? 'error' : ''}
              disabled={isSubmitting}
            />
            {errors.phone && <span className="error-message">{errors.phone}</span>}
          </div>
          <div className="inline-edit-item">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email || ''}
              onChange={handleInputChange}
              className={errors.email ? 'error' : ''}
              disabled={isSubmitting}
            />
            {errors.email && <span className="error-message">{errors.email}</span>}
          </div>
          <div className="inline-edit-item">
            <label htmlFor="nric">NRIC/FIN</label>
            <input
              type="text"
              id="nric"
              name="nric"
              value={formData.nric || ''}
              onChange={handleInputChange}
              placeholder="S1234567A or F1234567N"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="dob">Date of Birth</label>
            <DateInput
              id="dob"
              name="dob"
              value={formData.dob || ''}
              onChange={handleInputChange}
              disabled={isSubmitting}
            />
          </div>
        </div>
      </div>

      {/* Additional Information Section */}
      <div className="info-section">
        <h3>Additional Information</h3>
        <div className="inline-edit-grid">
          <div className="inline-edit-item">
            <label htmlFor="occupation">Occupation</label>
            <input
              type="text"
              id="occupation"
              name="occupation"
              value={formData.occupation || ''}
              onChange={handleInputChange}
              placeholder="e.g., Engineer, Teacher"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="salesConsultant">Sales Consultant</label>
            <input
              type="text"
              id="salesConsultant"
              name="salesConsultant"
              value={formData.salesConsultant || ''}
              onChange={handleInputChange}
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="vsaNo">VSA No</label>
            <input
              type="text"
              id="vsaNo"
              name="vsaNo"
              value={formData.vsaNo || ''}
              onChange={handleInputChange}
              placeholder="VSA Number"
              disabled={isSubmitting}
            />
          </div>
        </div>
      </div>

      {/* Address Section */}
      <div className="info-section">
        <h3>Address</h3>
        <div className="inline-edit-grid">
          <div className="inline-edit-item">
            <label htmlFor="address">Address</label>
            <input
              type="text"
              id="address"
              name="address"
              value={formData.address || ''}
              onChange={handleInputChange}
              placeholder="e.g., 99 YISHUN AVE 1, 13-39"
              disabled={isSubmitting}
            />
          </div>
          <div className="inline-edit-item">
            <label htmlFor="addressContinue">Address Continue</label>
            <input
              type="text"
              id="addressContinue"
              name="addressContinue"
              value={formData.addressContinue || ''}
              onChange={handleInputChange}
              placeholder="e.g., SINGAPORE 769139"
              disabled={isSubmitting}
            />
          </div>
        </div>
      </div>

      {/* Notes Section */}
      <div className="info-section">
        <h3>Notes</h3>
        <div className="inline-edit-full">
          <textarea
            id="notes"
            name="notes"
            value={formData.notes || ''}
            onChange={handleInputChange}
            rows="3"
            disabled={isSubmitting}
            placeholder="Add notes about this customer..."
          />
        </div>
      </div>

      {/* Guarantors Section */}
      <div className="info-section">
        <div className="section-header-with-action">
          <h3>Guarantors ({guarantors.length}/5)</h3>
          {canAddMoreGuarantors && (
            <button
              type="button"
              className="btn btn-add-small"
              onClick={onAddGuarantor}
              disabled={isSubmitting}
            >
              + Add Guarantor
            </button>
          )}
        </div>

        {guarantors.length > 0 && (
          <div className="guarantors-list">
            {guarantors.map((guarantor, index) => (
              <div key={index} className="guarantor-card">
                <div
                  className="guarantor-header"
                  onClick={() => onToggleGuarantor(index)}
                >
                  <div className="guarantor-header-left">
                    <span className={`expand-icon ${expandedGuarantors[index] ? 'expanded' : ''}`}>▶</span>
                    <span className="guarantor-title">
                      Guarantor {index + 1}{guarantor.name ? `: ${guarantor.name}` : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn-remove-guarantor"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveGuarantor(index);
                    }}
                    disabled={isSubmitting}
                  >
                    ✕
                  </button>
                </div>

                {expandedGuarantors[index] && (
                  <div className="guarantor-content">
                    <div className="inline-edit-grid">
                      <div className="inline-edit-item">
                        <label>Name</label>
                        <input
                          type="text"
                          value={guarantor.name || ''}
                          onChange={(e) => onGuarantorChange(index, 'name', e.target.value)}
                          placeholder="Full name"
                          disabled={isSubmitting}
                        />
                      </div>
                      <div className="inline-edit-item">
                        <label>Contact Number</label>
                        <input
                          type="text"
                          value={guarantor.phone || ''}
                          onChange={(e) => onGuarantorChange(index, 'phone', e.target.value)}
                          placeholder="e.g., 91234567"
                          disabled={isSubmitting}
                        />
                      </div>
                      <div className="inline-edit-item">
                        <label>Email</label>
                        <input
                          type="email"
                          value={guarantor.email || ''}
                          onChange={(e) => onGuarantorChange(index, 'email', e.target.value)}
                          placeholder="email@example.com"
                          disabled={isSubmitting}
                        />
                      </div>
                      <div className="inline-edit-item">
                        <label>NRIC/FIN</label>
                        <input
                          type="text"
                          value={guarantor.nric || ''}
                          onChange={(e) => onGuarantorChange(index, 'nric', e.target.value)}
                          placeholder="S1234567A"
                          disabled={isSubmitting}
                        />
                      </div>
                      <div className="inline-edit-item">
                        <label>Occupation</label>
                        <input
                          type="text"
                          value={guarantor.occupation || ''}
                          onChange={(e) => onGuarantorChange(index, 'occupation', e.target.value)}
                          placeholder="e.g., Engineer"
                          disabled={isSubmitting}
                        />
                      </div>
                      <div className="inline-edit-item">
                        <label>Date of Birth</label>
                        <DateInput
                          id={`guarantor-dob-${index}`}
                          name="dob"
                          value={guarantor.dob || ''}
                          onChange={(e) => onGuarantorChange(index, 'dob', e.target.value)}
                          disabled={isSubmitting}
                        />
                      </div>
                      <div className="inline-edit-item">
                        <label>Address</label>
                        <input
                          type="text"
                          value={guarantor.address || ''}
                          onChange={(e) => onGuarantorChange(index, 'address', e.target.value)}
                          placeholder="Street address"
                          disabled={isSubmitting}
                        />
                      </div>
                      <div className="inline-edit-item">
                        <label>Address Continue</label>
                        <input
                          type="text"
                          value={guarantor.addressContinue || ''}
                          onChange={(e) => onGuarantorChange(index, 'addressContinue', e.target.value)}
                          placeholder="e.g., SINGAPORE 123456"
                          disabled={isSubmitting}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="details-actions">
        <div className="details-actions-right">
          {totalChanges && (
            <button
              className="btn btn-secondary"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={onSave}
            disabled={isSubmitting || !totalChanges}
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  );
}

export default memo(DetailsTab);
