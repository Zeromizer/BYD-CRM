/**
 * excel.js
 *
 * Excel Template Management Module
 * Handles Excel template creation, field mapping, and population with customer data.
 * Provides functionality to map customer fields to specific Excel cells and generate
 * populated Excel files using xlsx-populate library.
 */

// ========== EXCEL TEMPLATES MANAGEMENT ==========

// Open Excel modal
async function openExcelModal() {
    const modal = document.getElementById('excelModal');
    modal.classList.add('active');
    await loadExcelTemplates();
    displayExcelList();
}

// Close Excel modal
function closeExcelModal() {
    document.getElementById('excelModal').classList.remove('active');
    document.getElementById('excelTemplateName').value = '';
    document.getElementById('excelTemplateFile').value = '';
}

// Create Excel template (mappings only, no file storage)
async function createExcelTemplate() {
    const nameInput = document.getElementById('excelTemplateName');
    const fileInput = document.getElementById('excelTemplateFile');
    const name = nameInput.value.trim();

    if (!name) {
        alert('Please enter a template name');
        return;
    }

    // Create template structure
    const templateId = 'excel_' + Date.now();
    const template = {
        id: templateId,
        name: name,
        createdDate: new Date().toISOString(),
        fieldMappings: {}, // Will be populated by user
        driveFileId: null, // Google Drive file ID for master template
        driveFileName: null // Original filename
    };

    // Check if user uploaded a file
    const file = fileInput.files[0];
    if (file) {
        // Upload to Google Drive if signed in
        if (!isSignedIn) {
            alert('Please sign in to Google Drive to upload the master Excel file.\n\nTemplate will be created without a master file.');
        } else {
            try {
                // Ensure Excel Templates folder exists
                await getOrCreateExcelTemplatesFolder();

                if (!excelTemplatesFolderId) {
                    alert('Could not create Excel Templates folder in Google Drive.\n\nTemplate will be created without a master file.');
                } else {
                    // Upload file to Google Drive
                    const metadata = {
                        name: file.name,
                        parents: [excelTemplatesFolderId]
                    };

                    const form = new FormData();
                    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
                    form.append('file', file);

                    const response = await fetch(
                        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
                        {
                            method: 'POST',
                            headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
                            body: form
                        }
                    );

                    const result = await response.json();
                    if (result && result.id) {
                        template.driveFileId = result.id;
                        template.driveFileName = file.name;
                        console.log('Excel template file uploaded to Drive:', result.id);
                    } else {
                        alert('Failed to upload Excel file to Google Drive.\n\nTemplate will be created without a master file.');
                    }
                }
            } catch (error) {
                console.error('Error uploading Excel template file:', error);
                alert('Error uploading Excel file to Google Drive: ' + error.message + '\n\nTemplate will be created without a master file.');
            }
        }
    }

    // Save template
    excelTemplates[templateId] = template;
    await saveExcelTemplates();

    // Update display
    displayExcelList();

    // Clear inputs
    nameInput.value = '';
    fileInput.value = '';

    if (template.driveFileId) {
        alert('Template created successfully with master Excel file!\n\nNow you can map fields to Excel cells.');
    } else {
        alert('Template created successfully!\n\nNow you can map fields to Excel cells.');
    }
}

