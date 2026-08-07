import {
  applyRuntimeSettings,
  buildCompanyInfo,
  creaBackup,
  defaultSettings,
  loadImpostazioni,
  ripristinaBackup,
  salvaImpostazioni
} from '../../services/settingsService.js';
import { showConfirm, showMessage } from '../../components/messageSystem.js';
import { applyTheme, setStoredTheme, ThemeMode } from '../../utils/themeManager.js';
import {
  changeAccountPassword,
  createAccount,
  deleteAccount,
  getAccounts,
  getCurrentUser,
  logout,
  setAccountActive,
  updateAccount
} from '../../services/localAuthService.js';
import { ADMIN_ROUTES } from '../../utils/appRoutes.js';

const ACTIVITY_KEY = 'dg_settings_activity_v1';
const ACCOUNTS_KEY = 'dg_accounts_v1';
const ACCOUNT_META_KEY = 'dg_settings_account_meta_v1';

const state = {
  settings: defaultSettings(),
  users: [],
  activity: [],
  accountMeta: {}
};

function getInput(id) {
  return document.getElementById(id);
}

function setStatus(message, type = 'info') {
  showMessage({
    type,
    title: type === 'error' ? 'Errore' : 'Impostazioni',
    message: String(message || '')
  });
}

function readJsonStorage(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch (_error) {
    return fallback;
  }
}

function writeJsonStorage(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('it-IT');
}

function normalizeRole(role) {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'admin') return 'admin';
  if (normalized === 'operatore') return 'operatore';
  if (normalized === 'collaboratore') return 'collaboratore';
  return 'operatore';
}

function roleLabel(role) {
  if (role === 'admin') return 'Amministratore';
  if (role === 'operatore') return 'Operatore';
  return 'Collaboratore';
}

function getOperatorName() {
  const current = getCurrentUser();
  return current?.nome || current?.username || 'Operatore';
}

function loadLocalState() {
  state.activity = readJsonStorage(ACTIVITY_KEY, []);
  if (!Array.isArray(state.activity)) state.activity = [];
  state.accountMeta = readJsonStorage(ACCOUNT_META_KEY, {});
  if (!state.accountMeta || typeof state.accountMeta !== 'object') state.accountMeta = {};
}

function persistLocalState() {
  writeJsonStorage(ACTIVITY_KEY, state.activity);
  writeJsonStorage(ACCOUNT_META_KEY, state.accountMeta);
}

function addActivity(action, detail) {
  state.activity.unshift({
    id: `act-${Date.now()}`,
    at: new Date().toISOString(),
    operator: getOperatorName(),
    action: String(action || ''),
    detail: String(detail || '')
  });
  state.activity = state.activity.slice(0, 300);
  persistLocalState();
  renderActivityTable();
  renderSystemInfo();
}

function hydrateCompanySection() {
  const azienda = state.settings.azienda || {};
  getInput('companyNameInput').value = azienda.nome || '';
  getInput('companyVatInput').value = azienda.piva || '';
  getInput('companyEmailInput').value = azienda.email || '';
  getInput('companyPhoneInput').value = azienda.telefono || '';
  getInput('companyWhatsappInput').value = azienda.whatsapp || '';
  getInput('companyAddressInput').value = azienda.indirizzo || '';
  getInput('companyWebsiteInput').value = azienda.website || '';
  getInput('companyPecInput').value = azienda.pec || '';
  getInput('companyLogoInput').value = azienda.logo || '';
  getInput('companyFaviconInput').value = azienda.favicon || '';
  getInput('companySupportLabelInput').value = azienda.supportLabel || '';
  getInput('companyFacebookInput').value = azienda.socials?.facebook || '';
  getInput('companyInstagramInput').value = azienda.socials?.instagram || '';
  getInput('companyLinkedinInput').value = azienda.socials?.linkedin || '';
  getInput('companyTiktokInput').value = azienda.socials?.tiktok || '';
  getInput('companyYoutubeInput').value = azienda.socials?.youtube || '';
}

function hydrateAppearanceSection() {
  const preferenze = state.settings.preferenze || {};
  getInput('themeDarkInput').checked = Boolean(preferenze.temaScuro);
  getInput('showCompanyLogoInput').checked = preferenze.showCompanyLogo !== false;
  getInput('colorPrimaryInput').value = preferenze.colorePrimario || '#0F4C81';
  getInput('colorAccentInput').value = preferenze.coloreAccento || '#F57C00';
  getInput('colorSurfaceInput').value = preferenze.coloreSuperficie || '#f5f7fb';
  getInput('colorTextInput').value = preferenze.coloreTesto || '#16212d';
}

