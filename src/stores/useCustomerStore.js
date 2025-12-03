import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { getStorageService } from '../services/storageServiceSelector';
import userStorage from '../services/userStorage';
import { getDefaultChecklistState } from '../constants/milestones';

/**
 * Customer Store
 * Manages customer data, selection, and CRUD operations
 *
 * Multi-user support: Data is stored per-user using email-based keys
 * Syncs with OneDrive cloud storage when signed in
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
      checklist: getDefaultChecklistState(),
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
   * Add customer and create OneDrive folder structure
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
        const folderInfo = await getStorageService().createCustomerFolderStructure(
          customerName,
          customerId
        );

        driveFolderId = folderInfo.folderId;
        driveFolderLink = folderInfo.folderUrl;
      } catch (error) {
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
      checklist: getDefaultChecklistState(),
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

    // Save to localStorage
    get().saveToLocalStorage();

    // If signed in, save ONLY this new customer to Drive (not all customers!)
    if (isSignedIn && driveFolderId) {
      await get().saveCustomerToFolder(newCustomer, isSignedIn);
    }

    return newCustomer;
  },

  updateCustomer: (id, updates) => {
    set((state) => ({
      customers: state.customers.map((c) => {
        // Handle both string and numeric IDs for compatibility
        const customerId = typeof c.id === 'string' ? parseInt(c.id) : c.id;
        const targetId = typeof id === 'string' ? parseInt(id) : id;

        if (customerId === targetId) {
          // Merge checklist if provided in updates, otherwise keep existing or initialize
          const mergedChecklist = updates.checklist
            ? { ...(c.checklist || getDefaultChecklistState()), ...updates.checklist }
            : (c.checklist || getDefaultChecklistState());

          return {
            ...c,
            ...updates,
            // Preserve vanilla JS fields
            id: c.id,
            dateAdded: c.dateAdded,
            checklist: mergedChecklist,
            dealClosed: updates.dealClosed !== undefined ? updates.dealClosed : (c.dealClosed || false),
            // Preserve folder IDs from updates if provided, otherwise keep existing
            driveFolderId: updates.driveFolderId !== undefined ? updates.driveFolderId : (c.driveFolderId || null),
            driveFolderLink: updates.driveFolderLink !== undefined ? updates.driveFolderLink : (c.driveFolderLink || null),
            // CRITICAL: Always update lastModified to prevent sync from overwriting local changes
            lastModified: new Date().toISOString(),
          };
        }
        return c;
      })
    }));
  },

  /**
   * Update a specific checklist item for a customer
   */
  updateChecklistItem: (customerId, milestoneId, itemId, checked) => {
    set((state) => ({
      customers: state.customers.map((c) => {
        const cId = typeof c.id === 'string' ? parseInt(c.id) : c.id;
        const targetId = typeof customerId === 'string' ? parseInt(customerId) : customerId;

        if (cId === targetId) {
          const checklist = c.checklist || getDefaultChecklistState();
          return {
            ...c,
            checklist: {
              ...checklist,
              [milestoneId]: {
                ...(checklist[milestoneId] || {}),
                [itemId]: checked,
              },
            },
            // Update lastModified to prevent sync from overwriting local changes
            lastModified: new Date().toISOString(),
          };
        }
        return c;
      })
    }));
  },

  /**
   * Set the current milestone stage for a customer
   */
  setCurrentMilestone: (customerId, milestoneId) => {
    set((state) => ({
      customers: state.customers.map((c) => {
        const cId = typeof c.id === 'string' ? parseInt(c.id) : c.id;
        const targetId = typeof customerId === 'string' ? parseInt(customerId) : customerId;

        if (cId === targetId) {
          const checklist = c.checklist || getDefaultChecklistState();
          return {
            ...c,
            checklist: {
              ...checklist,
              currentMilestone: milestoneId,
            },
            // Update lastModified to prevent sync from overwriting local changes
            lastModified: new Date().toISOString(),
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

  /**
   * HYBRID: Delete customer and remove from Drive index
   */
  deleteCustomerHybrid: async (id, isSignedIn) => {
    // Remove from local state
    get().deleteCustomer(id);

    // Save to localStorage
    get().saveToLocalStorage();

    // If signed in, also update the Drive index
    if (isSignedIn) {
      try {
        // Load current index
        const index = await getStorageService().loadCustomersIndex();

        // Remove the deleted customer from index
        const targetId = typeof id === 'string' ? parseInt(id) : id;
        const updatedIndex = index.filter(entry => {
          const entryId = typeof entry.id === 'string' ? parseInt(entry.id) : entry.id;
          return entryId !== targetId;
        });

        // Save updated index
        await getStorageService().saveCustomersIndex(updatedIndex);
      } catch {
        // Don't throw - customer is already deleted locally
      }
    }
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

  /**
   * Load customers from user-specific localStorage
   * Falls back to legacy storage during migration
   */
  loadFromLocalStorage: () => {
    try {
      const userEmail = userStorage.getUserEmail();

      // Try to load from user-specific storage first
      if (userEmail) {
        const customers = userStorage.loadUserData(userEmail, 'customers');
        if (customers && customers.length > 0) {
          set({ customers });
          return;
        }
      }

      // Fall back to legacy storage (for migration)
      const stored = localStorage.getItem('bydCRM');
      if (stored) {
        const customers = JSON.parse(stored);
        set({ customers });
      } else {
        set({ customers: [] });
      }
    } catch {
      set({ error: 'Failed to load customer data', customers: [] });
    }
  },

  /**
   * Save customers to user-specific localStorage
   * Falls back to legacy storage if no user is signed in
   */
  saveToLocalStorage: () => {
    try {
      const { customers } = get();
      const userEmail = userStorage.getUserEmail();

      if (userEmail) {
        // Save to user-specific storage
        userStorage.saveUserData(userEmail, 'customers', customers);
        userStorage.setCurrentDataOwner(userEmail);
      } else {
        // Fall back to legacy storage (offline mode)
        localStorage.setItem('bydCRM', JSON.stringify(customers));
      }
    } catch {
      set({ error: 'Failed to save customer data' });
    }
  },

  /**
   * Sync customers from OneDrive to localStorage (HYBRID)
   */
  syncFromDrive: async (isSignedIn) => {
    // Use hybrid sync method
    return get().syncFromDriveHybrid(isSignedIn);
  },

  /**
   * Save customers to both localStorage and OneDrive (HYBRID)
   */
  syncToDrive: async (isSignedIn) => {
    // Always save to localStorage
    get().saveToLocalStorage();

    // If signed in, also save to Drive using hybrid method
    if (!isSignedIn) {
      return;
    }

    try {
      set({ isSyncing: true });
      const { customers } = get();

      // OPTIMIZATION: Save all customers in parallel instead of sequentially
      const customersWithFolders = customers.filter(c => c.driveFolderId);

      // Save all customer data files in parallel (batched to prevent overwhelming the API)
      const BATCH_SIZE = 10;
      for (let i = 0; i < customersWithFolders.length; i += BATCH_SIZE) {
        const batch = customersWithFolders.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(customer =>
            getStorageService().saveCustomerData(customer, customer.driveFolderId)
          )
        );
      }

      // Build index data after all saves complete
      const indexData = customersWithFolders.map(customer => ({
        id: customer.id,
        name: customer.name,
        vsaNo: customer.vsaNo,
        driveFolderId: customer.driveFolderId,
        driveFolderLink: customer.driveFolderLink,
        lastModified: new Date().toISOString(),
      }));

      // Save the index once
      if (indexData.length > 0) {
        await getStorageService().saveCustomersIndex(indexData);
      }

      set({ isSyncing: false });
    } catch {
      set({ isSyncing: false, error: 'Failed to sync with cloud storage' });
      // Don't throw - data is saved to localStorage anyway
    }
  },

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setSyncing: (isSyncing) => set({ isSyncing }),

  /**
   * Clear all customer data (for sign out or account switching)
   * Clears both user-specific and legacy storage
   */
  clearAllData: () => {
    const userEmail = userStorage.getUserEmail();

    set({
      customers: [],
      selectedCustomerId: null,
      isLoading: false,
      isSyncing: false,
      error: null,
    });

    // Clear from user-specific storage
    if (userEmail) {
      userStorage.clearUserData(userEmail, 'customers');
    }

    // Also clear legacy storage
    localStorage.removeItem('bydCRM');
  },

  /**
   * Repair customer folder references after folder deletion/restoration
   *
   * @param {boolean} isSignedIn - Whether user is signed in to OneDrive
   * @param {boolean} forceRescan - If true, skip validation and always search by name
   */
  repairCustomerFolders: async (isSignedIn, forceRescan = false) => {
    if (!isSignedIn) {
      alert('Please sign in to cloud storage first');
      return null;
    }

    try {
      set({ isSyncing: true, error: null });
      const { customers, syncToDrive } = get();

      // Run repair process
      const { customers: repairedCustomers, results } =
        await getStorageService().repairCustomerFolderReferences(customers, forceRescan);

      // Update state with repaired data
      set({ customers: repairedCustomers });

      // Save to both localStorage and Drive
      await syncToDrive(isSignedIn);

      set({ isSyncing: false });

      return results;
    } catch {
      set({ isSyncing: false, error: 'Failed to repair customer folders' });
      throw new Error('Failed to repair customer folders');
    }
  },

  /**
   * Create missing folders for customers that don't have folder IDs
   */
  createMissingFolders: async (isSignedIn) => {
    if (!isSignedIn) {
      alert('Please sign in to cloud storage first');
      return null;
    }

    try {
      set({ isSyncing: true, error: null });
      const { customers, syncToDrive } = get();

      // Create folders for customers without folder IDs
      const { customers: updatedCustomers, created, errors } =
        await getStorageService().createMissingCustomerFolders(customers);

      // Update state
      set({ customers: updatedCustomers });

      // Save to both localStorage and Drive
      await syncToDrive(isSignedIn);

      set({ isSyncing: false });

      return { created, errors };
    } catch {
      set({ isSyncing: false, error: 'Failed to create missing folders' });
      throw new Error('Failed to create missing folders');
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
      return await getStorageService().checkMigrationNeeded();
    } catch {
      return false;
    }
  },

  /**
   * HYBRID: Migrate to new hybrid structure
   */
  migrateToHybridStructure: async (isSignedIn) => {
    if (!isSignedIn) {
      alert('Please sign in to cloud storage first');
      return null;
    }

    try {
      set({ isSyncing: true, error: null });
      const { customers } = get();

      // Run migration
      const migrationResult = await getStorageService().migrateToHybridStructure(customers);

      if (migrationResult.success) {
        // Update state with migrated customers
        set({ customers: migrationResult.customers });

        // Save to user-specific localStorage
        get().saveToLocalStorage();

        set({ isSyncing: false });

        return migrationResult.results;
      } else {
        throw new Error(migrationResult.error || 'Migration failed');
      }
    } catch {
      set({ isSyncing: false, error: 'Failed to migrate to hybrid structure' });
      throw new Error('Failed to migrate to hybrid structure');
    }
  },

  /**
   * HYBRID: Sync using hybrid approach (index + individual files)
   * OPTIMIZED: Loads only index, lazy-loads full customer data on-demand
   * Automatically migrates to hybrid structure if needed
   * FIXED: Loads from localStorage first to preserve local data during sync
   */
  syncFromDriveHybrid: async (isSignedIn) => {
    if (!isSignedIn) {
      return;
    }

    try {
      set({ isSyncing: true });

      // CRITICAL: Load from localStorage first before syncing
      // This ensures we don't lose locally-modified data when sync runs
      get().loadFromLocalStorage();

      // Check if migration is needed
      const migrationNeeded = await getStorageService().checkMigrationNeeded();

      if (migrationNeeded) {
        // Get customers from localStorage as the source
        const { customers } = get();

        if (customers && customers.length > 0) {
          // Migrate to hybrid structure
          const migrationResult = await getStorageService().migrateToHybridStructure(customers);

          if (migrationResult.success) {
            // Update customers with any folder IDs that were created/updated
            set({ customers: migrationResult.customers });
            get().saveToLocalStorage();
          } else {
            throw new Error('Auto-migration failed');
          }
        } else {
          // No local customers - create empty index
          await getStorageService().saveCustomersIndex([]);
        }
      }

      // Load index from Drive (lightweight, fast)
      const driveIndex = await getStorageService().loadCustomersIndex();

      // If index is empty, we're done
      if (driveIndex.length === 0) {
        set({ customers: [] });
        get().saveToLocalStorage();
        set({ isSyncing: false });
        return;
      }

      // OPTIMIZATION: Merge index with localStorage data
      // This gives us instant display with local data + Drive index metadata
      // FIXED: Properly preserve checklist/milestone data during merge
      const { customers: localCustomers } = get();
      const localMap = new Map(localCustomers.map(c => [c.id, c]));

      const mergedCustomers = driveIndex.map(indexEntry => {
        const localData = localMap.get(indexEntry.id);
        if (localData) {
          // Use local data but update folder metadata from index
          // IMPORTANT: Keep local lastModified so we can compare with Drive later
          // CRITICAL: Preserve checklist/milestone data from local storage
          return {
            ...localData,
            driveFolderId: indexEntry.driveFolderId || localData.driveFolderId,
            driveFolderLink: indexEntry.driveFolderLink || localData.driveFolderLink,
            // Preserve checklist from local data (will be properly merged in loadMissingCustomerData)
            checklist: localData.checklist || getDefaultChecklistState(),
            // Don't overwrite lastModified - keep local value for comparison
          };
        }
        // New customer in Drive, use index data (will load full data immediately)
        // Initialize with default checklist state
        return {
          ...indexEntry,
          checklist: getDefaultChecklistState(),
        };
      });

      // Update state with merged data (for instant display)
      set({ customers: mergedCustomers });
      get().saveToLocalStorage();

      // Load full data for customers that don't have it (AWAITED)
      await get().loadMissingCustomerData(driveIndex);

      set({ isSyncing: false });
    } catch {
      set({ isSyncing: false, error: 'Failed to sync with cloud storage' });
    }
  },

  /**
   * Load missing customer data immediately
   * Loads full customer.json for customers that only have index data
   * OPTIMIZED: Loads all customers in parallel for better performance
   * FIXED: Properly merges checklist/milestone data to prevent data loss
   */
  loadMissingCustomerData: async (indexEntries) => {
    let currentCustomers = get().customers;

    // Identify customers that need full data loading
    const customersToLoad = indexEntries.filter(indexEntry => {
      if (!indexEntry.driveFolderId) return false;

      const customer = currentCustomers.find(c => c.id === indexEntry.id);

      // Check if customer has full data (has more than just index fields)
      // FIX: Must check for BOTH basic details AND VSA/Proposal data
      // Previously used OR conditions, which meant having just phone/email
      // would skip loading VSA/Proposal data from Drive
      const hasBasicDetails = customer && (
        customer.phone || customer.email || customer.nric
      );
      const hasVsaData = customer && (
        customer.vsa_makeModel || customer.vsa_variant || customer.vsa_color
      );
      const hasProposalData = customer && (
        customer.proposal_model || customer.proposal_variant || customer.proposal_color
      );
      // Only consider data "full" if we have basic details AND at least VSA or Proposal data
      // This ensures we always try to load complete data from Drive if VSA/Proposal is missing
      const hasFullData = hasBasicDetails && (hasVsaData || hasProposalData);

      // NEW: Check if Drive has newer data than local
      const driveModified = indexEntry.lastModified ? new Date(indexEntry.lastModified).getTime() : 0;
      const localModified = customer?.lastModified ? new Date(customer.lastModified).getTime() : 0;
      const driveIsNewer = driveModified > localModified;

      if (hasFullData && !driveIsNewer) {
        return false;
      }

      if (hasFullData && driveIsNewer) {
        return true;
      }

      return true;
    });

    if (customersToLoad.length === 0) {
      return;
    }

    // OPTIMIZATION: Load all customers in parallel instead of sequentially
    const loadPromises = customersToLoad.map(async (indexEntry) => {
      try {
        const fullData = await getStorageService().loadCustomerData(
          indexEntry.id,
          indexEntry.driveFolderId
        );

        if (fullData) {
          // Check if folder was not found (needs repair)
          if (fullData._folderNotFound) {
            return { id: indexEntry.id, needsRepair: true, indexEntry };
          }
          // Return both drive data and local data for proper merging
          const localCustomer = currentCustomers.find(c => c.id === indexEntry.id);
          return { id: indexEntry.id, data: fullData, localData: localCustomer };
        } else {
          return null;
        }
      } catch {
        return null;
      }
    });

    // Wait for all customers to load in parallel
    const results = await Promise.all(loadPromises);

    // Separate successful loads from those needing repair
    const customersNeedingRepair = [];

    // Apply all loaded data to customers array with proper merging
    for (const result of results) {
      if (result) {
        if (result.needsRepair) {
          // Mark customer for repair
          customersNeedingRepair.push(result.indexEntry);
        } else if (result.data) {
          currentCustomers = currentCustomers.map(c => {
            if (c.id !== result.id) return c;

            // CRITICAL FIX: Properly merge checklist/milestone data
            // Use drive data as base, but merge checklist from both sources
            const driveChecklist = result.data.checklist || {};
            const localChecklist = result.localData?.checklist || c.checklist || {};

            // Merge checklist - prefer drive data but keep local items that don't exist in drive
            const mergedChecklist = {
              ...localChecklist,
              ...driveChecklist,
              // Ensure currentMilestone is preserved (prefer drive if exists)
              currentMilestone: driveChecklist.currentMilestone || localChecklist.currentMilestone,
            };

            return {
              ...c,
              ...result.data,
              // Preserve folder IDs from local if drive doesn't have them
              driveFolderId: result.data.driveFolderId || c.driveFolderId,
              driveFolderLink: result.data.driveFolderLink || c.driveFolderLink,
              // Use merged checklist
              checklist: mergedChecklist,
              // Preserve dealClosed status
              dealClosed: result.data.dealClosed !== undefined ? result.data.dealClosed : c.dealClosed,
            };
          });
        }
      }
    }

    // Update state once with all loaded data
    set({ customers: currentCustomers });
    get().saveToLocalStorage();

    // Repair customers with missing folders (in background)
    if (customersNeedingRepair.length > 0) {
      console.warn(`Found ${customersNeedingRepair.length} customers with missing folders, triggering repair...`);

      // Find the full customer objects that need repair
      const customersToRepair = currentCustomers.filter(c =>
        customersNeedingRepair.some(entry => entry.id === c.id)
      );

      if (customersToRepair.length > 0) {
        try {
          const repairResult = await getStorageService().repairCustomerFolderReferences(customersToRepair, false);
          if (repairResult.results.repaired > 0) {
            // Update customers with repaired folder IDs
            let updatedCustomers = get().customers;
            for (const repairedCustomer of repairResult.customers) {
              updatedCustomers = updatedCustomers.map(c =>
                c.id === repairedCustomer.id ? { ...c, driveFolderId: repairedCustomer.driveFolderId, driveFolderLink: repairedCustomer.driveFolderLink } : c
              );
            }
            set({ customers: updatedCustomers });
            get().saveToLocalStorage();

            // Update the index with repaired folder IDs
            const index = await getStorageService().loadCustomersIndex();
            const updatedIndex = index.map(entry => {
              const repaired = repairResult.customers.find(c => c.id === entry.id);
              if (repaired && repaired.driveFolderId) {
                return { ...entry, driveFolderId: repaired.driveFolderId, driveFolderLink: repaired.driveFolderLink };
              }
              return entry;
            });
            await getStorageService().saveCustomersIndex(updatedIndex);

            console.log(`Repaired ${repairResult.results.repaired} customer folders`);
          }
        } catch (repairError) {
          console.error('Failed to repair customer folders:', repairError);
        }
      }
    }
  },

  /**
   * HYBRID: Save individual customer to their folder
   */
  saveCustomerToFolder: async (customer, isSignedIn) => {
    if (!isSignedIn || !customer.driveFolderId) {
      return false;
    }

    try {
      // Add lastModified timestamp
      const customerData = {
        ...customer,
        lastModified: new Date().toISOString(),
      };

      // Save to individual customer.json
      await getStorageService().saveCustomerData(customerData, customer.driveFolderId);

      // Update index
      const index = await getStorageService().loadCustomersIndex();
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

      await getStorageService().saveCustomersIndex(index);

      return true;
    } catch {
      return false;
    }
  },

  /**
   * HYBRID: Load full customer data from their folder
   */
  loadCustomerFromFolder: async (customerId, customerFolderId, isSignedIn) => {
    if (!isSignedIn || !customerFolderId) {
      return null;
    }

    try {
      const customerData = await getStorageService().loadCustomerData(customerId, customerFolderId);
      return customerData;
    } catch {
      return null;
    }
  },
}));

// ==========================================
// SELECTORS - Use these for granular subscriptions to prevent unnecessary re-renders
// ==========================================

// Selector for customer list only (use in CustomerList component)
export const useCustomers = () => useCustomerStore((state) => state.customers);

// Selector for selected customer ID only
export const useSelectedCustomerId = () => useCustomerStore((state) => state.selectedCustomerId);

// Selector for selected customer (derived)
export const useSelectedCustomer = () => useCustomerStore((state) => {
  if (!state.selectedCustomerId) return null;
  const targetId = typeof state.selectedCustomerId === 'string'
    ? parseInt(state.selectedCustomerId)
    : state.selectedCustomerId;
  return state.customers.find((c) => {
    const customerId = typeof c.id === 'string' ? parseInt(c.id) : c.id;
    return customerId === targetId;
  }) || null;
});

// Selector for loading/syncing states
export const useCustomerLoadingState = () => useCustomerStore(
  useShallow((state) => ({
    isLoading: state.isLoading,
    isSyncing: state.isSyncing,
    error: state.error,
  }))
);

// Selector for actions only (stable reference - actions don't change)
export const useCustomerActions = () => useCustomerStore(
  useShallow((state) => ({
    addCustomer: state.addCustomer,
    addCustomerWithFolder: state.addCustomerWithFolder,
    updateCustomer: state.updateCustomer,
    updateChecklistItem: state.updateChecklistItem,
    setCurrentMilestone: state.setCurrentMilestone,
    deleteCustomer: state.deleteCustomer,
    deleteCustomerHybrid: state.deleteCustomerHybrid,
    selectCustomer: state.selectCustomer,
    loadFromLocalStorage: state.loadFromLocalStorage,
    saveToLocalStorage: state.saveToLocalStorage,
    syncFromDrive: state.syncFromDrive,
    syncToDrive: state.syncToDrive,
    saveCustomerToFolder: state.saveCustomerToFolder,
    repairCustomerFolders: state.repairCustomerFolders,
    createMissingFolders: state.createMissingFolders,
  }))
);

// Selector for customer by ID (use when you need a specific customer)
export const useCustomerById = (id) => useCustomerStore((state) => {
  if (!id) return null;
  const targetId = typeof id === 'string' ? parseInt(id) : id;
  return state.customers.find((c) => {
    const customerId = typeof c.id === 'string' ? parseInt(c.id) : c.id;
    return customerId === targetId;
  }) || null;
});

export default useCustomerStore;
