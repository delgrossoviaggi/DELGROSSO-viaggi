import {
  formatCurrency,
  formatTime
} from '../../../js/delgrosso-api.js';
import {
  aggiornaOccupazioneViaggio,
  creaPrenotazione,
  getFlottaPubblica,
  getPrenotazioniViaggio,
  getViaggioPubblico
} from '../bridge.js';
import {
  generateSeatLayout,
  renderSeatMapHTML,
  validateSeatSelection
} from '../../services/seatMapService.js';
import { extractOccupiedSeats } from '../../services/seatAssignmentService.js';
import {
  downloadReceipt,
  generateBookingReceipt
} from '../../services/pdfReceiptService.js';
import {
  openWhatsAppDispatch,
  prepareWhatsAppDispatch
} from '../../services/whatsAppService.js';
import { applyRuntimeSettings, buildCompanyInfo, getCachedSettingsSync, loadImpostazioni } from '../../services/settingsService.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+0-9()\s-]{7,20}$/;
const DEFAULT_SUCCESS_MESSAGE = 'La tua prenotazione è stata registrata con successo. La ricevuta PDF è stata scaricata automaticamente.';
const PDF_WARNING_MESSAGE = 'La prenotazione è stata salvata, ma non è stato possibile generare automaticamente la ricevuta PDF.';
let COMPANY_INFO = buildCompanyInfo(getCachedSettingsSync());
applyRuntimeSettings(getCachedSettingsSync());

const ui = {
  loadingState: document.getElementById('loading-state'),
  errorState: document.getElementById('error-state'),
  bookingContent: document.getElementById('booking-content'),
  tripImage: document.getElementById('trip-image'),
  tripTitle: document.getElementById('trip-title'),
  tripDate: document.getElementById('trip-date'),
  tripTime: document.getElementById('trip-time'),
  tripPrice: document.getElementById('trip-price'),
  seatsAvailable: document.getElementById('seats-available'),
  busModel: document.getElementById('bus-model'),
  busSeats: document.getElementById('bus-seats'),
  summarySeats: document.getElementById('summary-seats'),
  summaryPrice: document.getElementById('summary-price'),
  summaryTotal: document.getElementById('summary-total'),
  continueButton: document.getElementById('continue-btn'),
  seatmapContainer: document.getElementById('seatmap-container'),
  passengerFormSection: document.getElementById('passenger-form-section'),
  passengerForm: document.getElementById('passenger-form'),
  passengerName: document.getElementById('passenger-name'),
  passengerSurname: document.getElementById('passenger-surname'),
  passengerPhone: document.getElementById('passenger-phone'),
  passengerEmail: document.getElementById('passenger-email'),
  passengerNotes: document.getElementById('passenger-notes'),
  privacyCheckbox: document.getElementById('privacy-checkbox'),
  backButton: document.getElementById('back-btn'),
  confirmButton: document.getElementById('confirm-btn'),
  successState: document.getElementById('success-state'),
  successMessage: document.getElementById('success-message'),
  successWhatsappLink: document.getElementById('success-whatsapp-link'),
  feedback: document.getElementById('booking-feedback'),
  progressFill: document.querySelector('.w-full.h-1 > div'),
  progressSteps: Array.from(document.querySelectorAll('.progress-step')),
  errorText: document.querySelector('#error-state p')
};

const state = {
  tripId: '',
  tripCode: '',
  trip: null,
  fleet: [],
  selectedBus: null,
  occupiedSeats: [],
  selectedSeats: [],
  currentStep: 1,
  submitting: false
};

