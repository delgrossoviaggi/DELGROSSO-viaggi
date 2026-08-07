import { getImpostazioni, saveImpostazioni } from '../js/delgrosso-api.js';
import defaultLogoUrl from '../assets/images/logo.JPEG';

const BACKUP_KEY = 'gestionale-backup-v1';
const SETTINGS_CACHE_KEY = 'dg_runtime_settings_cache_v2';
const DEFAULT_LOGO = defaultLogoUrl;
const DEFAULT_FAVICON = '/favicon.png';

function success(data) {
  return { success: true, data, error: null };
}

function failure(error) {
  return { success: false, data: null, error: error instanceof Error ? error : new Error(String(error || 'Errore')) };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(base, patch) {
  if (!isPlainObject(base)) return isPlainObject(patch) ? { ...patch } : patch;
  const output = { ...base };
  for (const [key, value] of Object.entries(patch || {})) {
    if (isPlainObject(value) && isPlainObject(output[key])) {
      output[key] = deepMerge(output[key], value);
      continue;
    }
    output[key] = value;
  }
  return output;
}

function readLocalJson(key, fallback = null) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (_error) {
    return fallback;
  }
}

function writeLocalJson(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function normalizeText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'si', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function toNumber(value, fallback = 0) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : fallback;
}

function parsePayloadJson(value) {
  if (isPlainObject(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return isPlainObject(parsed) ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function isMissingSettingsTableError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('impostazioni') && (
    message.includes('does not exist')
    || message.includes('relation')
    || message.includes('schema cache')
    || message.includes('could not find')
  );
}

function hexToRgb(hex) {
  const normalized = String(hex || '').replace('#', '').trim();
  if (!/^[\da-f]{6}$/i.test(normalized)) return null;
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16)
  };
}

function rgbToHex(rgb) {
  if (!rgb) return '#000000';
  return `#${[rgb.r, rgb.g, rgb.b]
    .map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0'))
    .join('')}`;
}

function mixHex(baseHex, mixHexValue, ratio) {
  const base = hexToRgb(baseHex);
  const mix = hexToRgb(mixHexValue);
  if (!base || !mix) return baseHex;
  const factor = Math.max(0, Math.min(1, ratio));
  return rgbToHex({
    r: base.r + ((mix.r - base.r) * factor),
    g: base.g + ((mix.g - base.g) * factor),
    b: base.b + ((mix.b - base.b) * factor)
  });
}

export function defaultSettings() {
  return {
    azienda: {
      nome: 'Del Grosso Viaggi & Limousine Bus',
      piva: '',
      email: 'info@delgrossoviaggi.it',
      telefono: '+39 320 5730466',
      whatsapp: '393205730466',
      pec: '',
      indirizzo: '',
      website: '',
      logo: DEFAULT_LOGO,
      favicon: DEFAULT_FAVICON,
      supportLabel: 'Supporto Clienti',
      socials: {
        facebook: '',
        instagram: '',
        linkedin: '',
        tiktok: '',
        youtube: ''
      }
    },
    preferenze: {
      temaScuro: false,
      notificheEmail: true,
      backupAutomatico: true,
      aggiornamentoAutomatico: true,
      showCompanyLogo: true,
      colorePrimario: '#0F4C81',
      coloreAccento: '#F57C00',
      coloreSuperficie: '#f5f7fb',
      coloreTesto: '#16212d'
    },
    configurazioni: {
      versione: '1.0.0',
      database: 'Supabase',
      frontend: 'HTML/CSS/JS',
      stato: 'Online',
      ultimoBackup: '',
      supabaseUrl: '',
      supabaseAnonKey: '',
      storageBucketLocandine: 'locandine',
      storageBucketRicevute: 'ricevute-prenotazioni',
      storagePublicBaseUrl: ''
    },
    comunicazione: {
      reportEmail: '',
      smtpHost: '',
      smtpPort: 587,
      smtpSecure: false,
      smtpUsername: '',
      smtpPassword: '',
      smtpFromName: 'Del Grosso Viaggi',
      smtpFromEmail: 'info@delgrossoviaggi.it',
      smtpReplyTo: '',
      whatsappTemplateSupport: '',
      whatsappTemplateCustomer: '',
      whatsappTemplateQuote: ''
    },
    documenti: {
      receiptTitle: 'RICEVUTA PRENOTAZIONE',
      receiptFooter: 'Documento generato automaticamente dal sistema Del Grosso Booking Pro.',
      qrPrefix: 'DG-BOOKING',
      qrNote: 'Presentare questa ricevuta al personale Del Grosso.'
    },
    sicurezza: {
      defaultRole: 'operatore',
      minPasswordLength: 6,
      passwordHint: ''
    }
  };
}

