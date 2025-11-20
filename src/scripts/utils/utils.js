/**
 * utils.js
 *
 * Utility Functions Module
 * Contains helper functions for file handling, image processing, uploads,
 * document classification, and other utility operations.
 */

// Get file icon
function getFileIcon(mimeType) {
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('image')) return '🖼️';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊';
    if (mimeType.includes('folder')) return '📁';
    return '📎';
}

// Format file size
function formatFileSize(bytes) {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Auto-classify document based on filename
function classifyDocument(fileName) {
    const lowerFileName = fileName.toLowerCase();

    // Convert patterns object to array and sort by priority
    const patternsArray = Object.entries(documentClassificationPatterns).map(([key, pattern]) => ({
        key,
        ...pattern
    })).sort((a, b) => (a.priority || 999) - (b.priority || 999));

    let bestMatch = null;
    let bestMatchLength = 0;

    // Try to match each pattern in priority order
    for (const pattern of patternsArray) {
        // Check if any exclude keywords are present
        const hasExcludeKeyword = pattern.excludeKeywords.some(exclude =>
            lowerFileName.includes(exclude.toLowerCase())
        );

        if (hasExcludeKeyword) {
            continue; // Skip this pattern if exclude keyword found
        }

        // Check for keyword matches
        for (const keyword of pattern.keywords) {
            const lowerKeyword = keyword.toLowerCase();
            if (lowerFileName.includes(lowerKeyword)) {
                // Prefer longer matches (more specific)
                if (lowerKeyword.length > bestMatchLength) {
                    bestMatch = {
                        folderId: pattern.folderId,
                        checklistId: pattern.checklistId,
                        displayName: pattern.displayName,
                        confidence: 'high',
                        matchedKeyword: keyword
                    };
                    bestMatchLength = lowerKeyword.length;
                }
            }
        }
    }

    // Return best match if found
    if (bestMatch) {
        console.log(`📄 Classified "${fileName}" as "${bestMatch.displayName}" (matched: "${bestMatch.matchedKeyword}")`);
        return bestMatch;
    }

    // Default to other documents
    console.log(`📄 "${fileName}" - no specific match, using Other Documents`);
    return {
        folderId: 'other',
        checklistId: null,
        displayName: 'Other Documents',
        confidence: 'low'
    };
}

// Compress image for faster storage and printing
function compressImage(file, maxWidth = 1200, quality = 0.85) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Scale down if image is too large
                if (width > maxWidth) {
                    height = (height / width) * maxWidth;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to base64 with compression
                const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
                resolve(compressedBase64);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Upload multiple document images at once
async function uploadMultipleDocImages(customerId, files) {
    if (!files || files.length === 0) return;

    if (files.length > 4) {
        alert('Please select up to 4 images only');
        return;
    }

    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    // Get progress elements
    const progressContainer = document.getElementById('uploadProgress_' + customerId);
    const progressBar = document.getElementById('uploadBar_' + customerId);
    const progressText = document.getElementById('uploadText_' + customerId);

    try {
        // Show progress bar
        if (progressContainer) {
            progressContainer.style.display = 'block';
            progressBar.style.width = '0%';
            progressText.textContent = 'Compressing images...';
        }

        // Initialize testDriveDocs if needed
        if (!customer.testDriveDocs) {
            customer.testDriveDocs = {};
        }

        // Clear existing images
        customer.testDriveDocs = {};

        let uploadCount = 0;
        const totalFiles = files.length;

        // Process each file
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const docKey = 'doc' + (i + 1); // doc1, doc2, doc3, doc4

            // Update progress
            const progress = Math.round((i / totalFiles) * 100);
            if (progressBar && progressText) {
                progressBar.style.width = progress + '%';
                progressText.textContent = 'Processing image ' + (i + 1) + ' of ' + totalFiles + '...';
            }

            // Compress image for faster storage
            const compressedBase64 = await compressImage(file);

            // Store in customer data as base64
            customer.testDriveDocs[docKey] = {
                fileName: file.name,
                base64: compressedBase64,
                uploadDate: new Date().toISOString()
            };

            uploadCount++;

            // Upload to Google Drive in background (non-blocking)
            if (isSignedIn && customer.driveFolderId && customer.documentFolders?.nirc_fin) {
                // Don't await - let it run in background
                (async function(docKey, file, i) {
                    try {
                        const metadata = {
                            name: customer.name + '_doc' + (i + 1) + '_' + Date.now() + '.' + file.name.split('.').pop(),
                            mimeType: file.type,
                            parents: [customer.documentFolders.nirc_fin]
                        };

                        const form = new FormData();
                        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
                        form.append('file', file);

                        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name', {
                            method: 'POST',
                            headers: {
                                'Authorization': 'Bearer ' + gapi.client.getToken().access_token
                            },
                            body: form
                        });

                        if (response.ok) {
                            const result = await response.json();
                            customer.testDriveDocs[docKey].driveFileId = result.id;
                            await saveData();
                            console.log('Backed up to Google Drive:', result.id);
                        }
                    } catch (driveError) {
                        console.warn('Could not backup to Drive, but image saved locally:', driveError);
                    }
                })(docKey, file, i);
            }
        }

        // Complete progress
        if (progressBar && progressText) {
            progressBar.style.width = '100%';
            progressText.textContent = 'Saving...';
        }

        // Save customer data
        await saveData();

        // Complete!
        if (progressText) {
            progressText.textContent = '✓ Complete!';
            setTimeout(() => {
                if (progressContainer) {
                    progressContainer.style.display = 'none';
                }
            }, 1500);
        }

        // Refresh customer view
        displayCustomerDetails(customerId);

        // Clear file input
        const fileInput = document.getElementById('docImages_' + customerId);
        if (fileInput) {
            fileInput.value = '';
        }

    } catch (error) {
        console.error('Error uploading document images:', error);
        alert('Failed to upload images: ' + error.message);

        // Hide progress bar on error
        if (progressContainer) {
            progressContainer.style.display = 'none';
        }
    }
}

