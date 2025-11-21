# Google OAuth Setup Guide for BYD CRM

This guide will help you create and configure Google OAuth credentials for the BYD CRM application.

## Prerequisites

- A Google account (can be personal or workspace)
- Access to Google Cloud Console
- Your GitHub Pages URL: `https://zeromizer.github.io/BYD-CRM/`

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top
3. Click **"NEW PROJECT"**
4. Enter project details:
   - **Project name**: `BYD CRM` (or any name you prefer)
   - **Organization**: Leave as default
5. Click **"CREATE"**
6. Wait for the project to be created (takes a few seconds)
7. Make sure the new project is selected in the dropdown

## Step 2: Enable Google Drive API

1. In the Google Cloud Console, go to **"APIs & Services"** → **"Library"**
   - Or use this direct link: https://console.cloud.google.com/apis/library
2. Search for **"Google Drive API"**
3. Click on **"Google Drive API"**
4. Click **"ENABLE"**
5. Wait for the API to be enabled

## Step 3: Configure OAuth Consent Screen

1. Go to **"APIs & Services"** → **"OAuth consent screen"**
   - Or use this direct link: https://console.cloud.google.com/apis/credentials/consent
2. Select **"External"** user type
3. Click **"CREATE"**

### App Information:
- **App name**: `BYD CRM`
- **User support email**: Your email address (e.g., `shawnlyc@gmail.com`)
- **App logo**: (Optional - you can skip this)
- **Application home page**: `https://zeromizer.github.io/BYD-CRM/`
- **Application privacy policy link**: (Optional - you can use the home page URL)
- **Application terms of service link**: (Optional - you can skip this)
- **Authorized domains**: Add `zeromizer.github.io`
- **Developer contact information**: Your email address

4. Click **"SAVE AND CONTINUE"**

### Scopes:
1. Click **"ADD OR REMOVE SCOPES"**
2. Search and select these scopes:
   - `.../auth/drive.file` - "See, edit, create, and delete only the specific Google Drive files you use with this app"
   - `.../auth/drive.appdata` - "See, create, and delete its own configuration data in your Google Drive"
3. Click **"UPDATE"**
4. Click **"SAVE AND CONTINUE"**

### Test Users:
1. Click **"ADD USERS"**
2. Add your email: `shawnlyc@gmail.com`
3. Add any other users who need access
4. Click **"ADD"**
5. Click **"SAVE AND CONTINUE"**

### Summary:
- Review your settings
- Click **"BACK TO DASHBOARD"**

## Step 4: Create OAuth Client ID

1. Go to **"APIs & Services"** → **"Credentials"**
   - Or use this direct link: https://console.cloud.google.com/apis/credentials
2. Click **"+ CREATE CREDENTIALS"** at the top
3. Select **"OAuth client ID"**

### Configure OAuth Client:
1. **Application type**: Select **"Web application"**
2. **Name**: `BYD CRM Web Client`
3. **Authorized JavaScript origins**:
   - Click **"+ ADD URI"**
   - Add: `https://zeromizer.github.io`
4. **Authorized redirect URIs**:
   - Click **"+ ADD URI"**
   - Add: `https://zeromizer.github.io/BYD-CRM/`
   - Add: `https://zeromizer.github.io` (optional backup)
5. Click **"CREATE"**

### Save Your Credentials:
A dialog will appear with your credentials:
- **Client ID**: Copy this (looks like: `xxxxx-xxxxx.apps.googleusercontent.com`)
- **Client secret**: You can ignore this (not needed for our app)

**IMPORTANT**: Keep this Client ID - you'll need it in the next step!

## Step 5: Create API Key

1. Still in **"APIs & Services"** → **"Credentials"**
2. Click **"+ CREATE CREDENTIALS"**
3. Select **"API key"**
4. Copy the **API key** that appears
5. Click **"RESTRICT KEY"** (recommended for security)