// Display Excel templates list
function displayExcelList() {
    const container = document.getElementById('excelListContainer');

    if (Object.keys(excelTemplates).length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: #7f8c8d;">No templates uploaded yet</div>';
        return;
    }

    let html = '<div style="display: flex; flex-direction: column; gap: 10px;">';

    for (const [templateId, template] of Object.entries(excelTemplates)) {
        const mappingCount = Object.keys(template.fieldMappings || {}).length;
        const dateToShow = template.createdDate || template.uploadDate; // Support both old and new templates
        const hasMasterFile = template.driveFileId && template.driveFileName;

        html += `
            <div style="background: white; border: 2px solid #e0e0e0; border-radius: 8px; padding: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                    <div>
                        <h4 style="color: #1a1a2e; margin-bottom: 5px;">${template.name}</h4>
                        <p style="color: #7f8c8d; font-size: 12px;">Created: ${new Date(dateToShow).toLocaleDateString()}</p>
                        <p style="color: #4caf50; font-size: 13px; font-weight: 600; margin-top: 5px;">${mappingCount} field${mappingCount !== 1 ? 's' : ''} mapped</p>
                        ${hasMasterFile ? `<p style="color: #27ae60; font-size: 12px; margin-top: 5px;">✓ Master file: ${template.driveFileName}</p>` : '<p style="color: #95a5a6; font-size: 12px; margin-top: 5px;">⚠ No master file uploaded</p>'}
                    </div>
                    <button class="btn btn-danger" onclick="deleteExcelTemplate('${templateId}')" style="padding: 8px 12px; font-size: 13px;">Delete</button>
                </div>
                <div style="display: flex; gap: 10px; margin-top: 10px;">
                    <button class="btn btn-primary" onclick="openExcelMappingModal('${templateId}')" style="flex: 1; background: #2196f3;">Map Fields</button>
                    <button class="btn ${hasMasterFile ? 'btn-secondary' : 'btn-success'}" onclick="openUploadMasterFileModal('${templateId}')" style="flex: 1;">${hasMasterFile ? 'Update Master File' : 'Upload Master File'}</button>
                </div>
            </div>
        `;
    }

    html += '</div>';
    container.innerHTML = html;
}

// Delete Excel template
async function deleteExcelTemplate(templateId) {
    if (!confirm('Are you sure you want to delete this Excel template?')) {
        return;
    }

    const template = excelTemplates[templateId];

    // Delete file from Google Drive if it exists
    if (template && template.driveFileId) {
        if (isSignedIn) {
            try {
                await gapi.client.drive.files.delete({
                    fileId: template.driveFileId
                });
                console.log('Deleted Excel template file from Drive:', template.driveFileId);
            } catch (error) {
                console.error('Error deleting file from Drive:', error);
                // Continue with template deletion even if Drive deletion fails
            }
        }
    }

    delete excelTemplates[templateId];
    await saveExcelTemplates();
    displayExcelList();
}

// Save Excel templates to localStorage
async function saveExcelTemplates() {
    try {
        // Save to localStorage first (optimistic save)
        localStorage.setItem('excelTemplates', JSON.stringify(excelTemplates));

        // Sync to Google Drive if signed in
        if (isSignedIn && excelTemplatesFolderId) {
            try {
                // Ensure data file exists
                if (!excelDataFileId) {
                    await getOrCreateExcelDataFile();
                }

                // Upload templates to Drive
                if (excelDataFileId) {
                    await updateExcelDataFile(excelTemplates);
                    console.log('Excel templates synced to Google Drive');
                }
            } catch (syncError) {
                console.error('Error syncing Excel templates to Drive:', syncError);
                // Continue even if sync fails - data is already in localStorage
            }
        }
    } catch (error) {
        console.error('Error saving Excel templates:', error);
    }
}

// Load Excel templates from Google Drive and merge with localStorage
async function loadExcelTemplates() {
    try {
        // Load from localStorage first
        const stored = localStorage.getItem('excelTemplates');
        let localTemplates = {};
        if (stored) {
            localTemplates = JSON.parse(stored);
        }

        // Try to load from Google Drive if signed in
        if (isSignedIn && excelTemplatesFolderId) {
            try {
                // Ensure data file exists
                if (!excelDataFileId) {
                    await getOrCreateExcelDataFile();
                }

                // Load from Drive
                if (excelDataFileId) {
                    const driveTemplates = await loadExcelTemplatesFromDrive();

                    if (driveTemplates && Object.keys(driveTemplates).length > 0) {
                        // Use Drive as the source of truth (this ensures deletions are synced)
                        excelTemplates = driveTemplates;

                        // Save Drive templates to localStorage for offline access
                        localStorage.setItem('excelTemplates', JSON.stringify(excelTemplates));
                        console.log('Excel templates loaded from Google Drive');
                        return;
                    } else if (Object.keys(localTemplates).length > 0) {
                        // Drive is empty but we have local templates - this is a first-time sync
                        // Upload local templates to Drive
                        console.log('First-time sync: uploading local templates to Drive');
                        excelTemplates = localTemplates;
                        await updateExcelDataFile(excelTemplates);
                        return;
                    }
                }
            } catch (syncError) {
                console.error('Error loading Excel templates from Drive:', syncError);
                // Fall back to localStorage
            }
        }

        // Use localStorage templates if Drive sync failed or not signed in
        excelTemplates = localTemplates;
    } catch (error) {
        console.error('Error loading Excel templates:', error);
    }
}

