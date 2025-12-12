import { useState, useEffect, useCallback, useMemo } from 'react';
import { FolderOpen, ScanLine, Archive, ArchiveRestore, Workflow, MessageCircle, Paperclip, Folder, File, Image, FileText, FileSpreadsheet, X, Loader, Copy, Check } from 'lucide-react';
import useCustomerStore from '../../stores/useCustomerStore';
import useAuthStore from '../../stores/useAuthStore';
import { getStorageService } from '../../services/storageServiceSelector';
import Modal from '../Modal/Modal';
import ExcelPopulateModal from '../ExcelPopulateModal/ExcelPopulateModal';
import PrintManager from '../Documents/PrintManager/PrintManager';
import DocumentViewer from '../DocumentViewer/DocumentViewer';
import DocumentScanner from '../DocumentScanner/DocumentScanner';
import MilestoneTracker from '../MilestoneTracker/MilestoneTracker';
import { useToast } from '../Toast/Toast';

// Import extracted components
import DetailsTab from './components/DetailsTab';
import ProposalTab from './components/ProposalTab';
import VsaTab from './components/VsaTab';
import InvoiceTab from './components/InvoiceTab';
import DocumentsTab from './components/DocumentsTab';
import WorkflowPanel from './components/WorkflowPanel';

// Import custom hooks
import { useCustomerForm, useGuarantors } from './hooks/useCustomerForm';
import { useDocumentManager, useDragDrop, useTouchMenu } from './hooks/useDocumentManager';
import { openWhatsApp } from '../../services/customerAssistantService';
import { getShareableLink } from '../../services/whatsappDocumentService';
import oneDriveService from '../../services/oneDriveService';

import './CustomerDetails.css';

// Form data extractors
const extractDetailsData = (customer) => ({
  name: customer.name || '',
  phone: customer.phone || '',
  email: customer.email || '',
  nric: customer.nric || '',
  occupation: customer.occupation || '',
  dob: customer.dob || '',
  licenseStartDate: customer.licenseStartDate || '',
  salesConsultant: customer.salesConsultant || '',
  vsaNo: customer.vsaNo || '',
  address: customer.address || '',
  addressContinue: customer.addressContinue || '',
  notes: customer.notes || '',
});

const extractProposalData = (customer) => ({
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
});

const extractVsaData = (customer) => ({
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
});

const extractInvoiceData = (customer) => ({
  invoiceNumber: customer.invoice_invoiceNumber || '',
  carType: customer.invoice_carType || 'NEW CAR',
  vehicleType: customer.invoice_vehicleType || 'NORMAL',
  salesPerson: customer.invoice_salesPerson || customer.salesConsultant || '',
  promoCode: customer.invoice_promoCode || '',
  vehicleNo: customer.invoice_vehicleNo || customer.vsa_registrationNo || '',
  regDate: customer.invoice_regDate || customer.vsa_dateOfRegistration || '',
  makeModel: customer.invoice_makeModel || customer.vsa_makeModel || '',
  coeExpDate: customer.invoice_coeExpDate || '',
  transferCount: customer.invoice_transferCount || '',
  deliveryDate: customer.invoice_deliveryDate || customer.vsa_deliveryDate || '',
  mileage: customer.invoice_mileage || '',
  priceSold: customer.invoice_priceSold || customer.vsa_purchasePriceWithCOE || '',
  financeAmount: customer.invoice_financeAmount || customer.vsa_loanAmount || '',
  firstPayment: customer.invoice_firstPayment || '',
  installment: customer.invoice_installment || customer.vsa_monthlyRepayment || '',
  insuranceFee: customer.invoice_insuranceFee || customer.vsa_insuranceFee || '',
  roadTax: customer.invoice_roadTax || '',
  transferFee: customer.invoice_transferFee || '',
  inspectionFee: customer.invoice_inspectionFee || '',
  processingFee: customer.invoice_processingFee || customer.vsa_adminFee || '',
  others: customer.invoice_others || '',
  accessories1: customer.invoice_accessories1 || '',
  accessories2: customer.invoice_accessories2 || '',
  depositPaid: customer.invoice_depositPaid || customer.vsa_deposit || '',
  othersDeduction: customer.invoice_othersDeduction || '',
  tradeInBalance: customer.invoice_tradeInBalance || '',
  financeCompany: customer.invoice_financeCompany || customer.proposal_bank || '',
  financeMode: customer.invoice_financeMode || '',
  interestRate: customer.invoice_interestRate || customer.vsa_interest || '',
  tenure: customer.invoice_tenure || customer.vsa_tenure || '',
  advanceArrears: customer.invoice_advanceArrears || 'ADVANCE',
  monthlyPayment: customer.invoice_monthlyPayment || customer.vsa_monthlyRepayment || '',
  insuranceCompany: customer.invoice_insuranceCompany || customer.vsa_insuranceCompany || '',
  insurancePremium: customer.invoice_insurancePremium || customer.vsa_insuranceFee || '',
  buyerPaymentMode: customer.invoice_buyerPaymentMode || '',
  tradeInVehicleNo: customer.invoice_tradeInVehicleNo || customer.vsa_tradeInCarNo || '',
  tradeInMakeModel: customer.invoice_tradeInMakeModel || customer.vsa_tradeInCarModel || '',
  tradeInRegDate: customer.invoice_tradeInRegDate || '',
  tradeInPrice: customer.invoice_tradeInPrice || customer.vsa_tradeInAmount || '',
  tradeInSettlement: customer.invoice_tradeInSettlement || '',
  overtrade: customer.invoice_overtrade || '',
  remarks: customer.invoice_remarks || '',
});