// Upload single document image
async function uploadDocImage(customerId, docType, file) {
    if (!file) return;

    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    try {
        // Convert image to base64 for local storage and printing
        const reader = new FileReader();
        reader.onload = async function(e) {
            const base64Data = e.target.result;

            // Store in customer data as base64
            if (!customer.testDriveDocs) {
                customer.testDriveDocs = {};
            }

            customer.testDriveDocs[docType] = {
                fileName: file.name,
                base64: base64Data,
                uploadDate: new Date().toISOString()
            };

            // Also upload to Google Drive if connected (for backup)
            if (isSignedIn && customer.driveFolderId && customer.documentFolders?.nirc_fin) {
                try {
                    const metadata = {
                        name: `${customer.name}_${docType}_${Date.now()}.${file.name.split('.').pop()}`,
                        mimeType: file.type,
                        parents: [customer.documentFolders.nirc_fin]
                    };

                    const form = new FormData();
                    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
                    form.append('file', file);

                    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name', {
                        method: 'POST',
                        headers: {
                            'Authorization': 'Bearer ' + gapi.client.getToken().access_token
                        },
                        body: form
                    });

                    if (response.ok) {
                        const result = await response.json();
                        customer.testDriveDocs[docType].driveFileId = result.id;
                        console.log('Also backed up to Google Drive:', result.id);
                    }
                } catch (driveError) {
                    console.warn('Could not backup to Drive, but image saved locally:', driveError);
                }
            }

            // Save customer data
            await saveData();

            // Refresh customer view
            displayCustomerDetails(customerId);

            alert(`${docType} uploaded successfully!`);
        };

        reader.onerror = function(error) {
            console.error('Error reading file:', error);
            alert('Failed to read image file');
        };

        reader.readAsDataURL(file);
    } catch (error) {
        console.error('Error uploading document image:', error);
        alert('Failed to upload image: ' + error.message);
    }
}

