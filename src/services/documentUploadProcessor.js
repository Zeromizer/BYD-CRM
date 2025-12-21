/**
 * Document Upload Processor Service
 * Processes scanned documents with AI classification and auto-routing
 *
 * Workflow:
 * 1. Classify document using Gemini AI
 * 2. Determine target folder based on classification
 * 3. Upload to appropriate subfolder
 * 4. Update customer document checklist
 */

import oneDriveService from './oneDriveService';
import { classifyDocument, getRecommendedFolder } from './documentClassifierService';
import { isGeminiAvailable } from './geminiService';
import { DOCUMENT_TYPES, REQUIRED_DOCUMENTS } from '../constants/documentRequirements';

/**
 * Process and upload a scanned document with AI classification
 *
 * @param {object} options - Upload options
 * @param {string} options.imageData - Base64 image data
 * @param {string} options.customerFolderId - Customer's OneDrive folder ID
 * @param {string} options.customerName - Customer name for AI context
 * @param {string} options.currentMilestone - Current milestone for AI context
 * @param {boolean} options.skipClassification - Skip AI classification
 * @param {string} options.targetFolder - Force upload to specific folder
 * @param {function} onProgress - Progress callback
 * @returns {Promise<object>} - Upload result with classification and file info
 */
export async function processAndUploadDocument(options, onProgress = null) {
  const {
    imageData,
    customerFolderId,
    customerName,
    currentMilestone,
    skipClassification = false,
    targetFolder = null,
  } = options;

  if (!customerFolderId) {
    throw new Error('Customer folder ID is required');
  }

  let classification = null;
  let folderName = targetFolder || 'Other';

  // Step 1: Classify document with AI (if available and not skipped)
  if (!skipClassification && isGeminiAvailable()) {
    if (onProgress) onProgress({ stage: 'Analyzing document with AI...', progress: 10 });

    try {
      classification = await classifyDocument(imageData, {
        customerName,
        currentMilestone,
      }, (p) => {
        if (onProgress) {
          onProgress({ stage: p.stage, progress: 10 + (p.progress * 0.3) });
        }
      });

      // Get recommended folder from classification
      folderName = getRecommendedFolder(classification);

      if (onProgress) {
        onProgress({
          stage: `Identified: ${classification.documentTypeName}`,
          progress: 40,
        });
      }
    } catch (error) {
      console.warn('Document classification failed, using default folder:', error);
      // Continue with upload to default folder
    }
  }

  // Step 2: Get or create target subfolder
  if (onProgress) onProgress({ stage: `Preparing ${folderName} folder...`, progress: 50 });

  let targetFolderId = customerFolderId;

  if (folderName && folderName !== 'root') {
    try {
      targetFolderId = await oneDriveService.getOrCreateFolder(folderName, customerFolderId);
    } catch (error) {
      console.warn(`Failed to create subfolder ${folderName}, using customer root:`, error);
      targetFolderId = customerFolderId;
    }
  }

  // Step 3: Upload the document
  if (onProgress) onProgress({ stage: 'Uploading document...', progress: 60 });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const docType = classification?.documentType || 'scan';
  const filename = `${docType}_${timestamp}.jpg`;

  // Convert base64 to Blob
  const base64Data = imageData.includes(',') ? imageData.split(',')[1] : imageData;
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'image/jpeg' });

  const fileId = await oneDriveService.uploadFileToFolder(filename, blob, targetFolderId);

  if (onProgress) onProgress({ stage: 'Upload complete!', progress: 100 });

  // Return result with all relevant info
  return {
    fileId,
    fileName: filename,
    folder: folderName,
    folderId: targetFolderId,
    classification,
    uploadedAt: new Date().toISOString(),
  };
}

/**
 * Process and upload a PDF document with AI classification
 *
 * @param {object} options - Upload options
 * @param {Blob} options.pdfBlob - PDF blob
 * @param {string} options.firstPageImage - First page image for classification
 * @param {string} options.customerFolderId - Customer's OneDrive folder ID
 * @param {string} options.customerName - Customer name for AI context
 * @param {string} options.currentMilestone - Current milestone for AI context
 * @param {function} onProgress - Progress callback
 * @returns {Promise<object>} - Upload result
 */
export async function processAndUploadPDF(options, onProgress = null) {
  const {
    pdfBlob,
    firstPageImage,
    customerFolderId,
    customerName,
    currentMilestone,
  } = options;

  if (!customerFolderId) {
    throw new Error('Customer folder ID is required');
  }

  let classification = null;
  let folderName = 'Other';

  // Classify using the first page if available
  if (firstPageImage && isGeminiAvailable()) {
    if (onProgress) onProgress({ stage: 'Analyzing document...', progress: 10 });

    try {
      classification = await classifyDocument(firstPageImage, {
        customerName,
        currentMilestone,
      });
      folderName = getRecommendedFolder(classification);
    } catch (error) {
      console.warn('PDF classification failed:', error);
    }
  }

  // Get or create target subfolder
  if (onProgress) onProgress({ stage: `Preparing ${folderName} folder...`, progress: 40 });

  let targetFolderId = customerFolderId;

  if (folderName && folderName !== 'root') {
    try {
      targetFolderId = await oneDriveService.getOrCreateFolder(folderName, customerFolderId);
    } catch (error) {
      console.warn(`Failed to create subfolder ${folderName}:`, error);
      targetFolderId = customerFolderId;
    }
  }

  // Upload the PDF
  if (onProgress) onProgress({ stage: 'Uploading PDF...', progress: 60 });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const docType = classification?.documentType || 'scan';
  const filename = `${docType}_${timestamp}.pdf`;

  const fileId = await oneDriveService.uploadFileToFolder(filename, pdfBlob, targetFolderId);

  if (onProgress) onProgress({ stage: 'Upload complete!', progress: 100 });

  return {
    fileId,
    fileName: filename,
    folder: folderName,
    folderId: targetFolderId,
    classification,
    uploadedAt: new Date().toISOString(),
  };
}

/**
 * Find matching checklist item for a document classification
 *
 * @param {object} classification - Document classification result
 * @returns {object|null} - { milestoneId, documentId } or null
 */
export function findMatchingChecklistItem(classification) {
  if (!classification?.documentType) return null;

  const docTypeId = classification.documentType;

  // Search through all milestones and documents to find a match
  for (const [milestoneId, documents] of Object.entries(REQUIRED_DOCUMENTS)) {
    for (const doc of documents) {
      if (doc.documentTypes?.includes(docTypeId)) {
        return {
          milestoneId,
          documentId: doc.id,
          documentName: doc.name,
        };
      }
    }
  }

  return null;
}

/**
 * Get suggested checklist update based on classification
 *
 * @param {object} classification - Document classification result
 * @returns {object} - Suggestion with milestone and document info
 */
export function getSuggestedChecklistUpdate(classification) {
  const match = findMatchingChecklistItem(classification);

  if (match) {
    return {
      found: true,
      ...match,
      message: `This ${classification.documentTypeName} can be linked to "${match.documentName}" in the ${match.milestoneId.replace('_', ' ')} milestone.`,
    };
  }

  return {
    found: false,
    message: 'No matching checklist item found for this document type.',
  };
}

export default {
  processAndUploadDocument,
  processAndUploadPDF,
  findMatchingChecklistItem,
  getSuggestedChecklistUpdate,
};
