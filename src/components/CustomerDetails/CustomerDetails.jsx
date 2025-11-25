import { useState, useEffect, useRef } from 'react';
import useCustomerStore from '../../stores/useCustomerStore';
import useAuthStore from '../../stores/useAuthStore';
import authService from '../../services/authService';
import driveService from '../../services/driveService';
import Modal from '../Modal/Modal';
import CustomerForm from '../CustomerForm/CustomerForm';
import VsaDetailsModal from '../VsaDetailsModal/VsaDetailsModal';
import ProposalDetailsModal from '../ProposalDetailsModal/ProposalDetailsModal';
import ExcelPopulateModal from '../ExcelPopulateModal/ExcelPopulateModal';
import FormPrintModal from '../FormPrintModal/FormPrintModal';
import CombinePrintModal from '../CombinePrintModal/CombinePrintModal';
import DocumentViewer from '../DocumentViewer/DocumentViewer';
import DocumentScanner from '../DocumentScanner/DocumentScanner';
import './CustomerDetails.css';

function CustomerDetails() {
  const { customers, selectedCustomerId, selectCustomer, updateCustomer, deleteCustomer, deleteCustomerHybrid, syncToDrive, saveCustomerToFolder, saveToLocalStorage } = useCustomerStore();
  const { isSignedIn } = useAuthStore();

  // Derive customer from store state (this makes it reactive to changes)
  const customer = customers.find((c) => {
    const customerId = typeof c.id === 'string' ? parseInt(c.id) : c.id;
    const targetId = typeof selectedCustomerId === 'string' ? parseInt(selectedCustomerId) : selectedCustomerId;
    return customerId === targetId;
  }) || null;

  const [activeTab, setActiveTab] = useState('details');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isVsaModalOpen, setIsVsaModalOpen] = useState(false);
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isFormPrintModalOpen, setIsFormPrintModalOpen] = useState(false);
  const [isCombinePrintModalOpen, setIsCombinePrintModalOpen] = useState(false);
  const [isDocumentViewerOpen, setIsDocumentViewerOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteFolderChecked, setDeleteFolderChecked] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);

  // Documents state
  const [documents, setDocuments] = useState([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [folderPath, setFolderPath] = useState([]);

  // Drag and drop state
  const [draggedFile, setDraggedFile] = useState(null);
  const [dropTargetFolder, setDropTargetFolder] = useState(null);
  const [isDragMode, setIsDragMode] = useState(false);

  // Touch drag state
  const longPressTimerRef = useRef(null);
  const autoScrollIntervalRef = useRef(null);
  const touchStartYRef = useRef(0);

  // Load documents when Documents tab is active
  useEffect(() => {
    console.log('[CustomerDetails] Documents tab effect:', {
      activeTab,
      customerName: customer?.name,
      customerId: customer?.id,
      driveFolderId: customer?.driveFolderId,
      driveFolderLink: customer?.driveFolderLink,
      isSignedIn,
    });

    if (activeTab === 'documents' && customer && isSignedIn) {
      // Reset to root folder when switching to documents tab
      setCurrentFolderId(customer.driveFolderId);
      setFolderPath([{ id: customer.driveFolderId, name: customer.name }]);
    }
  }, [activeTab, customer, isSignedIn]);

  // Load documents when current folder changes
  useEffect(() => {
    if (activeTab === 'documents' && currentFolderId && isSignedIn) {
      loadCustomerDocuments(currentFolderId);
    }
  }, [currentFolderId, activeTab, isSignedIn]);

  const loadCustomerDocuments = async (folderId) => {
    if (!folderId) {
      setDocuments([]);
      return;
    }

    setLoadingDocuments(true);

    try {
      let allFiles = [];
      let pageToken = null;

      // Fetch all pages of results
      do {
        const response = await window.gapi.client.drive.files.list({
          q: `'${folderId}' in parents and trashed=false`,
          fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, webViewLink, iconLink)',
          pageSize: 1000,
          pageToken: pageToken,
        });

        const files = response.result.files || [];
        allFiles = allFiles.concat(files);
        pageToken = response.result.nextPageToken;

        console.log('API Page Response:', {
          filesInPage: files.length,
          hasNextPage: !!pageToken,
          fileTypes: files.map(f => ({ name: f.name, mimeType: f.mimeType }))
        });
      } while (pageToken);

      // Sort folders first, then files, both alphabetically
      allFiles.sort((a, b) => {
        const aIsFolder = a.mimeType === 'application/vnd.google-apps.folder';
        const bIsFolder = b.mimeType === 'application/vnd.google-apps.folder';

        if (aIsFolder && !bIsFolder) return -1;
        if (!aIsFolder && bIsFolder) return 1;
        return a.name.localeCompare(b.name);
      });

      console.log('Documents loaded:', {
        folderId,
        totalFiles: allFiles.length,
        folders: allFiles.filter(f => f.mimeType === 'application/vnd.google-apps.folder').length,
        files: allFiles.filter(f => f.mimeType !== 'application/vnd.google-apps.folder').length,
        items: allFiles.map(f => ({ name: f.name, type: f.mimeType }))
      });

      setDocuments(allFiles);
    } catch (error) {
      console.error('Error loading documents:', error);
      setDocuments([]);
    } finally {
      setLoadingDocuments(false);
    }
  };

  const navigateToFolder = (folder) => {
    setCurrentFolderId(folder.id);
    setFolderPath([...folderPath, folder]);
  };

  const navigateToBreadcrumb = (index) => {
    const folder = folderPath[index];
    setCurrentFolderId(folder.id);
    setFolderPath(folderPath.slice(0, index + 1));
  };

  const isFolder = (mimeType) => {
    return mimeType === 'application/vnd.google-apps.folder';
  };

  // Handle scan complete
  const handleScanComplete = (uploadedFile) => {
    console.log('Scan completed:', uploadedFile);
    // Reload documents if we're on the documents tab
    if (currentFolderId) {
      loadCustomerDocuments(currentFolderId);
    }
  };

  // Delete document
  const handleDeleteDocument = async (doc) => {
    // Protect customer.json files from deletion
    if (doc.name === 'customer.json') {
      alert('⚠️ Cannot delete customer.json\n\nThis file is protected and contains important customer data.');
      return;
    }

    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${doc.name}"?\n\nThis will permanently delete the file from Google Drive.`
    );

    if (!confirmDelete) return;

    try {
      await window.gapi.client.drive.files.delete({
        fileId: doc.id
      });

      console.log('Document deleted:', doc.name);

      // Refresh the current folder
      await loadCustomerDocuments(currentFolderId);

      alert('Document deleted successfully');
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Failed to delete document. Please try again.');
    }
  };

  // Touch drag handlers
  const handleTouchStart = (e, item) => {
    // Prevent dragging customer.json files
    if (item.name === 'customer.json') {
      return;
    }

    // Prevent default context menu
    e.preventDefault();

    const touch = e.touches[0];
    touchStartYRef.current = touch.clientY;

    // Start long press timer
    longPressTimerRef.current = setTimeout(() => {
      setDraggedFile(item);
      setIsDragMode(true);
      // Start checking for auto-scroll
      startAutoScrollCheck();
    }, 500);
  };

  const handleTouchMove = (e) => {
    const touch = e.touches[0];
    if (!touch) return;

    // Check if we moved significantly - if so, cancel long press
    const moveDistance = Math.abs(touch.clientY - touchStartYRef.current);
    if (moveDistance > 10 && longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
      return;
    }

    // If in drag mode, update auto-scroll based on position
    if (isDragMode) {
      checkAndScroll(touch.clientY);
      updateDropTarget(touch.clientX, touch.clientY);
    }
  };

  const handleTouchEnd = async () => {
    // Clear long press timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    // Stop auto-scrolling
    stopAutoScroll();

    // If we were dragging and over a folder, perform the drop
    if (isDragMode && draggedFile && dropTargetFolder) {
      const targetFolder = documents.find(doc => doc.id === dropTargetFolder);
      if (targetFolder && draggedFile.id !== targetFolder.id) {
        try {
          // Move the file using Google Drive API
          await window.gapi.client.drive.files.update({
            fileId: draggedFile.id,
            addParents: targetFolder.id,
            removeParents: currentFolderId,
          });

          // Refresh the current folder
          await loadCustomerDocuments(currentFolderId);
        } catch (error) {
          console.error('Error moving file:', error);
          alert(`Failed to move file: ${error.message}`);
        }
      }
    }

    // Reset drag state
    setDraggedFile(null);
    setIsDragMode(false);
    setDropTargetFolder(null);
  };

  // Auto-scroll logic
  const startAutoScrollCheck = () => {
    // Create interval that continuously checks position and scrolls
    autoScrollIntervalRef.current = setInterval(() => {
      // This will be updated by handleTouchMove
    }, 50);
  };

  const checkAndScroll = (touchY) => {
    const scrollZone = 100;
    const scrollSpeed = 8;
    const viewportHeight = window.innerHeight;

    // Near top - scroll up
    if (touchY < scrollZone) {
      window.scrollBy(0, -scrollSpeed);
    }
    // Near bottom - scroll down
    else if (touchY > viewportHeight - scrollZone) {
      window.scrollBy(0, scrollSpeed);
    }
  };

  const updateDropTarget = (touchX, touchY) => {
    // Get element at touch position
    const element = document.elementFromPoint(touchX, touchY);
    if (!element) return;

    // Find if it's a folder
    const folderElement = element.closest('.folder-item');
    if (folderElement) {
      const folderId = folderElement.getAttribute('data-folder-id');
      setDropTargetFolder(folderId);
    } else {
      setDropTargetFolder(null);
    }
  };

  const stopAutoScroll = () => {
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = null;
    }
  };

  // Click to open/view
  const handleItemClick = (item) => {
    if (isDragMode) return; // Don't open if in drag mode

    if (item.mimeType === 'application/vnd.google-apps.folder') {
      navigateToFolder(item);
    } else {
      openDocument(item);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e, file) => {
    // Prevent dragging customer.json files
    if (file.name === 'customer.json') {
      e.preventDefault();
      return;
    }

    setDraggedFile(file);
    setIsDragMode(true);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedFile(null);
    setDropTargetFolder(null);
    setIsDragMode(false);
    stopAutoScroll();
  };

  const handleDragOver = (e, folder) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (folder) {
      setDropTargetFolder(folder.id);
    }
  };

  const handleDragLeave = () => {
    setDropTargetFolder(null);
  };

  const handleDrop = async (e, targetFolder) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedFile || !targetFolder) {
      return;
    }

    try {
      // Move the file using Google Drive API
      await window.gapi.client.drive.files.update({
        fileId: draggedFile.id,
        addParents: targetFolder.id,
        removeParents: currentFolderId,
      });

      // Refresh the current folder to show updated file list
      await loadCustomerDocuments(currentFolderId);

      console.log(`Moved ${draggedFile.name} to ${targetFolder.name}`);
    } catch (error) {
      console.error('Error moving file:', error);
      alert(`Failed to move file: ${error.message}`);
    } finally {
      setDraggedFile(null);
      setDropTargetFolder(null);
      setIsDragMode(false);
    }
  };

  // Handle drop on trash bin
  const handleTrashDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedFile) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${draggedFile.name}"?`
    );

    if (confirmDelete) {
      await handleDeleteDocument(draggedFile);
    }

    setDraggedFile(null);
    setIsDragMode(false);
  };

  const handleEdit = () => {
    setIsEditModalOpen(true);
  };

  const handleDelete = () => {
    setIsDeleteModalOpen(true);
  };

  const handleVsaDetails = () => {
    setIsVsaModalOpen(true);
  };

  const handleExcelPopulate = () => {
    setIsExcelModalOpen(true);
  };

  const handleCloseExcelModal = () => {
    setIsExcelModalOpen(false);
  };

  const handleFormPrint = () => {
    setIsFormPrintModalOpen(true);
  };

  const handleCloseFormPrintModal = () => {
    setIsFormPrintModalOpen(false);
  };

  const handleCombinePrint = () => {
    setIsCombinePrintModalOpen(true);
  };

  const handleCloseCombinePrintModal = () => {
    setIsCombinePrintModalOpen(false);
  };

  const handleCloseEditModal = () => {
    if (!isSubmitting) {
      setIsEditModalOpen(false);
    }
  };

  const handleCloseDeleteModal = () => {
    if (!isSubmitting) {
      setIsDeleteModalOpen(false);
      setDeleteFolderChecked(false); // Reset checkbox
    }
  };

  const handleCloseVsaModal = () => {
    if (!isSubmitting) {
      setIsVsaModalOpen(false);
    }
  };

  const handleEditSubmit = async (formData) => {
    if (!customer) return;

    setIsSubmitting(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      updateCustomer(customer.id, formData);

      // Save to localStorage
      saveToLocalStorage();

      // Save only THIS customer to Drive (not all customers!)
      if (isSignedIn && customer.driveFolderId) {
        const updatedCustomer = customers.find(c => c.id === customer.id);
        if (updatedCustomer) {
          await saveCustomerToFolder({ ...updatedCustomer, ...formData }, isSignedIn);
        }
      }

      setIsEditModalOpen(false);
    } catch (error) {
      console.error('Error updating customer:', error);
      alert('Failed to update customer. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVsaSave = async (vsaUpdates) => {
    if (!customer) return;

    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      updateCustomer(customer.id, vsaUpdates);

      // Save to localStorage
      saveToLocalStorage();

      // Save only THIS customer to Drive (not all customers!)
      if (isSignedIn && customer.driveFolderId) {
        const updatedCustomer = customers.find(c => c.id === customer.id);
        if (updatedCustomer) {
          await saveCustomerToFolder({ ...updatedCustomer, ...vsaUpdates }, isSignedIn);
        }
      }
    } catch (error) {
      console.error('Error updating VSA details:', error);
      throw error;
    }
  };

  const handleProposalDetails = () => {
    setIsProposalModalOpen(true);
  };

  const handleCloseProposalModal = () => {
    if (!isSubmitting) {
      setIsProposalModalOpen(false);
    }
  };

  const handleProposalSave = async (proposalUpdates) => {
    if (!customer) return;

    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      updateCustomer(customer.id, proposalUpdates);

      // Save to localStorage
      saveToLocalStorage();

      // Save only THIS customer to Drive (not all customers!)
      if (isSignedIn && customer.driveFolderId) {
        const updatedCustomer = customers.find(c => c.id === customer.id);
        if (updatedCustomer) {
          await saveCustomerToFolder({ ...updatedCustomer, ...proposalUpdates }, isSignedIn);
        }
      }
    } catch (error) {
      console.error('Error updating proposal details:', error);
      throw error;
    }
  };

  const handleDeleteConfirm = async () => {
    if (!customer) return;

    setIsSubmitting(true);

    try {
      // Delete Google Drive folder if checkbox is checked
      if (isSignedIn && customer.driveFolderId) {
        if (deleteFolderChecked) {
          // Delete entire folder including all documents
          try {
            console.log(`Deleting Google Drive folder: ${customer.driveFolderId}`);
            await driveService.deleteFolder(customer.driveFolderId);
            console.log('Google Drive folder deleted successfully');
          } catch (folderError) {
            console.error('Error deleting Google Drive folder:', folderError);
            // Ask user if they want to continue deleting the customer record
            const continueDelete = window.confirm(
              'Failed to delete the Google Drive folder. Would you like to continue deleting the customer record anyway?'
            );
            if (!continueDelete) {
              setIsSubmitting(false);
              return;
            }
          }
        } else {
          // Just delete the customer.json file, keep the folder and documents
          try {
            console.log(`Deleting customer.json from folder: ${customer.driveFolderId}`);
            const fileName = 'customer.json';
            const response = await window.gapi.client.drive.files.list({
              q: `name='${fileName}' and '${customer.driveFolderId}' in parents and trashed=false`,
              fields: 'files(id, name)',
              spaces: 'drive',
            });

            if (response.result.files && response.result.files.length > 0) {
              const fileId = response.result.files[0].id;
              await window.gapi.client.drive.files.delete({
                fileId: fileId
              });
              console.log('customer.json deleted successfully');
            }
          } catch (fileError) {
            console.error('Error deleting customer.json:', fileError);
            // Continue anyway - the customer will still be removed from the system
          }
        }
      }

      // Delete customer record and update Drive index
      await new Promise((resolve) => setTimeout(resolve, 300));
      await deleteCustomerHybrid(customer.id, isSignedIn);
      setIsDeleteModalOpen(false);
      setDeleteFolderChecked(false); // Reset checkbox
    } catch (error) {
      console.error('Error deleting customer:', error);
      alert('Failed to delete customer. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDocument = (doc) => {
    setSelectedDocument(doc);
    setIsDocumentViewerOpen(true);
  };

  const handleCloseDocumentViewer = () => {
    setIsDocumentViewerOpen(false);
    setSelectedDocument(null);
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    const kb = bytes / 1024;
    if (kb < 1024) return kb.toFixed(2) + ' KB';
    return (kb / 1024).toFixed(2) + ' MB';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  // Format date to dd/mm/yyyy for customer details
  const formatCustomerDate = (dateString) => {
    if (!dateString) return 'N/A';

    try {
      const date = new Date(dateString);

      // Check if date is valid
      if (isNaN(date.getTime())) return dateString;

      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();

      return `${day}/${month}/${year}`;
    } catch (error) {
      return dateString;
    }
  };

  if (!customer) {
    return (
      <div className="customer-details">
        <div className="empty-state">
          <p>Select a customer to view details</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="customer-details">
        <div className="customer-details-header">
          {/* Back Arrow */}
          <button
            className="btn-back-arrow"
            onClick={() => selectCustomer(null)}
            aria-label="Back to customer list"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <h2>{customer.name}</h2>

          {/* Actions Dropdown */}
          <div className="actions-dropdown">
            <button
              className="btn-actions-toggle"
              onClick={() => setShowActionsMenu(!showActionsMenu)}
              aria-label="Customer actions"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="1" fill="currentColor"/>
                <circle cx="19" cy="12" r="1" fill="currentColor"/>
                <circle cx="5" cy="12" r="1" fill="currentColor"/>
              </svg>
            </button>

            {showActionsMenu && (
              <>
                <div className="actions-backdrop" onClick={() => setShowActionsMenu(false)}></div>
                <div className="actions-menu">
                  <button
                    className="action-menu-item"
                    onClick={() => {
                      setShowActionsMenu(false);
                      handleFormPrint();
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 6 2 18 2 18 9"></polyline>
                      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                      <rect x="6" y="14" width="12" height="8"></rect>
                    </svg>
                    <span>Print Form</span>
                  </button>
                  <button
                    className="action-menu-item"
                    onClick={() => {
                      setShowActionsMenu(false);
                      handleCombinePrint();
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                    </svg>
                    <span>Combine & Print</span>
                  </button>
                  <button
                    className="action-menu-item"
                    onClick={() => {
                      setShowActionsMenu(false);
                      handleExcelPopulate();
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="12" y1="18" x2="12" y2="12"></line>
                      <line x1="9" y1="15" x2="15" y2="15"></line>
                    </svg>
                    <span>Populate Excel</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="customer-tabs">
          <button
            className={`tab ${activeTab === 'details' ? 'active' : ''}`}
            onClick={() => setActiveTab('details')}
          >
            Details
          </button>
          <button
            className={`tab ${activeTab === 'proposal' ? 'active' : ''}`}
            onClick={() => setActiveTab('proposal')}
          >
            Proposal
          </button>
          <button
            className={`tab ${activeTab === 'vsa' ? 'active' : ''}`}
            onClick={() => setActiveTab('vsa')}
          >
            VSA
          </button>
          <button
            className={`tab ${activeTab === 'documents' ? 'active' : ''}`}
            onClick={() => setActiveTab('documents')}
          >
            Documents {!isSignedIn && '🔒'}
          </button>
          <button
            className={`tab ${activeTab === 'scanner' ? 'active' : ''}`}
            onClick={() => setActiveTab('scanner')}
          >
            Scanner {!isSignedIn && '🔒'}
          </button>
        </div>

        {/* Tab Content */}
        <div className="customer-details-content">
          {activeTab === 'details' ? (
            <>
              <div className="vsa-section">
                <div className="vsa-section-header">
                  <h3>Contact Information</h3>
                  <button className="btn btn-small btn-primary" onClick={handleEdit}>
                    Edit Details
                  </button>
                </div>
                <div className="info-grid">
                  <div className="info-item">
                    <label>Phone</label>
                    <div className="info-value">{customer.phone || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Email</label>
                    <div className="info-value">{customer.email || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>NRIC/FIN</label>
                    <div className="info-value">{customer.nric || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Date of Birth</label>
                    <div className="info-value">{formatCustomerDate(customer.dob)}</div>
                  </div>
                </div>
              </div>

              <div className="info-section">
                <h3>Additional Information</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <label>Occupation</label>
                    <div className="info-value">{customer.occupation || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Sales Consultant</label>
                    <div className="info-value">{customer.salesConsultant || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>VSA No</label>
                    <div className="info-value">{customer.vsaNo || 'N/A'}</div>
                  </div>
                </div>
              </div>

              {customer.address && (
                <div className="info-section">
                  <h3>Address</h3>
                  <div className="info-value">
                    {customer.address}
                    {customer.addressContinue && (
                      <>
                        <br />
                        {customer.addressContinue}
                      </>
                    )}
                  </div>
                </div>
              )}

              {customer.notes && (
                <div className="info-section">
                  <h3>Notes</h3>
                  <div className="info-value">{customer.notes}</div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #f0f0f0' }}>
                <button className="btn btn-danger" onClick={handleDelete}>
                  Delete Customer
                </button>
              </div>
            </>
          ) : activeTab === 'proposal' ? (
            /* Proposal Tab */
            <>
              <div className="vsa-section">
                <div className="vsa-section-header">
                  <h3>Proposal Information</h3>
                  <button className="btn btn-small btn-primary" onClick={handleProposalDetails}>
                    Edit Proposal Details
                  </button>
                </div>
                <div className="info-grid">
                  <div className="info-item">
                    <label>Model</label>
                    <div className="info-value">{customer.proposal_model || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Bank</label>
                    <div className="info-value">{customer.proposal_bank || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Selling Price</label>
                    <div className="info-value">{customer.proposal_sellingPrice || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Interest Rate</label>
                    <div className="info-value">{customer.proposal_interestRate || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Downpayment</label>
                    <div className="info-value">{customer.proposal_downpayment || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Loan Tenure</label>
                    <div className="info-value">{customer.proposal_loanTenure || 'N/A'}</div>
                  </div>
                </div>
              </div>

              <div className="info-section">
                <h3>Loan & Fee Details</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <label>Loan Amount</label>
                    <div className="info-value">{customer.proposal_loanAmount || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Admin Fee</label>
                    <div className="info-value">{customer.proposal_adminFee || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Referral Fee</label>
                    <div className="info-value">{customer.proposal_referralFee || 'N/A'}</div>
                  </div>
                </div>
              </div>

              <div className="info-section">
                <h3>Trade-In Details</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <label>Trade In Model</label>
                    <div className="info-value">{customer.proposal_tradeInModel || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Trade In Car Plate</label>
                    <div className="info-value">{customer.proposal_tradeInCarPlate || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Quoted Trade In Price</label>
                    <div className="info-value">{customer.proposal_quotedTradeInPrice || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Low Loan Surcharge</label>
                    <div className="info-value">{customer.proposal_lowLoanSurcharge || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>No Loan Surcharge</label>
                    <div className="info-value">{customer.proposal_noLoanSurcharge || 'N/A'}</div>
                  </div>
                </div>
              </div>

              <div className="info-section">
                <h3>Additional Information</h3>
                <div className="info-item">
                  <label>Benefits Given</label>
                  <div className="info-value" style={{ whiteSpace: 'pre-wrap' }}>
                    {customer.proposal_benefitsGiven || 'N/A'}
                  </div>
                </div>
                <div className="info-item">
                  <label>Remarks</label>
                  <div className="info-value" style={{ whiteSpace: 'pre-wrap' }}>
                    {customer.proposal_remarks || 'N/A'}
                  </div>
                </div>
              </div>
            </>
          ) : activeTab === 'vsa' ? (
            /* VSA Tab */
            <>
              <div className="vsa-section">
                <div className="vsa-section-header">
                  <h3>BYD New Car Details</h3>
                  <button className="btn btn-small btn-primary" onClick={handleVsaDetails}>
                    Edit VSA Details
                  </button>
                </div>
                <div className="info-grid">
                  <div className="info-item">
                    <label>Make & Model</label>
                    <div className="info-value">{customer.vsa_makeModel || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Year of Manufacture</label>
                    <div className="info-value">{customer.vsa_yom || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Body Colour</label>
                    <div className="info-value">{customer.vsa_bodyColour || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Upholstery</label>
                    <div className="info-value">{customer.vsa_upholstery || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>P/R/Z Type</label>
                    <div className="info-value">{customer.vsa_przType || 'N/A'}</div>
                  </div>
                </div>
              </div>

              <div className="info-section">
                <h3>BYD New Car Package</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <label>Package</label>
                    <div className="info-value">{customer.vsa_package || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Selling with COE</label>
                    <div className="info-value">{customer.vsa_sellingWithCOE || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Selling Price on Price List</label>
                    <div className="info-value">{customer.vsa_sellingPriceList || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Purchase Price with COE</label>
                    <div className="info-value">{customer.vsa_purchasePriceWithCOE || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>COE Rebate Level</label>
                    <div className="info-value">{customer.vsa_coeRebateLevel || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Deposit</label>
                    <div className="info-value">{customer.vsa_deposit || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Less: Others</label>
                    <div className="info-value">{customer.vsa_lessOthers || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Add: Others</label>
                    <div className="info-value">{customer.vsa_addOthers || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Approximate Delivery Date</label>
                    <div className="info-value">{formatCustomerDate(customer.vsa_deliveryDate)}</div>
                  </div>
                </div>
              </div>

              <div className="info-section">
                <h3>Trade In Car Details</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <label>Trade in Car No</label>
                    <div className="info-value">{customer.vsa_tradeInCarNo || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Trade in Car Model</label>
                    <div className="info-value">{customer.vsa_tradeInCarModel || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Trade In Amount</label>
                    <div className="info-value">{customer.vsa_tradeInAmount || 'N/A'}</div>
                  </div>
                </div>
              </div>

              <div className="info-section">
                <h3>Delivery Details</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <label>Date of Registration</label>
                    <div className="info-value">{formatCustomerDate(customer.vsa_dateOfRegistration)}</div>
                  </div>
                  <div className="info-item">
                    <label>Registration No</label>
                    <div className="info-value">{customer.vsa_registrationNo || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Chassis No</label>
                    <div className="info-value">{customer.vsa_chassisNo || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Engine No</label>
                    <div className="info-value">{customer.vsa_engineNo || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Motor No</label>
                    <div className="info-value">{customer.vsa_motorNo || 'N/A'}</div>
                  </div>
                </div>
              </div>

              <div className="info-section">
                <h3>Insurance</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <label>Insurance Company</label>
                    <div className="info-value">{customer.vsa_insuranceCompany || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Insurance Fee</label>
                    <div className="info-value">{customer.vsa_insuranceFee || 'N/A'}</div>
                  </div>
                </div>
              </div>

              <div className="info-section">
                <h3>Remarks & Loan Details</h3>
                {customer.vsa_remarks1 && (
                  <div className="info-item" style={{ marginBottom: '1rem' }}>
                    <label>Remarks 1</label>
                    <div className="info-value">{customer.vsa_remarks1}</div>
                  </div>
                )}
                {customer.vsa_remarks2 && (
                  <div className="info-item" style={{ marginBottom: '1rem' }}>
                    <label>Remarks 2</label>
                    <div className="info-value">{customer.vsa_remarks2}</div>
                  </div>
                )}
                <div className="info-grid">
                  <div className="info-item">
                    <label>Loan Amount</label>
                    <div className="info-value">{customer.vsa_loanAmount || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Interest</label>
                    <div className="info-value">{customer.vsa_interest || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Tenure</label>
                    <div className="info-value">{customer.vsa_tenure || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Admin Fee</label>
                    <div className="info-value">{customer.vsa_adminFee || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Insurance Subsidy</label>
                    <div className="info-value">{customer.vsa_insuranceSubsidy || 'N/A'}</div>
                  </div>
                  <div className="info-item">
                    <label>Monthly Repayment</label>
                    <div className="info-value">{customer.vsa_monthlyRepayment || 'N/A'}</div>
                  </div>
                </div>
              </div>
            </>
          ) : activeTab === 'documents' ? (
            /* Documents Tab */
            <div className="documents-section">
              {!isSignedIn ? (
                <div className="warning-banner">
                  <p>⚠️ Please sign in to Google Drive to view customer documents</p>
                </div>
              ) : !customer.driveFolderId ? (
                <div className="empty-state">
                  <p>No Google Drive folder for this customer yet</p>
                  <p className="empty-state-hint">
                    Documents will be saved here when you generate forms or Excel files
                  </p>
                </div>
              ) : (
                <>
                  {/* Breadcrumb Navigation */}
                  {folderPath.length > 0 && (
                    <div className="breadcrumb-nav">
                      <div className="breadcrumb-path">
                        {folderPath.map((folder, index) => (
                          <span key={folder.id}>
                            {index > 0 && <span className="breadcrumb-separator">/</span>}
                            <button
                              className={`breadcrumb-item ${index === folderPath.length - 1 ? 'active' : ''}`}
                              onClick={() => navigateToBreadcrumb(index)}
                              disabled={index === folderPath.length - 1}
                            >
                              {folder.name}
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="breadcrumb-actions">
                        <button
                          className="breadcrumb-refresh"
                          onClick={() => loadCustomerDocuments(currentFolderId)}
                          title="Refresh folder contents"
                          disabled={loadingDocuments}
                        >
                          {loadingDocuments ? '⟳' : '🔄'}
                        </button>
                        <button
                          className="breadcrumb-drive-link"
                          onClick={() => window.open(`https://drive.google.com/drive/folders/${currentFolderId}`, '_blank')}
                          title="Open in Google Drive"
                        >
                          📁
                        </button>
                      </div>
                    </div>
                  )}

                  {loadingDocuments ? (
                    <div className="loading-state">
                      <div className="loading"></div>
                      <p>Loading documents...</p>
                    </div>
                  ) : documents.length === 0 ? (
                    <div className="empty-state">
                      <p>No documents found</p>
                      <p className="empty-state-hint">
                        Documents you generate will appear here
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Folders List */}
                      {documents.filter(doc => isFolder(doc.mimeType)).length > 0 && (
                        <div className="folders-section">
                          <h3 className="section-title">Folders</h3>
                          <div className="documents-list">
                            {documents.filter(doc => isFolder(doc.mimeType)).map((folder) => (
                              <div
                                key={folder.id}
                                data-folder-id={folder.id}
                                className={`document-item folder-item ${dropTargetFolder === folder.id ? 'drop-target' : ''} ${draggedFile?.id === folder.id ? 'dragging' : ''}`}
                                draggable
                                onDragStart={(e) => handleDragStart(e, folder)}
                                onDragEnd={handleDragEnd}
                                onClick={() => handleItemClick(folder)}
                                onTouchStart={(e) => handleTouchStart(e, folder)}
                                onTouchMove={handleTouchMove}
                                onTouchEnd={handleTouchEnd}
                                onDragOver={(e) => handleDragOver(e, folder)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, folder)}
                              >
                                <div className="document-icon">
                                  <span className="folder-icon">📁</span>
                                </div>
                                <div className="document-info">
                                  <h4>{folder.name}</h4>
                                  <p>{formatDate(folder.createdTime)}</p>
                                </div>
                                <span className="chevron">›</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Files List */}
                      {documents.filter(doc => !isFolder(doc.mimeType)).length > 0 && (
                        <div className="files-section">
                          <h3 className="section-title">Files</h3>
                          <div className="documents-list">
                            {documents.filter(doc => !isFolder(doc.mimeType)).map((doc) => (
                              <div
                                key={doc.id}
                                className={`document-item file-item ${draggedFile?.id === doc.id ? 'dragging' : ''} ${doc.name === 'customer.json' ? 'protected-file' : ''}`}
                                draggable={doc.name !== 'customer.json'}
                                onDragStart={(e) => handleDragStart(e, doc)}
                                onDragEnd={handleDragEnd}
                                onClick={() => handleItemClick(doc)}
                                onTouchStart={(e) => handleTouchStart(e, doc)}
                                onTouchMove={handleTouchMove}
                                onTouchEnd={handleTouchEnd}
                              >
                                <div className="document-icon">
                                  {doc.iconLink ? (
                                    <img src={doc.iconLink} alt="" />
                                  ) : (
                                    <span>📄</span>
                                  )}
                                </div>
                                <div className="document-info">
                                  <h4>
                                    {doc.name}
                                    {doc.name === 'customer.json' && (
                                      <span className="protected-badge" title="Protected file - cannot be deleted or moved">
                                        🔒
                                      </span>
                                    )}
                                  </h4>
                                  <p>
                                    {formatFileSize(doc.size)} • {formatDate(doc.createdTime)}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Trash Bin - appears during drag mode */}
                  {isDragMode && (
                    <div
                      className="trash-bin-zone"
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDrop={handleTrashDrop}
                    >
                      <div className="trash-bin-icon">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          <line x1="10" y1="11" x2="10" y2="17"></line>
                          <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                      </div>
                      <p className="trash-bin-label">Drag here to delete</p>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            /* Scanner Tab */
            <div className="scanner-section">
              {!isSignedIn ? (
                <div className="warning-banner">
                  <p>⚠️ Please sign in to Google Drive to use the scanner</p>
                </div>
              ) : !customer.driveFolderId ? (
                <div className="empty-state">
                  <p>No Google Drive folder for this customer yet</p>
                  <p className="empty-state-hint">
                    A folder will be created when you generate forms or Excel files
                  </p>
                </div>
              ) : (
                <DocumentScanner
                  customerId={customer.id}
                  customerName={customer.name}
                  customerFolderId={customer.driveFolderId}
                  onScanComplete={handleScanComplete}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit Customer Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        title="Edit Customer"
        size="large"
      >
        <CustomerForm
          customer={customer}
          onSubmit={handleEditSubmit}
          onCancel={handleCloseEditModal}
          isSubmitting={isSubmitting}
        />
      </Modal>

      {/* VSA Details Modal */}
      <VsaDetailsModal
        isOpen={isVsaModalOpen}
        onClose={handleCloseVsaModal}
        customer={customer}
        onSave={handleVsaSave}
      />

      {/* Proposal Details Modal */}
      <ProposalDetailsModal
        isOpen={isProposalModalOpen}
        onClose={handleCloseProposalModal}
        customer={customer}
        onSave={handleProposalSave}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={handleCloseDeleteModal}
        title="Delete Customer"
        size="small"
      >
        <div className="delete-confirmation">
          <p className="delete-warning">
            Are you sure you want to delete <strong>{customer.name}</strong>?
          </p>
          <p className="delete-info">
            This action cannot be undone. All customer data will be permanently removed.
          </p>

          {/* Google Drive folder deletion option */}
          {isSignedIn && customer.driveFolderId && (
            <div style={{
              margin: '20px 0',
              padding: '15px',
              backgroundColor: '#fff3cd',
              border: '1px solid #ffc107',
              borderRadius: '4px'
            }}>
              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                cursor: 'pointer',
                gap: '10px'
              }}>
                <input
                  type="checkbox"
                  checked={deleteFolderChecked}
                  onChange={(e) => setDeleteFolderChecked(e.target.checked)}
                  style={{ marginTop: '3px' }}
                />
                <span style={{ flex: 1 }}>
                  <strong>Also delete Google Drive folder and all documents</strong>
                  <br />
                  <small style={{ color: '#856404' }}>
                    This will permanently delete all files including NRIC, Test Drive photos, VSA forms, etc.
                  </small>
                </span>
              </label>
            </div>
          )}

          <div className="delete-actions">
            <button
              className="btn btn-danger"
              onClick={handleDeleteConfirm}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Deleting...' : 'Yes, Delete'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleCloseDeleteModal}
              disabled={isSubmitting}
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Excel Populate Modal */}
      <ExcelPopulateModal
        isOpen={isExcelModalOpen}
        onClose={handleCloseExcelModal}
        customer={customer}
      />

      {/* Form Print Modal */}
      <FormPrintModal
        isOpen={isFormPrintModalOpen}
        onClose={handleCloseFormPrintModal}
        customer={customer}
      />

      {/* Combine Print Modal */}
      <CombinePrintModal
        isOpen={isCombinePrintModalOpen}
        onClose={handleCloseCombinePrintModal}
        customer={customer}
      />

      {/* Document Viewer Modal */}
      <DocumentViewer
        isOpen={isDocumentViewerOpen}
        onClose={handleCloseDocumentViewer}
        document={selectedDocument}
      />
    </>
  );
}

export default CustomerDetails;
