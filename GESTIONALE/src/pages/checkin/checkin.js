import { getCurrentUser } from '../../services/localAuthService.js';
import { buildCompanyInfo, getCachedSettingsSync, loadImpostazioni } from '../../services/settingsService.js';
import { CHECKIN_STATUS, checkinService } from '../../services/checkinService.js';
import {
  downloadPdfBlob,
  generatePassengerListPdf,
  generateSeatMapPdf,
  openPdfBlob
} from '../../services/checkinPdfService.js';
import { ADMIN_ROUTES } from '../../utils/appRoutes.js';

const els = {
  scannerStatus: document.getElementById('scannerStatus'),
  operatorInput: document.getElementById('operatorInput'),
  gateInput: document.getElementById('gateInput'),
  tripFilterSelect: document.getElementById('tripFilterSelect'),
  manualSearchInput: document.getElementById('manualSearchInput'),
  manualSearchBtn: document.getElementById('manualSearchBtn'),
  manualResultsList: document.getElementById('manualResultsList'),
  video: document.getElementById('scannerVideo'),
  canvas: document.getElementById('scannerCanvas'),
  startScannerBtn: document.getElementById('startScannerBtn'),
  stopScannerBtn: document.getElementById('stopScannerBtn'),
  qrPayloadInput: document.getElementById('qrPayloadInput'),
  checkinNoteInput: document.getElementById('checkinNoteInput'),
  analyzeQrBtn: document.getElementById('analyzeQrBtn'),
  resetScannerBtn: document.getElementById('resetScannerBtn'),
  passengerResultCard: document.getElementById('passengerResultCard'),
  markPresentBtn: document.getElementById('markPresentBtn'),
  markAbsentBtn: document.getElementById('markAbsentBtn'),
  markLateBtn: document.getElementById('markLateBtn'),
  markOtherStopBtn: document.getElementById('markOtherStopBtn'),
  openBookingBtn: document.getElementById('openBookingBtn'),
  openSeatMapPdfBtn: document.getElementById('openSeatMapPdfBtn'),
  downloadSeatMapPdfBtn: document.getElementById('downloadSeatMapPdfBtn'),
  openPassengerListPdfBtn: document.getElementById('openPassengerListPdfBtn'),
  downloadPassengerListPdfBtn: document.getElementById('downloadPassengerListPdfBtn'),
  historyList: document.getElementById('historyList'),
  historySummary: document.getElementById('historySummary')
};

const state = {
  stream: null,
  scanTimer: null,
  detector: null,
  pendingLookup: false,
  selected: null,
  trips: [],
  manualResults: [],
  unsubscribeHistory: null,
  companyInfo: buildCompanyInfo(getCachedSettingsSync())
};

function setStatus(message, tone = 'info') {
  if (!els.scannerStatus) return;
  els.scannerStatus.className = `scanner-status ${tone}`;
  els.scannerStatus.textContent = message;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeText(value, fallback = '—') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('it-IT');
}

function formatSeats(value) {
  const source = Array.isArray(value) ? value : String(value ?? '').split(',');
  const seats = source
    .map((seat) => String(seat ?? '').trim())
    .filter(Boolean)
    .map((seat) => seat.padStart(2, '0'));
  return seats.length ? seats.join(', ') : '—';
}

function getSelectedTripId() {
  return String(els.tripFilterSelect?.value || '').trim();
}

function getOperatorName() {
  const currentUser = getCurrentUser();
  if (els.operatorInput && !els.operatorInput.value.trim() && currentUser?.nome) {
    els.operatorInput.value = currentUser.nome;
  }
  return els.operatorInput?.value.trim() || currentUser?.nome || '';
}

function getOperatorContext() {
  return {
    operatorName: getOperatorName(),
    gate: els.gateInput?.value.trim() || '',
    note: els.checkinNoteInput?.value.trim() || ''
  };
}

