const SESSION_KEY = 'dg_session';
const ACCOUNTS_KEY = 'dg_accounts_v1';
const PASSWORD_HASH_PREFIX = 'fnv1a$';
const PASSWORD_HASH_SALT = 'dg-local-auth-v1';

const DEFAULT_PASSWORD = 'Delgrosso@26';
const DEFAULT_ACCOUNTS = [
  {
    id: 'acc-nicola',
    username: 'Nicola',
    email: 'nicola@delgrossoviaggi.it',
    nome: 'Nicola Pio',
    ruolo: 'admin',
    attivo: true,
    avatar: '',
    password: DEFAULT_PASSWORD
  },
  {
    id: 'acc-raffaele',
    username: 'Raffaele',
    email: 'raffaele@delgrossoviaggi.it',
    nome: 'Raffaele',
    ruolo: 'admin',
    attivo: true,
    avatar: '',
    password: DEFAULT_PASSWORD
  }
];

function normalizeRole(role) {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'admin') return 'admin';
  if (normalized === 'operatore') return 'operatore';
  if (normalized === 'collaboratore') return 'collaboratore';
  return 'operatore';
}

function hashPassword(password) {
  const raw = `${PASSWORD_HASH_SALT}:${String(password || '')}`;
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i += 1) {
    hash ^= raw.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  const normalized = (hash >>> 0).toString(16).padStart(8, '0');
  return `${PASSWORD_HASH_PREFIX}${normalized}`;
}

function isHashedPassword(value) {
  return String(value || '').startsWith(PASSWORD_HASH_PREFIX);
}

function normalizePassword(value) {
  if (isHashedPassword(value)) return String(value || '');
  return hashPassword(value || DEFAULT_PASSWORD);
}

function sanitizeAccount(account = {}) {
  return {
    id: String(account.id || `acc-${Date.now()}`),
    username: String(account.username || '').trim(),
    email: String(account.email || '').trim(),
    nome: String(account.nome || '').trim(),
    ruolo: normalizeRole(account.ruolo),
    attivo: account.attivo !== false,
    avatar: String(account.avatar || '').trim(),
    password: normalizePassword(account.password)
  };
}

function persistAccounts(accounts) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function readAccounts() {
  const raw = localStorage.getItem(ACCOUNTS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.map(sanitizeAccount);
  } catch (_error) {
    return null;
  }
}

function ensureAccounts() {
  const existing = readAccounts();
  if (existing && existing.length) {
    const requiresMigration = existing.some((account) => !isHashedPassword(account.password));
    if (requiresMigration) {
      const migrated = existing.map((account) => sanitizeAccount(account));
      persistAccounts(migrated);
      return migrated;
    }
    return existing;
  }
  const seeded = DEFAULT_ACCOUNTS.map(sanitizeAccount);
  persistAccounts(seeded);
  return seeded;
}

function parseSession(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.authenticated !== true) return null;
    if (!parsed.username || !parsed.nome || !parsed.ruolo) return null;
    return parsed;
  } catch (error) {
    return null;
  }
}

function setGlobalUser(user) {
  try {
    window.__currentUser = user;
    window.__userRole = user?.ruolo || null;
  } catch (error) {
  }
}

export function login(username, password) {
  const normalizedUsername = String(username || '').trim().toLowerCase();
  const normalizedPasswordHash = hashPassword(String(password || ''));
  const accounts = ensureAccounts();
  const matchedUser = accounts.find((account) => {
    const accountUsername = String(account.username || '').trim().toLowerCase();
    const accountEmail = String(account.email || '').trim().toLowerCase();
    return (accountUsername === normalizedUsername || accountEmail === normalizedUsername) && account.attivo !== false;
  }) || null;

  if (!matchedUser || normalizedPasswordHash !== matchedUser.password) {
    throw new Error('Credenziali non valide');
  }

  const session = {
    authenticated: true,
    username: matchedUser.username,
    nome: matchedUser.nome,
    ruolo: matchedUser.ruolo
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  setGlobalUser(session);
  return session;
}

export function logout() {
  localStorage.removeItem(SESSION_KEY);
  setGlobalUser(null);
}

export function getCurrentUser() {
  const session = parseSession(localStorage.getItem(SESSION_KEY));
  if (!session) {
    setGlobalUser(null);
    return null;
  }
  setGlobalUser(session);
  return session;
}

export function isAuthenticated() {
  return Boolean(getCurrentUser());
}

export function getDisplayRole(ruolo) {
  const normalized = String(ruolo || '').toLowerCase();
  if (normalized === 'admin') return 'Amministratore';
  if (normalized === 'operatore') return 'Operatore';
  if (normalized === 'collaboratore') return 'Collaboratore';
  return 'Operatore';
}

export function getAccounts() {
  const accounts = ensureAccounts();
  return accounts.map((account) => {
    const safe = { ...account };
    delete safe.password;
    return safe;
  });
}

export function saveAccounts(accounts = []) {
  if (!Array.isArray(accounts)) throw new Error('Elenco account non valido');
  const sanitized = accounts.map((account, index) => sanitizeAccount({
    ...account,
    id: account?.id || `acc-${Date.now()}-${index}`
  }));
  persistAccounts(sanitized);
  return getAccounts();
}

export function createAccount(input = {}) {
  const accounts = ensureAccounts();
  const account = sanitizeAccount({
    ...input,
    id: input.id || `acc-${Date.now()}`,
    password: input.password || DEFAULT_PASSWORD
  });
  if (!account.username) throw new Error('Username obbligatorio');
  const exists = accounts.some((item) => String(item.username).toLowerCase() === account.username.toLowerCase());
  if (exists) throw new Error('Username già esistente');
  accounts.push(account);
  persistAccounts(accounts);
  const safe = { ...account };
  delete safe.password;
  return safe;
}

export function updateAccount(id, patch = {}) {
  const accounts = ensureAccounts();
  const index = accounts.findIndex((item) => item.id === id);
  if (index < 0) throw new Error('Account non trovato');
  const nextUsername = String(patch.username ?? accounts[index].username ?? '').trim().toLowerCase();
  if (nextUsername) {
    const duplicateUsername = accounts.some((item) => item.id !== id && String(item.username || '').trim().toLowerCase() === nextUsername);
    if (duplicateUsername) throw new Error('Username già esistente');
  }
  const next = sanitizeAccount({
    ...accounts[index],
    ...patch,
    id: accounts[index].id,
    password: patch.password !== undefined ? patch.password : accounts[index].password
  });
  accounts[index] = next;
  persistAccounts(accounts);
  const safe = { ...next };
  delete safe.password;
  return safe;
}

export function deleteAccount(id) {
  const accounts = ensureAccounts();
  const activeAdmins = accounts.filter((item) => item.attivo !== false && normalizeRole(item.ruolo) === 'admin');
  const target = accounts.find((item) => item.id === id);
  if (!target) throw new Error('Account non trovato');
  if (normalizeRole(target.ruolo) === 'admin' && activeAdmins.length <= 1) {
    throw new Error('Impossibile eliminare l\'ultimo amministratore attivo');
  }
  const next = accounts.filter((item) => item.id !== id);
  persistAccounts(next);
}

export function setAccountActive(id, attivo) {
  return updateAccount(id, { attivo: Boolean(attivo) });
}

export function changeAccountPassword(id, password) {
  const normalized = String(password || '');
  if (normalized.length < 6) throw new Error('Password troppo corta');
  return updateAccount(id, { password: normalized });
}
