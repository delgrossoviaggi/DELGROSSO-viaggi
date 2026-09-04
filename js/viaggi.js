import {
  calculateAvailableSeats,
  formatDate,
  formatTime
} from './delgrosso-api.js';
import { getViaggiPubblicati, getFlottaPubblica } from './bridge.js';
import { applyRuntimeSettings, loadImpostazioni } from '../services/settingsService.js';
import { buildPublicBookingUrl } from '../utils/appRoutes.js';

const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/1200x700/0f172a/ffffff?text=Del+Grosso+Viaggi';
const REQUEST_TIMEOUT_MS = 15000;
const LAST_SEATS_THRESHOLD = 5;
const HOME_FALLBACK = 'assets/images/logo-sidebar.png';

async function syncHomeVisual() {
  try {
    const result = await getFlottaPubblica();
    const fleet = (result.data || []).filter((item) => item?.attivo !== false);
    const image = fleet.find((item) => String(item?.immagine || '').trim())?.immagine;
    const target = document.querySelector('.hero-visual__image');
    if (!target || !image) return;
    target.innerHTML = `<img src="${escapeHtml(image)}" alt="Autobus DELGROSSO Viaggi" loading="eager" referrerpolicy="no-referrer">`;
  } catch (error) {
    console.warn('Immagine hero Home/Supabase:', error);
  }
}


const ui = {
  searchInput: document.getElementById('searchInput'),
  destinationFilter: document.getElementById('destinationFilter'),
  availabilityFilter: document.getElementById('availabilityFilter'),
  counterLabel: document.getElementById('counterLabel'),
  reloadButton: document.getElementById('reloadButton'),
  retryButton: document.getElementById('retryButton'),
  tripsGrid: document.getElementById('tripsGrid'),
  emptyState: document.getElementById('emptyState'),
  errorState: document.getElementById('errorState'),
  errorMessage: document.getElementById('errorMessage')
};

let trips = [];

function initAnimations() {
  if (typeof window.AOS !== 'undefined') {
    window.AOS.init({ duration: 650, once: true, offset: 40 });
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase();
}

function withTimeout(promise, timeoutMs, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), timeoutMs);
    })
  ]);
}

function getAvailableSeats(trip) {
  return calculateAvailableSeats(trip);
}

function isSoldOut(trip) {
  return getAvailableSeats(trip) <= 0;
}

function isLastSeats(trip) {
  const availableSeats = getAvailableSeats(trip);
  return availableSeats > 0 && availableSeats <= LAST_SEATS_THRESHOLD;
}

function renderLoading() {
  ui.counterLabel.textContent = 'Caricamento viaggi...';
  ui.tripsGrid.classList.remove('hidden');
  ui.emptyState.classList.add('hidden');
  ui.errorState.classList.add('hidden');
  ui.tripsGrid.innerHTML = [
    '<div class="trip-skeleton"></div>',
    '<div class="trip-skeleton"></div>',
    '<div class="trip-skeleton"></div>'
  ].join('');
}

function renderError(message) {
  ui.tripsGrid.classList.add('hidden');
  ui.emptyState.classList.add('hidden');
  ui.errorState.classList.remove('hidden');
  ui.errorMessage.textContent = message;
  ui.counterLabel.textContent = 'Errore durante il caricamento dei viaggi';
}

function renderEmpty() {
  ui.tripsGrid.classList.add('hidden');
  ui.emptyState.classList.remove('hidden');
  ui.errorState.classList.add('hidden');
  ui.counterLabel.textContent = 'Nessun viaggio disponibile';
}

function getAvailabilityBadge(trip) {
  if (isSoldOut(trip)) {
    return '<span class="availability-pill availability-pill--soldout">Sold Out</span>';
  }
  if (isLastSeats(trip)) {
    return '<span class="availability-pill availability-pill--last"><span class="availability-pill__dot"></span>Ultimi posti</span>';
  }
  return '<span class="availability-pill availability-pill--available"><span class="availability-pill__dot"></span>Disponibile</span>';
}

