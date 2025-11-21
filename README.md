# BYD CRM - React Application

Modern React-based Customer Relationship Management system for BYD MotorEast.

## Features

### ✅ Fully Implemented
- **Customer Management**: Full CRUD operations with search/filter
- **Google Drive Integration**: OAuth 2.0 authentication and file storage
- **Forms Management**: Upload PDF/image forms, configure field mappings
- **Excel Integration**: Create templates, map fields to cells, populate with customer data
- **Field Mapping UI**: Interactive canvas-based field positioning for image forms
- **Excel Population**: Generate Excel files with customer data, auto-save to organized Drive folders
- **Form Rendering**: Overlay customer data on image forms for printing
- **Combine & Print**: Double-sided printing by combining two forms
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **State Management**: Zustand for efficient global state
- **LocalStorage Persistence**: Data persists across sessions

## Quick Start

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```
Opens at http://localhost:5173

### Build for Production
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

## Project Structure

```
BYD-CRM/
├── src/
│   ├── components/              # React components
│   │   ├── Layout/             # Main layout wrapper
│   │   ├── Header/             # Top navigation bar
│   │   ├── Dashboard/          # Main dashboard view
│   │   ├── CustomerList/       # Customer list sidebar
│   │   ├── CustomerDetails/    # Customer details panel
│   │   ├── CustomerForm/       # Add/Edit customer form
│   │   ├── Modal/              # Reusable modal component
│   │   ├── FormsManagement/    # Form templates management
│   │   ├── ExcelIntegration/   # Excel templates management
│   │   ├── FieldMappingModal/  # Canvas-based field mapper
│   │   ├── ExcelPopulateModal/ # Excel population interface
│   │   ├── FormPrintModal/     # Form printing interface
│   │   └── CombinePrintModal/  # Double-sided print interface
│   ├── stores/                  # Zustand state stores
│   │   ├── useCustomerStore.js
│   │   ├── useAuthStore.js
│   │   ├── useFormsStore.js
│   │   └── useExcelStore.js
│   ├── services/                # Business logic services
│   │   ├── excelService.js
│   │   └── formService.js
│   ├── App.jsx                  # Main app component
│   └── main.jsx                 # Entry point
├── dist/                        # Production build (committed for GitHub Pages)
├── public/                      # Static assets
├── package.json
├── vite.config.js
└── README.md
```

## Technology Stack

- **React 19** - Modern UI framework with latest features
- **Vite 7** - Lightning-fast build tool and dev server
- **React Router 7** - Client-side routing
- **Zustand 5** - Lightweight state management
- **Google Drive API v3** - Cloud storage integration
- **xlsx-populate** - Excel file generation with formatting preservation
- **HTML5 Canvas** - Image manipulation and form rendering

## Data Storage

### LocalStorage
- Customer data (`bydCRM`)
- Form templates metadata (`formTemplates`)
- Excel templates metadata (`excelTemplates`)

### Google Drive
- **Form Templates**: Stored in "BYD CRM - Form Templates" folder
- **Excel Templates**: Stored in "BYD CRM - Excel Master Files" folder
- **Customer Files**: Organized folder structure per customer:
  ```
  BYD CRM - Customer Files/
  └── [Customer Name] ([Customer ID])/
      ├── VSA/
      ├── Trade In/
      ├── Test Drive/
      ├── PDPA & COE/
      └── Other/
  ```

## Key Workflows

### Adding a Customer
1. Click "Add Customer" in header
2. Fill in customer details
3. Data saved to localStorage and synced across sessions

### Mapping Form Fields
1. Go to Forms Management
2. Upload image form template
3. Click "Configure Fields"
4. Click on form image to place field markers
5. Select field type and customize font/color
6. Save mappings

### Generating Excel Files
1. Go to Excel Integration
2. Create template and map fields to cells (e.g., A1, B5)
3. Upload master Excel file to Drive
4. In Customer Details, click "Populate Excel"
5. Select template and generate
6. Auto-saves to customer's Drive folder

### Printing Forms
1. In Customer Details, click "Print Form"
2. Select form template
3. Preview rendered form with customer data
4. Print or download as JPEG

### Double-Sided Printing
1. In Customer Details, click "Combine & Print"
2. Select front and back forms
3. Preview both pages
4. Print double-sided

## Development Guidelines

### Component Structure
```jsx
// ComponentName/ComponentName.jsx
import './ComponentName.css';

function ComponentName({ prop1, prop2 }) {
  return (
    <div className="component-name">
      {/* Component content */}
    </div>
  );
}

export default ComponentName;
```

### State Management
Use Zustand stores for global state:

```jsx
import useCustomerStore from '../../stores/useCustomerStore';

function MyComponent() {
  const { customers, addCustomer } = useCustomerStore();

  return (
    // Component JSX
  );
}
```

### Google Drive Integration
```jsx
import useAuthStore from '../../stores/useAuthStore';

function MyComponent() {
  const { isSignedIn, handleSignIn, getAccessToken } = useAuthStore();

  const uploadFile = async () => {
    if (!isSignedIn) {
      await handleSignIn();
    }
    const token = getAccessToken();
    // Use token for Drive API calls
  };
}
```

### Styling
- Component-specific CSS in same folder
- Use semantic class names
- Follow BEM-like naming: `.component-name__element--modifier`
- Responsive design with mobile-first approach

## Available Scripts

- `npm run dev` - Start development server (port 5173)
- `npm run build` - Build for production (outputs to `dist/`)
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Deployment

### GitHub Pages

The `dist/` folder is committed to the repository for GitHub Pages deployment.

1. Build the app: `npm run build`
2. Commit the `dist/` folder
3. Push to GitHub
4. Enable GitHub Pages in repository settings
5. Set source to root `/` and select main branch

### Environment Variables

No environment variables needed. Google OAuth credentials are configured in-app:
- Client ID: `565047387986-d61n6b2aenll8dsjcdhjr85u1a1ck5ec.apps.googleusercontent.com`
- API Key: `AIzaSyCJ6vqWOgQDXpYg09UkfzpbEPAb7WLPxlU`

## Browser Support

- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Mobile Safari (iOS 14+)
- Chrome Mobile (Android 10+)

## Contributing

1. Create feature branch from `main`
2. Make changes and test thoroughly
3. Build and verify production bundle
4. Submit pull request with detailed description

## License

MIT

## Support

For issues or questions, please contact the BYD MotorEast development team.
