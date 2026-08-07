import { bookingService } from '../../services/bookingService.js';
import { tripService } from '../../services/tripService.js';
import { clientService } from '../../services/clientService.js';
import {
  PAYMENT_STATUS,
  buildBookingPaymentSummary,
  getPaymentAbsoluteAmount,
  getPaymentSignedAmount,
  paymentService
} from '../../services/paymentService.js';
import { fleetService } from '../../services/fleetService.js';
import { parseSeatSelection, extractOccupiedSeats, getSeatCountForBooking, isCancelledBookingStatus, serializeSeatSelection } from '../../services/seatAssignmentService.js';
import { generateSeatLayout, renderSeatMapHTML, validateSeatSelection } from '../../services/seatMapService.js';
import { downloadReceipt, generateBookingReceipt } from '../../services/pdfReceiptService.js';
import { CHECKIN_STATUS, markBookingPresence } from '../../services/checkinService.js';
import { getCurrentUser } from '../../services/localAuthService.js';
import { showMessage, showConfirm } from '../../components/messageSystem.js';
import { extractData } from '../../utils/serviceResult.js';
import { findMatchingClientForBooking } from '../../utils/clientIdentity.js';
import { buildCompanyInfo, getCachedSettingsSync, loadImpostazioni } from '../../services/settingsService.js';
import { ADMIN_ROUTES } from '../../utils/appRoutes.js';

const PAYMENTS_MODULE_DISABLED = false;

const tbody = document.querySelector('#bookingTable tbody');
const btnNew = document.getElementById('btnNew');
const btnGoTrips = document.getElementById('btnGoTrips');
const btnOpenPrenota = document.getElementById('btnOpenPrenota');
const close = document.getElementById('close');
const save = document.getElementById('save');
const tot = document.getElementById('tot');
const conf = document.getElementById('conf');
const wait = document.getElementById('wait');
const ann = document.getElementById('ann');
const searchBooking = document.getElementById('searchBooking');
const modal = document.getElementById('modal');
const modalTitle = () => document.querySelector('#modal .content h2');
const changeSeatButton = document.getElementById('change-seat');
const seatChangeModal = document.getElementById('seatChangeModal');
const seatChangeMeta = document.getElementById('seatChangeMeta');
const seatChangeRequired = document.getElementById('seatChangeRequired');
const seatChangeSelected = document.getElementById('seatChangeSelected');
const seatChangeFeedback = document.getElementById('seatChangeFeedback');
const seatChangeMap = document.getElementById('seatChangeMap');
const seatChangeCancel = document.getElementById('seatChangeCancel');
const seatChangeConfirm = document.getElementById('seatChangeConfirm');

const selCliente = () => document.getElementById('selectCliente');
const searchCliente = () => document.getElementById('searchCliente');
const inputClienteNome = () => document.getElementById('cliente_nome');
const inputClienteTelefono = () => document.getElementById('cliente_telefono');
const inputClienteEmail = () => document.getElementById('cliente_email');
const selViaggio = () => document.getElementById('selectViaggio');
const inputNum = () => document.getElementById('num_persone');
const inputImporto = () => document.getElementById('importo');
const inputAcconto = () => document.getElementById('acconto');
const inputSaldo = () => document.getElementById('saldo');
const inputData = () => document.getElementById('data_prenotazione');
const selectStato = () => document.getElementById('stato_select');
const inputNote = () => document.getElementById('note');
const prenId = () => document.getElementById('prenotazione_id');
const metodoPagamento = () => document.getElementById('metodo_pagamento');

const paymentPanel = () => document.getElementById('paymentPanel');
const payTotale = () => document.getElementById('payTotale');
const payPagato = () => document.getElementById('payPagato');
const payResiduo = () => document.getElementById('payResiduo');
const paymentTbody = () => document.getElementById('paymentTbody');
const payImporto = () => document.getElementById('payImporto');
const payTipo = () => document.getElementById('payTipo');
const payMetodo = () => document.getElementById('payMetodo');
const payData = () => document.getElementById('payData');
const payNote = () => document.getElementById('payNote');
const payStatus = () => document.getElementById('payStatus');
const payMovementId = () => document.getElementById('payMovementId');
const btnQuickAcconto = () => document.getElementById('btnQuickAcconto');
const btnQuickSaldo = () => document.getElementById('btnQuickSaldo');
const btnQuickRimborso = () => document.getElementById('btnQuickRimborso');
const btnPaymentCancelEdit = () => document.getElementById('btnPaymentCancelEdit');
const paymentHistoryLink = () => document.getElementById('paymentHistoryLink');

let currentPren = null;
let clientiCache = [];
let viaggiCache = [];
let fleetCache = [];
let clienteFilterTerm = '';
let unsubscribeBookings = null;
let unsubscribeTrips = null;
let unsubscribeClients = null;
let seatChangeState = null;

let COMPANY_INFO = buildCompanyInfo(getCachedSettingsSync());

function hasIdentifier(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized !== '' && normalized !== 'undefined' && normalized !== 'null';
}

function toAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(value || 0));
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function splitFullName(fullName) {
  const normalized = String(fullName || '').trim().replace(/\s+/g, ' ');
  if (!normalized) return { nome: '', cognome: '' };
  const parts = normalized.split(' ');
  if (parts.length === 1) return { nome: parts[0], cognome: '' };
  return { nome: parts.slice(0, -1).join(' '), cognome: parts.slice(-1).join('') };
}

function computePaymentState(importo, pagato, currentState = '') {
  const normalizedState = String(currentState || '');
  if (normalizedState.toLowerCase() === 'annullata') return 'Annullata';
  if (importo > 0 && pagato >= importo) return 'Saldata';
  if (pagato > 0) return 'Acconto Ricevuto';
  if (normalizedState === 'Confermata') return 'Confermata';
  return 'In Attesa';
}

function updatePaymentFields(source = 'acconto') {
  const importo = toAmount(inputImporto()?.value);
  let acconto = toAmount(inputAcconto()?.value);
  let saldo = toAmount(inputSaldo()?.value);

  if (source === 'acconto') {
    saldo = Math.max(importo - acconto, 0);
  } else if (source === 'saldo') {
    acconto = Math.max(importo - saldo, 0);
  } else {
    saldo = Math.max(importo - acconto, 0);
  }

  if (inputAcconto()) inputAcconto().value = acconto.toFixed(2);
  if (inputSaldo()) inputSaldo().value = saldo.toFixed(2);
  const pagato = Math.max(importo - saldo, 0);
  if (selectStato() && selectStato().value !== 'Annullata') {
    selectStato().value = computePaymentState(importo, pagato, selectStato().value);
  }
}