function getLegacyMappedSettings(row, currentDefaults) {
  const companyName = normalizeText(row.azienda || row.ragione_sociale, currentDefaults.azienda.nome);
  const vatNumber = normalizeText(row.piva || row.partita_iva, currentDefaults.azienda.piva);
  const primaryPhone = normalizeText(row.telefono || row.cellulare, currentDefaults.azienda.telefono);
  const website = normalizeText(row.website || row.sito_web, currentDefaults.azienda.website);
  const facebook = normalizeText(row.social_facebook || row.facebook, currentDefaults.azienda.socials.facebook);
  const instagram = normalizeText(row.social_instagram || row.instagram, currentDefaults.azienda.socials.instagram);
  const accentColor = normalizeText(row.colore_accento || row.colore_secondario, currentDefaults.preferenze.coloreAccento);

  return {
    azienda: {
      nome: companyName,
      piva: vatNumber,
      email: normalizeText(row.email, currentDefaults.azienda.email),
      telefono: primaryPhone,
      indirizzo: normalizeText(row.indirizzo, currentDefaults.azienda.indirizzo),
      logo: normalizeText(row.logo, currentDefaults.azienda.logo),
      favicon: normalizeText(row.favicon, currentDefaults.azienda.favicon),
      whatsapp: normalizeText(row.whatsapp, currentDefaults.azienda.whatsapp),
      pec: normalizeText(row.pec, currentDefaults.azienda.pec),
      website,
      supportLabel: normalizeText(row.support_label, currentDefaults.azienda.supportLabel),
      socials: {
        facebook,
        instagram,
        linkedin: normalizeText(row.social_linkedin, currentDefaults.azienda.socials.linkedin),
        tiktok: normalizeText(row.social_tiktok, currentDefaults.azienda.socials.tiktok),
        youtube: normalizeText(row.social_youtube, currentDefaults.azienda.socials.youtube)
      }
    },
    preferenze: {
      temaScuro: toBoolean(row.tema_scuro, currentDefaults.preferenze.temaScuro),
      notificheEmail: toBoolean(row.notifiche_email, currentDefaults.preferenze.notificheEmail),
      backupAutomatico: toBoolean(row.backup_automatico, currentDefaults.preferenze.backupAutomatico),
      aggiornamentoAutomatico: toBoolean(row.aggiornamento_automatico, currentDefaults.preferenze.aggiornamentoAutomatico),
      showCompanyLogo: toBoolean(row.show_company_logo, currentDefaults.preferenze.showCompanyLogo),
      colorePrimario: normalizeText(row.colore_primario, currentDefaults.preferenze.colorePrimario),
      coloreAccento: accentColor,
      coloreSuperficie: normalizeText(row.colore_superficie, currentDefaults.preferenze.coloreSuperficie),
      coloreTesto: normalizeText(row.colore_testo, currentDefaults.preferenze.coloreTesto)
    },
    configurazioni: {
      versione: normalizeText(row.versione, currentDefaults.configurazioni.versione),
      database: normalizeText(row.database, currentDefaults.configurazioni.database),
      frontend: normalizeText(row.frontend, currentDefaults.configurazioni.frontend),
      stato: normalizeText(row.stato, currentDefaults.configurazioni.stato),
      ultimoBackup: normalizeText(row.ultimo_backup, currentDefaults.configurazioni.ultimoBackup),
      supabaseUrl: normalizeText(row.supabase_url, currentDefaults.configurazioni.supabaseUrl),
      supabaseAnonKey: normalizeText(row.supabase_anon_key, currentDefaults.configurazioni.supabaseAnonKey),
      storageBucketLocandine: normalizeText(row.storage_bucket_locandine, currentDefaults.configurazioni.storageBucketLocandine),
      storageBucketRicevute: normalizeText(row.storage_bucket_ricevute, currentDefaults.configurazioni.storageBucketRicevute),
      storagePublicBaseUrl: normalizeText(row.storage_public_base_url, currentDefaults.configurazioni.storagePublicBaseUrl)
    },
    comunicazione: {
      reportEmail: normalizeText(row.report_email, currentDefaults.comunicazione.reportEmail),
      smtpHost: normalizeText(row.smtp_host, currentDefaults.comunicazione.smtpHost),
      smtpPort: toNumber(row.smtp_port, currentDefaults.comunicazione.smtpPort),
      smtpSecure: toBoolean(row.smtp_secure, currentDefaults.comunicazione.smtpSecure),
      smtpUsername: normalizeText(row.smtp_username, currentDefaults.comunicazione.smtpUsername),
      smtpPassword: normalizeText(row.smtp_password, currentDefaults.comunicazione.smtpPassword),
      smtpFromName: normalizeText(row.smtp_from_name, currentDefaults.comunicazione.smtpFromName),
      smtpFromEmail: normalizeText(row.smtp_from_email, currentDefaults.comunicazione.smtpFromEmail),
      smtpReplyTo: normalizeText(row.smtp_reply_to, currentDefaults.comunicazione.smtpReplyTo),
      whatsappTemplateSupport: normalizeText(row.wa_template_support, currentDefaults.comunicazione.whatsappTemplateSupport),
      whatsappTemplateCustomer: normalizeText(row.wa_template_customer, currentDefaults.comunicazione.whatsappTemplateCustomer),
      whatsappTemplateQuote: normalizeText(row.wa_template_quote, currentDefaults.comunicazione.whatsappTemplateQuote)
    },
    documenti: {
      receiptTitle: normalizeText(row.receipt_title, currentDefaults.documenti.receiptTitle),
      receiptFooter: normalizeText(row.receipt_footer, currentDefaults.documenti.receiptFooter),
      qrPrefix: normalizeText(row.qr_prefix, currentDefaults.documenti.qrPrefix),
      qrNote: normalizeText(row.qr_note, currentDefaults.documenti.qrNote)
    },
    sicurezza: {
      defaultRole: normalizeText(row.default_role, currentDefaults.sicurezza.defaultRole),
      minPasswordLength: Math.max(6, toNumber(row.min_password_length, currentDefaults.sicurezza.minPasswordLength)),
      passwordHint: normalizeText(row.password_hint, currentDefaults.sicurezza.passwordHint)
    }
  };
}

