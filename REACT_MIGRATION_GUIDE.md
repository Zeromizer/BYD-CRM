# React Migration Guide - How to Use Both Versions

## Quick Start

### Running the Vanilla JS App (Current/Classic)
```bash
# From project root
npm run dev
```
- **URL**: http://localhost:8000
- **Status**: Fully functional
- **Use this**: For production work until React version is complete

### Running the React App (New/Preview)
```bash
# From project root
cd react-app
npm run dev
```
- **URL**: http://localhost:5173
- **Status**: Work in progress
- **Use this**: To preview new React features

### Running Both Simultaneously
You can run both apps at the same time in different terminals:

**Terminal 1** (Vanilla JS):
```bash
npm run dev
```

**Terminal 2** (React):
```bash
cd react-app && npm run dev
```

Then you can switch between:
- http://localhost:8000 (Classic version)
- http://localhost:5173 (React version)

## What's Currently Working in React Version

### ✅ Completed Features
1. **Basic Layout & Navigation**
   - Header with app title
   - Google Drive connection status indicator
   - Dropdown menu with options
   - Responsive design

2. **Customer List**
   - Display all customers
   - Search/filter customers by name, phone, or email
   - Select customer to view details
   - Empty state when no customers exist

3. **Customer Details View**
   - View selected customer information
   - Contact information display
   - Additional information (occupation, sales consultant, VSA no)
   - Address display
   - Notes display

4. **State Management**
   - Zustand store for customer data
   - Zustand store for authentication state
   - LocalStorage integration for data persistence

5. **Shared Configuration**
   - `/shared/config.js` contains constants used by both apps
   - Google Drive API configuration
   - BYD car models and colors
   - Form types and labels

### 🚧 Work in Progress
1. **Add/Edit Customer** - Modal UI pending
2. **Google Drive Authentication** - Integration pending
3. **Forms Management** - Full feature pending
4. **Excel Integration** - Full feature pending
5. **Document Scanner** - Camera integration pending
6. **Sync Queue** - Offline support pending

## Data Sharing Between Apps

Both apps share data through:

### 1. LocalStorage
The following keys are shared:
- `customers` - Customer data array
- `formsMetadata` - Form templates metadata
- `excelTemplates` - Excel templates metadata
- `fieldMappings` - Form field mappings
- `excelFieldMappings` - Excel field mappings
- `rootFolderId` - Google Drive root folder ID
- `formsFolderId` - Google Drive forms folder ID
- `excelTemplatesFolderId` - Google Drive Excel folder ID
- `dataFileId` - Google Drive data file ID
- `formsDataFileId` - Google Drive forms data file ID
- `excelDataFileId` - Google Drive Excel data file ID

### 2. Google Drive
- Both apps use the same Google Drive Client ID
- Both apps access the same folders and files
- Changes in one app sync to Drive and appear in the other

## Development Workflow

### Adding Features to React App

1. **Create Components**
   ```
   react-app/src/components/YourComponent/
   ├── YourComponent.jsx
   └── YourComponent.css
   ```

2. **Create Services** (for API calls)
   ```
   react-app/src/services/
   └── driveService.js
   ```

3. **Create Hooks** (for reusable logic)
   ```
   react-app/src/hooks/
   └── useCustomers.js
   ```

4. **Update Stores** (for state management)
   ```
   react-app/src/stores/
   └── useCustomerStore.js
   ```

### Testing Changes

1. **Test in React app first**
   ```bash
   cd react-app
   npm run dev
   ```

2. **Verify localStorage compatibility**
   - Open DevTools → Application → Local Storage
   - Check that data format matches vanilla JS app

3. **Test switching between apps**
   - Add a customer in React version
   - Refresh vanilla JS version
   - Verify customer appears

### Building React App for Production

```bash
cd react-app
npm run build
```

This creates a `dist/` folder with optimized production files.

## Project Structure

