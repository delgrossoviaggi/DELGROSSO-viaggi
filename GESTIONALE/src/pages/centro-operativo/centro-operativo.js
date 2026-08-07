import { tripService } from '../../services/tripService.js';
import { buildBookingPaymentSummary } from '../../services/paymentService.js';
import { getCurrentUser } from '../../services/localAuthService.js';
import { buildCompanyInfo, getCachedSettingsSync, loadImpostazioni } from '../../services/settingsService.js';
import { CHECKIN_STATUS, checkinService } from '../../services/checkinService.js';
import { getSeatLayoutDefinition } from '../../services/seatMapService.js';
import { downloadPdfBlob, generatePassengerListPdf, generateSeatMapPdf, openPdfBlob } from '../../services/checkinPdfService.js';
import { showMessage } from '../../components/messageSystem.js';
import { ADMIN_ROUTES } from '../../utils/appRoutes.js';

const params = new URLSearchParams(window.location.search);
let activeTripId = String(params.get('trip') || '').trim();

const els = {
  tripTitle: document.getElementById('tripTitle'),
  tripMeta: document.getElementById('tripMeta'),
  tripHeaderStats: document.getElementById('tripHeaderStats'),
  seatMapLegend: document.getElementById('seatMapLegend'),
  seatMapContainer: document.getElementById('seatMapContainer'),
  scannerStatus: document.getElementById('scannerStatus'),
  operatorInput: document.getElementById('operatorInput'),
  gateInput: document.getElementById('gateInput'),
  video: document.getElementById('scannerVideo'),
  canvas: document.getElementById('scannerCanvas'),
  startScannerBtn: document.getElementById('startScannerBtn'),
  stopScannerBtn: document.getElementById('stopScannerBtn'),
  qrPayloadInput: document.getElementById('qrPayloadInput'),
  analyzeQrBtn: document.getElementById('analyzeQrBtn'),
  openBookingBtn: document.getElementById('openBookingBtn'),
  selectedPassengerCard: document.getElementById('selectedPassengerCard'),
  quickPayments: document.getElementById('quickPayments'),
  operationalAlerts: document.getElementById('operationalAlerts'),
  searchPassengerInput: document.getElementById('searchPassengerInput'),
  passengerTableBody: document.querySelector('#passengerTable tbody'),
  openSeatMapPdfBtn: document.getElementById('openSeatMapPdfBtn'),
  downloadSeatMapPdfBtn: document.getElementById('downloadSeatMapPdfBtn'),
  openPassengerListPdfBtn: document.getElementById('openPassengerListPdfBtn'),
  downloadPassengerListPdfBtn: document.getElementById('downloadPassengerListPdfBtn')
};

const state = {
  trip: null,
  bookings: [],
  passengerRows: [],
  selectedBookingId: '',
  selectedSeat: '',
  history: [],
  searchTerm: '',
  stream: null,
  detector: null,
  scanTimer: null,
  companyInfo: buildCompanyInfo(getCachedSettingsSync()),
  pendingLookup: false,
  unsubscribeHistory: null
};

