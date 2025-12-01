import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { FolderOpen, ScanLine } from 'lucide-react';
import useCustomerStore from '../../stores/useCustomerStore';
import useAuthStore from '../../stores/useAuthStore';
import driveService from '../../services/driveService';
import Modal from '../Modal/Modal';
import ExcelPopulateModal from '../ExcelPopulateModal/ExcelPopulateModal';
import PrintManager from '../Documents/PrintManager/PrintManager';
import DocumentViewer from '../DocumentViewer/DocumentViewer';
import DocumentScanner from '../DocumentScanner/DocumentScanner';
import MilestoneTracker from '../MilestoneTracker/MilestoneTracker';
import { useToast } from '../Toast/Toast';
import './CustomerDetails.css';

const VEHICLE_MODELS = [
  'BYD Atto3 Extended Range 100kw',
  'BYD Atto3 Carbon Edge 100kw',
  'BYD Seal Dynamic 100kw',
  'BYD Seal Premium',
  'BYD Seal Performance',
  'BYD Seal 6 Premium',
  'BYD Dolphin Premium',
  'BYD E6 7-Seater',
  'BYD M6 7-Seater',
  'BYD M6 Carbon Edge',
  'BYD Sealion 7 Dynamic',
  'BYD Sealion 7 Premium',
  'BYD Sealion 7 Performance',
];

const BODY_COLOURS = [
  'Ski White',
  'Surf Blue',
  'Cosmos Black',
  'Boulder Grey',
  'Atlantis Grey',
  'Arctic Blue',
  'Aurora While',
  'Maldive Purple',
  'Coral Pink',
  'Sand White',
  'Urban Grey',
  'Crystal White',
  'Harbor Grey',
  'Inkstone Blue',
  'Shark Grey',
  'Whale Sea Blue',
  'Arctic White',
];

const BENEFITS_OPTIONS = [
  '3M Solar Film',
  'Additional 6 months Road Tax',
  'ATTO3 Frunk',
  'ATTO3 Rear Recording Cam',
  'BYD Mic Set',
  'BYD Thermo Flask',
  'Ceramic Coating',
  'Dark Interior Combination',
  'F&R Recording Cam',
  'Free Charger Capped $3000',
  'Full Black Interior',
  'Full Car PPF',
  'Full Car Wrap',
  '1x Grooming Package',
  'Low Loan Surcharge',
  'M6 Frunk',
  'No Trade in Surcharge',
  'Number Retention',
  'Sunshade',
  'Toscano Card wallet',
  'Toscano Cardholder/ Lanyard',
  'Toscano Luggage Tag',
  'Toscano Notebook',
  'Toscano Passport Sleeve',
  'Trapo Eco Mat',
  'Trapo Hex Mat',
  'Upgrade Crystalline Solar Film',
  '2x Paint Sealer Protection PKG',
  '$1000 Service Credits',
];

