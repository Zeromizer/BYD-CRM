/**
 * Google Drive Module
 *
 * Handles all Google Drive API operations including:
 * - File/folder creation and management
 * - Data synchronization
 * - File uploads and downloads
 */

// ============ Data Sync Functions ============

// Get or create the data file in Google Drive
async function getOrCreateDataFile() {
    if (!isSignedIn || !rootFolderId) {
        console.log('Cannot sync: not signed in or no root folder');
        return null;
    }

    try {
        // Search for existing data file
        const searchResponse = await gapi.client.drive.files.list({
            q: `name='${DATA_FILE_NAME}' and '${rootFolderId}' in parents and trashed=false`,
            spaces: 'drive',
            fields: 'files(id, name, modifiedTime)'
        });

        if (searchResponse.result.files.length > 0) {
            dataFileId = searchResponse.result.files[0].id;
            console.log('Found existing data file:', dataFileId);
            return dataFileId;
        }

        // Create new data file
        console.log('Creating new data file in Drive...');
        const fileMetadata = {
            name: DATA_FILE_NAME,
            mimeType: 'application/json',
            parents: [rootFolderId]
        };

        const initialData = {
            customers: [],
            lastModified: new Date().toISOString(),
            version: 1
        };

        const response = await gapi.client.drive.files.create({
            resource: fileMetadata,
            fields: 'id'
        });

        dataFileId = response.result.id;

        // Upload initial content
        await updateDataFile(initialData);

        console.log('Created new data file:', dataFileId);
        return dataFileId;
    } catch (error) {
        console.error('Error getting/creating data file:', error);
        return null;
    }
}

// Load data from Google Drive
async function loadDataFromDrive() {
    if (!isSignedIn) {
        console.log('Not signed in, loading from localStorage only');
        return false;
    }

    if (isSyncing) {
        console.log('Sync already in progress');
        return false;
    }

    isSyncing = true;
    updateSyncStatus('syncing');

    try {
        // Ensure we have the data file
        if (!dataFileId) {
            await getOrCreateDataFile();
        }

        if (!dataFileId) {
            console.log('No data file available');
            isSyncing = false;
            updateSyncStatus('offline');
            return false;
        }

        // Download file content
        const response = await gapi.client.drive.files.get({
            fileId: dataFileId,
            alt: 'media'
        });

        const driveData = response.result;
        console.log('✓ Downloaded data from Drive:', driveData);

        if (driveData && driveData.customers) {
            console.log('✓ Drive has', driveData.customers.length, 'customers');

            // Merge with local data if needed
            const localData = localStorage.getItem('bydCRM');
            const localCustomers = localData ? JSON.parse(localData) : [];
            console.log('  Local cache has', localCustomers.length, 'customers');

            // Use Drive data as source of truth, but preserve any local-only data
            if (localCustomers.length > driveData.customers.length) {
                console.log('⚠️  Local has more data, merging...');
                console.log('  Drive:', driveData.customers.length, 'Local:', localCustomers.length);
                customers = mergeCustomerData(driveData.customers, localCustomers);
                console.log('  Merged:', customers.length, 'customers');
                // Save merged data back to Drive
                await saveDataToDrive();
            } else {
                console.log('✓ Using Drive data as source of truth');
                customers = driveData.customers || [];
            }

            // Save to localStorage as cache
            localStorage.setItem('bydCRM', JSON.stringify(customers));
            lastSyncTime = new Date();

            renderCustomerList();
            updateStats();
            updateSyncStatus('synced');

            console.log('✓ Data loaded from Drive:', customers.length, 'customers');
            isSyncing = false;
            return true;
        } else {
            console.log('⚠️  No customer data in Drive file');
        }

        isSyncing = false;
        updateSyncStatus('synced');
        return true;
    } catch (error) {
        console.error('Error loading data from Drive:', error);
        isSyncing = false;
        updateSyncStatus('error');

        // Fall back to localStorage
        const savedData = localStorage.getItem('bydCRM');
        if (savedData) {
            customers = JSON.parse(savedData);
            renderCustomerList();
            updateStats();
        }

        return false;
    }
}