// Upload files to Google Drive
async function uploadFiles(files, customerId) {
    console.log('[uploadFiles] Starting upload:', { filesCount: files.length, customerId });

    const customer = customers.find(c => c.id === customerId);
    if (!customer) {
        console.error('[uploadFiles] Customer not found:', customerId);
        return;
    }

    if (!isSignedIn) {
        console.error('[uploadFiles] Not signed in to Google Drive');
        alert('Please connect to Google Drive first');
        return;
    }

    console.log('[uploadFiles] Customer found:', customer.name);

    // Check if auto-classify is enabled
    const autoClassifyToggle = document.getElementById(`autoClassifyToggle_${customerId}`);
    const isAutoClassify = autoClassifyToggle ? autoClassifyToggle.checked : true;

    const uploadArea = document.getElementById(`uploadArea_${customerId}`);
    const originalContent = uploadArea ? uploadArea.innerHTML : null;

    let successCount = 0;
    let errorCount = 0;
    const classificationResults = [];

    console.log('[uploadFiles] Auto-classify mode:', isAutoClassify);

    if (isAutoClassify) {
        // Auto-classify mode with parallel uploads
        if (uploadArea) {
            uploadArea.innerHTML = '<div class="loading"></div><p style="color: #27ae60; margin-top: 10px;">🤖 Auto-classifying and uploading files...</p>';
        }

        console.log('[uploadFiles] Starting auto-classify upload for', files.length, 'files');

        // Prepare all upload tasks
        const uploadTasks = Array.from(files).map(file => {
            const fileExt = file.name.split('.').pop();
            const classification = classifyDocument(file.name);
            const documentType = classification.folderId;
            const displayName = classification.displayName;
            const fileName = `${customer.name.replace(/\s+/g, '_')}_${customer.nric || 'XXXX'}_${displayName.replace(/\s+/g, '_')}.${fileExt}`;

            return {
                file,
                fileName,
                documentType,
                classification
            };
        });

        // Upload with concurrency limit (3 files at a time to avoid overwhelming API)
        const concurrencyLimit = 3;
        console.log('[uploadFiles] Uploading', uploadTasks.length, 'files in batches of', concurrencyLimit);

        for (let i = 0; i < uploadTasks.length; i += concurrencyLimit) {
            const batch = uploadTasks.slice(i, i + concurrencyLimit);
            console.log('[uploadFiles] Processing batch', (i / concurrencyLimit) + 1, '- files:', batch.map(t => t.fileName));

            const batchPromises = batch.map(async (task) => {
                console.log('[uploadFiles] Uploading file:', task.fileName, 'to folder:', task.documentType);
                const result = await uploadFileToDrive(task.file, customerId, task.fileName, task.documentType);
                console.log('[uploadFiles] Upload result for', task.fileName, ':', result);
                return {
                    success: result,
                    task
                };
            });

            const batchResults = await Promise.allSettled(batchPromises);
            console.log('[uploadFiles] Batch complete. Results:', batchResults.length);

            batchResults.forEach(result => {
                if (result.status === 'fulfilled' && result.value.success) {
                    successCount++;
                    classificationResults.push({
                        originalName: result.value.task.file.name,
                        detectedType: result.value.task.classification.displayName,
                        checklistId: result.value.task.classification.checklistId,
                        confidence: result.value.task.classification.confidence
                    });

                    // Auto-tick checklist if applicable
                    if (result.value.task.classification.checklistId) {
                        toggleChecklistItem(customerId, result.value.task.classification.checklistId, true);
                    }
                } else {
                    errorCount++;
                    console.error('[uploadFiles] Upload failed:', result);
                }
            });
        }

        console.log('[uploadFiles] All uploads complete. Success:', successCount, 'Errors:', errorCount);

        // Show detailed results
        let resultMessage = `✅ Successfully uploaded ${successCount} file(s)!\n\n📋 Auto-classified documents:\n`;
        classificationResults.forEach(result => {
            resultMessage += `\n• ${result.originalName}\n  → ${result.detectedType}`;
            if (result.checklistId) {
                resultMessage += ` ✓ (checklist updated)`;
            }
        });
        if (errorCount > 0) {
            resultMessage += `\n\n❌ Failed to upload ${errorCount} file(s).`;
        }
        alert(resultMessage);

    } else {
        // Manual mode with parallel uploads
        const documentTypeSelect = document.getElementById(`documentTypeSelect_${customerId}`);
        const documentType = documentTypeSelect ? documentTypeSelect.value : 'other';
        const folderName = documentFolders.find(f => f.id === documentType)?.name || 'Other_Documents';

        if (uploadArea) {
            uploadArea.innerHTML = '<div class="loading"></div><p style="color: #27ae60; margin-top: 10px;">Uploading files to ' + folderName.replace(/_/g, ' ') + '...</p>';
        }

        // Prepare all upload tasks
        const uploadTasks = Array.from(files).map(file => {
            const fileExt = file.name.split('.').pop();
            const docType = folderName.replace(/_/g, ' '); // Use folder name for all files in manual mode
            const fileName = `${customer.name.replace(/\s+/g, '_')}_${customer.nric || 'XXXX'}_${docType.replace(/\s+/g, '_')}.${fileExt}`;

            return {
                file,
                fileName,
                documentType
            };
        });

        // Upload with concurrency limit (3 files at a time)
        const concurrencyLimit = 3;
        for (let i = 0; i < uploadTasks.length; i += concurrencyLimit) {
            const batch = uploadTasks.slice(i, i + concurrencyLimit);
            const batchPromises = batch.map(task =>
                uploadFileToDrive(task.file, customerId, task.fileName, task.documentType)
            );

            const batchResults = await Promise.allSettled(batchPromises);

            batchResults.forEach(result => {
                if (result.status === 'fulfilled' && result.value) {
                    successCount++;
                } else {
                    errorCount++;
                }
            });
        }

        if (successCount > 0) {
            alert(`Successfully uploaded ${successCount} file(s) to ${folderName.replace(/_/g, ' ')} folder!`);
        }
        if (errorCount > 0) {
            alert(`Failed to upload ${errorCount} file(s).`);
        }
    }

    if (uploadArea && originalContent) {
        uploadArea.innerHTML = originalContent;
    }
    invalidateStatsCache(); // Invalidate cache after upload
    displayCustomerDetails(customerId);
    updateStats();
}