function toggleInitialPaymentInputs(disabled) {
  [inputAcconto(), inputSaldo(), metodoPagamento()].forEach((field) => {
    if (!field) return;
    field.disabled = Boolean(disabled);
  });
}

function setPaymentFormMode({ editing = false, submitLabel = 'Salva movimento' } = {}) {
  if (btnPaymentCancelEdit()) btnPaymentCancelEdit().classList.toggle('hidden', !editing);
  const submitButton = document.getElementById('btnRegistraPagamento');
  if (submitButton) submitButton.textContent = submitLabel;
}

function resetPaymentForm(booking = currentPren) {
  if (payMovementId()) payMovementId().value = '';
  if (payTipo()) payTipo().value = 'Acconto';
  if (payMetodo()) payMetodo().value = 'Contanti';
  if (payData()) payData().value = new Date().toISOString().slice(0, 10);
  if (payNote()) payNote().value = '';
  if (payImporto()) payImporto().value = '';
  setPaymentFormMode();
  syncPaymentSuggestedAmount(booking);
}

function getBookingResidual(booking = currentPren) {
  const total = toAmount(booking?.importo ?? booking?.totale);
  const paid = toAmount(booking?.pagato);
  return Math.max(total - paid, 0);
}

function syncPaymentSuggestedAmount(booking = currentPren) {
  if (!payImporto()) return;
  const type = payTipo()?.value || 'Acconto';
  const residual = getBookingResidual(booking);
  if (type === 'Saldo') {
    payImporto().value = residual > 0 ? residual.toFixed(2) : '';
    return;
  }
  if (type === 'Rimborso') {
    const paid = toAmount(booking?.pagato);
    payImporto().value = paid > 0 ? paid.toFixed(2) : '';
  }
}

function paymentBadgeClass(tipo) {
  if (tipo === 'Saldo') return 'pay-badge-saldo';
  if (tipo === 'Acconto') return 'pay-badge-acconto';
  if (tipo === 'Rimborso') return 'pay-badge-rimborso';
  return 'pay-badge-altro';
}

function statusBadgeClass(status) {
  if (status === PAYMENT_STATUS.paid) return 'pay-badge-saldo';
  if (status === PAYMENT_STATUS.partial) return 'pay-badge-acconto';
  if (status === PAYMENT_STATUS.refunded) return 'pay-badge-rimborso';
  return 'pay-badge-altro';
}

function isPresentBooking(prenotazione = {}) {
  const status = String(prenotazione.checkin_stato || '').trim().toUpperCase();
  if (status === 'PRESENTE' || status === 'ALTRA_FERMATA') return true;
  return Boolean(prenotazione.checkin_effettuato || prenotazione.checked_in_at);
}

function getTripById(id) {
  if (!hasIdentifier(id)) return null;
  return viaggiCache.find((trip) => trip.id === id) || null;
}

function getClientByBooking(prenotazione) {
  if (!prenotazione) return null;
  return findMatchingClientForBooking(prenotazione, clientiCache);
}

function getBusLabelForTrip(trip) {
  const autobusId = trip?.autobus_id || trip?.mezzo_id;
  if (!hasIdentifier(autobusId)) return 'Nessun autobus assegnato al viaggio';
  const bus = fleetCache.find((item) => String(item.id) === String(autobusId));
  if (!bus) return 'Bus assegnato';
  return `${bus.marca || ''} ${bus.modello || ''} ${bus.targa || ''}`.trim();
}

function availableSeatsForTrip(trip) {
  return Math.max(Number(trip?.posti_totali || 0) - Number(trip?.posti_occupati || 0), 0);
}

function getBusByTrip(trip) {
  if (!trip) return null;

  const directId = trip.autobus_id || trip.mezzo_id;
  if (hasIdentifier(directId)) {
    const busById = fleetCache.find((item) => String(item.id) === String(directId));
    if (busById) return busById;
  }

  const references = [trip.autobus, trip.mezzo]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean);

  for (const reference of references) {
    const upperReference = reference.toUpperCase();
    const bus = fleetCache.find((item) => {
      const label = `${item?.targa || ''} ${item?.marca || ''} ${item?.modello || ''}`.toUpperCase();
      return label.includes(upperReference) || upperReference.includes(String(item?.targa || '').toUpperCase());
    });
    if (bus) return bus;
  }

  return null;
}

function getSeatLayoutSourceForTrip(trip) {
  const bus = getBusByTrip(trip);
  return bus?.seat_layout || bus || trip?.seat_layout || trip?.autobus || trip?.mezzo || 'GT53';
}

async function getOccupiedSeatsForTrip(tripId, excludeBookingId = null) {
  const bookings = extractData(await bookingService.getAll(), []);
  return extractOccupiedSeats(bookings, { tripId, excludeBookingId });
}

function setSeatChangeFeedback(message = '') {
  if (!seatChangeFeedback) return;
  seatChangeFeedback.textContent = message;
  seatChangeFeedback.classList.toggle('hidden', !message);
}

function updateSeatChangeSelectionSummary() {
  if (!seatChangeSelected) return;
  const labels = (seatChangeState?.selectedSeats || [])
    .map((seat) => String(seat).padStart(2, '0'))
    .join(', ');
  seatChangeSelected.textContent = labels || '—';
}

function syncSeatChangeSelectionClasses() {
  if (!seatChangeMap || !seatChangeState) return;
  const selectedSeats = new Set(seatChangeState.selectedSeats);
  seatChangeMap.querySelectorAll('.seat[data-seat]').forEach((button) => {
    if (button.disabled || button.classList.contains('occupied')) return;
    const isSelected = selectedSeats.has(button.dataset.seat);
    button.classList.toggle('selected', isSelected);
    button.classList.toggle('available', !isSelected);
  });
  updateSeatChangeSelectionSummary();
}

function closeSeatChangeModal() {
  seatChangeState = null;
  setSeatChangeFeedback('');
  if (seatChangeMap) seatChangeMap.innerHTML = '';
  if (seatChangeModal) {
    seatChangeModal.style.display = 'none';
    seatChangeModal.classList.add('hidden');
    seatChangeModal.setAttribute('aria-hidden', 'true');
  }
}

