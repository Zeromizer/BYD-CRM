/**
 * ui.js
 *
 * User Interface and Modal Management Module
 * Handles all UI rendering, modal operations, and display functions.
 * Includes customer details display, forms management, and tab switching.
 */

// Open add customer modal
function openAddCustomerModal() {
    document.getElementById('addCustomerModal').classList.add('active');
}

// Close add customer modal
function closeAddCustomerModal() {
    document.getElementById('addCustomerModal').classList.remove('active');
    document.getElementById('newCustomerName').value = '';
    document.getElementById('newCustomerPhone').value = '';
    document.getElementById('newCustomerEmail').value = '';
    document.getElementById('newCustomerNRIC').value = '';
    document.getElementById('newCustomerOccupation').value = '';
    document.getElementById('newCustomerDOB').value = '';
    document.getElementById('newCustomerSalesConsultant').value = '';
    document.getElementById('newCustomerVsaNo').value = '';
    document.getElementById('newCustomerAddress').value = '';
    document.getElementById('newCustomerAddressContinue').value = '';
    document.getElementById('newCustomerModel').value = '';
    document.getElementById('newCustomerNotes').value = '';

    // Reset progress UI
    const submitBtn = document.getElementById('addCustomerSubmitBtn');
    const progressDiv = document.getElementById('addCustomerProgress');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Add Customer';
    }
    if (progressDiv) {
        progressDiv.style.display = 'none';
    }
}

// Update sync status indicator in UI
function updateSyncStatus(status) {
    const statusElement = document.getElementById('syncStatus');
    if (!statusElement) return;

    const statusConfig = {
        'syncing': { icon: '🔄', text: 'Syncing...', color: '#3498db' },
        'synced': { icon: '✓', text: 'Synced', color: '#27ae60' },
        'offline': { icon: '📴', text: 'Offline', color: '#95a5a6' },
        'error': { icon: '⚠️', text: 'Sync Error', color: '#e74c3c' }
    };

    const config = statusConfig[status] || statusConfig['offline'];
    statusElement.innerHTML = `<span style="color: ${config.color}">${config.icon} ${config.text}</span>`;

    if (lastSyncTime && status === 'synced') {
        const timeAgo = Math.floor((new Date() - lastSyncTime) / 1000);
        if (timeAgo < 60) {
            statusElement.innerHTML += ` <small style="color: #7f8c8d">(just now)</small>`;
        }
    }
}

// Switch tabs
function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    event.target.classList.add('active');
    document.getElementById('tab-' + tabName).classList.add('active');
}

// Open VSA Details modal
function openVsaDetailsModal(customerId) {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    // Initialize vsaDetails if it doesn't exist
    if (!customer.vsaDetails) {
        customer.vsaDetails = {
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
            coeRebate: '',
            lessOthers: '',
            deposit: '',
            addOthers: '',
            deliveryDate: '',
            tradeInCarNo: '',
            tradeInCarModel: '',
            tradeInAmount: '',
            dateOfRegistration: '',
            registrationNo: '',
            chassisNo: '',
            engineNo: '',
            remarks1: '',
            remarks2: '',
            loanAmount: '',
            interest: '',
            tenure: '',
            monthlyPayment: '',
            financeCompany: '',
            insuranceCompany: '',
            insuranceFee: '',
            adminFee: '',
            insuranceSubsidy: ''
        };
    }

    // Populate form fields with existing data
    document.getElementById('vsa_makeModel').value = customer.vsaDetails.makeModel || '';
    document.getElementById('vsa_yom').value = customer.vsaDetails.yom || '';
    document.getElementById('vsa_bodyColour').value = customer.vsaDetails.bodyColour || '';
    document.getElementById('vsa_upholstery').value = customer.vsaDetails.upholstery || 'Standard';
    document.getElementById('vsa_przType').value = customer.vsaDetails.przType || '';
    document.getElementById('vsa_package').value = customer.vsaDetails.package || 'Excite';
    document.getElementById('vsa_sellingWithCOE').value = customer.vsaDetails.sellingWithCOE || 'WITH';
    document.getElementById('vsa_sellingPriceList').value = customer.vsaDetails.sellingPriceList || '';
    document.getElementById('vsa_purchasePriceWithCOE').value = customer.vsaDetails.purchasePriceWithCOE || '';
    document.getElementById('vsa_coeRebateLevel').value = customer.vsaDetails.coeRebateLevel || '';
    document.getElementById('vsa_coeRebate').value = customer.vsaDetails.coeRebate || '';
    document.getElementById('vsa_lessOthers').value = customer.vsaDetails.lessOthers || '';
    document.getElementById('vsa_deposit').value = customer.vsaDetails.deposit || '';
    document.getElementById('vsa_addOthers').value = customer.vsaDetails.addOthers || '';
    document.getElementById('vsa_deliveryDate').value = customer.vsaDetails.deliveryDate || '';
    document.getElementById('vsa_tradeInCarNo').value = customer.vsaDetails.tradeInCarNo || '';
    document.getElementById('vsa_tradeInCarModel').value = customer.vsaDetails.tradeInCarModel || '';
    document.getElementById('vsa_tradeInAmount').value = customer.vsaDetails.tradeInAmount || '';
    document.getElementById('vsa_dateOfRegistration').value = customer.vsaDetails.dateOfRegistration || '';
    document.getElementById('vsa_registrationNo').value = customer.vsaDetails.registrationNo || '';
    document.getElementById('vsa_chassisNo').value = customer.vsaDetails.chassisNo || '';
    document.getElementById('vsa_engineNo').value = customer.vsaDetails.engineNo || '';
    document.getElementById('vsa_remarks1').value = customer.vsaDetails.remarks1 || '';
    document.getElementById('vsa_remarks2').value = customer.vsaDetails.remarks2 || '';
    document.getElementById('vsa_loanAmount').value = customer.vsaDetails.loanAmount || '';
    document.getElementById('vsa_interest').value = customer.vsaDetails.interest || '';
    document.getElementById('vsa_tenure').value = customer.vsaDetails.tenure || '';
    document.getElementById('vsa_monthlyPayment').value = customer.vsaDetails.monthlyPayment || '';
    document.getElementById('vsa_financeCompany').value = customer.vsaDetails.financeCompany || '';
    document.getElementById('vsa_insuranceCompany').value = customer.vsaDetails.insuranceCompany || '';
    document.getElementById('vsa_insuranceFee').value = customer.vsaDetails.insuranceFee || '';
    document.getElementById('vsa_adminFee').value = customer.vsaDetails.adminFee || '';
    document.getElementById('vsa_insuranceSubsidy').value = customer.vsaDetails.insuranceSubsidy || '';

    // Store customer ID for saving later
    window.currentVsaCustomerId = customerId;

    const modal = document.getElementById('vsaDetailsModal');
    modal.classList.add('active');

    // Reset to first tab
    switchVsaTab('newCarDetails');
}

