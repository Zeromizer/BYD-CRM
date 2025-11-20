# BYD CRM Setup Guide

This project contains two versions of the BYD CRM application:
- **Classic Version**: Vanilla JavaScript (main `index.html`)
- **React Version**: Modern React app (built to `/react/`)

## Quick Start

### 1. Install Dependencies (First Time Only)

```bash
# Install React app dependencies
cd react-app
npm install
cd ..
```

### 2. Build the React App

From the project root:

```bash
npm run build:react
```

This builds the React app to the `/react/` folder.

### 3. Start the Server

```bash
npm run dev
```

or

```bash
npm start
```

This starts a Python HTTP server on port 8000.

### 4. Access the Apps

Open your browser and navigate to:

- **Classic Version**: http://localhost:8000 or http://localhost:8000/index.html
- **React Version**: http://localhost:8000/react/

You can also click the banner at the top of the Classic version to switch to React.

## Development Workflow

### Working on the Classic (Vanilla JS) Version

1. Start the server: `npm run dev`
2. Edit files in `/src/`
3. Refresh browser to see changes

### Working on the React Version

#### Option A: Production Build (Recommended for GitHub)

1. Make changes in `/react-app/src/`
2. Rebuild: `npm run build:react`
3. Refresh browser at http://localhost:8000/react/

#### Option B: Development Mode (Recommended for Local Development)

1. Open a new terminal
2. Navigate to react-app: `cd react-app`
3. Start dev server: `npm run dev`
4. Access at http://localhost:5173 (with hot reload)

## File Structure

```
BYD-CRM/
├── index.html              # Classic app entry
├── src/                    # Classic app source
│   ├── scripts/
│   └── styles/
├── react-app/              # React app source
│   ├── src/
│   ├── package.json
│   └── vite.config.js
├── react/                  # React build output (auto-generated)
│   └── index.html
├── shared/                 # Shared config between both apps
│   └── config.js
├── package.json            # Root scripts
└── README.md
```

## Scripts

### Root Level (`package.json`)

- `npm run dev` - Start Python server (serves both apps)
- `npm start` - Alias for `npm run dev`
- `npm run build:react` - Build React app to `/react/`

### React App (`react-app/package.json`)

- `npm run dev` - Start Vite dev server with hot reload
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Data Persistence

Both apps share data through:
- **localStorage**: Customers, settings, form mappings
- **Google Drive**: Files, templates, synced data

Changes made in one app will appear in the other after a refresh.

## Troubleshooting

### React app shows blank page

1. Check that you've built the React app: `npm run build:react`
2. Verify `/react/` folder exists with `index.html`
3. Clear browser cache and hard refresh (Ctrl+Shift+R)

### "Module not found" errors

```bash
cd react-app
npm install
npm run build
```

### Port 8000 already in use

```bash
# Find and kill the process
lsof -ti:8000 | xargs kill -9

# Or use a different port
python3 -m http.server 3000
```

### Changes not appearing in React app

- If using production build: Run `npm run build:react` after making changes
- If using dev mode: Changes should auto-reload
- Check browser console for errors

## Deploying to GitHub Pages or Production

1. Build the React app: `npm run build:react`
2. Commit all changes including `/react/` folder
3. Push to your repository
4. Configure your hosting to serve:
   - Root: Classic app
   - `/react/`: React app

## Need Help?

- See `REACT_MIGRATION_GUIDE.md` for detailed React migration info
- See `REACT_MIGRATION_PLAN.md` for the overall strategy
- Check `react-app/README.md` for React-specific documentation
