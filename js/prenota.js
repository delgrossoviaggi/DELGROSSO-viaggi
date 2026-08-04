import {
  aggiornaDisponibilita,
  creaPrenotazione,
  getPrenotazioniByViaggio,
  getViaggio,
  isViaggioPubblicato
} from "./api-gestionale.js";

const PHONE_REGEX = /^[+0-9()\s-]{7,20}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const POSTER_FALLBACK = "https://via.placeholder.com/1400x900/0f172a/ffffff?text=Del+Grosso+Viaggi";

const state = {
  tripId: null,
  trip: null,
  occupiedSeats: new Set(),
  selectedSeats: [],
  submitting: false
};

const ui = {
  loadingState: document.getElementById("loading-state"),
  errorState: document.getElementById("error-state"),
  notFoundState: document.getElementById("not-found-state"),
  contentState: document.getElementById("booking-content"),
  successModal: document.getElementById("success-modal"),
  errorTitle: document.getElementById("error-title"),
  errorDesc: document.getElementById("error-desc"),
  retryBtn: document.getElementById("retry-btn"),
  viaggioImg: document.getElementById("viaggio-img"),
  viaggioCat: document.getElementById("viaggio-cat"),
  viaggioTitolo: document.getElementById("viaggio-titolo"),
  viaggioDesc: document.getElementById("viaggio-desc"),
  viaggioData: document.getElementById("viaggio-data"),
  viaggioPrezzo: document.getElementById("viaggio-prezzo"),
  seatmap: document.getElementById("seatmap-container"),
  form: document.getElementById("prenotazione-form"),
  inputNome: document.getElementById("nome"),
  inputCognome: document.getElementById("cognome"),
  inputEmail: document.getElementById("email"),
  inputTelefono: document.getElementById("telefono"),
  inputNote: document.getElementById("note"),
  inputSeats: document.getElementById("posti-selezionati-input"),
  totalPrice: document.getElementById("totale-prezzo"),
  submitBtn: document.getElementById("submit-btn")
};