// Save data to Google Drive
async function saveDataToDrive() {
    if (!isSignedIn) {
        console.log('Not signed in, saving to localStorage only');
        localStorage.setItem('bydCRM', JSON.stringify(customers));
        return false;
    }

    if (isSyncing) {
        console.log('Sync already in progress, will retry...');
        // Queue for retry
        setTimeout(() => saveDataToDrive(), 2000);
        return false;
    }

    isSyncing = true;
    updateSyncStatus('syncing');

    try {
        // Ensure we have the data file
        if (!dataFileId) {
            await getOrCreateDataFile();
        }

        if (!dataFileId) {
            console.log('No data file available');
            isSyncing = false;
            updateSyncStatus('offline');
            localStorage.setItem('bydCRM', JSON.stringify(customers));
            return false;
        }

        const dataToSave = {
            customers: customers,
            lastModified: new Date().toISOString(),
            version: 1
        };

        await updateDataFile(dataToSave);

        // Also save to localStorage as cache
        localStorage.setItem('bydCRM', JSON.stringify(customers));
        lastSyncTime = new Date();
        updateSyncStatus('synced');

        console.log('Data saved to Drive:', customers.length, 'customers');
        isSyncing = false;
        return true;
    } catch (error) {
        console.error('Error saving data to Drive:', error);
        isSyncing = false;
        updateSyncStatus('error');

        // Still save locally
        localStorage.setItem('bydCRM', JSON.stringify(customers));
        return false;
    }
}

// Load data (tries Drive first, falls back to localStorage)
async function loadData() {
    if (isSignedIn && rootFolderId) {
        // Try to load from Drive
        const success = await loadDataFromDrive();
        if (success) {
            return;
        }
    }

    // Fall back to localStorage
    const savedData = localStorage.getItem('bydCRM');
    if (savedData) {
        customers = JSON.parse(savedData);
        renderCustomerList();
        updateStats();
        updateSyncStatus('offline');
    }
}

// Save data (saves to both Drive and localStorage)
// Now uses optimistic updates - saves locally first, then queues cloud sync
async function saveData() {
    // Local update function - saves immediately to localStorage
    const localUpdate = async () => {
        try {
            localStorage.setItem('bydCRM', JSON.stringify(customers));
            console.log('Local save successful');
        } catch (error) {
            console.error('Local save failed:', error);
            throw error;
        }
    };

    // Cloud sync function - syncs to Google Drive
    const cloudSync = async () => {
        return await saveDataToDrive();
    };

    // Use optimistic save pattern
    try {
        return await optimisticSave(localUpdate, cloudSync, {});
    } catch (error) {
        console.error('Optimistic save failed:', error);
        // Fallback to old behavior if optimistic save not available
        await saveDataToDrive();
    }
}

