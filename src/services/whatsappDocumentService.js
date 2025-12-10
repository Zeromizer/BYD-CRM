/**
 * WhatsApp Document Service
 *
 * Handles document attachment functionality for WhatsApp messaging.
 * Integrates with OneDrive to get shareable links for documents.
 *
 * Features:
 * - Generate shareable links from OneDrive documents
 * - Upload documents to OneDrive and get links
 * - Send documents via WhatsApp
 * - AI-powered document captions
 */

import oneDriveService from './oneDriveService';
import { sendDocument, sendImage } from './whatsappService';
import { generateDocumentSummary } from './aiSecretaryService';

// Supported document types for WhatsApp
export const SUPPORTED_DOCUMENT_TYPES = {
  PDF: {
    extensions: ['.pdf'],
    mimeType: 'application/pdf',
    maxSize: 100 * 1024 * 1024 // 100MB
  },
  EXCEL: {
    extensions: ['.xlsx', '.xls'],
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    maxSize: 100 * 1024 * 1024
  },
  WORD: {
    extensions: ['.docx', '.doc'],
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    maxSize: 100 * 1024 * 1024
  },
  IMAGE: {
    extensions: ['.jpg', '.jpeg', '.png'],
    mimeTypes: ['image/jpeg', 'image/png'],
    maxSize: 5 * 1024 * 1024 // 5MB for images
  }
};

/**
 * Get a shareable link for a file from OneDrive
 * @param {string} fileId - OneDrive file ID
 * @returns {Promise<string>} Public sharing link URL
 */
export async function getShareableLink(fileId) {
  try {
    // Create a sharing link using Microsoft Graph API
    const linkObj = await oneDriveService.createSharingLink(fileId, 'view');
    // The API returns a link object with webUrl property
    return linkObj?.webUrl || linkObj;
  } catch (error) {
    console.error('Failed to create shareable link:', error);
    throw new Error('Could not create shareable link for document');
  }
}

/**
 * Upload a file to customer's OneDrive folder and get shareable link
 * @param {File|Blob} file - File to upload
 * @param {string} filename - Name for the file
 * @param {string} customerFolderId - Customer's OneDrive folder ID
 * @returns {Promise<Object>} { fileId, shareLink, filename }
 */
export async function uploadAndShare(file, filename, customerFolderId) {
  try {
    // Upload the file to customer folder
    const uploadResult = await oneDriveService.uploadFileToFolder(
      customerFolderId,
      filename,
      file
    );

    // Create a sharing link
    const shareLink = await getShareableLink(uploadResult.id);

    return {
      fileId: uploadResult.id,
      shareLink,
      filename
    };
  } catch (error) {
    console.error('Failed to upload and share document:', error);
    throw error;
  }
}

/**
 * Get existing documents from customer folder
 * @param {string} customerFolderId - Customer's OneDrive folder ID
 * @returns {Promise<Array>} List of documents
 */
export async function getCustomerDocuments(customerFolderId) {
  try {
    const files = await oneDriveService.listFolderContents(customerFolderId);

    // Filter to supported document types
    const documents = files.filter((file) => {
      if (file.folder) return false;

      const ext = file.name.toLowerCase().split('.').pop();
      return Object.values(SUPPORTED_DOCUMENT_TYPES).some((type) =>
        type.extensions?.some((e) => e.replace('.', '') === ext)
      );
    });

    return documents.map((doc) => ({
      id: doc.id,
      name: doc.name,
      size: doc.size,
      lastModified: doc.lastModifiedDateTime,
      webUrl: doc.webUrl,
      mimeType: doc.file?.mimeType
    }));
  } catch (error) {
    console.error('Failed to get customer documents:', error);
    return [];
  }
}

/**
 * Determine document type from filename
 * @param {string} filename
 * @returns {string} Document type key
 */
export function getDocumentType(filename) {
  const ext = '.' + filename.toLowerCase().split('.').pop();

  for (const [type, config] of Object.entries(SUPPORTED_DOCUMENT_TYPES)) {
    if (config.extensions?.includes(ext)) {
      return type;
    }
  }
  return 'DOCUMENT';
}

