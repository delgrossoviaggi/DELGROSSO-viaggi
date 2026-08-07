import { quoteService } from '../../services/quoteService.js';
import { tripService } from '../../services/tripService.js';
import { downloadQuotePdf } from '../../services/quotePdfService.js';
import { prepareQuoteMailtoLink, prepareQuoteWhatsAppDispatch } from '../../services/quoteCommunicationService.js';
import { showConfirm, showMessage } from '../../components/messageSystem.js';
import { extractData } from '../../utils/serviceResult.js';
import { buildCompanyInfo, getCachedSettingsSync, loadImpostazioni } from '../../services/settingsService.js';
import { ADMIN_ROUTES } from '../../utils/appRoutes.js';

let COMPANY_INFO = buildCompanyInfo(getCachedSettingsSync());
const ALLOWED_SERVICES = ['Gran Turismo', 'Limousine Bus', 'Navetta Eventi', 'Viaggio di Gruppo'];
const QUOTE_FLASH_KEY = 'dg_preventivi_flash';

const state = {
  quotes: [],
  trips: [],
  activeConvertQuoteId: null
};

const els = {
  search: document.getElementById('quoteSearch'),
  statusFilter: document.getElementById('quoteStatusFilter'),
  countLabel: document.getElementById('quoteCountLabel'),
  btnNew: document.getElementById('btnNewQuote'),
  tbody: document.querySelector('#quoteTable tbody'),
  statActive: document.getElementById('statActive'),
  statPending: document.getElementById('statPending'),
  statSent: document.getElementById('statSent'),
  statConverted: document.getElementById('statConverted'),
  quoteModal: document.getElementById('quoteModal'),
  quoteModalTitle: document.getElementById('quoteModalTitle'),
  quoteForm: document.getElementById('quoteForm'),
  closeQuoteModal: document.getElementById('closeQuoteModal'),
  cancelQuoteModal: document.getElementById('cancelQuoteModal'),
  saveQuote: document.getElementById('saveQuote'),
  fields: {
    id: document.getElementById('quoteId'),
    nome: document.getElementById('quoteNome'),
    cognome: document.getElementById('quoteCognome'),
    telefono: document.getElementById('quoteTelefono'),
    email: document.getElementById('quoteEmail'),
    azienda: document.getElementById('quoteAzienda'),
    origine: document.getElementById('quoteOrigine'),
    stato: document.getElementById('quoteStato'),
    servizio: document.getElementById('quoteServizio'),
    destinazione: document.getElementById('quoteDestinazione'),
    partenza: document.getElementById('quotePartenza'),
    dataPartenza: document.getElementById('quoteDataPartenza'),
    dataRitorno: document.getElementById('quoteDataRitorno'),
    passeggeri: document.getElementById('quotePasseggeri'),
    importo: document.getElementById('quoteImporto'),
    validita: document.getElementById('quoteValidita'),
    noteCliente: document.getElementById('quoteNoteCliente'),
    dettagli: document.getElementById('quoteDettagli'),
    noteInterne: document.getElementById('quoteNoteInterne')
  },
  convertModal: document.getElementById('convertModal'),
  closeConvertModal: document.getElementById('closeConvertModal'),
  cancelConvert: document.getElementById('cancelConvert'),
  confirmConvert: document.getElementById('confirmConvert'),
  convertTripSelect: document.getElementById('convertTripSelect'),
  convertQuoteMeta: document.getElementById('convertQuoteMeta')
};

let unsubscribeQuotes = null;
let unsubscribeTrips = null;