// Update the data file content in Drive
async function updateDataFile(data) {
    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";

    const contentType = 'application/json';
    const metadata = {
        mimeType: contentType
    };

    const multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: ' + contentType + '\r\n\r\n' +
        JSON.stringify(data, null, 2) +
        close_delim;

    const response = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${dataFileId}?uploadType=multipart`,
        {
            method: 'PATCH',
            headers: new Headers({
                'Authorization': 'Bearer ' + accessToken,
                'Content-Type': 'multipart/related; boundary="' + boundary + '"'
            }),
            body: multipartRequestBody
        }
    );

    if (!response.ok) {
        throw new Error('Failed to update data file: ' + response.statusText);
    }

    return response.json();
}

// Merge customer data (conflict resolution)
function mergeCustomerData(driveCustomers, localCustomers) {
    const merged = [...driveCustomers];
    const driveIds = new Set(driveCustomers.map(c => c.id));

    // Add any local customers that aren't in Drive
    for (const localCustomer of localCustomers) {
        if (!driveIds.has(localCustomer.id)) {
            console.log('Adding local-only customer:', localCustomer.name);
            merged.push(localCustomer);
        }
    }

    return merged;
}

// ============ Folder Management Functions ============

// Get or create root folder
async function getRootFolder() {
    try {
        // Search for existing folder
        const response = await gapi.client.drive.files.list({
            q: "name='BYD_MotorEast_Customers' and mimeType='application/vnd.google-apps.folder' and trashed=false",
            spaces: 'drive',
            fields: 'files(id, name)'
        });

        if (response.result.files.length > 0) {
            rootFolderId = response.result.files[0].id;
        } else {
            // Create root folder
            const createResponse = await gapi.client.drive.files.create({
                resource: {
                    name: 'BYD_MotorEast_Customers',
                    mimeType: 'application/vnd.google-apps.folder'
                },
                fields: 'id'
            });
            rootFolderId = createResponse.result.id;
        }

        // Load data from Drive after root folder is ready
        await loadData();

        // Load forms after root folder is ready
        await getOrCreateFormsFolder();
        await loadFormTemplates();

        // Load Excel templates after root folder is ready
        await getOrCreateExcelTemplatesFolder();
        await loadExcelTemplates();

        // Refresh customer view if one is selected
        if (selectedCustomerId) {
            displayCustomerDetails(selectedCustomerId);
        }

        updateStats();
    } catch (error) {
        console.error('Error getting root folder:', error);
    }
}

// Create customer folder
async function createCustomerFolder(customerName, customerId) {
    if (!isSignedIn) {
        alert('Please connect to Google Drive first.');
        return null;
    }

    // Ensure root folder is ready
    if (!rootFolderId) {
        console.log('Root folder not ready, fetching...');
        try {
            await getRootFolder();
            if (!rootFolderId) {
                alert('Failed to initialize Google Drive folder. Please try reconnecting.');
                return null;
            }
        } catch (error) {
            console.error('Error getting root folder:', error);
            alert('Failed to access Google Drive. Error: ' + error.message);
            return null;
        }
    }

    try {
        const folderName = customerName.replace(/\s+/g, '_');

        // Check if folder exists
        const searchResponse = await gapi.client.drive.files.list({
            q: `name='${folderName}' and '${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            spaces: 'drive',
            fields: 'files(id, name)'
        });

        if (searchResponse.result.files.length > 0) {
            const folderId = searchResponse.result.files[0].id;
            console.log('Folder already exists, using existing folder:', folderId);

            // Update customer record
            const customer = customers.find(c => c.id === customerId);
            if (customer && !customer.driveFolderId) {
                customer.driveFolderId = folderId;
                saveData();
            }

            // Create document subfolders
            await createDocumentSubfolders(folderId, customerId);
            alert('Folder created successfully for ' + customerName);
            return folderId;
        }

        // Create folder
        console.log('Creating new folder:', folderName);
        const response = await gapi.client.drive.files.create({
            resource: {
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [rootFolderId]
            },
            fields: 'id, webViewLink'
        });

        console.log('Folder created:', response.result.id);

        const customer = customers.find(c => c.id === customerId);
        if (customer) {
            customer.driveFolderId = response.result.id;
            customer.driveFolderLink = response.result.webViewLink;
            saveData();
        }

        // Create document subfolders
        await createDocumentSubfolders(response.result.id, customerId);

        alert('Folder created successfully for ' + customerName);
        return response.result.id;
    } catch (error) {
        console.error('Error creating folder:', error);

        // Provide specific error messages
        if (error.status === 401) {
            alert('Your Google Drive session has expired. Please reconnect.');
            clearTokenFromStorage();
            accessToken = null;
            isSignedIn = false;
            updateSigninStatus(false);
        } else if (error.status === 403) {
            alert('Permission denied. Please ensure you have granted the necessary permissions.');
        } else {
            alert('Failed to create folder: ' + (error.message || 'Unknown error'));
        }

        return null;
    }
}

