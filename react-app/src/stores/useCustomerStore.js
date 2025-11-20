import { create } from 'zustand';

/**
 * Customer Store
 * Manages customer data, selection, and CRUD operations
 */
const useCustomerStore = create((set, get) => ({
  // State
  customers: [],
  selectedCustomerId: null,
  isLoading: false,
  error: null,

  // Actions
  setCustomers: (customers) => set({ customers }),

  addCustomer: (customer) => set((state) => ({
    customers: [...state.customers, { ...customer, id: Date.now().toString() }]
  })),

  updateCustomer: (id, updates) => set((state) => ({
    customers: state.customers.map((c) =>
      c.id === id ? { ...c, ...updates } : c
    )
  })),

  deleteCustomer: (id) => set((state) => ({
    customers: state.customers.filter((c) => c.id !== id),
    selectedCustomerId: state.selectedCustomerId === id ? null : state.selectedCustomerId
  })),

  selectCustomer: (id) => set({ selectedCustomerId: id }),

  getSelectedCustomer: () => {
    const { customers, selectedCustomerId } = get();
    return customers.find((c) => c.id === selectedCustomerId) || null;
  },

  loadFromLocalStorage: () => {
    try {
      const stored = localStorage.getItem('customers');
      if (stored) {
        set({ customers: JSON.parse(stored) });
      }
    } catch (error) {
      console.error('Failed to load customers from localStorage:', error);
      set({ error: 'Failed to load customer data' });
    }
  },

  saveToLocalStorage: () => {
    try {
      const { customers } = get();
      localStorage.setItem('customers', JSON.stringify(customers));
    } catch (error) {
      console.error('Failed to save customers to localStorage:', error);
      set({ error: 'Failed to save customer data' });
    }
  },

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));

export default useCustomerStore;
