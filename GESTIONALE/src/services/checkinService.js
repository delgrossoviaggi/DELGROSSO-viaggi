import { bookingService } from './bookingService.js';
import { tripService } from './tripService.js';
import { createTableRow, listTableRows, subscribeTable, updateTableRows } from '../../js/delgrosso-api.js';
import { parseBookingQrPayload } from '../utils/qrBookingUtils.js';

const TABLE = 'accessi_checkin';
let historyUnavailable = false;
const MAX_RETRY_REMOVED_COLUMNS = 8;

export const CHECKIN_STATUS = Object.freeze({
  PRESENTE: 'PRESENTE',
  ASSENTE: 'ASSENTE',
  RITARDO: 'RITARDO',
  ALTRA_FERMATA: 'ALTRA_FERMATA',
  NON_PRESENTE: 'NON_PRESENTE'
});

function success(data) {
  return { success: true, data, error: null };
}

function failure(error) {
  return { success: false, data: null, error: error instanceof Error ? error : new Error(String(error || 'Operazione non riuscita.')) };
}

function lower(value) {
  return String(value || '').trim().toLowerCase();
}

function formatPassengerName(booking = {}) {
  return String(
    booking?.cliente ||
    booking?.cliente_nome ||
    `${booking?.nome || ''} ${booking?.cognome || ''}`.trim() ||
    booking?.email ||
    'Passeggero'
  ).trim();
}

function formatSeats(value) {
  const source = Array.isArray(value) ? value : String(value ?? '').split(',');
  const text = source
    .map((seat) => String(seat ?? '').trim())
    .filter(Boolean)
    .map((seat) => seat.padStart(2, '0'))
    .join(', ');
  if (!text) return '—';
  return text;
}

function isMissingHistoryTableError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes("could not find the table 'public.accessi_checkin'") || message.includes('relation "public.accessi_checkin" does not exist');
}

function isMissingCheckinColumnError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return (
    message.includes('checked_in_at')
    || message.includes('checkin_effettuato')
    || message.includes('ultimo_accesso_at')
    || message.includes('checkin_operatore')
    || message.includes('checkin_note')
    || message.includes('checkin_stato')
    || message.includes('checkin_fermata')
  ) && (
    message.includes('does not exist')
    || message.includes('schema cache')
    || message.includes('could not find')
  );
}

function extractMissingColumnName(error, table) {
  const message = String(error?.message || error || '');
  if (!message || !table) return '';
  const escapedTable = table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`Could not find the '([^']+)' column of '${escapedTable}'`, 'i'),
    new RegExp(`column "([^"]+)" of relation "${escapedTable}" does not exist`, 'i'),
    new RegExp(`column ([\\w_]+) of relation ${escapedTable} does not exist`, 'i')
  ];
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) return match[1];
  }
  return '';
}

function createMissingCheckinSchemaError() {
  return new Error('Schema Supabase incompleto: campi check-in assenti su prenotazioni. Eseguire la migration QR/Check-in.');
}

function resolveHistoryRead(response, fallbackData = []) {
  if (response?.success === false && isMissingHistoryTableError(response.error)) {
    historyUnavailable = true;
    return success(fallbackData);
  }
  return response;
}

async function loadBookings() {
  const response = await bookingService.getAll();
  if (response.success === false) throw response.error;
  return Array.isArray(response.data) ? response.data : [];
}

async function loadTrips() {
  const response = await tripService.getAll();
  if (response.success === false) throw response.error;
  return Array.isArray(response.data) ? response.data : [];
}

function parseSeatSelection(value) {
  if (Array.isArray(value)) {
    return value.map((seat) => String(seat || '').trim()).filter(Boolean);
  }
  const raw = String(value ?? '').trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((seat) => String(seat || '').trim()).filter(Boolean);
    }
  } catch (_error) {
    // fallback CSV parsing
  }
  return raw.split(',').map((seat) => seat.trim()).filter(Boolean);
}