// Handle file drop
function handleDrop(event, customerId) {
    event.preventDefault();
    event.stopPropagation();
    event.target.classList.remove('dragover');

    const files = event.dataTransfer.files;
    uploadFiles(files, customerId);
}

// Handle drag over
function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    event.target.classList.add('dragover');
}

// Handle drag leave
function handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    event.target.classList.remove('dragover');
}

// Handle file select
function handleFileSelect(event, customerId) {
    const files = event.target.files;
    uploadFiles(files, customerId);
}

// Toggle auto-classify mode
function toggleAutoClassify(customerId) {
    const toggle = document.getElementById(`autoClassifyToggle_${customerId}`);
    const manualSelect = document.getElementById(`manualFolderSelect_${customerId}`);

    if (toggle && manualSelect) {
        if (toggle.checked) {
            manualSelect.style.display = 'none';
        } else {
            manualSelect.style.display = 'block';
        }
    }
}

// Move file to folder in Google Drive (and optionally rename)
async function moveFileToFolder(fileId, newParentId, newFileName) {
    if (!isSignedIn) {
        alert('Please connect to Google Drive first');
        return false;
    }

    try {
        // First, get the current file to find its current parents
        const getResponse = await gapi.client.drive.files.get({
            fileId: fileId,
            fields: 'parents, name'
        });

        const previousParents = getResponse.result.parents ? getResponse.result.parents.join(',') : '';
        const currentFileName = getResponse.result.name;

        // Prepare update parameters
        const updateParams = {
            fileId: fileId,
            addParents: newParentId,
            removeParents: previousParents,
            fields: 'id, parents, name'
        };

        // If filename changed, add rename to the update
        if (newFileName && newFileName !== currentFileName) {
            updateParams.resource = {
                name: newFileName
            };
            console.log(`Renaming file from "${currentFileName}" to "${newFileName}"`);
        }

        // Update file to remove from old parent, add to new parent, and optionally rename
        const updateResponse = await gapi.client.drive.files.update(updateParams);

        console.log('File moved successfully:', updateResponse.result);
        return true;
    } catch (error) {
        console.error('Error moving file:', error);
        return false;
    }
}

