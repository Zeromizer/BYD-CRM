# Security Audit Report: BYD CRM Application

**Audit Date:** November 29, 2025
**Auditor:** Claude Security Review
**Application:** BYD MotorEast CRM
**Version:** 2.0.0
**Deployment:** GitHub Pages (Static SPA)

---

## Executive Summary

This security audit identified **3 critical**, **4 high**, **2 medium**, and **2 low** severity issues. The application is a frontend-only React SPA that stores customer data in localStorage and Google Drive. The most significant risks are related to **exposed OAuth credentials** and **unencrypted storage of sensitive data**.

### Risk Summary

| Severity | Count | Immediate Action Required |
|----------|-------|---------------------------|
| Critical | 3 | Yes |
| High | 4 | Yes |
| Medium | 2 | Recommended |
| Low | 2 | When convenient |

---

## Architecture Overview

- **Type:** Single Page Application (React 19)
- **Backend:** None (frontend-only)
- **Data Storage:** Browser localStorage + Google Drive API
- **Authentication:** Google OAuth 2.0
- **Hosting:** GitHub Pages (static files)

---

## Critical Findings

### 1. CRITICAL: Hardcoded OAuth Credentials in Source Code

**File:** `src/config/config.js:24-29`

**Issue:** Google OAuth Client ID and API Key are hardcoded directly in the source code:

```javascript
CLIENT_ID: '876961148543-8sdj3cti6q9tc523natb3g6jt789qlbr.apps.googleusercontent.com',
API_KEY: 'AIzaSyDH6E6B4u1m_uvr0mSdCxaCYIkzjSqUuY8',
```

**Risk:** These credentials are visible to anyone who:
- Views the page source
- Inspects the minified JavaScript bundle
- Clones the GitHub repository

**Impact:**
- Attackers could potentially abuse the API key for quota exhaustion
- The Client ID, while not secret by design, combined with reverse engineering could enable phishing attacks that appear to come from your app

**Recommendation:**
- For GitHub Pages (static hosting), OAuth Client IDs are inherently public - this is expected
- **Restrict the API key** in Google Cloud Console:
  - Limit to specific APIs (Google Drive API only)
  - Restrict to your domain only (zeromizer.github.io)
- Consider using environment variables at build time for easier rotation

---

### 2. CRITICAL: Production Build Committed to Git Repository

**File:** `dist/` directory tracked in git

**Issue:** The `.gitignore` file explicitly does NOT ignore the `dist/` folder:

```
# Note: dist/ is NOT ignored because it contains the production build
# that needs to be committed for GitHub Pages hosting
```

The minified JavaScript bundle (`dist/assets/index-RtcQxDqE.js` - 2MB) contains all credentials and source code.

**Risk:**
- Credentials are permanently in git history even if removed
- Anyone can extract and deobfuscate the credentials
- Credential rotation becomes difficult

**Recommendation:**
- Use **GitHub Actions** to build and deploy to the `gh-pages` branch automatically
- Remove `dist/` from the main branch and add to `.gitignore`
- This separates source code from build artifacts

---

### 3. CRITICAL: OAuth Access Tokens Stored in LocalStorage

**File:** `src/services/authService.js:235-236`

```javascript
localStorage.setItem('googleAccessToken', token);
localStorage.setItem('googleTokenExpiry', expiryTime.toString());
```

**Risk:** localStorage is vulnerable to:
- **XSS attacks:** Any JavaScript running on the page can access localStorage
- **Browser extensions:** Malicious extensions can read localStorage
- **Physical access:** Anyone with access to the browser can extract tokens

**Impact:** Token theft could allow attackers to access users' Google Drive data.