function buildTripCard(trip) {
  const image = escapeHtml(String(trip.locandina || '').trim() || PLACEHOLDER_IMAGE);
  const availableSeats = getAvailableSeats(trip);
  const date = escapeHtml(formatDate(trip.data_partenza) || 'Data da definire');
  const time = escapeHtml(formatTime(trip.ora_partenza) || '—');
  const priceVal = trip.prezzo ? Number(trip.prezzo).toFixed(2) : '0.00';
  const destination = escapeHtml(trip.destinazione || 'Destinazione');
  const title = escapeHtml(trip.titolo || 'Viaggio Del Grosso');
  const bus = escapeHtml(trip.mezzo || 'Bus GT Deluxe');

  return `
    <article class="departure-card" data-aos="fade-up">
      <div class="departure-card__media">
        <img src="${image}" alt="${escapeHtml(trip.titolo || 'Viaggio Del Grosso')}" loading="eager" referrerpolicy="no-referrer" onerror="this.src='${PLACEHOLDER_IMAGE}'">
        <div class="departure-card__badge">${getAvailabilityBadge(trip)}</div>
      </div>
      <div class="departure-card__content">
        <div>
          <p class="departure-card__kicker">${destination}</p>
          <h2 class="departure-card__title">${title}</h2>
        </div>
        <div class="departure-card__meta">
          <div class="departure-chip"><i class="fas fa-calendar-alt"></i>${date}</div>
          <div class="departure-chip"><i class="fas fa-clock"></i>${time}</div>
          <div class="departure-chip"><i class="fas fa-chair"></i>${escapeHtml(String(availableSeats))} posti liberi</div>
          <div class="departure-chip"><i class="fas fa-bus"></i>${bus}</div>
        </div>
        <div class="departure-card__footer">
          <div>
            <span class="departure-price-label">Prezzo a persona</span>
            <span class="departure-price">€ ${priceVal}</span>
          </div>
          ${isSoldOut(trip)
            ? '<button type="button" disabled class="departure-btn departure-btn--disabled"><i class="fas fa-ban"></i> Sold Out</button>'
            : `<a href="${buildPublicBookingUrl({ viaggioId: trip.id, codice: trip.codice })}" class="btn-primary departure-btn"><i class="fas fa-ticket"></i> Prenota</a>`}
        </div>
      </div>
    </article>
  `;
}

function populateDestinationFilter() {
  const destinations = [...new Set(
    trips
      .map((trip) => String(trip.destinazione || '').trim())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, 'it'));

  ui.destinationFilter.innerHTML = [
    '<option value="">Tutte le destinazioni</option>',
    ...destinations.map((destination) => `<option value="${escapeHtml(destination)}">${escapeHtml(destination)}</option>`)
  ].join('');
}

function getFilteredTrips() {
  const searchTerm = normalizeText(ui.searchInput.value);
  const destination = normalizeText(ui.destinationFilter.value);
  const availability = normalizeText(ui.availabilityFilter.value);

  return trips.filter((trip) => {
    const text = [trip.titolo, trip.destinazione].map(normalizeText).join(' ');
    const matchesSearch = !searchTerm || text.includes(searchTerm);
    const matchesDestination = !destination || normalizeText(trip.destinazione) === destination;

    let matchesAvailability = true;
    if (availability === 'disponibile') matchesAvailability = !isSoldOut(trip) && !isLastSeats(trip);
    if (availability === 'ultimi') matchesAvailability = isLastSeats(trip);
    if (availability === 'soldout') matchesAvailability = isSoldOut(trip);

    return matchesSearch && matchesDestination && matchesAvailability;
  });
}

function renderTrips() {
  const filteredTrips = getFilteredTrips();

  if (!filteredTrips.length) {
    renderEmpty();
    return;
  }

  ui.tripsGrid.classList.remove('hidden');
  ui.emptyState.classList.add('hidden');
  ui.errorState.classList.add('hidden');
  ui.counterLabel.textContent = filteredTrips.length === 1 ? '1 viaggio disponibile' : `${filteredTrips.length} viaggi disponibili`;
  ui.tripsGrid.innerHTML = filteredTrips.map(buildTripCard).join('');

  if (typeof window.AOS !== 'undefined') {
    window.AOS.refreshHard();
  }
}

async function loadTrips() {
  renderLoading();
  ui.reloadButton.classList.add('hidden');

  try {
    const response = await withTimeout(
      getViaggiPubblicati(),
      REQUEST_TIMEOUT_MS,
      'Timeout durante il caricamento dei viaggi.'
    );

    if (response?.success === false) throw response.error;
    trips = Array.isArray(response?.data) ? response.data : [];
    populateDestinationFilter();
    renderTrips();
  } catch (error) {
    renderError(error.message || 'Impossibile caricare i viaggi.');
  } finally {
    ui.reloadButton.classList.remove('hidden');
  }
}

function bindEvents() {
  ui.searchInput.addEventListener('input', renderTrips);
  ui.destinationFilter.addEventListener('change', renderTrips);
  ui.availabilityFilter.addEventListener('change', renderTrips);
  ui.retryButton.addEventListener('click', () => {
    loadTrips().catch((error) => renderError(error.message || 'Impossibile caricare i viaggi.'));
  });
  ui.reloadButton.addEventListener('click', () => {
    loadTrips().catch((error) => renderError(error.message || 'Impossibile caricare i viaggi.'));
  });
}

async function init() {
  const settingsResponse = await loadImpostazioni();
  if (settingsResponse.success !== false) {
    applyRuntimeSettings(settingsResponse.data);
  }
  initAnimations();
  syncHomeVisual();
  bindEvents();
  await loadTrips();
}

init().catch((error) => {
  renderError(error.message || 'Impossibile inizializzare la pagina viaggi.');
  ui.reloadButton.classList.remove('hidden');
});
