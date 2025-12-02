import { useState } from 'react';
import { Plus } from 'lucide-react';
import useCustomerStore from '../../stores/useCustomerStore';
import useAuthStore from '../../stores/useAuthStore';
import { getStorageService } from '../../services/storageServiceSelector';
import Modal from '../Modal/Modal';
import CustomerForm from '../CustomerForm/CustomerForm';
import { MILESTONES, isMilestoneComplete } from '../../constants/milestones';
import { useToast } from '../Toast/Toast';
import './CustomerList.css';

function CustomerList() {
  const { customers, selectedCustomerId, selectCustomer, addCustomerWithFolder, updateChecklistItem, saveCustomerToFolder } = useCustomerStore();
  const { isSignedIn } = useAuthStore();
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredCustomers = customers.filter((customer) => {
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

      // Add customer to store and create folder structure in Drive
      const newCustomer = await addCustomerWithFolder(customerData, isSignedIn);

      // Select the newly added customer and close modal immediately
      selectCustomer(newCustomer.id);
      setIsAddModalOpen(false);
      setIsSubmitting(false);

      // Upload photos in background if we have them
      if (scannedIDImages && isSignedIn && newCustomer.driveFolderId) {
        // Start background upload with toast notification
        const toastId = toast.loading('Uploading ID photos...');

        uploadPhotosInBackground(newCustomer, scannedIDImages, toastId);
      }
    } catch (error) {
      console.error('Error adding customer:', error);
      alert('Failed to add customer. Please try again.');
      setIsSubmitting(false);
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

  // Helper function to upload ID image to Google Drive
  const uploadIDImage = async (base64Data, filename, folderId) => {
    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";

    const metadata = {
      name: filename,
      mimeType: 'image/jpeg',
      parents: [folderId]
    };

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: image/jpeg\r\n' +
      'Content-Transfer-Encoding: base64\r\n\r\n' +
      base64Data +
      close_delim;

    const request = window.gapi.client.request({
      path: '/upload/drive/v3/files',
      method: 'POST',
      params: { uploadType: 'multipart' },
      headers: {
        'Content-Type': 'multipart/related; boundary="' + boundary + '"'
      },
      body: multipartRequestBody
    });

    return request;
  };

  return (
    <>
      <div className="customer-list">
        <div className="search-bar-container">
          <input
            type="text"
            className="search-input"
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button
            className="btn-add-customer"
            onClick={handleAddCustomer}
            title="Add Customer"
          >
            <Plus size={20} />
          </button>
        </div>

        <div className="customer-items">
          {filteredCustomers.length === 0 ? (
            <div className="empty-state">
              <p>No customers yet</p>
              <p className="empty-hint">Tap + to add a customer</p>
            </div>
          ) : (
            filteredCustomers.map((customer) => {
              const currentMilestoneId = customer.checklist?.currentMilestone || 'test_drive';
              const currentMilestoneIndex = MILESTONES.findIndex(m => m.id === currentMilestoneId);

              return (
                <div
                  key={customer.id}
                  className={`customer-item ${selectedCustomerId === customer.id ? 'active' : ''}`}
                  onClick={() => selectCustomer(customer.id)}
                >
                  <div className="customer-info">
                    <div className="customer-name">{customer.name || 'Unnamed'}</div>
                    <div className="customer-vsa">{customer.vsaNo || 'No VSA'}</div>
                    <div className="customer-milestone-progress">
                      {MILESTONES.map((milestone, index) => {
                        const isComplete = isMilestoneComplete(milestone.id, customer.checklist);
                        const isCurrent = index === currentMilestoneIndex;
                        const isPast = index < currentMilestoneIndex;

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