// Force sync from Drive (clears local cache and reloads)
async function forceSyncFromDrive() {
    if (!isSignedIn) {
        alert('Please connect to Google Drive first.');
        return;
    }

    if (!rootFolderId) {
        alert('Google Drive not ready. Please wait...');
        return;
    }

    if (confirm('This will reload all data from Google Drive and replace any local changes. Continue?')) {
        console.log('Force syncing from Drive...');

        // Clear local cache
        localStorage.removeItem('bydCRM');
        customers = [];

        // Force reload from Drive
        const success = await loadDataFromDrive();

        if (success) {
            alert('Data synced successfully from Google Drive!');
        } else {
            alert('Failed to sync from Google Drive. Check console for errors.');
        }
    }
}

// Fetch form image from Google Drive and cache it in memory
async function getFormImageFromDrive(formType) {
    const formData = formTemplates[formType];

    // Check if already cached in memory
    if (formImageCache[formType]) {
        return formImageCache[formType];
    }

    // If base64 exists in formData (legacy), use it
    if (formData.base64) {
        formImageCache[formType] = formData.base64;
        return formData.base64;
    }

    // Fetch from Google Drive
    if (!formData.fileId) {
        throw new Error('No image file available for this form');
    }

    try {
        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${formData.fileId}?alt=media`, {
            headers: {
                'Authorization': 'Bearer ' + gapi.client.getToken().access_token
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch image from Drive');
        }

        const blob = await response.blob();

        // Convert blob to base64
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const base64 = e.target.result;
                // Cache it in memory
                formImageCache[formType] = base64;
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('Error fetching form image from Drive:', error);
        throw error;
    }
}

// Render form with customer data overlaid
async function renderFormWithData(formType, customer) {
    const formData = formTemplates[formType];

    if (!formData.fieldMappings || Object.keys(formData.fieldMappings).length === 0) {
        // No field mappings, return original from Drive
        return await getFormImageFromDrive(formType);
    }

    // Fetch form image from Drive
    const base64Data = await getFormImageFromDrive(formType);

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');

            // Draw form image
            ctx.drawImage(img, 0, 0);

            // Get customer data
            const today = new Date().toLocaleDateString();
            const dataMapping = {
                'name': customer.name || '',
                'phone': customer.phone || '',
                'email': customer.email || '',
                'nric': customer.nric || '',
                'occupation': customer.occupation || '',
                'dob': customer.dob || '',
                'address': customer.address || '',
                'addressContinue': customer.addressContinue || '',
                'fullAddress': ((customer.address || '') + (customer.addressContinue ? ', ' + customer.addressContinue : '')).trim(),
                'salesConsultant': customer.salesConsultant || '',
                'vsaNo': customer.vsaNo || '',
                'date': today,
                'vsa_makeModel': customer.vsaDetails?.makeModel || '',
                'vsa_yom': customer.vsaDetails?.yom || '',
                'vsa_bodyColour': customer.vsaDetails?.bodyColour || '',
                'vsa_upholstery': customer.vsaDetails?.upholstery || '',
                'vsa_przType': customer.vsaDetails?.przType || '',
                'vsa_package': customer.vsaDetails?.package || '',
                'vsa_purchasePriceWithCOE': customer.vsaDetails?.purchasePriceWithCOE || '',
                'vsa_sellingWithCOE': customer.vsaDetails?.sellingWithCOE || '',
                'vsa_sellingPriceList': customer.vsaDetails?.sellingPriceList || '',
                'vsa_coeRebateLevel': customer.vsaDetails?.coeRebateLevel || '',
                'vsa_deposit': customer.vsaDetails?.deposit || '',
                'vsa_lessOthers': customer.vsaDetails?.lessOthers || '',
                'vsa_addOthers': customer.vsaDetails?.addOthers || '',
                'vsa_deliveryDate': customer.vsaDetails?.deliveryDate || '',
                'vsa_tradeInCarNo': customer.vsaDetails?.tradeInCarNo || '',
                'vsa_tradeInCarModel': customer.vsaDetails?.tradeInCarModel || '',
                'vsa_tradeInAmount': customer.vsaDetails?.tradeInAmount || '',
                'vsa_remarks1': customer.vsaDetails?.remarks1 || '',
                'vsa_remarks2': customer.vsaDetails?.remarks2 || '',
                'vsa_loanAmount': customer.vsaDetails?.loanAmount || '',
                'vsa_interest': customer.vsaDetails?.interest || '',
                'vsa_tenure': customer.vsaDetails?.tenure || '',
                'vsa_monthlyPayment': customer.vsaDetails?.monthlyPayment || '',
                'vsa_financeCompany': customer.vsaDetails?.financeCompany || '',
                'vsa_insuranceCompany': customer.vsaDetails?.insuranceCompany || '',
                'vsa_insuranceFee': customer.vsaDetails?.insuranceFee || ''
            };

            // Draw each field
            for (const [fieldId, field] of Object.entries(formData.fieldMappings)) {
                // Use custom value if provided, otherwise look up from customer data
                let text;
                if (field.customValue) {
                    text = field.customValue;
                } else {
                    text = dataMapping[field.type] || '';
                }

                if (!text) continue;

                ctx.fillStyle = field.color || '#000000';
                ctx.font = field.fontSize + 'px Arial';
                ctx.fillText(text, field.x, field.y);
            }

            // Convert to base64
            const filledFormBase64 = canvas.toDataURL('image/jpeg', 0.95);
            resolve(filledFormBase64);
        };

        img.onerror = function() {
            reject(new Error('Failed to load form image'));
        };

        img.src = base64Data;
    });
}

// Print form for customer with attached documents
async function printFormForCustomer(formType, customerId) {
    const customer = customers.find(c => c.id === customerId);
    const formData = formTemplates[formType];

    if (!formData) {
        alert('Form template not found. Please upload it first from Forms Management.');
        return;
    }

    // For test drive form, create 2-page document: Form + ID Documents
    if (formType === 'test_drive') {
        const docs = customer.testDriveDocs || {};

        // Render form with customer data
        let formImageData = null;
        if (formData.fileType === 'image') {
            try {
                formImageData = await renderFormWithData(formType, customer);
            } catch (error) {
                console.error('Error rendering form with data:', error);
                // Fall back to original form
            }
        }

        // Build HTML for 2-page print document
        let html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Test Drive Package - ' + customer.name + '</title>';
        html += '<style>';
        html += '@page { size: A4; margin: 0; }';
        html += '* { margin: 0; padding: 0; box-sizing: border-box; }';
        html += 'body { font-family: Arial, sans-serif; }';
        html += '.page { width: 210mm; height: 297mm; page-break-after: always; background: white; position: relative; }';
        html += '.page:last-child { page-break-after: auto; }';

        // Page 1: Form Page styles
        html += '.form-page { display: flex; align-items: center; justify-content: center; }';
        html += '.form-page iframe { width: 100%; height: 100%; border: none; }';

        // Page 2: ID Documents in 2x2 grid
        html += '.id-page { display: grid; grid-template-rows: 1fr 1fr; gap: 0; height: 100%; }';
        html += '.id-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }';
        html += '.id-box { display: flex; align-items: center; justify-content: center; overflow: hidden; background: #fafafa; }';
        html += '.id-box img { width: 100%; height: 100%; object-fit: contain; }';
        html += '.id-box .placeholder { color: #ccc; font-size: 18px; text-align: center; }';

        // Print button styles
        html += '.print-btn { position: fixed; top: 20px; right: 20px; padding: 14px 28px; background: #27ae60; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 15px; font-weight: 700; box-shadow: 0 6px 16px rgba(0,0,0,0.3); z-index: 1000; transition: all 0.3s; }';
        html += '.print-btn:hover { background: #229954; transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.4); }';

        html += '@media print { .no-print { display: none !important; } body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }';
        html += '</style></head><body>';

        // Print button
        html += '<button class="print-btn no-print" onclick="window.print()">🖨️ Print Both Pages</button>';

        // PAGE 1: Test Drive Form
        html += '<div class="page form-page">';
        if (formImageData) {
            // Display image form (with or without data overlay)
            html += '<img src="' + formImageData + '" style="width: 100%; height: 100%; object-fit: contain;" alt="Test Drive Form">';
        } else if (formData.webViewLink) {
            // Display PDF in iframe
            html += '<iframe src="' + formData.webViewLink + '"></iframe>';
        }
        html += '</div>';

        // PAGE 2: ID Documents Grid (2x2)
        html += '<div class="page">';
        html += '<div class="id-page">';

        // Top Row
        html += '<div class="id-row">';
        // Top Left (doc1)
        html += '<div class="id-box">';
        if (docs.doc1 && docs.doc1.base64) {
            html += '<img src="' + docs.doc1.base64 + '" alt="Document 1">';
        } else {
            html += '<div class="placeholder">No Image</div>';
        }
        html += '</div>';
        // Top Right (doc2)
        html += '<div class="id-box">';
        if (docs.doc2 && docs.doc2.base64) {
            html += '<img src="' + docs.doc2.base64 + '" alt="Document 2">';
        } else {
            html += '<div class="placeholder">No Image</div>';
        }
        html += '</div>';
        html += '</div>';

        // Bottom Row
        html += '<div class="id-row">';
        // Bottom Left (doc3)
        html += '<div class="id-box">';
        if (docs.doc3 && docs.doc3.base64) {
            html += '<img src="' + docs.doc3.base64 + '" alt="Document 3">';
        } else {
            html += '<div class="placeholder">No Image</div>';
        }
        html += '</div>';
        // Bottom Right (doc4)
        html += '<div class="id-box">';
        if (docs.doc4 && docs.doc4.base64) {
            html += '<img src="' + docs.doc4.base64 + '" alt="Document 4">';
        } else {
            html += '<div class="placeholder">No Image</div>';
        }
        html += '</div>';
        html += '</div>';

        html += '</div>'; // End id-page
        html += '</div>'; // End Page 2

        html += '</body></html>';

        // Open in new window
        const printWindow = window.open('', '_blank');
        printWindow.document.write(html);
        printWindow.document.close();
    } else {
        // For other forms, just open the PDF
        if (formData.webViewLink) {
            window.open(formData.webViewLink, '_blank');
        } else {
            alert('Form link not available');
        }
    }
}

// View form
async function viewForm(formType) {
    const formData = formTemplates[formType];
    if (!formData) {
        alert('Form not found');
        return;
    }

    if (formData.webViewLink) {
        // Open in Google Drive viewer
        window.open(formData.webViewLink, '_blank');
    } else if (formData.fileType === 'image' && formData.fileId) {
        // For images without webViewLink (legacy), fetch and display
        try {
            const base64Data = await getFormImageFromDrive(formType);
            const win = window.open('', '_blank');
            win.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>${formData.fileName}</title>
                    <style>
                        body { margin: 0; padding: 20px; background: #2c3e50; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                        img { max-width: 100%; height: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
                    </style>
                </head>
                <body>
                    <img src="${base64Data}" alt="${formData.fileName}">
                </body>
                </html>
            `);
        } catch (error) {
            alert('Failed to load form: ' + error.message);
        }
    } else {
        alert('Form link not available. Please re-upload this form.');
    }
}

