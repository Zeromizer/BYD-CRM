# Deployment Guide

## GitHub Pages Deployment

This project is deployed to GitHub Pages and uses an automated build process.

### How It Works

1. **Source files** are in the repository root
   - `index.html` points to `/src/main.jsx` for development
   - Vite uses this for dev server

2. **Build process** (`npm run build`):
   - Vite builds to `dist/` folder
   - `dist/index.html` references `/BYD-CRM/assets/[hash].js`
   - Post-build script automatically:
     - Copies `dist/index.html` → root `index.html`
     - Copies `dist/assets/*` → root `assets/`

3. **GitHub Pages** serves from repository root
   - index.html loads assets from `/BYD-CRM/assets/`
   - All files are in the correct location

### Building for Production

```bash
npm run build
```

This single command:
- ✓ Builds the app with Vite
- ✓ Copies files to correct locations for GitHub Pages
- ✓ Everything is ready to commit and push

### Deployment Steps

1. Make your code changes
2. Run `npm run build`
3. Commit changes: `git add . && git commit -m "Your message"`
4. Push to your branch
5. Create/merge PR to main
6. GitHub Pages will automatically deploy from main branch

### Important Files

- `scripts/post-build.js` - Automated post-build script
- `package.json` - Build command includes post-build step
- `vite.config.js` - Vite configuration with base path `/BYD-CRM/`
- `.gitignore` - Ensures dist/ and assets/ are committed

### Troubleshooting

**404 errors for assets:**
- Make sure you ran `npm run build` (not just `vite build`)
- Verify `assets/` folder exists in repository root
- Check that `index.html` in root references correct asset hashes

**Development issues:**
- Use `npm run dev` for local development
- Source `index.html` points to `/src/main.jsx` - don't change this
- Built `index.html` is automatically generated and copied

### Why This Setup?

GitHub Pages serves from the repository root, but Vite builds to `dist/`. The automated post-build script ensures built files are in the correct location without manual copying, preventing deployment issues.