function syncAmountFromTripSelection() {
  const trip = getTripById(selViaggio()?.value || '');
  const seats = Math.max(Number(inputNum()?.value || 0), 1);
  if (!Number.isFinite(seats) || seats <= 0) return;
  if (!trip) return;
  const unitPrice = toAmount(trip.prezzo);
  if (inputImporto()) {
    inputImporto().value = (unitPrice * seats).toFixed(2);
  }
  updatePaymentFields('importo');
}

function formatClientLabel(client) {
  const fullName = `${client.nome || ''} ${client.cognome || ''}`.trim();
  const phone = client.telefono ? ` - ${client.telefono}` : '';
  return `${fullName || client.email || client.id}${phone}`;
}

function filterAndRenderClientOptions() {
  const select = selCliente();
  if (!select) return;
  const term = clienteFilterTerm.toLowerCase();
  const selected = select.value;
  const filtered = clientiCache.filter((client) => {
    if (!term) return true;
    const text = `${client.nome || ''} ${client.cognome || ''} ${client.telefono || ''} ${client.email || ''}`.toLowerCase();
    return text.includes(term);
  });
  select.innerHTML = '<option value="">-- Seleziona cliente --</option>' + filtered
    .map((client) => `<option value="${client.id}">${formatClientLabel(client)}</option>`)
    .join('');
  if (selected && filtered.some((client) => client.id === selected)) select.value = selected;
}

function renderTravelOptions() {
  const select = selViaggio();
  if (!select) return;
  select.innerHTML = '<option value="">-- Seleziona viaggio --</option>' + viaggiCache
    .filter((trip) => trip.stato !== 'Archiviato' && trip.stato !== 'Annullato')
    .map((trip) => {
      const disponibili = availableSeatsForTrip(trip);
      const busLabel = getBusLabelForTrip(trip);
      return `<option value="${trip.id}" data-cod="${trip.codice || ''}" data-disponibili="${disponibili}">${trip.codice || ''} - ${trip.titolo || trip.destinazione || ''} (${trip.data_partenza || ''}) - Bus: ${busLabel} - Disponibili: ${disponibili}</option>`;
    })
    .join('');
}

async function refreshCaches() {
  clientiCache = extractData(await clientService.getAll(), []);
  viaggiCache = extractData(await tripService.getAll(), []);
  fleetCache = extractData(await fleetService.getAll(), []);
  filterAndRenderClientOptions();
  renderTravelOptions();
}

function resetModal() {
  currentPren = null;
  clienteFilterTerm = '';
  if (modalTitle()) modalTitle().textContent = 'Nuova Prenotazione';
  if (prenId()) prenId().value = '';
  if (selCliente()) selCliente().value = '';
  if (searchCliente()) searchCliente().value = '';
  if (inputClienteNome()) inputClienteNome().value = '';
  if (inputClienteTelefono()) inputClienteTelefono().value = '';
  if (inputClienteEmail()) inputClienteEmail().value = '';
  if (selViaggio()) selViaggio().value = '';
  if (inputData()) inputData().value = new Date().toISOString().slice(0, 10);
  if (inputNum()) inputNum().value = 1;
  if (inputImporto()) inputImporto().value = '0.00';
  if (inputAcconto()) inputAcconto().value = '0.00';
  if (inputSaldo()) inputSaldo().value = '0.00';
  if (metodoPagamento()) metodoPagamento().value = 'Contanti';
  if (selectStato()) selectStato().value = 'In Attesa';
  if (inputNote()) inputNote().value = '';
  toggleInitialPaymentInputs(false);
  if (paymentPanel()) paymentPanel().classList.add('hidden');
  if (paymentTbody()) paymentTbody().innerHTML = '';
  if (payTotale()) payTotale().textContent = formatCurrency(0);
  if (payPagato()) payPagato().textContent = formatCurrency(0);
  if (payResiduo()) payResiduo().textContent = formatCurrency(0);
  if (payStatus()) payStatus().textContent = PAYMENT_STATUS.pending;
  resetPaymentForm(null);
  if (paymentHistoryLink()) paymentHistoryLink().href = ADMIN_ROUTES.pagamenti;
  if (changeSeatButton) changeSeatButton.classList.add('hidden');
}

async function openNewModal() {
  await refreshCaches();
  resetModal();
  if (modal) modal.style.display = 'flex';
}

async function openModalForEdit(prenotazione) {
  currentPren = prenotazione;
  clienteFilterTerm = '';
  if (searchCliente()) searchCliente().value = '';
  filterAndRenderClientOptions();
  if (modalTitle()) modalTitle().textContent = 'Modifica Prenotazione';
  if (prenId()) prenId().value = prenotazione.id || '';
  const matchedClient = getClientByBooking(prenotazione);
  if (selCliente()) selCliente().value = matchedClient?.id || '';
  if (inputClienteNome()) inputClienteNome().value = matchedClient ? '' : (prenotazione.cliente_nome || '');
  if (inputClienteTelefono()) inputClienteTelefono().value = matchedClient ? '' : (prenotazione.cliente_telefono || '');
  if (inputClienteEmail()) inputClienteEmail().value = matchedClient ? '' : (prenotazione.cliente_email || '');
  if (selViaggio()) selViaggio().value = prenotazione.viaggio_id || '';
  const trip = getTripById(prenotazione.viaggio_id);
  const bus = getBusByTrip(trip);
  if (!bus) {
    showMessage('Nessun autobus assegnato al viaggio', 'error');
  }
  if (inputData()) inputData().value = prenotazione.data || prenotazione.data_prenotazione || String(prenotazione.created_at || '').slice(0, 10);
  if (inputNum()) inputNum().value = Number(prenotazione.posti || 1);
  if (inputImporto()) inputImporto().value = toAmount(prenotazione.importo).toFixed(2);
  if (inputAcconto()) inputAcconto().value = toAmount(prenotazione.acconto).toFixed(2);
  if (inputSaldo()) inputSaldo().value = toAmount(prenotazione.saldo).toFixed(2);
  if (metodoPagamento()) metodoPagamento().value = prenotazione.metodo_pagamento || 'Contanti';
  if (selectStato()) selectStato().value = prenotazione.stato || 'In Attesa';
  if (inputNote()) inputNote().value = prenotazione.note || '';
  toggleInitialPaymentInputs(true);
  updatePaymentFields('acconto');
  if (selectStato()) selectStato().value = prenotazione.stato || 'In Attesa';
  if (changeSeatButton) {
    changeSeatButton.classList.toggle('hidden', !prenotazione?.id || isCancelledBookingStatus(prenotazione.stato));
  }
  if (modal) modal.style.display = 'flex';
  if (paymentPanel()) paymentPanel().classList.remove('hidden');
  resetPaymentForm(prenotazione);
  if (paymentHistoryLink()) paymentHistoryLink().href = `${ADMIN_ROUTES.pagamenti}?booking=${encodeURIComponent(prenotazione.id || '')}`;
  await loadPayments(prenotazione);
}

