import { useState } from 'react';
import useCustomerStore from '../../stores/useCustomerStore';
import useAuthStore from '../../stores/useAuthStore';
import driveService from '../../services/driveService';
import Modal from '../Modal/Modal';
import CustomerForm from '../CustomerForm/CustomerForm';
import { MILESTONES, isMilestoneComplete } from '../../constants/milestones';
import './CustomerList.css';

function CustomerList() {
  const { customers, selectedCustomerId, selectCustomer, addCustomerWithFolder, updateChecklistItem, saveCustomerToFolder } = useCustomerStore();
  const { isSignedIn } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredCustomers = customers.filter((customer) => {
    const search = searchTerm.toLowerCase();
    return (
      customer.name?.toLowerCase().includes(search) ||
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

      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Add customer to store and create folder structure in Drive
      const newCustomer = await addCustomerWithFolder(customerData, isSignedIn);

      // If we have scanned ID images and the customer has a Drive folder, upload them
      if (scannedIDImages && isSignedIn && newCustomer.driveFolderId) {
        try {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

          // Upload NRIC/ID images
          if (scannedIDImages.front || scannedIDImages.back) {
            // Find or create NRIC subfolder
            const nricFolderId = await driveService.getOrCreateFolder(
              'NRIC',
              newCustomer.driveFolderId
            );

            // Upload front image
            if (scannedIDImages.front) {
              const frontBase64 = scannedIDImages.front.split(',')[1];
              await uploadIDImage(frontBase64, `ID_Front_${timestamp}.jpg`, nricFolderId);
            }

            // Upload back image
            if (scannedIDImages.back) {
              const backBase64 = scannedIDImages.back.split(',')[1];
              await uploadIDImage(backBase64, `ID_Back_${timestamp}.jpg`, nricFolderId);
            }
          }

          // Upload Driving License images
          if (scannedIDImages.licenseFront || scannedIDImages.licenseBack) {
            // Find or create Driving License subfolder
            const licenseFolderId = await driveService.getOrCreateFolder(
              'Driving License',
              newCustomer.driveFolderId
            );

            // Upload license front image
            if (scannedIDImages.licenseFront) {
              const licenseFrontBase64 = scannedIDImages.licenseFront.split(',')[1];
              await uploadIDImage(licenseFrontBase64, `License_Front_${timestamp}.jpg`, licenseFolderId);
            }

            // Upload license back image
            if (scannedIDImages.licenseBack) {
              const licenseBackBase64 = scannedIDImages.licenseBack.split(',')[1];
              await uploadIDImage(licenseBackBase64, `License_Back_${timestamp}.jpg`, licenseFolderId);
            }
          }

          // Mark "ID Scanned" checklist item as complete
          updateChecklistItem(newCustomer.id, 'test_drive', 'id_scanned', true);

          // Save updated checklist to Drive
          const updatedCustomer = {
            ...newCustomer,
            checklist: {
              ...newCustomer.checklist,
              test_drive: {
                ...newCustomer.checklist?.test_drive,
                id_scanned: true,
              },
            },
          };
          await saveCustomerToFolder(updatedCustomer, isSignedIn);
        } catch (uploadError) {
          console.error('Error uploading ID images:', uploadError);
          // Don't fail the whole operation, customer was already created
        }
      }

      // Select the newly added customer
      selectCustomer(newCustomer.id);

      // Close modal
      setIsAddModalOpen(false);
    } catch (error) {
      console.error('Error adding customer:', error);
      alert('Failed to add customer. Please try again.');
    } finally {
      setIsSubmitting(false);
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
        <div className="customer-list-header">
          <h2>Customer List</h2>
          <button className="btn btn-primary" onClick={handleAddCustomer}>
            + Add Customer
          </button>
        </div>

        <div className="search-box">
          <input
            type="text"
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="customer-items">
          {filteredCustomers.length === 0 ? (
            <div className="empty-state">
              <p>No customers yet</p>
              <p className="empty-hint">Click "Add Customer" to get started</p>
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
                    <div className="customer-phone">{customer.phone || 'No phone'}</div>
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