function isBookingPresent(booking = {}) {
  const status = String(booking.checkin_stato || '').trim().toUpperCase();
  if (status === CHECKIN_STATUS.PRESENTE || status === CHECKIN_STATUS.ALTRA_FERMATA) return true;
  return Boolean(booking.checkin_effettuato || booking.checked_in_at);
}

function getBookingStatusLabel(booking = {}) {
  const status = String(booking.checkin_stato || '').trim().toUpperCase();
  if (status === CHECKIN_STATUS.PRESENTE) return 'Presente';
  if (status === CHECKIN_STATUS.ASSENTE) return 'Assente';
  if (status === CHECKIN_STATUS.RITARDO) return 'Ritardo';
  if (status === CHECKIN_STATUS.ALTRA_FERMATA) return 'Salito ad altra fermata';
  return isBookingPresent(booking) ? 'Presente' : 'Non presente';
}

function updateActionButtons() {
  const disabled = !state.selected || state.pendingLookup;
  [els.markPresentBtn, els.markAbsentBtn, els.markLateBtn, els.markOtherStopBtn, els.openBookingBtn]
    .forEach((button) => {
      if (button) button.disabled = disabled;
    });
}

function resetSelectedPassenger() {
  state.selected = null;
  updateActionButtons();
  if (els.passengerResultCard) {
    els.passengerResultCard.className = 'passenger-result empty';
    els.passengerResultCard.textContent = 'Nessun passeggero selezionato.';
  }
}

function renderSelectedPassenger(result) {
  state.selected = result;
  const booking = result?.booking || {};
  const trip = result?.trip || {};
  const present = isBookingPresent(booking);
  const statusLabel = getBookingStatusLabel(booking);
  const badgeTone = present ? 'success' : 'warning';

  els.passengerResultCard.className = 'passenger-result';
  els.passengerResultCard.innerHTML = `
    <span class="result-flag ${badgeTone}">${escapeHtml(statusLabel)}</span>
    <div class="passenger-result__grid">
      <div class="passenger-result__item"><span>Passeggero</span><strong>${escapeHtml(normalizeText(booking.cliente || booking.cliente_nome))}</strong></div>
      <div class="passenger-result__item"><span>Prenotazione</span><strong>${escapeHtml(normalizeText(booking.codice || booking.id))}</strong></div>
      <div class="passenger-result__item"><span>Telefono</span><strong>${escapeHtml(normalizeText(booking.telefono || booking.cliente_telefono))}</strong></div>
      <div class="passenger-result__item"><span>Email</span><strong>${escapeHtml(normalizeText(booking.email || booking.cliente_email))}</strong></div>
      <div class="passenger-result__item"><span>Destinazione</span><strong>${escapeHtml(normalizeText(trip.destinazione || trip.titolo))}</strong></div>
      <div class="passenger-result__item"><span>Data / Ora</span><strong>${escapeHtml(`${formatDate(trip.data_partenza)} • ${normalizeText(trip.ora_partenza, '—')}`)}</strong></div>
      <div class="passenger-result__item"><span>Partenza</span><strong>${escapeHtml(normalizeText(trip.luogo_partenza || trip.partenza))}</strong></div>
      <div class="passenger-result__item"><span>Posti</span><strong>${escapeHtml(formatSeats(booking.posti_selezionati || booking.posti))}</strong></div>
      <div class="passenger-result__item"><span>Ultimo aggiornamento</span><strong>${escapeHtml(formatDateTime(booking.ultimo_accesso_at || booking.checked_in_at))}</strong></div>
      <div class="passenger-result__item"><span>Operatore</span><strong>${escapeHtml(normalizeText(booking.checkin_operatore))}</strong></div>
    </div>
  `;

  if (trip?.id && els.tripFilterSelect) {
    els.tripFilterSelect.value = String(trip.id);
  }
  updateActionButtons();
}