function toggleSeatChangeSelection(seatId) {
  if (!seatChangeState) return;
  const seat = String(seatId ?? '').trim();
  if (!seat) return;

  const isSelected = seatChangeState.selectedSeats.includes(seat);
  if (isSelected) {
    seatChangeState.selectedSeats = seatChangeState.selectedSeats.filter((item) => item !== seat);
    setSeatChangeFeedback('');
    syncSeatChangeSelectionClasses();
    return;
  }

  if (seatChangeState.requiredSeats === 1) {
    seatChangeState.selectedSeats = [seat];
    setSeatChangeFeedback('');
    syncSeatChangeSelectionClasses();
    return;
  }

  if (seatChangeState.selectedSeats.length >= seatChangeState.requiredSeats) {
    setSeatChangeFeedback(`Puoi selezionare esattamente ${seatChangeState.requiredSeats} posti.`);
    return;
  }

  seatChangeState.selectedSeats = [...seatChangeState.selectedSeats, seat]
    .sort((left, right) => Number(left) - Number(right));
  setSeatChangeFeedback('');
  syncSeatChangeSelectionClasses();
}

async function openSeatChangeModal(bookingInput = currentPren) {
  const bookingId = bookingInput?.id || bookingInput;
  const booking = extractData(await bookingService.getById(bookingId), bookingInput || null);
  if (!booking?.id) throw new Error('Prenotazione non trovata');
  if (isCancelledBookingStatus(booking.stato)) throw new Error('Non puoi cambiare i posti di una prenotazione annullata.');

  await refreshCaches();
  const trip = getTripById(booking.viaggio_id);
  if (!trip) throw new Error('Viaggio associato non trovato.');

  const bus = getBusByTrip(trip);
  if (!bus) throw new Error('Nessun autobus assegnato al viaggio.');

  const requiredSeats = Math.max(getSeatCountForBooking(booking), 1);
  const currentSeats = parseSeatSelection(booking.posti_selezionati);
  const occupiedSeats = await getOccupiedSeatsForTrip(trip.id, booking.id);
  const layoutSource = getSeatLayoutSourceForTrip(trip);

  seatChangeState = {
    booking,
    trip,
    bus,
    requiredSeats,
    currentSeats,
    occupiedSeats,
    layoutSource,
    selectedSeats: currentSeats.length
      ? [...currentSeats].sort((left, right) => Number(left) - Number(right))
      : []
  };

  if (seatChangeMeta) {
    const tripLabel = trip.codice || trip.titolo || trip.destinazione || 'Viaggio';
    seatChangeMeta.textContent = `${booking.cliente || booking.cliente_nome || 'Cliente'} • ${tripLabel} • ${bus.marca || ''} ${bus.modello || ''} ${bus.targa || ''}`.trim();
  }
  if (seatChangeRequired) seatChangeRequired.textContent = String(requiredSeats);

  setSeatChangeFeedback('');
  if (seatChangeMap) seatChangeMap.innerHTML = renderSeatMapHTML(generateSeatLayout(layoutSource, occupiedSeats));
  syncSeatChangeSelectionClasses();

  if (seatChangeModal) {
    seatChangeModal.classList.remove('hidden');
    seatChangeModal.style.display = 'flex';
    seatChangeModal.setAttribute('aria-hidden', 'false');
  }
}

async function confirmSeatChange() {
  if (!seatChangeState?.booking?.id) throw new Error('Nessuna prenotazione selezionata.');

  const { booking, trip, layoutSource, occupiedSeats, requiredSeats, selectedSeats } = seatChangeState;
  if (selectedSeats.length !== requiredSeats) {
    throw new Error(`Seleziona esattamente ${requiredSeats} posti prima di confermare.`);
  }

  const validation = validateSeatSelection(layoutSource, selectedSeats, occupiedSeats);
  if (!validation.valid) {
    throw new Error(validation.errors[0] || 'Selezione posti non valida.');
  }

  const updatedBooking = extractData(await bookingService.update(booking.id, {
    posti: requiredSeats,
    posti_selezionati: serializeSeatSelection(selectedSeats),
    updated_at: new Date().toISOString()
  }), null);

  if (!updatedBooking?.id) throw new Error('Aggiornamento prenotazione non riuscito.');

  const pdfBlob = await generateBookingReceipt(updatedBooking, trip, COMPANY_INFO);
  downloadReceipt(pdfBlob, updatedBooking.id || updatedBooking.codice || 'prenotazione');

  currentPren = updatedBooking;
  closeSeatChangeModal();
  await refreshCaches();
  await render();
  showMessage('Posto aggiornato e ricevuta rigenerata', 'success');
}

async function ensureClientSelection() {
  const selectedId = selCliente()?.value || '';
  if (selectedId) {
    const client = clientiCache.find((item) => item.id === selectedId);
    if (!client) throw new Error('Cliente non valido');
    return { client, created: false };
  }

  const fullName = inputClienteNome()?.value?.trim() || '';
  if (!fullName) throw new Error('Seleziona un cliente o inserisci il nuovo cliente');
  const { nome, cognome } = splitFullName(fullName);
  const telefono = inputClienteTelefono()?.value?.trim() || '';
  const email = inputClienteEmail()?.value?.trim() || '';
  if (!telefono) throw new Error('Telefono nuovo cliente obbligatorio');

  const existingByPhone = clientiCache.find((item) => String(item.telefono || '').trim() === telefono);
  if (existingByPhone) return { client: existingByPhone, created: false };

  const created = extractData(await clientService.create({
    nome,
    cognome,
    telefono,
    email
  }), null);
  if (!created) throw new Error('Impossibile creare il cliente automaticamente');
  clientiCache.push(created);
  filterAndRenderClientOptions();
  if (selCliente()) selCliente().value = created.id;
  return { client: created, created: true };
}