// Delete form
async function deleteForm(formType) {
    if (!confirm('Are you sure you want to delete this form template?')) {
        return;
    }

    const formData = formTemplates[formType];
    if (!formData) {
        return;
    }

    try {
        // Delete from Google Drive
        await gapi.client.drive.files.delete({
            fileId: formData.fileId
        });

        // Remove from local storage
        delete formTemplates[formType];
        await saveFormTemplates();

        // Refresh list
        displayFormsList();

        alert('Form template deleted successfully');
    } catch (error) {
        console.error('Error deleting form:', error);
        alert('Failed to delete form: ' + error.message);
    }
}

// Upload form template
async function uploadFormTemplate() {
    const fileInput = document.getElementById('formFileInput');
    const formTypeSelect = document.getElementById('formTypeSelect');

    if (!fileInput.files || fileInput.files.length === 0) {
        alert('Please select a file to upload');
        return;
    }

    const file = fileInput.files[0];
    const formType = formTypeSelect.value;

    const isPDF = file.type.includes('pdf');
    const isImage = file.type.includes('image');

    if (!isPDF && !isImage) {
        alert('Please select a PDF or image file (JPEG, PNG, etc.)');
        return;
    }

    try {
        // Show uploading message
        const listContainer = document.getElementById('formsListContainer');
        listContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #27ae60;"><div class="loading"></div><p style="margin-top: 10px;">Processing form...</p></div>';

        if (isImage) {
            // Upload to Google Drive (required for images to avoid localStorage quota)
            if (!formsFolderId) {
                await getOrCreateFormsFolder();
                if (!formsFolderId) {
                    alert('Failed to create forms folder. Please connect to Google Drive.');
                    displayFormsList();
                    return;
                }
            }

            // Upload file to Google Drive
            const metadata = {
                name: file.name,
                mimeType: file.type,
                parents: [formsFolderId]
            };

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', file);

            const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + gapi.client.getToken().access_token
                },
                body: form
            });

            if (!response.ok) {
                throw new Error('Upload failed: ' + response.statusText);
            }

            const result = await response.json();

            // Store form template info with Drive reference only (no base64)
            formTemplates[formType] = {
                fileId: result.id,
                fileName: result.name,
                webViewLink: result.webViewLink,
                webContentLink: result.webContentLink,
                fileType: 'image',
                uploadDate: new Date().toISOString()
            };

            await saveFormTemplates();

            // Clear file input
            fileInput.value = '';

            // Refresh forms list
            displayFormsList();

            alert('Form template uploaded successfully!');

        } else if (isPDF) {
            // Handle PDF upload to Google Drive (existing behavior)
            if (!formsFolderId) {
                await getOrCreateFormsFolder();
                if (!formsFolderId) {
                    alert('Failed to create forms folder');
                    displayFormsList();
                    return;
                }
            }

            // Upload file to Google Drive
            const metadata = {
                name: file.name,
                mimeType: 'application/pdf',
                parents: [formsFolderId]
            };

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', file);

            const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + gapi.client.getToken().access_token
                },
                body: form
            });

            if (!response.ok) {
                throw new Error('Upload failed: ' + response.statusText);
            }

            const result = await response.json();

            // Store form template info
            formTemplates[formType] = {
                fileId: result.id,
                fileName: result.name,
                webViewLink: result.webViewLink,
                webContentLink: result.webContentLink,
                fileType: 'pdf',
                uploadDate: new Date().toISOString()
            };

            await saveFormTemplates();

            // Clear file input
            fileInput.value = '';

            // Refresh forms list
            displayFormsList();

            alert('Form template uploaded successfully!');
        }
    } catch (error) {
        console.error('Error uploading form:', error);
        if (error.name === 'QuotaExceededError') {
            alert('Failed to upload form: Storage quota exceeded. The image may be too large even after compression.');
        } else {
            alert('Failed to upload form: ' + error.message);
        }
        displayFormsList();
    }
}

// Handle form selection - show/hide test drive upload section
function handleFormSelection(customerId) {
    const selectElement = document.getElementById(`formSelect_${customerId}`);
    const uploadSection = document.getElementById(`testDriveUpload_${customerId}`);
    const printButton = document.getElementById(`printFormBtn_${customerId}`);

    const selectedForm = selectElement.value;

    // Show upload section only for test_drive form
    if (selectedForm === 'test_drive') {
        uploadSection.style.display = 'block';
    } else {
        uploadSection.style.display = 'none';
    }

    // Enable print button if a form is selected
    if (selectedForm) {
        printButton.disabled = false;
        printButton.style.opacity = '1';
    } else {
        printButton.disabled = true;
        printButton.style.opacity = '0.5';
    }
}

// Print the selected form
function printSelectedForm(customerId) {
    const selectElement = document.getElementById(`formSelect_${customerId}`);
    const selectedForm = selectElement.value;

    if (!selectedForm) {
        alert('Please select a form to print');
        return;
    }

    printFormForCustomer(selectedForm, customerId);
}

// Helper function to invalidate stats cache when files change
function invalidateStatsCache() {
    statsCache.lastUpdate = 0;
}