function setActiveTripId(nextTripId) {
  const normalizedTripId = String(nextTripId || '').trim();
  activeTripId = normalizedTripId;
  const nextParams = new URLSearchParams(window.location.search);
  if (normalizedTripId) nextParams.set('trip', normalizedTripId);
  else nextParams.delete('trip');
  const query = nextParams.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}`;
  window.history.replaceState({}, '', nextUrl);
}

async function resolveFallbackTrip(preferredTripId = '') {
  const response = await checkinService.listTripsForCheckin();
  if (response.success === false) throw response.error;
  const trips = Array.isArray(response.data) ? response.data : [];
  if (!trips.length) {
    throw new Error('Nessun viaggio disponibile. Crea o pubblica un viaggio dalla sezione Viaggi.');
  }
  const normalizedPreferred = String(preferredTripId || '').trim();
  const preferred = normalizedPreferred
    ? trips.find((trip) => String(trip.id || '').trim() === normalizedPreferred)
    : null;
  return preferred || trips[0];
}

function normalizeText(value, fallback = '—') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setScannerStatus(message, tone = 'info') {
  if (!els.scannerStatus) return;
  els.scannerStatus.className = `scanner-status ${tone}`;
  els.scannerStatus.textContent = message;
}

function setPageMessage(message, type = 'info') {
  showMessage({
    type: type === 'error' ? 'error' : 'info',
    title: 'Centro Operativo',
    message: String(message || '')
  });
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('it-IT');
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function toAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(toAmount(value));
}

function parseSeatList(value) {
  if (Array.isArray(value)) return value.map((seat) => String(seat ?? '').trim()).filter(Boolean);
  const raw = String(value ?? '').trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((seat) => String(seat ?? '').trim()).filter(Boolean);
  } catch (_error) {
    // fallback CSV parsing
  }
  return raw.split(',').map((seat) => seat.trim()).filter(Boolean);
}

function parsePassengerName(booking = {}) {
  const fullName = String(booking.cliente || booking.cliente_nome || booking.nome_cliente || '').trim();
  if (!fullName) return { nome: '', cognome: '' };
  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { nome: parts[0], cognome: '' };
  return {
    nome: parts.slice(0, -1).join(' '),
    cognome: parts.slice(-1).join('')
  };
}

function getSeatNumberValue(seat) {
  return Number(String(seat ?? '').replace(/[^\d]/g, ''));
}

function formatSeatLabel(seat) {
  const value = getSeatNumberValue(seat);
  if (!Number.isFinite(value) || value <= 0) return String(seat ?? '');
  return String(value).padStart(2, '0');
}

function getPresenceBucket(booking = {}) {
  const status = String(booking.checkin_stato || '').trim().toUpperCase();
  if (status === CHECKIN_STATUS.PRESENTE) return 'present';
  if (status === CHECKIN_STATUS.ASSENTE) return 'absent';
  if (status === CHECKIN_STATUS.RITARDO) return 'late';
  if (status === CHECKIN_STATUS.ALTRA_FERMATA) return 'other';
  return booking.checkin_effettuato ? 'present' : 'booked';
}

function getPresenceLabel(booking = {}) {
  const status = String(booking.checkin_stato || '').trim().toUpperCase();
  if (status === CHECKIN_STATUS.PRESENTE) return 'Presente';
  if (status === CHECKIN_STATUS.ASSENTE) return 'Assente';
  if (status === CHECKIN_STATUS.RITARDO) return 'Ritardo';
  if (status === CHECKIN_STATUS.ALTRA_FERMATA) return 'Salito ad altra fermata';
  return booking.checkin_effettuato ? 'Presente' : 'Prenotato non salito';
}

function passengerSeatLabel(row) {
  const surname = String(row.cognome || '').trim().toUpperCase();
  const nameInitial = String(row.nome || '').trim();
  if (!surname) return '—';
  if (!nameInitial) return surname;
  return `${surname} ${nameInitial.slice(0, 1).toUpperCase()}.`;
}

function normalizeBookings(bookings = []) {
  return (bookings || []).map((booking) => {
    const seats = parseSeatList(booking.__seats || booking.posti_selezionati || booking.posti);
    const person = parsePassengerName(booking);
    const paymentSummary = buildBookingPaymentSummary(booking, []);
    return {
      ...booking,
      __seats: seats,
      __nome: person.nome || '',
      __cognome: person.cognome || '',
      __presenceBucket: getPresenceBucket(booking),
      __presenceLabel: getPresenceLabel(booking),
      __paymentSummary: paymentSummary
    };
  });
}

function buildPassengerRows(bookings = []) {
  const rows = [];
  bookings.forEach((booking) => {
    const seats = booking.__seats || [];
    if (!seats.length) {
      rows.push({
        bookingId: booking.id,
        seat: '—',
        seatNumeric: 9999,
        cognome: booking.__cognome,
        nome: booking.__nome,
        telefono: booking.telefono || booking.cliente_telefono || '',
        booking
      });
      return;
    }
    seats.forEach((seat) => {
      rows.push({
        bookingId: booking.id,
        seat: formatSeatLabel(seat),
        seatNumeric: getSeatNumberValue(seat),
        cognome: booking.__cognome,
        nome: booking.__nome,
        telefono: booking.telefono || booking.cliente_telefono || '',
        booking
      });
    });
  });
  return rows.sort((a, b) => {
    if (Number.isFinite(a.seatNumeric) && Number.isFinite(b.seatNumeric)) return a.seatNumeric - b.seatNumeric;
    return String(a.seat).localeCompare(String(b.seat), 'it');
  });
}

function getOperatorName() {
  const currentUser = getCurrentUser();
  if (els.operatorInput && !els.operatorInput.value.trim() && currentUser?.nome) {
    els.operatorInput.value = currentUser.nome;
  }
  return els.operatorInput?.value.trim() || currentUser?.nome || '';
}

function renderHeaderStats() {
  const trip = state.trip || {};
  const totalSeats = toAmount(trip.posti_totali);
  const bookedSeats = state.passengerRows.filter((row) => row.seat !== '—').length;
  const present = state.bookings.filter((item) => item.__presenceBucket === 'present').length;
  const absent = state.bookings.filter((item) => item.__presenceBucket === 'absent').length;
  const late = state.bookings.filter((item) => item.__presenceBucket === 'late').length;
  const available = Math.max(totalSeats - bookedSeats, 0);
  const occupancyPercent = totalSeats > 0 ? Math.round((bookedSeats / totalSeats) * 100) : 0;

  const stats = [
    { label: 'Posti autobus', value: String(totalSeats) },
    { label: 'Prenotati', value: String(bookedSeats) },
    { label: 'Presenti', value: String(present) },
    { label: 'Assenti', value: String(absent) },
    { label: 'Ritardo', value: String(late) },
    { label: 'Disponibilità', value: String(available) },
    { label: 'Bus pieno %', value: `${occupancyPercent}%` }
  ];

  els.tripHeaderStats.innerHTML = stats.map((item) => `<div class="op-stat"><span>${item.label}</span><strong>${item.value}</strong></div>`).join('');
}

function renderQuickPayments() {
  const total = state.bookings.reduce((sum, booking) => sum + toAmount(booking.__paymentSummary.totalDue), 0);
  const paid = state.bookings.reduce((sum, booking) => sum + toAmount(booking.__paymentSummary.paidNet), 0);
  const residual = state.bookings.reduce((sum, booking) => sum + toAmount(booking.__paymentSummary.residual), 0);
  const paidBookings = state.bookings.filter((booking) => booking.__paymentSummary.status === 'Pagato').length;

  const items = [
    { label: 'Totale', value: formatCurrency(total) },
    { label: 'Pagato', value: formatCurrency(paid) },
    { label: 'Residuo', value: formatCurrency(residual) },
    { label: 'Stato', value: `${paidBookings}/${state.bookings.length} saldate` }
  ];

  els.quickPayments.innerHTML = items.map((item) => `<div class="op-stat"><span>${item.label}</span><strong>${item.value}</strong></div>`).join('');
}

function renderAlerts() {
  const alerts = [];
  const totalSeats = toAmount(state.trip?.posti_totali);
  const bookedSeats = state.passengerRows.filter((row) => row.seat !== '—').length;
  const residualBookings = state.bookings.filter((booking) => toAmount(booking.__paymentSummary.residual) > 0);
  const absentBookings = state.bookings.filter((booking) => booking.__presenceBucket === 'absent');

  if (residualBookings.length > 0) {
    alerts.push({ tone: 'warning', text: `Saldo non pagato: ${residualBookings.length} prenotazioni con residuo.` });
  }
  if (absentBookings.length > 0) {
    alerts.push({ tone: 'error', text: `Cliente assente: ${absentBookings.length} passeggeri segnati assenti.` });
  }
  if (totalSeats > 0 && bookedSeats >= totalSeats) {
    alerts.push({ tone: 'warning', text: 'Bus completo: disponibilità posti esaurita.' });
  }
  const recentCheckin = state.history.find((entry) => String(entry.esito || '').toUpperCase() === CHECKIN_STATUS.PRESENTE);
  if (recentCheckin) {
    alerts.push({
      tone: 'success',
      text: `Nuovo check-in: ${normalizeText(recentCheckin.cliente)} alle ${formatDateTime(recentCheckin.created_at)}.`
    });
  }
  if (!alerts.length) alerts.push({ tone: 'success', text: 'Nessuna criticità operativa rilevata.' });

  els.operationalAlerts.innerHTML = alerts.map((item) => `<div class="op-alert op-alert--${item.tone}">${item.text}</div>`).join('');
}

function renderSeatLegend() {
  els.seatMapLegend.innerHTML = `
    <span class="op-legend-pill op-legend-present">Verde: Presente</span>
    <span class="op-legend-pill op-legend-booked">Giallo: Prenotato non salito</span>
    <span class="op-legend-pill op-legend-absent">Rosso: Assente</span>
    <span class="op-legend-pill op-legend-other">Blu: Altra fermata</span>
    <span class="op-legend-pill op-legend-free">Grigio: Posto libero</span>
  `;
}

function getSeatRenderStatus(booking = null) {
  if (!booking) return 'free';
  if (booking.__presenceBucket === 'present') return 'present';
  if (booking.__presenceBucket === 'absent') return 'absent';
  if (booking.__presenceBucket === 'other') return 'other';
  return 'booked';
}

function renderSeatMap() {
  const definition = getSeatLayoutDefinition(state.trip?.seat_layout || state.trip?.autobus || state.trip?.autobus_id || 'GT53');
  const bySeat = new Map();
  state.bookings.forEach((booking) => {
    (booking.__seats || []).forEach((seat) => {
      bySeat.set(formatSeatLabel(seat), booking);
    });
  });

  const rowsHtml = (definition.rows || []).map((rowCells, rowIndex) => {
    const isRearRow = rowCells.every((cell) => typeof cell === 'number' || /^\d+$/.test(String(cell)));
    const cells = rowCells.map((cell) => {
      const isSeat = typeof cell === 'number' || /^\d+$/.test(String(cell));
      if (isSeat) {
        const seat = formatSeatLabel(cell);
        const booking = bySeat.get(seat) || null;
        const status = getSeatRenderStatus(booking);
        const isActive = state.selectedSeat && state.selectedSeat === seat;
        const seatName = booking ? passengerSeatLabel({ cognome: booking.__cognome, nome: booking.__nome }) : '';
        return `<button type="button" class="op-seat op-seat--${status} ${isActive ? 'op-seat--active' : ''}" data-seat="${seat}" data-booking-id="${booking?.id || ''}">
          <span class="op-seat__number">${seat}</span>
          <span class="op-seat__name">${seatName || '&nbsp;'}</span>
        </button>`;
      }
      if (cell === 'aisle') return '<span class="op-seat-void op-seat-void--aisle" aria-hidden="true"></span>';
      if (cell === 'door') return '<span class="op-seat-void op-seat-void--door" aria-hidden="true">PORTA</span>';
      return '<span class="op-seat-void op-seat-void--empty" aria-hidden="true"></span>';
    }).join('');

    return `<div class="op-seat-row ${isRearRow ? 'op-seat-row--rear' : ''}" data-row="${rowIndex + 1}">
      <span class="op-seat-row__label">Fila ${rowIndex + 1}</span>
      <div class="op-seat-row__cells">${cells}</div>
    </div>`;
  }).join('');

  els.seatMapContainer.innerHTML = `
    <div class="seat-map-container">
      <div class="seat-map-header">
        <div class="seat-map-front">
          <span class="seat-map-front__title">${escapeHtml(normalizeText(definition.frontLabel, 'FRONTE BUS'))}</span>
          <span class="seat-map-front__driver">${escapeHtml(normalizeText(definition.driverLabel, 'AUTISTA'))}</span>
        </div>
      </div>
      <div class="seat-map-rows">${rowsHtml}</div>
    </div>
  `;

  els.seatMapContainer.querySelectorAll('.op-seat[data-booking-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const bookingId = String(button.dataset.bookingId || '').trim();
      const seat = String(button.dataset.seat || '').trim();
      focusBooking(bookingId, seat);
    });
  });
}

function renderSelectedPassengerCard() {
  if (!state.selectedBookingId) {
    els.selectedPassengerCard.className = 'selected-passenger-card empty';
    els.selectedPassengerCard.textContent = 'Nessun passeggero selezionato.';
    els.openBookingBtn.disabled = true;
    return;
  }
  const booking = state.bookings.find((item) => String(item.id) === state.selectedBookingId);
  if (!booking) {
    state.selectedBookingId = '';
    state.selectedSeat = '';
    renderSelectedPassengerCard();
    return;
  }

  els.openBookingBtn.disabled = false;
  els.selectedPassengerCard.className = 'selected-passenger-card';
  els.selectedPassengerCard.innerHTML = `
    <strong>${escapeHtml(normalizeText(booking.cliente || booking.cliente_nome))}</strong>
    <div class="op-checkin-meta">Posti: ${escapeHtml(normalizeText((booking.__seats || []).join(', '), '—'))} • Presenza: ${escapeHtml(booking.__presenceLabel)}</div>
    <div class="op-checkin-meta">Check-in: ${escapeHtml(formatDateTime(booking.checked_in_at || booking.ultimo_accesso_at))} • Operatore: ${escapeHtml(normalizeText(booking.checkin_operatore))}</div>
  `;
}

function passengerRowTemplate(row) {
  const booking = row.booking;
  const summary = booking.__paymentSummary;
  const paymentLabel = `${formatCurrency(summary.paidNet)} / ${formatCurrency(summary.totalDue)} • ${summary.status}`;
  const selectedStatus = String(booking.checkin_stato || '').trim().toUpperCase();
  const options = [
    { value: CHECKIN_STATUS.PRESENTE, label: 'Presente' },
    { value: CHECKIN_STATUS.ASSENTE, label: 'Assente' },
    { value: CHECKIN_STATUS.RITARDO, label: 'Ritardo' },
    { value: CHECKIN_STATUS.ALTRA_FERMATA, label: 'Salito ad altra fermata' },
    { value: CHECKIN_STATUS.NON_PRESENTE, label: 'Prenotato non salito' }
  ];
  const optionHtml = options
    .map((option) => `<option value="${option.value}" ${selectedStatus === option.value ? 'selected' : ''}>${option.label}</option>`)
    .join('');

  return `<tr data-booking-id="${booking.id}" data-seat="${escapeHtml(row.seat)}">
    <td><strong>${escapeHtml(row.seat)}</strong></td>
    <td>${escapeHtml(normalizeText(row.cognome))}</td>
    <td>${escapeHtml(normalizeText(row.nome))}</td>
    <td>${escapeHtml(normalizeText(row.telefono))}</td>
    <td>${escapeHtml(paymentLabel)}</td>
    <td>
      <select class="op-presence-select">
        ${optionHtml}
      </select>
    </td>
    <td>
      <div class="op-checkin-meta">${escapeHtml(formatDateTime(booking.checked_in_at || booking.ultimo_accesso_at))}</div>
      <div class="op-checkin-meta">${escapeHtml(normalizeText(booking.checkin_operatore))}</div>
    </td>
    <td>
      <div class="op-row-note">
        <input type="text" class="op-note-input" value="${escapeHtml(String(booking.checkin_note || ''))}" placeholder="Note check-in">
        <button type="button" class="op-note-save-btn">Salva</button>
      </div>
    </td>
  </tr>`;
}

function filterPassengerRows() {
  const query = state.searchTerm.trim().toLowerCase();
  if (!query) return state.passengerRows;
  return state.passengerRows.filter((row) => {
    const booking = row.booking || {};
    const text = [
      row.seat,
      row.cognome,
      row.nome,
      row.telefono,
      booking.codice,
      booking.email,
      booking.checkin_note
    ].map((value) => String(value || '').toLowerCase()).join(' ');
    return text.includes(query);
  });
}

async function handlePresenceChange(bookingId, nextStatus) {
  const booking = state.bookings.find((item) => String(item.id) === String(bookingId));
  if (!booking) throw new Error('Prenotazione non trovata.');
  const operatorName = getOperatorName();
  const gate = String(els.gateInput?.value || '').trim();
  const response = await checkinService.markBookingPresence({
    booking,
    trip: state.trip,
    status: nextStatus,
    qrPayload: '',
    operatorName,
    gate,
    stopLabel: gate,
    note: String(booking.checkin_note || '').trim()
  });
  if (response.success === false) throw response.error;
}

async function handleSaveRowNote(bookingId, note) {
  const response = await checkinService.saveBookingCheckinNote({
    bookingId,
    note,
    operatorName: getOperatorName()
  });
  if (response.success === false) throw response.error;
}

function renderPassengerTable() {
  const rows = filterPassengerRows();
  if (!rows.length) {
    els.passengerTableBody.innerHTML = '<tr><td colspan="8">Nessun passeggero trovato per questo viaggio.</td></tr>';
    return;
  }
  els.passengerTableBody.innerHTML = rows.map(passengerRowTemplate).join('');

  els.passengerTableBody.querySelectorAll('tr[data-booking-id]').forEach((tr) => {
    tr.addEventListener('click', (event) => {
      if (event.target.closest('select, input, button')) return;
      focusBooking(String(tr.dataset.bookingId || ''), String(tr.dataset.seat || ''));
    });
  });

  els.passengerTableBody.querySelectorAll('.op-presence-select').forEach((select) => {
    select.addEventListener('change', async (event) => {
      const row = event.target.closest('tr[data-booking-id]');
      const bookingId = String(row?.dataset?.bookingId || '').trim();
      if (!bookingId) return;
      const nextStatus = String(event.target.value || CHECKIN_STATUS.NON_PRESENTE);
      event.target.disabled = true;
      try {
        await handlePresenceChange(bookingId, nextStatus);
        await refreshAllData();
        setPageMessage('Presenza aggiornata.');
      } catch (error) {
        setPageMessage(error.message || 'Errore aggiornamento presenza.', 'error');
      } finally {
        event.target.disabled = false;
      }
    });
  });

  els.passengerTableBody.querySelectorAll('.op-note-save-btn').forEach((button) => {
    button.addEventListener('click', async (event) => {
      const row = event.target.closest('tr[data-booking-id]');
      const bookingId = String(row?.dataset?.bookingId || '').trim();
      const noteInput = row?.querySelector('.op-note-input');
      if (!bookingId || !noteInput) return;
      button.disabled = true;
      try {
        await handleSaveRowNote(bookingId, noteInput.value);
        await refreshAllData();
        setPageMessage('Nota aggiornata.');
      } catch (error) {
        setPageMessage(error.message || 'Errore salvataggio nota.', 'error');
      } finally {
        button.disabled = false;
      }
    });
  });
}

function focusBooking(bookingId, seat = '') {
  state.selectedBookingId = bookingId;
  state.selectedSeat = seat || '';
  renderSelectedPassengerCard();
  renderSeatMap();
}

async function loadHistory() {
  const response = await checkinService.listCheckinHistory();
  if (response.success === false) return [];
  return (response.data || []).filter((entry) => String(entry.viaggio_id || '').trim() === String(state.trip?.id || '').trim());
}

async function refreshAllData() {
  if (!activeTripId) throw new Error('ID viaggio mancante. Apri il Centro Operativo da "Viaggi".');

  const tripResponse = await tripService.getById(activeTripId);
  if (tripResponse.success === false || !tripResponse.data) {
    throw new Error(tripResponse.error?.message || 'Viaggio non trovato.');
  }
  state.trip = tripResponse.data;

  const tripPassengers = await checkinService.getTripPassengers(activeTripId);
  if (tripPassengers.success === false) {
    throw new Error(tripPassengers.error?.message || 'Impossibile caricare passeggeri del viaggio.');
  }
  state.bookings = normalizeBookings(tripPassengers.data.bookings || []);
  state.passengerRows = buildPassengerRows(state.bookings);
  state.history = await loadHistory();

  els.tripTitle.textContent = normalizeText(state.trip.destinazione || state.trip.titolo || 'Viaggio');
  els.tripMeta.textContent = `${formatDate(state.trip.data_partenza)} • ${normalizeText(state.trip.ora_partenza)} • ${normalizeText(state.trip.autobus || state.trip.autobus_id)}`;

  renderHeaderStats();
  renderQuickPayments();
  renderAlerts();
  renderSeatLegend();
  renderSeatMap();
  renderSelectedPassengerCard();
  renderPassengerTable();
}

async function withTripData(callback) {
  if (!state.trip) {
    await refreshAllData();
  }
  return callback({ trip: state.trip, bookings: state.bookings, company: state.companyInfo });
}

async function openSeatMapPdf() {
  await withTripData(async ({ trip, bookings, company }) => {
    const blob = await generateSeatMapPdf({ trip, bookings, company });
    openPdfBlob(blob);
  });
}

async function downloadSeatMapPdf() {
  await withTripData(async ({ trip, bookings, company }) => {
    const blob = await generateSeatMapPdf({ trip, bookings, company });
    const fileName = `CentroOperativo_Piantina_${String(trip.data_partenza || '').slice(0, 10)}_${Date.now()}.pdf`;
    downloadPdfBlob(blob, fileName);
  });
}

async function openPassengerListPdf() {
  await withTripData(async ({ trip, bookings, company }) => {
    const blob = await generatePassengerListPdf({ trip, bookings, company });
    openPdfBlob(blob);
  });
}

async function downloadPassengerListPdf() {
  await withTripData(async ({ trip, bookings, company }) => {
    const blob = await generatePassengerListPdf({ trip, bookings, company });
    const fileName = `CentroOperativo_Elenco_${String(trip.data_partenza || '').slice(0, 10)}_${Date.now()}.pdf`;
    downloadPdfBlob(blob, fileName);
  });
}

async function handleQrLookupAndAutoCheckin(rawPayload, { fromScanner = false } = {}) {
  if (!rawPayload) {
    setScannerStatus('Inserisci o scansiona il payload QR.', 'warning');
    return;
  }
  state.pendingLookup = true;
  els.analyzeQrBtn.disabled = true;
  setScannerStatus('Ricerca prenotazione da QR in corso...', 'info');

  const lookup = await checkinService.lookupBookingFromQr(rawPayload);
  state.pendingLookup = false;
  els.analyzeQrBtn.disabled = false;

  if (lookup.success === false) {
    setScannerStatus(lookup.error.message || 'Prenotazione non trovata.', 'error');
    return;
  }

  const booking = lookup.data.booking;
  const bookingTripId = String(booking.viaggio_id || booking.tratta_id || '').trim();
  if (bookingTripId !== String(activeTripId)) {
    setScannerStatus('QR valido ma associato a un altro viaggio.', 'warning');
    return;
  }

  const alreadyUsedAt = booking.checked_in_at || booking.ultimo_accesso_at;
  if (booking.checkin_effettuato || String(booking.checkin_stato || '').toUpperCase() === CHECKIN_STATUS.PRESENTE) {
    setScannerStatus(`QR già utilizzato il ${formatDateTime(alreadyUsedAt)}.`, 'warning');
    const firstSeat = formatSeatLabel((parseSeatList(booking.posti_selezionati || booking.posti)[0] || ''));
    state.selectedBookingId = String(booking.id);
    state.selectedSeat = firstSeat;
    await refreshAllData();
    return;
  }

  const operatorName = getOperatorName();
  const gate = String(els.gateInput?.value || '').trim();
  const mark = await checkinService.markBookingPresence({
    booking,
    trip: state.trip,
    status: CHECKIN_STATUS.PRESENTE,
    qrPayload: rawPayload,
    operatorName,
    gate,
    stopLabel: gate,
    note: ''
  });

  if (mark.success === false) {
    setScannerStatus(mark.error.message || 'Errore registrazione check-in.', 'error');
    return;
  }

  const firstSeat = formatSeatLabel((parseSeatList(booking.posti_selezionati || booking.posti)[0] || ''));
  state.selectedBookingId = String(booking.id);
  state.selectedSeat = firstSeat;
  await refreshAllData();
  setScannerStatus(fromScanner ? 'QR letto: check-in registrato automaticamente.' : 'Check-in registrato da QR.', 'success');
}

function clearScanLoop() {
  if (state.scanTimer) {
    window.clearInterval(state.scanTimer);
    state.scanTimer = null;
  }
}

async function detectQrFromFrame() {
  if (!state.detector || !state.stream || !els.video || els.video.readyState < 2) return;
  const context = els.canvas.getContext('2d', { willReadFrequently: true });
  els.canvas.width = els.video.videoWidth || 1280;
  els.canvas.height = els.video.videoHeight || 720;
  context.drawImage(els.video, 0, 0, els.canvas.width, els.canvas.height);
  const barcodes = await state.detector.detect(els.canvas);
  const match = (barcodes || []).find((item) => String(item.rawValue || '').trim());
  if (!match) return;
  const payload = String(match.rawValue || '').trim();
  els.qrPayloadInput.value = payload;
  await stopScanner();
  await handleQrLookupAndAutoCheckin(payload, { fromScanner: true });
}

async function startScanner() {
  if (!('mediaDevices' in navigator) || typeof navigator.mediaDevices.getUserMedia !== 'function') {
    setScannerStatus('Fotocamera non disponibile: usa il payload manuale.', 'warning');
    return;
  }
  if (!('BarcodeDetector' in window)) {
    setScannerStatus('Scanner QR nativo non supportato: usa il payload manuale.', 'warning');
    return;
  }
  const formats = typeof window.BarcodeDetector.getSupportedFormats === 'function'
    ? await window.BarcodeDetector.getSupportedFormats()
    : ['qr_code'];
  if (!formats.includes('qr_code')) {
    setScannerStatus('Formato QR non supportato nel browser.', 'warning');
    return;
  }
  state.detector = new window.BarcodeDetector({ formats: ['qr_code'] });
  state.stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' },
    audio: false
  });
  els.video.srcObject = state.stream;
  await els.video.play();
  clearScanLoop();
  state.scanTimer = window.setInterval(() => {
    detectQrFromFrame().catch((error) => {
      setScannerStatus(error.message || 'Errore durante la scansione QR.', 'error');
    });
  }, 900);
  setScannerStatus('Scanner attivo. Inquadra il QR del passeggero.', 'info');
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

function bindEvents() {
  els.searchPassengerInput?.addEventListener('input', (event) => {
    state.searchTerm = String(event.target.value || '');
    renderPassengerTable();
  });

  els.startScannerBtn?.addEventListener('click', () => {
    startScanner().catch((error) => setScannerStatus(error.message || 'Impossibile avviare scanner.', 'error'));
  });
  els.stopScannerBtn?.addEventListener('click', () => {
    stopScanner().then(() => setScannerStatus('Scanner fermato.', 'info'));
  });
  els.analyzeQrBtn?.addEventListener('click', () => {
    const payload = String(els.qrPayloadInput?.value || '').trim();
    handleQrLookupAndAutoCheckin(payload).catch((error) => setScannerStatus(error.message || 'Errore analisi QR.', 'error'));
  });
  els.openBookingBtn?.addEventListener('click', () => {
    if (!state.selectedBookingId) return;
    window.location.href = `${ADMIN_ROUTES.prenotazioni}?booking=${encodeURIComponent(state.selectedBookingId)}`;
  });

  els.openSeatMapPdfBtn?.addEventListener('click', () => openSeatMapPdf().catch((error) => setPageMessage(error.message || 'Errore PDF piantina.', 'error')));
  els.downloadSeatMapPdfBtn?.addEventListener('click', () => downloadSeatMapPdf().catch((error) => setPageMessage(error.message || 'Errore download PDF piantina.', 'error')));
  els.openPassengerListPdfBtn?.addEventListener('click', () => openPassengerListPdf().catch((error) => setPageMessage(error.message || 'Errore PDF elenco.', 'error')));
  els.downloadPassengerListPdfBtn?.addEventListener('click', () => downloadPassengerListPdf().catch((error) => setPageMessage(error.message || 'Errore download PDF elenco.', 'error')));

  window.addEventListener('beforeunload', () => {
    stopScanner().catch(() => {});
    if (typeof state.unsubscribeHistory === 'function') state.unsubscribeHistory();
  });
}

async function initSettings() {
  const response = await loadImpostazioni();
  if (response.success !== false) {
    state.companyInfo = buildCompanyInfo(response.data);
  }
}

async function init() {
  await initSettings();
  getOperatorName();
  bindEvents();
  if (!activeTripId) {
    const fallbackTrip = await resolveFallbackTrip();
    setActiveTripId(fallbackTrip.id);
    setScannerStatus(`Caricato automaticamente: ${normalizeText(fallbackTrip.optionLabel || fallbackTrip.destinazione || fallbackTrip.titolo)}.`, 'info');
  }
  try {
    await refreshAllData();
  } catch (error) {
    const fallbackTrip = await resolveFallbackTrip(activeTripId);
    const fallbackTripId = String(fallbackTrip.id || '').trim();
    if (!fallbackTripId || fallbackTripId === String(activeTripId || '').trim()) throw error;
    setActiveTripId(fallbackTripId);
    setPageMessage(`Viaggio non trovato. Caricato automaticamente: ${normalizeText(fallbackTrip.optionLabel || fallbackTrip.destinazione || fallbackTrip.titolo)}.`);
    await refreshAllData();
  }
  state.unsubscribeHistory = checkinService.subscribeCheckinHistory(() => {
    refreshAllData().catch(() => {});
  });
}

init().catch((error) => {
  setPageMessage(error.message || 'Errore inizializzazione Centro Operativo.', 'error');
  setScannerStatus(error.message || 'Errore inizializzazione Centro Operativo.', 'error');
});