async function applyOccupancyUpdate(previousTripId, previousSeats, nextTripId, nextSeats) {
  const oldSeats = Number(previousSeats || 0);
  const newSeats = Number(nextSeats || 0);

  if (previousTripId && previousTripId === nextTripId) {
    const trip = extractData(await tripService.getById(nextTripId), null);
    if (!trip) throw new Error('Viaggio non trovato');
    const availableNow = availableSeatsForTrip(trip);
    const required = newSeats - oldSeats;
    if (required > availableNow) throw new Error('Posti insufficienti per questo viaggio');
    if (required !== 0) extractData(await tripService.updateOccupancy(nextTripId, required), null);
    return;
  }

  if (previousTripId && oldSeats > 0) {
    extractData(await tripService.updateOccupancy(previousTripId, -oldSeats), null);
  }

  if (!nextTripId || newSeats <= 0) return;

  const nextTrip = extractData(await tripService.getById(nextTripId), null);
  if (!nextTrip) {
    if (previousTripId && oldSeats > 0) extractData(await tripService.updateOccupancy(previousTripId, oldSeats), null);
    throw new Error('Viaggio non valido');
  }

  const available = availableSeatsForTrip(nextTrip);
  if (newSeats > available) {
    if (previousTripId && oldSeats > 0) extractData(await tripService.updateOccupancy(previousTripId, oldSeats), null);
    throw new Error('Posti insufficienti per questo viaggio');
  }

  try {
    extractData(await tripService.updateOccupancy(nextTripId, newSeats), null);
  } catch (error) {
    if (previousTripId && oldSeats > 0) extractData(await tripService.updateOccupancy(previousTripId, oldSeats), null);
    throw error;
  }
}

async function removeBooking(id) {
  const booking = extractData(await bookingService.getById(id), null);
  if (!booking) throw new Error('Prenotazione non trovata');
  const reservedSeats = booking.stato === 'Annullata' ? 0 : booking.posti;
  await applyOccupancyUpdate(booking.viaggio_id, reservedSeats, null, 0);
  extractData(await bookingService.delete(id), null);
}

function rowTemplate(prenotazione) {
  const trip = getTripById(prenotazione.viaggio_id);
  const tripLabel = prenotazione.viaggio_codice
    || trip?.codice
    || trip?.titolo
    || trip?.destinazione
    || prenotazione.viaggio_id
    || '';
  const bookingDate = prenotazione.data || prenotazione.data_prenotazione || String(prenotazione.created_at || '').slice(0, 10);
  const changeSeatDisabled = isCancelledBookingStatus(prenotazione.stato) ? 'disabled' : '';
  const paymentSummary = buildBookingPaymentSummary(prenotazione, []);
  const presentChecked = isPresentBooking(prenotazione) ? 'checked' : '';
  return `<tr data-id="${prenotazione.id}">
    <td>${prenotazione.codice || prenotazione.id || ''}</td>
    <td>${escapeHtml(prenotazione.cliente_nome || prenotazione.cliente || '-')}</td>
    <td><a href="${ADMIN_ROUTES.viaggi}?trip=${encodeURIComponent(prenotazione.viaggio_id || '')}">${tripLabel}</a></td>
    <td>${bookingDate}</td>
    <td>${prenotazione.posti || 0}</td>
    <td>${formatCurrency(toAmount(prenotazione.importo))}</td>
    <td>${formatCurrency(toAmount(prenotazione.pagato))}</td>
    <td>${formatCurrency(paymentSummary.residual)}</td>
    <td><span class="pay-badge ${statusBadgeClass(paymentSummary.status)}">${paymentSummary.status}</span></td>
    <td><input type="checkbox" class="presenceToggle" ${presentChecked} aria-label="Presenza ${escapeHtml(prenotazione.cliente_nome || prenotazione.id || '')}"></td>
    <td>
      <div class="booking-actions">
        <button type="button" class="openBtn">Apri</button>
        <button type="button" class="changeSeatBtn btn-secondary" ${changeSeatDisabled}>Cambia posto</button>
        <button type="button" class="delBtn">Elimina</button>
      </div>
    </td>
  </tr>`;
}

async function updatePresenceFromTable(bookingId, checked) {
  const current = extractData(await bookingService.getById(bookingId), null);
  if (!current) throw new Error('Prenotazione non trovata.');
  const trip = getTripById(current.viaggio_id);
  const operator = getCurrentUser()?.nome || '';
  const status = checked ? CHECKIN_STATUS.PRESENTE : CHECKIN_STATUS.NON_PRESENTE;
  const response = await markBookingPresence({
    booking: current,
    trip,
    status,
    operatorName: operator,
    note: checked ? 'Presenza confermata da modulo Prenotazioni' : 'Presenza rimossa da modulo Prenotazioni'
  });
  if (response.success === false) throw response.error;
}

async function render() {
  const prenotazioni = extractData(await bookingService.getAll(), []);
  const searchTerm = String(searchBooking?.value || '').trim().toLowerCase();
  const filtered = !searchTerm
    ? prenotazioni
    : prenotazioni.filter((item) => {
      const trip = getTripById(item.viaggio_id);
      const searchable = `${item.codice || ''} ${item.cliente_nome || ''} ${item.viaggio_codice || ''} ${trip?.codice || ''} ${trip?.titolo || ''} ${trip?.destinazione || ''} ${item.stato || ''}`.toLowerCase();
      return searchable.includes(searchTerm);
    });

  let c = 0;
  let w = 0;
  let a = 0;
  filtered.forEach((p) => {
    if (p.stato === 'Confermata' || p.stato === 'Saldata') c++;
    if (p.stato === 'In Attesa' || p.stato === 'Acconto Ricevuto') w++;
    if (p.stato === 'Annullata') a++;
  });

  tbody.innerHTML = filtered.map(rowTemplate).join('');
  if (tot) tot.textContent = String(filtered.length);
  if (conf) conf.textContent = String(c);
  if (wait) wait.textContent = String(w);
  if (ann) ann.textContent = String(a);
  attachEvents();
}

