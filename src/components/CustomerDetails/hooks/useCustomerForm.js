import { useState, useEffect, useCallback, useMemo } from 'react';

/**
 * Generic hook for managing customer form state
 * @param {Object} customer - Current customer data
 * @param {Function} extractFormData - Function to extract form fields from customer
 * @param {string} prefix - Prefix for customer fields (e.g., 'vsa_', 'proposal_')
 */
export function useCustomerForm(customer, extractFormData, prefix = '') {
  const [formData, setFormData] = useState({});
  const [originalData, setOriginalData] = useState(null);
  const [errors, setErrors] = useState({});

  // Initialize form data when customer changes
  useEffect(() => {
    if (customer) {
      const data = extractFormData(customer);
      setFormData(data);
      setOriginalData(data);
      setErrors({});
    }
  }, [customer, extractFormData]);

  // Handle field change
  const handleChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  }, [errors]);

  // Check if form has changes
  const hasChanges = useMemo(() => {
    if (!originalData) return false;
    return JSON.stringify(formData) !== JSON.stringify(originalData);
  }, [formData, originalData]);

  // Reset form to original data
  const resetForm = useCallback(() => {
    if (originalData) {
      setFormData(originalData);
      setErrors({});
    }
  }, [originalData]);

  // Build customer update object with prefix
  const buildUpdateObject = useCallback(() => {
    if (!prefix) return formData;

    const update = {};
    Object.entries(formData).forEach(([key, value]) => {
      update[`${prefix}${key}`] = value;
    });
    return update;
  }, [formData, prefix]);

  // Update original data after successful save
  const markAsSaved = useCallback(() => {
    setOriginalData({ ...formData });
  }, [formData]);

  return {
    formData,
    setFormData,
    originalData,
    errors,
    setErrors,
    handleChange,
    hasChanges,
    resetForm,
    buildUpdateObject,
    markAsSaved,
  };
}

/**
 * Hook for managing guarantors
 * @param {Object} customer - Current customer data
 */
export function useGuarantors(customer) {
  const [guarantors, setGuarantors] = useState([]);
  const [originalGuarantors, setOriginalGuarantors] = useState([]);
  const [expandedGuarantors, setExpandedGuarantors] = useState({});

  // Create empty guarantor object
  const createEmptyGuarantor = useCallback(() => ({
    name: '',
    phone: '',
    email: '',
    nric: '',
    occupation: '',
    dob: '',
    address: '',
    addressContinue: '',
  }), []);

  // Initialize guarantors when customer changes
  useEffect(() => {
    if (customer) {
      const loadedGuarantors = customer.guarantors || [];
      setGuarantors(loadedGuarantors);
      setOriginalGuarantors(JSON.parse(JSON.stringify(loadedGuarantors)));
    }
  }, [customer]);

  // Add new guarantor (max 5)
  const addGuarantor = useCallback(() => {
    if (guarantors.length < 5) {
      setGuarantors(prev => [...prev, createEmptyGuarantor()]);
    }
  }, [guarantors.length, createEmptyGuarantor]);

  // Remove guarantor
  const removeGuarantor = useCallback((index) => {
    setGuarantors(prev => prev.filter((_, i) => i !== index));
    setExpandedGuarantors(prev => {
      const newExpanded = { ...prev };
      delete newExpanded[index];
      return newExpanded;
    });
  }, []);

  // Update guarantor field
  const updateGuarantor = useCallback((index, field, value) => {
    setGuarantors(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }, []);

  // Toggle guarantor expanded state
  const toggleExpanded = useCallback((index) => {
    setExpandedGuarantors(prev => ({
      ...prev,
      [index]: !prev[index],
    }));
  }, []);

  // Check if guarantors have changes
  const hasChanges = useMemo(() => {
    return JSON.stringify(guarantors) !== JSON.stringify(originalGuarantors);
  }, [guarantors, originalGuarantors]);

  // Reset guarantors to original
  const resetGuarantors = useCallback(() => {
    setGuarantors(JSON.parse(JSON.stringify(originalGuarantors)));
  }, [originalGuarantors]);

  // Mark as saved
  const markAsSaved = useCallback(() => {
    setOriginalGuarantors(JSON.parse(JSON.stringify(guarantors)));
  }, [guarantors]);

  return {
    guarantors,
    setGuarantors,
    expandedGuarantors,
    addGuarantor,
    removeGuarantor,
    updateGuarantor,
    toggleExpanded,
    hasChanges,
    resetGuarantors,
    markAsSaved,
    canAddMore: guarantors.length < 5,
  };
}

export default useCustomerForm;