// Create document subfolders for organizing files
async function createDocumentSubfolders(customerFolderId, customerId) {
    if (!isSignedIn || !customerFolderId) return;

    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    // Initialize document folders map if not exists
    if (!customer.documentFolders) {
        customer.documentFolders = {};
    }

    try {
        // Create all subfolders in parallel for faster performance
        const folderPromises = documentFolders.map(async (folder) => {
            // Check if subfolder already exists
            const searchResponse = await gapi.client.drive.files.list({
                q: `name='${folder.name}' and '${customerFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
                spaces: 'drive',
                fields: 'files(id, name)'
            });

            let subfolderId;
            if (searchResponse.result.files.length > 0) {
                subfolderId = searchResponse.result.files[0].id;
            } else {
                // Create subfolder
                const createResponse = await gapi.client.drive.files.create({
                    resource: {
                        name: folder.name,
                        mimeType: 'application/vnd.google-apps.folder',
                        parents: [customerFolderId]
                    },
                    fields: 'id'
                });
                subfolderId = createResponse.result.id;
            }

            return { folderId: folder.id, subfolderId };
        });

        // Wait for all folder operations to complete
        const results = await Promise.allSettled(folderPromises);

        // Store successful subfolder IDs
        results.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value) {
                customer.documentFolders[result.value.folderId] = result.value.subfolderId;
            } else if (result.status === 'rejected') {
                console.error(`Failed to create folder ${documentFolders[index].name}:`, result.reason);
            }
        });

        saveData();
    } catch (error) {
        console.error('Error creating document subfolders:', error);
    }
}

// Handle folder creation button click with UI feedback
async function handleCreateFolderClick(customerName, customerId) {
    // Prevent duplicate clicks
    if (isCreatingFolder) {
        console.log('Folder creation already in progress...');
        return;
    }

    isCreatingFolder = true;
    const customer = customers.find(c => c.id === customerId);

    // Check if folder already exists
    if (customer && customer.driveFolderId) {
        alert(`Folder already exists for ${customerName}!`);
        isCreatingFolder = false;
        return;
    }

    try {
        console.log('Starting folder creation for:', customerName);

        // Create the folder
        const folderId = await createCustomerFolder(customerName, customerId);

        if (folderId) {
            console.log('Folder created successfully:', folderId);
            // Refresh the customer view
            selectCustomer(customerId);
        } else {
            console.error('Folder creation returned null');
        }
    } catch (error) {
        console.error('Error in handleCreateFolderClick:', error);
        alert('An unexpected error occurred: ' + error.message);
    } finally {
        isCreatingFolder = false;
    }
}

// ============ File Upload/Download Functions ============

// Upload file to Drive
async function uploadFileToDrive(file, customerId, fileName, documentType = 'other') {
    if (!isSignedIn) {
        alert('Please connect to Google Drive first');
        return null;
    }

    const customer = customers.find(c => c.id === customerId);
    if (!customer) return null;

    // Ensure folder exists
    if (!customer.driveFolderId) {
        await createCustomerFolder(customer.name, customerId);
    }

    // Ensure document subfolders exist
    if (!customer.documentFolders || !customer.documentFolders[documentType]) {
        await createDocumentSubfolders(customer.driveFolderId, customerId);
    }

    try {
        // Determine target folder (subfolder or main customer folder)
        const targetFolderId = customer.documentFolders && customer.documentFolders[documentType]
            ? customer.documentFolders[documentType]
            : customer.driveFolderId;

        const metadata = {
            name: fileName,
            parents: [targetFolderId]
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);

        const response = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,createdTime',
            {
                method: 'POST',
                headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
                body: form
            }
        );

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error uploading file:', error);
        alert('Error uploading file to Google Drive');
        return null;
    }
}

// Get files from customer folder and all subfolders
async function getCustomerFiles(customerId) {
    const customer = customers.find(c => c.id === customerId);
    if (!customer || !customer.driveFolderId || !isSignedIn) {
        return [];
    }

    try {
        // Fetch all folders in parallel for faster performance
        const fetchPromises = [];

        // Get files from main customer folder
        fetchPromises.push(
            gapi.client.drive.files.list({
                q: `'${customer.driveFolderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed=false`,
                spaces: 'drive',
                fields: 'files(id, name, mimeType, size, webViewLink, createdTime)',
                orderBy: 'createdTime desc'
            })
        );

        // Get files from all document subfolders in parallel
        if (customer.documentFolders) {
            for (const folderId of Object.values(customer.documentFolders)) {
                fetchPromises.push(
                    gapi.client.drive.files.list({
                        q: `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed=false`,
                        spaces: 'drive',
                        fields: 'files(id, name, mimeType, size, webViewLink, createdTime)',
                        orderBy: 'createdTime desc'
                    })
                );
            }
        }

        // Wait for all fetch operations to complete
        const results = await Promise.allSettled(fetchPromises);

        // Combine all files from successful requests
        let allFiles = [];
        results.forEach(result => {
            if (result.status === 'fulfilled' && result.value.result.files) {
                allFiles = allFiles.concat(result.value.result.files);
            } else if (result.status === 'rejected') {
                console.error('Failed to fetch files:', result.reason);
            }
        });

        // Sort all files by creation time (newest first)
        allFiles.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));

        return allFiles;
    } catch (error) {
        console.error('Error getting files:', error);
        return [];
    }
}

