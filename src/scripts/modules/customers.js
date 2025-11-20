/**
 * Customers Module
 *
 * Handles all customer CRUD operations and customer list rendering.
 * Functions:
 * - Customer creation, update, and deletion
 * - Customer selection and display
 * - Search functionality
 * - Deal status management
 */

// ============ Customer CRUD Operations ============

// Add customer
// Prevent duplicate customer creation
async function addCustomer(event) {
    event.preventDefault();

    // Prevent duplicate submissions
    if (isAddingCustomer) {
        console.log('Already adding customer, please wait...');
        return;
    }

    isAddingCustomer = true;

    // Get UI elements
    const submitBtn = document.getElementById('addCustomerSubmitBtn');
    const progressDiv = document.getElementById('addCustomerProgress');
    const progressText = document.getElementById('addCustomerProgressText');
    const progressBar = document.getElementById('addCustomerProgressBar');

    // Disable submit button and show progress
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating...';
    progressDiv.style.display = 'block';
    progressBar.style.width = '0%';

    try {
        // Step 1: Create customer object
        progressText.textContent = 'Creating customer record...';
        progressBar.style.width = '25%';

        const customer = {
            id: Date.now(),
            name: document.getElementById('newCustomerName').value,
            phone: document.getElementById('newCustomerPhone').value,
            email: document.getElementById('newCustomerEmail').value,
            nric: document.getElementById('newCustomerNRIC').value,
            occupation: document.getElementById('newCustomerOccupation').value,
            dob: document.getElementById('newCustomerDOB').value,
            salesConsultant: document.getElementById('newCustomerSalesConsultant').value,
            vsaNo: document.getElementById('newCustomerVsaNo').value,
            address: document.getElementById('newCustomerAddress').value,
            addressContinue: document.getElementById('newCustomerAddressContinue').value,
            notes: document.getElementById('newCustomerNotes').value,
            dateAdded: new Date().toISOString(),
            checklist: {},
            dealClosed: false,
            driveFolderId: null,
            driveFolderLink: null
        };

        customers.push(customer);

        // Step 2: Save to cloud (non-blocking - queued in background)
        progressText.textContent = 'Queuing cloud sync...';
        progressBar.style.width = '50%';
        saveData(); // Don't await - it will queue in background

        // Step 3: Queue Google Drive folder creation in background
        if (isSignedIn) {
            progressText.textContent = 'Queuing folder creation...';
            progressBar.style.width = '75%';

            // Queue folder creation in background
            queueOperation('createFolder', async () => {
                return await createCustomerFolder(customer.name, customer.id);
            }, { customerId: customer.id, customerName: customer.name });
        }

        // Step 4: Complete (UI updates immediately!)
        progressText.textContent = 'Done! Syncing in background...';
        progressBar.style.width = '100%';

        // Wait a brief moment to show completion message
        await new Promise(resolve => setTimeout(resolve, 300));

        renderCustomerList();
        closeAddCustomerModal();
        selectCustomer(customer.id);

    } catch (error) {
        console.error('Error adding customer:', error);
        alert('Error creating customer: ' + error.message);

        // Reset UI on error
        submitBtn.disabled = false;
        submitBtn.textContent = 'Add Customer';
        progressDiv.style.display = 'none';
    } finally {
        isAddingCustomer = false;
    }
}

