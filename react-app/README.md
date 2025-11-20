# BYD CRM - React Version

This is the modern React version of the BYD MotorEast CRM system, built alongside the existing vanilla JavaScript application.

## Features

### ✅ Currently Implemented
- Customer list with search/filter
- Customer details view
- Responsive layout
- State management with Zustand
- LocalStorage integration
- Shared configuration with vanilla JS app

### 🚧 In Development
- Add/Edit customer modal
- Google Drive authentication
- Forms management
- Excel integration
- Document scanner
- Offline sync queue

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
react-app/
├── src/
│   ├── components/          # React components
│   │   ├── Layout/         # Main layout wrapper
│   │   ├── Header/         # Top navigation bar
│   │   ├── Dashboard/      # Main dashboard view
│   │   ├── CustomerList/   # Customer list sidebar
│   │   └── CustomerDetails/# Customer details panel
│   ├── stores/             # Zustand state stores
│   │   ├── useCustomerStore.js
│   │   └── useAuthStore.js
│   ├── hooks/              # Custom React hooks
│   ├── services/           # API services
│   ├── utils/              # Utility functions
│   ├── App.jsx             # Main app component
│   └── main.jsx            # Entry point
├── package.json
├── vite.config.js
└── README.md
```

## Technology Stack

- **React 19** - UI framework
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **Zustand** - State management
- **CSS Modules** - Component-scoped styling

## Data Sharing

This React app shares data with the vanilla JS version through:

1. **LocalStorage**: Customer data, settings, form mappings
2. **Google Drive**: Files, templates, synced data
3. **Shared Config**: `../shared/config.js` for constants

Any changes made in one app will be reflected in the other after a refresh.

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

### Styling
- Component-specific CSS in same folder
- Use semantic class names
- Follow BEM-like naming: `.component-name__element--modifier`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Browser Support

- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)

## Contributing

1. Create feature branch from `main`
2. Make changes
3. Test in both React and vanilla JS versions
4. Ensure data compatibility
5. Submit pull request

## License

MIT
