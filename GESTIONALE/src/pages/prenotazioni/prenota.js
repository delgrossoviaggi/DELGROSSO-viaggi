/**
 * Modulo Prenotazione Rapida con Pianta Posti e Ricevuta PDF
 * Integra seatMapService, pdfReceiptService, Supabase
 */

import { tripService } from '../../services/tripService.js';
import { fleetService } from '../../services/fleetService.js';
import { bookingService } from '../../services/bookingService.js';
import { extractOccupiedSeats } from '../../services/seatAssignmentService.js';
import { generateSeatLayout, normalizeBusModel, renderSeatMapHTML } from '../../services/seatMapService.js';
import { generateBookingReceipt, downloadReceipt, openReceiptInNewWindow } from '../../services/pdfReceiptService.js';
import { openWhatsAppDispatch, prepareWhatsAppDispatch } from '../../services/whatsAppService.js';
import { showMessage, showConfirm } from '../../components/messageSystem.js';
import { buildCompanyInfo, getCachedSettingsSync, loadImpostazioni } from '../../services/settingsService.js';
import { ADMIN_ROUTES } from '../../utils/appRoutes.js';

const state = {
  trips: [],
  fleet: [],
  selectedTrip: null,
  selectedBus: null,
  selectedSeats: [],
  seatMapContainer: null,
  currentModel: 'GT53',
  occupiedSeats: []
};

let companyInfo = buildCompanyInfo(getCachedSettingsSync());

const els = {
  form: {
    cliente: document.getElementById('cliente'),
    telefono: document.getElementById('telefono'),
    email: document.getElementById('email'),
    viaggioId: document.getElementById('viaggioId'),
    importo: document.getElementById('importo'),
    acconto: document.getElementById('acconto'),
    note: document.getElementById('note')
  },
  summary: {
    posti: document.getElementById('postiDisplay'),
    importo: document.getElementById('importoDisplay')
  },
  actions: {
    submit: document.getElementById('submitPrenota'),
    goTrips: document.getElementById('goTrips'),
    goBookings: document.getElementById('goBookings')
  },
  seatMapContainer: null
};

/**
 * Carica lista viaggi e popola select
 */
async function loadTrips() {
  try {
    const result = await tripService.all();
    if (!result.success) throw new Error(result.error?.message || 'Impossibile caricare i viaggi');

    state.trips = Array.isArray(result.data) ? result.data : [];
    const select = els.form.viaggioId;
    select.innerHTML = '<option value="">-- Seleziona viaggio --</option>';

    for (const trip of state.trips) {
      const option = document.createElement('option');
      option.value = trip.id;
      option.textContent = `${trip.destinazione || ''} (${trip.data_partenza || ''}) - ${getBusLabel(trip.autobus_id || trip.mezzo_id || trip.autobus)}`;
      select.appendChild(option);
    }
  } catch (error) {
    showMessage('Errore caricamento viaggi', 'error');
    console.error('Load trips error:', error);
  }
}

async function loadFleet() {
  const result = await fleetService.getAll();
  if (!result.success) throw new Error(result.error?.message || 'Impossibile caricare la flotta');
  state.fleet = Array.isArray(result.data) ? result.data : [];
}

function getBusLabel(busRef) {
  const normalized = String(busRef || '').trim();
  if (!normalized) return 'N/A';
  const bus = state.fleet.find((item) => {
    return String(item.id) === normalized
      || String(item.targa || '').toUpperCase() === normalized.toUpperCase();
  });
  if (!bus) return normalized;
  return `${bus.targa || ''} - ${bus.marca || ''} ${bus.modello || ''}`.trim();
}

function getBusByTrip(trip) {
  if (!trip) return null;
  const busId = String(trip.autobus_id || trip.mezzo_id || '').trim();
  if (busId) {
    const byId = state.fleet.find((item) => String(item.id) === busId);
    if (byId) return byId;
  }

  const busLabel = String(trip.autobus || '').trim();
  if (!busLabel) return null;
  const upper = busLabel.toUpperCase();
  return state.fleet.find((item) => {
    const text = `${item.targa || ''} ${item.marca || ''} ${item.modello || ''}`.toUpperCase();
    return text.includes(upper) || upper.includes(String(item.targa || '').toUpperCase());
  }) || null;
}

/**
 * Quando viene selezionato un viaggio, carica la pianta
 */
async function onTripSelected(tripId) {
  if (!tripId) {
    state.selectedTrip = null;
    state.selectedBus = null;
    state.selectedSeats = [];
    state.occupiedSeats = [];
    if (state.seatMapContainer) {
      state.seatMapContainer.innerHTML = '';
    }
    return;
  }

  try {
    const result = await tripService.find(tripId);
    if (!result.success) throw new Error(result.error?.message || 'Viaggio non trovato');

    state.selectedTrip = result.data;
    state.selectedBus = getBusByTrip(state.selectedTrip);
    state.currentModel = normalizeBusModel(state.selectedBus);
    if (!state.selectedBus) {
      throw new Error('Autobus assegnato non trovato in flotta');
    }

    // Carica prenotazioni per il viaggio per determinare i posti occupati
    const bookingsResult = await bookingService.all();
    if (bookingsResult.success) {
      state.occupiedSeats = extractOccupiedSeats(bookingsResult.data || [], { tripId });
    }

    // Genera e visualizza la pianta
    const noteEl = els.form.note;
    if (noteEl && noteEl.parentNode) {
      const container = document.createElement('div');
      container.id = 'seatMapContainer';
      container.style.marginTop = '20px';
      noteEl.parentNode.insertBefore(container, noteEl.nextSibling);
      els.seatMapContainer = container;
      state.seatMapContainer = container;
    }
    renderSeatMap();

    // Aggiorna riepilogo prezzi
    syncPriceSummary();
  } catch (error) {
    showMessage('Errore caricamento viaggio', 'error');
    console.error('Trip selection error:', error);
  }
}

