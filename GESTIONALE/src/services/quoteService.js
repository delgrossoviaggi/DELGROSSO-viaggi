import {
  createTableRow,
  deleteTableRows,
  getSupabase,
  getTableRow,
  listTableRows,
  subscribeTable,
  updateTableRows
} from '../../js/delgrosso-api.js';
import { clientService } from './clientService.js';
import { bookingService } from './bookingService.js';
import { tripService } from './tripService.js';
import { extractData } from '../utils/serviceResult.js';
import { notify } from './notificationService.js';

const QUOTE_TABLE = 'preventivi';
const DEFAULT_STATUS = 'Nuovo';
const ALLOWED_QUOTE_SERVICES = ['Gran Turismo', 'Limousine Bus', 'Navetta Eventi', 'Viaggio di Gruppo'];
const ALLOWED_QUOTE_STATUSES = ['Nuovo', 'In Lavorazione', 'Inviato', 'Accettato', 'Rifiutato', 'Convertito'];

function result(data, success = true, error = null) {
  return { success, data, error };
}

function hasId(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized !== '' && normalized !== 'undefined' && normalized !== 'null';
}

function normalizeText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function toAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function toPassengers(value) {
  return Math.max(Number(value || 0) || 0, 1);
}

function normalizeRequestedService(value) {
  const service = normalizeText(value, 'Gran Turismo');
  if (ALLOWED_QUOTE_SERVICES.includes(service)) return service;
  return 'Gran Turismo';
}

function normalizeQuoteStatus(value) {
  const raw = normalizeText(value, DEFAULT_STATUS).toLowerCase();
  if (raw === 'bozza') return 'Nuovo';
  if (raw === 'in lavorazione' || raw === 'in_lavorazione') return 'In Lavorazione';
  if (raw === 'offerta inviata') return 'Inviato';
  if (raw === 'archiviato') return 'Rifiutato';
  if (raw === 'nuovo') return 'Nuovo';
  if (raw === 'inviato') return 'Inviato';
  if (raw === 'accettato') return 'Accettato';
  if (raw === 'rifiutato') return 'Rifiutato';
  if (raw === 'convertito') return 'Convertito';
  return DEFAULT_STATUS;
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value;
  const raw = String(value ?? '').trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'si' || raw === 'yes';
}

function buildQuoteNumber(rawCode, rawLegacyCode, fallbackSeed = {}) {
  const code = normalizeText(rawCode || rawLegacyCode || fallbackSeed.codice || fallbackSeed.numero_preventivo || '');
  return code || buildQuoteCode();
}

function isMissingTableError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes(QUOTE_TABLE) && (
    message.includes('does not exist')
    || message.includes('schema cache')
    || message.includes('could not find')
    || message.includes('relation')
  );
}

function isSchemaColumnMismatchError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('column')
    && message.includes(QUOTE_TABLE)
    && message.includes('does not exist');
}

function createMissingTableSchemaError() {
  return new Error('Schema Supabase incompleto: tabella preventivi non disponibile. Eseguire la migration del modulo Preventivi.');
}

async function listQuotesWithRawSelect() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(QUOTE_TABLE)
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return result([], false, error);
  return result((data || []).map(normalizeQuoteRow), true, null);
}

async function findQuoteWithRawSelect(id) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(QUOTE_TABLE)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) return result(null, false, error);
  return result(data ? normalizeQuoteRow(data) : null, true, null);
}