// Open Excel mapping modal
function openExcelMappingModal(templateId) {
    currentExcelTemplateId = templateId;
    const template = excelTemplates[templateId];

    if (!template) {
        alert('Template not found');
        return;
    }

    // Load existing mappings
    tempExcelMappings = { ...(template.fieldMappings || {}) };

    // Show modal
    document.getElementById('excelMappingModal').style.display = 'flex';

    // Update display
    updateExcelMappingsList();
}

// Close Excel mapping modal
function closeExcelMappingModal() {
    document.getElementById('excelMappingModal').style.display = 'none';
    currentExcelTemplateId = null;
    tempExcelMappings = {};
}

// Add Excel field mapping
function addExcelMapping() {
    const fieldType = document.getElementById('excelFieldType').value;
    const cellRef = document.getElementById('excelCellRef').value.trim().toUpperCase();

    if (!cellRef) {
        alert('Please enter a cell reference (e.g., A1)');
        return;
    }

    // Validate cell reference format (simple validation)
    if (!/^[A-Z]+[0-9]+$/.test(cellRef)) {
        alert('Invalid cell reference. Please use format like A1, B5, C10, etc.');
        return;
    }

    // Add mapping
    const mappingId = 'mapping_' + Date.now();
    tempExcelMappings[mappingId] = {
        fieldType: fieldType,
        cellRef: cellRef
    };

    // Clear input
    document.getElementById('excelCellRef').value = '';

    // Update display
    updateExcelMappingsList();
}

// Remove Excel mapping
function removeExcelMapping(mappingId) {
    delete tempExcelMappings[mappingId];
    updateExcelMappingsList();
}

// Edit Excel mapping
function editExcelMapping(mappingId) {
    // Hide display mode and show edit mode
    document.getElementById('excel-display-' + mappingId).style.display = 'none';
    document.getElementById('excel-edit-' + mappingId).style.display = 'block';
}

// Save Excel mapping edit
function saveExcelMappingEdit(mappingId) {
    const cellRef = document.getElementById('edit-cellRef-' + mappingId).value.trim().toUpperCase();

    // Validate cell reference format
    if (!/^[A-Z]+[0-9]+$/.test(cellRef)) {
        alert('Invalid cell reference. Please use format like A1, B5, C10, etc.');
        return;
    }

    // Update the mapping
    tempExcelMappings[mappingId].cellRef = cellRef;

    // Refresh the list
    updateExcelMappingsList();
}

// Cancel Excel mapping edit
function cancelExcelMappingEdit(mappingId) {
    // Hide edit mode and show display mode
    document.getElementById('excel-edit-' + mappingId).style.display = 'none';
    document.getElementById('excel-display-' + mappingId).style.display = 'flex';
}