function renderManualResults(items = []) {
  state.manualResults = Array.isArray(items) ? items : [];
  if (!state.manualResults.length) {
    els.manualResultsList.innerHTML = '<div class="empty-state">Nessun risultato di ricerca.</div>';
    return;
  }

  els.manualResultsList.innerHTML = state.manualResults.map((item, index) => {
    const booking = item.booking || {};
    const trip = item.trip || {};
    const statusLabel = getBookingStatusLabel(booking);
    return `
      <article class="manual-result-card" data-index="${index}">
        <div class="manual-result-card__head">
          <strong>${escapeHtml(normalizeText(booking.cliente || booking.cliente_nome))}</strong>
          <span class="history-chip">${escapeHtml(statusLabel)}</span>
        </div>
        <p>${escapeHtml(normalizeText(booking.codice || booking.id))} • ${escapeHtml(formatSeats(booking.posti_selezionati || booking.posti))}</p>
        <p>${escapeHtml(normalizeText(trip.destinazione || trip.titolo))} • ${escapeHtml(formatDate(trip.data_partenza))}</p>
        <div class="manual-result-card__actions">
          <button type="button" class="btn btn-primary manual-select-btn">Seleziona</button>
          <button type="button" class="btn btn-secondary manual-open-btn">Apri prenotazione</button>
        </div>
      </article>
    `;
  }).join('');

  els.manualResultsList.querySelectorAll('.manual-select-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const card = button.closest('.manual-result-card');
      const index = Number(card?.dataset?.index || -1);
      if (index < 0 || !state.manualResults[index]) return;
      renderSelectedPassenger(state.manualResults[index]);
      setStatus('Passeggero selezionato dalla ricerca manuale.', 'success');
    });
  });

  els.manualResultsList.querySelectorAll('.manual-open-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const card = button.closest('.manual-result-card');
      const index = Number(card?.dataset?.index || -1);
      if (index < 0 || !state.manualResults[index]?.booking?.id) return;
      openBookingInManagement(state.manualResults[index].booking.id);
    });
  });
}

function formatTripOption(trip = {}) {
  return trip.optionLabel || [
    normalizeText(trip.destinazione || trip.titolo, 'Viaggio'),
    formatDate(trip.data_partenza || trip.data_servizio),
    normalizeText(trip.ora_partenza, '')
  ].filter(Boolean).join(' • ');
}

function renderTripOptions(trips = []) {
  state.trips = Array.isArray(trips) ? trips : [];
  if (!els.tripFilterSelect) return;
  const options = [
    '<option value="">Tutti i viaggi</option>',
    ...state.trips.map((trip) => `<option value="${escapeHtml(String(trip.id))}">${escapeHtml(formatTripOption(trip))}</option>`)
  ];
  els.tripFilterSelect.innerHTML = options.join('');
}

async function searchPassengerManually() {
  const query = els.manualSearchInput?.value.trim() || '';
  const tripId = getSelectedTripId();
  if (!query && !tripId) {
    renderManualResults([]);
    setStatus('Inserisci un filtro per avviare la ricerca manuale.', 'warning');
    return;
  }
  setStatus('Ricerca manuale in corso...', 'info');
  const response = await checkinService.searchPassengers({ query, tripId });
  if (response.success === false) {
    setStatus(response.error.message || 'Ricerca manuale non riuscita.', 'error');
    return;
  }
  renderManualResults(response.data || []);
  setStatus(`Trovati ${response.data.length} risultati.`, 'success');
}

async function detectQrFromFrame() {
  if (!state.detector || !state.stream || !els.video || els.video.readyState < 2) return;
  const canvas = els.canvas;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  canvas.width = els.video.videoWidth || 1280;
  canvas.height = els.video.videoHeight || 720;
  context.drawImage(els.video, 0, 0, canvas.width, canvas.height);
  const barcodes = await state.detector.detect(canvas);
  const match = (barcodes || []).find((item) => String(item.rawValue || '').trim());
  if (!match) return;
  els.qrPayloadInput.value = String(match.rawValue || '').trim();
  setStatus('QR rilevato automaticamente. Avvio ricerca passeggero...', 'success');
  await stopScanner();
  await analyzeQrPayload();
}