/**
 * Renderizza la pianta dei posti
 */
function renderSeatMap() {
  

  const seatLayout = generateSeatLayout(state.selectedBus, state.occupiedSeats);
  const html = renderSeatMapHTML(seatLayout);
  els.seatMapContainer.innerHTML = html;

  // Setup event listeners per i posti
  const seats = els.seatMapContainer.querySelectorAll('.seat.available:not(:disabled)');
  seats.forEach(seat => {
    seat.addEventListener('click', () => onSeatClick(seat));
  });

  // Restore previous selection
  for (const seatId of state.selectedSeats) {
    const seatEl = els.seatMapContainer.querySelector(`[data-seat="${seatId}"]`);
    if (seatEl && !seatEl.disabled) {
      seatEl.classList.add('selected');
    }
  }
}

function syncPriceSummary() {
  const seatCount = state.selectedSeats.length;
  const unitPrice = Number(state.selectedTrip?.prezzo || 0);
  const total = unitPrice * seatCount;

  if (els.form.importo) els.form.importo.value = total.toFixed(2);
  if (els.summary.posti) els.summary.posti.textContent = String(seatCount);
  if (els.summary.importo) els.summary.importo.textContent = `€ ${total.toFixed(2)}`;
}

/**
 * Click su un posto
 */
function onSeatClick(seatEl) {
  const seatId = seatEl.dataset.seat;
  const isSelected = seatEl.classList.contains('selected');

  if (isSelected) {
    seatEl.classList.remove('selected');
    state.selectedSeats = state.selectedSeats.filter(s => s !== seatId);
  } else {
    seatEl.classList.add('selected');
    state.selectedSeats.push(seatId);
  }

  syncPriceSummary();
}

/**
 * Valida il form
 */
function validateForm() {
  const errors = [];

  if (!els.form.cliente.value.trim()) {
    errors.push('Inserisci il nome del cliente');
  }
  if (!els.form.telefono.value.trim()) {
    errors.push('Inserisci il telefono');
  }
  if (!els.form.email.value.trim()) {
    errors.push('Inserisci l\'email');
  }
  if (!els.form.viaggioId.value) {
    errors.push('Seleziona un viaggio');
  }
  if (state.selectedSeats.length === 0) {
    errors.push('Seleziona almeno un posto dalla pianta');
  }
  if (!els.form.importo.value || Number(els.form.importo.value) <= 0) {
    errors.push('Importo non valido');
  }

  if (errors.length > 0) {
    showMessage(errors.join('\n'), 'error');
    return false;
  }

  return true;
}

/**
 * Crea la prenotazione
 */
async function createBooking() {
  if (!validateForm()) return;

  try {
    const payload = {
      viaggio_id: els.form.viaggioId.value,
      cliente: els.form.cliente.value.trim(),
      telefono: els.form.telefono.value.trim(),
      email: els.form.email.value.trim(),
      posti: state.selectedSeats.length,
      posti_selezionati: state.selectedSeats.join(','),
      totale: Number(els.form.importo.value),
      acconto: Number(els.form.acconto.value || 0),
      note: els.form.note.value.trim(),
      stato: 'In Attesa'
    };

    const result = await bookingService.create(payload);
    if (!result.success) throw new Error(result.error?.message || 'Errore creazione prenotazione');

    const booking = result.data;

    // Genera ricevuta PDF
    const pdfBlob = await generateBookingReceipt(booking, state.selectedTrip, companyInfo);

    try {
      openWhatsAppDispatch(prepareWhatsAppDispatch({
        booking,
        trip: state.selectedTrip,
        recipientPhone: payload.telefono,
        template: 'booking-confirmation',
        messageTemplate: companyInfo.whatsappTemplateCustomer
      }));
    } catch (whatsAppError) {
      console.error('Apertura WhatsApp cliente non riuscita:', whatsAppError);
    }

    // Opzioni: download o visualizza
    showConfirm(
      'Prenotazione creata con successo!',
      'Vuoi scaricare la ricevuta o visualizzarla?',
      [
        {
          label: 'Scarica PDF',
          callback: () => downloadReceipt(pdfBlob, booking.id)
        },
        {
          label: 'Visualizza',
          callback: () => openReceiptInNewWindow(pdfBlob)
        }
      ]
    );

    // Redirect a prenotazioni dopo un delay
    setTimeout(() => {
      window.location.href = ADMIN_ROUTES.prenotazioni;
    }, 1500);
  } catch (error) {
    showMessage(`Errore: ${error.message}`, 'error');
    console.error('Booking creation error:', error);
  }
}

/**
 * Initializerr
 */
async function init() {
  try {
    const settingsResponse = await loadImpostazioni();
    if (settingsResponse.success !== false) {
      companyInfo = buildCompanyInfo(settingsResponse.data);
    }
    // Setup event listeners
    els.actions.submit.addEventListener('click', createBooking);
    els.actions.goTrips.addEventListener('click', () => {
      window.location.href = ADMIN_ROUTES.viaggi;
    });
    els.actions.goBookings.addEventListener('click', () => {
      window.location.href = ADMIN_ROUTES.prenotazioni;
    });

    // Setup change listener for viaggio select
    els.form.viaggioId.addEventListener('change', (e) => {
      onTripSelected(e.target.value);
    });

    await loadFleet();

    // Carica viaggi
    await loadTrips();

    showMessage('Modulo prenotazione caricato', 'success');
  } catch (error) {
    showMessage('Errore inizializzazione', 'error');
    console.error('Init error:', error);
  }
}

// Auto-start
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