function normalizePresenceStatus(status) {
  const normalized = String(status || '').trim().toUpperCase();
  if (normalized === CHECKIN_STATUS.PRESENTE) return CHECKIN_STATUS.PRESENTE;
  if (normalized === CHECKIN_STATUS.ASSENTE) return CHECKIN_STATUS.ASSENTE;
  if (normalized === CHECKIN_STATUS.RITARDO) return CHECKIN_STATUS.RITARDO;
  if (normalized === CHECKIN_STATUS.ALTRA_FERMATA) return CHECKIN_STATUS.ALTRA_FERMATA;
  return CHECKIN_STATUS.NON_PRESENTE;
}

function isActiveBooking(booking = {}) {
  return String(booking.stato || '').toLowerCase() !== 'annullata';
}

function matchesBookingQuery(booking = {}, trip = {}, query = '') {
  const normalizedQuery = lower(query);
  if (!normalizedQuery) return true;
  const searchable = [
    booking.id,
    booking.codice,
    booking.cliente,
    booking.cliente_nome,
    booking.telefono,
    booking.cliente_telefono,
    booking.email,
    booking.cliente_email,
    booking.posti_selezionati,
    booking.checkin_stato,
    trip?.destinazione,
    trip?.titolo,
    trip?.data_partenza
  ].map((value) => String(value || '')).join(' ').toLowerCase();
  return searchable.includes(normalizedQuery);
}

function toTripOption(trip = {}) {
  const destination = String(trip.destinazione || trip.titolo || trip.codice || 'Viaggio').trim();
  const date = String(trip.data_partenza || trip.data_servizio || '').slice(0, 10);
  const time = String(trip.ora_partenza || '').slice(0, 5);
  return {
    id: trip.id,
    label: [destination, date, time].filter(Boolean).join(' • ')
  };
}

function computeCheckinMutation(status, now, existingBooking = {}, stopLabel = '') {
  const normalizedStatus = normalizePresenceStatus(status);
  const mutation = {
    checkin_stato: normalizedStatus,
    checkin_note: '',
    checkin_operatore: '',
    checkin_fermata: stopLabel || existingBooking.checkin_fermata || '',
    ultimo_accesso_at: now
  };

  if (normalizedStatus === CHECKIN_STATUS.PRESENTE || normalizedStatus === CHECKIN_STATUS.ALTRA_FERMATA) {
    mutation.checkin_effettuato = true;
    mutation.checked_in_at = existingBooking.checked_in_at || now;
    return mutation;
  }

  if (normalizedStatus === CHECKIN_STATUS.RITARDO) {
    mutation.checkin_effettuato = false;
    mutation.checked_in_at = null;
    return mutation;
  }

  mutation.checkin_effettuato = false;
  mutation.checked_in_at = null;
  return mutation;
}

async function updateBookingCheckinStatus(bookingId, payload) {
  const retryPayload = { ...(payload || {}) };
  for (let attempt = 0; attempt < MAX_RETRY_REMOVED_COLUMNS; attempt += 1) {
    const updateResponse = await bookingService.update(bookingId, retryPayload);
    if (updateResponse.success !== false) return updateResponse;

    const missingColumn = extractMissingColumnName(updateResponse.error, 'prenotazioni');
    if (!missingColumn || !(missingColumn in retryPayload)) {
      if (isMissingCheckinColumnError(updateResponse.error)) throw createMissingCheckinSchemaError();
      throw updateResponse.error;
    }
    delete retryPayload[missingColumn];
  }
  throw new Error('Impossibile aggiornare lo stato presenza: schema prenotazioni non compatibile.');
}