/**
 * Send a document from OneDrive via WhatsApp
 * @param {Object} options
 * @param {string} options.phoneNumber - Recipient phone number
 * @param {string} options.fileId - OneDrive file ID
 * @param {string} options.filename - Document filename
 * @param {Object} options.customer - Customer object for AI caption
 * @param {string} options.customCaption - Optional custom caption
 * @returns {Promise<Object>} Send result
 */
export async function sendDocumentFromDrive({
  phoneNumber,
  fileId,
  filename,
  customer,
  customCaption
}) {
  try {
    // Get shareable link
    const shareLink = await getShareableLink(fileId);

    // Generate caption if not provided
    let caption = customCaption;
    if (!caption && customer) {
      const docType = getDocumentType(filename);
      caption = await generateDocumentSummary(
        filename.replace(/\.[^/.]+$/, ''), // Remove extension for prettier type
        customer
      );
    }

    // Determine if it's an image or document
    const docType = getDocumentType(filename);
    if (docType === 'IMAGE') {
      return await sendImage(phoneNumber, shareLink, caption);
    }

    return await sendDocument(phoneNumber, shareLink, filename, caption);
  } catch (error) {
    console.error('Failed to send document from Drive:', error);
    throw error;
  }
}

/**
 * Upload and send a new document via WhatsApp
 * @param {Object} options
 * @param {string} options.phoneNumber - Recipient phone number
 * @param {File|Blob} options.file - File to send
 * @param {string} options.filename - Document filename
 * @param {string} options.customerFolderId - Customer's OneDrive folder ID
 * @param {Object} options.customer - Customer object for AI caption
 * @param {string} options.customCaption - Optional custom caption
 * @returns {Promise<Object>} Send result
 */
export async function uploadAndSendDocument({
  phoneNumber,
  file,
  filename,
  customerFolderId,
  customer,
  customCaption
}) {
  try {
    // Upload to OneDrive
    const { shareLink } = await uploadAndShare(file, filename, customerFolderId);

    // Generate caption if not provided
    let caption = customCaption;
    if (!caption && customer) {
      caption = await generateDocumentSummary(
        filename.replace(/\.[^/.]+$/, ''),
        customer
      );
    }

    // Send via WhatsApp
    const docType = getDocumentType(filename);
    if (docType === 'IMAGE') {
      return await sendImage(phoneNumber, shareLink, caption);
    }

    return await sendDocument(phoneNumber, shareLink, filename, caption);
  } catch (error) {
    console.error('Failed to upload and send document:', error);
    throw error;
  }
}

/**
 * Generate a PDF and send via WhatsApp
 * This integrates with the existing PDF generation system
 * @param {Object} options
 * @param {string} options.phoneNumber - Recipient phone number
 * @param {Blob} options.pdfBlob - Generated PDF blob
 * @param {string} options.filename - PDF filename
 * @param {string} options.customerFolderId - Customer's OneDrive folder ID
 * @param {Object} options.customer - Customer object
 * @returns {Promise<Object>} Send result
 */
export async function sendGeneratedPDF({
  phoneNumber,
  pdfBlob,
  filename,
  customerFolderId,
  customer
}) {
  return uploadAndSendDocument({
    phoneNumber,
    file: pdfBlob,
    filename,
    customerFolderId,
    customer,
    customCaption: null // Let AI generate
  });
}

/**
 * Generate an Excel file and send via WhatsApp
 * @param {Object} options
 * @param {string} options.phoneNumber - Recipient phone number
 * @param {Blob} options.excelBlob - Generated Excel blob
 * @param {string} options.filename - Excel filename
 * @param {string} options.customerFolderId - Customer's OneDrive folder ID
 * @param {Object} options.customer - Customer object
 * @returns {Promise<Object>} Send result
 */
export async function sendGeneratedExcel({
  phoneNumber,
  excelBlob,
  filename,
  customerFolderId,
  customer
}) {
  return uploadAndSendDocument({
    phoneNumber,
    file: excelBlob,
    filename,
    customerFolderId,
    customer,
    customCaption: null // Let AI generate
  });
}

export default {
  getShareableLink,
  uploadAndShare,
  getCustomerDocuments,
  getDocumentType,
  sendDocumentFromDrive,
  uploadAndSendDocument,
  sendGeneratedPDF,
  sendGeneratedExcel,
  SUPPORTED_DOCUMENT_TYPES
};