function attachEvents() {
  document.querySelectorAll('.delBtn').forEach((button) => {
    button.onclick = async (event) => {
      const id = event.target.closest('tr').dataset.id;
      const confirmed = await showConfirm({ title: 'Conferma', message: 'Confermi eliminazione?', confirmText: 'Elimina', cancelText: 'Annulla' });
      if (!confirmed) return;
      try {
        await removeBooking(id);
        await render();
        showMessage('Prenotazione eliminata', 'info');
      } catch (error) {
        showMessage(error.message || 'Errore eliminazione prenotazione', 'error');
      }
    };
  });

  document.querySelectorAll('.openBtn').forEach((button) => {
    button.onclick = async (event) => {
      try {
        const id = event.target.closest('tr').dataset.id;
        await refreshCaches();
        const booking = extractData(await bookingService.getById(id), null);
        if (!booking) throw new Error('Prenotazione non trovata');
        await openModalForEdit(booking);
      } catch (error) {
        showMessage(error.message || 'Errore apertura prenotazione', 'error');
      }
    };
  });

  document.querySelectorAll('.changeSeatBtn').forEach((button) => {
    button.onclick = async (event) => {
      try {
        const id = event.target.closest('tr').dataset.id;
        await refreshCaches();
        const booking = extractData(await bookingService.getById(id), null);
        await openSeatChangeModal(booking);
      } catch (error) {
        showMessage(error.message || 'Errore apertura cambio posto', 'error');
      }
    };
  });

  document.querySelectorAll('.presenceToggle').forEach((checkbox) => {
    checkbox.addEventListener('change', async (event) => {
      const row = event.target.closest('tr');
      const id = row?.dataset?.id;
      if (!id) return;
      const checked = Boolean(event.target.checked);
      event.target.disabled = true;
      try {
        await updatePresenceFromTable(id, checked);
        await render();
        showMessage('Presenza aggiornata', 'info');
      } catch (error) {
        event.target.checked = !checked;
        showMessage(error.message || 'Errore aggiornamento presenza', 'error');
      } finally {
        event.target.disabled = false;
      }
    });
  });
}

async function saveBooking() {
  const viaggioId = selViaggio()?.value || '';
  const viaggio = getTripById(viaggioId);
  if (!viaggioId || !viaggio) throw new Error('Seleziona un viaggio valido');

  const posti = Number(inputNum()?.value || 0);
  if (!Number.isFinite(posti) || posti <= 0) throw new Error('Numero persone deve essere > 0');

  const importo = toAmount(inputImporto()?.value);
  if (importo <= 0) throw new Error('Importo totale deve essere maggiore di zero');
  const acconto = toAmount(inputAcconto()?.value);
  const saldo = Math.max(importo - acconto, 0);
  const pagato = Math.max(importo - saldo, 0);
  const manualState = selectStato()?.value || '';
  const stato = manualState === 'Annullata'
    ? 'Annullata'
    : computePaymentState(importo, pagato, manualState);
  const clientResult = await ensureClientSelection();
  const cliente = clientResult.client;
  const bookingDate = inputData()?.value || new Date().toISOString().slice(0, 10);
  const bookingDateIso = `${bookingDate}T00:00:00.000Z`;

  const payload = {
    id: prenId()?.value || undefined,
    cliente: `${cliente.nome || ''} ${cliente.cognome || ''}`.trim(),
    telefono: cliente.telefono || '',
    email: cliente.email || '',
    viaggio_id: viaggio.id,
    posti,
    totale: importo,
    importo,
    acconto,
    saldo,
    pagato,
    metodo_pagamento: metodoPagamento()?.value || '',
    stato,
    note: inputNote()?.value?.trim() || '',
    created_at: currentPren?.created_at || bookingDateIso
  };

  const previousTripId = currentPren?.viaggio_id || null;
  const previousSeats = currentPren?.stato === 'Annullata' ? 0 : Number(currentPren?.posti || 0);
  const nextSeats = payload.stato === 'Annullata' ? 0 : payload.posti;
  let occupancyUpdated = false;
  try {
    await applyOccupancyUpdate(previousTripId, previousSeats, payload.viaggio_id, nextSeats);
    occupancyUpdated = true;
    let savedBooking = null;
    if (payload.id) savedBooking = extractData(await bookingService.update(payload.id, payload), null);
    else savedBooking = extractData(await bookingService.create(payload), null);
    if (!savedBooking?.id) throw new Error('Salvataggio prenotazione non riuscito');
    if (!payload.id && pagato > 0) {
      await paymentService.aggiungiPagamento(savedBooking.id, {
        importo: pagato,
        tipo: pagato >= importo ? 'Saldo' : 'Acconto',
        metodo_pagamento: metodoPagamento()?.value || 'Contanti',
        data_pagamento: bookingDate,
        note: inputNote()?.value?.trim() || 'Pagamento iniziale registrato in creazione prenotazione.',
        cliente: savedBooking.cliente_nome || savedBooking.cliente || payload.cliente,
        viaggio: savedBooking.viaggio_codice || viaggio.codice || viaggio.titolo || viaggio.destinazione || '',
        viaggio_id: savedBooking.viaggio_id || viaggio.id
      });
      savedBooking = extractData(await bookingService.getById(savedBooking.id), savedBooking);
    }
  } catch (error) {
    if (clientResult.created) {
      const clientRemoval = await clientService.delete(cliente.id);
      if (clientRemoval.success === false) {
        console.error('Rollback cliente non riuscito', clientRemoval.error);
      }
    }
    if (occupancyUpdated) {
      await applyOccupancyUpdate(payload.viaggio_id, nextSeats, previousTripId, previousSeats);
    }
    throw error;
  }

  if (modal) modal.style.display = 'none';
  await refreshCaches();
  await render();
  showMessage(payload.id ? 'Prenotazione aggiornata' : 'Prenotazione salvata', 'info');
}

function renderPaymentRow(pagamento) {
  const signedAmount = getPaymentSignedAmount(pagamento);
  const absoluteAmount = getPaymentAbsoluteAmount(pagamento);
  const data = pagamento.data_pagamento || String(pagamento.created_at || '').slice(0, 10);
  const tipo = pagamento.tipo || 'Acconto';
  const badgeClass = paymentBadgeClass(tipo);
  const amountClass = signedAmount < 0 ? 'pay-negative' : 'pay-positive';
  return `<tr data-pay-id="${pagamento.id}">
    <td>${data}</td>
    <td>${escapeHtml(pagamento.ricevuta || '-')}</td>
    <td><span class="pay-badge ${badgeClass}">${tipo}</span></td>
    <td class="${amountClass}">${signedAmount < 0 ? '-' : '+'}${formatCurrency(absoluteAmount)}</td>
    <td>${escapeHtml(pagamento.metodo_pagamento || pagamento.metodo || '')}</td>
    <td>${escapeHtml(pagamento.note || '')}</td>
    <td>
      <div class="pay-row-actions">
        <button class="editPayBtn btn-secondary" type="button" title="Modifica">Modifica</button>
        <button class="delPayBtn btn-icon" type="button" title="Elimina">✕</button>
      </div>
    </td>
  </tr>`;
}