```
BYD-CRM/
├── index.html                    # Vanilla JS app entry point
├── src/                          # Vanilla JS source
│   ├── scripts/
│   │   ├── config.js            # Original config (being phased out)
│   │   ├── app.js
│   │   ├── modules/
│   │   │   ├── auth.js
│   │   │   ├── customers.js
│   │   │   ├── drive.js
│   │   │   ├── excel.js
│   │   │   ├── forms.js
│   │   │   ├── ui.js
│   │   │   ├── syncQueue.js
│   │   │   └── documentScanner.js
│   │   └── utils/
│   │       └── utils.js
│   └── styles/
│       └── main.css
├── shared/                       # NEW: Shared between both apps
│   └── config.js                # Shared configuration constants
├── react-app/                    # NEW: React application
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout/
│   │   │   │   ├── Layout.jsx
│   │   │   │   └── Layout.css
│   │   │   ├── Header/
│   │   │   │   ├── Header.jsx
│   │   │   │   └── Header.css
│   │   │   ├── Dashboard/
│   │   │   │   ├── Dashboard.jsx
│   │   │   │   └── Dashboard.css
│   │   │   ├── CustomerList/
│   │   │   │   ├── CustomerList.jsx
│   │   │   │   └── CustomerList.css
│   │   │   └── CustomerDetails/
│   │   │       ├── CustomerDetails.jsx
│   │   │       └── CustomerDetails.css
│   │   ├── hooks/               # Custom React hooks
│   │   ├── services/            # API services (Drive, etc.)
│   │   ├── stores/              # State management
│   │   │   ├── useCustomerStore.js
│   │   │   └── useAuthStore.js
│   │   ├── utils/               # Utility functions
│   │   ├── App.jsx              # Main React component
│   │   ├── App.css
│   │   ├── main.jsx             # React entry point
│   │   └── index.css
│   ├── package.json
│   └── vite.config.js
├── package.json                  # Root package.json (vanilla JS)
├── REACT_MIGRATION_PLAN.md      # Migration strategy document
└── REACT_MIGRATION_GUIDE.md     # This file
```

## Common Tasks

### Add a New Customer (Vanilla JS App)
1. Click "+ Add Customer"
2. Fill in the form
3. Click "Add Customer"
4. Customer is saved to localStorage and synced to Drive

### View Customer in React App
1. Refresh React app
2. Customer appears in the list automatically (from localStorage)

### Switch Between Apps
- Click the banner link in vanilla JS app to open React version
- Click "Switch to Classic Version" in React app dropdown menu

## Troubleshooting

### React app won't start
```bash
cd react-app
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Data not appearing in React app
1. Check browser console for errors
2. Verify localStorage has data:
   - Open DevTools → Application → Local Storage
   - Look for `customers` key
3. Check the data format matches expected structure

### Both apps running on same port
- Vanilla JS uses port 8000
- React uses port 5173
- They should never conflict
- If port 5173 is busy, Vite will ask to use 5174

### Changes not reflecting
- Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
- Clear browser cache
- Check you're editing the correct app's files

## Next Steps

### For Developers

1. **Implement Add Customer Modal**
   - Create Modal component
   - Create CustomerForm component
   - Wire up to useCustomerStore

2. **Implement Google Drive Auth**
   - Create authService.js
   - Integrate with useAuthStore
   - Add token refresh logic

3. **Implement Sync Functionality**
   - Port syncQueue logic to React
   - Create syncService.js
   - Add sync indicators in UI

4. **Implement Forms Management**
   - Port forms.js logic to React
   - Create Forms components
   - Add field mapping canvas

### For Users

1. **Continue using vanilla JS app** for production work
2. **Periodically check React app** to see new features
3. **Report issues** if you notice data inconsistencies
4. **Provide feedback** on the React UI/UX

## Migration Timeline

- **Week 1-2**: Core features (customer CRUD, auth, sync)
- **Week 3**: Forms management
- **Week 4**: Excel integration
- **Week 5**: Document scanner, testing
- **Week 6**: Feature parity, production deployment

## Questions?

See `REACT_MIGRATION_PLAN.md` for detailed technical strategy.

---

**Last Updated**: 2024-11-20