// Update Excel mappings list display
function updateExcelMappingsList() {
    const container = document.getElementById('excelMappingsList');

    if (Object.keys(tempExcelMappings).length === 0) {
        container.innerHTML = '<p style="color: #7f8c8d; font-style: italic;">No mappings added yet</p>';
        return;
    }

    const fieldNames = {
        'name': 'Customer Name',
        'phone': 'Phone Number',
        'email': 'Email',
        'nric': 'NRIC/FIN',
        'occupation': 'Occupation',
        'dob': 'Date of Birth',
        'address': 'Address',
        'addressContinue': 'Address Continue',
        'fullAddress': 'Full Address (Combined)',
        'salesConsultant': 'Sales Consultant',
        'vsaNo': 'VSA No',
        'date': 'Today\'s Date',
        'vsa_makeModel': 'VSA - Make & Model',
        'vsa_yom': 'VSA - YOM (Year of Manufacture)',
        'vsa_bodyColour': 'VSA - Body Colour',
        'vsa_upholstery': 'VSA - Upholstery',
        'vsa_przType': 'VSA - P/R/Z Type',
        'vsa_package': 'VSA - Package',
        'vsa_sellingWithCOE': 'VSA - Selling with COE',
        'vsa_sellingPriceList': 'VSA - Selling Price on Price List',
        'vsa_purchasePriceWithCOE': 'VSA - Purchase Price with COE',
        'vsa_coeRebateLevel': 'VSA - COE Rebate Level',
        'vsa_coeRebate': 'VSA - COE Rebate',
        'vsa_deposit': 'VSA - Deposit',
        'vsa_lessOthers': 'VSA - Less: Others',
        'vsa_addOthers': 'VSA - Add: Others',
        'vsa_deliveryDate': 'VSA - Approximate Delivery Date',
        'vsa_tradeInCarNo': 'VSA - Trade in Car No',
        'vsa_tradeInCarModel': 'VSA - Trade in Car Model',
        'vsa_tradeInAmount': 'VSA - Trade In Amount',
        'vsa_dateOfRegistration': 'VSA - Date of Registration',
        'vsa_registrationNo': 'VSA - Registration No',
        'vsa_chassisNo': 'VSA - Chassis No',
        'vsa_engineNo': 'VSA - Engine No',
        'vsa_remarks1': 'VSA - Remarks 1',
        'vsa_remarks2': 'VSA - Remarks 2',
        'vsa_loanAmount': 'VSA - Loan Amount',
        'vsa_interest': 'VSA - Interest',
        'vsa_tenure': 'VSA - Tenure',
        'vsa_monthlyPayment': 'VSA - Monthly Payment',
        'vsa_financeCompany': 'VSA - Finance Company',
        'vsa_adminFee': 'VSA - Admin Fee',
        'vsa_insuranceSubsidy': 'VSA - Insurance Subsidy',
        'vsa_insuranceCompany': 'VSA - Insurance Company',
        'vsa_insuranceFee': 'VSA - Insurance Fee',
        'vsa_insuranceNet': 'VSA - Insurance Net (Fee - Subsidy)'
    };

    let html = '<div style="display: flex; flex-direction: column; gap: 8px;">';

    for (const [mappingId, mapping] of Object.entries(tempExcelMappings)) {
        html += `
            <div id="excel-mapping-item-${mappingId}" style="padding: 10px; background: white; border-radius: 6px; border: 1px solid #e0e0e0;">
                <div id="excel-display-${mappingId}" style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${fieldNames[mapping.fieldType]}</strong> → Cell <strong>${mapping.cellRef}</strong>
                    </div>
                    <div>
                        <button class="btn btn-small btn-primary" onclick="editExcelMapping('${mappingId}')" style="padding: 5px 10px; font-size: 12px; margin-right: 5px;">Edit</button>
                        <button class="btn btn-small btn-danger" onclick="removeExcelMapping('${mappingId}')" style="padding: 5px 10px; font-size: 12px;">Remove</button>
                    </div>
                </div>
                <div id="excel-edit-${mappingId}" style="display: none; margin-top: 10px;">
                    <div style="margin-bottom: 10px;">
                        <label style="display: block; margin-bottom: 5px; font-size: 12px; color: #555;">Cell Reference:</label>
                        <input type="text" id="edit-cellRef-${mappingId}" value="${mapping.cellRef}" placeholder="e.g., A1, B5, C10" style="width: 100%; padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px; font-size: 14px; text-transform: uppercase;">
                    </div>
                    <div style="display: flex; gap: 5px;">
                        <button class="btn btn-small btn-success" onclick="saveExcelMappingEdit('${mappingId}')" style="padding: 5px 10px; font-size: 12px;">Save</button>
                        <button class="btn btn-small btn-secondary" onclick="cancelExcelMappingEdit('${mappingId}')" style="padding: 5px 10px; font-size: 12px;">Cancel</button>
                    </div>
                </div>
            </div>
        `;
    }

    html += '</div>';
    container.innerHTML = html;
}

// Save Excel mappings
async function saveExcelMappings() {
    if (!currentExcelTemplateId) {
        return;
    }

    const template = excelTemplates[currentExcelTemplateId];
    if (!template) {
        alert('Template not found');
        return;
    }

    template.fieldMappings = tempExcelMappings;
    await saveExcelTemplates();

    alert('Field mappings saved successfully!');
    closeExcelMappingModal();
    displayExcelList();
}