function normalizeText(value) {
  return String(value ?? '').trim();
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function parseTripId() {
  const params = new URLSearchParams(window.location.search);
  return {
    viaggioId: normalizeText(params.get('viaggio') || params.get('id')),
    codice: normalizeText(params.get('codice'))
  };
}

function formatVerboseDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return normalizeText(value) || '—';
  return date.toLocaleDateString('it-IT', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function getBusByTrip(trip) {
  if (!trip) return null;

  const directIds = [
    normalizeText(trip.autobus_id),
    normalizeText(trip.mezzo_id)
  ].filter(Boolean);

  for (const id of directIds) {
    const busById = state.fleet.find((item) => String(item?.id) === id);
    if (busById) return busById;
  }

  const references = [
    normalizeText(trip.autobus),
    normalizeText(trip.mezzo)
  ].filter(Boolean);

  for (const reference of references) {
    const upperReference = reference.toUpperCase();
    const match = state.fleet.find((item) => {
      const label = `${item?.targa || ''} ${item?.marca || ''} ${item?.modello || ''}`.toUpperCase();
      return label.includes(upperReference) || upperReference.includes(String(item?.targa || '').toUpperCase());
    });
    if (match) return match;
  }

  return null;
}

function getBusDisplayName() {
  if (state.selectedBus) {
    return `${state.selectedBus.targa || ''} - ${state.selectedBus.marca || ''} ${state.selectedBus.modello || ''}`.trim();
  }
  return normalizeText(state.trip?.autobus || state.trip?.mezzo) || '—';
}

function getSeatLayoutSource() {
  return state.selectedBus?.seat_layout
    || state.trip?.seat_layout
    || state.selectedBus
    || state.trip?.autobus
    || state.trip?.mezzo
    || 'GT53';
}

function getSeatLayoutData() {
  return generateSeatLayout(getSeatLayoutSource(), state.occupiedSeats);
}

function getAvailableSeatsCount() {
  return getSeatLayoutData().availableCount;
}

function setFeedback(message = '', tone = 'error') {
  if (!ui.feedback) return;

  ui.feedback.className = 'form-feedback hidden';
  ui.feedback.textContent = '';

  if (!message) return;

  ui.feedback.textContent = message;
  ui.feedback.classList.remove('hidden');
  ui.feedback.classList.add(tone === 'success' ? 'form-feedback--success' : 'form-feedback--error');
}

function setErrorState(message) {
  if (ui.errorText) ui.errorText.textContent = message;
  ui.loadingState.classList.add('hidden');
  ui.bookingContent.classList.add('hidden');
  ui.passengerFormSection.classList.add('hidden');
  ui.successState.classList.add('hidden');
  ui.errorState.classList.remove('hidden');
}

function updateProgress() {
  const percentage = Math.max(1, Math.min(state.currentStep, 3)) / 3 * 100;
  if (ui.progressFill) ui.progressFill.style.width = `${percentage}%`;
  ui.progressSteps.forEach((step) => {
    const stepNumber = Number(step.dataset.step || 0);
    step.classList.toggle('active', stepNumber === state.currentStep);
  });
}

function showStep(step) {
  state.currentStep = step;
  ui.loadingState.classList.add('hidden');
  ui.errorState.classList.add('hidden');
  ui.bookingContent.classList.toggle('hidden', step !== 1);
  ui.passengerFormSection.classList.toggle('hidden', step !== 2);
  ui.successState.classList.toggle('hidden', step !== 3);
  updateProgress();
}

function renderTripInfo() {
  const trip = state.trip || {};
  const totalSeats = toNumber(state.selectedBus?.posti, toNumber(trip.posti_totali, 0));
  const availableSeats = getAvailableSeatsCount();
  const title = normalizeText(trip.titolo) || `${normalizeText(trip.partenza)} → ${normalizeText(trip.destinazione)}`.trim() || 'Viaggio Del Grosso';

  ui.tripTitle.textContent = title;
  ui.tripDate.textContent = formatVerboseDate(trip.data_partenza);
  ui.tripTime.textContent = formatTime(trip.ora_partenza) || '—';
  ui.tripPrice.textContent = formatCurrency(trip.prezzo);
  ui.seatsAvailable.textContent = `${availableSeats} / ${totalSeats || '—'}`;
  ui.busModel.textContent = getBusDisplayName();
  ui.busSeats.textContent = totalSeats || '—';

  const poster = normalizeText(trip.locandina || trip.immagine);
  if (poster) {
    ui.tripImage.style.backgroundImage = `url('${poster}')`;
    ui.tripImage.innerHTML = '';
  } else {
    ui.tripImage.style.backgroundImage = '';
    ui.tripImage.innerHTML = '<i class="fas fa-bus"></i>';
  }

  document.title = `${title} | Del Grosso Booking`;
}

function syncSelectedSeatClasses() {
  const selected = new Set(state.selectedSeats);
  ui.seatmapContainer.querySelectorAll('.seat[data-seat]').forEach((button) => {
    if (button.disabled || button.classList.contains('occupied')) return;
    const isSelected = selected.has(button.dataset.seat);
    button.classList.toggle('selected', isSelected);
    button.classList.toggle('available', !isSelected);
  });
}

function updateSummary() {
  const selectedSeats = [...state.selectedSeats].sort((left, right) => Number(left) - Number(right));
  const selectedLabels = selectedSeats.map((seat) => String(seat).padStart(2, '0'));
  const total = selectedSeats.length * toNumber(state.trip?.prezzo, 0);

  ui.summarySeats.textContent = selectedLabels.length ? selectedLabels.join(', ') : 'Nessuno';
  ui.summaryPrice.textContent = formatCurrency(state.trip?.prezzo || 0);
  ui.summaryTotal.textContent = formatCurrency(total);
  ui.continueButton.disabled = selectedSeats.length === 0;
}

function renderSeatMap() {
  const seatLayout = getSeatLayoutData();
  ui.seatmapContainer.innerHTML = renderSeatMapHTML(seatLayout);
  syncSelectedSeatClasses();
  updateSummary();
}

function toggleSeatSelection(seatId) {
  const normalizedSeat = normalizeText(seatId);
  if (!normalizedSeat) return;

  const alreadySelected = state.selectedSeats.includes(normalizedSeat);
  if (alreadySelected) {
    state.selectedSeats = state.selectedSeats.filter((seat) => seat !== normalizedSeat);
  } else {
    state.selectedSeats = [...state.selectedSeats, normalizedSeat].sort((left, right) => Number(left) - Number(right));
  }

  syncSelectedSeatClasses();
  updateSummary();
}

function validateForm() {
  const name = normalizeText(ui.passengerName.value);
  const surname = normalizeText(ui.passengerSurname.value);
  const phone = normalizeText(ui.passengerPhone.value);
  const email = normalizeText(ui.passengerEmail.value);

  if (!name) return 'Inserisci il nome.';
  if (!surname) return 'Inserisci il cognome.';
  if (!PHONE_REGEX.test(phone)) return 'Inserisci un numero di telefono valido.';
  if (!EMAIL_REGEX.test(email)) return 'Inserisci un indirizzo email valido.';
  if (!ui.privacyCheckbox.checked) return 'Devi accettare la privacy policy per proseguire.';
  if (state.selectedSeats.length === 0) return 'Seleziona almeno un posto dalla piantina.';

  const validation = validateSeatSelection(getSeatLayoutSource(), state.selectedSeats, state.occupiedSeats);
  if (!validation.valid) return validation.errors[0] || 'Selezione posti non valida.';

  return '';
}

function setSubmitting(isSubmitting) {
  state.submitting = isSubmitting;
  ui.confirmButton.disabled = isSubmitting;
  ui.backButton.disabled = isSubmitting;
  ui.confirmButton.innerHTML = isSubmitting
    ? '<i class="fas fa-spinner fa-spin"></i> Elaborazione…'
    : '<i class="fas fa-check"></i> Conferma Prenotazione';
}

async function refreshTripSnapshot() {
  const [tripResult, bookingsResult] = await Promise.all([
    getViaggioPubblico({ viaggioId: state.tripId, codice: state.tripCode }),
    getPrenotazioniViaggio(state.tripId)
  ]);

  if (tripResult.success === false) throw tripResult.error;
  if (bookingsResult.success === false) throw bookingsResult.error;

  state.trip = tripResult.data || null;
  if (!state.trip || state.trip.pubblicato !== 'SI') {
    throw new Error('Il viaggio selezionato non è più disponibile.');
  }

  state.occupiedSeats = extractOccupiedSeats(bookingsResult.data || []);
  state.selectedBus = getBusByTrip(state.trip);
}

async function createPublicBooking() {
  const seatCount = state.selectedSeats.length;
  const total = seatCount * toNumber(state.trip?.prezzo, 0);
  const fullName = `${normalizeText(ui.passengerName.value)} ${normalizeText(ui.passengerSurname.value)}`.trim();
  let occupancyUpdated = false;

  try {
    await refreshTripSnapshot();

    const seatValidation = validateSeatSelection(getSeatLayoutSource(), state.selectedSeats, state.occupiedSeats);
    if (!seatValidation.valid) {
      renderTripInfo();
      renderSeatMap();
      showStep(1);
      throw new Error(seatValidation.errors[0] || 'I posti selezionati non sono più disponibili.');
    }

    const tripUpdate = await aggiornaOccupazioneViaggio(state.trip.id, seatCount);
    if (tripUpdate.success === false) throw tripUpdate.error;
    state.trip = tripUpdate.data || state.trip;
    occupancyUpdated = true;

    const bookingResult = await creaPrenotazione({
      viaggio_id: state.trip.id,
      cliente: fullName,
      telefono: normalizeText(ui.passengerPhone.value),
      email: normalizeText(ui.passengerEmail.value),
      posti: seatCount,
      posti_selezionati: state.selectedSeats.join(','),
      totale: total,
      note: normalizeText(ui.passengerNotes.value),
      stato: 'In Attesa'
    });

    if (bookingResult.success === false) throw bookingResult.error;

    return bookingResult.data;
  } catch (error) {
    if (occupancyUpdated) {
      const rollback = await aggiornaOccupazioneViaggio(state.trip.id, -seatCount);
      if (rollback.success === false) {
        console.error('Rollback posti non riuscito', rollback.error);
        throw new Error(`${error.message || 'Errore durante la prenotazione.'} Inoltre non è stato possibile ripristinare automaticamente la disponibilità.`);
      }
      state.trip = rollback.data || state.trip;
    }
    throw error;
  }
}

async function generateReceiptForBooking(booking) {
  const receiptBooking = {
    ...booking,
    nome: normalizeText(ui.passengerName.value, ''),
    cognome: normalizeText(ui.passengerSurname.value, '')
  };
  const pdfBlob = await generateBookingReceipt(receiptBooking, state.trip, COMPANY_INFO);
  downloadReceipt(pdfBlob, booking.id || booking.codice || 'prenotazione');
}

function openPublicWhatsAppConfirmation(booking) {
  const dispatch = prepareWhatsAppDispatch({
    booking: {
      ...booking,
      nome: normalizeText(ui.passengerName.value, ''),
      cognome: normalizeText(ui.passengerSurname.value, '')
    },
    trip: state.trip,
    recipientPhone: COMPANY_INFO.whatsapp,
    template: 'support-booking-notification',
    messageTemplate: COMPANY_INFO.whatsappTemplateSupport
  });

  if (ui.successWhatsappLink) {
    ui.successWhatsappLink.href = dispatch.waMeUrl;
  }

  return openWhatsAppDispatch(dispatch);
}

async function handleSubmit(event) {
  event.preventDefault();
  if (state.submitting) return;

  setFeedback('');
  const validationError = validateForm();
  if (validationError) {
    setFeedback(validationError, 'error');
    return;
  }

  setSubmitting(true);

  try {
    const booking = await createPublicBooking();
    let successMessage = DEFAULT_SUCCESS_MESSAGE;
    let feedbackTone = 'success';

    try {
      await generateReceiptForBooking(booking);
    } catch (receiptError) {
      console.error('Generazione ricevuta non riuscita', receiptError);
      successMessage = PDF_WARNING_MESSAGE;
      feedbackTone = 'error';
    }

    let whatsappResult = null;
    try {
      whatsappResult = openPublicWhatsAppConfirmation(booking);
      if (!whatsappResult.opened) {
        successMessage = `${successMessage} Se WhatsApp non si apre automaticamente, utilizza il pulsante dedicato qui sotto.`;
      }
    } catch (whatsAppError) {
      console.error('Apertura WhatsApp non riuscita', whatsAppError);
      successMessage = `${successMessage} Non e stato possibile preparare automaticamente il messaggio WhatsApp.`;
    }

    ui.successMessage.textContent = successMessage;
    setFeedback(successMessage, feedbackTone);
    showStep(3);
  } catch (error) {
    console.error('Prenotazione pubblica non riuscita', error);
    setFeedback(error.message || 'Errore durante la prenotazione.', 'error');
    renderTripInfo();
    renderSeatMap();
  } finally {
    setSubmitting(false);
  }
}

async function bootstrap() {
  const tripQuery = parseTripId();
  state.tripId = tripQuery.viaggioId;
  state.tripCode = tripQuery.codice;
  state.trip = null;
  state.selectedBus = null;
  state.occupiedSeats = [];
  state.selectedSeats = [];
  setFeedback('');
  ui.loadingState.classList.remove('hidden');
  ui.errorState.classList.add('hidden');
  ui.bookingContent.classList.add('hidden');
  ui.passengerFormSection.classList.add('hidden');
  ui.successState.classList.add('hidden');
  updateProgress();

  if (!state.tripId && !state.tripCode) {
    setErrorState('Manca l’identificativo del viaggio richiesto.');
    return;
  }

  try {
    const [tripResult, fleetResult] = await Promise.all([
      getViaggioPubblico({ viaggioId: state.tripId, codice: state.tripCode }),
      getFlottaPubblica()
    ]);

    if (tripResult.success === false) throw tripResult.error;
    if (fleetResult.success === false) throw fleetResult.error;

    const trip = tripResult.data || null;
    if (!trip || trip.pubblicato !== 'SI') {
      throw new Error('Il viaggio richiesto non esiste o non è disponibile online.');
    }

    const bookingsResult = await getPrenotazioniViaggio(trip.id);
    if (bookingsResult.success === false) throw bookingsResult.error;

    state.trip = trip;
    state.tripId = normalizeText(trip.id);
    state.fleet = Array.isArray(fleetResult.data) ? fleetResult.data : [];
    state.selectedBus = getBusByTrip(trip);
    state.occupiedSeats = extractOccupiedSeats(bookingsResult.data || []);

    renderTripInfo();
    renderSeatMap();
    showStep(1);
  } catch (error) {
    console.error('Bootstrap prenotazione non riuscito', error);
    setErrorState(error.message || 'Errore inatteso durante il caricamento del viaggio.');
  }
}

function bindEvents() {
  ui.continueButton.addEventListener('click', () => {
    if (state.selectedSeats.length === 0) {
      setFeedback('Seleziona almeno un posto prima di continuare.', 'error');
      return;
    }

    const validation = validateSeatSelection(getSeatLayoutSource(), state.selectedSeats, state.occupiedSeats);
    if (!validation.valid) {
      setFeedback(validation.errors[0] || 'Selezione posti non valida.', 'error');
      renderSeatMap();
      return;
    }

    setFeedback('');
    showStep(2);
  });

  ui.backButton.addEventListener('click', () => {
    setFeedback('');
    showStep(1);
  });

  ui.passengerForm.addEventListener('submit', handleSubmit);

  ui.seatmapContainer.addEventListener('click', (event) => {
    const seatButton = event.target.closest('.seat[data-seat]');
    if (!seatButton || seatButton.disabled) return;
    toggleSeatSelection(seatButton.dataset.seat);
  });
}

async function init() {
  const settingsResponse = await loadImpostazioni();
  if (settingsResponse.success !== false) {
    COMPANY_INFO = buildCompanyInfo(settingsResponse.data);
    applyRuntimeSettings(settingsResponse.data);
  }
  bindEvents();
  bootstrap().catch((error) => {
    console.error('Inizializzazione prenotazione non riuscita', error);
    setErrorState(error.message || 'Impossibile inizializzare la pagina prenotazione.');
  });
}

init().catch((error) => {
  console.error('Caricamento impostazioni prenotazione non riuscito', error);
  setErrorState(error.message || 'Impossibile inizializzare la pagina prenotazione.');
});