export function toNestedSettings(row = {}) {
  const defaults = defaultSettings();
  const payload = parsePayloadJson(row.payload_json);
  const merged = deepMerge(defaults, payload);
  return deepMerge(merged, getLegacyMappedSettings(row, merged));
}

function toPersistedRow(settings = {}) {
  const normalized = deepMerge(defaultSettings(), settings);
  return {
    azienda: normalized.azienda.nome,
    ragione_sociale: normalized.azienda.nome,
    piva: normalized.azienda.piva,
    partita_iva: normalized.azienda.piva,
    email: normalized.azienda.email,
    telefono: normalized.azienda.telefono,
    cellulare: normalized.azienda.telefono,
    whatsapp: normalized.azienda.whatsapp,
    pec: normalized.azienda.pec,
    indirizzo: normalized.azienda.indirizzo,
    website: normalized.azienda.website,
    sito_web: normalized.azienda.website,
    logo: normalized.azienda.logo,
    favicon: normalized.azienda.favicon,
    support_label: normalized.azienda.supportLabel,
    social_facebook: normalized.azienda.socials.facebook,
    facebook: normalized.azienda.socials.facebook,
    social_instagram: normalized.azienda.socials.instagram,
    instagram: normalized.azienda.socials.instagram,
    social_linkedin: normalized.azienda.socials.linkedin,
    social_tiktok: normalized.azienda.socials.tiktok,
    social_youtube: normalized.azienda.socials.youtube,
    tema_scuro: Boolean(normalized.preferenze.temaScuro),
    notifiche_email: Boolean(normalized.preferenze.notificheEmail),
    backup_automatico: Boolean(normalized.preferenze.backupAutomatico),
    aggiornamento_automatico: Boolean(normalized.preferenze.aggiornamentoAutomatico),
    show_company_logo: Boolean(normalized.preferenze.showCompanyLogo),
    colore_primario: normalized.preferenze.colorePrimario,
    colore_accento: normalized.preferenze.coloreAccento,
    colore_secondario: normalized.preferenze.coloreAccento,
    colore_superficie: normalized.preferenze.coloreSuperficie,
    colore_testo: normalized.preferenze.coloreTesto,
    versione: normalized.configurazioni.versione,
    database: normalized.configurazioni.database,
    frontend: normalized.configurazioni.frontend,
    stato: normalized.configurazioni.stato,
    ultimo_backup: normalized.configurazioni.ultimoBackup,
    supabase_url: normalized.configurazioni.supabaseUrl,
    supabase_anon_key: normalized.configurazioni.supabaseAnonKey,
    storage_bucket_locandine: normalized.configurazioni.storageBucketLocandine,
    storage_bucket_ricevute: normalized.configurazioni.storageBucketRicevute,
    storage_public_base_url: normalized.configurazioni.storagePublicBaseUrl,
    report_email: normalized.comunicazione.reportEmail,
    smtp_host: normalized.comunicazione.smtpHost,
    smtp_port: normalized.comunicazione.smtpPort,
    smtp_secure: Boolean(normalized.comunicazione.smtpSecure),
    smtp_username: normalized.comunicazione.smtpUsername,
    smtp_password: normalized.comunicazione.smtpPassword,
    smtp_from_name: normalized.comunicazione.smtpFromName,
    smtp_from_email: normalized.comunicazione.smtpFromEmail,
    smtp_reply_to: normalized.comunicazione.smtpReplyTo,
    wa_template_support: normalized.comunicazione.whatsappTemplateSupport,
    wa_template_customer: normalized.comunicazione.whatsappTemplateCustomer,
    wa_template_quote: normalized.comunicazione.whatsappTemplateQuote,
    receipt_title: normalized.documenti.receiptTitle,
    receipt_footer: normalized.documenti.receiptFooter,
    qr_prefix: normalized.documenti.qrPrefix,
    qr_note: normalized.documenti.qrNote,
    default_role: normalized.sicurezza.defaultRole,
    min_password_length: normalized.sicurezza.minPasswordLength,
    password_hint: normalized.sicurezza.passwordHint,
    payload_json: normalized
  };
}