// Open Excel populate modal
function openExcelPopulateModal(customerId) {
    currentPopulateCustomerId = customerId;
    const modal = document.getElementById('excelPopulateModal');
    modal.style.display = 'flex';

    // Clear file input
    document.getElementById('excelOriginalFile').value = '';

    // Populate template select
    const select = document.getElementById('excelTemplateSelect');
    select.innerHTML = '<option value="">-- Select a mapping template --</option>';

    for (const [templateId, template] of Object.entries(excelTemplates)) {
        const mappingCount = Object.keys(template.fieldMappings || {}).length;
        select.innerHTML += `<option value="${templateId}">${template.name} (${mappingCount} fields mapped)</option>`;
    }

    // Reset preview
    updateExcelPreview();
}

// Close Excel populate modal
function closeExcelPopulateModal() {
    document.getElementById('excelPopulateModal').style.display = 'none';
    document.getElementById('excelOriginalFile').value = '';
    currentPopulateCustomerId = null;
}

// Update Excel preview (called when template or file selection changes)
function updateExcelPreview() {
    const select = document.getElementById('excelTemplateSelect');
    const templateId = select.value;
    const downloadBtn = document.getElementById('downloadExcelBtn');
    const previewContainer = document.getElementById('excelCustomerPreview');
    const fileInput = document.getElementById('excelOriginalFile');

    if (!templateId) {
        previewContainer.innerHTML = '<p>Select a mapping template to preview...</p>';
        downloadBtn.disabled = true;
        return;
    }

    const template = excelTemplates[templateId];
    const customer = customers.find(c => c.id === currentPopulateCustomerId);

    if (!customer) {
        previewContainer.innerHTML = '<p style="color: #e74c3c;">Customer not found</p>';
        downloadBtn.disabled = true;
        return;
    }

    const mappingCount = Object.keys(template.fieldMappings || {}).length;

    if (mappingCount === 0) {
        previewContainer.innerHTML = '<p style="color: #f39c12;">⚠️ No field mappings configured for this template. Please map fields first.</p>';
        downloadBtn.disabled = true;
        return;
    }

    // Check if template has a master file in Drive
    const hasMasterFile = template.driveFileId && template.driveFileName;

    const fieldNames = {
        'name': 'Customer Name',
        'phone': 'Phone Number',
        'email': 'Email',
        'nric': 'NRIC/FIN',
        'occupation': 'Occupation',
        'dob': 'Date of Birth',
        'address': 'Address',
        'addressContinue': 'Address Continue',
        'fullAddress': 'Full Address (Combined)',
        'salesConsultant': 'Sales Consultant',
        'vsaNo': 'VSA No',
        'date': 'Today\'s Date',
        'vsa_makeModel': 'VSA - Make & Model',
        'vsa_yom': 'VSA - YOM (Year of Manufacture)',
        'vsa_bodyColour': 'VSA - Body Colour',
        'vsa_upholstery': 'VSA - Upholstery',
        'vsa_przType': 'VSA - P/R/Z Type',
        'vsa_package': 'VSA - Package',
        'vsa_sellingWithCOE': 'VSA - Selling with COE',
        'vsa_sellingPriceList': 'VSA - Selling Price on Price List',
        'vsa_purchasePriceWithCOE': 'VSA - Purchase Price with COE',
        'vsa_coeRebateLevel': 'VSA - COE Rebate Level',
        'vsa_coeRebate': 'VSA - COE Rebate',
        'vsa_deposit': 'VSA - Deposit',
        'vsa_lessOthers': 'VSA - Less: Others',
        'vsa_addOthers': 'VSA - Add: Others',
        'vsa_deliveryDate': 'VSA - Approximate Delivery Date',
        'vsa_tradeInCarNo': 'VSA - Trade in Car No',
        'vsa_tradeInCarModel': 'VSA - Trade in Car Model',
        'vsa_tradeInAmount': 'VSA - Trade In Amount',
        'vsa_dateOfRegistration': 'VSA - Date of Registration',
        'vsa_registrationNo': 'VSA - Registration No',
        'vsa_chassisNo': 'VSA - Chassis No',
        'vsa_engineNo': 'VSA - Engine No',
        'vsa_remarks1': 'VSA - Remarks 1',
        'vsa_remarks2': 'VSA - Remarks 2',
        'vsa_loanAmount': 'VSA - Loan Amount',
        'vsa_interest': 'VSA - Interest',
        'vsa_tenure': 'VSA - Tenure',
        'vsa_monthlyPayment': 'VSA - Monthly Payment',
        'vsa_financeCompany': 'VSA - Finance Company',
        'vsa_adminFee': 'VSA - Admin Fee',
        'vsa_insuranceSubsidy': 'VSA - Insurance Subsidy',
        'vsa_insuranceCompany': 'VSA - Insurance Company',
        'vsa_insuranceFee': 'VSA - Insurance Fee',
        'vsa_insuranceNet': 'VSA - Insurance Net (Fee - Subsidy)'
    };

    let html = '<div style="font-size: 13px;">';

    // Show master file status
    if (hasMasterFile) {
        html += '<p style="margin-bottom: 10px; padding: 10px; background: rgba(76, 175, 80, 0.1); border: 2px solid rgba(76, 175, 80, 0.3); border-radius: 6px; color: #27ae60;"><strong>✓ Using master template from Google Drive:</strong> ' + template.driveFileName + '</p>';
    }

    html += '<p style="margin-bottom: 10px;"><strong>The following data will be populated:</strong></p>';

    for (const mapping of Object.values(template.fieldMappings)) {
        const fieldName = fieldNames[mapping.fieldType];
        let value = '';

        if (mapping.fieldType === 'date') {
            value = new Date().toLocaleDateString();
        } else {
            value = customer[mapping.fieldType] || '(empty)';
        }

        html += `<p style="margin: 5px 0;"><strong>Cell ${mapping.cellRef}:</strong> ${fieldName} = "${value}"</p>`;
    }

    html += '</div>';
    previewContainer.innerHTML = html;

    // Enable download button if:
    // 1. Template has a master file in Drive, OR
    // 2. User has uploaded a file manually
    downloadBtn.disabled = !(hasMasterFile || fileInput.files.length > 0);
}

