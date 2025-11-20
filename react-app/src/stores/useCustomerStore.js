import { create } from 'zustand';

/**
 * Customer Store
 * Manages customer data, selection, and CRUD operations
 *
 * Compatible with vanilla JS app using 'bydCRM' localStorage key
 */
const useCustomerStore = create((set, get) => ({
  // State
  customers: [],
  selectedCustomerId: null,
  isLoading: false,
  error: null,

  // Actions
  setCustomers: (customers) => set({ customers }),

  addCustomer: (customerData) => {
    const newCustomer = {
      id: Date.now(), // Use numeric ID to match vanilla JS
      name: customerData.name || '',
      phone: customerData.phone || '',
      email: customerData.email || '',
      nric: customerData.nric || '',
      occupation: customerData.occupation || '',
      dob: customerData.dob || '',
      salesConsultant: customerData.salesConsultant || '',
      vsaNo: customerData.vsaNo || '',
      address: customerData.address || '',
      addressContinue: customerData.addressContinue || '',
      notes: customerData.notes || '',
      dateAdded: new Date().toISOString(),
      checklist: {},
      dealClosed: false,
      driveFolderId: null,
      driveFolderLink: null,
      // Preserve any additional fields from vanilla JS
      ...customerData,
    };

    set((state) => ({
      customers: [...state.customers, newCustomer]
    }));

    return newCustomer;
  },

  updateCustomer: (id, updates) => {
    set((state) => ({
      customers: state.customers.map((c) => {
        // Handle both string and numeric IDs for compatibility
        const customerId = typeof c.id === 'string' ? parseInt(c.id) : c.id;
        const targetId = typeof id === 'string' ? parseInt(id) : id;

        if (customerId === targetId) {
          return {
            ...c,
            ...updates,
            // Preserve vanilla JS fields
            id: c.id,
            dateAdded: c.dateAdded,
            checklist: c.checklist || {},
            dealClosed: c.dealClosed || false,
            driveFolderId: c.driveFolderId || null,
            driveFolderLink: c.driveFolderLink || null,
          };
        }
        return c;
      })
    }));
  },

  deleteCustomer: (id) => {
    set((state) => {
      // Handle both string and numeric IDs
      const targetId = typeof id === 'string' ? parseInt(id) : id;
      const selectedId = typeof state.selectedCustomerId === 'string'
        ? parseInt(state.selectedCustomerId)
        : state.selectedCustomerId;

      return {
        customers: state.customers.filter((c) => {
          const customerId = typeof c.id === 'string' ? parseInt(c.id) : c.id;
          return customerId !== targetId;
        }),
        selectedCustomerId: selectedId === targetId ? null : state.selectedCustomerId
      };
    });
  },

  selectCustomer: (id) => set({ selectedCustomerId: id }),

  getSelectedCustomer: () => {
    const { customers, selectedCustomerId } = get();
    if (!selectedCustomerId) return null;

    // Handle both string and numeric IDs
    const targetId = typeof selectedCustomerId === 'string'
      ? parseInt(selectedCustomerId)
      : selectedCustomerId;

    return customers.find((c) => {
      const customerId = typeof c.id === 'string' ? parseInt(c.id) : c.id;
      return customerId === targetId;
    }) || null;
  },

  loadFromLocalStorage: () => {
    try {
      // Use 'bydCRM' key to match vanilla JS app
      const stored = localStorage.getItem('bydCRM');
      if (stored) {
        const customers = JSON.parse(stored);
        console.log('Loaded customers from localStorage:', customers.length);
        set({ customers });
      } else {
        console.log('No customer data found in localStorage');
        set({ customers: [] });
      }
    } catch (error) {
      console.error('Failed to load customers from localStorage:', error);
      set({ error: 'Failed to load customer data', customers: [] });
    }
  },

  saveToLocalStorage: () => {
    try {
      const { customers } = get();
      // Use 'bydCRM' key to match vanilla JS app
      localStorage.setItem('bydCRM', JSON.stringify(customers));
      console.log('Saved customers to localStorage:', customers.length);
    } catch (error) {
      console.error('Failed to save customers to localStorage:', error);
      set({ error: 'Failed to save customer data' });
    }
  },

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));

export default useCustomerStore;
