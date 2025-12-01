/**
 * PKCE (Proof Key for Code Exchange) Utilities
 * Used for secure OAuth 2.0 Authorization Code flow in SPAs
 */

/**
 * Generate a cryptographically random code verifier
 * @returns {string} A random string of 43-128 characters
 */
export function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

/**
 * Generate a code challenge from a code verifier using SHA-256
 * @param {string} codeVerifier - The code verifier to hash
 * @returns {Promise<string>} The base64url-encoded SHA-256 hash
 */
export async function generateCodeChallenge(codeVerifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

/**
 * Base64URL encode a Uint8Array
 * @param {Uint8Array} array - The array to encode
 * @returns {string} Base64URL encoded string
 */
function base64UrlEncode(array) {
  const base64 = btoa(String.fromCharCode.apply(null, array));
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Store PKCE verifier in sessionStorage for the authorization flow
 * @param {string} verifier - The code verifier to store
 */
export function storePkceVerifier(verifier) {
  sessionStorage.setItem('pkce_code_verifier', verifier);
}

/**
 * Retrieve and clear PKCE verifier from sessionStorage
 * @returns {string|null} The stored code verifier, or null if not found
 */
export function retrievePkceVerifier() {
  const verifier = sessionStorage.getItem('pkce_code_verifier');
  sessionStorage.removeItem('pkce_code_verifier');
  return verifier;
}
