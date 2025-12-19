import { useState, useEffect, useRef } from 'react';
import { Plus, Archive, Users } from 'lucide-react';
import useCustomerStore from '../../stores/useCustomerStore';
import useAuthStore from '../../stores/useAuthStore';
import { getStorageService } from '../../services/storageServiceSelector';
import Modal from '../Modal/Modal';
import CustomerForm from '../CustomerForm/CustomerForm';
import { MILESTONES, isMilestoneComplete } from '../../constants/milestones';
import { useToast } from '../Toast/Toast';
import { CustomerListSkeleton } from '../Skeleton/Skeleton';
import { useTheme } from '../../context/ThemeContext';
import './CustomerList.css';

function CustomerList() {
  const { customers, selectedCustomerId, selectCustomer, addCustomerWithFolder, updateChecklistItem, saveCustomerToFolder, isLoading } = useCustomerStore();
  const { isSignedIn } = useAuthStore();
  const { isDark } = useTheme();
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [animateItems, setAnimateItems] = useState(false);
  const [showArchived, setShowArchived] = useState(false); // Toggle to show archived customers
  const prevCustomersLength = useRef(customers.length);

  // Trigger animation when customers list changes
  useEffect(() => {
    if (customers.length !== prevCustomersLength.current) {
      setAnimateItems(true);
      prevCustomersLength.current = customers.length;
      // Reset animation state after animations complete
      const timer = setTimeout(() => setAnimateItems(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [customers.length]);

  // Count archived customers for badge
  const archivedCount = customers.filter(c => c.archiveStatus).length;
  const activeCount = customers.filter(c => !c.archiveStatus).length;

  const filteredCustomers = customers.filter((customer) => {
    // First filter by archive status
    if (showArchived) {
      // When showing archived, only show archived customers
      if (!customer.archiveStatus) return false;
    } else {
      // When showing active, hide archived customers
      if (customer.archiveStatus) return false;
    }

    // Then filter by search term
    const search = searchTerm.toLowerCase();
    return (
      customer.name?.toLowerCase().includes(search) ||
      customer.vsaNo?.toLowerCase().includes(search) ||
      customer.phone?.includes(search) ||
      customer.email?.toLowerCase().includes(search)
    );
  });

  const handleAddCustomer = () => {
    setIsAddModalOpen(true);
  };

  const handleCloseModal = () => {
    if (!isSubmitting) {
      setIsAddModalOpen(false);
    }
  };

  const handleSubmit = async (formData) => {
    setIsSubmitting(true);

    try {
      // Extract scanned ID images from form data
      const { scannedIDImages, ...customerData } = formData;

      // Add customer to store - folder creation happens in BACKGROUND now
      // This makes the save near-instant instead of 5-10 seconds
      const newCustomer = await addCustomerWithFolder(customerData, isSignedIn);

      // Select the newly added customer and close modal immediately
      selectCustomer(newCustomer.id);
      setIsAddModalOpen(false);
      setIsSubmitting(false);

      // Upload photos in background if we have them
      // Note: Since folder creation is now async, we'll wait for folder to be ready
      if (scannedIDImages && isSignedIn) {
        // Start background upload with toast notification
        const toastId = toast.loading('Uploading ID photos...');

        // Wait for folder to be created, then upload photos
        uploadPhotosWithFolderWait(newCustomer.id, scannedIDImages, toastId);
      }
    } catch (error) {
      console.error('Error adding customer:', error);
      alert('Failed to add customer. Please try again.');
      setIsSubmitting(false);
    }
  };

  // Wait for folder to be ready, then upload photos
  const uploadPhotosWithFolderWait = async (customerId, scannedIDImages, toastId) => {
    const maxWaitTime = 30000; // 30 seconds max wait
    const checkInterval = 500; // Check every 500ms
    const startTime = Date.now();

    // Poll for folder ID to be available
    // IMPORTANT: Use getState() to get fresh data, not stale closure
    const waitForFolder = () => {
      return new Promise((resolve) => {
        const check = () => {
          // Get fresh state from store (not stale closure)
          const currentCustomers = useCustomerStore.getState().customers;
          const customer = currentCustomers.find(c => c.id === customerId);
          if (customer?.driveFolderId) {
            resolve(customer);
          } else if (Date.now() - startTime > maxWaitTime) {
            resolve(null); // Timeout
          } else {
            setTimeout(check, checkInterval);
          }
        };
        check();
      });
    };

    const customer = await waitForFolder();

    if (customer && customer.driveFolderId) {
      uploadPhotosInBackground(customer, scannedIDImages, toastId);
    } else {
      toast.update(toastId, 'Folder not ready. Photos will sync later.', 'error');
    }
  };

  // Background upload function - runs after modal is closed
  const uploadPhotosInBackground = async (customer, scannedIDImages, toastId) => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const uploadPromises = [];

      // Prepare NRIC uploads
      if (scannedIDImages.front || scannedIDImages.back) {
        const nricFolderPromise = getStorageService().getOrCreateFolder('NRIC', customer.driveFolderId);

        uploadPromises.push(
          nricFolderPromise.then(async (nricFolderId) => {
            const nricUploads = [];
            if (scannedIDImages.front) {
              const frontBase64 = scannedIDImages.front.split(',')[1];
              nricUploads.push(uploadIDImage(frontBase64, `ID_Front_${timestamp}.jpg`, nricFolderId));
            }
            if (scannedIDImages.back) {
              const backBase64 = scannedIDImages.back.split(',')[1];
              nricUploads.push(uploadIDImage(backBase64, `ID_Back_${timestamp}.jpg`, nricFolderId));
            }
            return Promise.all(nricUploads);
          })
        );
      }

      // Prepare License uploads (in parallel with NRIC)
      if (scannedIDImages.licenseFront || scannedIDImages.licenseBack) {
        const licenseFolderPromise = getStorageService().getOrCreateFolder('Driving License', customer.driveFolderId);

        uploadPromises.push(
          licenseFolderPromise.then(async (licenseFolderId) => {
            const licenseUploads = [];
            if (scannedIDImages.licenseFront) {
              const licenseFrontBase64 = scannedIDImages.licenseFront.split(',')[1];
              licenseUploads.push(uploadIDImage(licenseFrontBase64, `License_Front_${timestamp}.jpg`, licenseFolderId));
            }
            if (scannedIDImages.licenseBack) {
              const licenseBackBase64 = scannedIDImages.licenseBack.split(',')[1];
              licenseUploads.push(uploadIDImage(licenseBackBase64, `License_Back_${timestamp}.jpg`, licenseFolderId));
            }
            return Promise.all(licenseUploads);
          })
        );
      }

      // Wait for all uploads to complete in parallel
      await Promise.all(uploadPromises);

      // Mark "ID Scanned" checklist item as complete
      updateChecklistItem(customer.id, 'test_drive', 'id_scanned', true);

      // Save updated checklist to Drive
      const updatedCustomer = {
        ...customer,
        checklist: {
          ...customer.checklist,
          test_drive: {
            ...customer.checklist?.test_drive,
            id_scanned: true,
          },
        },
      };
      await saveCustomerToFolder(updatedCustomer, isSignedIn);

      // Update toast to success
      toast.update(toastId, 'ID photos uploaded successfully', 'success');
    } catch (uploadError) {
      console.error('Error uploading ID images:', uploadError);
      toast.update(toastId, 'Failed to upload some photos', 'error');
    }
  };

  // Helper function to upload ID image using the storage service abstraction
  const uploadIDImage = async (base64Data, filename, folderId) => {
    return getStorageService().uploadImageToFolder(base64Data, filename, folderId);
  };

  return (
    <>
      <div className="customer-list">
        <div className="search-bar-container">
          <input
            type="text"
            className="search-input"
            placeholder={showArchived ? "Search archived..." : "Search customers..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button
            className={`btn-toggle-archived ${showArchived ? 'active' : ''}`}
            onClick={() => setShowArchived(!showArchived)}
            title={showArchived ? `Show Active (${activeCount})` : `Show Archived (${archivedCount})`}
          >
            {showArchived ? <Users size={18} /> : <Archive size={18} />}
          </button>
          <button
            className="btn-add-customer"
            onClick={handleAddCustomer}
            title="Add Customer"
          >
            <Plus size={20} />
          </button>
        </div>

        <div className="customer-items">
          {isLoading ? (
            <CustomerListSkeleton count={5} />
          ) : filteredCustomers.length === 0 ? (
            <div className="empty-state animate-fadeIn">
              {showArchived ? (
                <>
                  <p>No archived customers</p>
                  <p className="empty-hint">Archived customers will appear here</p>
                </>
              ) : (
                <>
                  <p>No customers yet</p>
                  <p className="empty-hint">Tap + to add a customer</p>
                </>
              )}
            </div>
          ) : (
            filteredCustomers.map((customer, index) => {
              const currentMilestoneId = customer.checklist?.currentMilestone || 'test_drive';
              const currentMilestoneIndex = MILESTONES.findIndex(m => m.id === currentMilestoneId);

              return (
                <div
                  key={customer.id}
                  className={`customer-item ${selectedCustomerId === customer.id ? 'active' : ''} ${animateItems ? 'list-item-animated' : ''} ${customer.archiveStatus ? 'archived' : ''}`}
                  style={animateItems ? { animationDelay: `${Math.min(index, 10) * 50}ms` } : {}}
                  onClick={() => selectCustomer(customer.id)}
                >
                  <div className="customer-info">
                    <div
                      className="customer-name"
                      style={isDark ? { color: '#f1f5f9' } : {}}
                    >
                      {customer.name || 'Unnamed'}
                      {customer.archiveStatus && (
                        <span className={`archive-status-badge ${customer.archiveStatus}`}>
                          {customer.archiveStatus === 'completed' ? 'Completed' : 'Lost'}
                        </span>
                      )}
                    </div>
                    <div
                      className="customer-vsa"
                      style={isDark ? { color: '#94a3b8' } : {}}
                    >{customer.vsaNo || 'No VSA'}</div>
                    <div className="customer-milestone-progress">
                      {MILESTONES.map((milestone, milestoneIndex) => {
                        const isComplete = isMilestoneComplete(milestone.id, customer.checklist);
                        const isCurrent = milestoneIndex === currentMilestoneIndex;
                        const isPast = milestoneIndex < currentMilestoneIndex;

                        return (
                          <div
                            key={milestone.id}
                            className={`milestone-segment ${isComplete ? 'complete' : ''} ${isCurrent ? 'current' : ''} ${isPast ? 'past' : ''}`}
                            style={{
                              '--milestone-color': milestone.color,
                              background: isComplete || isPast ? milestone.color : isCurrent ? milestone.color : '#e2e8f0',
                              opacity: isComplete || isCurrent || isPast ? 1 : 0.4,
                              flex: isCurrent ? 2 : 1,
                            }}
                            title={`${milestone.name}${isComplete ? ' ✓' : isCurrent ? ' (Current)' : ''}`}
                          >
                            <span className="milestone-segment-label">
                              {isCurrent ? milestone.name : milestone.shortName}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add Customer Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={handleCloseModal}
        title="Add New Customer"
        size="large"
      >
        <CustomerForm
          onSubmit={handleSubmit}
          onCancel={handleCloseModal}
          isSubmitting={isSubmitting}
        />
      </Modal>
    </>
  );
}

export default CustomerList;
