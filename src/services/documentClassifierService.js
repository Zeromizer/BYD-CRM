/**
 * Document Classifier Service
 * Uses Gemini AI to classify scanned documents and route them to appropriate folders
 *
 * Features:
 * - AI-powered document type detection
 * - Automatic folder routing
 * - Customer checklist auto-update
 * - Document quality assessment
 * - Signature detection
 */

import { getGeminiApiKey } from './geminiService';
import { DOCUMENT_TYPES, getDocumentTypesForClassification } from '../constants/documentRequirements';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

/**
 * Convert base64 data URL to base64 string (without prefix)
 */
function dataUrlToBase64(dataUrl) {
  const base64Index = dataUrl.indexOf('base64,');
  if (base64Index !== -1) {
    return dataUrl.substring(base64Index + 7);
  }
  return dataUrl;
}

/**
 * Extract mime type from base64 data URL
 */
function getMimeTypeFromDataUrl(dataUrl) {
  const match = dataUrl.match(/^data:([^;]+);base64,/);
  if (match) {
    return match[1];
  }
  // Default to jpeg if can't detect
  return 'image/jpeg';
}

/**
 * Get the document type definitions for the AI prompt
 */
function getDocumentTypePrompt() {
  const types = getDocumentTypesForClassification();
  return types.map(t => `- ${t.id}: ${t.name} (folder: ${t.folder})`).join('\n');
}

/**
 * Classify a document using Gemini AI
 *
 * @param {string} imageData - Base64 data URL of the document image
 * @param {object} options - Classification options
 * @param {string} options.customerName - Customer name for context
 * @param {string} options.currentMilestone - Current milestone for context
 * @param {function} onProgress - Progress callback
 * @returns {Promise<object>} - Classification results
 */
export async function classifyDocument(imageData, options = {}, onProgress = null) {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    throw new Error('Gemini API key not configured');
  }

  if (onProgress) onProgress({ stage: 'Analyzing document...', progress: 10 });

  const documentTypes = getDocumentTypePrompt();

  const prompt = `Analyze this scanned document for a car dealership CRM. Identify the document type from this list:
${documentTypes}

Also extract the CUSTOMER NAME if visible on the document (buyer name, applicant name, or any person's name the document belongs to).

Return ONLY valid JSON with these fields:
{
  "documentType": "type_id_from_list",
  "documentTypeName": "Human readable name",
  "confidence": 95,
  "folder": "Folder name",
  "signed": true,
  "customerName": "Customer full name if found",
  "summary": "Brief 10 word description"
}

If customer name is not visible, use empty string for customerName.
Be specific about document type - don't use "other" unless truly unidentifiable.`;

  if (onProgress) onProgress({ stage: 'Processing with AI...', progress: 30 });

  // Detect the correct mime type from the data URL
  const mimeType = getMimeTypeFromDataUrl(imageData);
  const base64Data = dataUrlToBase64(imageData);

  // Validate that we have actual data
  if (!base64Data || base64Data.length < 100) {
    throw new Error('Invalid image data - file may be corrupted or empty');
  }

  console.log('Classifying document:', { mimeType, dataLength: base64Data.length });

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048,
        }
      })
    });

    if (onProgress) onProgress({ stage: 'Parsing classification...', progress: 80 });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textResponse) {
      console.error('Gemini response:', data);
      throw new Error('No response from Gemini');
    }

    console.log('Gemini raw response:', textResponse.substring(0, 500));

    // Parse the JSON from the response - improved extraction
    let jsonStr = textResponse.trim();

    // Remove markdown code blocks
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();

    // Try to extract JSON object using regex if simple extraction fails
    if (!jsonStr.startsWith('{')) {
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }
    }

    // Clean up common issues in JSON - be conservative to avoid breaking valid JSON
    jsonStr = jsonStr
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')  // Remove control chars except \t\n\r
      .replace(/\r\n/g, ' ')             // Replace Windows newlines
      .replace(/\n/g, ' ')               // Replace Unix newlines
      .replace(/\r/g, ' ')               // Replace old Mac newlines
      .replace(/\t/g, ' ')               // Replace tabs
      .replace(/,\s*}/g, '}')            // Remove trailing commas before }
      .replace(/,\s*]/g, ']');           // Remove trailing commas before ]

    let result;
    try {
      result = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('JSON parse error:', parseError.message);
      console.error('Attempted to parse:', jsonStr.substring(0, 300));

      // Return a default classification if parsing fails
      result = {
        documentType: 'other',
        documentTypeName: 'Unknown Document',
        confidence: 30,
        folder: 'Other',
        milestone: null,
        extractedInfo: {},
        quality: { overall: 50, readable: true, complete: false, signed: false },
        suggestedActions: ['Manual review required - AI could not parse document'],
        summary: 'Document analysis incomplete'
      };
    }

    if (onProgress) onProgress({ stage: 'Complete', progress: 100 });

    // Validate and normalize the result
    const docType = Object.values(DOCUMENT_TYPES).find(dt => dt.id === result.documentType);

    return {
      documentType: result.documentType || 'other',
      documentTypeName: result.documentTypeName || docType?.name || 'Other Document',
      confidence: result.confidence || 50,
      folder: result.folder || docType?.folder || 'Other',
      milestone: docType?.milestone || null,
      customerName: result.customerName || '',
      extractedInfo: {},
      quality: {
        overall: result.confidence || 70,
        readable: true,
        complete: true,
        signed: result.signed === true,
        signatureDetected: result.signed === true,
      },
      suggestedActions: [],
      linkedChecklistItem: docType?.id || null,
      summary: result.summary || '',
      method: 'gemini',
    };

  } catch (error) {
    console.error('Document classification failed:', error);
    throw error;
  }
}