function findBookingByQr(bookings, qr) {
  const normalizedBookingId = lower(qr.bookingId);
  const normalizedPhone = lower(qr.phone);
  const normalizedEmail = lower(qr.email);
  const normalizedSeat = lower(qr.seat);

  return (bookings || []).find((booking) => {
    const bookingId = lower(booking.id || booking.codice);
    const bookingCode = lower(booking.codice);
    const bookingPhone = lower(booking.telefono || booking.cliente_telefono);
    const bookingEmail = lower(booking.email || booking.cliente_email);
    const bookingSeats = lower(booking.posti_selezionati || booking.posti);

    if (normalizedBookingId && (bookingId === normalizedBookingId || bookingCode === normalizedBookingId)) return true;
    if (normalizedPhone && bookingPhone && bookingPhone === normalizedPhone) return true;
    if (normalizedEmail && bookingEmail && bookingEmail === normalizedEmail) return true;
    if (normalizedSeat && normalizedBookingId && bookingSeats.includes(normalizedSeat)) return bookingId === normalizedBookingId || bookingCode === normalizedBookingId;
    return false;
  }) || null;
}

function findTripForBooking(trips, booking) {
  const bookingTripId = String(booking?.viaggio_id || booking?.tratta_id || '').trim();
  if (!bookingTripId) return null;
  return (trips || []).find((trip) => String(trip?.id || '').trim() === bookingTripId) || null;
}

export async function lookupBookingFromQr(rawQrPayload) {
  try {
    const qr = parseBookingQrPayload(rawQrPayload);
    if (!qr.isValid) {
      return failure(new Error('QR Code non valido o incompleto.'));
    }

    const [bookings, trips] = await Promise.all([loadBookings(), loadTrips()]);
    const booking = findBookingByQr(bookings, qr);
    if (!booking) {
      return failure(new Error('Passeggero non trovato per il QR scansionato.'));
    }

    return success({
      qr,
      booking,
      trip: findTripForBooking(trips, booking)
    });
  } catch (error) {
    return failure(error);
  }
}

export async function markBookingPresence({
  booking,
  trip,
  status = CHECKIN_STATUS.PRESENTE,
  qrPayload,
  operatorName,
  gate,
  stopLabel,
  note
} = {}) {
  try {
    if (!booking?.id) throw new Error('Prenotazione non valida per il check-in.');

    const now = new Date().toISOString();
    const normalizedStatus = normalizePresenceStatus(status);
    const mutation = computeCheckinMutation(normalizedStatus, now, booking, stopLabel || gate || '');
    mutation.checkin_operatore = operatorName || '';
    mutation.checkin_note = note || '';
    const updateResponse = await updateBookingCheckinStatus(booking.id, mutation);

    const accessPayload = {
      prenotazione_id: booking.id,
      prenotazione_codice: booking.codice || booking.id,
      viaggio_id: booking.viaggio_id || booking.tratta_id || trip?.id || '',
      cliente: formatPassengerName(booking),
      telefono: booking.telefono || booking.cliente_telefono || '',
      email: booking.email || booking.cliente_email || '',
      posto: formatSeats(booking.posti_selezionati || booking.posti),
      esito: normalizedStatus,
      operatore: operatorName || '',
      gate: gate || stopLabel || '',
      note: note || '',
      qr_payload: String(qrPayload || '').trim()
    };

    if (!historyUnavailable) {
      const historyResponse = await createTableRow(TABLE, accessPayload, { select: '*' });
      if (historyResponse.success === false) {
        if (isMissingHistoryTableError(historyResponse.error)) {
          historyUnavailable = true;
        } else {
          throw historyResponse.error;
        }
      }
    }

    return success({
      booking: updateResponse.data,
      trip,
      access: accessPayload,
      status: normalizedStatus
    });
  } catch (error) {
    return failure(error);
  }
}

export async function registerBoardingCheckin(args = {}) {
  return markBookingPresence({
    ...args,
    status: CHECKIN_STATUS.PRESENTE
  });
}

