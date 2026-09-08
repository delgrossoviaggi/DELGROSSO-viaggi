import { creaPreventivoPubblico } from './bridge.js';
import {
  applyRuntimeSettings,
  buildCompanyInfo,
  getCachedSettingsSync,
  loadImpostazioni
} from '../services/settingsService.js';

let companyInfo = buildCompanyInfo(getCachedSettingsSync());
applyRuntimeSettings(getCachedSettingsSync());

const ui = {
  form: document.getElementById('publicQuoteForm'),
  submit: document.getElementById('quoteSubmit'),
  message: document.getElementById('formMessage'),
  mobileToggle: document.getElementById('mobileToggle'),
  mobileStrip: document.getElementById('mobileStrip'),
  whatsAppLinks: Array.from(document.querySelectorAll('#quoteWhatsAppHero, #quoteWhatsAppAside, #quoteWhatsAppInline')),
  fields: {
    nome: document.getElementById('quoteNome'),
    cognome: document.getElementById('quoteCognome'),
    telefono: document.getElementById('quoteTelefono'),
    email: document.getElementById('quoteEmail'),
    servizio: document.getElementById('quoteServizio'),
    passeggeri: document.getElementById('quotePasseggeri'),
    destinazione: document.getElementById('quoteDestinazione'),
    partenza: document.getElementById('quotePartenza'),
    dataPartenza: document.getElementById('quoteDataPartenza'),
    noteCliente: document.getElementById('quoteNoteCliente')
  }
};

function normalizeText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizePhone(value, fallback = '393205730466') {
  const digits = String(value ?? '').replace(/[^\d+]/g, '');
  if (!digits) return fallback;
  if (digits.startsWith('+')) return digits.slice(1);
  if (digits.startsWith('00')) return digits.slice(2);
  return digits;
}

function showMessage(text, isError = false) {
  ui.message.textContent = text;
  ui.message.classList.remove('hidden');
  ui.message.style.borderColor = isError ? 'rgba(239, 68, 68, 0.3)' : 'rgba(186, 230, 253, 0.9)';
  ui.message.style.background = isError ? 'rgba(254, 242, 242, 0.96)' : 'rgba(240, 249, 255, 0.92)';
  ui.message.style.color = isError ? '#b91c1c' : '#075985';
}

function readPayload() {
  return {
    nome: normalizeText(ui.fields.nome.value),
    cognome: normalizeText(ui.fields.cognome.value),
    telefono: normalizeText(ui.fields.telefono.value),
    email: normalizeText(ui.fields.email.value),
    servizio_richiesto: ui.fields.servizio.value,
    passeggeri: Number(ui.fields.passeggeri.value || 1),
    destinazione: normalizeText(ui.fields.destinazione.value),
    partenza: normalizeText(ui.fields.partenza.value),
    luogo_partenza: normalizeText(ui.fields.partenza.value),
    data_partenza: ui.fields.dataPartenza.value || null,
    note_cliente: normalizeText(ui.fields.noteCliente.value)
  };
}

function buildWhatsAppMessage(payload, quoteCode = '') {
  return [
    'Buongiorno Del Grosso Viaggi,',
    'vorrei richiedere un preventivo.',
    '',
    `Nome: ${payload.nome} ${payload.cognome}`.trim(),
    `Telefono: ${payload.telefono}`,
    `Email: ${payload.email}`,
    `Partenza: ${payload.partenza}`,
    `Destinazione: ${payload.destinazione}`,
    `Data: ${payload.data_partenza || 'da definire'}`,
    `Passeggeri: ${payload.passeggeri}`,
    `Servizio: ${payload.servizio_richiesto}`,
    `Note: ${payload.note_cliente || 'nessuna'}`,
    quoteCode ? `Codice preventivo: ${quoteCode}` : ''
  ].filter(Boolean).join('\n');
}

function updateWhatsAppLinks(payload = readPayload(), quoteCode = '') {
  const recipient = normalizePhone(companyInfo.whatsapp, '393205730466');
  const href = `https://wa.me/${recipient}?text=${encodeURIComponent(buildWhatsAppMessage(payload, quoteCode))}`;
  ui.whatsAppLinks.forEach((link) => {
    link.href = href;
  });
}

function applyQueryPrefill() {
  const params = new URLSearchParams(window.location.search);
  const destination = params.get('destinazione');
  if (destination) ui.fields.destinazione.value = destination;
}

function bindMobileMenu() {
  if (!ui.mobileToggle || !ui.mobileStrip) return;
  ui.mobileToggle.addEventListener('click', () => {
    ui.mobileStrip.classList.toggle('hidden');
  });
}

function bindRealtimeWhatsAppPreview() {
  Object.values(ui.fields).forEach((field) => {
    field?.addEventListener('input', () => updateWhatsAppLinks());
    field?.addEventListener('change', () => updateWhatsAppLinks());
  });
}

async function handleSubmit(event) {
  event.preventDefault();
  ui.submit.disabled = true;
  ui.submit.textContent = 'Invio in corso...';
  ui.message.classList.add('hidden');

  try {
    const payload = readPayload();
    const result = await creaPreventivoPubblico(payload);
    const quote = result?.data;
    if (result?.success === false) throw result.error;
    ui.form.reset();
    ui.fields.passeggeri.value = '1';
    updateWhatsAppLinks(payload, quote?.codice || '');
    showMessage(`Richiesta inviata correttamente. Codice preventivo: ${quote?.codice || 'in elaborazione'}. Ti contatteremo al più presto.`);
  } catch (error) {
    showMessage(error.message || 'Invio preventivo non riuscito.', true);
  } finally {
    ui.submit.disabled = false;
    ui.submit.innerHTML = '<i class="fas fa-paper-plane"></i> Invia richiesta';
  }
}

async function init() {
  const response = await loadImpostazioni();
  if (response?.success === false) {
    console.error('Impossibile caricare le impostazioni pubbliche.', response.error);
  } else if (response?.data) {
    companyInfo = buildCompanyInfo(response.data);
    applyRuntimeSettings(response.data);
  }
  applyQueryPrefill();
  updateWhatsAppLinks();
  bindRealtimeWhatsAppPreview();
  bindMobileMenu();
  ui.form.addEventListener('submit', handleSubmit);
}

init();