function cacheSettings(settings) {
  writeLocalJson(SETTINGS_CACHE_KEY, settings);
}

export function getCachedSettingsSync() {
  return deepMerge(defaultSettings(), readLocalJson(SETTINGS_CACHE_KEY, {}));
}

export function buildCompanyInfo(settings = defaultSettings()) {
  const normalized = deepMerge(defaultSettings(), settings);
  const whatsappDigits = String(normalized.azienda.whatsapp || normalized.azienda.telefono || '')
    .replace(/[^\d+]/g, '')
    .replace(/^\+/, '');

  return {
    name: normalized.azienda.nome,
    phone: normalized.azienda.telefono,
    email: normalized.azienda.email,
    whatsapp: whatsappDigits,
    address: normalized.azienda.indirizzo,
    pec: normalized.azienda.pec,
    website: normalized.azienda.website,
    logo: normalized.azienda.logo || DEFAULT_LOGO,
    favicon: normalized.azienda.favicon || DEFAULT_FAVICON,
    socials: normalized.azienda.socials,
    receiptTitle: normalized.documenti.receiptTitle,
    receiptFooter: normalized.documenti.receiptFooter,
    qrPrefix: normalized.documenti.qrPrefix,
    qrNote: normalized.documenti.qrNote,
    whatsappTemplateSupport: normalized.comunicazione.whatsappTemplateSupport,
    whatsappTemplateCustomer: normalized.comunicazione.whatsappTemplateCustomer,
    whatsappTemplateQuote: normalized.comunicazione.whatsappTemplateQuote,
    supportLabel: normalized.azienda.supportLabel
  };
}

