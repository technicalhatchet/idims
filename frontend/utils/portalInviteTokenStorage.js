/**
 * Persist portal invite/claim token across Auth0 redirects (new tab, email verify).
 * sessionStorage alone is lost when the verify link opens a different browsing context.
 */

const STORAGE_KEY = 'portal_invite_token';
const COOKIE_MAX_AGE_SEC = 7 * 24 * 60 * 60;

function readCookie(name) {
  if (typeof document === 'undefined') return null;
  const prefix = `${name}=`;
  const parts = document.cookie.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      try {
        return decodeURIComponent(trimmed.slice(prefix.length));
      } catch {
        return trimmed.slice(prefix.length);
      }
    }
  }
  return null;
}

function writeCookie(name, value) {
  if (typeof document === 'undefined') return;
  const encoded = encodeURIComponent(value);
  if (encoded.length > 3500) return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encoded}; path=/; max-age=${COOKIE_MAX_AGE_SEC}; SameSite=Lax${secure}`;
}

function eraseCookie(name) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

/** Store invite token in sessionStorage, localStorage, and cookie (when size allows). */
export function persistPortalInviteToken(token) {
  if (!token || typeof window === 'undefined') return;
  const value = String(token).trim();
  if (!value) return;
  sessionStorage.setItem(STORAGE_KEY, value);
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // private mode / quota
  }
  writeCookie(STORAGE_KEY, value);
}

/** Read token from session, localStorage, or cookie (rehydrates session + local). */
export function getPortalInviteToken() {
  if (typeof window === 'undefined') return null;
  const fromSession = sessionStorage.getItem(STORAGE_KEY);
  if (fromSession) return fromSession;

  let fromLocal = null;
  try {
    fromLocal = localStorage.getItem(STORAGE_KEY);
  } catch {
    fromLocal = null;
  }
  if (fromLocal) {
    sessionStorage.setItem(STORAGE_KEY, fromLocal);
    return fromLocal;
  }

  const fromCookie = readCookie(STORAGE_KEY);
  if (fromCookie) {
    sessionStorage.setItem(STORAGE_KEY, fromCookie);
    try {
      localStorage.setItem(STORAGE_KEY, fromCookie);
    } catch {
      // ignore
    }
    return fromCookie;
  }
  return null;
}

export function clearPortalInviteToken() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(STORAGE_KEY);
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  eraseCookie(STORAGE_KEY);
}
