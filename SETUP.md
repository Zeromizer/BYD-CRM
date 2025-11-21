# BYD CRM Setup Guide

## Prerequisites

- Node.js 18+ and npm
- Modern web browser (Chrome, Firefox, Safari, or Edge)
- Google account (for Drive integration)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

Access the app at **http://localhost:5173**

### 3. Build for Production

```bash
npm run build
```

The production build will be output to the `dist/` folder.

### 4. Preview Production Build

```bash
npm run preview
```

## Development Workflow

### Local Development

1. Make changes in `/src/` directory
2. Changes auto-reload in browser (hot module replacement)
3. Check browser console for any errors

### Testing Features

1. **Customer Management**: Click "Add Customer" to create test data
2. **Google Drive**: Click "Sign In" in header to authenticate
3. **Forms**: Navigate to Forms Management to upload templates
4. **Excel**: Navigate to Excel Integration to create templates

### Building for Production

1. Run `npm run build`
2. Verify build output in `dist/` folder
3. Test with `npm run preview`
4. Commit `dist/` folder for GitHub Pages deployment

## Configuration

### Google OAuth Setup

The app is pre-configured with Google OAuth credentials:
- **Client ID**: `565047387986-d61n6b2aenll8dsjcdhjr85u1a1ck5ec.apps.googleusercontent.com`
- **API Key**: `AIzaSyCJ6vqWOgQDXpYg09UkfzpbEPAb7WLPxlU`

If you need to use your own credentials:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google Drive API
4. Create OAuth 2.0 credentials
5. Update values in `src/stores/useAuthStore.js`

### Authorized Redirect URIs

For local development:
- `http://localhost:5173`

For production:
- Your GitHub Pages URL or custom domain

## File Structure

```
BYD-CRM/
├── src/                         # Source code
│   ├── components/              # React components
│   ├── stores/                  # Zustand state stores
│   ├── services/                # Business logic
│   ├── App.jsx                  # Main app component
│   └── main.jsx                 # Entry point
├── dist/                        # Production build (committed)
├── public/                      # Static assets
├── index.html                   # HTML template
├── package.json                 # Dependencies and scripts
├── vite.config.js              # Vite configuration
└── README.md                    # Documentation
```

## Data Storage

### LocalStorage

Data is stored in browser localStorage:
- `bydCRM`: Customer data
- `formTemplates`: Form template metadata
- `excelTemplates`: Excel template metadata

To clear all data:
```javascript
localStorage.clear()
```

### Google Drive

Files are organized in folders:
- **BYD CRM - Form Templates**: PDF/image form templates
- **BYD CRM - Excel Master Files**: Excel template files
- **BYD CRM - Customer Files**: Generated customer documents

## Troubleshooting

### Module Not Found Errors

```bash
rm -rf node_modules package-lock.json
npm install
```

### Build Errors

```bash
npm run lint
npm run build
```

Check console for specific error messages.

### Google Sign-In Issues

1. Check browser console for errors
2. Verify redirect URI matches in Google Console
3. Clear browser cache and cookies
4. Try incognito/private mode

### Port Already in Use

```bash
# Kill process on port 5173
lsof -ti:5173 | xargs kill -9

# Or use different port
npm run dev -- --port 3000
```

### LocalStorage Data Lost

LocalStorage is browser-specific. Data will be lost if:
- Browser cache is cleared
- Different browser is used
- Incognito mode is used

**Solution**: Export customer data or use Google Drive sync feature.

## Scripts Reference

- `npm run dev` - Start development server (port 5173)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Deploying to GitHub Pages

1. Build the app:
   ```bash
   npm run build
   ```

2. Commit all changes including `dist/`:
   ```bash
   git add .
   git commit -m "Build for production"
   git push
   ```

3. In GitHub repository settings:
   - Go to Pages
   - Select source: Deploy from a branch
   - Select branch: main
   - Select folder: / (root)
   - Save

4. Access at: `https://[username].github.io/[repo-name]/`

## Need Help?

- Check `README.md` for detailed documentation
- Review browser console for errors
- Check Network tab for failed API requests
- Contact BYD MotorEast development team

## License

MIT
