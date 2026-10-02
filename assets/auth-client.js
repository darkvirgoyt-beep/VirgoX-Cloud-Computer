/**
 * Auth Client — Supabase-backed authentication for VirgoX
 * Handles session management, owner verification, and access grants
 */

const STORAGE_KEYS = {
  AUTHED: 'virgox_authenticated',
  TOKEN: 'virgox_session_token',
  MASTER_UNLOCKED: 'virgox_master_unlocked',
  ROLE: 'virgox_user_role',
  EMAIL: 'virgox_user_email',
  NAME: 'virgox_user_name',
  PICTURE: 'virgox_user_picture',
  ACTIVE_USER: 'virgox_active_user',
  ACTIVE_ROLE: 'virgox_active_role',
  CONFIGURED: 'virgox_auth_configured'
};

// Owner hashes — stored in code for zero-knowledge verification
// These are SHA-256 hashes of the master password (lowercased)
const OWNER_HASHES = [
  '558c93a71d924e65977c7152aa6260596825d8c118d5d30f43dcfb1797d9bbf0',
  '0a7a37ae29ae8cb4326cf7684fbded25330bba38b65b501449e9ca8ba67b4de1',
  '2b90cb3a6ffa02f386e4ad8290a62d4f3d33c8db010e02feb92c1655ea799a2a'
];

function generateSessionToken() {
  return 'vx_sess_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function isOwnerEmail(email) {
  return email?.toLowerCase() === 'darkvirgoyt@gmail.com';
}

async function fetchWithAuth(url, options = {}) {
  const token = sessionStorage.getItem(STORAGE_KEYS.TOKEN);
  const headers = { ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, { ...options, headers, cache: 'no-store' });
}

/**
 * Verify if a hash matches any owner hash
 */
export async function verifyOwnerHash(hash) {
  return OWNER_HASHES.includes(hash);
}

/**
 * Check if user has an active session
 */
export function hasActiveSession() {
  const authed = sessionStorage.getItem(STORAGE_KEYS.AUTHED) === 'true';
  const token = sessionStorage.getItem(STORAGE_KEYS.TOKEN);
  const email = sessionStorage.getItem(STORAGE_KEYS.EMAIL);
  return authed && token && email;
}

/**
 * Get current session info
 */
export function getSession() {
  if (!hasActiveSession()) return null;
  return {
    token: sessionStorage.getItem(STORAGE_KEYS.TOKEN),
    email: sessionStorage.getItem(STORAGE_KEYS.EMAIL),
    role: sessionStorage.getItem(STORAGE_KEYS.ROLE),
    name: sessionStorage.getItem(STORAGE_KEYS.NAME),
    picture: sessionStorage.getItem(STORAGE_KEYS.PICTURE)
  };
}

/**
 * Grant access and establish session
 */
export async function grantAccess({ email, role, name, picture, source = 'login' }) {
  const cleanEmail = email.toLowerCase();
  const isOwner = isOwnerEmail(cleanEmail);
  const finalEmail = isOwner ? 'darkvirgoyt@gmail.com' : cleanEmail;
  const finalRole = isOwner ? 'owner' : (role || 'guest');
  const finalName = isOwner ? 'Prince · VirgoYT (Owner)' : (name || cleanEmail.split('@')[0]);
  const sessionToken = generateSessionToken();

  // Session storage (persists for tab session)
  sessionStorage.setItem(STORAGE_KEYS.AUTHED, 'true');
  sessionStorage.setItem(STORAGE_KEYS.TOKEN, sessionToken);
  sessionStorage.setItem(STORAGE_KEYS.MASTER_UNLOCKED, 'true');
  sessionStorage.setItem(STORAGE_KEYS.ROLE, finalRole);
  sessionStorage.setItem(STORAGE_KEYS.EMAIL, finalEmail);
  sessionStorage.setItem(STORAGE_KEYS.NAME, finalName);
  sessionStorage.setItem(STORAGE_KEYS.PICTURE, picture || '');

  // Local storage (persists across tabs/sessions)
  localStorage.setItem(STORAGE_KEYS.ACTIVE_USER, finalEmail);
  localStorage.setItem(STORAGE_KEYS.ACTIVE_ROLE, finalRole);
  localStorage.setItem(STORAGE_KEYS.CONFIGURED, 'true');
  localStorage.setItem(STORAGE_KEYS.TOKEN, sessionToken);

  // Notify other tabs
  window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEYS.ACTIVE_USER, newValue: finalEmail }));

  return { email: finalEmail, role: finalRole, name: finalName, token: sessionToken };
}

/**
 * Sign out and clear all auth state
 */
export function signOut() {
  const keys = Object.values(STORAGE_KEYS);
  keys.forEach(k => {
    sessionStorage.removeItem(k);
    localStorage.removeItem(k);
  });
  window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEYS.ACTIVE_USER, newValue: null }));
}

/**
 * Verify session with backend (for pc.html gate)
 */
export async function verifySessionWithBackend(baseUrl, token) {
  if (!baseUrl || !token) return { valid: false };
  try {
    const res = await fetch(`${baseUrl}/account/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store'
    });
    if (!res.ok) return { valid: false };
    const data = await res.json();
    return { valid: true, email: data.email?.toLowerCase() };
  } catch {
    return { valid: false };
  }
}

/**
 * Redeem a one-shot claim from vxc auth login
 */
export async function redeemClaim(baseUrl, claim) {
  if (!baseUrl || !claim) return { success: false };
  try {
    const res = await fetch(`${baseUrl}/session/claim?claim=${encodeURIComponent(claim)}`, { cache: 'no-store' });
    if (!res.ok) return { success: false };
    const data = await res.json();
    if (!data?.access_token) return { success: false };

    await grantAccess({
      email: data.user_email,
      role: data.user_email?.toLowerCase() === 'darkvirgoyt@gmail.com' ? 'owner' : 'guest',
      source: 'vxc_claim'
    });

    // Store auth base for API calls
    localStorage.setItem('virgox_auth_base', baseUrl);

    return { success: true, email: data.user_email };
  } catch {
    return { success: false };
  }
}

/**
 * Initialize auth state on page load
 */
export function initAuth() {
  // Check for existing session
  if (hasActiveSession()) {
    return { authenticated: true, ...getSession() };
  }
  return { authenticated: false };
}

// Cross-tab sync
window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEYS.ACTIVE_USER) {
    if (e.newValue === null) {
      signOut();
      window.location.href = 'index.html';
    }
  }
});

export const auth = {
  verifyOwnerHash,
  hasActiveSession,
  getSession,
  grantAccess,
  signOut,
  verifySessionWithBackend,
  redeemClaim,
  initAuth
};