/**
 * Classify multiple document pages and suggest the best category
 *
 * @param {string[]} imageDataArray - Array of base64 data URLs
 * @param {object} options - Classification options
 * @param {function} onProgress - Progress callback
 * @returns {Promise<object>} - Combined classification results
 */
export async function classifyMultiPageDocument(imageDataArray, options = {}, onProgress = null) {
  if (!imageDataArray || imageDataArray.length === 0) {
    throw new Error('No images provided for classification');
  }

  // If only one page, classify it directly
  if (imageDataArray.length === 1) {
    return classifyDocument(imageDataArray[0], options, onProgress);
  }

  // For multi-page documents, classify the first page to determine type
  const firstPageResult = await classifyDocument(imageDataArray[0], options, (p) => {
    if (onProgress) onProgress({ ...p, progress: Math.round(p.progress * 0.5) });
  });

  // If it's a multi-page form (like VSA), all pages go to the same folder
  return {
    ...firstPageResult,
    pageCount: imageDataArray.length,
    isMultiPage: true,
  };
}

/**
 * Get the recommended folder path for a classified document
 *
 * @param {object} classification - Classification result
 * @param {string} customerFolderId - Customer's root folder ID
 * @returns {string} - Recommended folder name
 */
export function getRecommendedFolder(classification) {
  return classification?.folder || 'Other';
}

/**
 * Check if a document classification matches a required document
 *
 * @param {object} classification - Classification result
 * @param {object} requiredDoc - Required document definition
 * @returns {boolean} - True if it matches
 */
export function matchesRequiredDocument(classification, requiredDoc) {
  if (!classification || !requiredDoc) return false;

  // Check if the document type matches any of the required types
  return requiredDoc.documentTypes?.includes(classification.documentType) || false;
}

/**
 * Suggest which checklist item should be updated based on classification
 *
 * @param {object} classification - Classification result
 * @param {object} documentChecklist - Current document checklist state
 * @returns {object|null} - { milestoneId, checklistItemId } or null
 */
export function suggestChecklistUpdate(classification, documentChecklist) {
  if (!classification || !classification.linkedChecklistItem) {
    return null;
  }

  const milestone = classification.milestone;
  const itemId = classification.linkedChecklistItem;

  if (milestone && documentChecklist?.[milestone]?.[itemId]) {
    return {
      milestoneId: milestone,
      checklistItemId: itemId,
    };
  }

  return null;
}

/**
 * Batch classify documents from a OneDrive folder
 * Used for processing existing uploads
 *
 * @param {Array} files - Array of file objects with {id, name, downloadUrl}
 * @param {object} options - Classification options
 * @param {function} onProgress - Progress callback
 * @returns {Promise<Array>} - Array of classification results
 */
export async function batchClassifyDocuments(files, options = {}, onProgress = null) {
  const results = [];
  const total = files.length;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    try {
      if (onProgress) {
        onProgress({
          stage: `Classifying ${file.name} (${i + 1}/${total})...`,
          progress: Math.round((i / total) * 100),
        });
      }

      // Download the file and classify it
      // Note: This assumes the file is an image or can be converted
      // For PDFs, additional processing would be needed

      const classification = await classifyDocument(file.imageData, options);
      results.push({
        fileId: file.id,
        fileName: file.name,
        classification,
        success: true,
      });
    } catch (error) {
      results.push({
        fileId: file.id,
        fileName: file.name,
        error: error.message,
        success: false,
      });
    }
  }

  if (onProgress) {
    onProgress({ stage: 'Batch classification complete', progress: 100 });
  }

  return results;
}

export default {
  classifyDocument,
  classifyMultiPageDocument,
  getRecommendedFolder,
  matchesRequiredDocument,
  suggestChecklistUpdate,
  batchClassifyDocuments,
};