function lower(value) {
  return String(value || '').trim().toLowerCase();
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function formatCurrency(value) {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function statusClass(status) {
  const normalized = lower(status).replace(/\s+/g, '-');
  if (normalized === 'inviato') return 'status-inviato';
  if (normalized === 'accettato') return 'status-accettato';
  if (normalized === 'rifiutato') return 'status-rifiutato';
  if (normalized === 'in-lavorazione') return 'status-in-lavorazione';
  if (normalized === 'convertito') return 'status-convertito';
  return 'status-nuovo';
}

function normalizeRequestedService(value) {
  const service = String(value || '').trim();
  if (ALLOWED_SERVICES.includes(service)) return service;
  return 'Gran Turismo';
}

function setModalOpen(modal, open) {
  if (!modal) return;
  modal.classList.toggle('open', open);
  modal.classList.toggle('hidden', !open);
  modal.style.display = open ? 'flex' : 'none';
  modal.setAttribute('aria-hidden', open ? 'false' : 'true');
}

function queueFlashMessage(message, type = 'success') {
  try {
    window.sessionStorage.setItem(QUOTE_FLASH_KEY, JSON.stringify({
      type,
      message,
      createdAt: Date.now()
    }));
  } catch (_error) {
    // Ignore sessionStorage failures and continue with navigation.
  }
}

function consumeFlashMessage() {
  try {
    const raw = window.sessionStorage.getItem(QUOTE_FLASH_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(QUOTE_FLASH_KEY);
    const parsed = JSON.parse(raw);
    if (!parsed?.message) return null;
    return parsed;
  } catch (_error) {
    return null;
  }
}

function resetQuoteForm() {
  els.quoteForm.reset();
  els.fields.id.value = '';
  els.fields.passeggeri.value = '1';
  els.fields.origine.value = 'gestionale';
  els.fields.stato.value = 'Nuovo';
  els.quoteModalTitle.textContent = 'Nuovo preventivo';
}

function setQuoteFormReadOnly(readOnly) {
  const controls = els.quoteForm.querySelectorAll('input, select, textarea');
  controls.forEach((control) => {
    if (control.id === 'quoteId') return;
    control.disabled = readOnly;
  });
  els.saveQuote.classList.toggle('hidden', readOnly);
}

function openQuoteModal(quote = null, options = {}) {
  const readOnly = Boolean(options.readOnly);
  resetQuoteForm();
  if (quote) {
    els.quoteModalTitle.textContent = `${readOnly ? 'Visualizza' : 'Modifica'} ${quote.numero_preventivo || quote.codice || 'preventivo'}`;
    els.fields.id.value = quote.id || '';
    els.fields.nome.value = quote.nome || '';
    els.fields.cognome.value = quote.cognome || '';
    els.fields.telefono.value = quote.telefono || '';
    els.fields.email.value = quote.email || '';
    els.fields.azienda.value = quote.azienda || '';
    els.fields.origine.value = quote.origine || 'gestionale';
    els.fields.stato.value = quote.stato || 'Nuovo';
    els.fields.servizio.value = normalizeRequestedService(quote.servizio_richiesto || quote.servizio);
    els.fields.destinazione.value = quote.destinazione || '';
    els.fields.partenza.value = quote.partenza || '';
    els.fields.dataPartenza.value = quote.data_viaggio || quote.data_partenza || '';
    els.fields.dataRitorno.value = quote.data_ritorno || '';
    els.fields.passeggeri.value = String(Math.max(Number(quote.numero_passeggeri || quote.passeggeri || 0), 1));
    els.fields.importo.value = quote.importo || quote.importo_preventivo || '';
    els.fields.validita.value = quote.validita_preventivo || '';
    els.fields.noteCliente.value = quote.note_cliente || '';
    els.fields.dettagli.value = quote.dettagli_offerta || '';
    els.fields.noteInterne.value = quote.note_interne || '';
  }
  setQuoteFormReadOnly(readOnly);
  setModalOpen(els.quoteModal, true);
}

function closeQuoteModal() {
  setQuoteFormReadOnly(false);
  setModalOpen(els.quoteModal, false);
}

function closeConvertModal() {
  state.activeConvertQuoteId = null;
  setModalOpen(els.convertModal, false);
}

function openNewQuotePage() {
  window.location.href = ADMIN_ROUTES.nuovoPreventivo;
}

function filteredQuotes() {
  const term = lower(els.search.value);
  const status = lower(els.statusFilter.value);
  return state.quotes.filter((quote) => {
    const search = `${quote.numero_preventivo || ''} ${quote.codice || ''} ${quote.nome || ''} ${quote.cognome || ''} ${quote.destinazione || ''} ${quote.telefono || ''} ${quote.servizio_richiesto || quote.servizio || ''} ${quote.luogo_partenza || quote.partenza || ''} ${quote.operatore || ''}`.toLowerCase();
    const matchTerm = !term || search.includes(term);
    const matchStatus = !status || lower(quote.stato) === status;
    return matchTerm && matchStatus;
  });
}

function renderStats(quotes) {
  const active = quotes.filter((quote) => !['convertito', 'rifiutato'].includes(lower(quote.stato))).length;
  const pending = quotes.filter((quote) => lower(quote.stato) === 'in lavorazione').length;
  const sent = quotes.filter((quote) => lower(quote.stato) === 'accettato').length;
  const converted = quotes.filter((quote) => lower(quote.stato) === 'rifiutato').length;
  els.statActive.textContent = String(active);
  els.statPending.textContent = String(pending);
  els.statSent.textContent = String(sent);
  els.statConverted.textContent = String(converted);
}

function tripOptions() {
  return state.trips
    .slice()
    .sort((left, right) => new Date(left.data_partenza || 0) - new Date(right.data_partenza || 0))
    .map((trip) => {
      const date = formatDate(trip.data_partenza);
      return `<option value="${trip.id}">${trip.destinazione || trip.titolo || 'Viaggio'} · ${date}</option>`;
    })
    .join('');
}

function rowTemplate(quote) {
  const customer = `${quote.nome || ''} ${quote.cognome || ''}`.trim() || 'Cliente';
  const service = quote.servizio_richiesto || quote.servizio || 'Servizio';
  const amount = quote.importo ?? quote.importo_preventivo ?? 0;
  const proposal = Number(amount) > 0 ? formatCurrency(amount) : 'Da definire';
  const isConverted = Boolean(quote.convertito_prenotazione_id || quote.prenotazione_id || quote.convertito_prenotazione);
  const passengers = Math.max(Number(quote.numero_passeggeri || quote.passeggeri || 1), 1);
  return `
    <tr data-id="${quote.id}">
      <td>
        <strong class="row-title">${quote.numero_preventivo || quote.codice || 'N/D'}</strong>
        <span class="row-subtitle">${formatDate(quote.created_at)}</span>
      </td>
      <td>
        <strong class="row-title">${customer}</strong>
        <span class="row-subtitle">${quote.telefono || 'Telefono non disponibile'}</span>
      </td>
      <td>${service}</td>
      <td>${quote.partenza || quote.luogo_partenza || 'Partenza da definire'}</td>
      <td>${quote.destinazione || 'Destinazione'}</td>
      <td>${passengers}</td>
      <td>
        <span class="mini-pill">${formatDate(quote.data_viaggio || quote.data_partenza)}</span>
      </td>
      <td><span class="status-badge ${statusClass(quote.stato)}">${quote.stato || 'Nuovo'}</span></td>
      <td>${proposal}</td>
      <td>
        <div class="table-actions">
          <button type="button" data-action="view">Visualizza</button>
          <button type="button" data-action="edit">Modifica</button>
          <button type="button" data-action="duplicate">Duplica</button>
          <button type="button" data-action="pdf">PDF</button>
          <button type="button" data-action="whatsapp">WhatsApp</button>
          <button type="button" data-action="email">Email</button>
          <button type="button" data-action="convert" ${isConverted ? 'disabled' : ''}>Prenotazione</button>
          <button type="button" data-action="delete">Elimina</button>
        </div>
      </td>
    </tr>
  `;
}

function renderTable() {
  const quotes = filteredQuotes();
  renderStats(state.quotes);
  els.countLabel.textContent = quotes.length === 1 ? '1 preventivo' : `${quotes.length} preventivi`;
  if (!quotes.length) {
    els.tbody.innerHTML = '<tr><td colspan="10" class="empty-state">Nessun preventivo trovato con i filtri correnti.</td></tr>';
    return;
  }
  els.tbody.innerHTML = quotes.map(rowTemplate).join('');
}

async function loadData(showSuccess = false) {
  const [quotesResult, tripsResult] = await Promise.all([
    quoteService.all(),
    tripService.getAll()
  ]);

  state.quotes = extractData(quotesResult, []);
  state.trips = extractData(tripsResult, []);
  renderTable();
  if (showSuccess) {
    showMessage({ type: 'success', title: 'Preventivi', message: 'Elenco preventivi aggiornato.' });
  }
}

function readFormPayload() {
  return {
    nome: els.fields.nome.value.trim(),
    cognome: els.fields.cognome.value.trim(),
    telefono: els.fields.telefono.value.trim(),
    email: els.fields.email.value.trim(),
    azienda: els.fields.azienda.value.trim(),
    origine: els.fields.origine.value,
    stato: els.fields.stato.value,
    servizio_richiesto: normalizeRequestedService(els.fields.servizio.value),
    destinazione: els.fields.destinazione.value.trim(),
    luogo_partenza: els.fields.partenza.value.trim(),
    partenza: els.fields.partenza.value.trim(),
    servizio: normalizeRequestedService(els.fields.servizio.value),
    data_partenza: els.fields.dataPartenza.value || null,
    data_viaggio: els.fields.dataPartenza.value || null,
    data_ritorno: els.fields.dataRitorno.value || null,
    numero_passeggeri: Number(els.fields.passeggeri.value || 1),
    passeggeri: Number(els.fields.passeggeri.value || 1),
    importo: Number(els.fields.importo.value || 0),
    importo_preventivo: Number(els.fields.importo.value || 0),
    messaggio: els.fields.noteCliente.value.trim(),
    validita_preventivo: els.fields.validita.value || null,
    note_cliente: els.fields.noteCliente.value.trim(),
    dettagli_offerta: els.fields.dettagli.value.trim(),
    note_interne: els.fields.noteInterne.value.trim()
  };
}

async function saveQuote(event) {
  event.preventDefault();
  const id = els.fields.id.value;
  const payload = readFormPayload();
  const result = id ? await quoteService.update(id, payload) : await quoteService.create(payload);
  extractData(result, null);
  closeQuoteModal();
  await loadData();
  showMessage({ type: 'success', title: 'Preventivi', message: id ? 'Preventivo aggiornato.' : 'Preventivo creato.' });
}

function getQuoteById(id) {
  return state.quotes.find((quote) => String(quote.id) === String(id)) || null;
}

async function handleTableAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const row = button.closest('tr');
  const quote = getQuoteById(row?.dataset.id);
  if (!quote) return;

  const action = button.dataset.action;
  if (action === 'edit') {
    openQuoteModal(quote);
    return;
  }
  if (action === 'view') {
    openQuoteModal(quote, { readOnly: true });
    return;
  }

  if (action === 'duplicate') {
    extractData(await quoteService.duplicate(quote.id), null);
    await loadData();
    showMessage({ type: 'success', title: 'Preventivi', message: 'Preventivo duplicato.' });
    return;
  }

  if (action === 'pdf') {
    await downloadQuotePdf(quote, COMPANY_INFO);
    showMessage({ type: 'success', title: 'Preventivi', message: 'PDF preventivo generato.' });
    return;
  }

  if (action === 'whatsapp') {
    const dispatch = prepareQuoteWhatsAppDispatch({ quote, messageTemplate: COMPANY_INFO.whatsappTemplateQuote });
    window.open(dispatch.waMeUrl, '_blank', 'noopener,noreferrer');
    if (lower(quote.stato) === 'nuovo' || lower(quote.stato) === 'in lavorazione') {
      await quoteService.update(quote.id, { stato: 'Inviato' });
      await loadData();
    }
    return;
  }

  if (action === 'email') {
    window.location.href = prepareQuoteMailtoLink({ quote });
    if (lower(quote.stato) === 'nuovo' || lower(quote.stato) === 'in lavorazione') {
      await quoteService.update(quote.id, { stato: 'Inviato' });
      await loadData();
    }
    return;
  }

  if (action === 'convert') {
    state.activeConvertQuoteId = quote.id;
    els.convertTripSelect.innerHTML = `<option value="">-- Seleziona viaggio --</option>${tripOptions()}`;
    els.convertQuoteMeta.textContent = `Preventivo ${quote.codice || ''} · ${quote.nome || ''} ${quote.cognome || ''}`.trim();
    setModalOpen(els.convertModal, true);
    return;
  }

  if (action === 'delete') {
    const confirmed = await showConfirm({
      title: 'Elimina preventivo',
      message: `Eliminare il preventivo ${quote.codice || ''}?`,
      confirmText: 'Elimina',
      cancelText: 'Annulla'
    });
    if (!confirmed) return;
    extractData(await quoteService.remove(quote.id), null);
    await loadData();
    showMessage({ type: 'success', title: 'Preventivi', message: 'Preventivo eliminato.' });
  }
}

async function confirmConversion() {
  const quoteId = state.activeConvertQuoteId;
  const tripId = els.convertTripSelect.value;
  const conversion = extractData(await quoteService.convertToBooking(quoteId, { tripId }), null);
  closeConvertModal();
  await loadData();
  showMessage({
    type: 'success',
    title: 'Preventivi',
    message: `Preventivo convertito in prenotazione ${conversion.booking.id}.`
  });
}

function bindEvents() {
  els.btnNew.addEventListener('click', openNewQuotePage);
  els.search.addEventListener('input', renderTable);
  els.statusFilter.addEventListener('change', renderTable);
  els.tbody.addEventListener('click', (event) => {
    handleTableAction(event).catch((error) => {
      showMessage({ type: 'error', title: 'Preventivi', message: error.message || 'Operazione non riuscita.' });
    });
  });
  els.quoteForm.addEventListener('submit', (event) => {
    saveQuote(event).catch((error) => {
      showMessage({ type: 'error', title: 'Preventivi', message: error.message || 'Salvataggio non riuscito.' });
    });
  });
  els.closeQuoteModal.addEventListener('click', closeQuoteModal);
  els.cancelQuoteModal.addEventListener('click', closeQuoteModal);
  els.closeConvertModal.addEventListener('click', closeConvertModal);
  els.cancelConvert.addEventListener('click', closeConvertModal);
  els.confirmConvert.addEventListener('click', () => {
    confirmConversion().catch((error) => {
      showMessage({ type: 'error', title: 'Preventivi', message: error.message || 'Conversione non riuscita.' });
    });
  });
}

async function init() {
  const settingsResponse = await loadImpostazioni();
  if (settingsResponse.success !== false) {
    COMPANY_INFO = buildCompanyInfo(settingsResponse.data);
  }
  bindEvents();
  await loadData();
  const flash = consumeFlashMessage();
  if (flash) {
    showMessage({ type: flash.type || 'success', title: 'Preventivi', message: flash.message });
  }
  unsubscribeQuotes = quoteService.subscribe(() => {
    loadData().catch(() => {});
  });
  unsubscribeTrips = tripService.subscribe(() => {
    loadData().catch(() => {});
  });
  window.addEventListener('beforeunload', () => {
    if (typeof unsubscribeQuotes === 'function') unsubscribeQuotes();
    if (typeof unsubscribeTrips === 'function') unsubscribeTrips();
  }, { once: true });
}

export { queueFlashMessage };

init().catch((error) => {
  els.tbody.innerHTML = `<tr><td colspan="10" class="empty-state">${error.message || 'Impossibile caricare i preventivi.'}</td></tr>`;
  showMessage({ type: 'error', title: 'Preventivi', message: error.message || 'Impossibile inizializzare il modulo.' });
});