function hydrateDocumentsSection() {
  const documenti = state.settings.documenti || {};
  getInput('receiptTitleInput').value = documenti.receiptTitle || '';
  getInput('receiptFooterInput').value = documenti.receiptFooter || '';
  getInput('qrPrefixInput').value = documenti.qrPrefix || '';
  getInput('qrNoteInput').value = documenti.qrNote || '';
}

function hydrateCommunicationSection() {
  const preferenze = state.settings.preferenze || {};
  const comunicazione = state.settings.comunicazione || {};
  getInput('emailNotificationsInput').checked = Boolean(preferenze.notificheEmail);
  getInput('autoBackupInput').checked = Boolean(preferenze.backupAutomatico);
  getInput('autoUpdateInput').checked = Boolean(preferenze.aggiornamentoAutomatico);
  getInput('notificationsReportEmailInput').value = comunicazione.reportEmail || '';
  getInput('smtpHostInput').value = comunicazione.smtpHost || '';
  getInput('smtpPortInput').value = String(comunicazione.smtpPort || 587);
  getInput('smtpSecureInput').checked = Boolean(comunicazione.smtpSecure);
  getInput('smtpUsernameInput').value = comunicazione.smtpUsername || '';
  getInput('smtpPasswordInput').value = comunicazione.smtpPassword || '';
  getInput('smtpFromNameInput').value = comunicazione.smtpFromName || '';
  getInput('smtpFromEmailInput').value = comunicazione.smtpFromEmail || '';
  getInput('smtpReplyToInput').value = comunicazione.smtpReplyTo || '';
  getInput('whatsAppSupportTemplateInput').value = comunicazione.whatsappTemplateSupport || '';
  getInput('whatsAppCustomerTemplateInput').value = comunicazione.whatsappTemplateCustomer || '';
  getInput('whatsAppQuoteTemplateInput').value = comunicazione.whatsappTemplateQuote || '';
}

function hydrateConfigSection() {
  const config = state.settings.configurazioni || {};
  getInput('systemStatusInput').value = config.stato || 'Online';
  getInput('systemFrontendInput').value = config.frontend || 'HTML/CSS/JS';
  getInput('systemDatabaseInput').value = config.database || 'Supabase';
  getInput('currencyInput').value = 'EUR';
  getInput('supabaseUrlInput').value = config.supabaseUrl || '';
  getInput('supabaseAnonKeyInput').value = config.supabaseAnonKey || '';
  getInput('storageBucketLocandineInput').value = config.storageBucketLocandine || 'locandine';
  getInput('storageBucketRicevuteInput').value = config.storageBucketRicevute || 'ricevute-prenotazioni';
  getInput('storagePublicBaseUrlInput').value = config.storagePublicBaseUrl || '';
}

function hydrateRolesSection() {
  const sicurezza = state.settings.sicurezza || {};
  getInput('defaultRoleInput').value = sicurezza.defaultRole || 'operatore';
  getInput('minPasswordLengthInput').value = Number(sicurezza.minPasswordLength || 6);
}