// Save VSA Details
function saveVsaDetails() {
    if (!window.currentVsaCustomerId) return;

    const customer = customers.find(c => c.id === window.currentVsaCustomerId);
    if (!customer) return;

    // Initialize vsaDetails if it doesn't exist
    if (!customer.vsaDetails) {
        customer.vsaDetails = {};
    }

    // Save all VSA form fields
    customer.vsaDetails.makeModel = document.getElementById('vsa_makeModel').value;
    customer.vsaDetails.yom = document.getElementById('vsa_yom').value;
    customer.vsaDetails.bodyColour = document.getElementById('vsa_bodyColour').value;
    customer.vsaDetails.upholstery = document.getElementById('vsa_upholstery').value;
    customer.vsaDetails.przType = document.getElementById('vsa_przType').value;
    customer.vsaDetails.package = document.getElementById('vsa_package').value;
    customer.vsaDetails.sellingWithCOE = document.getElementById('vsa_sellingWithCOE').value;
    customer.vsaDetails.sellingPriceList = document.getElementById('vsa_sellingPriceList').value;
    customer.vsaDetails.purchasePriceWithCOE = document.getElementById('vsa_purchasePriceWithCOE').value;
    customer.vsaDetails.coeRebateLevel = document.getElementById('vsa_coeRebateLevel').value;
    customer.vsaDetails.coeRebate = document.getElementById('vsa_coeRebate').value;
    customer.vsaDetails.lessOthers = document.getElementById('vsa_lessOthers').value;
    customer.vsaDetails.deposit = document.getElementById('vsa_deposit').value;
    customer.vsaDetails.addOthers = document.getElementById('vsa_addOthers').value;
    customer.vsaDetails.deliveryDate = document.getElementById('vsa_deliveryDate').value;
    customer.vsaDetails.tradeInCarNo = document.getElementById('vsa_tradeInCarNo').value;
    customer.vsaDetails.tradeInCarModel = document.getElementById('vsa_tradeInCarModel').value;
    customer.vsaDetails.tradeInAmount = document.getElementById('vsa_tradeInAmount').value;
    customer.vsaDetails.dateOfRegistration = document.getElementById('vsa_dateOfRegistration').value;
    customer.vsaDetails.registrationNo = document.getElementById('vsa_registrationNo').value;
    customer.vsaDetails.chassisNo = document.getElementById('vsa_chassisNo').value;
    customer.vsaDetails.engineNo = document.getElementById('vsa_engineNo').value;
    customer.vsaDetails.remarks1 = document.getElementById('vsa_remarks1').value;
    customer.vsaDetails.remarks2 = document.getElementById('vsa_remarks2').value;
    customer.vsaDetails.loanAmount = document.getElementById('vsa_loanAmount').value;
    customer.vsaDetails.interest = document.getElementById('vsa_interest').value;
    customer.vsaDetails.tenure = document.getElementById('vsa_tenure').value;
    customer.vsaDetails.monthlyPayment = document.getElementById('vsa_monthlyPayment').value;
    customer.vsaDetails.financeCompany = document.getElementById('vsa_financeCompany').value;
    customer.vsaDetails.insuranceCompany = document.getElementById('vsa_insuranceCompany').value;
    customer.vsaDetails.insuranceFee = document.getElementById('vsa_insuranceFee').value;
    customer.vsaDetails.adminFee = document.getElementById('vsa_adminFee').value;
    customer.vsaDetails.insuranceSubsidy = document.getElementById('vsa_insuranceSubsidy').value;

    // Save to storage
    saveData();

    // Close modal
    closeVsaDetailsModal();
}

// Close VSA Details modal
function closeVsaDetailsModal() {
    document.getElementById('vsaDetailsModal').classList.remove('active');
    window.currentVsaCustomerId = null;
}

// Switch VSA Details tabs
function switchVsaTab(tabName) {
    // Remove active class from all tabs within the VSA modal
    const vsaModal = document.getElementById('vsaDetailsModal');
    vsaModal.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    vsaModal.querySelectorAll('.tab-content').forEach(c => {
        c.classList.remove('active');
        c.style.display = 'none';
    });

    // Add active class to clicked tab
    if (event && event.target) {
        event.target.classList.add('active');
    } else {
        // If no event (called programmatically), find and activate the tab
        vsaModal.querySelectorAll('.tab').forEach(t => {
            if (t.getAttribute('onclick').includes(tabName)) {
                t.classList.add('active');
            }
        });
    }

    // Show selected tab content
    const tabContent = document.getElementById('vsa-tab-' + tabName);
    if (tabContent) {
        tabContent.classList.add('active');
        tabContent.style.display = 'block';
    }
}

// Forms Management Functions

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

// ========== COMBINE & PRINT FORMS ==========