function CustomerDetails() {
  const { customers, selectedCustomerId, selectCustomer, updateCustomer, deleteCustomerHybrid, saveCustomerToFolder, saveToLocalStorage, archiveCustomer, unarchiveCustomer } = useCustomerStore();
  const { isSignedIn } = useAuthStore();
  const toast = useToast();

  // Derive customer from store state
  const customer = useMemo(() => {
    return customers.find((c) => {
      const customerId = typeof c.id === 'string' ? parseInt(c.id) : c.id;
      const targetId = typeof selectedCustomerId === 'string' ? parseInt(selectedCustomerId) : selectedCustomerId;
      return customerId === targetId;
    }) || null;
  }, [customers, selectedCustomerId]);

  // UI state
  const [activeTab, setActiveTab] = useState('details');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isPrintManagerOpen, setIsPrintManagerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteFolderChecked, setDeleteFolderChecked] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [archiveType, setArchiveType] = useState(null); // 'lost' or 'completed'
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [whatsAppMessage, setWhatsAppMessage] = useState('');
  const [showWhatsAppDocPicker, setShowWhatsAppDocPicker] = useState(false);
  const [whatsAppAttachments, setWhatsAppAttachments] = useState([]);
  const [docPickerDocuments, setDocPickerDocuments] = useState([]);
  const [docPickerLoading, setDocPickerLoading] = useState(false);
  const [docPickerError, setDocPickerError] = useState(null);
  const [docPickerPath, setDocPickerPath] = useState([]);
  const [messageCopied, setMessageCopied] = useState(false);

  // Memoize extractors to prevent unnecessary hook updates
  const memoizedDetailsExtractor = useCallback(extractDetailsData, []);
  const memoizedProposalExtractor = useCallback(extractProposalData, []);
  const memoizedVsaExtractor = useCallback(extractVsaData, []);
  const memoizedInvoiceExtractor = useCallback(extractInvoiceData, []);

  // Form hooks
  const detailsForm = useCustomerForm(customer, memoizedDetailsExtractor);
  const proposalForm = useCustomerForm(customer, memoizedProposalExtractor, 'proposal_');
  const vsaForm = useCustomerForm(customer, memoizedVsaExtractor, 'vsa_');
  const invoiceForm = useCustomerForm(customer, memoizedInvoiceExtractor, 'invoice_');
  const guarantorsHook = useGuarantors(customer);

  // Document management hooks
  const documentManager = useDocumentManager(customer, isSignedIn, toast);
  const dragDrop = useDragDrop(documentManager.moveDocument);
  const touchMenu = useTouchMenu();

  // Initialize documents when tab changes or customer changes
  useEffect(() => {
    if (activeTab === 'documents' && customer && isSignedIn) {
      documentManager.initializeFolder();
    }
  }, [activeTab, customer?.id, isSignedIn]);

  // Load documents when folder changes
  useEffect(() => {
    if (activeTab === 'documents' && documentManager.currentFolderId && isSignedIn) {
      documentManager.loadDocuments(documentManager.currentFolderId);
    }
  }, [documentManager.currentFolderId, activeTab, isSignedIn]);

  // Validate details form
  const validateDetails = useCallback(() => {
    const newErrors = {};
    if (!detailsForm.formData.name?.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!detailsForm.formData.phone?.trim()) {
      newErrors.phone = 'Contact number is required';
    }
    if (detailsForm.formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(detailsForm.formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    detailsForm.setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [detailsForm]);

  // Save handlers
  const handleDetailsSave = useCallback(async () => {
    if (!validateDetails() || !customer) return;

    setIsSubmitting(true);
    try {
      const updateData = { ...detailsForm.formData, guarantors: guarantorsHook.guarantors };
      // Set lastModified timestamp for both local and Drive saves
      const lastModified = new Date().toISOString();
      updateCustomer(customer.id, updateData);
      saveToLocalStorage();

      console.log('handleDetailsSave: isSignedIn=', isSignedIn, 'driveFolderId=', customer.driveFolderId);
      if (isSignedIn && customer.driveFolderId) {
        // Include all current customer data plus updates and ensure lastModified is set
        console.log('handleDetailsSave: Calling saveCustomerToFolder...');
        await saveCustomerToFolder({ ...customer, ...updateData, lastModified }, isSignedIn);
        console.log('handleDetailsSave: saveCustomerToFolder completed');
      } else {
        console.log('handleDetailsSave: Skipping OneDrive save - condition not met');
      }

      detailsForm.markAsSaved();
      guarantorsHook.markAsSaved();
      toast.success('Customer details saved successfully');
    } catch (error) {
      console.error('Error updating customer:', error);
      toast.error('Failed to update customer. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [customer, detailsForm, guarantorsHook, isSignedIn, validateDetails, updateCustomer, saveToLocalStorage, saveCustomerToFolder, toast]);

  const handleProposalSave = useCallback(async () => {
    if (!customer) return;

    setIsSubmitting(true);
    try {
      const updates = proposalForm.buildUpdateObject();
      // Set lastModified timestamp for both local and Drive saves
      const lastModified = new Date().toISOString();
      updateCustomer(customer.id, updates);
      saveToLocalStorage();

      console.log('handleProposalSave: isSignedIn=', isSignedIn, 'driveFolderId=', customer.driveFolderId);
      if (isSignedIn && customer.driveFolderId) {
        // Include all current customer data plus updates and ensure lastModified is set
        console.log('handleProposalSave: Calling saveCustomerToFolder...');
        await saveCustomerToFolder({ ...customer, ...updates, lastModified }, isSignedIn);
        console.log('handleProposalSave: saveCustomerToFolder completed');
      } else {
        console.log('handleProposalSave: Skipping OneDrive save - condition not met');
      }

      proposalForm.markAsSaved();
      toast.success('Proposal details saved successfully');
    } catch (error) {
      console.error('Error updating proposal:', error);
      toast.error('Failed to update proposal. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [customer, proposalForm, isSignedIn, updateCustomer, saveToLocalStorage, saveCustomerToFolder, toast]);

  const handleVsaSave = useCallback(async () => {
    if (!customer) return;

    setIsSubmitting(true);
    try {
      const updates = vsaForm.buildUpdateObject();
      // Set lastModified timestamp for both local and Drive saves
      const lastModified = new Date().toISOString();
      updateCustomer(customer.id, updates);
      saveToLocalStorage();

      console.log('handleVsaSave: isSignedIn=', isSignedIn, 'driveFolderId=', customer.driveFolderId);
      if (isSignedIn && customer.driveFolderId) {
        // Include all current customer data plus updates and ensure lastModified is set
        console.log('handleVsaSave: Calling saveCustomerToFolder...');
        await saveCustomerToFolder({ ...customer, ...updates, lastModified }, isSignedIn);
        console.log('handleVsaSave: saveCustomerToFolder completed');
      } else {
        console.log('handleVsaSave: Skipping OneDrive save - condition not met');
      }

      vsaForm.markAsSaved();
      toast.success('VSA details saved successfully');
    } catch (error) {
      console.error('Error updating VSA:', error);
      toast.error('Failed to update VSA. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [customer, vsaForm, isSignedIn, updateCustomer, saveToLocalStorage, saveCustomerToFolder, toast]);

  const handleInvoiceSave = useCallback(async () => {
    if (!customer) return;

    setIsSubmitting(true);
    try {
      const updates = invoiceForm.buildUpdateObject();
      // Set lastModified timestamp for both local and Drive saves
      const lastModified = new Date().toISOString();
      updateCustomer(customer.id, updates);
      saveToLocalStorage();

      console.log('handleInvoiceSave: isSignedIn=', isSignedIn, 'driveFolderId=', customer.driveFolderId);
      if (isSignedIn && customer.driveFolderId) {
        // Include all current customer data plus updates and ensure lastModified is set
        console.log('handleInvoiceSave: Calling saveCustomerToFolder...');
        await saveCustomerToFolder({ ...customer, ...updates, lastModified }, isSignedIn);
        console.log('handleInvoiceSave: saveCustomerToFolder completed');
      } else {
        console.log('handleInvoiceSave: Skipping OneDrive save - condition not met');
      }

      invoiceForm.markAsSaved();
      toast.success('Invoice saved successfully');
    } catch (error) {
      console.error('Error updating invoice:', error);
      toast.error('Failed to update invoice. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [customer, invoiceForm, isSignedIn, updateCustomer, saveToLocalStorage, saveCustomerToFolder, toast]);

  // Delete customer handler
  const handleDeleteConfirm = useCallback(async () => {
    if (!customer) return;

    setIsSubmitting(true);
    try {
      if (isSignedIn && customer.driveFolderId) {
        if (deleteFolderChecked) {
          try {
            await getStorageService().deleteFolder(customer.driveFolderId);
          } catch {
            const continueDelete = window.confirm(
              'Failed to delete the cloud storage folder. Would you like to continue deleting the customer record anyway?'
            );
            if (!continueDelete) {
              setIsSubmitting(false);
              return;
            }
          }
        } else {
          try {
            const customerFile = await getStorageService().findFile(customer.driveFolderId, 'customer.json');
            if (customerFile) {
              await getStorageService().deleteFile(customerFile.id);
            }
          } catch {
            // Continue anyway
          }
        }
      }

      await deleteCustomerHybrid(customer.id, isSignedIn);
      setIsDeleteModalOpen(false);
      setDeleteFolderChecked(false);
      toast.success('Customer deleted successfully');
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast.error('Failed to delete customer. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [customer, isSignedIn, deleteFolderChecked, deleteCustomerHybrid, toast]);

  // Scan complete handler
  const handleScanComplete = useCallback(() => {
    if (documentManager.currentFolderId) {
      documentManager.loadDocuments(documentManager.currentFolderId);
    }
  }, [documentManager]);

  // Open in OneDrive
  const handleOpenInDrive = useCallback(async () => {
    if (documentManager.folderPath.length > 0) {
      const currentFolder = documentManager.folderPath[documentManager.folderPath.length - 1];

      // Check if we have a stored link
      if (currentFolder.webViewLink) {
        // Detect if it's a Google Drive link (legacy from before OneDrive migration)
        if (currentFolder.webViewLink.includes('drive.google.com')) {
          // Try to get the correct OneDrive link
          try {
            const folderDetails = await getStorageService().getFolder(currentFolder.id);
            if (folderDetails?.webUrl) {
              window.open(folderDetails.webUrl, '_blank');
              return;
            }
          } catch {
            // Folder might not exist in OneDrive
          }
          toast.error('This customer has a Google Drive folder. Please repair the customer folder in settings.');
          return;
        }
        window.open(currentFolder.webViewLink, '_blank');
      } else if (currentFolder.id) {
        // No link stored, try to fetch from OneDrive
        try {
          const folderDetails = await getStorageService().getFolder(currentFolder.id);
          if (folderDetails?.webUrl) {
            window.open(folderDetails.webUrl, '_blank');
          }
        } catch {
          toast.error('Could not open folder. The folder may need to be repaired.');
        }
      }
    }
  }, [documentManager.folderPath, toast]);

  // Document picker helper function
  const getFileIcon = useCallback((filename) => {
    const ext = filename?.toLowerCase().split('.').pop();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
      return <Image size={16} />;
    }
    if (['xlsx', 'xls', 'csv'].includes(ext)) {
      return <FileSpreadsheet size={16} />;
    }
    if (ext === 'pdf') {
      return <FileText size={16} />;
    }
    return <File size={16} />;
  }, []);

  // Load documents for WhatsApp doc picker
  const loadWhatsAppDocuments = useCallback(async (folderId) => {
    setDocPickerLoading(true);
    setDocPickerError(null);
    try {
      const files = await oneDriveService.listFolder(folderId);
      setDocPickerDocuments(files || []);
    } catch (err) {
      console.error('Failed to load documents:', err);
      setDocPickerError('Failed to load documents');
      setDocPickerDocuments([]);
    } finally {
      setDocPickerLoading(false);
    }
  }, []);

  // Open WhatsApp doc picker
  const openWhatsAppDocPicker = useCallback(() => {
    if (customer?.driveFolderId) {
      setDocPickerPath([{ id: customer.driveFolderId, name: 'Customer Folder' }]);
      loadWhatsAppDocuments(customer.driveFolderId);
      setShowWhatsAppDocPicker(true);
    }
  }, [customer?.driveFolderId, loadWhatsAppDocuments]);

  // Handle folder navigation in doc picker
  const handleDocPickerFolderClick = useCallback((folder) => {
    setDocPickerPath(prev => [...prev, { id: folder.id, name: folder.name }]);
    loadWhatsAppDocuments(folder.id);
  }, [loadWhatsAppDocuments]);

  // Handle breadcrumb click in doc picker
  const handleDocPickerBreadcrumb = useCallback((index) => {
    const newPath = docPickerPath.slice(0, index + 1);
    setDocPickerPath(newPath);
    loadWhatsAppDocuments(newPath[newPath.length - 1].id);
  }, [docPickerPath, loadWhatsAppDocuments]);

  // Handle file selection in doc picker
  const handleDocPickerSelectFile = useCallback(async (file) => {
    try {
      setDocPickerLoading(true);
      const shareLink = await getShareableLink(file.id);
      const newAttachment = {
        id: file.id,
        name: file.name,
        shareLink,
      };
      // Don't add duplicates
      if (!whatsAppAttachments.some(a => a.id === file.id)) {
        setWhatsAppAttachments(prev => [...prev, newAttachment]);
      }
      setShowWhatsAppDocPicker(false);
    } catch (err) {
      console.error('Failed to get shareable link:', err);
      setDocPickerError('Failed to create shareable link');
    } finally {
      setDocPickerLoading(false);
    }
  }, [whatsAppAttachments]);

  // Remove attachment
  const removeWhatsAppAttachment = useCallback((docId) => {
    setWhatsAppAttachments(prev => prev.filter(a => a.id !== docId));
  }, []);

  // Build full message with attachments
  const fullWhatsAppMessage = useMemo(() => {
    let msg = whatsAppMessage;
    if (whatsAppAttachments.length > 0) {
      msg += '\n\n📎 Documents:';
      whatsAppAttachments.forEach((doc) => {
        msg += `\n• ${doc.name}: ${doc.shareLink}`;
      });
    }
    return msg;
  }, [whatsAppMessage, whatsAppAttachments]);

  // Empty state
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
        {/* Header */}
        <div className="customer-details-header">
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

          {/* WhatsApp Shortcut Button */}
          <button
            className="btn-whatsapp-shortcut"
            onClick={() => {
              setWhatsAppMessage(`Hi ${customer.name}! `);
              setIsWhatsAppModalOpen(true);
            }}
            aria-label="Send WhatsApp message"
            title="Send WhatsApp message"
          >
            <MessageCircle size={20} />
          </button>

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
                      setIsPrintManagerOpen(true);
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 6 2 18 2 18 9"></polyline>
                      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                      <rect x="6" y="14" width="12" height="8"></rect>
                    </svg>
                    <span>Print Documents</span>
                  </button>
                  <button
                    className="action-menu-item"
                    onClick={() => {
                      setShowActionsMenu(false);
                      setIsExcelModalOpen(true);
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

                  {/* Archive Actions */}
                  {customer.archiveStatus ? (
                    <button
                      className="action-menu-item action-menu-item-restore"
                      onClick={() => {
                        setShowActionsMenu(false);
                        unarchiveCustomer(customer.id, isSignedIn);
                        toast.success('Customer restored to active');
                      }}
                    >
                      <ArchiveRestore size={18} />
                      <span>Restore to Active</span>
                    </button>
                  ) : (
                    <>
                      <button
                        className="action-menu-item action-menu-item-archive-completed"
                        onClick={() => {
                          setShowActionsMenu(false);
                          setArchiveType('completed');
                          setIsArchiveModalOpen(true);
                        }}
                      >
                        <Archive size={18} />
                        <span>Archive as Completed</span>
                      </button>
                      <button
                        className="action-menu-item action-menu-item-archive-lost"
                        onClick={() => {
                          setShowActionsMenu(false);
                          setArchiveType('lost');
                          setIsArchiveModalOpen(true);
                        }}
                      >
                        <Archive size={18} />
                        <span>Archive as Lost</span>
                      </button>
                    </>
                  )}

                  <div className="action-menu-divider"></div>
                  <button
                    className="action-menu-item action-menu-item-danger"
                    onClick={() => {
                      setShowActionsMenu(false);
                      setIsDeleteModalOpen(true);
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
          <button className={`tab ${activeTab === 'details' ? 'active' : ''}`} onClick={() => setActiveTab('details')}>
            Details
          </button>
          <button className={`tab ${activeTab === 'proposal' ? 'active' : ''}`} onClick={() => setActiveTab('proposal')}>
            Proposal
          </button>
          <button className={`tab ${activeTab === 'vsa' ? 'active' : ''}`} onClick={() => setActiveTab('vsa')}>
            VSA
          </button>
          <button className={`tab ${activeTab === 'invoice' ? 'active' : ''}`} onClick={() => setActiveTab('invoice')}>
            Invoice
          </button>
          <button className={`tab ${activeTab === 'status' ? 'active' : ''}`} onClick={() => setActiveTab('status')}>
            Status
          </button>
          <button
            className={`tab tab-icon ${activeTab === 'workflows' ? 'active' : ''}`}
            onClick={() => setActiveTab('workflows')}
            title="Workflows"
          >
            <Workflow size={18} />
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
          {activeTab === 'details' && (
            <div key="details" className="tab-content-wrapper">
              <DetailsTab
                formData={detailsForm.formData}
                errors={detailsForm.errors}
                guarantors={guarantorsHook.guarantors}
                expandedGuarantors={guarantorsHook.expandedGuarantors}
                hasChanges={detailsForm.hasChanges}
                hasGuarantorChanges={guarantorsHook.hasChanges}
                isSubmitting={isSubmitting}
                onFieldChange={detailsForm.handleChange}
                onGuarantorChange={guarantorsHook.updateGuarantor}
                onAddGuarantor={guarantorsHook.addGuarantor}
                onRemoveGuarantor={guarantorsHook.removeGuarantor}
                onToggleGuarantor={guarantorsHook.toggleExpanded}
                onSave={handleDetailsSave}
                onCancel={() => {
                  detailsForm.resetForm();
                  guarantorsHook.resetGuarantors();
                }}
                canAddMoreGuarantors={guarantorsHook.canAddMore}
              />
            </div>
          )}

          {activeTab === 'proposal' && (
            <div key="proposal" className="tab-content-wrapper">
              <ProposalTab
                formData={proposalForm.formData}
                hasChanges={proposalForm.hasChanges}
                isSubmitting={isSubmitting}
                onFieldChange={proposalForm.handleChange}
                onSave={handleProposalSave}
                onCancel={proposalForm.resetForm}
              />
            </div>
          )}

          {activeTab === 'vsa' && (
            <div key="vsa" className="tab-content-wrapper">
              <VsaTab
                formData={vsaForm.formData}
                customerName={customer.name}
                customerNric={customer.nric}
                customerPhone={customer.phone}
                hasChanges={vsaForm.hasChanges}
                isSubmitting={isSubmitting}
                onFieldChange={vsaForm.handleChange}
                onSave={handleVsaSave}
                onCancel={vsaForm.resetForm}
              />
            </div>
          )}

          {activeTab === 'invoice' && (
            <div key="invoice" className="tab-content-wrapper">
              <InvoiceTab
                formData={invoiceForm.formData}
                customerName={customer.name}
                customerNric={customer.nric}
                customerPhone={customer.phone}
                customerEmail={customer.email}
                salesConsultant={customer.salesConsultant}
                vsaData={vsaForm.formData}
                hasChanges={invoiceForm.hasChanges}
                isSubmitting={isSubmitting}
                onFieldChange={invoiceForm.handleChange}
                onSave={handleInvoiceSave}
                onCancel={invoiceForm.resetForm}
                customerId={customer.id}
              />
            </div>
          )}

          {activeTab === 'status' && (
            <div key="status" className="tab-content-wrapper">
              <MilestoneTracker customer={customer} />
            </div>
          )}

          {activeTab === 'workflows' && (
            <div key="workflows" className="tab-content-wrapper">
              <WorkflowPanel customer={customer} />
            </div>
          )}

          {activeTab === 'documents' && (
            <div key="documents" className="tab-content-wrapper">
              <DocumentsTab
                documents={documentManager.documents}
                loadingDocuments={documentManager.loadingDocuments}
                currentFolderId={documentManager.currentFolderId}
                folderPath={documentManager.folderPath}
                isSignedIn={isSignedIn}
                hasDriveFolder={!!customer.driveFolderId}
                onLoadDocuments={documentManager.loadDocuments}
                onNavigateToFolder={documentManager.navigateToFolder}
                onNavigateToBreadcrumb={documentManager.navigateToBreadcrumb}
                onItemClick={documentManager.handleItemClick}
                onDeleteDocument={documentManager.deleteDocument}
                onMoveDocument={documentManager.moveDocument}
                onRenameDocument={documentManager.renameDocument}
                onOpenInDrive={handleOpenInDrive}
                draggedFile={dragDrop.draggedFile}
                dropTargetFolder={dragDrop.dropTargetFolder}
                dropTargetBreadcrumb={dragDrop.dropTargetBreadcrumb}
                isDragMode={dragDrop.isDragMode}
                onDragStart={dragDrop.handleDragStart}
                onDragEnd={dragDrop.handleDragEnd}
                onDragOver={dragDrop.handleDragOver}
                onDragLeave={dragDrop.handleDragLeave}
                onDrop={dragDrop.handleDrop}
                onBreadcrumbDragOver={dragDrop.handleBreadcrumbDragOver}
                onBreadcrumbDragLeave={dragDrop.handleBreadcrumbDragLeave}
                onBreadcrumbDrop={dragDrop.handleBreadcrumbDrop}
                onTouchStart={touchMenu.handleTouchStart}
                onTouchMove={touchMenu.handleTouchMove}
                onTouchEnd={touchMenu.handleTouchEnd}
                // Mobile action menu props
                showActionMenu={touchMenu.showActionMenu}
                showFolderMenu={touchMenu.showFolderMenu}
                selectedFile={touchMenu.selectedFile}
                onCloseActionMenu={touchMenu.closeActionMenu}
                onCloseAllMenus={touchMenu.closeAllMenus}
                onMoveAction={touchMenu.handleMoveAction}
              />
            </div>
          )}

          {activeTab === 'scanner' && (
            <div key="scanner" className="tab-content-wrapper scanner-section">
              {!isSignedIn ? (
                <div className="warning-banner animate-fadeIn">
                  <p>Please sign in to OneDrive to use the scanner</p>
                </div>
              ) : !customer.driveFolderId ? (
                <div className="empty-state animate-fadeIn">
                  <p>No OneDrive folder for this customer yet</p>
                  <p className="empty-state-hint">A folder will be created when you generate forms or Excel files</p>
                </div>
              ) : (
                <DocumentScanner
                  customerId={customer.id}
                  customerName={customer.name}
                  customerFolderId={customer.driveFolderId}
                  onScanComplete={handleScanComplete}
                  onClose={() => setActiveTab('documents')}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Document Viewer Modal */}
      <DocumentViewer
        isOpen={documentManager.isViewerOpen}
        onClose={documentManager.closeViewer}
        document={documentManager.selectedDocument}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => !isSubmitting && setIsDeleteModalOpen(false)}
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
                  <strong>Also delete OneDrive folder and all documents</strong>
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
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Archive Confirmation Modal */}
      <Modal
        isOpen={isArchiveModalOpen}
        onClose={() => setIsArchiveModalOpen(false)}
        title={`Archive Customer as ${archiveType === 'completed' ? 'Completed' : 'Lost'}`}
        size="small"
      >
        <div className="archive-modal-content">
          <p style={{ marginBottom: '15px', color: 'var(--color-text-secondary)' }}>
            {archiveType === 'completed' ? (
              <>
                Mark <strong>{customer?.name}</strong> as a completed deal?
                <br /><br />
                This customer will be moved to the archive and hidden from your main customer list.
              </>
            ) : (
              <>
                Mark <strong>{customer?.name}</strong> as a lost lead?
                <br /><br />
                This customer will be moved to the archive and hidden from your main customer list.
              </>
            )}
          </p>
          <p style={{ fontSize: '13px', color: 'var(--color-text-tertiary)', marginBottom: '20px' }}>
            You can restore this customer at any time from the archive.
          </p>
          <div className="delete-actions">
            <button
              className={`btn ${archiveType === 'completed' ? 'btn-success' : 'btn-warning'}`}
              onClick={() => {
                archiveCustomer(customer.id, archiveType, isSignedIn);
                setIsArchiveModalOpen(false);
                toast.success(`Customer archived as ${archiveType}`);
              }}
              style={archiveType === 'completed'
                ? { backgroundColor: '#16a34a', borderColor: '#16a34a' }
                : { backgroundColor: '#f59e0b', borderColor: '#f59e0b' }
              }
            >
              {archiveType === 'completed' ? 'Archive as Completed' : 'Archive as Lost'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setIsArchiveModalOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Excel Populate Modal */}
      <ExcelPopulateModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        customer={customer}
      />

      {/* Print Manager */}
      <PrintManager
        isOpen={isPrintManagerOpen}
        onClose={() => setIsPrintManagerOpen(false)}
        customer={customer}
      />

      {/* WhatsApp Quick Compose Modal */}
      <Modal
        isOpen={isWhatsAppModalOpen}
        onClose={() => {
          setIsWhatsAppModalOpen(false);
          setWhatsAppAttachments([]);
          setShowWhatsAppDocPicker(false);
        }}
        title="Send WhatsApp Message"
        size="medium"
      >
        <div className="whatsapp-compose-modal">
          <div className="whatsapp-recipient">
            <span className="recipient-label">To:</span>
            <span className="recipient-name">{customer.name}</span>
            <span className="recipient-phone">{customer.phone || 'No phone number'}</span>
          </div>

          <div className="whatsapp-message-field">
            <label>Message</label>
            <textarea
              value={whatsAppMessage}
              onChange={(e) => setWhatsAppMessage(e.target.value)}
              placeholder="Type your message..."
              rows={4}
              autoFocus
            />
          </div>

          {/* Attachments Section */}
          <div className="whatsapp-attachments-section">
            <label>Attachments</label>
            <div className="whatsapp-attachments-list">
              {whatsAppAttachments.map((doc) => (
                <div key={doc.id} className="whatsapp-attached-doc">
                  <Paperclip size={12} />
                  <span>{doc.name}</span>
                  <button
                    className="btn-remove-attachment"
                    onClick={() => removeWhatsAppAttachment(doc.id)}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              <button
                className="btn-add-attachment"
                onClick={openWhatsAppDocPicker}
                disabled={!isSignedIn || !customer?.driveFolderId}
              >
                <Paperclip size={14} />
                Attach File
              </button>
            </div>
            {!isSignedIn && (
              <p className="attachment-hint">Connect to OneDrive to attach files</p>
            )}
            {isSignedIn && !customer?.driveFolderId && (
              <p className="attachment-hint">No folder for this customer yet</p>
            )}
          </div>

          {/* Document Picker Inline */}
          {showWhatsAppDocPicker && (
            <div className="whatsapp-doc-picker">
              <div className="doc-picker-header">
                <span>Select a document</span>
                <button
                  className="btn-close-picker"
                  onClick={() => setShowWhatsAppDocPicker(false)}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Breadcrumb */}
              <div className="doc-picker-breadcrumb">
                {docPickerPath.map((folder, index) => (
                  <span key={folder.id}>
                    {index > 0 && <span className="breadcrumb-sep">/</span>}
                    <button
                      className="breadcrumb-btn"
                      onClick={() => handleDocPickerBreadcrumb(index)}
                    >
                      {folder.name}
                    </button>
                  </span>
                ))}
              </div>

              {/* File List */}
              <div className="doc-picker-list">
                {docPickerLoading ? (
                  <div className="doc-picker-loading">
                    <Loader size={20} className="spinning" />
                    <span>Loading...</span>
                  </div>
                ) : docPickerError ? (
                  <div className="doc-picker-error">{docPickerError}</div>
                ) : docPickerDocuments.length === 0 ? (
                  <div className="doc-picker-empty">No files in this folder</div>
                ) : (
                  <>
                    {/* Folders first */}
                    {docPickerDocuments.filter(d => d.folder).map((folder) => (
                      <div
                        key={folder.id}
                        className="doc-picker-item folder"
                        onClick={() => handleDocPickerFolderClick(folder)}
                      >
                        <Folder size={16} />
                        <span>{folder.name}</span>
                      </div>
                    ))}
                    {/* Then files */}
                    {docPickerDocuments.filter(d => !d.folder).map((file) => (
                      <div
                        key={file.id}
                        className="doc-picker-item file"
                        onClick={() => handleDocPickerSelectFile(file)}
                      >
                        {getFileIcon(file.name)}
                        <span>{file.name}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Preview with attachments */}
          {(whatsAppMessage || whatsAppAttachments.length > 0) && (
            <div className="whatsapp-preview">
              <div className="whatsapp-preview-header">
                <label>Preview</label>
                <button
                  className={`btn-copy-message ${messageCopied ? 'copied' : ''}`}
                  onClick={() => {
                    navigator.clipboard.writeText(fullWhatsAppMessage);
                    setMessageCopied(true);
                    toast.success('Message copied to clipboard');
                    setTimeout(() => setMessageCopied(false), 2000);
                  }}
                  title="Copy to clipboard"
                >
                  {messageCopied ? <Check size={14} /> : <Copy size={14} />}
                  {messageCopied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="whatsapp-preview-content">
                {fullWhatsAppMessage}
              </div>
            </div>
          )}

          <div className="whatsapp-modal-actions">
            <button
              className="btn btn-secondary"
              onClick={() => {
                setIsWhatsAppModalOpen(false);
                setWhatsAppAttachments([]);
              }}
            >
              Cancel
            </button>
            <button
              className="btn btn-whatsapp"
              onClick={() => {
                if (customer.phone && whatsAppMessage.trim()) {
                  openWhatsApp(customer.phone, fullWhatsAppMessage);
                  setIsWhatsAppModalOpen(false);
                  setWhatsAppMessage('');
                  setWhatsAppAttachments([]);
                  toast.success('Opening WhatsApp...');
                } else if (!customer.phone) {
                  toast.error('Customer has no phone number');
                }
              }}
              disabled={!customer.phone || !whatsAppMessage.trim()}
            >
              <MessageCircle size={16} />
              Send via WhatsApp
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default CustomerDetails;