function buildQuoteCode() {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const token = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PRE-${yyyy}${mm}${dd}-${token}`;
}

function normalizeQuoteRow(row = {}) {
  const quoteNumber = buildQuoteNumber(row.numero_preventivo, row.codice, row);
  const convertedBookingId = normalizeText(row.prenotazione_id || row.convertito_prenotazione_id);
  const conversionFlag = normalizeBoolean(row.convertito_prenotazione) || hasId(convertedBookingId);
  return {
    ...row,
    numero_preventivo: quoteNumber,
    codice: quoteNumber,
    stato: normalizeQuoteStatus(row.stato),
    origine: normalizeText(row.origine, 'gestionale'),
    nome: normalizeText(row.nome),
    cognome: normalizeText(row.cognome),
    telefono: normalizeText(row.telefono),
    email: normalizeText(row.email),
    azienda: normalizeText(row.azienda),
    servizio: normalizeRequestedService(row.servizio || row.servizio_richiesto),
    servizio_richiesto: normalizeRequestedService(row.servizio_richiesto || row.servizio),
    destinazione: normalizeText(row.destinazione),
    luogo_partenza: normalizeText(row.luogo_partenza || row.partenza),
    partenza: normalizeText(row.partenza || row.luogo_partenza),
    data_viaggio: row.data_viaggio || row.data_partenza || null,
    data_partenza: row.data_partenza || row.data_viaggio || null,
    data_ritorno: row.data_ritorno || null,
    numero_passeggeri: toPassengers(row.numero_passeggeri ?? row.passeggeri),
    passeggeri: toPassengers(row.passeggeri ?? row.numero_passeggeri),
    importo: toAmount(row.importo ?? row.importo_preventivo),
    importo_preventivo: toAmount(row.importo_preventivo ?? row.importo),
    messaggio: normalizeText(row.messaggio || row.note_cliente),
    note_cliente: normalizeText(row.note_cliente || row.messaggio),
    note_interne: normalizeText(row.note_interne),
    dettagli_offerta: normalizeText(row.dettagli_offerta),
    convertito_prenotazione: conversionFlag,
    prenotazione_id: convertedBookingId,
    convertito_prenotazione_id: convertedBookingId,
    convertito_viaggio_id: normalizeText(row.convertito_viaggio_id)
      || normalizeText(row.viaggio_id),
    data_creazione: row.data_creazione || row.created_at || null,
    data_modifica: row.data_modifica || row.updated_at || null,
    operatore: normalizeText(row.operatore)
  };
}

function sanitizeQuotePayload(payload = {}, { isCreate = false } = {}) {
  const normalized = normalizeQuoteRow({
    ...payload,
    codice: normalizeText(
      payload.codice || payload.numero_preventivo,
      isCreate ? buildQuoteCode() : normalizeText(payload.codice || payload.numero_preventivo)
    )
  });
  const quoteNumber = buildQuoteNumber(
    payload.numero_preventivo || normalized.numero_preventivo,
    payload.codice || normalized.codice,
    normalized
  );
  const convertedBookingId = normalizeText(payload.prenotazione_id || payload.convertito_prenotazione_id || normalized.prenotazione_id);
  const convertedFlag = normalizeBoolean(payload.convertito_prenotazione) || hasId(convertedBookingId);
  const tripId = normalizeText(payload.convertito_viaggio_id || payload.viaggio_id || normalized.convertito_viaggio_id);

  return {
    numero_preventivo: quoteNumber,
    codice: quoteNumber,
    nome: normalized.nome,
    cognome: normalized.cognome,
    telefono: normalized.telefono,
    email: normalized.email,
    azienda: normalized.azienda,
    origine: normalizeText(payload.origine, normalized.origine || 'gestionale'),
    stato: normalizeQuoteStatus(payload.stato || normalized.stato || DEFAULT_STATUS),
    servizio: normalizeRequestedService(payload.servizio || payload.servizio_richiesto || normalized.servizio),
    servizio_richiesto: normalizeRequestedService(payload.servizio_richiesto || payload.servizio || normalized.servizio_richiesto),
    destinazione: normalized.destinazione,
    luogo_partenza: normalizeText(payload.luogo_partenza || payload.partenza || normalized.luogo_partenza),
    partenza: normalizeText(payload.partenza || payload.luogo_partenza || normalized.partenza),
    data_viaggio: payload.data_viaggio || payload.data_partenza || normalized.data_viaggio || null,
    data_partenza: payload.data_partenza || payload.data_viaggio || normalized.data_partenza || null,
    data_ritorno: payload.data_ritorno || null,
    numero_passeggeri: toPassengers(payload.numero_passeggeri ?? payload.passeggeri ?? normalized.numero_passeggeri),
    passeggeri: toPassengers(payload.passeggeri ?? payload.numero_passeggeri ?? normalized.passeggeri),
    importo: toAmount(payload.importo ?? payload.importo_preventivo ?? normalized.importo),
    importo_preventivo: toAmount(payload.importo_preventivo ?? payload.importo ?? normalized.importo_preventivo),
    validita_preventivo: payload.validita_preventivo || null,
    messaggio: normalizeText(payload.messaggio || payload.note_cliente || normalized.messaggio),
    note_cliente: normalizeText(payload.note_cliente || payload.messaggio || normalized.note_cliente),
    note_interne: normalized.note_interne,
    dettagli_offerta: normalized.dettagli_offerta,
    operatore: normalizeText(payload.operatore || normalized.operatore),
    convertito_prenotazione: convertedFlag,
    prenotazione_id: convertedBookingId || null,
    convertito_prenotazione_id: convertedBookingId || null,
    viaggio_id: tripId || null,
    convertito_viaggio_id: tripId || null,
    data_creazione: payload.data_creazione || normalized.data_creazione || null,
    data_modifica: payload.data_modifica || normalized.data_modifica || null
  };
}

async function createQuoteNotification(quote) {
  const fullName = `${quote?.nome || ''} ${quote?.cognome || ''}`.trim() || 'Cliente';
  const route = `${quote?.luogo_partenza || quote?.partenza || 'Partenza da definire'} -> ${quote?.destinazione || 'Destinazione da definire'}`;
  const passengers = Math.max(Number(quote?.numero_passeggeri || quote?.passeggeri || 1), 1);
  await notify({
    titolo: 'Nuovo preventivo ricevuto',
    messaggio: `${fullName}\n${route}\n${passengers} passeggeri`,
    tipo: 'INFO',
    riferimento: quote?.id || null
  });
}

function splitCustomerName(quote) {
  return {
    nome: normalizeText(quote.nome),
    cognome: normalizeText(quote.cognome)
  };
}

async function ensureClientFromQuote(quote) {
  const clients = extractData(await clientService.getAll(), []);
  const email = normalizeText(quote.email).toLowerCase();
  const phone = normalizeText(quote.telefono);

  const existing = clients.find((client) => {
    const sameEmail = email && normalizeText(client.email).toLowerCase() === email;
    const samePhone = phone && normalizeText(client.telefono) === phone;
    return sameEmail || samePhone;
  });

  if (existing) return { client: existing, created: false };

  const nameParts = splitCustomerName(quote);
  const created = extractData(await clientService.create({
    nome: nameParts.nome || 'Cliente',
    cognome: nameParts.cognome || '',
    telefono: phone,
    email: normalizeText(quote.email),
    azienda: normalizeText(quote.azienda),
    note: `Creato automaticamente dal preventivo ${normalizeText(quote.codice)}`
  }), null);

  if (!created?.id) {
    throw new Error('Impossibile creare il cliente dal preventivo.');
  }

  return { client: created, created: true };
}

export class QuoteService {
  async all(options = {}) {
    const response = await listTableRows(QUOTE_TABLE, {
      orderBy: [{ column: 'created_at', ascending: false }]
    });
    if (response.success === false) {
      if (isSchemaColumnMismatchError(response.error)) {
        return listQuotesWithRawSelect();
      }
      if (options.tolerateMissingTable && isMissingTableError(response.error)) {
        return result([], true, null);
      }
      if (isMissingTableError(response.error)) {
        return result([], false, createMissingTableSchemaError());
      }
      return response;
    }
    return result((response.data || []).map(normalizeQuoteRow), true, null);
  }

  async find(id, options = {}) {
    if (!hasId(id)) return result(null, false, new Error('Identificativo preventivo non valido.'));
    const response = await getTableRow(QUOTE_TABLE, id);
    if (response.success === false) {
      if (isSchemaColumnMismatchError(response.error)) {
        return findQuoteWithRawSelect(id);
      }
      if (options.tolerateMissingTable && isMissingTableError(response.error)) {
        return result(null, true, null);
      }
      if (isMissingTableError(response.error)) {
        return result(null, false, createMissingTableSchemaError());
      }
      return response;
    }
    return result(response.data ? normalizeQuoteRow(response.data) : null, true, null);
  }

  async create(payload) {
    const sanitized = sanitizeQuotePayload(payload, { isCreate: true });
    if (!sanitized.nome) return result(null, false, new Error('Il nome del cliente e obbligatorio.'));
    if (!sanitized.telefono) return result(null, false, new Error('Il telefono del cliente e obbligatorio.'));
    if (!sanitized.destinazione) return result(null, false, new Error('La destinazione richiesta e obbligatoria.'));
    if (!ALLOWED_QUOTE_STATUSES.includes(sanitized.stato)) {
      return result(null, false, new Error('Stato preventivo non valido.'));
    }
    const response = await createTableRow(QUOTE_TABLE, sanitized);
    if (response.success === false) {
      if (isMissingTableError(response.error)) return result(null, false, createMissingTableSchemaError());
      return response;
    }
    const normalizedQuote = normalizeQuoteRow(response.data);
    if (normalizedQuote.origine === 'sito') {
      await createQuoteNotification(normalizedQuote);
    }
    return result(normalizedQuote, true, null);
  }

  async update(id, payload) {
    if (!hasId(id)) return result(null, false, new Error('Identificativo preventivo non valido.'));
    const current = extractData(await this.find(id), null);
    if (!current) return result(null, false, new Error('Preventivo non trovato.'));
    const sanitized = sanitizeQuotePayload({ ...current, ...(payload || {}) });
    if (!ALLOWED_QUOTE_STATUSES.includes(sanitized.stato)) {
      return result(null, false, new Error('Stato preventivo non valido.'));
    }
    const response = await updateTableRows(QUOTE_TABLE, sanitized, {
      filters: [{ column: 'id', operator: 'eq', value: id }],
      single: true
    });
    if (response.success === false) {
      if (isMissingTableError(response.error)) return result(null, false, createMissingTableSchemaError());
      return response;
    }
    return result(normalizeQuoteRow(response.data), true, null);
  }

  async remove(id) {
    if (!hasId(id)) return result(null, false, new Error('Identificativo preventivo non valido.'));
    const response = await deleteTableRows(QUOTE_TABLE, {
      filters: [{ column: 'id', operator: 'eq', value: id }]
    });
    if (response.success === false && isMissingTableError(response.error)) {
      return result(null, false, createMissingTableSchemaError());
    }
    return response;
  }

  async duplicate(id) {
    const quote = extractData(await this.find(id), null);
    if (!quote) return result(null, false, new Error('Preventivo non trovato.'));
    const duplicatePayload = {
      ...quote,
      codice: buildQuoteCode(),
      numero_preventivo: buildQuoteCode(),
      stato: 'Nuovo',
      convertito_prenotazione: false,
      prenotazione_id: '',
      convertito_prenotazione_id: '',
      convertito_viaggio_id: ''
    };
    delete duplicatePayload.id;
    delete duplicatePayload.created_at;
    delete duplicatePayload.updated_at;
    return this.create(duplicatePayload);
  }

  async convertToBooking(quoteId, { tripId } = {}) {
    if (!hasId(quoteId)) return result(null, false, new Error('Preventivo non valido.'));
    if (!hasId(tripId)) return result(null, false, new Error('Seleziona un viaggio per la conversione.'));

    const quote = extractData(await this.find(quoteId), null);
    if (!quote) return result(null, false, new Error('Preventivo non trovato.'));
    if (hasId(quote.convertito_prenotazione_id) || hasId(quote.prenotazione_id) || quote.convertito_prenotazione === true) {
      return result(null, false, new Error('Questo preventivo e gia stato convertito in prenotazione.'));
    }

    const trip = extractData(await tripService.find(tripId), null);
    if (!trip?.id) return result(null, false, new Error('Viaggio selezionato non trovato.'));

    const seats = toPassengers(quote.passeggeri);
    const total = toAmount(quote.importo_preventivo) || (toAmount(trip.prezzo) * seats);
    if (total <= 0) {
      return result(null, false, new Error('Definisci un importo preventivo o seleziona un viaggio con prezzo valido.'));
    }

    let occupancyApplied = false;
    let createdClient = null;
    let savedBooking = null;

    try {
      const clientResult = await ensureClientFromQuote(quote);
      createdClient = clientResult.created ? clientResult.client : null;
      const client = clientResult.client;

      extractData(await tripService.updateOccupancy(trip.id, seats), null);
      occupancyApplied = true;

      savedBooking = extractData(await bookingService.create({
        cliente: `${client.nome || ''} ${client.cognome || ''}`.trim(),
        telefono: client.telefono || quote.telefono || '',
        email: client.email || quote.email || '',
        viaggio_id: trip.id,
        posti: seats,
        totale: total,
        stato: 'In Attesa',
        note: [
          `Creato da preventivo ${quote.codice || quote.id}.`,
          quote.servizio_richiesto ? `Servizio: ${quote.servizio_richiesto}` : '',
          quote.dettagli_offerta ? `Dettagli offerta: ${quote.dettagli_offerta}` : '',
          quote.note_cliente ? `Note cliente: ${quote.note_cliente}` : ''
        ].filter(Boolean).join('\n')
      }), null);

      if (!savedBooking?.id) {
        throw new Error('Creazione prenotazione non riuscita.');
      }

      const updatedQuote = extractData(await this.update(quote.id, {
        stato: 'Convertito',
        convertito_prenotazione: true,
        prenotazione_id: savedBooking.id,
        convertito_prenotazione_id: savedBooking.id,
        viaggio_id: trip.id,
        convertito_viaggio_id: trip.id
      }), null);

      return result({
        quote: updatedQuote,
        booking: savedBooking,
        trip
      }, true, null);
    } catch (error) {
      if (savedBooking?.id) {
        await bookingService.delete(savedBooking.id);
      }
      if (occupancyApplied) {
        await tripService.updateOccupancy(trip.id, -seats);
      }
      if (createdClient?.id) {
        await clientService.delete(createdClient.id);
      }
      return result(null, false, error instanceof Error ? error : new Error(String(error || 'Conversione non riuscita.')));
    }
  }

  subscribe(listener) {
    return subscribeTable(QUOTE_TABLE, listener);
  }
}

export const quoteService = new QuoteService();
export default quoteService;