function clearScanLoop() {
  if (state.scanTimer) {
    window.clearInterval(state.scanTimer);
    state.scanTimer = null;
  }
}

async function scanLoop() {
  clearScanLoop();
  state.scanTimer = window.setInterval(() => {
    detectQrFromFrame().catch((error) => {
      setStatus(error.message || 'Errore durante la scansione del QR.', 'error');
    });
  }, 850);
}

async function startScanner() {
  if (!('mediaDevices' in navigator) || typeof navigator.mediaDevices.getUserMedia !== 'function') {
    setStatus('Fotocamera non disponibile in questo browser. Usa l\'inserimento manuale del payload QR.', 'warning');
    return;
  }
  if (!('BarcodeDetector' in window)) {
    setStatus('Scanner nativo QR non supportato in questo browser. Usa l\'inserimento manuale del payload QR.', 'warning');
    return;
  }
  const formats = typeof window.BarcodeDetector.getSupportedFormats === 'function'
    ? await window.BarcodeDetector.getSupportedFormats()
    : ['qr_code'];
  if (!formats.includes('qr_code')) {
    setStatus('Il browser non espone il formato QR. Usa l\'inserimento manuale del payload QR.', 'warning');
    return;
  }

  state.detector = new window.BarcodeDetector({ formats: ['qr_code'] });
  state.stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' },
    audio: false
  });
  els.video.srcObject = state.stream;
  await els.video.play();
  await scanLoop();
  setStatus('Scanner attivo. Inquadra il QR della ricevuta.', 'info');
}

async function stopScanner() {
  clearScanLoop();
  if (state.stream) {
    state.stream.getTracks().forEach((track) => track.stop());
    state.stream = null;
  }
  if (els.video) {
    els.video.pause();
    els.video.srcObject = null;
  }
}

async function analyzeQrPayload() {
  const rawPayload = els.qrPayloadInput?.value.trim() || '';
  if (!rawPayload) {
    setStatus('Inserisci o scansiona prima il contenuto del QR.', 'warning');
    resetSelectedPassenger();
    return;
  }

  state.pendingLookup = true;
  updateActionButtons();
  setStatus('Ricerca prenotazione in corso...', 'info');
  const response = await checkinService.lookupBookingFromQr(rawPayload);
  state.pendingLookup = false;
  updateActionButtons();

  if (response.success === false) {
    resetSelectedPassenger();
    setStatus(response.error.message || 'Prenotazione non trovata.', 'error');
    return;
  }

  renderSelectedPassenger(response.data);
  setStatus('Passeggero trovato con successo.', 'success');
}

function openBookingInManagement(bookingId) {
  if (!bookingId) return;
  const target = `${ADMIN_ROUTES.prenotazioni}?booking=${encodeURIComponent(String(bookingId))}`;
  window.location.href = target;
}

async function applyPresenceStatus(status) {
  if (!state.selected?.booking) {
    setStatus('Seleziona prima un passeggero.', 'warning');
    return;
  }
  const context = getOperatorContext();
  const response = await checkinService.markBookingPresence({
    booking: state.selected.booking,
    trip: state.selected.trip,
    status,
    qrPayload: els.qrPayloadInput?.value.trim() || '',
    operatorName: context.operatorName,
    gate: context.gate,
    stopLabel: context.gate,
    note: context.note
  });

  if (response.success === false) {
    setStatus(response.error.message || 'Aggiornamento presenza non riuscito.', 'error');
    return;
  }

  state.selected.booking = response.data.booking || state.selected.booking;
  renderSelectedPassenger(state.selected);
  await refreshHistory();
  const statusLabel = getBookingStatusLabel(state.selected.booking);
  setStatus(`Stato presenza aggiornato: ${statusLabel}.`, 'success');
}