async function loadPayments(booking) {
  if (!paymentPanel() || !booking?.id) return;
  if (PAYMENTS_MODULE_DISABLED) {
    if (payTotale()) payTotale().textContent = `€ ${toAmount(booking.importo).toFixed(2)}`;
    if (payPagato()) payPagato().textContent = '€ 0.00';
    if (payResiduo()) payResiduo().textContent = `€ ${toAmount(booking.importo).toFixed(2)}`;
    const tbody = paymentTbody();
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="6" class="pay-empty">Modulo pagamenti temporaneamente disabilitato</td></tr>';
    }
    return;
  }
  const paymentData = extractData(await paymentService.getBookingSummary(booking), null);
  const pagamenti = paymentData?.payments || [];
  const summary = paymentData?.summary || buildBookingPaymentSummary(booking, pagamenti);
  currentPren = {
    ...(currentPren || booking),
    ...booking,
    pagato: summary.paidNet,
    saldo: summary.residual,
    acconto: summary.depositTotal,
    metodo_pagamento: summary.latestMethod || booking.metodo_pagamento || ''
  };

  if (payTotale()) payTotale().textContent = formatCurrency(summary.totalDue);
  if (payPagato()) payPagato().textContent = formatCurrency(summary.paidNet);
  if (payResiduo()) payResiduo().textContent = formatCurrency(summary.residual);
  if (payStatus()) payStatus().innerHTML = `<span class="pay-badge ${statusBadgeClass(summary.status)}">${summary.status}</span>`;
  if (inputAcconto()) inputAcconto().value = toAmount(summary.depositTotal).toFixed(2);
  if (inputSaldo()) inputSaldo().value = toAmount(summary.residual).toFixed(2);
  if (metodoPagamento()) metodoPagamento().value = summary.latestMethod || 'Contanti';

  const tbody = paymentTbody();
  if (tbody) {
    tbody.innerHTML = pagamenti.length > 0
      ? pagamenti.map(renderPaymentRow).join('')
      : '<tr><td colspan="7" class="pay-empty">Nessun movimento registrato per questa prenotazione</td></tr>';
  }

  document.querySelectorAll('.editPayBtn').forEach((btn) => {
    btn.onclick = async () => {
      const payId = btn.closest('tr')?.dataset?.payId;
      if (!payId) return;
      const movement = pagamenti.find((item) => item.id === payId);
      if (!movement) return;
      if (payMovementId()) payMovementId().value = movement.id;
      if (payTipo()) payTipo().value = movement.tipo || 'Acconto';
      if (payImporto()) payImporto().value = getPaymentAbsoluteAmount(movement).toFixed(2);
      if (payMetodo()) payMetodo().value = movement.metodo_pagamento || movement.metodo || 'Contanti';
      if (payData()) payData().value = movement.data_pagamento || new Date().toISOString().slice(0, 10);
      if (payNote()) payNote().value = movement.note || '';
      setPaymentFormMode({ editing: true, submitLabel: 'Aggiorna movimento' });
    };
  });

  document.querySelectorAll('.delPayBtn').forEach((btn) => {
    btn.onclick = async () => {
      const payId = btn.closest('tr')?.dataset?.payId;
      if (!payId) return;
      const confirmed = await showConfirm({ title: 'Elimina pagamento', message: 'Eliminare questo pagamento?', confirmText: 'Elimina', cancelText: 'Annulla' });
      if (!confirmed) return;
      try {
        await paymentService.eliminaPagamento(payId);
        const refreshed = extractData(await bookingService.getById(booking.id), null);
        if (refreshed) {
          await aggiornaTotaliDaPagamenti(refreshed);
          currentPren = extractData(await bookingService.getById(booking.id), currentPren);
          if (selectStato()) selectStato().value = currentPren.stato || 'In Attesa';
          await loadPayments(currentPren);
        }
        resetPaymentForm(currentPren);
        await render();
        showMessage('Pagamento eliminato', 'info');
      } catch (err) {
        showMessage(err.message || 'Errore eliminazione pagamento', 'error');
      }
    };
  });
}

async function aggiornaTotaliDaPagamenti(booking) {
  if (PAYMENTS_MODULE_DISABLED) return;
  return paymentService.syncBookingSummary(booking.id);
}

async function handleRegistraPagamento() {
  if (PAYMENTS_MODULE_DISABLED) {
    showMessage('Modulo pagamenti temporaneamente disabilitato', 'info');
    return;
  }
  if (!currentPren?.id) return;
  const imp = toAmount(payImporto()?.value);
  if (imp <= 0) { showMessage('Inserisci un importo valido', 'error'); return; }
  const oggi = new Date().toISOString().slice(0, 10);
  const movementId = payMovementId()?.value || '';
  const payload = {
    importo: imp,
    tipo: payTipo()?.value || 'Acconto',
    metodo_pagamento: payMetodo()?.value || 'Contanti',
    data_pagamento: payData()?.value || oggi,
    note: payNote()?.value?.trim() || '',
    cliente: currentPren.cliente_nome || currentPren.cliente || '',
    viaggio: currentPren.viaggio_codice || currentPren.destinazione || '',
    viaggio_id: currentPren.viaggio_id || null,
    prenotazione_id: currentPren.id
  };

  if (movementId) {
    await paymentService.update(movementId, payload);
  } else {
    await paymentService.aggiungiPagamento(currentPren.id, payload);
  }

  const refreshed = extractData(await bookingService.getById(currentPren.id), currentPren);
  await aggiornaTotaliDaPagamenti(refreshed);
  currentPren = extractData(await bookingService.getById(currentPren.id), currentPren);

  resetPaymentForm(currentPren);
  if (selectStato()) selectStato().value = currentPren.stato || 'In Attesa';
  await loadPayments(currentPren);
  await render();
  showMessage(movementId ? 'Movimento aggiornato con successo' : 'Pagamento registrato con successo', 'info');
}

