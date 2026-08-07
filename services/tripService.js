import {
  calculateAvailableSeats,
  createViaggio,
  deleteViaggio,
  getPrenotazioni,
  getSupabase,
  getViaggi,
  getViaggio,
  subscribeTable,
  updateViaggio
} from '../js/delgrosso-api.js';
import { getOptionalEnv } from '../utils/configManager.js';

function result(data, success = true, error = null) {
  return { success, data, error };
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function hasId(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized !== '' && normalized !== 'undefined' && normalized !== 'null';
}

function buildTripCode(row = {}) {
  const explicitCode = String(
    row.codice
    || row.codice_viaggio
    || row.numero_viaggio
    || row.trip_code
    || ''
  ).trim();
  if (explicitCode) return explicitCode;

  const tripDate = new Date(row.data_partenza || row.created_at || Date.now());
  const year = Number.isNaN(tripDate.getTime()) ? new Date().getFullYear() : tripDate.getFullYear();
  const rawId = String(row.id || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const suffix = (rawId || 'TRIP0000').slice(0, 6).padEnd(6, '0');
  return `GDL-${year}-${suffix}`;
}

function mapTrip(row = {}) {
  return {
    ...row,
    codice: buildTripCode(row),
    posti_totali: toNumber(row.posti_totali, 0),
    posti_occupati: toNumber(row.posti_occupati, 0),
    posti_liberi: calculateAvailableSeats(row),
    prezzo: toNumber(row.prezzo, 0),
    pubblicato: row.pubblicato === 'SI' ? 'SI' : 'NO'
  };
}

function sanitizeFileName(name = '') {
  return String(name || 'locandina')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function getStorageConfig() {
  return {
    bucket: String(getOptionalEnv('VITE_SUPABASE_BUCKET_LOCANDINE', 'locandine'))
  };
}

export class TripService {
  async all() {
    const response = await getViaggi();
    if (response.success === false) return response;
    return result((response.data || []).map(mapTrip), true, null);
  }

  async find(id) {
    const response = await getViaggio(id);
    if (response.success === false) return response;
    return result(response.data ? mapTrip(response.data) : null, true, null);
  }

  async create(payload) {
    const response = await createViaggio(payload);
    if (response.success === false) return response;
    return result(mapTrip(response.data), true, null);
  }

  async update(id, payload) {
    const response = await updateViaggio(id, payload);
    if (response.success === false) return response;
    return result(mapTrip(response.data), true, null);
  }

  async remove(id) {
    const dependencies = await this.getDependencies(id);
    if (dependencies.success === false) return dependencies;
    if ((dependencies.data?.prenotazioni || []).length > 0) {
      return result(null, false, new Error('Impossibile eliminare il viaggio: sono presenti prenotazioni associate.'));
    }
    return deleteViaggio(id);
  }

  async delete(id) {
    return this.remove(id);
  }

  async getAll() {
    return this.all();
  }

  async getById(id) {
    return this.find(id);
  }

  async updateOccupancy(id, deltaValue) {
    if (!hasId(id)) return result(null, false, new Error('Identificativo viaggio non valido.'));
    const delta = Number(deltaValue);
    if (!Number.isFinite(delta) || delta === 0) return this.find(id);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const current = await this.find(id);
      if (current.success === false) return current;
      const trip = current.data;
      if (!trip) return result(null, false, new Error('Viaggio non trovato.'));

      const postiTotali = toNumber(trip.posti_totali, 0);
      const occupatiAttuali = toNumber(trip.posti_occupati, 0);
      const nuoviOccupati = Math.max(occupatiAttuali + delta, 0);
      if (nuoviOccupati > postiTotali) {
        return result(null, false, new Error('Posti insufficienti per questo viaggio.'));
      }

      const response = await updateViaggio(id, {
        posti_occupati: nuoviOccupati,
        posti_liberi: Math.max(postiTotali - nuoviOccupati, 0)
      });
      if (response.success) return result(mapTrip(response.data), true, null);
    }

    return result(null, false, new Error('Disponibilita modificata da un altro operatore. Riprova.'));
  }

  async search(term = '') {
    const rows = await this.all();
    if (rows.success === false) return rows;
    const query = String(term || '').trim().toLowerCase();
    if (!query) return rows;
    return result(
      (rows.data || []).filter((item) => {
        const text = `${item.titolo || ''} ${item.destinazione || ''} ${item.data_partenza || ''}`.toLowerCase();
        return text.includes(query);
      }),
      true,
      null
    );
  }

  async getDependencies(id) {
    if (!hasId(id)) return result(null, false, new Error('Identificativo viaggio non valido.'));
    const bookings = await getPrenotazioni();
    if (bookings.success === false) return bookings;
    const tripId = String(id);
    return result({
      prenotazioni: (bookings.data || []).filter((item) => {
        const normalizedViaggioId = String(item?.viaggio_id || '');
        const normalizedTrattaId = String(item?.tratta_id || '');
        return normalizedViaggioId === tripId || normalizedTrattaId === tripId;
      })
    }, true, null);
  }

  async uploadLocandina(file, { onProgress } = {}) {
    try {
      if (!file) return result(null, false, new Error('File locandina mancante.'));
      const client = getSupabase();
      const { bucket } = getStorageConfig();
      const fileName = sanitizeFileName(file.name);
      const extension = fileName.includes('.') ? fileName.split('.').pop() : 'bin';
      const path = `viaggi/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
      const upload = await client.storage.from(bucket).upload(path, file, { upsert: true });
      if (upload.error) return result(null, false, upload.error);
      const publicUrl = client.storage.from(bucket).getPublicUrl(path);
      if (typeof onProgress === 'function') onProgress(100);
      return result({ url: publicUrl.data?.publicUrl || '', bucket, path }, true, null);
    } catch (error) {
      return result(null, false, error);
    }
  }

  subscribe(listener) {
    return subscribeTable('viaggi', listener);
  }
}

export const tripService = new TripService();
export default tripService;