**Recommendation:**
- This is a known limitation of SPAs without a backend
- Ensure strong CSP to prevent XSS (see High #1)
- Consider using `sessionStorage` instead (tokens cleared on tab close)
- Implement token encryption at rest (though key management is challenging in SPAs)

---

## High Severity Findings

### 1. HIGH: Weak Content Security Policy

**File:** `index.html:5`

```html
<meta http-equiv="Content-Security-Policy" content="...
  script-src 'self' 'unsafe-eval' 'unsafe-inline' https://accounts.google.com https://apis.google.com;
  style-src 'self' 'unsafe-inline';
...">
```

**Issue:** The CSP includes:
- `'unsafe-eval'` - Allows `eval()` and similar dangerous functions
- `'unsafe-inline'` - Allows inline scripts and styles (XSS vector)

**Risk:** These directives significantly weaken XSS protections.

**Recommendation:**
- Remove `'unsafe-eval'` if possible (may require build tool adjustments)
- Use nonces or hashes instead of `'unsafe-inline'` for scripts
- Keep `'unsafe-inline'` for styles only if necessary for CSS-in-JS libraries

---

### 2. HIGH: Customer PII Stored Unencrypted in LocalStorage

**Files:**
- `src/services/userStorage.js`
- `src/stores/useCustomerStore.js:318`

**Issue:** Customer data including PII is stored in plain text:

```javascript
localStorage.setItem('bydCRM', JSON.stringify(customers));
```

**Stored PII includes:**
- Full name
- Phone number
- Email address
- NRIC (National ID)
- Date of birth
- Home address
- Occupation
- Financial details (loan amounts, payments)

**Risk:** This data can be accessed by:
- Browser extensions
- XSS attacks
- Physical access to the device
- Other JavaScript on the same origin

**Recommendation:**
- Encrypt sensitive data before storing in localStorage
- Consider using Web Crypto API for client-side encryption
- Minimize what's stored locally vs. fetched from Google Drive on demand

---

### 3. HIGH: Overly Broad Google Drive OAuth Scope

**File:** `src/config/config.js:34`

```javascript
SCOPES: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.appdata',
```

**Issue:** The `drive` scope grants full read/write access to the user's **entire** Google Drive, not just app-created files.

**Risk:**
- If a token is compromised, attackers can access ALL user files
- Users may not realize they're granting full Drive access

**Recommendation:**
- Use `https://www.googleapis.com/auth/drive.file` instead
- This scope only allows access to files the app creates or the user explicitly opens with the app
- Update OAuth consent screen to reflect narrower permissions

---

### 4. HIGH: No Backend Authorization - Client-Side Only

**Issue:** All authorization checks are performed client-side:

```javascript
if (!isSignedIn) {
  return { success: false, error: 'Not signed in' };
}
```

**Risk:**
- Authorization can be bypassed by modifying JavaScript in DevTools
- There's no server to validate that users should have access to specific data
- The Google Drive token is the only real authorization boundary

**Impact:** While Google Drive provides per-user isolation, there's no application-level access control (e.g., no roles like "sales manager" vs "sales person").

**Recommendation:**
- Accept this as a limitation of frontend-only architecture
- If multi-user access control is needed, implement a backend service
- Document that each user's data is isolated to their own Google Drive

---

## Medium Severity Findings

### 1. MEDIUM: Potential XSS in Print Window Generation

**File:** `src/services/formService.js:216-221`

```javascript
printWin.document.write(`
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <title>${customerName} - ${formName}</title>
```

**Issue:** User-controlled values (`customerName`, `formName`) are interpolated directly into HTML without sanitization.

**Risk:** If a customer name contains HTML/JavaScript (e.g., `<script>alert('xss')</script>`), it could execute in the print window context.

**Recommendation:**
- HTML-encode the values before interpolation:
  ```javascript
  const escapeHtml = (str) => str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  ```
- DOMPurify is bundled but not used - consider using it for sanitization

---

### 2. MEDIUM: No Input Validation on Customer Data Fields

**Issue:** Customer data fields accept any input without validation:
- NRIC format not validated
- Phone numbers not validated
- Email addresses not validated
- No length limits enforced

**Risk:**
- Invalid data could cause display issues
- Large inputs could impact performance
- Malformed data could cause unexpected behavior

**Recommendation:**
- Add input validation for:
  - NRIC format (Singapore/Malaysia format)
  - Phone number format
  - Email format
  - Maximum field lengths
- Use HTML5 input types (`type="email"`, `type="tel"`)

---

## Low Severity Findings

### 1. LOW: No Rate Limiting on API Operations

**Issue:** The app makes many Google Drive API calls without rate limiting.

**Risk:**
- Rapid operations could hit Google's API quotas
- Could affect user experience if throttled

**Recommendation:**
- The app does implement batch operations which helps
- Consider adding client-side request queuing with delays
- Handle 429 (Too Many Requests) responses gracefully

---

### 2. LOW: Session Persistence Enabled by Default

**File:** `src/config/config.js:45-46`

```javascript
ENABLE_PERSISTENT_AUTH: true,
AUTO_SIGNIN_ON_STARTUP: true,
```

**Issue:** Users stay logged in until manual sign-out.

**Risk:** On shared computers, the next user could access the previous user's data.

**Recommendation:**
- Add session timeout option
- Consider prompting users about persistence on public/shared computers
- Add "Remember me" checkbox during sign-in

---

## Positive Security Findings

The audit also identified several good security practices:

1. **No `eval()` or `new Function()`** - No dynamic code execution found
2. **No `dangerouslySetInnerHTML`** - React's XSS protection is intact
3. **No `.innerHTML` assignments** - DOM manipulation is safe
4. **Zero known npm vulnerabilities** - `npm audit` reports 0 issues
5. **HTTPS enforced** - GitHub Pages serves over HTTPS only
6. **Multi-user data isolation** - Email-based localStorage key prefixing
7. **Token refresh mechanism** - Tokens refresh before expiry
8. **DOMPurify bundled** - Sanitization library available (though unused)

---

## Recommendations Summary

### Immediate Actions (Critical/High)

| # | Action | Effort |
|---|--------|--------|
| 1 | Restrict Google API key in Cloud Console | Low |
| 2 | Set up GitHub Actions for deployment | Medium |
| 3 | Change OAuth scope to `drive.file` | Low |
| 4 | Fix XSS in print window (escape HTML) | Low |

### Short-term Actions (Medium)

| # | Action | Effort |
|---|--------|--------|
| 5 | Strengthen CSP (remove unsafe-eval if possible) | Medium |
| 6 | Add input validation for customer fields | Medium |
| 7 | Consider encrypting localStorage data | High |

### Long-term Considerations

| # | Action | Effort |
|---|--------|--------|
| 8 | Evaluate backend service for enhanced security | High |
| 9 | Implement session timeout options | Low |
| 10 | Use DOMPurify for any HTML rendering | Low |

---

## Appendix: Files Reviewed

| File | Purpose | Issues Found |
|------|---------|--------------|
| `src/config/config.js` | OAuth configuration | Critical: Exposed credentials |
| `src/services/authService.js` | Token management | Critical: localStorage storage |
| `src/services/driveService.js` | Google Drive API | High: Broad scope |
| `src/services/formService.js` | Form rendering | Medium: XSS in print |
| `src/services/userStorage.js` | Data persistence | High: Unencrypted PII |
| `src/stores/useCustomerStore.js` | Customer data | High: Unencrypted storage |
| `index.html` | Entry point | High: Weak CSP |
| `.gitignore` | Git config | Critical: dist tracked |
| `package.json` | Dependencies | None: Clean audit |

---

## Disclaimer

This security audit was performed on a snapshot of the codebase and may not cover all potential vulnerabilities. Regular security reviews are recommended, especially after significant changes. This audit focuses on application-level security and does not cover infrastructure, hosting environment, or third-party service configurations beyond what's visible in the code.
