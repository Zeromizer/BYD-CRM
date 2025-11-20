/**
 * Forms Module
 *
 * Handles all form template management including:
 * - Form upload and storage
 * - Field mapping and configuration
 * - Form printing with customer data
 * - Combine and print functionality
 */

// ============ Forms Management Functions ============

// Open forms modal
async function openFormsModal() {
    const modal = document.getElementById('formsModal');
    modal.classList.add('active');

    // Check if signed in
    if (!isSignedIn) {
        document.getElementById('formsNotConnected').style.display = 'block';
        document.getElementById('formsConnected').style.display = 'none';
    } else {
        document.getElementById('formsNotConnected').style.display = 'none';
        document.getElementById('formsConnected').style.display = 'block';

        // Ensure forms folder exists
        await getOrCreateFormsFolder();

        // Load form templates
        await loadFormTemplates();
        displayFormsList();
    }
}

// Close forms modal
function closeFormsModal() {
    document.getElementById('formsModal').classList.remove('active');
    document.getElementById('formFileInput').value = '';
}

// Load form templates from Google Drive and localStorage
async function loadFormTemplates() {
    // Try to load from Google Drive first
    if (isSignedIn && formsFolderId) {
        try {
            await getOrCreateFormsDataFile();

            if (formsDataFileId) {
                const response = await gapi.client.drive.files.get({
                    fileId: formsDataFileId,
                    alt: 'media'
                });

                if (response.result) {
                    formTemplates = response.result;
                    // Cache in localStorage
                    localStorage.setItem('formTemplates', JSON.stringify(formTemplates));
                    console.log('Loaded form templates from Drive:', Object.keys(formTemplates).length);
                    return;
                }
            }
        } catch (error) {
            console.error('Error loading forms from Drive:', error);
        }
    }

    // Fallback to localStorage
    const stored = localStorage.getItem('formTemplates');
    if (stored) {
        try {
            formTemplates = JSON.parse(stored);
            console.log('Loaded form templates from localStorage:', Object.keys(formTemplates).length);
        } catch (e) {
            console.error('Error parsing stored form templates:', e);
            formTemplates = {};
        }
    }
}