function renderAccountsTable() {
  const tbody = getInput('accountsTableBody');
  if (!tbody) return;
  if (!state.users.length) {
    tbody.innerHTML = '<tr><td colspan="7">Nessun account disponibile.</td></tr>';
    return;
  }
  tbody.innerHTML = state.users.map((user) => {
    const meta = state.accountMeta?.[user.id];
    const role = normalizeRole(user.ruolo);
    return `<tr>
      <td><strong>${user.nome || '-'}</strong></td>
      <td>${user.username || '-'}</td>
      <td>${user.email || '-'}</td>
      <td><span class="role-badge role-${role}">${roleLabel(role)}</span></td>
      <td><span class="${user.attivo === false ? 'state-inactive' : 'state-active'}">${user.attivo === false ? 'Disattivo' : 'Attivo'}</span></td>
      <td>${formatDateTime(meta?.updatedAt)}</td>
      <td class="text-right">
        <div class="actions-inline">
          <button type="button" class="btn btn-secondary" data-action="edit" data-id="${user.id}">Modifica</button>
          <button type="button" class="btn btn-secondary" data-action="password" data-id="${user.id}">Password</button>
          <button type="button" class="btn btn-secondary" data-action="toggle" data-id="${user.id}">${user.attivo === false ? 'Attiva' : 'Disattiva'}</button>
          <button type="button" class="btn btn-danger" data-action="delete" data-id="${user.id}">Elimina</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function renderRoleCounters() {
  const totals = state.users.reduce((acc, user) => {
    const role = normalizeRole(user.ruolo);
    if (role === 'admin') acc.admin += 1;
    if (role === 'operatore') acc.operatore += 1;
    if (role === 'collaboratore') acc.collaboratore += 1;
    if (user.attivo === false) acc.inactive += 1;
    return acc;
  }, { admin: 0, operatore: 0, collaboratore: 0, inactive: 0 });
  getInput('roleAdminCount').textContent = String(totals.admin);
  getInput('roleOperatoreCount').textContent = String(totals.operatore);
  getInput('roleCollaboratoreCount').textContent = String(totals.collaboratore);
  getInput('roleInactiveCount').textContent = String(totals.inactive);
}

function renderBackupInfo() {
  const backupInfo = state.settings?.configurazioni?.ultimoBackup || 'Nessun backup disponibile';
  getInput('backupInfo').textContent = backupInfo === 'Nessun backup disponibile'
    ? backupInfo
    : formatDateTime(backupInfo);
}

function renderActivityTable() {
  const tbody = getInput('activityTableBody');
  if (!tbody) return;
  if (!state.activity.length) {
    tbody.innerHTML = '<tr><td colspan="4">Nessuna attività registrata.</td></tr>';
    return;
  }
  tbody.innerHTML = state.activity.map((entry) => `<tr>
    <td>${formatDateTime(entry.at)}</td>
    <td>${entry.operator}</td>
    <td>${entry.action}</td>
    <td>${entry.detail || '-'}</td>
  </tr>`).join('');
}

function renderSystemInfo() {
  const config = state.settings?.configurazioni || {};
  const comms = state.settings?.comunicazione || {};
  getInput('systemVersionInfo').textContent = config.versione || '1.0.0';
  getInput('systemDatabaseInfo').textContent = config.database || 'Supabase';
  getInput('systemFrontendInfo').textContent = config.frontend || 'HTML/CSS/JS';
  getInput('systemStatusInfo').textContent = config.stato || 'Online';
  getInput('systemStorageInfo').textContent = `${config.storageBucketLocandine || 'locandine'} / ${config.storageBucketRicevute || 'ricevute-prenotazioni'}`;
  getInput('systemSmtpInfo').textContent = comms.smtpHost ? `${comms.smtpHost}:${comms.smtpPort || 587}` : 'Non configurato';
  getInput('systemBrowserInfo').textContent = navigator.userAgent;
  getInput('systemLastUpdateInfo').textContent = state.activity.length
    ? formatDateTime(state.activity[0].at)
    : '-';
}

function refreshUsers() {
  state.users = getAccounts();
  renderAccountsTable();
  renderRoleCounters();
}

function applyLiveBranding() {
  applyRuntimeSettings(state.settings, { applyThemePreference: true });
}

function hydrateSections() {
  hydrateCompanySection();
  hydrateRolesSection();
  hydrateAppearanceSection();
  hydrateDocumentsSection();
  hydrateCommunicationSection();
  hydrateConfigSection();
  renderBackupInfo();
  refreshUsers();
  renderActivityTable();
  renderSystemInfo();
  applyLiveBranding();
}

async function persistSettings(patch, activityAction, activityDetail) {
  const response = await salvaImpostazioni(patch);
  if (response.success === false) throw response.error;
  state.settings = response.data || state.settings;
  hydrateSections();
  addActivity(activityAction, activityDetail);
}

async function saveCompanySection() {
  await persistSettings({
    azienda: {
      nome: getInput('companyNameInput').value.trim(),
      piva: getInput('companyVatInput').value.trim(),
      email: getInput('companyEmailInput').value.trim(),
      telefono: getInput('companyPhoneInput').value.trim(),
      whatsapp: getInput('companyWhatsappInput').value.trim(),
      pec: getInput('companyPecInput').value.trim(),
      indirizzo: getInput('companyAddressInput').value.trim(),
      website: getInput('companyWebsiteInput').value.trim(),
      logo: getInput('companyLogoInput').value.trim(),
      favicon: getInput('companyFaviconInput').value.trim(),
      supportLabel: getInput('companySupportLabelInput').value.trim(),
      socials: {
        facebook: getInput('companyFacebookInput').value.trim(),
        instagram: getInput('companyInstagramInput').value.trim(),
        linkedin: getInput('companyLinkedinInput').value.trim(),
        tiktok: getInput('companyTiktokInput').value.trim(),
        youtube: getInput('companyYoutubeInput').value.trim()
      }
    }
  }, 'Salvataggio azienda', 'Aggiornata anagrafica, branding e canali social.');
}

async function saveRolesPolicySection() {
  const defaultRole = normalizeRole(getInput('defaultRoleInput').value);
  const minPasswordLength = Math.max(6, Number(getInput('minPasswordLengthInput').value || 6));
  await persistSettings({
    sicurezza: {
      defaultRole,
      minPasswordLength
    }
  }, 'Aggiornamento policy ruoli', `Ruolo predefinito: ${defaultRole}.`);
}

async function saveAppearanceSection() {
  const darkEnabled = Boolean(getInput('themeDarkInput').checked);
  const theme = darkEnabled ? ThemeMode.DARK : ThemeMode.LIGHT;
  await persistSettings({
    preferenze: {
      temaScuro: darkEnabled,
      showCompanyLogo: Boolean(getInput('showCompanyLogoInput').checked),
      colorePrimario: getInput('colorPrimaryInput').value,
      coloreAccento: getInput('colorAccentInput').value,
      coloreSuperficie: getInput('colorSurfaceInput').value,
      coloreTesto: getInput('colorTextInput').value
    }
  }, 'Aggiornamento aspetto', `Tema impostato su ${darkEnabled ? 'dark' : 'light'}.`);
  applyTheme(theme);
  setStoredTheme(theme);
}

async function saveDocumentsSection() {
  await persistSettings({
    documenti: {
      receiptTitle: getInput('receiptTitleInput').value.trim(),
      receiptFooter: getInput('receiptFooterInput').value.trim(),
      qrPrefix: getInput('qrPrefixInput').value.trim(),
      qrNote: getInput('qrNoteInput').value.trim()
    }
  }, 'Aggiornamento documenti', 'Ricevuta prenotazione e QR aggiornati.');
}

async function saveCommunicationSection() {
  await persistSettings({
    preferenze: {
      notificheEmail: Boolean(getInput('emailNotificationsInput').checked),
      backupAutomatico: Boolean(getInput('autoBackupInput').checked),
      aggiornamentoAutomatico: Boolean(getInput('autoUpdateInput').checked)
    },
    comunicazione: {
      reportEmail: getInput('notificationsReportEmailInput').value.trim(),
      smtpHost: getInput('smtpHostInput').value.trim(),
      smtpPort: Math.max(1, Number(getInput('smtpPortInput').value || 587)),
      smtpSecure: Boolean(getInput('smtpSecureInput').checked),
      smtpUsername: getInput('smtpUsernameInput').value.trim(),
      smtpPassword: getInput('smtpPasswordInput').value,
      smtpFromName: getInput('smtpFromNameInput').value.trim(),
      smtpFromEmail: getInput('smtpFromEmailInput').value.trim(),
      smtpReplyTo: getInput('smtpReplyToInput').value.trim(),
      whatsappTemplateSupport: getInput('whatsAppSupportTemplateInput').value.trim(),
      whatsappTemplateCustomer: getInput('whatsAppCustomerTemplateInput').value.trim(),
      whatsappTemplateQuote: getInput('whatsAppQuoteTemplateInput').value.trim()
    }
  }, 'Aggiornamento comunicazione', 'SMTP, email operative e template WhatsApp aggiornati.');
}

async function saveConfigSection() {
  await persistSettings({
    configurazioni: {
      stato: getInput('systemStatusInput').value,
      frontend: getInput('systemFrontendInput').value.trim(),
      database: getInput('systemDatabaseInput').value.trim(),
      supabaseUrl: getInput('supabaseUrlInput').value.trim(),
      supabaseAnonKey: getInput('supabaseAnonKeyInput').value.trim(),
      storageBucketLocandine: getInput('storageBucketLocandineInput').value.trim(),
      storageBucketRicevute: getInput('storageBucketRicevuteInput').value.trim(),
      storagePublicBaseUrl: getInput('storagePublicBaseUrlInput').value.trim()
    }
  }, 'Aggiornamento configurazione', 'Configurazione Supabase, storage e runtime salvata.');
}

function openAccountModal(accountId = '') {
  const modal = getInput('accountModal');
  const title = getInput('accountModalTitle');
  const account = state.users.find((item) => item.id === accountId);

  if (account) {
    title.textContent = 'Modifica account';
    getInput('accountIdInput').value = account.id;
    getInput('accountNameInput').value = account.nome || '';
    getInput('accountUsernameInput').value = account.username || '';
    getInput('accountEmailInput').value = account.email || '';
    getInput('accountRoleInput').value = normalizeRole(account.ruolo);
    getInput('accountPasswordInput').value = '';
    getInput('accountActiveInput').checked = account.attivo !== false;
  } else {
    title.textContent = 'Nuovo account';
    getInput('accountIdInput').value = '';
    getInput('accountNameInput').value = '';
    getInput('accountUsernameInput').value = '';
    getInput('accountEmailInput').value = '';
    getInput('accountRoleInput').value = state.settings.sicurezza?.defaultRole || 'operatore';
    getInput('accountPasswordInput').value = '';
    getInput('accountActiveInput').checked = true;
  }

  modal.showModal();
}

function markAccountUpdated(accountId) {
  state.accountMeta[accountId] = { updatedAt: new Date().toISOString() };
  persistLocalState();
}

async function touchSettings(action, detail) {
  const response = await salvaImpostazioni({
    configurazioni: {
      ...state.settings.configurazioni,
      stato: state.settings.configurazioni?.stato || 'Online'
    }
  });
  if (response.success !== false) {
    state.settings = response.data || state.settings;
    hydrateSections();
  }
  addActivity(action, detail);
}

async function handleSaveAccount(event) {
  event.preventDefault();
  const id = getInput('accountIdInput').value.trim();
  const nome = getInput('accountNameInput').value.trim();
  const username = getInput('accountUsernameInput').value.trim();
  const email = getInput('accountEmailInput').value.trim();
  const ruolo = normalizeRole(getInput('accountRoleInput').value);
  const password = getInput('accountPasswordInput').value;
  const attivo = Boolean(getInput('accountActiveInput').checked);
  const minPassword = Math.max(6, Number(state.settings.sicurezza?.minPasswordLength || 6));

  if (!nome || !username || !email) throw new Error('Compila tutti i campi obbligatori dell\'account.');
  if (password && password.length < minPassword) throw new Error(`La password deve avere almeno ${minPassword} caratteri.`);

  let savedId = id;
  if (id) {
    updateAccount(id, { nome, username, email, ruolo, attivo });
    if (password) changeAccountPassword(id, password);
  } else {
    const created = createAccount({ nome, username, email, ruolo, attivo, password: password || undefined });
    savedId = created.id;
  }

  markAccountUpdated(savedId);
  refreshUsers();
  getInput('accountModal').close();
  await touchSettings('Salvataggio account', `${id ? 'Aggiornato' : 'Creato'} account ${username}.`);
}

async function handleToggleAccount(accountId) {
  const account = state.users.find((item) => item.id === accountId);
  if (!account) return;
  setAccountActive(accountId, account.attivo === false);
  markAccountUpdated(accountId);
  refreshUsers();
  await touchSettings('Cambio stato account', `Account ${account.username} ${account.attivo === false ? 'attivato' : 'disattivato'}.`);
}

async function handleDeleteAccount(accountId) {
  const account = state.users.find((item) => item.id === accountId);
  if (!account) return;
  const confirmed = await showConfirm({
    title: 'Elimina account',
    message: `Confermi eliminazione account ${account.username}?`,
    confirmText: 'Elimina',
    cancelText: 'Annulla'
  });
  if (!confirmed) return;
  deleteAccount(accountId);
  refreshUsers();
  await touchSettings('Eliminazione account', `Eliminato account ${account.username}.`);
}

function openPasswordModal(accountId) {
  const account = state.users.find((item) => item.id === accountId);
  if (!account) return;
  getInput('passwordAccountIdInput').value = accountId;
  getInput('newPasswordInput').value = '';
  getInput('confirmPasswordInput').value = '';
  getInput('passwordModal').showModal();
}

async function handleChangePassword(event) {
  event.preventDefault();
  const accountId = getInput('passwordAccountIdInput').value;
  const password = getInput('newPasswordInput').value;
  const confirmPassword = getInput('confirmPasswordInput').value;
  const minPassword = Math.max(6, Number(state.settings.sicurezza?.minPasswordLength || 6));
  if (password.length < minPassword) throw new Error(`La password deve avere almeno ${minPassword} caratteri.`);
  if (password !== confirmPassword) throw new Error('Le password non coincidono.');
  changeAccountPassword(accountId, password);
  markAccountUpdated(accountId);
  getInput('passwordModal').close();
  await touchSettings('Cambio password', `Aggiornata password per account ${accountId}.`);
}

async function handleCreateBackup() {
  const backup = await creaBackup();
  if (backup.success === false) throw backup.error;
  await persistSettings({
    configurazioni: {
      ultimoBackup: backup.data?.createdAt || new Date().toISOString()
    }
  }, 'Backup locale', `Creato backup alle ${formatDateTime(backup.data?.createdAt)}.`);
}

async function handleRestoreBackup() {
  const confirmed = await showConfirm({
    title: 'Ripristino backup',
    message: 'Confermi il ripristino dell\'ultimo backup disponibile?',
    confirmText: 'Ripristina',
    cancelText: 'Annulla'
  });
  if (!confirmed) return;
  const restored = await ripristinaBackup();
  if (restored.success === false) throw restored.error;
  const refreshed = await loadImpostazioni();
  if (refreshed.success === false) throw refreshed.error;
  state.settings = refreshed.data || state.settings;
  hydrateSections();
  addActivity('Ripristino backup', 'Ripristino configurazione completato.');
}

function downloadJsonFile(fileName, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

function exportEnterpriseBackup() {
  const payload = {
    exportedAt: new Date().toISOString(),
    settings: state.settings,
    activity: state.activity,
    accountMeta: state.accountMeta,
    accounts: readJsonStorage(ACCOUNTS_KEY, [])
  };
  downloadJsonFile(`dg-backup-${new Date().toISOString().slice(0, 10)}.json`, payload);
  addActivity('Esportazione configurazione', 'Backup JSON esportato.');
}

async function importEnterpriseBackup(file) {
  const text = await file.text();
  const payload = JSON.parse(text);
  if (payload?.settings) {
    const saved = await salvaImpostazioni(payload.settings);
    if (saved.success === false) throw saved.error;
    state.settings = saved.data || state.settings;
  }
  if (Array.isArray(payload?.activity)) {
    state.activity = payload.activity.slice(0, 300);
  }
  if (payload?.accountMeta && typeof payload.accountMeta === 'object') {
    state.accountMeta = payload.accountMeta;
  }
  if (Array.isArray(payload?.accounts)) {
    window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(payload.accounts));
  }
  persistLocalState();
  hydrateSections();
  addActivity('Import configurazione', 'Configurazione importata con successo.');
}

function exportActivityLog() {
  downloadJsonFile(`dg-activity-log-${new Date().toISOString().slice(0, 10)}.json`, state.activity);
}

async function clearActivityLog() {
  const confirmed = await showConfirm({
    title: 'Svuota registro attività',
    message: 'Confermi la cancellazione completa del registro attività?',
    confirmText: 'Svuota',
    cancelText: 'Annulla'
  });
  if (!confirmed) return;
  state.activity = [];
  persistLocalState();
  renderActivityTable();
  renderSystemInfo();
}

function bindAccountTableActions() {
  getInput('accountsTableBody').addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    const accountId = button.dataset.id;
    try {
      if (action === 'edit') openAccountModal(accountId);
      if (action === 'password') openPasswordModal(accountId);
      if (action === 'toggle') await handleToggleAccount(accountId);
      if (action === 'delete') await handleDeleteAccount(accountId);
    } catch (error) {
      setStatus(error?.message || 'Errore gestione account.', 'error');
    }
  });
}

function bindEvents() {
  getInput('saveCompanyBtn').addEventListener('click', async () => {
    try {
      await saveCompanySection();
      setStatus('Informazioni azienda salvate.', 'success');
    } catch (error) {
      setStatus(error?.message || 'Errore salvataggio azienda.', 'error');
    }
  });

  getInput('saveRolesPolicyBtn').addEventListener('click', async () => {
    try {
      await saveRolesPolicySection();
      setStatus('Policy ruoli salvata.', 'success');
    } catch (error) {
      setStatus(error?.message || 'Errore salvataggio policy ruoli.', 'error');
    }
  });

  getInput('saveAppearanceBtn').addEventListener('click', async () => {
    try {
      await saveAppearanceSection();
      setStatus('Aspetto aggiornato.', 'success');
    } catch (error) {
      setStatus(error?.message || 'Errore salvataggio aspetto.', 'error');
    }
  });

  getInput('saveDocumentsBtn').addEventListener('click', async () => {
    try {
      await saveDocumentsSection();
      setStatus('Configurazione documenti aggiornata.', 'success');
    } catch (error) {
      setStatus(error?.message || 'Errore salvataggio documenti.', 'error');
    }
  });

  getInput('saveNotificationsBtn').addEventListener('click', async () => {
    try {
      await saveCommunicationSection();
      setStatus('Comunicazione aggiornata.', 'success');
    } catch (error) {
      setStatus(error?.message || 'Errore salvataggio comunicazione.', 'error');
    }
  });

  getInput('saveConfigBtn').addEventListener('click', async () => {
    try {
      await saveConfigSection();
      setStatus('Configurazione gestionale salvata.', 'success');
    } catch (error) {
      setStatus(error?.message || 'Errore salvataggio configurazione.', 'error');
    }
  });

  getInput('openAccountModalBtn').addEventListener('click', () => openAccountModal());
  getInput('cancelAccountModalBtn').addEventListener('click', () => getInput('accountModal').close());
  getInput('accountForm').addEventListener('submit', async (event) => {
    try {
      await handleSaveAccount(event);
      setStatus('Account salvato con successo.', 'success');
    } catch (error) {
      setStatus(error?.message || 'Errore salvataggio account.', 'error');
    }
  });

  getInput('cancelPasswordModalBtn').addEventListener('click', () => getInput('passwordModal').close());
  getInput('passwordForm').addEventListener('submit', async (event) => {
    try {
      await handleChangePassword(event);
      setStatus('Password aggiornata.', 'success');
    } catch (error) {
      setStatus(error?.message || 'Errore aggiornamento password.', 'error');
    }
  });

  getInput('backupBtn').addEventListener('click', async () => {
    try {
      await handleCreateBackup();
      setStatus('Backup completato.', 'success');
    } catch (error) {
      setStatus(error?.message || 'Errore backup.', 'error');
    }
  });

  getInput('restoreBtn').addEventListener('click', async () => {
    try {
      await handleRestoreBackup();
      setStatus('Ripristino completato.', 'success');
    } catch (error) {
      setStatus(error?.message || 'Errore ripristino backup.', 'error');
    }
  });

  getInput('exportBackupBtn').addEventListener('click', () => {
    exportEnterpriseBackup();
    setStatus('Configurazione esportata.', 'success');
  });

  getInput('importBackupInput').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await importEnterpriseBackup(file);
      setStatus('Configurazione importata.', 'success');
    } catch (error) {
      setStatus(error?.message || 'Errore import configurazione.', 'error');
    } finally {
      event.target.value = '';
    }
  });

  getInput('exportActivityBtn').addEventListener('click', () => {
    exportActivityLog();
    setStatus('Registro attività esportato.', 'success');
  });

  getInput('clearActivityBtn').addEventListener('click', async () => {
    try {
      await clearActivityLog();
      setStatus('Registro attività svuotato.', 'success');
    } catch (error) {
      setStatus(error?.message || 'Errore svuotamento registro.', 'error');
    }
  });

  getInput('logoutBtn').addEventListener('click', () => {
    logout();
    window.location.href = ADMIN_ROUTES.login;
  });

  bindAccountTableActions();
}

async function init() {
  loadLocalState();
  const settingsResponse = await loadImpostazioni();
  if (settingsResponse.success === false) throw settingsResponse.error;
  state.settings = settingsResponse.data || defaultSettings();
  hydrateSections();
  bindEvents();
  const company = buildCompanyInfo(state.settings);
  document.title = `Impostazioni Workspace | ${company.name}`;
}

init().catch((error) => {
  setStatus(error?.message || 'Errore inizializzazione impostazioni.', 'error');
});