// Open combine print modal and populate form options
async function openCombinePrintModal(customerId) {
    currentCombineCustomerId = customerId;

    const modal = document.getElementById('combinePrintModal');
    const side1Select = document.getElementById('combineSide1');
    const side2Select = document.getElementById('combineSide2');
    const presetDropdown = document.getElementById('presetDropdown');

    // Clear existing options
    side1Select.innerHTML = '<option value="">Select a form...</option>';
    side2Select.innerHTML = '<option value="">Select a form...</option>';
    presetDropdown.innerHTML = '<option value="">Choose a saved preset...</option>';

    // Load form visibility settings
    loadFormVisibilitySettings();

    // Form type names for display
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

    // Populate dropdowns with visible image forms only
    for (const [formType, formData] of Object.entries(formTemplates)) {
        if (formData.fileType === 'image' && isFormVisible(formType)) {
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

    // Load and display presets in dropdown
    await loadCombinationPresets();
    populatePresetDropdown();

    // Show modal
    modal.style.display = 'flex';
}

// Populate preset dropdown
function populatePresetDropdown() {
    const presetDropdown = document.getElementById('presetDropdown');

    if (!presetDropdown) {
        return;
    }

    // Clear existing options except default
    presetDropdown.innerHTML = '<option value="">Choose a saved preset...</option>';

    // Add each preset as an option
    for (const [presetId, preset] of Object.entries(formCombinationPresets)) {
        const option = document.createElement('option');
        option.value = presetId;
        option.textContent = preset.name;
        presetDropdown.appendChild(option);
    }
}

// Handle preset selection from dropdown
function handlePresetSelection() {
    const presetDropdown = document.getElementById('presetDropdown');
    const presetId = presetDropdown.value;

    if (!presetId) {
        return; // No preset selected
    }

    // Use the preset to print
    useCombinationPreset(presetId, currentCombineCustomerId);

    // Reset dropdown after print initiated
    setTimeout(() => {
        presetDropdown.value = '';
    }, 100);
}

// Open preset management modal
async function openPresetManagement() {
    const modal = document.getElementById('presetManagementModal');
    const newPresetSide1 = document.getElementById('newPresetSide1');
    const newPresetSide2 = document.getElementById('newPresetSide2');

    // Clear preset creation inputs
    document.getElementById('newPresetName').value = '';
    newPresetSide1.innerHTML = '<option value="">Select...</option>';
    newPresetSide2.innerHTML = '<option value="">Select...</option>';

    // Load form visibility settings
    loadFormVisibilitySettings();

    // Form type names for display
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

    // Populate form dropdowns with ALL image forms (not filtered by visibility)
    for (const [formType, formData] of Object.entries(formTemplates)) {
        if (formData.fileType === 'image') {
            const formName = formTypeNames[formType] || formType;

            const option1 = document.createElement('option');
            option1.value = formType;
            option1.textContent = formName;

            const option2 = document.createElement('option');
            option2.value = formType;
            option2.textContent = formName;

            newPresetSide1.appendChild(option1);
            newPresetSide2.appendChild(option2);
        }
    }

    // Display existing presets
    displayPresetManagementList();

    // Display form visibility settings
    displayFormVisibilitySettings();

    // Show modal
    modal.style.display = 'flex';
}

// Close preset management modal
function closePresetManagement() {
    document.getElementById('presetManagementModal').style.display = 'none';
}

// Display presets in management modal
function displayPresetManagementList() {
    const presetManagementList = document.getElementById('presetManagementList');

    if (!presetManagementList) {
        return;
    }

    // Form type names for display
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

    const presetCount = Object.keys(formCombinationPresets).length;

    if (presetCount === 0) {
        presetManagementList.innerHTML = '<p style="color: #95a5a6; font-style: italic; padding: 15px; text-align: center;">No saved presets yet. Create one above!</p>';
        return;
    }

    let html = '<div style="display: flex; flex-direction: column; gap: 10px;">';

    for (const [presetId, preset] of Object.entries(formCombinationPresets)) {
        const side1Name = formTypeNames[preset.side1] || preset.side1;
        const side2Name = formTypeNames[preset.side2] || preset.side2;

        html += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; background: white; border: 2px solid #e0e0e0; border-radius: 6px;">
                <div>
                    <strong style="color: #9c27b0; font-size: 15px;">${preset.name}</strong>
                    <p style="color: #7f8c8d; font-size: 13px; margin-top: 4px;">Side 1: ${side1Name} | Side 2: ${side2Name}</p>
                </div>
                <button class="btn btn-small btn-danger" onclick="deletePresetFromManagement('${presetId}')" style="white-space: nowrap;">Delete</button>
            </div>
        `;
    }

    html += '</div>';
    presetManagementList.innerHTML = html;
}

// Save new preset from management modal
async function saveNewPreset() {
    const name = document.getElementById('newPresetName').value.trim();
    const side1 = document.getElementById('newPresetSide1').value;
    const side2 = document.getElementById('newPresetSide2').value;

    const success = await createCombinationPreset(name, side1, side2);

    if (success) {
        // Refresh preset display
        displayPresetManagementList();
        // Clear inputs
        document.getElementById('newPresetName').value = '';
        document.getElementById('newPresetSide1').value = '';
        document.getElementById('newPresetSide2').value = '';
        alert('Preset saved successfully!');
    }
}

// Delete preset from management modal
async function deletePresetFromManagement(presetId) {
    const success = await deleteCombinationPreset(presetId);

    if (success) {
        displayPresetManagementList();
    }
}

// Display form visibility settings
function displayFormVisibilitySettings() {
    const formVisibilityContainer = document.getElementById('formVisibilitySettings');

    if (!formVisibilityContainer) {
        return;
    }

    // Form type names for display
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

    let html = '';

    for (const [formType, formData] of Object.entries(formTemplates)) {
        if (formData.fileType === 'image') {
            const formName = formTypeNames[formType] || formType;
            const isVisible = isFormVisible(formType);
            const checked = isVisible ? 'checked' : '';

            html += `
                <div style="display: flex; align-items: center; padding: 10px; background: white; border: 2px solid #e0e0e0; border-radius: 6px;">
                    <input type="checkbox" id="visibility_${formType}" ${checked} style="margin-right: 10px; width: 18px; height: 18px; cursor: pointer;">
                    <label for="visibility_${formType}" style="cursor: pointer; font-size: 14px; color: #2c3e50;">${formName}</label>
                </div>
            `;
        }
    }

    formVisibilityContainer.innerHTML = html;
}

// Update and save form visibility settings from management modal
function updateFormVisibilitySettings() {
    // Update formVisibilitySettings based on checkboxes
    for (const [formType, formData] of Object.entries(formTemplates)) {
        if (formData.fileType === 'image') {
            const checkbox = document.getElementById(`visibility_${formType}`);
            if (checkbox) {
                formVisibilitySettings[formType] = checkbox.checked;
            }
        }
    }

    // Save to localStorage (calls function from forms.js)
    saveFormVisibilitySettings();

    // Refresh the combine print modal dropdowns if it's open
    refreshCombinePrintDropdowns();

    alert('Form visibility settings saved!');
}

// Refresh the form dropdowns in combine print modal
function refreshCombinePrintDropdowns() {
    const side1Select = document.getElementById('combineSide1');
    const side2Select = document.getElementById('combineSide2');

    if (!side1Select || !side2Select) {
        return; // Modal not open or elements not found
    }

    // Save current selections
    const currentSide1 = side1Select.value;
    const currentSide2 = side2Select.value;

    // Clear existing options
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
        'other': 'Other Form'
    };

    // Populate dropdowns with visible image forms only
    for (const [formType, formData] of Object.entries(formTemplates)) {
        if (formData.fileType === 'image' && isFormVisible(formType)) {
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

    // Restore selections if the forms are still visible
    if (currentSide1 && isFormVisible(currentSide1)) {
        side1Select.value = currentSide1;
    }
    if (currentSide2 && isFormVisible(currentSide2)) {
        side2Select.value = currentSide2;
    }
}

// Close combine print modal
function closeCombinePrintModal() {
    document.getElementById('combinePrintModal').style.display = 'none';
    currentCombineCustomerId = null;

    // Reset preset dropdown
    const presetDropdown = document.getElementById('presetDropdown');
    if (presetDropdown) {
        presetDropdown.value = '';
    }
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

// Field Mapping Functions
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
            'model': 'Car Model',
            'date': 'Today\'s Date',
            'custom': 'Custom Value'
        };

        let displayText;
        if (field.customValue) {
            displayText = '<strong>Custom: "' + field.customValue + '"</strong>';
        } else {
            displayText = '<strong>' + (fieldNames[field.type] || field.type) + '</strong>';
        }

        html += '<li style="padding: 8px; margin-bottom: 5px; background: white; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">';
        html += '<span>' + displayText + ' - Size: ' + field.fontSize + 'px</span>';
        html += '<button class="btn btn-small btn-danger" onclick="removeFieldMapping(\'' + fieldId + '\')">Remove</button>';
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

// Delete file with confirmation
async function deleteFileConfirm(fileId, customerId, fileName) {
    if (confirm(`Delete "${fileName}" from Google Drive?`)) {
        const success = await deleteFileFromDrive(fileId);
        if (success) {
            alert('File deleted successfully');
            invalidateStatsCache(); // Invalidate cache after deletion
            displayCustomerDetails(customerId);
            updateStats();
        } else {
            alert('Error deleting file');
        }
    }
}

// Show move file dialog
function showMoveFileDialog(fileId, fileName, customerId) {
    const customer = customers.find(c => c.id === customerId);
    if (!customer || !customer.documentFolders) {
        alert('Customer folders not found. Please create folder first.');
        return;
    }

    // Extract file extension
    const lastDotIndex = fileName.lastIndexOf('.');
    const fileExtension = lastDotIndex > -1 ? fileName.substring(lastDotIndex) : '';
    const fileNameWithoutExt = lastDotIndex > -1 ? fileName.substring(0, lastDotIndex) : fileName;

    // Build folder options
    let optionsHTML = '<option value="">Select a folder</option>';
    for (const folder of documentFolders) {
        const folderName = folder.name.replace(/_/g, ' ');
        optionsHTML += `<option value="${folder.id}">${folderName}</option>`;
    }

    // Escape filename for HTML attributes
    const escapedFileName = fileName.replace(/'/g, "\\'").replace(/"/g, '&quot;');

    // Create custom dialog HTML
    const dialogHTML = `
        <div style="padding: 20px;">
            <h3 style="margin-bottom: 15px; color: #2c3e50;">Move & Rename Document</h3>

            <label style="display: block; margin-bottom: 8px; color: #2d3748; font-weight: 500;">
                Document name:
            </label>
            <input type="text" id="moveFileNameInput" value="${fileNameWithoutExt}"
                   style="width: 100%; padding: 10px; border: 1px solid #cbd5e0; border-radius: 6px; font-size: 14px; margin-bottom: 5px;">
            <p style="margin: 0 0 15px 0; color: #7f8c8d; font-size: 12px;">
                File extension: <strong>${fileExtension || 'none'}</strong>
            </p>

            <label style="display: block; margin-bottom: 8px; color: #2d3748; font-weight: 500;">
                Move to folder:
            </label>
            <select id="moveToFolderSelect" style="width: 100%; padding: 10px; border: 1px solid #cbd5e0; border-radius: 6px; font-size: 14px; margin-bottom: 20px;">
                ${optionsHTML}
            </select>

            <div style="display: flex; gap: 10px;">
                <button onclick="executeMoveFile('${fileId}', ${customerId}, '${escapedFileName}', '${fileExtension}')" class="btn btn-primary" style="flex: 1;">
                    Move & Rename
                </button>
                <button onclick="closeMoveDialog()" class="btn btn-secondary" style="flex: 1;">
                    Cancel
                </button>
            </div>
        </div>
    `;

    // Show dialog using a simple modal approach
    const existingDialog = document.getElementById('moveFileDialog');
    if (existingDialog) {
        existingDialog.remove();
    }

    const dialog = document.createElement('div');
    dialog.id = 'moveFileDialog';
    dialog.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;';
    dialog.innerHTML = `
        <div style="background: white; border-radius: 12px; max-width: 500px; width: 90%; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
            ${dialogHTML}
        </div>
    `;

    document.body.appendChild(dialog);

    // Focus the name input
    setTimeout(() => {
        const nameInput = document.getElementById('moveFileNameInput');
        if (nameInput) {
            nameInput.focus();
            nameInput.select();
        }
    }, 100);
}

// Close move dialog
function closeMoveDialog() {
    const dialog = document.getElementById('moveFileDialog');
    if (dialog) {
        dialog.remove();
    }
}

// Execute move file
async function executeMoveFile(fileId, customerId, oldFileName, fileExtension) {
    const select = document.getElementById('moveToFolderSelect');
    const nameInput = document.getElementById('moveFileNameInput');
    const targetFolderId = select.value;

    if (!targetFolderId) {
        alert('Please select a destination folder');
        return;
    }

    // Get new filename from input
    let newFileNameWithoutExt = nameInput.value.trim();
    if (!newFileNameWithoutExt) {
        alert('Please enter a document name');
        return;
    }

    // Add extension back
    const newFileName = newFileNameWithoutExt + fileExtension;

    const customer = customers.find(c => c.id === customerId);
    if (!customer || !customer.documentFolders || !customer.documentFolders[targetFolderId]) {
        alert('Destination folder not found');
        return;
    }

    const targetDriveFolderId = customer.documentFolders[targetFolderId];

    // Close dialog and show progress
    closeMoveDialog();

    const success = await moveFileToFolder(fileId, targetDriveFolderId, newFileName);

    if (success) {
        const folderName = documentFolders.find(f => f.id === targetFolderId)?.name.replace(/_/g, ' ') || 'selected folder';
        alert(`✅ "${newFileName}" moved to ${folderName} successfully!`);
        invalidateStatsCache(); // Invalidate cache to ensure fresh data
        displayCustomerDetails(customerId);
    } else {
        alert('❌ Error moving file. Please try again.');
    }
}

// Display customer details
async function displayCustomerDetails(customerId) {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    // Create backup for cancel functionality
    customerBackup = JSON.parse(JSON.stringify(customer));

    const checklist = documentChecklist;
    const completedItems = Object.values(customer.checklist).filter(v => v).length;
    const totalItems = checklist.length;
    const progress = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

    // Get files from Drive
    const files = isSignedIn ? await getCustomerFiles(customerId) : [];

    const detailsContainer = document.getElementById('customerDetails');
    detailsContainer.innerHTML = `
        <div class="tabs">
            <button class="tab active" onclick="switchTab('info')">Customer Info</button>
            <button class="tab" onclick="switchTab('documents')">Documents (${files.length})</button>
        </div>

        <div id="tab-info" class="tab-content active">
            <div style="margin-bottom: 20px;">
                <h2 style="margin: 0;">Customer Details</h2>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>Name</label>
                    <input type="text" id="customer_name" value="${customer.name}">
                </div>
                <div class="form-group">
                    <label>Contact Number</label>
                    <input type="tel" id="customer_phone" value="${customer.phone}">
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="customer_email" value="${customer.email || ''}">
                </div>
                <div class="form-group">
                    <label>NRIC/FIN</label>
                    <input type="text" id="customer_nric" value="${customer.nric || ''}" placeholder="S1234567A or F1234567N">
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>Occupation</label>
                    <input type="text" id="customer_occupation" value="${customer.occupation || ''}" placeholder="e.g., Engineer, Teacher">
                </div>
                <div class="form-group">
                    <label>Date of Birth</label>
                    <input type="date" id="customer_dob" value="${customer.dob || ''}">
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>Sales Consultant</label>
                    <input type="text" id="customer_salesConsultant" value="${customer.salesConsultant || ''}">
                </div>
                <div class="form-group">
                    <label>VSA No</label>
                    <input type="text" id="customer_vsaNo" value="${customer.vsaNo || ''}" placeholder="VSA Number">
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>Address</label>
                    <input type="text" id="customer_address" value="${customer.address || ''}" placeholder="e.g., 99 YISHUN AVE 1, 13-39">
                </div>
                <div class="form-group">
                    <label>Address Continue</label>
                    <input type="text" id="customer_addressContinue" value="${customer.addressContinue || ''}" placeholder="e.g., SINGAPORE 769139">
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>Interested Model</label>
                    <select id="customer_model">
                        <option value="">Select Model</option>
                        <option value="Seal" ${customer.model === 'Seal' ? 'selected' : ''}>Seal</option>
                        <option value="Seal 6" ${customer.model === 'Seal 6' ? 'selected' : ''}>Seal 6</option>
                        <option value="Sealion 6" ${customer.model === 'Sealion 6' ? 'selected' : ''}>Sealion 6</option>
                        <option value="Sealion 7" ${customer.model === 'Sealion 7' ? 'selected' : ''}>Sealion 7</option>
                        <option value="Dolphin" ${customer.model === 'Dolphin' ? 'selected' : ''}>Dolphin</option>
                        <option value="Atto 2" ${customer.model === 'Atto 2' ? 'selected' : ''}>Atto 2</option>
                        <option value="Atto 3" ${customer.model === 'Atto 3' ? 'selected' : ''}>Atto 3</option>
                        <option value="M6" ${customer.model === 'M6' ? 'selected' : ''}>M6</option>
                    </select>
                </div>
                <div class="form-group">
                    <label style="visibility: hidden;">VSA</label>
                    <button class="btn btn-primary" onclick="openVsaDetailsModal(${customer.id})" style="background: linear-gradient(135deg, #8e44ad 0%, #9b59b6 100%); width: 100%; height: 42px;">
                        📋 VSA Details
                    </button>
                </div>
            </div>

            <div class="form-group">
                <label>Notes</label>
                <textarea rows="3" id="customer_notes">${customer.notes || ''}</textarea>
            </div>

            <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; margin-bottom: 30px;">
                <button class="btn btn-secondary" onclick="cancelCustomerEdit(${customer.id})" style="background: #95a5a6; min-width: 100px;">
                    Cancel
                </button>
                <button class="btn btn-success" onclick="saveCustomerEdit(${customer.id})" style="background: #27ae60; min-width: 100px;">
                    Save
                </button>
            </div>

            ${Object.keys(formTemplates).length > 0 ? `
                <div class="checklist-section" style="background: linear-gradient(135deg, rgba(231, 76, 60, 0.1) 0%, rgba(192, 57, 43, 0.1) 100%); border: 2px solid rgba(231, 76, 60, 0.3);">
                    <h3 style="color: #e74c3c;">📄 Forms</h3>
                    <p style="margin-bottom: 15px; color: #7f8c8d; font-size: 13px;">
                        Select a form to print for ${customer.name}
                    </p>

                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #2c3e50;">Select Form</label>
                        <select id="formSelect_${customer.id}" onchange="handleFormSelection(${customer.id})" style="width: 100%; padding: 10px; font-size: 14px; border: 2px solid #e74c3c; border-radius: 6px; background: white;">
                            <option value="">Choose a form...</option>
                            ${(() => {
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
                                return Object.keys(formTemplates).map(formType => {
                                    const formName = formTypeNames[formType] || formType;
                                    return '<option value="' + formType + '">' + formName + '</option>';
                                }).join('');
                            })()}
                        </select>
                    </div>

                    <div id="testDriveUpload_${customer.id}" style="display: none; background: white; padding: 15px; border-radius: 8px; margin-bottom: 15px; border: 2px solid rgba(0, 188, 212, 0.2);">
                        <h4 style="color: #00bcd4; margin-bottom: 10px; font-size: 14px;">📸 Test Drive Required Documents</h4>
                        <p style="font-size: 12px; color: #7f8c8d; margin-bottom: 10px;">Upload up to 4 ID images to print with the form (they will appear in order on page 2)</p>

                        <div style="margin-bottom: 10px;">
                            <input type="file" accept="image/*" multiple id="docImages_${customer.id}" onchange="uploadMultipleDocImages(${customer.id}, this.files)" style="font-size: 12px; padding: 8px; width: 100%; border: 2px dashed #00bcd4; border-radius: 6px; background: rgba(0, 188, 212, 0.05);">
                            <p style="font-size: 11px; color: #7f8c8d; margin-top: 5px;">Select up to 4 images at once</p>
                        </div>

                        <div id="uploadProgress_${customer.id}" style="display: none; margin-bottom: 10px;">
                            <div style="background: #ecf0f1; border-radius: 10px; height: 24px; overflow: hidden; position: relative;">
                                <div id="uploadBar_${customer.id}" style="background: linear-gradient(90deg, #00bcd4 0%, #00acc1 100%); height: 100%; width: 0%; transition: width 0.3s; display: flex; align-items: center; justify-content: center;">
                                    <span id="uploadText_${customer.id}" style="color: white; font-size: 12px; font-weight: 600; position: absolute; left: 50%; transform: translateX(-50%);"></span>
                                </div>
                            </div>
                        </div>

                        ${(() => {
                            const docs = customer.testDriveDocs || {};
                            const uploadedCount = Object.keys(docs).length;
                            if (uploadedCount > 0) {
                                return '<p style="font-size: 12px; color: #27ae60; font-weight: 600;">✓ ' + uploadedCount + ' image(s) uploaded</p>';
                            }
                            return '';
                        })()}
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        ${(() => {
                            let html = '';
                            // Add Combine & Print button at the top if there are multiple image forms
                            const imageForms = Object.entries(formTemplates).filter(([_, formData]) => formData.fileType === 'image');
                            if (imageForms.length >= 2) {
                                html += '<button class="btn btn-primary" onclick="openCombinePrintModal(' + customer.id + ')" style="background: linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%); display: flex; align-items: center; gap: 8px; justify-content: center; width: 100%; font-weight: 600;"><span>📑</span><span>Combine & Print (Double-Sided)</span></button>';
                            }
                            // Add single Print button
                            html += '<button class="btn btn-primary" id="printFormBtn_' + customer.id + '" onclick="printSelectedForm(' + customer.id + ')" disabled style="background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); display: flex; align-items: center; gap: 8px; justify-content: center; width: 100%; opacity: 0.5;"><span>📄</span><span>Print Form</span></button>';
                            return html;
                        })()}
                    </div>
                </div>
            ` : ''}

            ${Object.keys(excelTemplates).length > 0 ? `
                <div style="margin-bottom: 25px; padding: 20px; background: linear-gradient(135deg, rgba(76, 175, 80, 0.1) 0%, rgba(56, 142, 60, 0.1) 100%); border-radius: 10px; border: 2px solid rgba(76, 175, 80, 0.3);">
                    <h3 style="color: #4caf50; margin-bottom: 15px;">📊 Excel Templates</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 10px;">
                        <button class="btn btn-success" onclick="openExcelPopulateModal(${customer.id})" style="background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%); display: flex; align-items: center; gap: 8px; justify-content: center; width: 100%;"><span>📊</span><span>Populate Excel Template</span></button>
                    </div>
                </div>
            ` : ''}

            <div class="action-buttons">
                ${!customer.dealClosed ? `
                    <button class="btn btn-success" onclick="markDealClosed(${customer.id})">
                        ✓ Mark Deal as Closed
                    </button>
                ` : `
                    <button class="btn btn-secondary" onclick="markDealOpen(${customer.id})">
                        Reopen Deal
                    </button>
                `}
                ${!customer.driveFolderId && isSignedIn ? `
                    <button class="btn btn-drive" onclick="handleCreateFolderClick('${customer.name}', ${customer.id})">
                        📁 Create Drive Folder
                    </button>
                ` : ''}
                <button class="btn btn-danger" onclick="deleteCustomer(${customer.id})">
                    Delete Customer
                </button>
            </div>
        </div>

        <div id="tab-documents" class="tab-content">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;">
                <h2 style="margin: 0;">Document Management</h2>
                ${customer.driveFolderId ? `
                    <div style="display: flex; gap: 8px;">
                        <button onclick="window.open('${customer.driveFolderLink}', '_blank')"
                                style="background: none; border: none; cursor: pointer; font-size: 24px; padding: 8px; border-radius: 8px; transition: all 0.3s ease; display: flex; align-items: center; justify-content: center;"
                                onmouseover="this.style.background='rgba(0, 188, 212, 0.1)'"
                                onmouseout="this.style.background='none'"
                                title="Open folder in Google Drive (Web)">
                            🌐
                        </button>
                        <button onclick="openLocalFolder('${customer.name}')"
                                style="background: none; border: none; cursor: pointer; font-size: 24px; padding: 8px; border-radius: 8px; transition: all 0.3s ease; display: flex; align-items: center; justify-content: center;"
                                onmouseover="this.style.background='rgba(52, 152, 219, 0.1)'"
                                onmouseout="this.style.background='none'"
                                title="Open folder in File Explorer">
                            📂
                        </button>
                    </div>
                ` : ''}
            </div>

            ${!isSignedIn ? `
                <div class="auth-section">
                    <h3>⚠️ Not Connected to Google Drive</h3>
                    <p>Connect to Google Drive to upload and manage files directly.</p>
                    <button class="btn btn-drive" onclick="handleAuthClick()">
                        📁 Connect Google Drive
                    </button>
                </div>
            ` : !customer.driveFolderId ? `
                <div class="auth-section">
                    <h3>📁 Create Customer Folder</h3>
                    <p>Create a folder in Google Drive for ${customer.name}'s documents.</p>
                    <button class="btn btn-drive" onclick="handleCreateFolderClick('${customer.name}', ${customer.id})">
                        Create Folder
                    </button>
                </div>
            ` : `
                <div class="file-naming">
                    <h4>📁 File Naming Convention</h4>
                    <p style="font-size: 13px; color: #856404; margin-bottom: 10px;">
                        Files will be automatically named as:
                    </p>
                    <code>${customer.name.replace(/\s+/g, '_')}_${customer.nric || 'XXXX'}_[Document_Type].[ext]</code>
                </div>

                <div class="file-upload-section">
                    <h3>
                        <img src="https://www.gstatic.com/images/branding/product/1x/drive_2020q4_48dp.png"
                             style="width: 24px; height: 24px;">
                        Upload to Google Drive
                    </h3>

                    <div style="margin-bottom: 20px; padding: 15px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px; color: white;">
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <div>
                                <label style="display: flex; align-items: center; cursor: pointer;">
                                    <input type="checkbox" id="autoClassifyToggle_${customerId}"
                                           style="width: 20px; height: 20px; margin-right: 10px; cursor: pointer;"
                                           onchange="toggleAutoClassify(${customerId})" checked>
                                    <div>
                                        <strong style="font-size: 16px;">🤖 Smart Auto-Classify</strong>
                                        <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.9;">
                                            AI will detect document type, organize into folders, and tick checklists automatically
                                        </p>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div class="form-group" id="manualFolderSelect_${customerId}" style="margin-bottom: 15px; display: none;">
                        <label for="documentTypeSelect_${customerId}">📂 Select Document Folder (Manual Mode)</label>
                        <select id="documentTypeSelect_${customerId}" style="width: 100%; padding: 10px; border: 1px solid #dfe6e9; border-radius: 8px; font-size: 14px; background: white;">
                            ${documentFolders.map(folder => `
                                <option value="${folder.id}">${folder.name.replace(/_/g, ' ')}</option>
                            `).join('')}
                        </select>
                        <small style="color: #7f8c8d; font-size: 12px;">Files will be organized into the selected folder</small>
                    </div>

                    <div class="upload-area" id="uploadArea_${customerId}"
                         ondrop="handleDrop(event, ${customerId})"
                         ondragover="handleDragOver(event)"
                         ondragleave="handleDragLeave(event)"
                         onclick="document.getElementById('fileInput_${customerId}').click()">
                        <p>🗂️ Drag & Drop Files Here</p>
                        <small>or click to browse/take photo • Files upload directly to Google Drive</small>
                        <input type="file" id="fileInput_${customerId}" multiple
                               accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,*"
                               capture="environment"
                               style="display: none;"
                               onchange="handleFileSelect(event, ${customerId})">
                    </div>
                    <p style="font-size: 12px; color: #7f8c8d; margin-top: 10px;">
                        ✓ Unlimited storage in Google Drive<br>
                        ✓ Access from any device<br>
                        ✓ Share with team members
                    </p>
                </div>

                <div class="file-list" id="fileList_${customerId}">
                    ${files.length > 0 ? files.map(file => `
                        <div class="file-item">
                            <div class="file-info">
                                <div class="file-icon">${getFileIcon(file.mimeType)}</div>
                                <div class="file-details">
                                    <h4>${file.name}</h4>
                                    <p>${formatFileSize(file.size)} • ${new Date(file.createdTime).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <div class="file-actions">
                                <button class="btn btn-secondary btn-small" onclick="window.open('${file.webViewLink}', '_blank')">
                                    👁️ View
                                </button>
                                <button class="btn btn-secondary btn-small" onclick="showMoveFileDialog('${file.id}', '${file.name}', ${customerId})">
                                    📁 Move
                                </button>
                                <button class="btn btn-danger btn-small" onclick="deleteFileConfirm('${file.id}', ${customerId}, '${file.name}')">
                                    🗑️ Delete
                                </button>
                            </div>
                        </div>
                    `).join('') : '<p style="text-align: center; color: #95a5a6; padding: 20px;">No documents uploaded yet</p>'}
                </div>
            `}
        </div>
    `;
}

// Update statistics display
async function updateStats(forceRefresh = false) {
    document.getElementById('totalCustomers').textContent = customers.length;

    const activeDeals = customers.filter(c => !c.dealClosed).length;
    document.getElementById('activeDeals').textContent = activeDeals;

    // Count folders
    const foldersCreated = customers.filter(c => c.driveFolderId).length;
    document.getElementById('totalFolders').textContent = foldersCreated;

    // Count files with caching and parallel execution
    if (isSignedIn && rootFolderId) {
        const now = Date.now();
        const cacheValid = !forceRefresh && (now - statsCache.lastUpdate) < statsCache.cacheTimeout;

        if (cacheValid) {
            // Use cached value
            document.getElementById('totalFiles').textContent = statsCache.totalFiles;
        } else {
            try {
                // Show loading indicator
                document.getElementById('totalFiles').textContent = '...';

                // Fetch file counts for all customers in parallel
                const customersWithFolders = customers.filter(c => c.driveFolderId);
                const filePromises = customersWithFolders.map(customer =>
                    getCustomerFiles(customer.id)
                );

                const results = await Promise.allSettled(filePromises);

                // Count total files from successful requests
                let totalFiles = 0;
                results.forEach(result => {
                    if (result.status === 'fulfilled' && result.value) {
                        totalFiles += result.value.length;
                    }
                });

                // Update cache
                statsCache.totalFiles = totalFiles;
                statsCache.lastUpdate = now;

                document.getElementById('totalFiles').textContent = totalFiles;
            } catch (error) {
                console.error('Error updating stats:', error);
                document.getElementById('totalFiles').textContent = '?';
            }
        }
    } else {
        document.getElementById('totalFiles').textContent = '0';
    }
}

// ============ Sync Status Popup ============

/**
 * Initialize the sync status popup
 */
function initSyncStatusPopup() {
    // Create popup element if it doesn't exist
    if (document.getElementById('syncStatusPopup')) {
        return; // Already initialized
    }

    const popup = document.createElement('div');
    popup.id = 'syncStatusPopup';
    popup.className = 'hidden';
    popup.innerHTML = `
        <div class="sync-popup-header">
            <h4>
                <span class="sync-icon idle">⚙️</span>
                <span id="syncPopupTitle">Sync Status</span>
            </h4>
            <button class="minimize-btn" onclick="toggleSyncPopup()" title="Minimize">−</button>
        </div>
        <div class="sync-popup-body">
            <div class="sync-status-text" id="syncStatusText">All changes synced</div>
            <div class="sync-progress-container">
                <div class="sync-progress-bar">
                    <div class="sync-progress-fill" id="syncProgressFill" style="width: 0%"></div>
                </div>
            </div>
            <div class="sync-queue-info">
                <span id="syncQueueCount">Queue: 0</span>
                <span id="syncNetworkStatus">Online</span>
            </div>
            <div class="sync-operation-details" id="syncOperationDetails" style="display: none;"></div>
            <button class="sync-retry-btn" id="syncRetryBtn" onclick="retryFailedSyncs()" style="display: none;">
                Retry Failed Operations
            </button>
        </div>
    `;

    document.body.appendChild(popup);

    // Set up queue listener
    addQueueListener(handleQueueEvent);

    // Set up online/offline listeners
    updateNetworkStatus();
}

/**
 * Handle queue events and update UI
 */
function handleQueueEvent(event, data) {
    const popup = document.getElementById('syncStatusPopup');
    if (!popup) return;

    const icon = popup.querySelector('.sync-icon');
    const title = document.getElementById('syncPopupTitle');
    const statusText = document.getElementById('syncStatusText');
    const progressFill = document.getElementById('syncProgressFill');
    const queueCount = document.getElementById('syncQueueCount');
    const operationDetails = document.getElementById('syncOperationDetails');
    const retryBtn = document.getElementById('syncRetryBtn');

    switch (event) {
        case 'queued':
            showSyncPopup();
            icon.className = 'sync-icon';
            icon.textContent = '🔄';
            statusText.textContent = 'Queuing sync operation...';
            updateQueueDisplay();
            break;

        case 'processing_started':
            showSyncPopup();
            icon.className = 'sync-icon';
            icon.textContent = '🔄';
            title.textContent = 'Syncing...';
            statusText.textContent = 'Syncing to cloud...';
            progressFill.style.width = '10%';
            progressFill.className = 'sync-progress-fill';
            updateQueueDisplay();
            break;

        case 'item_processing':
            const typeMap = {
                'cloudSync': 'Syncing data to cloud',
                'createFolder': 'Creating folder',
                'uploadFile': 'Uploading file'
            };
            statusText.textContent = typeMap[data.type] || 'Processing...';
            progressFill.style.width = '50%';
            operationDetails.style.display = 'none';
            break;

        case 'item_completed':
            const status = getQueueStatus();
            if (status.queueLength === 0) {
                // All done!
                icon.className = 'sync-icon idle sync-success';
                icon.textContent = '✅';
                title.textContent = 'Sync Complete';
                statusText.textContent = 'All changes synced to cloud';
                progressFill.style.width = '100%';
                progressFill.className = 'sync-progress-fill success';
                operationDetails.style.display = 'none';
                retryBtn.style.display = 'none';

                // Hide popup after 3 seconds
                setTimeout(() => {
                    if (getQueueStatus().queueLength === 0) {
                        hideSyncPopup();
                    }
                }, 3000);

                // Update the main sync status indicator
                updateSyncStatus('synced');
                lastSyncTime = new Date();
            } else {
                progressFill.style.width = '30%';
            }
            updateQueueDisplay();
            break;

        case 'item_retrying':
            icon.className = 'sync-icon';
            icon.textContent = '🔄';
            statusText.textContent = `Retrying... (${data.retriesLeft} attempts left)`;
            operationDetails.style.display = 'block';
            operationDetails.className = 'sync-operation-details';
            operationDetails.textContent = `Error: ${data.error.message || 'Unknown error'}. Retrying in ${Math.round(data.retryDelay / 1000)}s...`;
            progressFill.style.width = '20%';
            updateQueueDisplay();
            break;

        case 'item_failed':
            icon.className = 'sync-icon error';
            icon.textContent = '⚠️';
            title.textContent = 'Sync Error';
            statusText.textContent = 'Sync failed after retries';
            progressFill.style.width = '100%';
            progressFill.className = 'sync-progress-fill error';
            operationDetails.style.display = 'block';
            operationDetails.className = 'sync-operation-details error';
            operationDetails.textContent = `Failed: ${data.error.message || 'Unknown error'}`;
            retryBtn.style.display = 'block';
            updateSyncStatus('error');
            updateQueueDisplay();
            break;

        case 'processing_completed':
            // All operations completed
            break;

        case 'network_online':
            updateNetworkStatus();
            statusText.textContent = 'Back online - resuming sync...';
            showSyncPopup();
            break;

        case 'network_offline':
            updateNetworkStatus();
            icon.className = 'sync-icon idle';
            icon.textContent = '📴';
            title.textContent = 'Offline';
            statusText.textContent = 'No internet - changes queued';
            showSyncPopup();
            updateSyncStatus('offline');
            break;
    }
}

/**
 * Update queue display in popup
 */
function updateQueueDisplay() {
    const status = getQueueStatus();
    const queueCount = document.getElementById('syncQueueCount');

    if (queueCount) {
        if (status.queueLength > 0) {
            queueCount.textContent = `Queue: ${status.queueLength} pending`;
        } else {
            queueCount.textContent = 'Queue: empty';
        }
    }
}

/**
 * Update network status display
 */
function updateNetworkStatus() {
    const networkStatus = document.getElementById('syncNetworkStatus');
    if (networkStatus) {
        if (isOnline()) {
            networkStatus.textContent = 'Online';
            networkStatus.style.color = '#27ae60';
        } else {
            networkStatus.innerHTML = '<span class="offline-badge">Offline</span>';
        }
    }
}

/**
 * Show sync popup
 */
function showSyncPopup() {
    const popup = document.getElementById('syncStatusPopup');
    if (popup) {
        popup.classList.remove('hidden');
        popup.classList.remove('minimized');
    }
}

/**
 * Hide sync popup
 */
function hideSyncPopup() {
    const popup = document.getElementById('syncStatusPopup');
    if (popup) {
        popup.classList.add('hidden');
        // Reset state
        const icon = popup.querySelector('.sync-icon');
        icon.className = 'sync-icon idle';
        icon.textContent = '⚙️';
        document.getElementById('syncPopupTitle').textContent = 'Sync Status';
        document.getElementById('syncProgressFill').style.width = '0%';
    }
}

/**
 * Toggle sync popup minimize state
 */
function toggleSyncPopup() {
    const popup = document.getElementById('syncStatusPopup');
    if (popup) {
        if (popup.classList.contains('minimized')) {
            popup.classList.remove('minimized');
        } else {
            popup.classList.add('minimized');
        }
    }
}

/**
 * Retry failed sync operations
 */
function retryFailedSyncs() {
    retryFailedItems();
    const retryBtn = document.getElementById('syncRetryBtn');
    if (retryBtn) {
        retryBtn.style.display = 'none';
    }
    document.getElementById('syncOperationDetails').style.display = 'none';
}