// Render customer list
function renderCustomerList() {
    const listContainer = document.getElementById('customerList');

    if (customers.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state">
                <p>No customers yet</p>
                <p style="font-size: 14px; margin-top: 10px;">Click "Add Customer" to get started</p>
            </div>
        `;
        return;
    }

    listContainer.innerHTML = customers.map(customer => `
        <div class="customer-item ${selectedCustomerId === customer.id ? 'active' : ''}" onclick="selectCustomer(${customer.id})">
            <h3>${customer.name} ${customer.driveFolderId ? '📁' : ''}</h3>
            <p>📱 ${customer.phone}</p>
            ${customer.dealClosed ? '<span class="stage-badge" style="background: #27ae60; margin-left: 5px;">✓ Closed</span>' : ''}
        </div>
    `).join('');
}

// Select customer
function selectCustomer(customerId) {
    selectedCustomerId = customerId;
    renderCustomerList();
    displayCustomerDetails(customerId);
}

// Update customer
function updateCustomer(customerId, field, value) {
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
        customer[field] = value;
        saveData();
        renderCustomerList();
        displayCustomerDetails(customerId);
    }
}

// Save customer edits
function saveCustomerEdit(customerId) {
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
        // Get values from form fields
        customer.name = document.getElementById('customer_name').value;
        customer.phone = document.getElementById('customer_phone').value;
        customer.email = document.getElementById('customer_email').value;
        customer.nric = document.getElementById('customer_nric').value;
        customer.occupation = document.getElementById('customer_occupation').value;
        customer.dob = document.getElementById('customer_dob').value;
        customer.salesConsultant = document.getElementById('customer_salesConsultant').value;
        customer.vsaNo = document.getElementById('customer_vsaNo').value;
        customer.address = document.getElementById('customer_address').value;
        customer.addressContinue = document.getElementById('customer_addressContinue').value;
        customer.notes = document.getElementById('customer_notes').value;

        // Save changes
        saveData();
        renderCustomerList();
        displayCustomerDetails(customerId);
    }
}

// Cancel customer edits
function cancelCustomerEdit(customerId) {
    if (customerBackup) {
        // Restore customer data from backup
        const customer = customers.find(c => c.id === customerId);
        if (customer) {
            Object.assign(customer, customerBackup);
        }
    }
    displayCustomerDetails(customerId);
}

// Delete customer
async function deleteCustomer(customerId) {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    const confirmMsg = customer.driveFolderId
        ? `Delete ${customer.name}? The Google Drive folder will remain, but you can manually delete it later.`
        : `Delete ${customer.name}? This cannot be undone.`;

    if (confirm(confirmMsg)) {
        customers = customers.filter(c => c.id !== customerId);
        saveData();
        renderCustomerList();
        document.getElementById('customerDetails').innerHTML = `
            <div class="empty-state">
                <p>Select a customer to view details</p>
            </div>
        `;
        updateStats();
    }
}

// Toggle checklist item
function toggleChecklistItem(customerId, itemId, setValue = null) {
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
        // If setValue is provided, use it; otherwise toggle
        if (setValue !== null) {
            customer.checklist[itemId] = setValue;
        } else {
            customer.checklist[itemId] = !customer.checklist[itemId];
        }
        saveData();
        displayCustomerDetails(customerId);
    }
}

// Mark deal closed
function markDealClosed(customerId) {
    const customer = customers.find(c => c.id === customerId);
    if (customer && confirm(`Mark deal as closed for ${customer.name}?`)) {
        customer.dealClosed = true;
        customer.closedDate = new Date().toISOString();
        saveData();
        renderCustomerList();
        displayCustomerDetails(customerId);
    }
}

// Mark deal open
function markDealOpen(customerId) {
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
        customer.dealClosed = false;
        customer.closedDate = null;
        saveData();
        renderCustomerList();
        displayCustomerDetails(customerId);
    }
}

// Search customers
function searchCustomers() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const listContainer = document.getElementById('customerList');

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(searchTerm) ||
        c.phone.includes(searchTerm) ||
        (c.email && c.email.toLowerCase().includes(searchTerm))
    );

    if (filteredCustomers.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state">
                <p>No customers found</p>
            </div>
        `;
        return;
    }

    listContainer.innerHTML = filteredCustomers.map(customer => `
        <div class="customer-item ${selectedCustomerId === customer.id ? 'active' : ''}" onclick="selectCustomer(${customer.id})">
            <h3>${customer.name} ${customer.driveFolderId ? '📁' : ''}</h3>
            <p>📱 ${customer.phone}</p>
            ${customer.dealClosed ? '<span class="stage-badge" style="background: #27ae60; margin-left: 5px;">✓ Closed</span>' : ''}
        </div>
    `).join('');
}

// ============ Data Import/Export ============

// Export data
function exportData() {
    const dataStr = JSON.stringify(customers, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `BYD_CRM_Export_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    alert('Customer data exported! Files remain in Google Drive.');
}

// Import data
function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function(e) {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const importedData = JSON.parse(event.target.result);
                if (confirm(`Import ${importedData.length} customers? This will replace current data.`)) {
                    customers = importedData;
                    saveData();
                    renderCustomerList();
                    alert('Data imported successfully!');
                }
            } catch (error) {
                alert('Error importing data. Please check the file format.');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}