### Restrict the API Key (Recommended):
1. **Name**: `BYD CRM API Key`
2. **Application restrictions**:
   - Select **"HTTP referrers (web sites)"**
   - Click **"ADD AN ITEM"**
   - Add: `https://zeromizer.github.io/BYD-CRM/*`
3. **API restrictions**:
   - Select **"Restrict key"**
   - Select: **"Google Drive API"**
4. Click **"SAVE"**

## Step 6: Update BYD CRM Configuration

Now you need to update the app with your new credentials:

1. Open the file: `src/config/config.js`
2. Replace the values:

```javascript
export const CONFIG = {
  // Google OAuth 2.0 Client ID - REPLACE WITH YOUR CLIENT ID
  CLIENT_ID: 'YOUR-CLIENT-ID-HERE.apps.googleusercontent.com',

  // Google API Key - REPLACE WITH YOUR API KEY
  API_KEY: 'YOUR-API-KEY-HERE',

  // ... rest of the config stays the same
```

### How to Update:

**Option 1: Edit directly on GitHub**
1. Go to your repository: https://github.com/Zeromizer/BYD-CRM
2. Navigate to `src/config/config.js`
3. Click the pencil icon (Edit)
4. Replace `CLIENT_ID` and `API_KEY` with your values
5. Commit the changes
6. Wait for GitHub Pages to redeploy (~2 minutes)

**Option 2: Edit locally and push**
1. Clone your repository
2. Edit `src/config/config.js`
3. Replace the values
4. Run `npm run build`
5. Commit and push all changes
6. GitHub Pages will automatically redeploy

## Step 7: Test the Connection

1. Wait for GitHub Pages to redeploy (check: https://github.com/Zeromizer/BYD-CRM/actions)
2. Visit: https://zeromizer.github.io/BYD-CRM/
3. Click **"Sign In"** in the header
4. You should see a Google sign-in popup
5. Select your account (`shawnlyc@gmail.com`)
6. Click **"Allow"** to grant permissions
7. You should be signed in successfully!

## Troubleshooting

### Error: "Access blocked: Authorization Error"
- Make sure you added your email to Test Users in OAuth consent screen
- Verify the Client ID is correct in `config.js`
- Check that authorized domains include `zeromizer.github.io`

### Error: "redirect_uri_mismatch"
- Add the exact URL to Authorized redirect URIs: `https://zeromizer.github.io/BYD-CRM/`
- Make sure there are no trailing slashes where they shouldn't be

### Error: "invalid_client"
- The Client ID is incorrect or doesn't exist
- Double-check you copied the full Client ID
- Make sure you're using the Web application client type

### Sign-in popup is blocked
- Allow popups for `zeromizer.github.io` in your browser
- Try again after allowing popups

### Still not working?
1. Clear browser cache and cookies for `zeromizer.github.io`
2. Try in incognito/private mode
3. Verify Google Drive API is enabled in your project
4. Check browser console for detailed error messages

## Important Notes

### Publishing Your App (Optional)

While in testing mode, only users you've added to "Test Users" can sign in. To allow anyone to sign in:

1. Go to **"OAuth consent screen"**
2. Click **"PUBLISH APP"**
3. Click **"CONFIRM"**

**Note**: For personal use with just yourself and a few team members, keeping it in testing mode is fine and doesn't require Google verification.

### Security Best Practices

1. **Never commit credentials to public repositories** - We keep them in `config.js` which should ideally be in `.gitignore`, but for GitHub Pages deployment, we need to commit the built files.

2. **Restrict your API key** - Always use HTTP referrer restrictions on your API key

3. **Limit OAuth scopes** - Only use the scopes you actually need (`drive.file` and `drive.appdata`)

4. **Monitor usage** - Check Google Cloud Console regularly for unusual API usage

## Support

If you encounter any issues:
1. Check the browser console for error messages
2. Review the Google Cloud Console for any API or OAuth errors
3. Verify all URLs match exactly (including `https://` and trailing slashes)

---

**Last Updated**: November 2025
**App Version**: 2.0.0
