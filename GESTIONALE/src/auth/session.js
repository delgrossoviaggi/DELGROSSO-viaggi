const SESSION_KEY = 'dg-gestionale-session';
const REMEMBER_KEY = 'dg-gestionale-remember-identifier';

const ADMIN_ACCOUNT = Object.freeze({
  username: 'nicola',
  email: 'nicola@delgrossoviaggi.it',
  password: 'Delgrosso@26',
  role: 'Amministratore'
});

function normalizeValue(value) {
  return String(value ?? '').trim();
}

function normalizeIdentifier(value) {
  return normalizeValue(value).toLowerCase();
}

export function getAdminAccount() {
  return ADMIN_ACCOUNT;
}

export function authenticateAdmin(identifier, password) {
  const normalizedIdentifier = normalizeIdentifier(identifier);
  const normalizedPassword = normalizeValue(password);
  const identifierMatches = normalizedIdentifier === ADMIN_ACCOUNT.username || normalizedIdentifier === ADMIN_ACCOUNT.email;
  const passwordMatches = normalizedPassword === ADMIN_ACCOUNT.password;
  return identifierMatches && passwordMatches;
}

export function createSession() {
  const session = {
    username: ADMIN_ACCOUNT.username,
    email: ADMIN_ACCOUNT.email,
    role: ADMIN_ACCOUNT.role,
    loggedAt: new Date().toISOString()
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function getSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error('Sessione non valida in localStorage.', error);
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function isAuthenticated() {
  return Boolean(getSession());
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function rememberIdentifier(value) {
  const normalized = normalizeValue(value);
  if (!normalized) {
    localStorage.removeItem(REMEMBER_KEY);
    return;
  }
  localStorage.setItem(REMEMBER_KEY, normalized);
}

export function getRememberedIdentifier() {
  return localStorage.getItem(REMEMBER_KEY) || '';
}

export function applySessionToPage() {
  const session = getSession();
  if (!session) return;
  const emailEl = document.getElementById('loggedEmail');
  const roleEl = document.getElementById('loggedRole');
  if (emailEl) emailEl.textContent = session.email || ADMIN_ACCOUNT.email;
  if (roleEl) roleEl.textContent = session.role || ADMIN_ACCOUNT.role;
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', applySessionToPage, { once: true });
} else {
  applySessionToPage();
}
