import { useState, useEffect } from 'react';
import './CustomerForm.css';

function CustomerForm({ customer, onSubmit, onCancel, isSubmitting = false }) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    nric: '',
    occupation: '',
    dob: '',
    salesConsultant: '',
    vsaNo: '',
    address: '',
    addressContinue: '',
    notes: '',
  });

  const [errors, setErrors] = useState({});

  // Populate form when editing existing customer
  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.name || '',
        phone: customer.phone || '',
        email: customer.email || '',
        nric: customer.nric || '',
        occupation: customer.occupation || '',
        dob: customer.dob || '',
        salesConsultant: customer.salesConsultant || '',
        vsaNo: customer.vsaNo || '',
        address: customer.address || '',
        addressContinue: customer.addressContinue || '',
        notes: customer.notes || '',
      });
    }
  }, [customer]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Contact number is required';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="customer-form">
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="name">
            Name <span className="required">*</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className={errors.name ? 'error' : ''}
            disabled={isSubmitting}
          />
          {errors.name && <span className="error-message">{errors.name}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="phone">
            Contact Number <span className="required">*</span>
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className={errors.phone ? 'error' : ''}
            disabled={isSubmitting}
          />
          {errors.phone && <span className="error-message">{errors.phone}</span>}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className={errors.email ? 'error' : ''}
            disabled={isSubmitting}
          />
          {errors.email && <span className="error-message">{errors.email}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="nric">NRIC/FIN</label>
          <input
            type="text"
            id="nric"
            name="nric"
            value={formData.nric}
            onChange={handleChange}
            placeholder="S1234567A or F1234567N"
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="occupation">Occupation</label>
          <input
            type="text"
            id="occupation"
            name="occupation"
            value={formData.occupation}
            onChange={handleChange}
            placeholder="e.g., Engineer, Teacher"
            disabled={isSubmitting}
          />
        </div>

        <div className="form-group">
          <label htmlFor="dob">Date of Birth</label>
          <input
            type="date"
            id="dob"
            name="dob"
            value={formData.dob}
            onChange={handleChange}
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="salesConsultant">Sales Consultant</label>
          <input
            type="text"
            id="salesConsultant"
            name="salesConsultant"
            value={formData.salesConsultant}
            onChange={handleChange}
            disabled={isSubmitting}
          />
        </div>

        <div className="form-group">
          <label htmlFor="vsaNo">VSA No</label>
          <input
            type="text"
            id="vsaNo"
            name="vsaNo"
            value={formData.vsaNo}
            onChange={handleChange}
            placeholder="VSA Number"
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="address">Address</label>
          <input
            type="text"
            id="address"
            name="address"
            value={formData.address}
            onChange={handleChange}
            placeholder="e.g., 99 YISHUN AVE 1, 13-39"
            disabled={isSubmitting}
          />
        </div>

        <div className="form-group">
          <label htmlFor="addressContinue">Address Continue</label>
          <input
            type="text"
            id="addressContinue"
            name="addressContinue"
            value={formData.addressContinue}
            onChange={handleChange}
            placeholder="e.g., SINGAPORE 769139"
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="notes">Notes</label>
        <textarea
          id="notes"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows="3"
          disabled={isSubmitting}
        />
      </div>

      <div className="form-actions">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving...' : customer ? 'Update Customer' : 'Add Customer'}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default CustomerForm;