function bindUiEvents() {
  if (btnNew) {
    btnNew.onclick = () => openNewModal().catch((error) => showMessage(error.message || 'Errore apertura form', 'error'));
  }

  if (btnGoTrips) {
    btnGoTrips.onclick = () => {
      window.location.href = ADMIN_ROUTES.viaggi;
    };
  }

  if (btnOpenPrenota) {
    btnOpenPrenota.onclick = () => {
      window.location.href = ADMIN_ROUTES.prenotazione;
    };
  }

  if (close) {
    close.onclick = () => {
      if (modal) modal.style.display = 'none';
      if (changeSeatButton) changeSeatButton.classList.add('hidden');
    };
  }

  if (save) {
    save.onclick = () => saveBooking().catch((error) => showMessage(error.message || 'Errore durante salvataggio', 'error'));
  }

  if (changeSeatButton) {
    changeSeatButton.onclick = () => {
      openSeatChangeModal(currentPren).catch((error) => showMessage(error.message || 'Errore apertura cambio posto', 'error'));
    };
  }

  if (searchBooking) {
    searchBooking.oninput = () => {
      render().catch((error) => showMessage(error.message || 'Errore ricerca', 'error'));
    };
  }

  if (searchCliente()) {
    searchCliente().addEventListener('input', (event) => {
      clienteFilterTerm = String(event.target.value || '').trim();
      filterAndRenderClientOptions();
    });
  }

  if (selViaggio()) {
    selViaggio().addEventListener('change', () => {
      const trip = getTripById(selViaggio().value);
      if (trip && availableSeatsForTrip(trip) > 0 && Number(inputNum()?.value || 0) <= 0) {
        inputNum().value = '1';
      }
      syncAmountFromTripSelection();
    });
  }

  if (inputNum()) inputNum().addEventListener('input', syncAmountFromTripSelection);
  if (inputImporto()) inputImporto().addEventListener('input', () => updatePaymentFields('importo'));
  if (inputAcconto()) inputAcconto().addEventListener('input', () => updatePaymentFields('acconto'));
  if (inputSaldo()) inputSaldo().addEventListener('input', () => updatePaymentFields('saldo'));

  document.getElementById('btnRegistraPagamento')?.addEventListener('click', () => {
    handleRegistraPagamento().catch((error) => showMessage(error.message || 'Errore registrazione pagamento', 'error'));
  });

  document.getElementById('payTipo')?.addEventListener('change', () => {
    syncPaymentSuggestedAmount(currentPren);
  });
  btnQuickAcconto()?.addEventListener('click', () => {
    if (payTipo()) payTipo().value = 'Acconto';
    resetPaymentForm(currentPren);
  });
  btnQuickSaldo()?.addEventListener('click', () => {
    if (payTipo()) payTipo().value = 'Saldo';
    if (payMovementId()) payMovementId().value = '';
    setPaymentFormMode({ editing: false, submitLabel: 'Salva movimento' });
    syncPaymentSuggestedAmount(currentPren);
    payImporto()?.focus();
  });
  btnQuickRimborso()?.addEventListener('click', () => {
    if (payTipo()) payTipo().value = 'Rimborso';
    if (payMovementId()) payMovementId().value = '';
    setPaymentFormMode({ editing: false, submitLabel: 'Salva movimento' });
    syncPaymentSuggestedAmount(currentPren);
    payImporto()?.focus();
  });
  btnPaymentCancelEdit()?.addEventListener('click', () => resetPaymentForm(currentPren));

  seatChangeCancel?.addEventListener('click', closeSeatChangeModal);
  seatChangeConfirm?.addEventListener('click', () => {
    confirmSeatChange().catch((error) => {
      setSeatChangeFeedback(error.message || 'Errore durante il cambio posto.');
    });
  });
  seatChangeMap?.addEventListener('click', (event) => {
    const seatButton = event.target.closest('.seat[data-seat]');
    if (!seatButton || seatButton.disabled) return;
    toggleSeatChangeSelection(seatButton.dataset.seat);
  });
  seatChangeModal?.addEventListener('click', (event) => {
    if (event.target === seatChangeModal) closeSeatChangeModal();
  });
}

async function handlePrenotaPrefill() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('from') !== 'prenota') return;
  await openNewModal();
  const nome = params.get('cliente') || '';
  const telefono = params.get('telefono') || '';
  const email = params.get('email') || '';
  const viaggioId = params.get('viaggioId') || '';
  const posti = params.get('posti') || '';
  const importo = params.get('importo') || '';
  const acconto = params.get('acconto') || '';
  const note = params.get('note') || '';
  if (inputClienteNome()) inputClienteNome().value = nome;
  if (inputClienteTelefono()) inputClienteTelefono().value = telefono;
  if (inputClienteEmail()) inputClienteEmail().value = email;
  if (selViaggio() && viaggioId) selViaggio().value = viaggioId;
  if (inputNum() && posti) inputNum().value = posti;
  if (inputImporto() && importo) inputImporto().value = toAmount(importo).toFixed(2);
  if (inputAcconto() && acconto) inputAcconto().value = toAmount(acconto).toFixed(2);
  if (inputNote() && note) inputNote().value = note;
  syncAmountFromTripSelection();
  updatePaymentFields('acconto');
}

async function handleCheckinBookingOpen() {
  const params = new URLSearchParams(window.location.search);
  const bookingId = params.get('booking') || '';
  if (!hasIdentifier(bookingId)) return;
  const booking = extractData(await bookingService.getById(bookingId), null);
  if (!booking) throw new Error('Prenotazione richiesta non trovata.');
  await openModalForEdit(booking);
}

async function init() {
  const settingsResponse = await loadImpostazioni();
  if (settingsResponse.success !== false) {
    COMPANY_INFO = buildCompanyInfo(settingsResponse.data);
  }
  bindUiEvents();
  unsubscribeBookings = bookingService.subscribe(() => {
    refreshCaches().then(() => render()).catch((error) => showMessage(error.message || 'Errore sync prenotazioni', 'error'));
  });
  unsubscribeTrips = tripService.subscribe(() => {
    refreshCaches().then(() => render()).catch((error) => showMessage(error.message || 'Errore sync viaggi', 'error'));
  });
  unsubscribeClients = clientService.subscribe(() => {
    refreshCaches().then(() => render()).catch((error) => showMessage(error.message || 'Errore sync clienti', 'error'));
  });
  await refreshCaches();
  await render();
  await handlePrenotaPrefill();
  await handleCheckinBookingOpen();
}

window.addEventListener('beforeunload', () => {
  if (typeof unsubscribeBookings === 'function') unsubscribeBookings();
  if (typeof unsubscribeTrips === 'function') unsubscribeTrips();
  if (typeof unsubscribeClients === 'function') unsubscribeClients();
});

init().catch((error) => {
  console.error('Init prenotazioni error', error);
  showMessage(error.message || 'Errore inizializzazione prenotazioni', 'error');
});