function toDate(value) {
  const date = new Date(`${String(value || "").slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = toDate(value);
  if (!date) return "Data non disponibile";
  return date.toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
}

function formatCurrency(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "€ 0,00";
  return amount.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

function parseTripId() {
  const raw = new URLSearchParams(window.location.search).get("id");
  return raw ? String(raw).trim() : null;
}

function getAvailableSeats(trip) {
  if (trip.posti_liberi !== null && trip.posti_liberi !== undefined) return Math.max(Number(trip.posti_liberi) || 0, 0);
  const total = Math.max(Number(trip.posti_totali) || 0, 0);
  const occupied = Math.max(Number(trip.posti_occupati) || 0, 0);
  return Math.max(total - occupied, 0);
}

function showState(name) {
  ui.loadingState.classList.toggle("hidden", name !== "loading");
  ui.errorState.classList.toggle("hidden", name !== "error");
  ui.notFoundState.classList.toggle("hidden", name !== "notfound");
  ui.contentState.classList.toggle("hidden", name !== "content");
}

function setError(title, description) {
  ui.errorTitle.textContent = title;
  ui.errorDesc.textContent = description;
  showState("error");
}

function parseSeatsFromBookings(bookings) {
  const occupied = new Set();
  (bookings || []).forEach((booking) => {
    const seats = booking?.posti_selezionati;
    const parsed = Array.isArray(seats) ? seats : (() => {
      if (typeof seats !== "string") return [];
      try {
        const value = JSON.parse(seats);
        return Array.isArray(value) ? value : [];
      } catch (_error) {
        return [];
      }
    })();
    parsed.forEach((seat) => occupied.add(String(seat)));
  });
  return occupied;
}

function fallbackOccupiedFromCounters(trip) {
  const occupiedCount = Math.max(Number(trip?.posti_occupati) || 0, 0);
  const seats = new Set();
  for (let index = 1; index <= occupiedCount; index += 1) {
    seats.add(String(index));
  }
  return seats;
}

function renderTrip() {
  const trip = state.trip;
  const image = String(trip.locandina || trip.immagine || POSTER_FALLBACK).trim() || POSTER_FALLBACK;
  ui.viaggioImg.style.backgroundImage = `url("${image}")`;
  ui.viaggioTitolo.textContent = trip.titolo || "Viaggio Del Grosso";
  ui.viaggioDesc.textContent = trip.descrizione || "Descrizione non disponibile.";
  ui.viaggioData.textContent = formatDate(trip.data_partenza);
  ui.viaggioPrezzo.textContent = formatCurrency(trip.prezzo);
  ui.viaggioCat.textContent = trip.destinazione || "Destinazione";
}

function updateSummary() {
  const count = state.selectedSeats.length;
  ui.inputSeats.value = count ? state.selectedSeats.join(", ") : "";
  const total = count * (Number(state.trip?.prezzo) || 0);
  ui.totalPrice.textContent = formatCurrency(total);
}

function buildSeatButton(number, occupied) {
  const classes = occupied
    ? "seat-occupied"
    : state.selectedSeats.includes(number)
      ? "seat-selected"
      : "bg-emerald-100 text-emerald-700 border border-emerald-300 hover:shadow-md";
  const disabled = occupied ? "disabled" : "";
  return `<button type="button" class="posto ${classes}" data-seat="${number}" ${disabled}>${number}</button>`;
}

function renderSeatMap() {
  const totalSeats = Math.max(Number(state.trip.posti_totali) || 0, 0);
  const freeSeats = getAvailableSeats(state.trip);
  if (freeSeats <= 0 || totalSeats <= 0) {
    ui.seatmap.innerHTML = '<div class="w-full text-center py-4 text-sm font-semibold text-red-600">SOLD OUT</div>';
    ui.submitBtn.disabled = true;
    return;
  }

  const rows = [];
  const seatsPerRow = 4;
  for (let i = 1; i <= totalSeats; i += seatsPerRow) {
    const chunk = [];
    for (let j = i; j < i + seatsPerRow && j <= totalSeats; j += 1) {
      const label = String(j);
      chunk.push(buildSeatButton(label, state.occupiedSeats.has(label)));
    }
    rows.push(`<div class="flex justify-center gap-2">${chunk.join("")}</div>`);
  }
  ui.seatmap.innerHTML = rows.join("");
}

function toggleSeat(seat) {
  if (state.occupiedSeats.has(seat)) return;
  const freeSeats = getAvailableSeats(state.trip);
  const isSelected = state.selectedSeats.includes(seat);
  if (isSelected) {
    state.selectedSeats = state.selectedSeats.filter((item) => item !== seat);
  } else if (state.selectedSeats.length < freeSeats) {
    state.selectedSeats = [...state.selectedSeats, seat].sort((a, b) => Number(a) - Number(b));
  }
  renderSeatMap();
  updateSummary();
}

function validateForm() {
  const nome = String(ui.inputNome.value || "").trim();
  const cognome = String(ui.inputCognome.value || "").trim();
  const email = String(ui.inputEmail.value || "").trim();
  const telefono = String(ui.inputTelefono.value || "").trim();
  const freeSeats = getAvailableSeats(state.trip);

  if (!nome || !cognome) return "Inserisci nome e cognome.";
  if (!EMAIL_REGEX.test(email)) return "Email non valida.";
  if (!PHONE_REGEX.test(telefono)) return "Telefono non valido.";
  if (!state.selectedSeats.length) return "Seleziona almeno un posto.";
  if (state.selectedSeats.length > freeSeats) return "Posti disponibili insufficienti.";
  return "";
}

function setSubmitting(value) {
  state.submitting = value;
  ui.submitBtn.disabled = value;
  ui.submitBtn.textContent = value ? "Invio in corso..." : "Conferma Prenotazione";
}

async function submitBooking(event) {
  event.preventDefault();
  if (state.submitting) return;

  const validationError = validateForm();
  if (validationError) {
    alert(validationError);
    return;
  }

  const result = await getViaggio(state.tripId);
  if (!result.success) {
    alert("Impossibile verificare la disponibilita. Riprova.");
    return;
  }
  const viaggio = result.data;
  if (!viaggio) {
    alert("Viaggio non trovato o non disponibile.");
    return;
  }
  state.trip = viaggio;
  const freeSeats = getAvailableSeats(state.trip);
  if (freeSeats <= 0 || state.selectedSeats.length > freeSeats) {
    alert("Posti non piu disponibili. Aggiorna la pagina.");
    return;
  }

  const fullName = `${String(ui.inputNome.value || "").trim()} ${String(ui.inputCognome.value || "").trim()}`.trim();
  const count = state.selectedSeats.length;
  const total = count * (Number(state.trip.prezzo) || 0);

  setSubmitting(true);
  try {
    const seatUpdate = await aggiornaDisponibilita(state.tripId, count);
    if (!seatUpdate.success) throw seatUpdate.error;

    const bookingPayload = {
      viaggio_id: state.tripId,
      cliente: fullName,
      telefono: String(ui.inputTelefono.value || "").trim(),
      email: String(ui.inputEmail.value || "").trim(),
      posti: count,
      posti_selezionati: state.selectedSeats,
      totale: total,
      stato: "In Attesa",
      note: String(ui.inputNote?.value || "").trim()
    };

    const created = await creaPrenotazione(bookingPayload);
    if (!created.success) {
      await aggiornaDisponibilita(state.tripId, -count);
      throw created.error;
    }

    ui.successModal.classList.remove("hidden");
    window.setTimeout(() => {
      window.location.href = "viaggi.html";
    }, 1600);
  } catch (error) {
    alert(error?.message || "Errore durante la prenotazione.");
  } finally {
    setSubmitting(false);
  }
}

async function init() {
  state.tripId = parseTripId();
  if (!state.tripId) {
    showState("notfound");
    return;
  }

  showState("loading");
  const [tripResponse, bookingsResponse] = await Promise.all([
    getViaggio(state.tripId),
    getPrenotazioniByViaggio(state.tripId)
  ]);

  if (!tripResponse.success) {
    setError("Errore di connessione", tripResponse.error?.message || "Impossibile caricare i dettagli del viaggio.");
    return;
  }
  if (!tripResponse.data) {
    showState("notfound");
    return;
  }
  if (!isViaggioPubblicato(tripResponse.data.pubblicato)) {
    showState("notfound");
    return;
  }

  state.trip = tripResponse.data;
  if (getAvailableSeats(state.trip) <= 0) {
    state.occupiedSeats = new Set(Array.from({ length: Math.max(Number(state.trip.posti_totali) || 0, 0) }, (_, i) => String(i + 1)));
  } else {
    const occupiedByBookings = bookingsResponse.success ? parseSeatsFromBookings(bookingsResponse.data) : new Set();
    state.occupiedSeats = occupiedByBookings.size ? occupiedByBookings : fallbackOccupiedFromCounters(state.trip);
  }

  renderTrip();
  renderSeatMap();
  updateSummary();
  showState("content");
}

function bindEvents() {
  ui.retryBtn?.addEventListener("click", () => init());
  ui.form?.addEventListener("submit", submitBooking);
  ui.seatmap?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-seat]");
    if (!button) return;
    toggleSeat(String(button.dataset.seat));
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  init();
});