function renderHistory(items = []) {
  const history = Array.isArray(items) ? items : [];
  if (els.historySummary) {
    els.historySummary.textContent = `${history.length} access${history.length === 1 ? 'o registrato' : 'i registrati'}`;
  }

  if (!history.length) {
    els.historyList.innerHTML = '<div class="empty-state">Nessun accesso registrato.</div>';
    return;
  }

  els.historyList.innerHTML = history.map((item) => {
    const outcome = String(item.esito || '').toUpperCase();
    const tone = outcome === CHECKIN_STATUS.PRESENTE || outcome === CHECKIN_STATUS.ALTRA_FERMATA ? 'success' : 'warning';
    return `
      <article class="history-item">
        <div class="history-item__top">
          <div>
            <strong>${escapeHtml(item.cliente || 'Passeggero')}</strong>
            <p>${escapeHtml(item.prenotazione_codice || item.prenotazione_id || '—')} • Posto ${escapeHtml(item.posto || '—')}</p>
          </div>
          <span class="history-chip ${tone}">${escapeHtml(outcome.replaceAll('_', ' '))}</span>
        </div>
        <div class="history-item__meta">
          <span class="history-chip">Viaggio ${escapeHtml(item.viaggio_id || '—')}</span>
          <span class="history-chip">Operatore ${escapeHtml(item.operatore || '—')}</span>
          <span class="history-chip">Fermata ${escapeHtml(item.gate || '—')}</span>
          <span class="history-chip">${escapeHtml(formatDateTime(item.created_at))}</span>
        </div>
        ${item.note ? `<p>${escapeHtml(item.note)}</p>` : ''}
      </article>
    `;
  }).join('');
}

async function refreshHistory() {
  const response = await checkinService.listCheckinHistory();
  if (response.success === false) {
    setStatus(response.error.message || 'Impossibile leggere lo storico accessi.', 'error');
    return;
  }
  renderHistory(response.data);
}

async function withTripPassengers(action) {
  const tripId = getSelectedTripId() || state.selected?.trip?.id || '';
  if (!tripId) {
    setStatus('Seleziona prima un viaggio.', 'warning');
    return null;
  }
  const response = await checkinService.getTripPassengers(tripId);
  if (response.success === false) {
    setStatus(response.error.message || 'Impossibile caricare i passeggeri del viaggio.', 'error');
    return null;
  }
  return action(response.data);
}

async function openSeatMapPdf() {
  return withTripPassengers(async ({ trip, bookings }) => {
    const blob = await generateSeatMapPdf({ trip, bookings, company: state.companyInfo });
    openPdfBlob(blob);
    setStatus('PDF piantina autobus generato.', 'success');
  });
}

async function downloadSeatMapPdf() {
  return withTripPassengers(async ({ trip, bookings }) => {
    const blob = await generateSeatMapPdf({ trip, bookings, company: state.companyInfo });
    const file = `Piantina_Autobus_${String(trip.data_partenza || '').slice(0, 10)}_${Date.now()}.pdf`;
    downloadPdfBlob(blob, file);
    setStatus('PDF piantina autobus scaricato.', 'success');
  });
}

async function openPassengerListPdf() {
  return withTripPassengers(async ({ trip, bookings }) => {
    const blob = await generatePassengerListPdf({ trip, bookings, company: state.companyInfo });
    openPdfBlob(blob);
    setStatus('PDF elenco passeggeri generato.', 'success');
  });
}

async function downloadPassengerListPdf() {
  return withTripPassengers(async ({ trip, bookings }) => {
    const blob = await generatePassengerListPdf({ trip, bookings, company: state.companyInfo });
    const file = `Elenco_Passeggeri_${String(trip.data_partenza || '').slice(0, 10)}_${Date.now()}.pdf`;
    downloadPdfBlob(blob, file);
    setStatus('PDF elenco passeggeri scaricato.', 'success');
  });
}

