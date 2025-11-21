# Deploying React App to BYD-CRM-REACT Repository

This guide explains how to deploy the React version of BYD CRM to the separate `BYD-CRM-REACT` repository on GitHub Pages.

## Prerequisites

- GitHub repository `BYD-CRM-REACT` created
- GitHub Pages enabled on the repository

## Step 1: Build the React App

From the BYD-CRM directory:

```bash
cd react-app
npm install
npm run build
```

This creates a `dist/` folder with the production build.

## Step 2: Prepare the Deployment

The `dist/` folder contains everything needed for the React app:

```
react-app/dist/
├── index.html
├── vite.svg
└── assets/
    ├── index-*.js
    └── index-*.css
```

## Step 3: Deploy to BYD-CRM-REACT Repository

### Option A: Using Git Commands

```bash
# Navigate to the dist folder
cd dist

# Initialize git (if not already initialized)
git init

# Add all files
git add .

# Commit
git commit -m "Deploy React CRM app"

# Add remote (replace with your repo URL)
git remote add origin https://github.com/Zeromizer/BYD-CRM-REACT.git

# Push to main branch
git branch -M main
git push -u origin main
```

### Option B: Manual Upload

1. Go to https://github.com/Zeromizer/BYD-CRM-REACT
2. Click "Add file" → "Upload files"
3. Drag all files from `react-app/dist/` folder
4. Commit the upload

## Step 4: Configure GitHub Pages

1. Go to repository Settings → Pages
2. Source: Deploy from branch
3. Branch: `main` / root
4. Click Save

## Step 5: Access the App

After a few minutes, your React app will be live at:

**https://zeromizer.github.io/BYD-CRM-REACT/**

## How It Works

### Data Sharing

Both apps (vanilla JS and React) share data through:

1. **localStorage** with key `bydCRM`
   - Customer data
   - Settings
   - Form mappings

2. **Google Drive** (when connected)
   - Synced customer data
   - Form templates
   - Excel templates

### Authentication Sharing

Both apps share Google Drive authentication:
- localStorage keys: `googleAccessToken`, `googleTokenExpiry`
- Sign in to one app → automatically signed in to the other

### Link from Classic App

The vanilla JS app (BYD-CRM) has a banner link that opens the React version:

```html
<a href="https://zeromizer.github.io/BYD-CRM-REACT/" target="_blank">
  Click here to preview
</a>
```

## Updating the React App

Whenever you make changes to the React app:

1. **Make your changes** in `react-app/src/`

2. **Rebuild**:
   ```bash
   cd react-app
   npm run build
   ```

3. **Deploy updated files**:
   ```bash
   cd dist
   git add .
   git commit -m "Update: [describe your changes]"
   git push
   ```

4. **Wait for GitHub Pages** to rebuild (usually 1-2 minutes)

## Project Structure

```
BYD-CRM/                          # Main repository (vanilla JS)
├── index.html                    # Classic version
├── src/                          # Classic source
├── react-app/                    # React source code
│   ├── src/                      # React components, stores, services
│   ├── dist/                     # Build output (deploy this!)
│   └── package.json
└── DEPLOY_REACT_REPO.md         # This file

BYD-CRM-REACT/                    # Separate repository (React only)
├── index.html                    # From react-app/dist/
├── vite.svg
└── assets/                       # From react-app/dist/assets/
    ├── index-*.js
    └── index-*.css
```

## Troubleshooting

### App shows blank page

1. Check browser console for errors
2. Verify all files uploaded correctly
3. Make sure GitHub Pages is enabled
4. Check that index.html is in the root of the repo

### 404 errors for assets

1. Verify `assets/` folder is uploaded
2. Check that base path in vite.config.js is set to '/'
3. Clear browser cache and hard refresh

### Data not syncing between apps

1. Both apps must use same localStorage domain (github.io)
2. Check browser console in both apps
3. Verify localStorage key is `bydCRM`

### Changes not appearing

1. Make sure you rebuilt: `npm run build`
2. Deployed the `dist/` folder (not `src/`)
3. Wait for GitHub Pages to rebuild
4. Clear browser cache

## Automated Deployment (Optional)

You can set up GitHub Actions to auto-deploy on push. Create `.github/workflows/deploy.yml` in BYD-CRM:

```yaml
name: Deploy React to BYD-CRM-REACT

on:
  push:
    paths:
      - 'react-app/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Build
        run: |
          cd react-app
          npm install
          npm run build

      - name: Deploy
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./react-app/dist
          external_repository: Zeromizer/BYD-CRM-REACT
          publish_branch: main
```

This automatically deploys to BYD-CRM-REACT whenever you push changes to `react-app/`.

## Support

For issues or questions:
- Check browser console for errors
- Review SETUP.md for general setup
- Review REACT_MIGRATION_GUIDE.md for migration details
