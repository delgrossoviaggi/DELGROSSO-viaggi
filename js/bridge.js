import { tripService } from '../services/tripService.js';
import { getPrenotazioniPostiViaggio } from './delgrosso-api.js';
import { bookingService } from '../services/bookingService.js';
import { fleetService } from '../services/fleetService.js';
import { quoteService } from '../services/quoteService.js';

export async function getViaggiPubblicati() {
  const result = await tripService.getAll();
  if (result.success === false) return result;
  const published = (result.data || []).filter((trip) => trip.pubblicato === 'SI');
  return { ...result, data: published };
}

export async function getViaggio(id) {
  return tripService.find(id);
}

export async function getViaggioPubblico({ viaggioId, codice } = {}) {
  const normalizedId = String(viaggioId ?? '').trim();
  if (normalizedId) {
    return tripService.find(normalizedId);
  }

  const normalizedCode = String(codice ?? '').trim().toLowerCase();
  if (!normalizedCode) {
    return { success: false, data: null, error: new Error('Identificativo viaggio mancante.') };
  }

  const result = await tripService.getAll();
  if (result.success === false) return result;

  const trip = (result.data || []).find((item) => String(item?.codice ?? '').trim().toLowerCase() === normalizedCode) || null;
  return { ...result, data: trip };
}

export async function creaPrenotazione(data) {
  return bookingService.create(data);
}

export async function getPrenotazioniViaggio(tripId) {
  return getPrenotazioniPostiViaggio(tripId);
}

export async function getFlottaPubblica() {
  return fleetService.getAll();
}

export async function aggiornaOccupazioneViaggio(tripId, delta) {
  return tripService.updateOccupancy(tripId, delta);
}

export async function creaPreventivoPubblico(data) {
  return quoteService.create({
    ...data,
    origine: 'sito',
    stato: 'Nuovo'
  });
}
