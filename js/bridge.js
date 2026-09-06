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

const PUBLIC_SITE_SUPABASE_URL = 'https://exphxbeqwpwrsigdmilc.supabase.co';
const PUBLIC_SITE_SUPABASE_KEY = 'sb_publishable_jEq6R22qxk2SHGI5YEmEow_SfZG7j8c';

export async function getFlottaPubblica() {
  try {
    const endpoint =
      `${PUBLIC_SITE_SUPABASE_URL}/rest/v1/flotta_page` +
      '?select=id,titolo,descrizione,immagine_url,foto_urls,foto_gallery' +
      '&order=created_at.desc';

    const response = await fetch(endpoint, {
      headers: {
        apikey: PUBLIC_SITE_SUPABASE_KEY,
        Authorization: `Bearer ${PUBLIC_SITE_SUPABASE_KEY}`
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Supabase sito flotta_page: HTTP ${response.status}`);
    }

    const rows = await response.json();

    return {
      success: true,
      data: (Array.isArray(rows) ? rows : []).map((row) => ({
        ...row,
        immagine: row.immagine_url || '',
        foto_gallery: Array.isArray(row.foto_gallery)
          ? row.foto_gallery
          : (Array.isArray(row.foto_urls) ? row.foto_urls : [])
      })),
      error: null
    };
  } catch (error) {
    console.error('Flotta pubblica / Supabase sito:', error);
    return {
      success: false,
      data: [],
      error
    };
  }
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