// Download populated Excel
async function downloadPopulatedExcel() {
    const select = document.getElementById('excelTemplateSelect');
    const templateId = select.value;
    const fileInput = document.getElementById('excelOriginalFile');

    if (!templateId) {
        alert('Please select a field mapping template');
        return;
    }

    const template = excelTemplates[templateId];
    const customer = customers.find(c => c.id === currentPopulateCustomerId);

    if (!customer) {
        alert('Customer not found');
        return;
    }

    try {
        let arrayBuffer;

        // Check if template has a master file in Drive
        if (template.driveFileId && template.driveFileName) {
            // Fetch from Google Drive
            if (!isSignedIn) {
                alert('Please sign in to Google Drive to use the master template file.\n\nAlternatively, upload your Excel file manually.');
                return;
            }

            try {
                // Fetch the Excel file as binary data from Google Drive
                const fileResponse = await fetch(
                    `https://www.googleapis.com/drive/v3/files/${template.driveFileId}?alt=media`,
                    {
                        headers: new Headers({ 'Authorization': 'Bearer ' + accessToken })
                    }
                );

                if (!fileResponse.ok) {
                    throw new Error(`Failed to fetch file: ${fileResponse.statusText}`);
                }

                // Get the file as an array buffer (binary data)
                arrayBuffer = await fileResponse.arrayBuffer();
                console.log('Fetched Excel template from Google Drive, size:', arrayBuffer.byteLength, 'bytes');
            } catch (error) {
                console.error('Error fetching template from Drive:', error);
                alert('Failed to fetch template from Google Drive: ' + error.message + '\n\nPlease upload your Excel file manually or try again.');
                return;
            }
        } else {
            // Use uploaded file
            const file = fileInput.files[0];
            if (!file) {
                alert('Please upload your original Excel file');
                return;
            }
            arrayBuffer = await file.arrayBuffer();
        }

        // Load with xlsx-populate - PERFECT formatting preservation
        const workbook = await XlsxPopulate.fromDataAsync(arrayBuffer);

        // Get first sheet (or we could let user select)
        const sheet = workbook.sheet(0);

        // Populate fields
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
            'date': new Date(), // Pass Date object to preserve Excel date formatting
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

        // Convert numeric/currency fields to numbers for Excel formulas
        const numericFields = [
            'vsa_deposit', 'vsa_lessOthers', 'vsa_addOthers', 'vsa_tradeInAmount',
            'vsa_loanAmount', 'vsa_monthlyPayment', 'vsa_adminFee', 'vsa_insuranceSubsidy',
            'vsa_insuranceFee', 'vsa_purchasePriceWithCOE', 'vsa_sellingPriceList', 'vsa_coeRebateLevel',
            'vsa_coeRebate'
        ];

        numericFields.forEach(field => {
            if (dataMapping[field]) {
                // Strip currency symbols and convert to number
                const numericValue = parseFloat(dataMapping[field].replace(/[^0-9.-]/g, ''));
                if (!isNaN(numericValue)) {
                    dataMapping[field] = numericValue;
                }
            }
        });

        // Calculate Insurance Net (Insurance Fee - Insurance Subsidy)
        const insuranceFee = dataMapping['vsa_insuranceFee'] || 0;
        const insuranceSubsidy = dataMapping['vsa_insuranceSubsidy'] || 0;
        const insuranceNet = insuranceFee - insuranceSubsidy;
        dataMapping['vsa_insuranceNet'] = insuranceNet !== 0 ? insuranceNet : '';

        // Apply mappings - xlsx-populate preserves ALL formatting perfectly
        for (const mapping of Object.values(template.fieldMappings)) {
            const value = dataMapping[mapping.fieldType];
            if (value) {
                // Set cell value - all formatting is automatically preserved
                sheet.cell(mapping.cellRef).value(value);
            }
        }

        // Generate Excel file as blob - PERFECT preservation of all formatting
        const blob = await workbook.outputAsync();

        // Determine document type based on template name
        let documentType = 'other'; // Default folder
        const templateNameLower = template.name.toLowerCase();
        if (templateNameLower.includes('vsa') || templateNameLower.includes('sales agreement')) {
            documentType = 'vsa';
        } else if (templateNameLower.includes('trade')) {
            documentType = 'trade_in';
        } else if (templateNameLower.includes('test drive')) {
            documentType = 'test_drive';
        } else if (templateNameLower.includes('pdpa') || templateNameLower.includes('coe')) {
            documentType = 'pdpa_coe';
        }

        // Create filename for Google Drive
        const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        const driveFileName = `${customer.name.replace(/\s+/g, '_')}_${template.name.replace(/\s+/g, '_')}_${timestamp}.xlsx`;

        // Convert blob to File object for upload
        const excelFile = new File([blob], driveFileName, {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        // Upload to Google Drive subfolder only
        let uploadSuccess = false;
        if (isSignedIn) {
            try {
                // Ensure customer folder and subfolders exist first
                if (!customer.driveFolderId) {
                    await createCustomerFolder(customer.name, currentPopulateCustomerId);
                    // Reload customer after folder creation
                    const updatedCustomer = customers.find(c => c.id === currentPopulateCustomerId);
                    if (updatedCustomer) {
                        Object.assign(customer, updatedCustomer);
                    }
                }

                // Ensure document subfolders exist
                if (!customer.documentFolders || !customer.documentFolders[documentType]) {
                    await createDocumentSubfolders(customer.driveFolderId, currentPopulateCustomerId);
                    // Reload customer after subfolder creation
                    const updatedCustomer = customers.find(c => c.id === currentPopulateCustomerId);
                    if (updatedCustomer) {
                        Object.assign(customer, updatedCustomer);
                    }
                }

                // Now upload directly to the subfolder
                const targetFolderId = customer.documentFolders[documentType];

                if (targetFolderId) {
                    const metadata = {
                        name: driveFileName,
                        parents: [targetFolderId]
                    };

                    const form = new FormData();
                    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
                    form.append('file', excelFile);

                    const response = await fetch(
                        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,createdTime',
                        {
                            method: 'POST',
                            headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
                            body: form
                        }
                    );

                    const result = await response.json();
                    if (result && result.id) {
                        uploadSuccess = true;
                        console.log('File uploaded to Drive:', result.id);
                    }
                }
            } catch (uploadError) {
                console.error('Error uploading to Drive:', uploadError);
            }
        }

        // Show success message
        if (uploadSuccess) {
            // Refresh the customer details to show the new file
            invalidateStatsCache();
            displayCustomerDetails(currentPopulateCustomerId);

            alert('Excel file generated successfully!\n\n✅ Saved to customer folder in Google Drive\n\nYou can view it in the Documents tab.');
        } else if (!isSignedIn) {
            alert('Please sign in to Google Drive to save the populated Excel file.');
        } else {
            alert('Could not save to Google Drive. Please check your connection and try again.');
        }

        closeExcelPopulateModal();
    } catch (error) {
        console.error('Error generating Excel file:', error);
        alert('Failed to generate Excel file: ' + error.message);
    }
}

// Open upload master file modal
function openUploadMasterFileModal(templateId) {
    currentExcelTemplateId = templateId;
    const template = excelTemplates[templateId];

    if (!template) {
        alert('Template not found');
        return;
    }

    // Show current master file info if exists
    const infoContainer = document.getElementById('currentMasterFileInfo');
    if (template.driveFileId && template.driveFileName) {
        infoContainer.innerHTML = `
            <div style="padding: 15px; background: rgba(76, 175, 80, 0.1); border: 2px solid rgba(76, 175, 80, 0.3); border-radius: 8px;">
                <h4 style="color: #27ae60; margin-bottom: 10px;">Current Master File</h4>
                <p style="color: #2c3e50; font-size: 14px; margin: 0;"><strong>📄 ${template.driveFileName}</strong></p>
                <p style="color: #7f8c8d; font-size: 12px; margin-top: 5px;">Uploading a new file will replace this one.</p>
            </div>
        `;
    } else {
        infoContainer.innerHTML = `
            <div style="padding: 15px; background: rgba(255, 152, 0, 0.1); border: 2px solid rgba(255, 152, 0, 0.3); border-radius: 8px;">
                <p style="color: #f57c00; font-size: 14px; margin: 0;"><strong>⚠️ No master file uploaded yet</strong></p>
                <p style="color: #7f8c8d; font-size: 12px; margin-top: 5px;">Upload a master file to skip the upload step when populating data.</p>
            </div>
        `;
    }

    // Clear file input
    document.getElementById('uploadMasterFileInput').value = '';

    // Show modal
    document.getElementById('uploadMasterFileModal').style.display = 'flex';
}

// Close upload master file modal
function closeUploadMasterFileModal() {
    document.getElementById('uploadMasterFileModal').style.display = 'none';
    document.getElementById('uploadMasterFileInput').value = '';
    currentExcelTemplateId = null;
}

// Upload master file to Google Drive
async function uploadMasterFile() {
    if (!currentExcelTemplateId) {
        alert('No template selected');
        return;
    }

    const template = excelTemplates[currentExcelTemplateId];
    if (!template) {
        alert('Template not found');
        return;
    }

    const fileInput = document.getElementById('uploadMasterFileInput');
    const file = fileInput.files[0];

    if (!file) {
        alert('Please select an Excel file to upload');
        return;
    }

    // Check if signed in
    if (!isSignedIn) {
        alert('Please sign in to Google Drive first');
        return;
    }

    try {
        // Disable upload button
        const uploadBtn = document.getElementById('uploadMasterFileBtn');
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Uploading...';

        // Ensure Excel Templates folder exists
        await getOrCreateExcelTemplatesFolder();

        if (!excelTemplatesFolderId) {
            alert('Could not create Excel Templates folder in Google Drive');
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Upload to Google Drive';
            return;
        }

        // If template already has a file, delete the old one first
        if (template.driveFileId) {
            try {
                await gapi.client.drive.files.delete({
                    fileId: template.driveFileId
                });
                console.log('Deleted old master file:', template.driveFileId);
            } catch (error) {
                console.error('Error deleting old file:', error);
                // Continue with upload even if delete fails
            }
        }

        // Upload new file to Google Drive
        const metadata = {
            name: file.name,
            parents: [excelTemplatesFolderId]
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);

        const response = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
            {
                method: 'POST',
                headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
                body: form
            }
        );

        const result = await response.json();
        if (result && result.id) {
            // Update template with new file info
            template.driveFileId = result.id;
            template.driveFileName = file.name;
            await saveExcelTemplates();

            console.log('Excel master file uploaded to Drive:', result.id);
            alert('Master file uploaded successfully!\n\n✓ ' + file.name + '\n\nYou can now use this template without uploading files each time.');

            // Close modal and refresh list
            closeUploadMasterFileModal();
            displayExcelList();
        } else {
            alert('Failed to upload Excel file to Google Drive');
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Upload to Google Drive';
        }
    } catch (error) {
        console.error('Error uploading master file:', error);
        alert('Error uploading file to Google Drive: ' + error.message);
        const uploadBtn = document.getElementById('uploadMasterFileBtn');
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload to Google Drive';
    }
}

// ========== END EXCEL TEMPLATES MANAGEMENT ==========
