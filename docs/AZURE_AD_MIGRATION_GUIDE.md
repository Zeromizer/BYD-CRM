# Migration Guide: Google Drive → OneDrive with Free Azure AD

This guide walks you through setting up a free Azure AD tenant for your 10-user team and migrating your BYD CRM from Google Drive to OneDrive.

---

## Overview

| What You'll Get | Details |
|-----------------|---------|
| **Cost** | Free (Azure AD Free tier) |
| **User Limit** | Unlimited (single tenant) |
| **Storage** | 5GB OneDrive per user (free tier) |
| **Verification** | Not required for single tenant |
| **Admin Control** | Full control over users and data |

---

## Part 1: Create Free Azure AD Tenant

### Step 1.1: Create Azure Account

1. Go to [https://azure.microsoft.com/free](https://azure.microsoft.com/free)
2. Click **"Start free"**
3. Sign in with any Microsoft account (or create one)
4. Complete the registration (credit card required for verification, but won't be charged)

> **Note:** The free tier includes Azure AD with unlimited users for single-tenant apps.

### Step 1.2: Access Azure Active Directory (now called Microsoft Entra ID)

1. Go to [https://portal.azure.com](https://portal.azure.com)
2. In the search bar, type **"Microsoft Entra ID"** (formerly Azure AD)
3. Click on **Microsoft Entra ID** from the results

### Step 1.3: Note Your Tenant Information

1. In Microsoft Entra ID, go to **Overview**
2. Note down:
   - **Tenant ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
   - **Primary domain**: `yourcompany.onmicrosoft.com`

---

## Part 2: Add Your Team Members

### Step 2.1: Create User Accounts

1. In Microsoft Entra ID, go to **Users** → **All users**
2. Click **+ New user** → **Create new user**
3. Fill in the details:
   ```
   User principal name: john@yourcompany.onmicrosoft.com
   Display name: John Doe
   Password: Auto-generate or set manually
   ```
4. Click **Create**
5. Repeat for all 10 team members

### Step 2.2: Share Initial Passwords

1. Send each user their:
   - Username: `username@yourcompany.onmicrosoft.com`
   - Temporary password
2. Users will be prompted to change password on first login

### Step 2.3: (Optional) Add Custom Domain

If you own a domain (e.g., `bydmotoreast.com`):

1. Go to **Microsoft Entra ID** → **Custom domain names**
2. Click **+ Add custom domain**
3. Enter your domain name
4. Add the DNS TXT record shown to your domain's DNS settings
5. Click **Verify**

Now users can login as `john@bydmotoreast.com` instead of `@yourcompany.onmicrosoft.com`

---

## Part 3: Register Your CRM Application

### Step 3.1: Create App Registration

1. In Microsoft Entra ID, go to **App registrations**
2. Click **+ New registration**
3. Fill in:
   ```
   Name: BYD CRM

   Supported account types:
   ✅ Accounts in this organizational directory only (Single tenant)

   Redirect URI:
   Platform: Single-page application (SPA)
   URL: https://zeromizer.github.io/BYD-CRM
   ```
4. Click **Register**

### Step 3.2: Note Your App Credentials

After registration, note down:
- **Application (client) ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- **Directory (tenant) ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

### Step 3.3: Configure API Permissions

1. Go to your app → **API permissions**
2. Click **+ Add a permission**
3. Select **Microsoft Graph**
4. Select **Delegated permissions**
5. Add these permissions:
   ```
   ✅ Files.ReadWrite        (Read and write user files)
   ✅ Files.ReadWrite.All    (Read and write all files user can access)
   ✅ User.Read              (Sign in and read user profile)
   ```
6. Click **Add permissions**

### Step 3.4: Grant Admin Consent

1. Still in **API permissions**
2. Click **Grant admin consent for [Your Tenant]**
3. Click **Yes** to confirm

> **This eliminates the consent prompt for your users!**

### Step 3.5: Configure Authentication Settings

1. Go to your app → **Authentication**
2. Under **Single-page application**, ensure your redirect URI is set:
   ```
   https://zeromizer.github.io/BYD-CRM
   ```
3. For local development, add:
   ```
   http://localhost:5173
   ```
4. Under **Implicit grant and hybrid flows**:
   ```
   ✅ Access tokens
   ✅ ID tokens
   ```
5. Click **Save**

---

## Part 4: Update Your CRM Code

### Step 4.1: Install Microsoft Authentication Library

```bash
npm install @azure/msal-browser @azure/msal-react
```

### Step 4.2: Create Microsoft Auth Configuration

Create new file: `src/config/msalConfig.js`

```javascript
// Microsoft Authentication Library (MSAL) Configuration
export const msalConfig = {
  auth: {
    clientId: 'YOUR_APPLICATION_CLIENT_ID', // From Step 3.2
    authority: 'https://login.microsoftonline.com/YOUR_TENANT_ID', // Single tenant
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
};

// Scopes for Microsoft Graph API
export const loginRequest = {
  scopes: ['User.Read', 'Files.ReadWrite', 'Files.ReadWrite.All'],
};

export const graphConfig = {
  graphMeEndpoint: 'https://graph.microsoft.com/v1.0/me',
  graphFilesEndpoint: 'https://graph.microsoft.com/v1.0/me/drive',
};
```

### Step 4.3: Create Microsoft Auth Service

Create new file: `src/services/msAuthService.js`

```javascript
import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser';
import { msalConfig, loginRequest } from '../config/msalConfig';

class MsAuthService {
  constructor() {
    this.msalInstance = new PublicClientApplication(msalConfig);
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    await this.msalInstance.initialize();

    // Handle redirect response
    const response = await this.msalInstance.handleRedirectPromise();
    if (response) {
      this.msalInstance.setActiveAccount(response.account);
    }

    this.initialized = true;
  }

  async signIn() {
    await this.initialize();

    try {
      const response = await this.msalInstance.loginPopup(loginRequest);
      this.msalInstance.setActiveAccount(response.account);
      return {
        success: true,
        user: response.account,
      };
    } catch (error) {
      console.error('Login failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async signOut() {
    await this.msalInstance.logoutPopup();
  }

  async getAccessToken() {
    await this.initialize();

    const account = this.msalInstance.getActiveAccount();
    if (!account) {
      throw new Error('No active account. Please sign in.');
    }

    try {
      const response = await this.msalInstance.acquireTokenSilent({
        ...loginRequest,
        account,
      });
      return response.accessToken;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        // Token expired, need interactive login
        const response = await this.msalInstance.acquireTokenPopup(loginRequest);
        return response.accessToken;
      }
      throw error;
    }
  }

  getCurrentUser() {
    return this.msalInstance.getActiveAccount();
  }

  isAuthenticated() {
    return !!this.msalInstance.getActiveAccount();
  }
}

export const msAuthService = new MsAuthService();
export default msAuthService;
```

### Step 4.4: Create OneDrive Service

Create new file: `src/services/oneDriveService.js`

```javascript
import msAuthService from './msAuthService';

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

class OneDriveService {

  // ============ Helper Methods ============

  async getHeaders() {
    const token = await msAuthService.getAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  async request(endpoint, options = {}) {
    const headers = await this.getHeaders();
    const response = await fetch(`${GRAPH_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Request failed');
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  // ============ Folder Operations ============

  /**
   * Get or create the root CRM folder
   */
  async getOrCreateRootFolder() {
    const folderName = 'BYD CRM';

    try {
      // Try to find existing folder
      const result = await this.request(
        `/me/drive/root/children?$filter=name eq '${folderName}' and folder ne null`
      );

      if (result.value && result.value.length > 0) {
        return result.value[0];
      }

      // Create if not exists
      return await this.createFolder('root', folderName);
    } catch (error) {
      console.error('Error getting/creating root folder:', error);
      throw error;
    }
  }

  /**
   * Create a folder
   */
  async createFolder(parentId, folderName) {
    const parentPath = parentId === 'root' ? '/me/drive/root/children' : `/me/drive/items/${parentId}/children`;

    return this.request(parentPath, {
      method: 'POST',
      body: JSON.stringify({
        name: folderName,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'fail',
      }),
    });
  }

  /**
   * List items in a folder
   */
  async listFolder(folderId) {
    const path = folderId === 'root'
      ? '/me/drive/root/children'
      : `/me/drive/items/${folderId}/children`;

    const result = await this.request(path);
    return result.value || [];
  }

  /**
   * Find a folder by name within a parent folder
   */
  async findFolder(parentId, folderName) {
    const items = await this.listFolder(parentId);
    return items.find(item => item.folder && item.name === folderName);
  }

  // ============ File Operations ============

  /**
   * Upload a file (small files < 4MB)
   */
  async uploadFile(folderId, fileName, content, contentType = 'application/json') {
    const path = `/me/drive/items/${folderId}:/${fileName}:/content`;
    const token = await msAuthService.getAccessToken();

    const response = await fetch(`${GRAPH_BASE_URL}${path}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': contentType,
      },
      body: typeof content === 'string' ? content : JSON.stringify(content),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Upload failed');
    }

    return response.json();
  }

  /**
   * Download file content
   */
  async downloadFile(fileId) {
    const token = await msAuthService.getAccessToken();

    const response = await fetch(`${GRAPH_BASE_URL}/me/drive/items/${fileId}/content`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Download failed');
    }

    return response;
  }

  /**
   * Download file as JSON
   */
  async downloadFileAsJson(fileId) {
    const response = await this.downloadFile(fileId);
    return response.json();
  }

  /**
   * Download file as Blob (for images/PDFs)
   */
  async downloadFileAsBlob(fileId) {
    const response = await this.downloadFile(fileId);
    return response.blob();
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(fileId) {
    return this.request(`/me/drive/items/${fileId}`);
  }

  /**
   * Delete a file or folder
   */
  async deleteItem(itemId) {
    return this.request(`/me/drive/items/${itemId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Update file content
   */
  async updateFile(fileId, content, contentType = 'application/json') {
    const token = await msAuthService.getAccessToken();

    const response = await fetch(`${GRAPH_BASE_URL}/me/drive/items/${fileId}/content`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': contentType,
      },
      body: typeof content === 'string' ? content : JSON.stringify(content),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Update failed');
    }

    return response.json();
  }

  // ============ Search ============

  /**
   * Search for files
   */
  async searchFiles(query) {
    const result = await this.request(`/me/drive/root/search(q='${encodeURIComponent(query)}')`);
    return result.value || [];
  }

  // ============ Preview & Embed ============

  /**
   * Get preview/embed URL for a file
   */
  async getPreviewUrl(fileId) {
    try {
      const result = await this.request(`/me/drive/items/${fileId}/preview`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      return result.getUrl;
    } catch (error) {
      console.error('Error getting preview URL:', error);
      return null;
    }
  }

  /**
   * Get sharing link for a file
   */
  async createSharingLink(fileId, type = 'view') {
    const result = await this.request(`/me/drive/items/${fileId}/createLink`, {
      method: 'POST',
      body: JSON.stringify({
        type: type, // 'view' or 'edit'
        scope: 'organization', // or 'anonymous' for anyone with link
      }),
    });
    return result.link;
  }

  // ============ CRM-Specific Methods ============

  /**
   * Initialize CRM folder structure
   * Mirrors your current Google Drive structure
   */
  async initializeCrmStructure() {
    const rootFolder = await this.getOrCreateRootFolder();

    // Create subfolders
    const folders = [
      'BYD Customers Data',
      'Document Templates',
      'BYD CRM - Form Templates',
      'BYD CRM - Excel Master Files',
    ];

    const folderIds = { root: rootFolder.id };

    for (const folderName of folders) {
      let folder = await this.findFolder(rootFolder.id, folderName);
      if (!folder) {
        folder = await this.createFolder(rootFolder.id, folderName);
      }
      folderIds[folderName] = folder.id;
    }

    return folderIds;
  }

  /**
   * Save customer index (equivalent to customers_index.json)
   */
  async saveCustomerIndex(folderId, indexData) {
    return this.uploadFile(folderId, 'customers_index.json', indexData);
  }

  /**
   * Load customer index
   */
  async loadCustomerIndex(folderId) {
    const items = await this.listFolder(folderId);
    const indexFile = items.find(item => item.name === 'customers_index.json');

    if (!indexFile) {
      return { customers: [] };
    }

    return this.downloadFileAsJson(indexFile.id);
  }

  /**
   * Create customer folder and save customer data
   */
  async saveCustomer(customersFolderId, customer) {
    // Create folder for customer
    let customerFolder = await this.findFolder(customersFolderId, customer.id);
    if (!customerFolder) {
      customerFolder = await this.createFolder(customersFolderId, customer.id);
    }

    // Save customer.json
    await this.uploadFile(customerFolder.id, 'customer.json', customer);

    return customerFolder;
  }

  /**
   * Load customer data
   */
  async loadCustomer(customerFolderId) {
    const items = await this.listFolder(customerFolderId);
    const customerFile = items.find(item => item.name === 'customer.json');

    if (!customerFile) {
      return null;
    }

    return this.downloadFileAsJson(customerFile.id);
  }
}

export const oneDriveService = new OneDriveService();
export default oneDriveService;
```

### Step 4.5: Update Document Viewer for OneDrive

Update `src/components/DocumentViewer.jsx` to support OneDrive:

```javascript
// Add to existing imports
import oneDriveService from '../services/oneDriveService';

// Update getEmbedUrl function
const getEmbedUrl = async () => {
  if (useOneDrive) {
    // OneDrive preview
    return await oneDriveService.getPreviewUrl(document.id);
  } else {
    // Google Drive preview (existing)
    return `https://drive.google.com/file/d/${document.id}/preview`;
  }
};

// Update loadImageFile function
const loadImageFile = async () => {
  try {
    let blob;

    if (useOneDrive) {
      blob = await oneDriveService.downloadFileAsBlob(document.id);
    } else {
      // Existing Google Drive code
      const token = window.gapi.auth.getToken();
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${document.id}?alt=media`,
        { headers: { Authorization: `Bearer ${token.access_token}` } }
      );
      blob = await response.blob();
    }

    const url = URL.createObjectURL(blob);
    setImageUrl(url);
  } catch (err) {
    setError('Unable to load image preview');
  }
};
```

---

## Part 5: Data Migration

### Step 5.1: Export Data from Google Drive

Run this in your browser console while signed into your CRM:

```javascript
// Export all customer data
const exportData = async () => {
  const customerStore = useCustomerStore.getState();
  const documentStore = useDocumentStore.getState();
  const excelStore = useExcelStore.getState();

  const exportData = {
    customers: customerStore.customers,
    documentTemplates: documentStore.templates,
    excelTemplates: excelStore.templates,
    exportDate: new Date().toISOString(),
  };

  // Download as JSON file
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'byd-crm-backup.json';
  a.click();
};

exportData();
```

### Step 5.2: Import Data to OneDrive

Create an import function in your CRM:

```javascript
// Add to your app
const importToOneDrive = async (backupFile) => {
  const data = JSON.parse(await backupFile.text());

  // Initialize OneDrive structure
  const folderIds = await oneDriveService.initializeCrmStructure();

  // Import customers
  for (const customer of data.customers) {
    await oneDriveService.saveCustomer(folderIds['BYD Customers Data'], customer);
  }

  // Save customer index
  const index = {
    customers: data.customers.map(c => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      lastModified: c.lastModified,
    })),
  };
  await oneDriveService.saveCustomerIndex(folderIds.root, index);

  // Import templates...
  // (Add similar logic for document and excel templates)

  console.log('Migration complete!');
};
```

---

## Part 6: Testing Checklist

### Before Going Live

- [ ] All 10 users can sign in
- [ ] Users can view their OneDrive files in Windows Explorer
- [ ] CRM can create/read/update customer data
- [ ] Document preview works (PDFs, images)
- [ ] Excel files open directly in Excel (no download)
- [ ] Form templates render correctly
- [ ] Data persists after browser close

### Test Each User Role

- [ ] Admin can see all data
- [ ] Sales consultants can only see assigned customers
- [ ] Managers can see team data

---

## Part 7: Rollback Plan

Keep your Google Drive integration code in place for 30 days. Add a feature flag:

```javascript
// src/config/appConfig.js
export const USE_ONEDRIVE = true; // Set to false to rollback

// In your services
import { USE_ONEDRIVE } from '../config/appConfig';

const driveService = USE_ONEDRIVE ? oneDriveService : googleDriveService;
```

---

## Quick Reference: API Comparison

| Operation | Google Drive | OneDrive (Graph API) |
|-----------|-------------|---------------------|
| List files | `gapi.client.drive.files.list()` | `GET /me/drive/items/{id}/children` |
| Upload file | `gapi.client.drive.files.create()` | `PUT /me/drive/items/{id}:/{name}:/content` |
| Download | `GET /files/{id}?alt=media` | `GET /me/drive/items/{id}/content` |
| Create folder | `files.create` with folder mimeType | `POST /children` with `folder: {}` |
| Delete | `files.delete` | `DELETE /me/drive/items/{id}` |
| Preview | `/file/d/{id}/preview` | `POST /me/drive/items/{id}/preview` |

---

## Support Resources

- [Microsoft Graph Explorer](https://developer.microsoft.com/graph/graph-explorer) - Test API calls
- [MSAL.js Documentation](https://github.com/AzureAD/microsoft-authentication-library-for-js)
- [OneDrive API Reference](https://docs.microsoft.com/graph/api/resources/onedrive)
- [Azure Portal](https://portal.azure.com)

---

## Estimated Timeline

| Phase | Tasks | Duration |
|-------|-------|----------|
| **Setup** | Azure AD, users, app registration | 1-2 hours |
| **Code** | Auth service, OneDrive service | 1-2 days |
| **Integration** | Update components, stores | 1-2 days |
| **Migration** | Export/import data | 2-4 hours |
| **Testing** | All users, all features | 1 day |
| **Total** | | **3-5 days** |
