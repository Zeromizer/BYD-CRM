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

  /**
   * Add customer and create Google Drive folder structure
   * SIMPLIFIED: Create folder FIRST, then add customer WITH folder IDs
   */
  addCustomerWithFolder: async (customerData, isSignedIn) => {
    const { syncToDrive } = get();

    // Generate ID upfront
    const customerId = Date.now();
    const customerName = customerData.name || 'Unnamed Customer';

    // If signed in, create the folder structure FIRST
    let driveFolderId = null;
    let driveFolderLink = null;

    if (isSignedIn) {
      try {
        console.log(`[Folder Creation] Creating folder for: ${customerName} (ID: ${customerId})`);

        const folderInfo = await driveService.createCustomerFolderStructure(
          customerName,
          customerId
        );

        driveFolderId = folderInfo.folderId;
        driveFolderLink = folderInfo.folderUrl;

        console.log(`[Folder Creation] Success! Folder ID: ${driveFolderId}`);
      } catch (error) {
        console.error('[Folder Creation] FAILED:', error);
        alert(`Folder creation failed: ${error.message}\nCustomer will be created without folder.`);
      }
    }

    // Now create the customer WITH the folder IDs already included
    const newCustomer = {
      id: customerId,
      name: customerName,
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
      driveFolderId,
      driveFolderLink,
      // Preserve any additional fields
      ...customerData,
      // Ensure these critical fields aren't overwritten
      id: customerId,
      dateAdded: new Date().toISOString(),
    };

    // Add to store
    set((state) => ({
      customers: [...state.customers, newCustomer]
    }));

    // Save to localStorage and Drive immediately
    await syncToDrive(isSignedIn);

    console.log('[Customer Created] With folder IDs:', { driveFolderId, driveFolderLink });

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
            // Preserve folder IDs from updates if provided, otherwise keep existing
            driveFolderId: updates.driveFolderId !== undefined ? updates.driveFolderId : (c.driveFolderId || null),
            driveFolderLink: updates.driveFolderLink !== undefined ? updates.driveFolderLink : (c.driveFolderLink || null),
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
   * Sync customers from Google Drive to localStorage (HYBRID)
   */
  syncFromDrive: async (isSignedIn) => {
    // Use hybrid sync method
    return get().syncFromDriveHybrid(isSignedIn);
  },

  /**
   * Save customers to both localStorage and Google Drive (HYBRID)
   */
  syncToDrive: async (isSignedIn) => {
    // Always save to localStorage
    get().saveToLocalStorage();

    // If signed in, also save to Drive using hybrid method
    if (!isSignedIn) {
      console.log('Not signed in, saved to localStorage only');
      return;
    }

    try {
      set({ isSyncing: true });
      const { customers } = get();

      // Save each customer to their individual folder + update index
      const indexData = [];
      for (const customer of customers) {
        if (customer.driveFolderId) {
          // Save individual customer.json
          await driveService.saveCustomerData(customer, customer.driveFolderId);

          // Build index entry
          indexData.push({
            id: customer.id,
            name: customer.name,
            vsaNo: customer.vsaNo,
            driveFolderId: customer.driveFolderId,
            driveFolderLink: customer.driveFolderLink,
            lastModified: new Date().toISOString(),
          });
        }
      }

      // Save the index
      if (indexData.length > 0) {
        await driveService.saveCustomersIndex(indexData);
      }

      set({ isSyncing: false });
      console.log('Synced customers to Drive (hybrid):', customers.length);
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

  /**
   * Repair customer folder references after folder deletion/restoration
   *
   * @param {boolean} isSignedIn - Whether user is signed in to Google Drive
   * @param {boolean} forceRescan - If true, skip validation and always search by name
   */
  repairCustomerFolders: async (isSignedIn, forceRescan = false) => {
    if (!isSignedIn) {
      console.error('Must be signed in to repair folder references');
      alert('Please sign in to Google Drive first');
      return null;
    }

    try {
      set({ isSyncing: true, error: null });
      const { customers, syncToDrive } = get();

      console.log('Starting folder repair for', customers.length, 'customers');

      // Run repair process
      const { customers: repairedCustomers, results } =
        await driveService.repairCustomerFolderReferences(customers, forceRescan);

      // Update state with repaired data
      set({ customers: repairedCustomers });

      // Save to both localStorage and Drive
      await syncToDrive(isSignedIn);

      set({ isSyncing: false });

      return results;
    } catch (error) {
      console.error('Failed to repair customer folders:', error);
      set({ isSyncing: false, error: 'Failed to repair customer folders' });
      throw error;
    }
  },

  /**
   * Create missing folders for customers that don't have folder IDs
   */
  createMissingFolders: async (isSignedIn) => {
    if (!isSignedIn) {
      console.error('Must be signed in to create folders');
      alert('Please sign in to Google Drive first');
      return null;
    }

    try {
      set({ isSyncing: true, error: null });
      const { customers, syncToDrive } = get();

      console.log('Creating missing folders...');

      // Create folders for customers without folder IDs
      const { customers: updatedCustomers, created, errors } =
        await driveService.createMissingCustomerFolders(customers);

      // Update state
      set({ customers: updatedCustomers });

      // Save to both localStorage and Drive
      await syncToDrive(isSignedIn);

      set({ isSyncing: false });

      return { created, errors };
    } catch (error) {
      console.error('Failed to create missing folders:', error);
      set({ isSyncing: false, error: 'Failed to create missing folders' });
      throw error;
    }
  },

  /**
   * HYBRID: Check if migration to hybrid structure is needed
   */
  checkMigrationNeeded: async (isSignedIn) => {
    if (!isSignedIn) {
      return false;
    }

    try {
      return await driveService.checkMigrationNeeded();
    } catch (error) {
      console.error('Failed to check migration status:', error);
      return false;
    }
  },

  /**
   * HYBRID: Migrate to new hybrid structure
   */
  migrateToHybridStructure: async (isSignedIn) => {
    if (!isSignedIn) {
      console.error('Must be signed in to migrate');
      alert('Please sign in to Google Drive first');
      return null;
    }

    try {
      set({ isSyncing: true, error: null });
      const { customers } = get();

      console.log('Starting migration to hybrid structure...');

      // Run migration
      const migrationResult = await driveService.migrateToHybridStructure(customers);

      if (migrationResult.success) {
        // Update state with migrated customers
        set({ customers: migrationResult.customers });

        // Save to localStorage
        localStorage.setItem('bydCRM', JSON.stringify(migrationResult.customers));

        set({ isSyncing: false });

        return migrationResult.results;
      } else {
        throw new Error(migrationResult.error || 'Migration failed');
      }
    } catch (error) {
      console.error('Failed to migrate:', error);
      set({ isSyncing: false, error: 'Failed to migrate to hybrid structure' });
      throw error;
    }
  },

  /**
   * HYBRID: Sync using hybrid approach (index + individual files)
   * Loads index first, then loads full customer data from individual files
   * Automatically migrates to hybrid structure if needed
   */
  syncFromDriveHybrid: async (isSignedIn) => {
    if (!isSignedIn) {
      console.log('Not signed in, skipping hybrid sync');
      return;
    }

    try {
      set({ isSyncing: true });

      // Check if migration is needed
      const migrationNeeded = await driveService.checkMigrationNeeded();

      if (migrationNeeded) {
        console.log('🚀 Hybrid structure not found - auto-migrating...');

        // Get customers from localStorage as the source
        const { customers } = get();

        if (customers && customers.length > 0) {
          // Migrate to hybrid structure
          const migrationResult = await driveService.migrateToHybridStructure(customers);

          if (migrationResult.success) {
            console.log('✅ Auto-migration successful!');
            // Update customers with any folder IDs that were created/updated
            set({ customers: migrationResult.customers });
            localStorage.setItem('bydCRM', JSON.stringify(migrationResult.customers));
          } else {
            console.error('❌ Auto-migration failed:', migrationResult.error);
            throw new Error('Auto-migration failed');
          }
        } else {
          // No local customers - create empty index
          console.log('No local customers found - creating empty index');
          await driveService.saveCustomersIndex([]);
        }
      }

      // Load index from Drive
      const driveIndex = await driveService.loadCustomersIndex();
      console.log(`Loaded index with ${driveIndex.length} customers`);

      // If index is empty, we're done
      if (driveIndex.length === 0) {
        set({ customers: [], isSyncing: false });
        localStorage.setItem('bydCRM', JSON.stringify([]));
        console.log('No customers in index');
        return;
      }

      // Load full data for each customer
      const fullCustomers = [];
      for (const indexEntry of driveIndex) {
        if (indexEntry.driveFolderId) {
          try {
            // Try to load full customer data from their folder
            const customerData = await driveService.loadCustomerData(
              indexEntry.id,
              indexEntry.driveFolderId
            );

            if (customerData) {
              fullCustomers.push(customerData);
            } else {
              // If customer.json doesn't exist, use index data
              console.warn(`No customer.json found for ${indexEntry.name}, using index data`);
              fullCustomers.push(indexEntry);
            }
          } catch (error) {
            console.error(`Failed to load customer ${indexEntry.name}:`, error);
            // Use index data as fallback
            fullCustomers.push(indexEntry);
          }
        } else {
          // No folder ID, use index data
          fullCustomers.push(indexEntry);
        }
      }

      // Update state and localStorage
      set({ customers: fullCustomers, isSyncing: false });
      localStorage.setItem('bydCRM', JSON.stringify(fullCustomers));

      console.log('Synced customers from Drive (hybrid):', fullCustomers.length);
    } catch (error) {
      console.error('Failed to sync from Drive (hybrid):', error);
      set({ isSyncing: false, error: 'Failed to sync with Google Drive' });
    }
  },

  /**
   * HYBRID: Save individual customer to their folder
   */
  saveCustomerToFolder: async (customer, isSignedIn) => {
    if (!isSignedIn || !customer.driveFolderId) {
      console.log('Cannot save to folder: not signed in or no folder ID');
      return false;
    }

    try {
      // Add lastModified timestamp
      const customerData = {
        ...customer,
        lastModified: new Date().toISOString(),
      };

      // Save to individual customer.json
      await driveService.saveCustomerData(customerData, customer.driveFolderId);

      // Update index
      const index = await driveService.loadCustomersIndex();
      const indexEntry = {
        id: customer.id,
        name: customer.name,
        vsaNo: customer.vsaNo,
        driveFolderId: customer.driveFolderId,
        driveFolderLink: customer.driveFolderLink,
        lastModified: customerData.lastModified,
      };

      // Update or add to index
      const existingIndex = index.findIndex(e => e.id === customer.id);
      if (existingIndex >= 0) {
        index[existingIndex] = indexEntry;
      } else {
        index.push(indexEntry);
      }

      await driveService.saveCustomersIndex(index);

      console.log(`Saved customer ${customer.name} to folder (hybrid)`);
      return true;
    } catch (error) {
      console.error('Failed to save customer to folder:', error);
      return false;
    }
  },

  /**
   * HYBRID: Load full customer data from their folder
   */
  loadCustomerFromFolder: async (customerId, customerFolderId, isSignedIn) => {
    if (!isSignedIn || !customerFolderId) {
      console.log('Cannot load from folder: not signed in or no folder ID');
      return null;
    }

    try {
      const customerData = await driveService.loadCustomerData(customerId, customerFolderId);
      console.log(`Loaded customer ${customerId} from folder (hybrid)`);
      return customerData;
    } catch (error) {
      console.error('Failed to load customer from folder:', error);
      return null;
    }
  },
}));

export default useCustomerStore;