function CustomerDetails() {
  const { customers, selectedCustomerId, selectCustomer, updateCustomer, deleteCustomer, deleteCustomerHybrid, syncToDrive, saveCustomerToFolder, saveToLocalStorage } = useCustomerStore();
  const { isSignedIn } = useAuthStore();
  const toast = useToast();

  // Derive customer from store state (this makes it reactive to changes)
  const customer = customers.find((c) => {
    const customerId = typeof c.id === 'string' ? parseInt(c.id) : c.id;
    const targetId = typeof selectedCustomerId === 'string' ? parseInt(selectedCustomerId) : selectedCustomerId;
    return customerId === targetId;
  }) || null;

  const [activeTab, setActiveTab] = useState('details');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Inline editing state for Details tab
  const [detailsFormData, setDetailsFormData] = useState({
    name: '',
    phone: '',
    email: '',
    nric: '',
    occupation: '',
    dob: '',
    salesConsultant: '',
    vsaNo: '',
    address: '',
    addressContinue: '',
    notes: '',
  });
  const [originalDetailsData, setOriginalDetailsData] = useState(null);
  const [detailsErrors, setDetailsErrors] = useState({});

  // Guarantors state (max 5)
  const [guarantors, setGuarantors] = useState([]);
  const [originalGuarantors, setOriginalGuarantors] = useState([]);
  const [expandedGuarantors, setExpandedGuarantors] = useState({});

  // Inline editing state for Proposal tab
  const [proposalFormData, setProposalFormData] = useState({
    model: '',
    bank: '',
    sellingPrice: '',
    interestRate: '',
    downpayment: '',
    loanTenure: '',
    loanAmount: '',
    adminFee: '',
    referralFee: '',
    tradeInModel: '',
    lowLoanSurcharge: '',
    tradeInCarPlate: '',
    noLoanSurcharge: '',
    quotedTradeInPrice: '',
    benefit1: '',
    benefit2: '',
    benefit3: '',
    benefit4: '',
    benefit5: '',
    benefitsGiven: '',
    remarks: '',
  });
  const [originalProposalData, setOriginalProposalData] = useState(null);

  // Inline editing state for VSA tab
  const [vsaFormData, setVsaFormData] = useState({
    makeModel: '',
    yom: '',
    bodyColour: '',
    upholstery: '',
    przType: '',
    package: '',
    sellingWithCOE: '',
    sellingPriceList: '',
    purchasePriceWithCOE: '',
    coeRebateLevel: '',
    deposit: '',
    lessOthers: '',
    addOthers: '',
    deliveryDate: '',
    tradeInCarNo: '',
    tradeInCarModel: '',
    tradeInAmount: '',
    tradeInOwnerNotCustomer: false,
    tradeInOwnerName: '',
    tradeInOwnerNric: '',
    tradeInOwnerMobile: '',
    tradeInInsuranceCompany: '',
    tradeInPolicyNumber: '',
    dateOfRegistration: '',
    registrationNo: '',
    chassisNo: '',
    engineNo: '',
    motorNo: '',
    insuranceCompany: '',
    insuranceFee: '',
    remarks1: '',
    remarks2: '',
    loanAmount: '',
    interest: '',
    tenure: '',
    adminFee: '',
    insuranceSubsidy: '',
    monthlyRepayment: '',
  });
  const [originalVsaData, setOriginalVsaData] = useState(null);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isPrintManagerOpen, setIsPrintManagerOpen] = useState(false);
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
  const [dropTargetBreadcrumb, setDropTargetBreadcrumb] = useState(null);
  const [isDragMode, setIsDragMode] = useState(false);

  // Mobile folder menu state
  const [showFolderMenu, setShowFolderMenu] = useState(false);
  const [selectedFileToMove, setSelectedFileToMove] = useState(null);
  const longPressTimerRef = useRef(null);

  // Desktop context menu state
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });

  // Rename state
  const [renamingItem, setRenamingItem] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [showRenameModal, setShowRenameModal] = useState(false);

  // Initialize details form data when customer changes
  useEffect(() => {
    if (customer) {
      const formData = {
        name: customer.name || '',
        phone: customer.phone || '',
        email: customer.email || '',
        nric: customer.nric || '',
        occupation: customer.occupation || '',
        dob: customer.dob || '',
        salesConsultant: customer.salesConsultant || '',
        vsaNo: customer.vsaNo || '',
        address: customer.address || '',
        addressContinue: customer.addressContinue || '',
        notes: customer.notes || '',
      };
      setDetailsFormData(formData);
      setOriginalDetailsData(formData);
      setDetailsErrors({});

      // Load guarantors
      const loadedGuarantors = customer.guarantors || [];
      setGuarantors(loadedGuarantors);
      setOriginalGuarantors(JSON.parse(JSON.stringify(loadedGuarantors)));
      setExpandedGuarantors({});
    }
  }, [customer?.id]);

  // Initialize proposal form data when customer changes
  useEffect(() => {
    if (customer) {
      const formData = {
        model: customer.proposal_model || '',
        bank: customer.proposal_bank || '',
        sellingPrice: customer.proposal_sellingPrice || '',
        interestRate: customer.proposal_interestRate || '',
        downpayment: customer.proposal_downpayment || '',
        loanTenure: customer.proposal_loanTenure || '',
        loanAmount: customer.proposal_loanAmount || '',
        adminFee: customer.proposal_adminFee || '',
        referralFee: customer.proposal_referralFee || '',
        tradeInModel: customer.proposal_tradeInModel || '',
        lowLoanSurcharge: customer.proposal_lowLoanSurcharge || '',
        tradeInCarPlate: customer.proposal_tradeInCarPlate || '',
        noLoanSurcharge: customer.proposal_noLoanSurcharge || '',
        quotedTradeInPrice: customer.proposal_quotedTradeInPrice || '',
        benefit1: customer.proposal_benefit1 || '',
        benefit2: customer.proposal_benefit2 || '',
        benefit3: customer.proposal_benefit3 || '',
        benefit4: customer.proposal_benefit4 || '',
        benefit5: customer.proposal_benefit5 || '',
        benefitsGiven: customer.proposal_benefitsGiven || '',
        remarks: customer.proposal_remarks || '',
      };
      setProposalFormData(formData);
      setOriginalProposalData(formData);
    }
  }, [customer?.id]);

  // Initialize VSA form data when customer changes
  useEffect(() => {
    if (customer) {
      const formData = {
        makeModel: customer.vsa_makeModel || '',
        yom: customer.vsa_yom || '',
        bodyColour: customer.vsa_bodyColour || '',
        upholstery: customer.vsa_upholstery || '',
        przType: customer.vsa_przType || '',
        package: customer.vsa_package || '',
        sellingWithCOE: customer.vsa_sellingWithCOE || '',
        sellingPriceList: customer.vsa_sellingPriceList || '',
        purchasePriceWithCOE: customer.vsa_purchasePriceWithCOE || '',
        coeRebateLevel: customer.vsa_coeRebateLevel || '',
        deposit: customer.vsa_deposit || '',
        lessOthers: customer.vsa_lessOthers || '',
        addOthers: customer.vsa_addOthers || '',
        deliveryDate: customer.vsa_deliveryDate || '',
        tradeInCarNo: customer.vsa_tradeInCarNo || '',
        tradeInCarModel: customer.vsa_tradeInCarModel || '',
        tradeInAmount: customer.vsa_tradeInAmount || '',
        tradeInOwnerNotCustomer: customer.vsa_tradeInOwnerNotCustomer || false,
        tradeInOwnerName: customer.vsa_tradeInOwnerName || '',
        tradeInOwnerNric: customer.vsa_tradeInOwnerNric || '',
        tradeInOwnerMobile: customer.vsa_tradeInOwnerMobile || '',
        tradeInInsuranceCompany: customer.vsa_tradeInInsuranceCompany || '',
        tradeInPolicyNumber: customer.vsa_tradeInPolicyNumber || '',
        dateOfRegistration: customer.vsa_dateOfRegistration || '',
        registrationNo: customer.vsa_registrationNo || '',
        chassisNo: customer.vsa_chassisNo || '',
        engineNo: customer.vsa_engineNo || '',
        motorNo: customer.vsa_motorNo || '',
        insuranceCompany: customer.vsa_insuranceCompany || '',
        insuranceFee: customer.vsa_insuranceFee || '',
        remarks1: customer.vsa_remarks1 || '',
        remarks2: customer.vsa_remarks2 || '',
        loanAmount: customer.vsa_loanAmount || '',
        interest: customer.vsa_interest || '',
        tenure: customer.vsa_tenure || '',
        adminFee: customer.vsa_adminFee || '',
        insuranceSubsidy: customer.vsa_insuranceSubsidy || '',
        monthlyRepayment: customer.vsa_monthlyRepayment || '',
      };
      setVsaFormData(formData);
      setOriginalVsaData(formData);
    }
  }, [customer?.id]);

  // Check if details form has changes (including guarantors) - memoized to prevent expensive JSON comparisons on every render
  const hasDetailsChanges = useMemo(() => {
    if (!originalDetailsData) return false;
    const detailsChanged = JSON.stringify(detailsFormData) !== JSON.stringify(originalDetailsData);
    const guarantorsChanged = JSON.stringify(guarantors) !== JSON.stringify(originalGuarantors);
    return detailsChanged || guarantorsChanged;
  }, [detailsFormData, originalDetailsData, guarantors, originalGuarantors]);

  // Check if proposal form has changes - memoized
  const hasProposalChanges = useMemo(() => {
    if (!originalProposalData) return false;
    return JSON.stringify(proposalFormData) !== JSON.stringify(originalProposalData);
  }, [proposalFormData, originalProposalData]);

  // Check if VSA form has changes - memoized
  const hasVsaChanges = useMemo(() => {
    if (!originalVsaData) return false;
    return JSON.stringify(vsaFormData) !== JSON.stringify(originalVsaData);
  }, [vsaFormData, originalVsaData]);

  // Handle details form field change - memoized to prevent child re-renders
  const handleDetailsChange = useCallback((e) => {
    const { name, value } = e.target;
    setDetailsFormData((prev) => ({ ...prev, [name]: value }));
    setDetailsErrors((prev) => prev[name] ? { ...prev, [name]: '' } : prev);
  }, []);

  // Guarantor helper functions
  const createEmptyGuarantor = () => ({
    name: '',
    phone: '',
    email: '',
    nric: '',
    occupation: '',
    dob: '',
    address: '',
    addressContinue: '',
  });

  const addGuarantor = () => {
    if (guarantors.length < 5) {
      const newGuarantor = createEmptyGuarantor();
      const newIndex = guarantors.length;
      setGuarantors([...guarantors, newGuarantor]);
      setExpandedGuarantors(prev => ({ ...prev, [newIndex]: true }));
    }
  };

  const removeGuarantor = (index) => {
    setGuarantors(guarantors.filter((_, i) => i !== index));
    setExpandedGuarantors(prev => {
      const updated = {};
      Object.keys(prev).forEach(key => {
        const keyNum = parseInt(key);
        if (keyNum < index) updated[keyNum] = prev[keyNum];
        else if (keyNum > index) updated[keyNum - 1] = prev[keyNum];
      });
      return updated;
    });
  };

  const handleGuarantorChange = (index, field, value) => {
    setGuarantors(prev => prev.map((g, i) =>
      i === index ? { ...g, [field]: value } : g
    ));
  };

  const toggleGuarantorExpanded = (index) => {
    setExpandedGuarantors(prev => ({ ...prev, [index]: !prev[index] }));
  };

  // Handle proposal form field change - memoized
  const handleProposalChange = useCallback((e) => {
    const { name, value } = e.target;
    setProposalFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  // Handle VSA form field change - memoized
  const handleVsaChange = useCallback((e) => {
    const { name, value } = e.target;
    setVsaFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  // Validate details form
  const validateDetails = () => {
    const newErrors = {};
    if (!detailsFormData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!detailsFormData.phone.trim()) {
      newErrors.phone = 'Contact number is required';
    }
    if (detailsFormData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(detailsFormData.email)) {
      newErrors.email = 'Invalid email format';
    }
    setDetailsErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Save details changes
  const handleDetailsSave = async () => {
    if (!validateDetails()) return;
    if (!customer) return;

    setIsSubmitting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const updateData = { ...detailsFormData, guarantors };
      updateCustomer(customer.id, updateData);
      saveToLocalStorage();

      if (isSignedIn && customer.driveFolderId) {
        const updatedCustomer = customers.find(c => c.id === customer.id);
        if (updatedCustomer) {
          await saveCustomerToFolder({ ...updatedCustomer, ...updateData }, isSignedIn);
        }
      }

      setOriginalDetailsData(detailsFormData);
      setOriginalGuarantors(JSON.parse(JSON.stringify(guarantors)));
      toast.success('Customer details saved successfully');
    } catch (error) {
      console.error('Error updating customer:', error);
      toast.error('Failed to update customer. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancel details changes
  const handleDetailsCancel = () => {
    if (originalDetailsData) {
      setDetailsFormData(originalDetailsData);
      setGuarantors(JSON.parse(JSON.stringify(originalGuarantors)));
      setExpandedGuarantors({});
      setDetailsErrors({});
    }
  };

  // Save proposal changes
  const handleProposalSave = async () => {
    if (!customer) return;

    setIsSubmitting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Convert proposalFormData to customer fields with proposal_ prefix
      const updates = {};
      Object.keys(proposalFormData).forEach((key) => {
        updates[`proposal_${key}`] = proposalFormData[key];
      });

      updateCustomer(customer.id, updates);
      saveToLocalStorage();

      if (isSignedIn && customer.driveFolderId) {
        const updatedCustomer = customers.find(c => c.id === customer.id);
        if (updatedCustomer) {
          await saveCustomerToFolder({ ...updatedCustomer, ...updates }, isSignedIn);
        }
      }

      setOriginalProposalData(proposalFormData);
      toast.success('Proposal details saved successfully');
    } catch (error) {
      console.error('Error updating proposal:', error);
      toast.error('Failed to update proposal. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancel proposal changes
  const handleProposalCancel = () => {
    if (originalProposalData) {
      setProposalFormData(originalProposalData);
    }
  };

  // Save VSA changes
  const handleVsaSave = async () => {
    if (!customer) return;

    setIsSubmitting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Convert vsaFormData to customer fields with vsa_ prefix
      const updates = {};
      Object.keys(vsaFormData).forEach((key) => {
        updates[`vsa_${key}`] = vsaFormData[key];
      });

      updateCustomer(customer.id, updates);
      saveToLocalStorage();

      if (isSignedIn && customer.driveFolderId) {
        const updatedCustomer = customers.find(c => c.id === customer.id);
        if (updatedCustomer) {
          await saveCustomerToFolder({ ...updatedCustomer, ...updates }, isSignedIn);
        }
      }

      setOriginalVsaData(vsaFormData);
      toast.success('VSA details saved successfully');
    } catch (error) {
      console.error('Error updating VSA:', error);
      toast.error('Failed to update VSA. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancel VSA changes
  const handleVsaCancel = () => {
    if (originalVsaData) {
      setVsaFormData(originalVsaData);
    }
  };

  // Load documents when Documents tab is active
  useEffect(() => {
    if (activeTab === 'documents' && customer && isSignedIn) {
      // Reset to root folder when switching to documents tab
      setCurrentFolderId(customer.driveFolderId);
      setFolderPath([{ id: customer.driveFolderId, name: customer.name }]);
    }
  }, [activeTab, customer, isSignedIn]);

  // Load documents when current folder changes
  useEffect(() => {
    if (activeTab === 'documents' && currentFolderId && isSignedIn && customer) {
      // Check if we're at the root folder to determine if we should use recursive listing
      const isRootFolder = currentFolderId === customer.driveFolderId;
      loadCustomerDocuments(currentFolderId, isRootFolder);
    }
  }, [currentFolderId, activeTab, isSignedIn, customer]);

  const loadCustomerDocuments = async (folderId, isRootFolder = false) => {
    if (!folderId) {
      setDocuments([]);
      return;
    }

    setLoadingDocuments(true);

    try {
      let allFiles = [];

      // At root folder: show all files from all subfolders recursively
      // In subfolder: show only direct children
      if (isRootFolder) {
        // Use recursive listing to get files from all subfolders
        const recursiveFiles = await driveService.listAllFilesRecursively(folderId);

        // Also get direct children (including folders) for folder navigation
        const response = await window.gapi.client.drive.files.list({
          q: `'${folderId}' in parents and trashed=false`,
          fields: 'files(id, name, mimeType, size, createdTime, webViewLink, iconLink)',
          pageSize: 1000,
        });

        const directChildren = response.result.files || [];
        const folders = directChildren.filter(f => f.mimeType === 'application/vnd.google-apps.folder');

        // Combine folders and recursive files
        allFiles = [...folders, ...recursiveFiles];
      } else {
        // Standard direct-children listing for subfolders
        let pageToken = null;
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
        } while (pageToken);
      }

      // Sort folders first, then files, both alphabetically
      allFiles.sort((a, b) => {
        const aIsFolder = a.mimeType === 'application/vnd.google-apps.folder';
        const bIsFolder = b.mimeType === 'application/vnd.google-apps.folder';

        if (aIsFolder && !bIsFolder) return -1;
        if (!aIsFolder && bIsFolder) return 1;
        return a.name.localeCompare(b.name);
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
    // Reload documents if we're on the documents tab
    if (currentFolderId && customer) {
      const isRootFolder = currentFolderId === customer.driveFolderId;
      loadCustomerDocuments(currentFolderId, isRootFolder);
    }
  };

  // Delete document
  const handleDeleteDocument = async (doc) => {
    // Protect customer.json files from deletion
    if (doc.name === 'customer.json') {
      toast.warning('Cannot delete customer.json - this file is protected');
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

      // Refresh the current folder
      const isRootFolder = currentFolderId === customer?.driveFolderId;
      await loadCustomerDocuments(currentFolderId, isRootFolder);

      toast.success('Document deleted successfully');
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Failed to delete document. Please try again.');
    }
  };

  // Long press to show folder menu
  const handleTouchStart = (e, item) => {
    // Prevent dragging customer.json files
    if (item.name === 'customer.json') {
      return;
    }

    // Prevent default context menu
    e.preventDefault();

    // Start long press timer
    longPressTimerRef.current = setTimeout(() => {
      setSelectedFileToMove(item);
      setShowFolderMenu(true);
    }, 500);
  };

  const handleTouchMove = () => {
    // Cancel long press if user moves finger
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTouchEnd = () => {
    // Clear long press timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Move file to selected folder
  const handleMoveToFolder = async (targetFolder) => {
    if (!selectedFileToMove || !targetFolder) {
      return;
    }

    try {
      await window.gapi.client.drive.files.update({
        fileId: selectedFileToMove.id,
        addParents: targetFolder.id,
        removeParents: currentFolderId,
      });

      const isRootFolder = currentFolderId === customer?.driveFolderId;
      await loadCustomerDocuments(currentFolderId, isRootFolder);
      setShowFolderMenu(false);
      setSelectedFileToMove(null);
    } catch (error) {
      toast.error(`Failed to move file: ${error.message}`);
    }
  };

  // Delete selected file
  const handleDeleteFromMenu = async () => {
    if (!selectedFileToMove) return;

    await handleDeleteDocument(selectedFileToMove);
    setShowFolderMenu(false);
    setSelectedFileToMove(null);
  };

  // Desktop menu handlers
  const handleMenuToggle = (e, item) => {
    e.stopPropagation();
    if (openMenuId === item.id) {
      setOpenMenuId(null);
    } else {
      setOpenMenuId(item.id);
    }
  };

  const handleCloseMenu = () => {
    setOpenMenuId(null);
  };

  const handleMenuMove = (item) => {
    setSelectedFileToMove(item);
    setShowFolderMenu(true);
    setOpenMenuId(null);
  };

  const handleMenuRename = (item) => {
    setRenamingItem(item);
    setRenameValue(item.name);
    setShowRenameModal(true);
    setOpenMenuId(null);
  };

  const handleMenuDelete = async (item) => {
    setOpenMenuId(null);
    await handleDeleteDocument(item);
  };

  const handleRenameSubmit = async () => {
    if (!renamingItem || !renameValue.trim()) return;

    try {
      // Rename via Google Drive API
      await window.gapi.client.drive.files.update({
        fileId: renamingItem.id,
        resource: {
          name: renameValue.trim()
        }
      });

      // Reload documents
      const targetFolderId = folderPath.length > 0
        ? folderPath[folderPath.length - 1].id
        : customer.driveFolderId;
      const isRootFolder = targetFolderId === customer?.driveFolderId;
      await loadCustomerDocuments(targetFolderId, isRootFolder);

      setShowRenameModal(false);
      setRenamingItem(null);
      setRenameValue('');
    } catch (error) {
      toast.error(`Failed to rename: ${error.message}`);
    }
  };

  const handleRenameCancelModal = () => {
    setShowRenameModal(false);
    setRenamingItem(null);
    setRenameValue('');
  };

  // Click to open/view
  const handleItemClick = (item) => {
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
    setDropTargetBreadcrumb(null);
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

  // Breadcrumb drag handlers (for moving files to parent/ancestor folders)
  const handleBreadcrumbDragOver = (e, folder, index) => {
    e.preventDefault();
    e.stopPropagation();
    // Don't allow drop on current folder (last breadcrumb)
    if (index === folderPath.length - 1) return;
    e.dataTransfer.dropEffect = 'move';
    setDropTargetBreadcrumb(folder.id);
  };

  const handleBreadcrumbDragLeave = (e) => {
    e.preventDefault();
    setDropTargetBreadcrumb(null);
  };

  const handleBreadcrumbDrop = async (e, targetFolder, index) => {
    e.preventDefault();
    e.stopPropagation();

    // Don't allow drop on current folder
    if (index === folderPath.length - 1) {
      setDropTargetBreadcrumb(null);
      return;
    }

    if (!draggedFile || !targetFolder) {
      setDropTargetBreadcrumb(null);
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
      const isRootFolder = currentFolderId === customer?.driveFolderId;
      await loadCustomerDocuments(currentFolderId, isRootFolder);
    } catch (error) {
      toast.error(`Failed to move file: ${error.message}`);
    } finally {
      setDraggedFile(null);
      setDropTargetFolder(null);
      setDropTargetBreadcrumb(null);
      setIsDragMode(false);
    }
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
      const isRootFolder = currentFolderId === customer?.driveFolderId;
      await loadCustomerDocuments(currentFolderId, isRootFolder);
    } catch (error) {
      toast.error(`Failed to move file: ${error.message}`);
    } finally {
      setDraggedFile(null);
      setDropTargetFolder(null);
      setDropTargetBreadcrumb(null);
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

  const handleDelete = () => {
    setIsDeleteModalOpen(true);
  };

  const handleExcelPopulate = () => {
    setIsExcelModalOpen(true);
  };

  const handleCloseExcelModal = () => {
    setIsExcelModalOpen(false);
  };

  const handlePrintDocuments = () => {
    setIsPrintManagerOpen(true);
  };

  const handleClosePrintManager = () => {
    setIsPrintManagerOpen(false);
  };


  const handleCloseDeleteModal = () => {
    if (!isSubmitting) {
      setIsDeleteModalOpen(false);
      setDeleteFolderChecked(false); // Reset checkbox
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
            await driveService.deleteFolder(customer.driveFolderId);
          } catch {
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
            }
          } catch {
            // Continue anyway - the customer will still be removed from the system
          }
        }
      }

      // Delete customer record and update Drive index
      await new Promise((resolve) => setTimeout(resolve, 300));
      await deleteCustomerHybrid(customer.id, isSignedIn);
      setIsDeleteModalOpen(false);
      setDeleteFolderChecked(false); // Reset checkbox
      toast.success('Customer deleted successfully');
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast.error('Failed to delete customer. Please try again.');
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
                      handlePrintDocuments();
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 6 2 18 2 18 9"></polyline>
                      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                      <rect x="6" y="14" width="12" height="8"></rect>
                    </svg>
                    <span>Print Documents ⭐</span>
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
                  <div className="action-menu-divider"></div>
                  <button
                    className="action-menu-item action-menu-item-danger"
                    onClick={() => {
                      setShowActionsMenu(false);
                      handleDelete();
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      <line x1="10" y1="11" x2="10" y2="17"></line>
                      <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                    <span>Delete Customer</span>
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
            className={`tab ${activeTab === 'status' ? 'active' : ''}`}
            onClick={() => setActiveTab('status')}
          >
            Status
          </button>
          <button
            className={`tab tab-icon ${activeTab === 'documents' ? 'active' : ''}`}
            onClick={() => setActiveTab('documents')}
            title="Documents"
          >
            <FolderOpen size={18} />
            {!isSignedIn && <span className="lock-icon">🔒</span>}
          </button>
          <button
            className={`tab tab-icon ${activeTab === 'scanner' ? 'active' : ''}`}
            onClick={() => setActiveTab('scanner')}
            title="Scanner"
          >
            <ScanLine size={18} />
            {!isSignedIn && <span className="lock-icon">🔒</span>}
          </button>
        </div>

        {/* Tab Content */}
        <div className="customer-details-content">
          {activeTab === 'details' ? (
            <>
              <div className="info-section">
                <h3>Contact Information</h3>
                <div className="inline-edit-grid">
                  <div className="inline-edit-item">
                    <label htmlFor="name">Name <span className="required">*</span></label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={detailsFormData.name}
                      onChange={handleDetailsChange}
                      className={detailsErrors.name ? 'error' : ''}
                      disabled={isSubmitting}
                    />
                    {detailsErrors.name && <span className="error-message">{detailsErrors.name}</span>}
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="phone">Phone <span className="required">*</span></label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={detailsFormData.phone}
                      onChange={handleDetailsChange}
                      className={detailsErrors.phone ? 'error' : ''}
                      disabled={isSubmitting}
                    />
                    {detailsErrors.phone && <span className="error-message">{detailsErrors.phone}</span>}
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="email">Email</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={detailsFormData.email}
                      onChange={handleDetailsChange}
                      className={detailsErrors.email ? 'error' : ''}
                      disabled={isSubmitting}
                    />
                    {detailsErrors.email && <span className="error-message">{detailsErrors.email}</span>}
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="nric">NRIC/FIN</label>
                    <input
                      type="text"
                      id="nric"
                      name="nric"
                      value={detailsFormData.nric}
                      onChange={handleDetailsChange}
                      placeholder="S1234567A or F1234567N"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="dob">Date of Birth</label>
                    <input
                      type="date"
                      id="dob"
                      name="dob"
                      value={detailsFormData.dob}
                      onChange={handleDetailsChange}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </div>

              <div className="info-section">
                <h3>Additional Information</h3>
                <div className="inline-edit-grid">
                  <div className="inline-edit-item">
                    <label htmlFor="occupation">Occupation</label>
                    <input
                      type="text"
                      id="occupation"
                      name="occupation"
                      value={detailsFormData.occupation}
                      onChange={handleDetailsChange}
                      placeholder="e.g., Engineer, Teacher"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="salesConsultant">Sales Consultant</label>
                    <input
                      type="text"
                      id="salesConsultant"
                      name="salesConsultant"
                      value={detailsFormData.salesConsultant}
                      onChange={handleDetailsChange}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="vsaNo">VSA No</label>
                    <input
                      type="text"
                      id="vsaNo"
                      name="vsaNo"
                      value={detailsFormData.vsaNo}
                      onChange={handleDetailsChange}
                      placeholder="VSA Number"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </div>

              <div className="info-section">
                <h3>Address</h3>
                <div className="inline-edit-grid">
                  <div className="inline-edit-item">
                    <label htmlFor="address">Address</label>
                    <input
                      type="text"
                      id="address"
                      name="address"
                      value={detailsFormData.address}
                      onChange={handleDetailsChange}
                      placeholder="e.g., 99 YISHUN AVE 1, 13-39"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="addressContinue">Address Continue</label>
                    <input
                      type="text"
                      id="addressContinue"
                      name="addressContinue"
                      value={detailsFormData.addressContinue}
                      onChange={handleDetailsChange}
                      placeholder="e.g., SINGAPORE 769139"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </div>

              <div className="info-section">
                <h3>Notes</h3>
                <div className="inline-edit-full">
                  <textarea
                    id="notes"
                    name="notes"
                    value={detailsFormData.notes}
                    onChange={handleDetailsChange}
                    rows="3"
                    disabled={isSubmitting}
                    placeholder="Add notes about this customer..."
                  />
                </div>
              </div>

              {/* Guarantors Section */}
              <div className="info-section">
                <div className="section-header-with-action">
                  <h3>Guarantors ({guarantors.length}/5)</h3>
                  {guarantors.length < 5 && (
                    <button
                      type="button"
                      className="btn btn-add-small"
                      onClick={addGuarantor}
                      disabled={isSubmitting}
                    >
                      + Add Guarantor
                    </button>
                  )}
                </div>

                {guarantors.length === 0 ? (
                  <p className="empty-state-text">No guarantors added. Click "+ Add Guarantor" to add one.</p>
                ) : (
                  <div className="guarantors-list">
                    {guarantors.map((guarantor, index) => (
                      <div key={index} className="guarantor-card">
                        <div
                          className="guarantor-header"
                          onClick={() => toggleGuarantorExpanded(index)}
                        >
                          <div className="guarantor-header-left">
                            <span className={`expand-icon ${expandedGuarantors[index] ? 'expanded' : ''}`}>▶</span>
                            <span className="guarantor-title">
                              Guarantor {index + 1}{guarantor.name ? `: ${guarantor.name}` : ''}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="btn-remove-guarantor"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeGuarantor(index);
                            }}
                            disabled={isSubmitting}
                          >
                            ✕
                          </button>
                        </div>

                        {expandedGuarantors[index] && (
                          <div className="guarantor-content">
                            <div className="inline-edit-grid">
                              <div className="inline-edit-item">
                                <label>Name</label>
                                <input
                                  type="text"
                                  value={guarantor.name}
                                  onChange={(e) => handleGuarantorChange(index, 'name', e.target.value)}
                                  placeholder="Full name"
                                  disabled={isSubmitting}
                                />
                              </div>
                              <div className="inline-edit-item">
                                <label>Contact Number</label>
                                <input
                                  type="text"
                                  value={guarantor.phone}
                                  onChange={(e) => handleGuarantorChange(index, 'phone', e.target.value)}
                                  placeholder="e.g., 91234567"
                                  disabled={isSubmitting}
                                />
                              </div>
                              <div className="inline-edit-item">
                                <label>Email</label>
                                <input
                                  type="email"
                                  value={guarantor.email}
                                  onChange={(e) => handleGuarantorChange(index, 'email', e.target.value)}
                                  placeholder="email@example.com"
                                  disabled={isSubmitting}
                                />
                              </div>
                              <div className="inline-edit-item">
                                <label>NRIC/FIN</label>
                                <input
                                  type="text"
                                  value={guarantor.nric}
                                  onChange={(e) => handleGuarantorChange(index, 'nric', e.target.value)}
                                  placeholder="S1234567A"
                                  disabled={isSubmitting}
                                />
                              </div>
                              <div className="inline-edit-item">
                                <label>Occupation</label>
                                <input
                                  type="text"
                                  value={guarantor.occupation}
                                  onChange={(e) => handleGuarantorChange(index, 'occupation', e.target.value)}
                                  placeholder="e.g., Engineer"
                                  disabled={isSubmitting}
                                />
                              </div>
                              <div className="inline-edit-item">
                                <label>Date of Birth</label>
                                <input
                                  type="date"
                                  value={guarantor.dob}
                                  onChange={(e) => handleGuarantorChange(index, 'dob', e.target.value)}
                                  disabled={isSubmitting}
                                />
                              </div>
                              <div className="inline-edit-item">
                                <label>Address</label>
                                <input
                                  type="text"
                                  value={guarantor.address}
                                  onChange={(e) => handleGuarantorChange(index, 'address', e.target.value)}
                                  placeholder="Street address"
                                  disabled={isSubmitting}
                                />
                              </div>
                              <div className="inline-edit-item">
                                <label>Address Continue</label>
                                <input
                                  type="text"
                                  value={guarantor.addressContinue}
                                  onChange={(e) => handleGuarantorChange(index, 'addressContinue', e.target.value)}
                                  placeholder="e.g., SINGAPORE 123456"
                                  disabled={isSubmitting}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="details-actions">
                <div className="details-actions-right">
                  {hasDetailsChanges && (
                    <button
                      className="btn btn-secondary"
                      onClick={handleDetailsCancel}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    className="btn btn-primary"
                    onClick={handleDetailsSave}
                    disabled={isSubmitting || !hasDetailsChanges}
                  >
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </>
          ) : activeTab === 'proposal' ? (
            /* Proposal Tab - Inline Editing */
            <>
              <div className="info-section">
                <h3>Proposal Information</h3>
                <div className="inline-edit-grid">
                  <div className="inline-edit-item">
                    <label htmlFor="proposal_model">Model</label>
                    <select
                      id="proposal_model"
                      name="model"
                      value={proposalFormData.model}
                      onChange={handleProposalChange}
                      disabled={isSubmitting}
                    >
                      <option value="">Select Model</option>
                      {VEHICLE_MODELS.map((model) => (
                        <option key={model} value={model}>{model}</option>
                      ))}
                    </select>
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="proposal_bank">Bank</label>
                    <input
                      type="text"
                      id="proposal_bank"
                      name="bank"
                      value={proposalFormData.bank}
                      onChange={handleProposalChange}
                      placeholder="e.g., DBS, OCBC, UOB"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="proposal_sellingPrice">Selling Price</label>
                    <input
                      type="text"
                      id="proposal_sellingPrice"
                      name="sellingPrice"
                      value={proposalFormData.sellingPrice}
                      onChange={handleProposalChange}
                      placeholder="e.g., $200,000"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="proposal_interestRate">Interest Rate</label>
                    <input
                      type="text"
                      id="proposal_interestRate"
                      name="interestRate"
                      value={proposalFormData.interestRate}
                      onChange={handleProposalChange}
                      placeholder="e.g., 2.88%"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="proposal_downpayment">Downpayment</label>
                    <input
                      type="text"
                      id="proposal_downpayment"
                      name="downpayment"
                      value={proposalFormData.downpayment}
                      onChange={handleProposalChange}
                      placeholder="e.g., $50,000"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="proposal_loanTenure">Loan Tenure</label>
                    <input
                      type="text"
                      id="proposal_loanTenure"
                      name="loanTenure"
                      value={proposalFormData.loanTenure}
                      onChange={handleProposalChange}
                      placeholder="e.g., 84 months"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </div>

              <div className="info-section">
                <h3>Loan & Fee Details</h3>
                <div className="inline-edit-grid">
                  <div className="inline-edit-item">
                    <label htmlFor="proposal_loanAmount">Loan Amount</label>
                    <input
                      type="text"
                      id="proposal_loanAmount"
                      name="loanAmount"
                      value={proposalFormData.loanAmount}
                      onChange={handleProposalChange}
                      placeholder="e.g., $150,000"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="proposal_adminFee">Admin Fee</label>
                    <input
                      type="text"
                      id="proposal_adminFee"
                      name="adminFee"
                      value={proposalFormData.adminFee}
                      onChange={handleProposalChange}
                      placeholder="e.g., $500"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="proposal_referralFee">Referral Fee</label>
                    <input
                      type="text"
                      id="proposal_referralFee"
                      name="referralFee"
                      value={proposalFormData.referralFee}
                      onChange={handleProposalChange}
                      placeholder="e.g., $1,000"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </div>

              <div className="info-section">
                <h3>Trade-In Details</h3>
                <div className="inline-edit-grid">
                  <div className="inline-edit-item">
                    <label htmlFor="proposal_tradeInModel">Trade In Model</label>
                    <input
                      type="text"
                      id="proposal_tradeInModel"
                      name="tradeInModel"
                      value={proposalFormData.tradeInModel}
                      onChange={handleProposalChange}
                      placeholder="e.g., Toyota Camry"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="proposal_tradeInCarPlate">Trade In Car Plate</label>
                    <input
                      type="text"
                      id="proposal_tradeInCarPlate"
                      name="tradeInCarPlate"
                      value={proposalFormData.tradeInCarPlate}
                      onChange={handleProposalChange}
                      placeholder="e.g., SXX1234A"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="proposal_quotedTradeInPrice">Quoted Trade In Price</label>
                    <input
                      type="text"
                      id="proposal_quotedTradeInPrice"
                      name="quotedTradeInPrice"
                      value={proposalFormData.quotedTradeInPrice}
                      onChange={handleProposalChange}
                      placeholder="e.g., $30,000"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="proposal_lowLoanSurcharge">Low Loan Surcharge</label>
                    <input
                      type="text"
                      id="proposal_lowLoanSurcharge"
                      name="lowLoanSurcharge"
                      value={proposalFormData.lowLoanSurcharge}
                      onChange={handleProposalChange}
                      placeholder="e.g., $2,000"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="proposal_noLoanSurcharge">No Loan Surcharge</label>
                    <input
                      type="text"
                      id="proposal_noLoanSurcharge"
                      name="noLoanSurcharge"
                      value={proposalFormData.noLoanSurcharge}
                      onChange={handleProposalChange}
                      placeholder="e.g., $3,000"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </div>

              <div className="info-section">
                <h3>Benefits</h3>
                <div className="inline-edit-grid">
                  <div className="inline-edit-item">
                    <label htmlFor="proposal_benefit1">Benefit 1</label>
                    <select
                      id="proposal_benefit1"
                      name="benefit1"
                      value={proposalFormData.benefit1}
                      onChange={handleProposalChange}
                      disabled={isSubmitting}
                    >
                      <option value="">Select Benefit</option>
                      {BENEFITS_OPTIONS.map((benefit) => (
                        <option key={benefit} value={benefit}>{benefit}</option>
                      ))}
                    </select>
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="proposal_benefit2">Benefit 2</label>
                    <select
                      id="proposal_benefit2"
                      name="benefit2"
                      value={proposalFormData.benefit2}
                      onChange={handleProposalChange}
                      disabled={isSubmitting}
                    >
                      <option value="">Select Benefit</option>
                      {BENEFITS_OPTIONS.map((benefit) => (
                        <option key={benefit} value={benefit}>{benefit}</option>
                      ))}
                    </select>
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="proposal_benefit3">Benefit 3</label>
                    <select
                      id="proposal_benefit3"
                      name="benefit3"
                      value={proposalFormData.benefit3}
                      onChange={handleProposalChange}
                      disabled={isSubmitting}
                    >
                      <option value="">Select Benefit</option>
                      {BENEFITS_OPTIONS.map((benefit) => (
                        <option key={benefit} value={benefit}>{benefit}</option>
                      ))}
                    </select>
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="proposal_benefit4">Benefit 4</label>
                    <select
                      id="proposal_benefit4"
                      name="benefit4"
                      value={proposalFormData.benefit4}
                      onChange={handleProposalChange}
                      disabled={isSubmitting}
                    >
                      <option value="">Select Benefit</option>
                      {BENEFITS_OPTIONS.map((benefit) => (
                        <option key={benefit} value={benefit}>{benefit}</option>
                      ))}
                    </select>
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="proposal_benefit5">Benefit 5</label>
                    <select
                      id="proposal_benefit5"
                      name="benefit5"
                      value={proposalFormData.benefit5}
                      onChange={handleProposalChange}
                      disabled={isSubmitting}
                    >
                      <option value="">Select Benefit</option>
                      {BENEFITS_OPTIONS.map((benefit) => (
                        <option key={benefit} value={benefit}>{benefit}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="info-section">
                <h3>Additional Information</h3>
                <div className="inline-edit-full">
                  <label htmlFor="proposal_benefitsGiven">Benefits Given (Notes)</label>
                  <textarea
                    id="proposal_benefitsGiven"
                    name="benefitsGiven"
                    value={proposalFormData.benefitsGiven}
                    onChange={handleProposalChange}
                    rows="3"
                    disabled={isSubmitting}
                    placeholder="List any additional benefits or promotions included in this proposal..."
                  />
                </div>
                <div className="inline-edit-full" style={{ marginTop: '1rem' }}>
                  <label htmlFor="proposal_remarks">Remarks</label>
                  <textarea
                    id="proposal_remarks"
                    name="remarks"
                    value={proposalFormData.remarks}
                    onChange={handleProposalChange}
                    rows="3"
                    disabled={isSubmitting}
                    placeholder="Additional notes or remarks about this proposal..."
                  />
                </div>
              </div>

              <div className="details-actions">
                <div></div>
                <div className="details-actions-right">
                  {hasProposalChanges && (
                    <button
                      className="btn btn-secondary"
                      onClick={handleProposalCancel}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    className="btn btn-primary"
                    onClick={handleProposalSave}
                    disabled={isSubmitting || !hasProposalChanges}
                  >
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </>
          ) : activeTab === 'vsa' ? (
            /* VSA Tab - Inline Editing */
            <>
              <div className="info-section">
                <h3>BYD New Car Details</h3>
                <div className="inline-edit-grid">
                  <div className="inline-edit-item">
                    <label htmlFor="vsa_makeModel">Make & Model</label>
                    <select
                      id="vsa_makeModel"
                      name="makeModel"
                      value={vsaFormData.makeModel}
                      onChange={handleVsaChange}
                      disabled={isSubmitting}
                    >
                      <option value="">Select a model...</option>
                      {VEHICLE_MODELS.map((model) => (
                        <option key={model} value={model}>{model}</option>
                      ))}
                    </select>
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="vsa_yom">Year of Manufacture</label>
                    <input
                      type="text"
                      id="vsa_yom"
                      name="yom"
                      value={vsaFormData.yom}
                      onChange={handleVsaChange}
                      placeholder="e.g., 2024"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="vsa_bodyColour">Body Colour</label>
                    <select
                      id="vsa_bodyColour"
                      name="bodyColour"
                      value={vsaFormData.bodyColour}
                      onChange={handleVsaChange}
                      disabled={isSubmitting}
                    >
                      <option value="">Select a colour...</option>
                      {BODY_COLOURS.map((colour) => (
                        <option key={colour} value={colour}>{colour}</option>
                      ))}
                    </select>
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="vsa_upholstery">Upholstery</label>
                    <input
                      type="text"
                      id="vsa_upholstery"
                      name="upholstery"
                      value={vsaFormData.upholstery}
                      onChange={handleVsaChange}
                      placeholder="e.g., Black Leather"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="vsa_przType">P/R/Z Type</label>
                    <select
                      id="vsa_przType"
                      name="przType"
                      value={vsaFormData.przType}
                      onChange={handleVsaChange}
                      disabled={isSubmitting}
                    >
                      <option value="">Select type...</option>
                      <option value="P - Passenger Motor Car">P - Passenger Motor Car</option>
                      <option value="R - Rental / Leasing">R - Rental / Leasing</option>
                      <option value="Z - Private Hire">Z - Private Hire</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="info-section">
                <h3>BYD New Car Package</h3>
                <div className="inline-edit-grid">
                  <div className="inline-edit-item">
                    <label htmlFor="vsa_package">Package</label>
                    <input
                      type="text"
                      id="vsa_package"
                      name="package"
                      value={vsaFormData.package}
                      onChange={handleVsaChange}
                      placeholder="e.g., Premium Package"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="vsa_sellingWithCOE">Selling with COE</label>
                    <select
                      id="vsa_sellingWithCOE"
                      name="sellingWithCOE"
                      value={vsaFormData.sellingWithCOE}
                      onChange={handleVsaChange}
                      disabled={isSubmitting}
                    >
                      <option value="">Select...</option>
                      <option value="WITH">WITH</option>
                      <option value="WITHOUT">WITHOUT</option>
                    </select>
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="vsa_sellingPriceList">Selling Price on Price List</label>
                    <input
                      type="text"
                      id="vsa_sellingPriceList"
                      name="sellingPriceList"
                      value={vsaFormData.sellingPriceList}
                      onChange={handleVsaChange}
                      placeholder="e.g., $245,000"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="vsa_purchasePriceWithCOE">Purchase Price with COE</label>
                    <input
                      type="text"
                      id="vsa_purchasePriceWithCOE"
                      name="purchasePriceWithCOE"
                      value={vsaFormData.purchasePriceWithCOE}
                      onChange={handleVsaChange}
                      placeholder="e.g., $250,000"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="vsa_coeRebateLevel">COE Rebate Level</label>
                    <input
                      type="text"
                      id="vsa_coeRebateLevel"
                      name="coeRebateLevel"
                      value={vsaFormData.coeRebateLevel}
                      onChange={handleVsaChange}
                      placeholder="e.g., Level 1"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="vsa_deposit">Deposit</label>
                    <input
                      type="text"
                      id="vsa_deposit"
                      name="deposit"
                      value={vsaFormData.deposit}
                      onChange={handleVsaChange}
                      placeholder="e.g., $25,000"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="vsa_lessOthers">Less: Others</label>
                    <input
                      type="text"
                      id="vsa_lessOthers"
                      name="lessOthers"
                      value={vsaFormData.lessOthers}
                      onChange={handleVsaChange}
                      placeholder="e.g., $5,000"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="vsa_addOthers">Add: Others</label>
                    <input
                      type="text"
                      id="vsa_addOthers"
                      name="addOthers"
                      value={vsaFormData.addOthers}
                      onChange={handleVsaChange}
                      placeholder="e.g., $2,000"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="vsa_deliveryDate">Approximate Delivery Date</label>
                    <input
                      type="text"
                      id="vsa_deliveryDate"
                      name="deliveryDate"
                      value={vsaFormData.deliveryDate}
                      onChange={handleVsaChange}
                      placeholder="e.g., NOV/DEC 2025"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </div>

              <div className="info-section">
                <h3>Trade In Car Details</h3>
                <div className="inline-edit-grid">
                  <div className="inline-edit-item">
                    <label htmlFor="vsa_tradeInCarNo">Trade in Car No</label>
                    <input
                      type="text"
                      id="vsa_tradeInCarNo"
                      name="tradeInCarNo"
                      value={vsaFormData.tradeInCarNo}
                      onChange={handleVsaChange}
                      placeholder="e.g., ABC1234X"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="vsa_tradeInCarModel">Trade in Car Model</label>
                    <input
                      type="text"
                      id="vsa_tradeInCarModel"
                      name="tradeInCarModel"
                      value={vsaFormData.tradeInCarModel}
                      onChange={handleVsaChange}
                      placeholder="e.g., Toyota Corolla"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="vsa_tradeInAmount">Trade In Amount</label>
                    <input
                      type="text"
                      id="vsa_tradeInAmount"
                      name="tradeInAmount"
                      value={vsaFormData.tradeInAmount}
                      onChange={handleVsaChange}
                      placeholder="e.g., $50,000"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
                <div className="checkbox-row" style={{ marginTop: '16px', marginBottom: '16px' }}>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="tradeInOwnerNotCustomer"
                      checked={vsaFormData.tradeInOwnerNotCustomer}
                      onChange={(e) => setVsaFormData(prev => ({ ...prev, tradeInOwnerNotCustomer: e.target.checked }))}
                      disabled={isSubmitting}
                    />
                    <span>Trade In Owner is not Customer</span>
                  </label>
                </div>
                {vsaFormData.tradeInOwnerNotCustomer && (
                  <div className="inline-edit-grid">
                    <div className="inline-edit-item">
                      <label htmlFor="vsa_tradeInOwnerName">Trade In Owner Name</label>
                      <input
                        type="text"
                        id="vsa_tradeInOwnerName"
                        name="tradeInOwnerName"
                        value={vsaFormData.tradeInOwnerName}
                        onChange={handleVsaChange}
                        placeholder="e.g., John Doe"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="inline-edit-item">
                      <label htmlFor="vsa_tradeInOwnerNric">Trade In Owner NRIC</label>
                      <input
                        type="text"
                        id="vsa_tradeInOwnerNric"
                        name="tradeInOwnerNric"
                        value={vsaFormData.tradeInOwnerNric}
                        onChange={handleVsaChange}
                        placeholder="e.g., S1234567A"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="inline-edit-item">
                      <label htmlFor="vsa_tradeInOwnerMobile">Trade In Owner Mobile</label>
                      <input
                        type="text"
                        id="vsa_tradeInOwnerMobile"
                        name="tradeInOwnerMobile"
                        value={vsaFormData.tradeInOwnerMobile}
                        onChange={handleVsaChange}
                        placeholder="e.g., 91234567"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="inline-edit-item">
                      <label htmlFor="vsa_tradeInInsuranceCompany">Trade In Insurance Company</label>
                      <input
                        type="text"
                        id="vsa_tradeInInsuranceCompany"
                        name="tradeInInsuranceCompany"
                        value={vsaFormData.tradeInInsuranceCompany}
                        onChange={handleVsaChange}
                        placeholder="e.g., AXA, NTUC Income"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="inline-edit-item">
                      <label htmlFor="vsa_tradeInPolicyNumber">Trade In Policy Number</label>
                      <input
                        type="text"
                        id="vsa_tradeInPolicyNumber"
                        name="tradeInPolicyNumber"
                        value={vsaFormData.tradeInPolicyNumber}
                        onChange={handleVsaChange}
                        placeholder="e.g., POL-123456"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="info-section">
                <h3>Delivery Details</h3>
                <div className="inline-edit-grid">
                  <div className="inline-edit-item">
                    <label htmlFor="vsa_dateOfRegistration">Date of Registration</label>
                    <input
                      type="date"
                      id="vsa_dateOfRegistration"
                      name="dateOfRegistration"
                      value={vsaFormData.dateOfRegistration}
                      onChange={handleVsaChange}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="vsa_registrationNo">Registration No</label>
                    <input
                      type="text"
                      id="vsa_registrationNo"
                      name="registrationNo"
                      value={vsaFormData.registrationNo}
                      onChange={handleVsaChange}
                      placeholder="e.g., ABC1234X"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="vsa_chassisNo">Chassis No</label>
                    <input
                      type="text"
                      id="vsa_chassisNo"
                      name="chassisNo"
                      value={vsaFormData.chassisNo}
                      onChange={handleVsaChange}
                      placeholder="e.g., LGXXX12345678"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="vsa_engineNo">Engine No</label>
                    <input
                      type="text"
                      id="vsa_engineNo"
                      name="engineNo"
                      value={vsaFormData.engineNo}
                      onChange={handleVsaChange}
                      placeholder="e.g., ENG123456"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="vsa_motorNo">Motor No</label>
                    <input
                      type="text"
                      id="vsa_motorNo"
                      name="motorNo"
                      value={vsaFormData.motorNo}
                      onChange={handleVsaChange}
                      placeholder="e.g., MOTOR123456"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </div>

              <div className="info-section">
                <h3>Insurance</h3>
                <div className="inline-edit-grid">
                  <div className="inline-edit-item">
                    <label htmlFor="vsa_insuranceCompany">Insurance Company</label>
                    <input
                      type="text"
                      id="vsa_insuranceCompany"
                      name="insuranceCompany"
                      value={vsaFormData.insuranceCompany}
                      onChange={handleVsaChange}
                      placeholder="e.g., AIG Insurance"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="vsa_insuranceFee">Insurance Fee</label>
                    <input
                      type="text"
                      id="vsa_insuranceFee"
                      name="insuranceFee"
                      value={vsaFormData.insuranceFee}
                      onChange={handleVsaChange}
                      placeholder="e.g., $1,200"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </div>

              <div className="info-section">
                <h3>Remarks & Loan Details</h3>
                <div className="inline-edit-full">
                  <label htmlFor="vsa_remarks1">Remarks 1</label>
                  <textarea
                    id="vsa_remarks1"
                    name="remarks1"
                    value={vsaFormData.remarks1}
                    onChange={handleVsaChange}
                    rows="2"
                    disabled={isSubmitting}
                    placeholder="e.g., 4 BIDS GUARANTEED COE. $1000 INSURANCE SUBSIDY FOR THE FIRST YEAR."
                  />
                </div>
                <div className="inline-edit-full" style={{ marginTop: '1rem' }}>
                  <label htmlFor="vsa_remarks2">Remarks 2</label>
                  <textarea
                    id="vsa_remarks2"
                    name="remarks2"
                    value={vsaFormData.remarks2}
                    onChange={handleVsaChange}
                    rows="2"
                    disabled={isSubmitting}
                    placeholder="e.g., BALANCE DEPOSIT TO BE PAID UPON LOAN APPROVAL BEFORE COE BIDDING."
                  />
                </div>
                <div className="inline-edit-grid" style={{ marginTop: '1rem' }}>
                  <div className="inline-edit-item">
                    <label htmlFor="vsa_loanAmount">Loan Amount</label>
                    <input
                      type="text"
                      id="vsa_loanAmount"
                      name="loanAmount"
                      value={vsaFormData.loanAmount}
                      onChange={handleVsaChange}
                      placeholder="e.g., $200,000"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="vsa_interest">Interest</label>
                    <input
                      type="text"
                      id="vsa_interest"
                      name="interest"
                      value={vsaFormData.interest}
                      onChange={handleVsaChange}
                      placeholder="e.g., 2.88%"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="vsa_tenure">Tenure</label>
                    <input
                      type="text"
                      id="vsa_tenure"
                      name="tenure"
                      value={vsaFormData.tenure}
                      onChange={handleVsaChange}
                      placeholder="e.g., 84 months"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="vsa_adminFee">Admin Fee</label>
                    <input
                      type="text"
                      id="vsa_adminFee"
                      name="adminFee"
                      value={vsaFormData.adminFee}
                      onChange={handleVsaChange}
                      placeholder="e.g., $500"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="vsa_insuranceSubsidy">Insurance Subsidy</label>
                    <input
                      type="text"
                      id="vsa_insuranceSubsidy"
                      name="insuranceSubsidy"
                      value={vsaFormData.insuranceSubsidy}
                      onChange={handleVsaChange}
                      placeholder="e.g., $1000"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="inline-edit-item">
                    <label htmlFor="vsa_monthlyRepayment">Monthly Repayment</label>
                    <input
                      type="text"
                      id="vsa_monthlyRepayment"
                      name="monthlyRepayment"
                      value={vsaFormData.monthlyRepayment}
                      onChange={handleVsaChange}
                      placeholder="e.g., $2,500"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </div>

              <div className="details-actions">
                <div></div>
                <div className="details-actions-right">
                  {hasVsaChanges && (
                    <button
                      className="btn btn-secondary"
                      onClick={handleVsaCancel}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    className="btn btn-primary"
                    onClick={handleVsaSave}
                    disabled={isSubmitting || !hasVsaChanges}
                  >
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </>
          ) : activeTab === 'status' ? (
            <MilestoneTracker customer={customer} />
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
                              className={`breadcrumb-item ${index === folderPath.length - 1 ? 'active' : ''} ${dropTargetBreadcrumb === folder.id ? 'drop-target' : ''}`}
                              onClick={() => navigateToBreadcrumb(index)}
                              disabled={index === folderPath.length - 1}
                              onDragOver={(e) => handleBreadcrumbDragOver(e, folder, index)}
                              onDragLeave={handleBreadcrumbDragLeave}
                              onDrop={(e) => handleBreadcrumbDrop(e, folder, index)}
                            >
                              {folder.name}
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="breadcrumb-actions">
                        <button
                          className="breadcrumb-refresh"
                          onClick={() => {
                            const isRootFolder = currentFolderId === customer?.driveFolderId;
                            loadCustomerDocuments(currentFolderId, isRootFolder);
                          }}
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
                                <div className="document-actions">
                                  <button
                                    className="ellipsis-menu-button"
                                    onClick={(e) => handleMenuToggle(e, folder)}
                                    title="More actions"
                                  >
                                    ⋮
                                  </button>
                                  {openMenuId === folder.id && (
                                    <>
                                      <div className="menu-backdrop" onClick={handleCloseMenu}></div>
                                      <div className="context-menu">
                                        <button
                                          className="context-menu-item"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleMenuMove(folder);
                                          }}
                                        >
                                          <span className="menu-icon">📁</span>
                                          <span>Move</span>
                                        </button>
                                        <button
                                          className="context-menu-item"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleMenuRename(folder);
                                          }}
                                        >
                                          <span className="menu-icon">✏️</span>
                                          <span>Rename</span>
                                        </button>
                                        <button
                                          className="context-menu-item context-menu-delete"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleMenuDelete(folder);
                                          }}
                                        >
                                          <span className="menu-icon">🗑️</span>
                                          <span>Delete</span>
                                        </button>
                                      </div>
                                    </>
                                  )}
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
                                    {doc.folderPath && (
                                      <span className="folder-path-badge" title={`In folder: ${doc.folderPath}`}>
                                        📁 {doc.folderPath} •{' '}
                                      </span>
                                    )}
                                    {formatFileSize(doc.size)} • {formatDate(doc.createdTime)}
                                  </p>
                                </div>
                                {doc.name !== 'customer.json' && (
                                  <div className="document-actions">
                                    <button
                                      className="ellipsis-menu-button"
                                      onClick={(e) => handleMenuToggle(e, doc)}
                                      title="More actions"
                                    >
                                      ⋮
                                    </button>
                                    {openMenuId === doc.id && (
                                      <>
                                        <div className="menu-backdrop" onClick={handleCloseMenu}></div>
                                        <div className="context-menu">
                                          <button
                                            className="context-menu-item"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleMenuMove(doc);
                                            }}
                                          >
                                            <span className="menu-icon">📁</span>
                                            <span>Move</span>
                                          </button>
                                          <button
                                            className="context-menu-item"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleMenuRename(doc);
                                            }}
                                          >
                                            <span className="menu-icon">✏️</span>
                                            <span>Rename</span>
                                          </button>
                                          <button
                                            className="context-menu-item context-menu-delete"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleMenuDelete(doc);
                                            }}
                                          >
                                            <span className="menu-icon">🗑️</span>
                                            <span>Delete</span>
                                          </button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Folder Selection Menu */}
                  {showFolderMenu && (
                    <>
                      <div className="folder-menu-backdrop" onClick={() => setShowFolderMenu(false)}></div>
                      <div className="folder-menu">
                        <h3>Tap a folder to move "{selectedFileToMove?.name}"</h3>
                        <div className="folder-menu-grid">
                          {/* Parent folder option when in subfolder */}
                          {folderPath.length > 0 && (
                            <button
                              className="folder-menu-item folder-menu-parent"
                              onClick={() => {
                                const parentFolder = folderPath.length > 1
                                  ? folderPath[folderPath.length - 2]
                                  : { id: customer.driveFolderId, name: customer.name };
                                handleMoveToFolder(parentFolder);
                              }}
                            >
                              <span className="folder-menu-icon">⬆️</span>
                              <span className="folder-menu-name">
                                {folderPath.length > 1 ? folderPath[folderPath.length - 2].name : 'Main Folder'}
                              </span>
                            </button>
                          )}

                          {/* Sibling folders */}
                          {documents.filter(doc => isFolder(doc.mimeType) && doc.id !== selectedFileToMove?.id).map((folder) => (
                            <button
                              key={folder.id}
                              className="folder-menu-item"
                              onClick={() => handleMoveToFolder(folder)}
                            >
                              <span className="folder-menu-icon">📁</span>
                              <span className="folder-menu-name">{folder.name}</span>
                            </button>
                          ))}

                          {/* Delete option */}
                          <button
                            className="folder-menu-item folder-menu-delete"
                            onClick={handleDeleteFromMenu}
                          >
                            <span className="folder-menu-icon">🗑️</span>
                            <span className="folder-menu-name">Delete</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Rename Modal */}
                  {showRenameModal && (
                    <Modal isOpen={showRenameModal} onClose={handleRenameCancelModal} title="Rename">
                      <div className="rename-modal">
                        <div className="rename-input-container">
                          <label htmlFor="rename-input">New name:</label>
                          <input
                            id="rename-input"
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleRenameSubmit();
                              }
                            }}
                            placeholder="Enter new name"
                            autoFocus
                          />
                        </div>
                        <div className="rename-modal-actions">
                          <button className="btn btn-secondary" onClick={handleRenameCancelModal}>
                            Cancel
                          </button>
                          <button
                            className="btn btn-primary"
                            onClick={handleRenameSubmit}
                            disabled={!renameValue.trim()}
                          >
                            Rename
                          </button>
                        </div>
                      </div>
                    </Modal>
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

      {/* Print Manager (New System) */}
      <PrintManager
        isOpen={isPrintManagerOpen}
        onClose={handleClosePrintManager}
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