// Delete file from Drive
async function deleteFileFromDrive(fileId) {
    if (!isSignedIn) return false;

    try {
        await gapi.client.drive.files.delete({
            fileId: fileId
        });
        return true;
    } catch (error) {
        console.error('Error deleting file:', error);
        return false;
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

// ============ Forms Folder Management ============

// Get or create forms folder in Google Drive
async function getOrCreateFormsFolder() {
    if (!isSignedIn || !rootFolderId) {
        console.log('Cannot create forms folder: not signed in or no root folder');
        return null;
    }

    try {
        // Check if Forms folder exists
        const searchResponse = await gapi.client.drive.files.list({
            q: `name='Forms' and '${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            spaces: 'drive',
            fields: 'files(id, name)'
        });

        if (searchResponse.result.files.length > 0) {
            formsFolderId = searchResponse.result.files[0].id;
            console.log('Forms folder found:', formsFolderId);
        } else {
            // Create Forms folder
            console.log('Creating Forms folder...');
            const createResponse = await gapi.client.drive.files.create({
                resource: {
                    name: 'Forms',
                    mimeType: 'application/vnd.google-apps.folder',
                    parents: [rootFolderId]
                },
                fields: 'id'
            });
            formsFolderId = createResponse.result.id;
            console.log('Forms folder created:', formsFolderId);
        }

        return formsFolderId;
    } catch (error) {
        console.error('Error creating forms folder:', error);
        alert('Failed to create forms folder: ' + error.message);
        return null;
    }
}

// Get or create Excel Templates folder in Google Drive
async function getOrCreateExcelTemplatesFolder() {
    if (!isSignedIn || !rootFolderId) {
        console.log('Cannot create Excel Templates folder: not signed in or no root folder');
        return null;
    }

    try {
        // Check if Excel Templates folder exists
        const searchResponse = await gapi.client.drive.files.list({
            q: `name='Excel_Templates' and '${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            spaces: 'drive',
            fields: 'files(id, name)'
        });

        if (searchResponse.result.files.length > 0) {
            excelTemplatesFolderId = searchResponse.result.files[0].id;
            console.log('Excel Templates folder found:', excelTemplatesFolderId);
        } else {
            // Create Excel Templates folder
            console.log('Creating Excel Templates folder...');
            const createResponse = await gapi.client.drive.files.create({
                resource: {
                    name: 'Excel_Templates',
                    mimeType: 'application/vnd.google-apps.folder',
                    parents: [rootFolderId]
                },
                fields: 'id'
            });
            excelTemplatesFolderId = createResponse.result.id;
            console.log('Excel Templates folder created:', excelTemplatesFolderId);
        }

        // Get or create the Excel data file for syncing templates
        await getOrCreateExcelDataFile();

        return excelTemplatesFolderId;
    } catch (error) {
        console.error('Error creating Excel Templates folder:', error);
        alert('Failed to create Excel Templates folder: ' + error.message);
        return null;
    }
}

// Get or create the forms data file in Google Drive
async function getOrCreateFormsDataFile() {
    if (!isSignedIn || !formsFolderId) {
        console.log('Cannot sync forms: not signed in or no forms folder');
        return null;
    }

    try {
        const FORMS_DATA_FILE_NAME = 'Forms_Data.json';

        // Search for existing forms data file
        const searchResponse = await gapi.client.drive.files.list({
            q: `name='${FORMS_DATA_FILE_NAME}' and '${formsFolderId}' in parents and trashed=false`,
            spaces: 'drive',
            fields: 'files(id, name, modifiedTime)'
        });

        if (searchResponse.result.files.length > 0) {
            formsDataFileId = searchResponse.result.files[0].id;
            console.log('Found existing forms data file:', formsDataFileId);
            return formsDataFileId;
        }

        // Create new forms data file
        console.log('Creating new forms data file...');
        const createResponse = await gapi.client.drive.files.create({
            resource: {
                name: FORMS_DATA_FILE_NAME,
                mimeType: 'application/json',
                parents: [formsFolderId]
            },
            fields: 'id'
        });

        formsDataFileId = createResponse.result.id;
        console.log('Created forms data file:', formsDataFileId);

        // Initialize with empty object
        await updateFormsDataFile({});

        return formsDataFileId;
    } catch (error) {
        console.error('Error with forms data file:', error);
        return null;
    }
}

// Update the forms data file content in Drive
async function updateFormsDataFile(data) {
    if (!formsDataFileId) {
        console.error('No forms data file ID');
        return false;
    }

    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";

    const contentType = 'application/json';
    const metadata = {
        mimeType: contentType
    };

    const multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: ' + contentType + '\r\n\r\n' +
        JSON.stringify(data, null, 2) +
        close_delim;

    const response = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${formsDataFileId}?uploadType=multipart`,
        {
            method: 'PATCH',
            headers: {
                'Authorization': 'Bearer ' + gapi.client.getToken().access_token,
                'Content-Type': 'multipart/related; boundary="' + boundary + '"'
            },
            body: multipartRequestBody
        }
    );

    if (!response.ok) {
        throw new Error('Failed to update forms data file');
    }

    return true;
}

// Get or create the Excel templates data file in Drive
async function getOrCreateExcelDataFile() {
    if (!isSignedIn || !excelTemplatesFolderId) {
        console.log('Cannot sync Excel templates: not signed in or no templates folder');
        return null;
    }

    try {
        const EXCEL_DATA_FILE_NAME = 'Excel_Templates_Data.json';

        // Search for existing Excel data file
        const searchResponse = await gapi.client.drive.files.list({
            q: `name='${EXCEL_DATA_FILE_NAME}' and '${excelTemplatesFolderId}' in parents and trashed=false`,
            spaces: 'drive',
            fields: 'files(id, name, modifiedTime)'
        });

        if (searchResponse.result.files.length > 0) {
            excelDataFileId = searchResponse.result.files[0].id;
            console.log('Found existing Excel data file:', excelDataFileId);
            return excelDataFileId;
        }

        // Create new Excel data file
        console.log('Creating new Excel data file...');
        const createResponse = await gapi.client.drive.files.create({
            resource: {
                name: EXCEL_DATA_FILE_NAME,
                mimeType: 'application/json',
                parents: [excelTemplatesFolderId]
            },
            fields: 'id'
        });

        excelDataFileId = createResponse.result.id;
        console.log('Created Excel data file:', excelDataFileId);

        // Initialize with empty object
        await updateExcelDataFile({});

        return excelDataFileId;
    } catch (error) {
        console.error('Error with Excel data file:', error);
        return null;
    }
}

// Update the Excel templates data file content in Drive
async function updateExcelDataFile(data) {
    if (!excelDataFileId) {
        console.error('No Excel data file ID');
        return false;
    }

    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";

    const contentType = 'application/json';
    const metadata = {
        mimeType: contentType
    };

    const multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: ' + contentType + '\r\n\r\n' +
        JSON.stringify(data, null, 2) +
        close_delim;

    const response = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${excelDataFileId}?uploadType=multipart`,
        {
            method: 'PATCH',
            headers: {
                'Authorization': 'Bearer ' + gapi.client.getToken().access_token,
                'Content-Type': 'multipart/related; boundary="' + boundary + '"'
            },
            body: multipartRequestBody
        }
    );

    if (!response.ok) {
        throw new Error('Failed to update Excel data file');
    }

    return true;
}

// Load Excel templates from Drive
async function loadExcelTemplatesFromDrive() {
    if (!isSignedIn || !excelDataFileId) {
        console.log('Cannot load Excel templates: not signed in or no data file');
        return null;
    }

    try {
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files/${excelDataFileId}?alt=media`,
            {
                headers: new Headers({ 'Authorization': 'Bearer ' + gapi.client.getToken().access_token })
            }
        );

        if (!response.ok) {
            throw new Error('Failed to load Excel templates from Drive');
        }

        const templatesData = await response.json();
        console.log('Loaded Excel templates from Drive:', templatesData);
        return templatesData;
    } catch (error) {
        console.error('Error loading Excel templates from Drive:', error);
        return null;
    }
}