export function interpolateTemplate(template, values = {}) {
  const source = String(template || '').trim();
  if (!source) return '';
  return source.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_full, key) => {
    const value = values[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

function ensureIconLink(href) {
  let link = document.querySelector('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = href;
}

function setCssVariables(settings) {
  const root = document.documentElement;
  const primary = normalizeText(settings.preferenze?.colorePrimario, '#0F4C81');
  const accent = normalizeText(settings.preferenze?.coloreAccento, '#F57C00');
  const surface = normalizeText(settings.preferenze?.coloreSuperficie, '#f5f7fb');
  const text = normalizeText(settings.preferenze?.coloreTesto, '#16212d');
  const darker = mixHex(primary, '#000000', 0.18);
  const darkest = mixHex(primary, '#000000', 0.32);
  const border = mixHex(primary, '#ffffff', 0.72);

  root.style.setProperty('--dg-primary', primary);
  root.style.setProperty('--dg-accent', accent);
  root.style.setProperty('--dg-surface', surface);
  root.style.setProperty('--dg-card', '#ffffff');
  root.style.setProperty('--dg-text', text);
  root.style.setProperty('--dg-border', border);
  root.style.setProperty('--ocean-500', primary);
  root.style.setProperty('--ocean-700', darker);
  root.style.setProperty('--ocean-800', darkest);
}

function updateTextTargets(company) {
  document.querySelectorAll('[data-runtime-company-name]').forEach((node) => {
    node.textContent = company.name;
  });
  document.querySelectorAll('[data-runtime-company-phone]').forEach((node) => {
    node.textContent = company.phone;
  });
  document.querySelectorAll('[data-runtime-company-email]').forEach((node) => {
    node.textContent = company.email;
  });
  document.querySelectorAll('[data-runtime-company-address]').forEach((node) => {
    node.textContent = company.address || 'Indirizzo non configurato';
  });
}

function updateLinkTargets(company) {
  document.querySelectorAll('[data-runtime-whatsapp-link]').forEach((node) => {
    if (!company.whatsapp) return;
    node.href = `https://wa.me/${company.whatsapp}`;
  });
  document.querySelectorAll('[data-runtime-email-link]').forEach((node) => {
    if (!company.email) return;
    node.href = `mailto:${company.email}`;
  });
  document.querySelectorAll('[data-runtime-phone-link]').forEach((node) => {
    if (!company.phone) return;
    node.href = `tel:${company.phone.replace(/[^\d+]/g, '')}`;
  });
  document.querySelectorAll('[data-runtime-website-link]').forEach((node) => {
    if (!company.website) return;
    node.href = company.website;
  });
  document.querySelectorAll('[data-runtime-pec-link]').forEach((node) => {
    if (!company.pec) return;
    node.href = `mailto:${company.pec}`;
    node.textContent = company.pec;
  });
}

function updateLogoTargets(company) {
  document.documentElement.style.setProperty('--dg-runtime-logo-url', `url("${company.logo || DEFAULT_LOGO}")`);
  document.querySelectorAll('[data-runtime-logo]').forEach((img) => {
    img.src = company.logo || DEFAULT_LOGO;
    img.alt = company.name;
  });
}

function renderPublicContacts(company) {
  document.querySelectorAll('[data-runtime-contact-stack]').forEach((container) => {
    container.innerHTML = `
      <div class="contact-pill">
        <div class="contact-pill__text">
          <span class="contact-pill__label">${company.supportLabel || 'Supporto Clienti'}</span>
          <span class="contact-pill__value">${company.phone || 'Telefono non configurato'}</span>
        </div>
        ${company.whatsapp ? `<a class="whatsapp-badge" href="https://wa.me/${company.whatsapp}" target="_blank" rel="noopener noreferrer">WhatsApp</a>` : ''}
      </div>
      <div class="contact-pill">
        <div class="contact-pill__text">
          <span class="contact-pill__label" style="color:#a5b4fc;">Email & PEC</span>
          <span class="contact-pill__value">${company.email || 'Email non configurata'}${company.pec ? ` · ${company.pec}` : ''}</span>
        </div>
        ${company.email ? `<a class="whatsapp-badge" href="mailto:${company.email}">Email</a>` : ''}
      </div>
    `;
  });
}

function renderSocialLinks(company) {
  const entries = [
    { key: 'instagram', label: 'Instagram', value: company.socials?.instagram || '' },
    { key: 'facebook', label: 'Facebook', value: company.socials?.facebook || '' },
    { key: 'linkedin', label: 'LinkedIn', value: company.socials?.linkedin || '' },
    { key: 'tiktok', label: 'TikTok', value: company.socials?.tiktok || '' },
    { key: 'youtube', label: 'YouTube', value: company.socials?.youtube || '' }
  ].filter((entry) => entry.value);

  document.querySelectorAll('[data-runtime-social-grid]').forEach((container) => {
    if (!entries.length) {
      container.innerHTML = '<p style="margin:0;color:#cbd5e1;">Canali social non configurati.</p>';
      return;
    }
    container.innerHTML = entries.map((entry) => `
      <a class="social-link" href="${entry.value}" target="_blank" rel="noopener noreferrer">
        <span><span>${entry.label}</span><small>${entry.value.replace(/^https?:\/\//, '')}</small></span>
        <span class="social-link__arrow">&nearr;</span>
      </a>
    `).join('');
  });
}

export function applyRuntimeSettings(settings = defaultSettings(), options = {}) {
  if (typeof document === 'undefined') return;
  const normalized = deepMerge(defaultSettings(), settings);
  const company = buildCompanyInfo(normalized);
  setCssVariables(normalized);
  ensureIconLink(company.favicon || DEFAULT_FAVICON);
  if (options.applyThemePreference && normalized.preferenze?.temaScuro !== undefined) {
    document.documentElement.dataset.theme = normalized.preferenze.temaScuro ? 'dark' : 'light';
  }
  updateLogoTargets(company);
  updateTextTargets(company);
  updateLinkTargets(company);
  renderPublicContacts(company);
  renderSocialLinks(company);
}

export async function loadImpostazioni() {
  try {
    const response = await getImpostazioni();
    if (response.success === false) {
      if (isMissingSettingsTableError(response.error)) {
        return success(getCachedSettingsSync());
      }
      return response;
    }
    const normalized = toNestedSettings(response.data || {});
    cacheSettings(normalized);
    return success(normalized);
  } catch (error) {
    if (isMissingSettingsTableError(error)) {
      return success(getCachedSettingsSync());
    }
    return failure(error);
  }
}

export async function salvaImpostazioni(data) {
  const current = await loadImpostazioni();
  if (current.success === false) return current;
  const next = deepMerge(current.data, data || {});
  const saved = await saveImpostazioni(toPersistedRow(next));
  if (saved.success === false) return saved;
  const normalized = toNestedSettings(saved.data || toPersistedRow(next));
  cacheSettings(normalized);
  return success(normalized);
}

export async function creaBackup() {
  try {
    const settings = await loadImpostazioni();
    if (settings.success === false) return settings;
    const backup = { settings: settings.data, createdAt: new Date().toISOString() };
    window.localStorage.setItem(BACKUP_KEY, JSON.stringify(backup));
    return success(backup);
  } catch (error) {
    return failure(error);
  }
}

export async function ripristinaBackup() {
  try {
    const raw = window.localStorage.getItem(BACKUP_KEY);
    if (!raw) return failure(new Error('Nessun backup trovato'));
    const backup = JSON.parse(raw);
    const restored = await salvaImpostazioni(backup.settings || {});
    if (restored.success === false) return restored;
    return success(backup);
  } catch (error) {
    return failure(error);
  }
}

export const settingsService = {
  getAll: async () => {
    const response = await loadImpostazioni();
    if (response.success === false) return response;
    return success([response.data]);
  }
};
