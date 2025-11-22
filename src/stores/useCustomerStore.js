import { create } from 'zustand';
import driveService from '../services/driveService';

/**
 * Customer Store
 * Manages customer data, selection, and CRUD operations
 *
 * Compatible with vanilla JS app using 'bydCRM' localStorage key
 * Syncs with Google Drive when signed in
 */
const useCustomerStore = create((set, get) => ({
  // State
  customers: [],
  selectedCustomerId: null,
  isLoading: false,
  isSyncing: false,
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

  /**
   * Sync customers from Google Drive to localStorage
   */
  syncFromDrive: async (isSignedIn) => {
    if (!isSignedIn) {
      console.log('Not signed in, skipping Drive sync');
      return;
    }

    try {
      set({ isSyncing: true });
      const { customers } = get();

      // Sync with Drive (merges local and Drive data)
      const syncedCustomers = await driveService.syncCustomers(customers);

      // Update state and localStorage
      set({ customers: syncedCustomers, isSyncing: false });
      localStorage.setItem('bydCRM', JSON.stringify(syncedCustomers));

      console.log('Synced customers from Drive:', syncedCustomers.length);
    } catch (error) {
      console.error('Failed to sync from Drive:', error);
      set({ isSyncing: false, error: 'Failed to sync with Google Drive' });
    }
  },

  /**
   * Save customers to both localStorage and Google Drive
   */
  syncToDrive: async (isSignedIn) => {
    // Always save to localStorage
    get().saveToLocalStorage();

    // If signed in, also save to Drive
    if (!isSignedIn) {
      console.log('Not signed in, saved to localStorage only');
      return;
    }

    try {
      set({ isSyncing: true });
      const { customers } = get();

      await driveService.saveCustomersToDrive(customers);

      set({ isSyncing: false });
      console.log('Synced customers to Drive:', customers.length);
    } catch (error) {
      console.error('Failed to sync to Drive:', error);
      set({ isSyncing: false, error: 'Failed to sync with Google Drive' });
      // Don't throw - data is saved to localStorage anyway
    }
  },

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setSyncing: (isSyncing) => set({ isSyncing }),

  /**
   * Clear all customer data (for sign out or account switching)
   */
  clearAllData: () => {
    console.log('Clearing all customer data');
    set({
      customers: [],
      selectedCustomerId: null,
      isLoading: false,
      isSyncing: false,
      error: null,
    });
    // Clear from localStorage
    localStorage.removeItem('bydCRM');
  },
}));

export default useCustomerStore;