export async function saveBookingCheckinNote({ bookingId, note = '', operatorName = '' } = {}) {
  const normalizedBookingId = String(bookingId || '').trim();
  if (!normalizedBookingId) return failure(new Error('Prenotazione non valida.'));
  try {
    const now = new Date().toISOString();
    const payload = {
      checkin_note: String(note || '').trim(),
      checkin_operatore: String(operatorName || '').trim(),
      ultimo_accesso_at: now
    };
    const response = await updateBookingCheckinStatus(normalizedBookingId, payload);
    return success(response.data);
  } catch (error) {
    return failure(error);
  }
}

export async function searchPassengers({ query = '', tripId = '', onlyActive = true } = {}) {
  try {
    const [bookings, trips] = await Promise.all([loadBookings(), loadTrips()]);
    const selectedTripId = String(tripId || '').trim();
    const byTrip = selectedTripId
      ? bookings.filter((booking) => String(booking.viaggio_id || booking.tratta_id || '').trim() === selectedTripId)
      : bookings;

    const filtered = byTrip
      .filter((booking) => (onlyActive ? isActiveBooking(booking) : true))
      .map((booking) => ({
        booking,
        trip: findTripForBooking(trips, booking)
      }))
      .filter((item) => matchesBookingQuery(item.booking, item.trip, query))
      .slice(0, 80);

    return success(filtered);
  } catch (error) {
    return failure(error);
  }
}

export async function listTripsForCheckin() {
  try {
    const trips = await loadTrips();
    const sorted = [...trips].sort((a, b) => {
      const aDate = String(a.data_partenza || a.data_servizio || '');
      const bDate = String(b.data_partenza || b.data_servizio || '');
      return aDate.localeCompare(bDate);
    });
    return success(sorted.map((trip) => ({ ...trip, optionLabel: toTripOption(trip).label })));
  } catch (error) {
    return failure(error);
  }
}

export async function getTripPassengers(tripId) {
  const normalizedTripId = String(tripId || '').trim();
  if (!normalizedTripId) return failure(new Error('Seleziona un viaggio valido.'));
  try {
    const [bookings, trips] = await Promise.all([loadBookings(), loadTrips()]);
    const trip = trips.find((item) => String(item.id || '').trim() === normalizedTripId) || null;
    if (!trip) return failure(new Error('Viaggio non trovato.'));

    const passengers = bookings
      .filter((booking) => String(booking.viaggio_id || booking.tratta_id || '').trim() === normalizedTripId)
      .filter((booking) => isActiveBooking(booking))
      .map((booking) => ({
        ...booking,
        __seats: parseSeatSelection(booking.posti_selezionati || booking.posti)
      }));

    return success({ trip, bookings: passengers });
  } catch (error) {
    return failure(error);
  }
}

export async function listCheckinHistory() {
  if (historyUnavailable) return success([]);
  try {
    const response = await listTableRows(TABLE, {
      select: '*',
      orderBy: [{ column: 'created_at', ascending: false }]
    });
    return resolveHistoryRead(response, []);
  } catch (error) {
    if (isMissingHistoryTableError(error)) {
      historyUnavailable = true;
      return success([]);
    }
    return failure(error);
  }
}

export function subscribeCheckinHistory(callback) {
  if (historyUnavailable) return () => {};
  return subscribeTable(TABLE, callback);
}

export async function markHistoryNote(id, note) {
  try {
    const response = await updateTableRows(TABLE, { note }, {
      filters: [{ column: 'id', operator: 'eq', value: id }],
      select: '*',
      single: true
    });
    return resolveHistoryRead(response, null);
  } catch (error) {
    return failure(error);
  }
}

export const checkinService = {
  CHECKIN_STATUS,
  lookupBookingFromQr,
  registerBoardingCheckin,
  markBookingPresence,
  saveBookingCheckinNote,
  searchPassengers,
  listTripsForCheckin,
  getTripPassengers,
  listCheckinHistory,
  subscribeCheckinHistory,
  markHistoryNote
};