// Save form templates to Google Drive and localStorage
async function saveFormTemplates() {
    // Save to localStorage for quick access
    localStorage.setItem('formTemplates', JSON.stringify(formTemplates));

    // Save to Google Drive for cross-device sync
    if (isSignedIn && formsFolderId) {
        try {
            if (!formsDataFileId) {
                await getOrCreateFormsDataFile();
            }

            if (formsDataFileId) {
                await updateFormsDataFile(formTemplates);
                console.log('Saved form templates to Drive');
            }
        } catch (error) {
            console.error('Error saving forms to Drive:', error);
        }
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

// Display forms list
function displayFormsList() {
    const container = document.getElementById('formsListContainer');

    const formTypeNames = {
        'test_drive': 'Test Drive Agreement',
        'vsa': 'Vehicle Sales Agreement',
        'pdpa': 'PDPA Consent Form',
        'coe_bidding_1': 'COE Bidding 1',
        'coe_bidding_2': 'COE Bidding 2',
        'pdpa_consent_1': 'PDPA Consent 1',
        'pdpa_consent_2': 'PDPA Consent 2',
        'delivery_checklist_1': 'Delivery Checklist Form (1 of 2)',
        'delivery_checklist_2': 'Delivery Checklist Form (2 of 2)',
        'other': 'Other Form'
    };

    if (Object.keys(formTemplates).length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: #7f8c8d;">No forms uploaded yet</div>';
        return;
    }

    let html = '';
    for (const [formType, formData] of Object.entries(formTemplates)) {
        const formName = formTypeNames[formType] || formType;
        const uploadDate = new Date(formData.uploadDate).toLocaleDateString();

        const hasFieldMapping = formData.fileType === 'image';
        const fieldCount = formData.fieldMappings ? Object.keys(formData.fieldMappings).length : 0;

        html += `
            <div class="file-item">
                <div class="file-info">
                    <div class="file-icon">📄</div>
                    <div class="file-details">
                        <h4>${formName}</h4>
                        <p>${formData.fileName} • Uploaded: ${uploadDate}</p>
                        ${hasFieldMapping ? '<p style="font-size: 12px; color: #27ae60; margin-top: 3px;">✓ ' + fieldCount + ' field(s) mapped</p>' : ''}
                    </div>
                </div>
                <div class="file-actions" style="display: flex; gap: 5px; flex-wrap: wrap;">
                    ${hasFieldMapping ? '<button class="btn btn-small" onclick="openFieldMappingModal(\'' + formType + '\')" style="background: #00bcd4; color: white;">⚙️ Configure Fields</button>' : ''}
                    <button class="btn btn-small btn-primary" onclick="viewForm('${formType}')">View</button>
                    <button class="btn btn-small btn-danger" onclick="deleteForm('${formType}')">Delete</button>
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
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

// ============ Field Mapping Functions ============

async function openFieldMappingModal(formType) {
    const formData = formTemplates[formType];
    if (!formData || formData.fileType !== 'image') {
        alert('This form does not support field mapping');
        return;
    }

    currentMappingFormType = formType;
    tempFieldMappings = JSON.parse(JSON.stringify(formData.fieldMappings || {}));

    // Show modal
    document.getElementById('fieldMappingModal').style.display = 'flex';

    // Load form image onto canvas
    const canvas = document.getElementById('formMappingCanvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    try {
        // Fetch image from Drive
        const base64Data = await getFormImageFromDrive(formType);

        img.onload = function() {
            // Scale to fit screen while maintaining aspect ratio
            const maxWidth = Math.min(window.innerWidth * 0.8, 1000);
            const scale = maxWidth / img.width;
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;

            currentMappingCanvas = canvas;
            currentMappingImage = img;

            redrawMappingCanvas();
        };

        img.src = base64Data;
    } catch (error) {
        alert('Failed to load form image: ' + error.message);
        document.getElementById('fieldMappingModal').style.display = 'none';
    }
}

function redrawMappingCanvas() {
    if (!currentMappingCanvas || !currentMappingImage) return;

    const canvas = currentMappingCanvas;
    const ctx = canvas.getContext('2d');

    // Clear and draw image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(currentMappingImage, 0, 0, canvas.width, canvas.height);

    // Draw field markers
    const scale = canvas.width / currentMappingImage.width;
    for (const [fieldId, field] of Object.entries(tempFieldMappings)) {
        const x = field.x * scale;
        const y = field.y * scale;

        // Draw marker circle
        ctx.fillStyle = 'rgba(0, 188, 212, 0.3)';
        ctx.beginPath();
        ctx.arc(x, y, 15, 0, 2 * Math.PI);
        ctx.fill();

        ctx.strokeStyle = '#00bcd4';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, 15, 0, 2 * Math.PI);
        ctx.stroke();

        // Draw field label
        ctx.fillStyle = '#00bcd4';
        ctx.font = 'bold 12px Arial';
        const labelText = field.customValue ? field.customValue : field.type;
        ctx.fillText(labelText, x + 20, y + 5);
    }

    // Update mapped fields list
    updateMappedFieldsList();
}

function updateMappedFieldsList() {
    const listContainer = document.getElementById('mappedFieldsList');
    if (Object.keys(tempFieldMappings).length === 0) {
        listContainer.innerHTML = '<p style="color: #7f8c8d;">No fields mapped yet. Click on the form to add fields.</p>';
        return;
    }

    let html = '<ul style="list-style: none; padding: 0;">';
    for (const [fieldId, field] of Object.entries(tempFieldMappings)) {
        const fieldNames = {
            'name': 'Customer Name',
            'phone': 'Phone Number',
            'email': 'Email',
            'address': 'Address',
            'addressContinue': 'Address Continue',
            'fullAddress': 'Full Address (Combined)',
            'date': 'Today\'s Date',
            'custom': 'Custom Value'
        };

        let displayText;
        if (field.customValue) {
            displayText = '<strong>Custom: "' + field.customValue + '"</strong>';
        } else {
            displayText = '<strong>' + (fieldNames[field.type] || field.type) + '</strong>';
        }

        html += '<li id="field-item-' + fieldId + '" style="padding: 8px; margin-bottom: 5px; background: white; border-radius: 4px;">';

        // Display mode
        html += '<div id="field-display-' + fieldId + '" style="display: flex; justify-content: space-between; align-items: center;">';
        html += '<span>' + displayText + ' - Size: ' + field.fontSize + 'px, Color: <span style="display: inline-block; width: 16px; height: 16px; background: ' + field.color + '; border: 1px solid #ccc; vertical-align: middle; border-radius: 2px;"></span></span>';
        html += '<div>';
        html += '<button class="btn btn-small btn-primary" onclick="editFieldMapping(\'' + fieldId + '\')" style="margin-right: 5px;">Edit</button>';
        html += '<button class="btn btn-small btn-danger" onclick="removeFieldMapping(\'' + fieldId + '\')">Remove</button>';
        html += '</div>';
        html += '</div>';

        // Edit mode (hidden by default)
        html += '<div id="field-edit-' + fieldId + '" style="display: none;">';
        html += '<div style="margin-bottom: 10px;">';
        html += '<label style="display: block; margin-bottom: 5px; font-size: 12px; color: #555;">Font Size:</label>';
        html += '<select id="edit-fontSize-' + fieldId + '" style="width: 100%; padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px; font-size: 14px;">';
        for (let size = 8; size <= 48; size += 2) {
            const selected = size === field.fontSize ? ' selected' : '';
            html += '<option value="' + size + '"' + selected + '>' + size + 'px</option>';
        }
        html += '</select>';
        html += '</div>';
        html += '<div style="margin-bottom: 10px;">';
        html += '<label style="display: block; margin-bottom: 5px; font-size: 12px; color: #555;">Text Color:</label>';
        html += '<input type="color" id="edit-color-' + fieldId + '" value="' + field.color + '" style="width: 100%; height: 36px; border: 1px solid #cbd5e0; border-radius: 4px;">';
        html += '</div>';
        html += '<div style="display: flex; gap: 5px;">';
        html += '<button class="btn btn-small btn-success" onclick="saveFieldEdit(\'' + fieldId + '\')">Save</button>';
        html += '<button class="btn btn-small btn-secondary" onclick="cancelFieldEdit(\'' + fieldId + '\')">Cancel</button>';
        html += '</div>';
        html += '</div>';

        html += '</li>';
    }
    html += '</ul>';
    listContainer.innerHTML = html;
}

function removeFieldMapping(fieldId) {
    delete tempFieldMappings[fieldId];
    redrawMappingCanvas();
}

function clearAllFieldMappings() {
    if (!confirm('Remove all field mappings?')) return;
    tempFieldMappings = {};
    redrawMappingCanvas();
}

// Edit field mapping
function editFieldMapping(fieldId) {
    // Hide display mode and show edit mode
    document.getElementById('field-display-' + fieldId).style.display = 'none';
    document.getElementById('field-edit-' + fieldId).style.display = 'block';
}

// Save field edit
function saveFieldEdit(fieldId) {
    const fontSize = parseInt(document.getElementById('edit-fontSize-' + fieldId).value);
    const color = document.getElementById('edit-color-' + fieldId).value;

    // Update the field mapping
    tempFieldMappings[fieldId].fontSize = fontSize;
    tempFieldMappings[fieldId].color = color;

    // Redraw canvas to show updated font size/color
    redrawMappingCanvas();
}

// Cancel field edit
function cancelFieldEdit(fieldId) {
    // Hide edit mode and show display mode
    document.getElementById('field-edit-' + fieldId).style.display = 'none';
    document.getElementById('field-display-' + fieldId).style.display = 'flex';
}

// Toggle custom value input visibility
function toggleCustomValueInput() {
    const fieldTypeSelect = document.getElementById('fieldTypeSelect');
    const customValueContainer = document.getElementById('customValueInputContainer');

    if (fieldTypeSelect.value === 'custom') {
        customValueContainer.style.display = 'block';
    } else {
        customValueContainer.style.display = 'none';
    }
}

// Canvas click handler
document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('formMappingCanvas');
    if (canvas) {
        canvas.addEventListener('click', function(e) {
            if (!currentMappingFormType) return;

            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Convert to original image coordinates
            const scale = canvas.width / currentMappingImage.width;
            const originalX = x / scale;
            const originalY = y / scale;

            // Get field settings
            const fieldType = document.getElementById('fieldTypeSelect').value;
            const fontSize = parseInt(document.getElementById('fieldFontSize').value);
            const textColor = document.getElementById('fieldTextColor').value;

            // Check if custom value
            let customValue = null;
            if (fieldType === 'custom') {
                customValue = document.getElementById('customValueInput').value.trim();
                if (!customValue) {
                    alert('Please enter a custom value');
                    return;
                }
            }

            // Add field mapping
            const fieldId = 'field_' + Date.now();
            tempFieldMappings[fieldId] = {
                type: fieldType,
                x: originalX,
                y: originalY,
                fontSize: fontSize,
                color: textColor
            };

            // Store custom value if provided
            if (customValue) {
                tempFieldMappings[fieldId].customValue = customValue;
            }

            redrawMappingCanvas();
        });
    }
});

async function saveFieldMappings() {
    if (!currentMappingFormType) return;

    const formData = formTemplates[currentMappingFormType];
    formData.fieldMappings = tempFieldMappings;

    await saveFormTemplates();

    alert('Field mappings saved successfully!');
    closeFieldMappingModal();
    displayFormsList();
}

function closeFieldMappingModal() {
    document.getElementById('fieldMappingModal').style.display = 'none';
    currentMappingFormType = null;
    currentMappingCanvas = null;
    currentMappingImage = null;
    tempFieldMappings = {};
}

// ============ Combine & Print Forms ============

// Open combine print modal and populate form options
function openCombinePrintModal(customerId) {
    currentCombineCustomerId = customerId;

    const modal = document.getElementById('combinePrintModal');
    const side1Select = document.getElementById('combineSide1');
    const side2Select = document.getElementById('combineSide2');

    // Clear existing options except the default
    side1Select.innerHTML = '<option value="">Select a form...</option>';
    side2Select.innerHTML = '<option value="">Select a form...</option>';

    // Form type names for display
    const formTypeNames = {
        'test_drive': 'Test Drive Agreement',
        'vsa': 'Vehicle Sales Agreement',
        'pdpa': 'PDPA Consent Form',
        'coe_bidding_1': 'COE Bidding 1',
        'coe_bidding_2': 'COE Bidding 2',
        'pdpa_consent_1': 'PDPA Consent 1',
        'pdpa_consent_2': 'PDPA Consent 2',
        'delivery_checklist_1': 'Delivery Checklist Form (1 of 2)',
        'delivery_checklist_2': 'Delivery Checklist Form (2 of 2)',
        'other': 'Other Form'
    };

    // Populate dropdowns with available image forms
    for (const [formType, formData] of Object.entries(formTemplates)) {
        if (formData.fileType === 'image') {
            const formName = formTypeNames[formType] || formType;
            const option1 = document.createElement('option');
            option1.value = formType;
            option1.textContent = formName;

            const option2 = document.createElement('option');
            option2.value = formType;
            option2.textContent = formName;

            side1Select.appendChild(option1);
            side2Select.appendChild(option2);
        }
    }

    // Show modal
    modal.style.display = 'flex';
}

// Close combine print modal
function closeCombinePrintModal() {
    document.getElementById('combinePrintModal').style.display = 'none';
    currentCombineCustomerId = null;
}

// Combine and print selected forms with customer data
async function combinePrintForms() {
    const side1 = document.getElementById('combineSide1').value;
    const side2 = document.getElementById('combineSide2').value;

    if (!side1 || !side2) {
        alert('Please select forms for both sides');
        return;
    }

    if (side1 === side2) {
        alert('Please select different forms for each side');
        return;
    }

    if (!currentCombineCustomerId) {
        alert('Customer not found');
        return;
    }

    // Save customer ID before closing modal (which clears the variable)
    const customerId = currentCombineCustomerId;

    try {
        // Close modal
        closeCombinePrintModal();

        // Get customer data
        const customer = customers.find(c => c.id === customerId);
        if (!customer) {
            alert('Customer not found');
            return;
        }

        // Show loading
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'combineLoadingOverlay';
        loadingDiv.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 10000;';
        loadingDiv.innerHTML = '<div style="background: white; padding: 30px; border-radius: 10px; text-align: center;"><div class="loading" style="margin-bottom: 15px;"></div><p style="color: #2c3e50; font-size: 16px;">Preparing forms with customer data...</p></div>';
        document.body.appendChild(loadingDiv);

        // Render forms with customer data (uses field mapping if configured)
        const form1Data = await renderFormWithData(side1, customer);
        const form2Data = await renderFormWithData(side2, customer);

        // Get form names
        const formTypeNames = {
            'test_drive': 'Test Drive Agreement',
            'vsa': 'Vehicle Sales Agreement',
            'pdpa': 'PDPA Consent Form',
            'coe_bidding_1': 'COE Bidding 1',
            'coe_bidding_2': 'COE Bidding 2',
            'pdpa_consent_1': 'PDPA Consent 1',
            'pdpa_consent_2': 'PDPA Consent 2',
            'other': 'Other Form'
        };

        const form1Name = formTypeNames[side1] || side1;
        const form2Name = formTypeNames[side2] || side2;

        // Remove loading
        document.body.removeChild(loadingDiv);

        // Create print window with both forms
        const printWin = window.open('', '_blank');
        printWin.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>${customer.name} - ${form1Name} & ${form2Name}</title>
                <style>
                    @page {
                        size: A4;
                        margin: 0;
                    }
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    body {
                        font-family: Arial, sans-serif;
                    }
                    .page {
                        width: 210mm;
                        height: 297mm;
                        page-break-after: always;
                        background: white;
                        position: relative;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .page:last-child {
                        page-break-after: auto;
                    }
                    .page img {
                        max-width: 100%;
                        max-height: 100%;
                        object-fit: contain;
                    }
                    .print-btn {
                        position: fixed;
                        top: 20px;
                        right: 20px;
                        padding: 14px 28px;
                        background: #27ae60;
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 15px;
                        font-weight: 700;
                        box-shadow: 0 6px 16px rgba(0,0,0,0.3);
                        z-index: 1000;
                        transition: all 0.3s;
                    }
                    .print-btn:hover {
                        background: #229954;
                        transform: translateY(-2px);
                        box-shadow: 0 8px 20px rgba(0,0,0,0.4);
                    }
                    .info-banner {
                        position: fixed;
                        top: 20px;
                        left: 20px;
                        background: rgba(0, 188, 212, 0.95);
                        color: white;
                        padding: 12px 20px;
                        border-radius: 6px;
                        font-size: 14px;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                        z-index: 1000;
                    }
                    @media print {
                        .no-print {
                            display: none !important;
                        }
                        body {
                            print-color-adjust: exact;
                            -webkit-print-color-adjust: exact;
                        }
                    }
                </style>
            </head>
            <body>
                <button class="print-btn no-print" onclick="window.print()">🖨️ Print Double-Sided</button>
                <div class="info-banner no-print">
                    <strong>${customer.name}</strong><br>
                    📑 Page 1: ${form1Name} | Page 2: ${form2Name}
                </div>

                <!-- Page 1 (Front) -->
                <div class="page">
                    <img src="${form1Data}" alt="${form1Name}">
                </div>

                <!-- Page 2 (Back) -->
                <div class="page">
                    <img src="${form2Data}" alt="${form2Name}">
                </div>
            </body>
            </html>
        `);
        printWin.document.close();

    } catch (error) {
        // Remove loading if exists
        const loadingOverlay = document.getElementById('combineLoadingOverlay');
        if (loadingOverlay) {
            document.body.removeChild(loadingOverlay);
        }
        console.error('Error combining forms:', error);
        alert('Failed to combine forms: ' + error.message);
    }
}

// ============ Form Rendering and Printing ============

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
                'vsa_coeRebate': customer.vsaDetails?.coeRebate || '',
                'vsa_deposit': customer.vsaDetails?.deposit || '',
                'vsa_lessOthers': customer.vsaDetails?.lessOthers || '',
                'vsa_addOthers': customer.vsaDetails?.addOthers || '',
                'vsa_deliveryDate': customer.vsaDetails?.deliveryDate || '',
                'vsa_tradeInCarNo': customer.vsaDetails?.tradeInCarNo || '',
                'vsa_tradeInCarModel': customer.vsaDetails?.tradeInCarModel || '',
                'vsa_tradeInAmount': customer.vsaDetails?.tradeInAmount || '',
                'vsa_dateOfRegistration': customer.vsaDetails?.dateOfRegistration || '',
                'vsa_registrationNo': customer.vsaDetails?.registrationNo || '',
                'vsa_chassisNo': customer.vsaDetails?.chassisNo || '',
                'vsa_engineNo': customer.vsaDetails?.engineNo || '',
                'vsa_remarks1': customer.vsaDetails?.remarks1 || '',
                'vsa_remarks2': customer.vsaDetails?.remarks2 || '',
                'vsa_loanAmount': customer.vsaDetails?.loanAmount || '',
                'vsa_interest': customer.vsaDetails?.interest || '',
                'vsa_tenure': customer.vsaDetails?.tenure || '',
                'vsa_monthlyPayment': customer.vsaDetails?.monthlyPayment || '',
                'vsa_financeCompany': customer.vsaDetails?.financeCompany || '',
                'vsa_adminFee': customer.vsaDetails?.adminFee || '',
                'vsa_insuranceSubsidy': customer.vsaDetails?.insuranceSubsidy || '',
                'vsa_insuranceCompany': customer.vsaDetails?.insuranceCompany || '',
                'vsa_insuranceFee': customer.vsaDetails?.insuranceFee || ''
            };

            // Calculate Insurance Net (Insurance Fee - Insurance Subsidy)
            const insuranceFee = parseFloat(customer.vsaDetails?.insuranceFee?.replace(/[^0-9.-]/g, '') || '0');
            const insuranceSubsidy = parseFloat(customer.vsaDetails?.insuranceSubsidy?.replace(/[^0-9.-]/g, '') || '0');
            const insuranceNet = insuranceFee - insuranceSubsidy;
            dataMapping['vsa_insuranceNet'] = insuranceNet !== 0 ? insuranceNet.toString() : '';

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