function resetFormForNextScan() {
  if (els.qrPayloadInput) els.qrPayloadInput.value = '';
  if (els.checkinNoteInput) els.checkinNoteInput.value = '';
  resetSelectedPassenger();
  setStatus('Pronto per una nuova scansione.', 'info');
}

function bindEvents() {
  els.startScannerBtn?.addEventListener('click', () => startScanner().catch((error) => setStatus(error.message || 'Impossibile avviare la fotocamera.', 'error')));
  els.stopScannerBtn?.addEventListener('click', () => stopScanner().then(() => setStatus('Scanner fermato.', 'info')));
  els.analyzeQrBtn?.addEventListener('click', () => analyzeQrPayload().catch((error) => setStatus(error.message || 'Errore nella ricerca del passeggero.', 'error')));
  els.resetScannerBtn?.addEventListener('click', resetFormForNextScan);
  els.manualSearchBtn?.addEventListener('click', () => searchPassengerManually().catch((error) => setStatus(error.message || 'Errore ricerca manuale.', 'error')));
  els.manualSearchInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      searchPassengerManually().catch((error) => setStatus(error.message || 'Errore ricerca manuale.', 'error'));
    }
  });

  els.markPresentBtn?.addEventListener('click', () => applyPresenceStatus(CHECKIN_STATUS.PRESENTE));
  els.markAbsentBtn?.addEventListener('click', () => applyPresenceStatus(CHECKIN_STATUS.ASSENTE));
  els.markLateBtn?.addEventListener('click', () => applyPresenceStatus(CHECKIN_STATUS.RITARDO));
  els.markOtherStopBtn?.addEventListener('click', () => applyPresenceStatus(CHECKIN_STATUS.ALTRA_FERMATA));
  els.openBookingBtn?.addEventListener('click', () => openBookingInManagement(state.selected?.booking?.id));

  els.openSeatMapPdfBtn?.addEventListener('click', () => openSeatMapPdf().catch((error) => setStatus(error.message || 'Errore generazione PDF piantina.', 'error')));
  els.downloadSeatMapPdfBtn?.addEventListener('click', () => downloadSeatMapPdf().catch((error) => setStatus(error.message || 'Errore download PDF piantina.', 'error')));
  els.openPassengerListPdfBtn?.addEventListener('click', () => openPassengerListPdf().catch((error) => setStatus(error.message || 'Errore generazione PDF elenco.', 'error')));
  els.downloadPassengerListPdfBtn?.addEventListener('click', () => downloadPassengerListPdf().catch((error) => setStatus(error.message || 'Errore download PDF elenco.', 'error')));

  window.addEventListener('beforeunload', () => {
    stopScanner().catch(() => {});
    if (typeof state.unsubscribeHistory === 'function') {
      state.unsubscribeHistory();
      state.unsubscribeHistory = null;
    }
  });
}

async function initTrips() {
  const response = await checkinService.listTripsForCheckin();
  if (response.success === false) {
    setStatus(response.error.message || 'Impossibile caricare i viaggi check-in.', 'error');
    return;
  }
  renderTripOptions(response.data);
}

async function initSettings() {
  const response = await loadImpostazioni();
  if (response.success === false) return;
  state.companyInfo = buildCompanyInfo(response.data);
}

async function init() {
  await initSettings();
  getOperatorName();
  bindEvents();
  await initTrips();
  await refreshHistory();
  state.unsubscribeHistory = checkinService.subscribeCheckinHistory(() => {
    refreshHistory().catch(() => {});
  });
  resetSelectedPassenger();

  if (!('BarcodeDetector' in window)) {
    setStatus('Scanner camera non disponibile nel browser corrente. Inserimento manuale QR attivo.', 'warning');
  }
}

init().catch((error) => {
  setStatus(error.message || 'Errore durante l\'inizializzazione dello scanner QR.', 'error');
});
