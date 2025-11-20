# React Migration Strategy - Dual-App Approach

## Overview
This plan ensures you can continue using the current vanilla JS app while we incrementally build the React version alongside it.

## Directory Structure

```
BYD-CRM/
├── index.html                    # Current vanilla JS app (UNCHANGED)
├── src/                          # Current vanilla JS source (UNCHANGED)
│   ├── scripts/
│   └── styles/
├── react-app/                    # NEW: React application
│   ├── src/
│   │   ├── components/          # React components
│   │   ├── hooks/               # Custom React hooks
│   │   ├── services/            # API services (Google Drive, etc.)
│   │   ├── stores/              # State management (Context/Zustand)
│   │   ├── utils/               # Shared utilities
│   │   └── App.jsx              # Main React app
│   ├── package.json
│   └── vite.config.js
└── shared/                       # NEW: Shared configuration
    └── config.js                 # Google Drive Client ID, constants
```

## Running Both Apps

### Vanilla JS App (Current)
- **URL**: `http://localhost:8000`
- **Command**: `npm run dev` (Python server)
- **Status**: Fully functional, no changes

### React App (New)
- **URL**: `http://localhost:5173` (Vite default)
- **Command**: `cd react-app && npm run dev`
- **Status**: Incrementally built

## Migration Phases

### Phase 1: Setup (Today)
- ✅ Create React app with Vite
- ✅ Set up TypeScript (optional but recommended)
- ✅ Configure routing
- ✅ Add link in vanilla app to try React version
- ✅ Set up shared config

### Phase 2: Core Infrastructure (Week 1)
- Implement Google Drive authentication
- Set up state management (Context API or Zustand)
- Create base layout and navigation
- Migrate customer data structure

### Phase 3: Component Migration (Week 2-3)
Priority order:
1. **Modal System** - Reusable modal component
2. **Customer List** - Display and search
3. **Customer Details** - View customer info
4. **Add/Edit Customer** - Forms with validation
5. **Statistics** - Dashboard stats

### Phase 4: Advanced Features (Week 3-4)
6. **Forms Management** - Template upload/management
7. **Field Mapping** - Canvas-based field positioning
8. **Excel Integration** - Template population
9. **Document Scanner** - Camera integration
10. **Sync Queue** - Offline support

### Phase 5: Testing & Deployment
- E2E testing
- Performance optimization
- Feature parity check
- User acceptance testing

## Toggle Mechanism

We'll add a simple banner to the current app:

```html
<!-- In current index.html -->
<div style="background: #2196f3; color: white; padding: 10px; text-align: center;">
  🚀 Try our new React version! <a href="http://localhost:5173" style="color: white; text-decoration: underline;">Click here</a>
  <small>(Your data is shared between both versions)</small>
</div>
```

## Data Sharing Strategy

Both apps will share:
1. **localStorage** - Customer data, settings, auth tokens
2. **Google Drive** - Forms, Excel templates, customer files
3. **Configuration** - Shared config.js for Google Client ID

This ensures seamless switching between apps without data loss.

## Rollback Plan

If anything goes wrong:
1. The vanilla JS app remains untouched
2. Simply don't visit the React app URL
3. Delete `/react-app` directory if needed
4. No impact on existing functionality

## Benefits of This Approach

✅ **Zero Risk** - Original app stays intact
✅ **Incremental** - Build and test piece by piece
✅ **Parallel Testing** - Compare features side-by-side
✅ **Easy Rollback** - Just use the old app
✅ **Data Continuity** - Shared data layer
✅ **Gradual Adoption** - Switch when comfortable

## Technology Stack (React App)

- **Framework**: React 18
- **Build Tool**: Vite (fast, modern)
- **Language**: JavaScript (or TypeScript)
- **State Management**: Context API + useReducer (or Zustand for advanced)
- **Routing**: React Router v6
- **Styling**: CSS Modules or existing CSS
- **Testing**: Vitest + React Testing Library

## Next Steps

1. Initialize React app with Vite
2. Set up basic routing and layout
3. Add toggle link to vanilla app
4. Migrate simplest component first (Statistics modal)
5. Iterate and expand

---

**Estimated Timeline**: 2-3 weeks for full feature parity
**Effort**: Can pause/resume anytime without disruption
**Impact on Current App**: None - completely isolated
