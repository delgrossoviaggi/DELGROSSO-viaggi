import { buildBookingPaymentSummary } from './paymentService.js';
import { getSeatCountForBooking } from './seatAssignmentService.js';
import { ADMIN_ROUTES } from '../utils/appRoutes.js';

const SETTINGS_ACTIVITY_KEY = 'dg_settings_activity_v1';
const BACKUP_KEY = 'gestionale-backup-v1';
const SUMMARY_KEY = 'dg_notification_center_summary_v1';

const DAY_MS = 1000 * 60 * 60 * 24;
const RECENT_WINDOW_MS = DAY_MS * 3;
const MESSAGE_WINDOW_MS = DAY_MS * 7;
const BACKUP_STALE_MS = DAY_MS * 2;

function lower(value) {
  return String(value || '').trim().toLowerCase();
}

function readJsonStorage(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch (error) {
    console.warn(`Impossibile leggere ${key} dal localStorage`, error);
    return fallback;
  }
}

function writeJsonStorage(key, value) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Impossibile scrivere ${key} nel localStorage`, error);
  }
}

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatDate(value) {
  const date = toDate(value);
  if (!date) return '-';
  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function formatDateTime(value) {
  const date = toDate(value);
  if (!date) return '-';
  return date.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getTripDateRaw(trip) {
  return String(trip?.data_partenza || trip?.data_servizio || '').slice(0, 10);
}

function getTripTimeRaw(trip) {
  return String(trip?.ora_partenza || '00:00').slice(0, 5) || '00:00';
}

function toTripDateTime(trip) {
  const datePart = getTripDateRaw(trip);
  if (!datePart) return null;
  return toDate(`${datePart}T${getTripTimeRaw(trip)}:00`);
}

function isCancelledStatus(status) {
  const normalized = lower(status);
  return normalized === 'annullata' || normalized === 'annullato' || normalized === 'archiviato';
}

function isCompletedTrip(trip, now = new Date()) {
  const status = lower(trip?.stato);
  if (status.includes('conclus') || status.includes('complet')) return true;
  const tripDate = toTripDateTime(trip);
  return Boolean(tripDate && tripDate < startOfDay(now));
}

function isScheduledTrip(trip, now = new Date()) {
  if (isCancelledStatus(trip?.stato)) return false;
  return !isCompletedTrip(trip, now);
}

function getBookingSeats(booking) {
  const explicitSeats = getSeatCountForBooking(booking);
  if (explicitSeats > 0) return explicitSeats;
  const fallbackCount = Number(booking?.numero_persone ?? 0);
  return Number.isFinite(fallbackCount) && fallbackCount > 0 ? fallbackCount : 0;
}

function getBookingCustomerLabel(booking) {
  return String(
    booking?.cliente_nome ||
    booking?.cliente ||
    `${booking?.nome || ''} ${booking?.cognome || ''}`.trim() ||
    booking?.email ||
    'Cliente'
  ).trim();
}

function getTripTitle(trip) {
  return String(trip?.destinazione || trip?.titolo || 'Viaggio');
}

function getBusLabel(bus) {
  return `${bus?.marca || ''} ${bus?.modello || ''} ${bus?.targa || ''}`.trim() || bus?.targa || 'Bus';
}

function getTripBusLabel(trip, fleetMap) {
  const busId = String(trip?.autobus_id || trip?.mezzo_id || '');
  if (busId && fleetMap.has(busId)) return getBusLabel(fleetMap.get(busId));
  return String(trip?.autobus || trip?.mezzo || 'Bus non assegnato');
}

function buildSeatMap(bookings) {
  const seatMap = new Map();
  (Array.isArray(bookings) ? bookings : []).forEach((booking) => {
    if (isCancelledStatus(booking?.stato)) return;
    const tripId = String(booking?.viaggio_id || booking?.tratta_id || '');
    if (!tripId) return;
    seatMap.set(tripId, (seatMap.get(tripId) || 0) + getBookingSeats(booking));
  });
  return seatMap;
}

function getActivityEntries() {
  const activity = readJsonStorage(SETTINGS_ACTIVITY_KEY, []);
  return Array.isArray(activity) ? activity : [];
}

function getBackupTimestamp(settings = {}) {
  const fromSettings = settings?.configurazioni?.ultimoBackup;
  if (fromSettings && fromSettings !== 'Nessun backup disponibile') return fromSettings;
  const backup = readJsonStorage(BACKUP_KEY, null);
  return backup?.createdAt || null;
}

function createCategory({
  id,
  label,
  tone = 'info',
  count = 0,
  summary = '',
  items = [],
  href = ADMIN_ROUTES.notifiche
}) {
  return {
    id,
    label,
    tone,
    count: Number(count || 0),
    summary: String(summary || ''),
    href,
    items,
    latestAt: items.reduce((latest, item) => {
      const timestamp = toDate(item?.at)?.getTime() || 0;
      return timestamp > latest ? timestamp : latest;
    }, 0)
  };
}

function persistSummary(summary) {
  const payload = {
    totalAlerts: Number(summary?.totalAlerts || 0),
    updatedAt: new Date().toISOString(),
    categories: Array.isArray(summary?.categories)
      ? summary.categories.map((category) => ({
        id: category.id,
        label: category.label,
        count: category.count,
        tone: category.tone
      }))
      : []
  };

  writeJsonStorage(SUMMARY_KEY, payload);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new window.CustomEvent('dg:notification-center-updated', { detail: payload }));
  }

  return payload;
}

export function getNotificationCenterSummary() {
  return readJsonStorage(SUMMARY_KEY, {
    totalAlerts: 0,
    updatedAt: null,
    categories: []
  });
}

export function subscribeNotificationCenterSummary(callback) {
  if (typeof window === 'undefined' || typeof callback !== 'function') return () => {};

  const onCustomEvent = (event) => callback(event.detail || getNotificationCenterSummary());
  const onStorage = (event) => {
    if (event.key !== SUMMARY_KEY) return;
    callback(getNotificationCenterSummary());
  };

  window.addEventListener('dg:notification-center-updated', onCustomEvent);
  window.addEventListener('storage', onStorage);

  return () => {
    window.removeEventListener('dg:notification-center-updated', onCustomEvent);
    window.removeEventListener('storage', onStorage);
  };
}

export function buildNotificationCenterModel({
  trips = [],
  bookings = [],
  payments = [],
  fleet = [],
  notifications = [],
  quotes = [],
  settings = {}
} = {}) {
  const now = new Date();
  const recentThreshold = now.getTime() - RECENT_WINDOW_MS;
  const messageThreshold = now.getTime() - MESSAGE_WINDOW_MS;
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const dayAfterTomorrow = addDays(today, 2);
  const safeTrips = Array.isArray(trips) ? trips : [];
  const safeBookings = Array.isArray(bookings) ? bookings : [];
  const safePayments = Array.isArray(payments) ? payments : [];
  const safeFleet = Array.isArray(fleet) ? fleet : [];
  const safeNotifications = Array.isArray(notifications) ? notifications : [];
  const safeQuotes = Array.isArray(quotes) ? quotes : [];
  const seatMap = buildSeatMap(safeBookings);
  const paymentMap = new Map();
  safePayments.forEach((payment) => {
    const bookingId = String(payment?.prenotazione_id || '');
    if (!bookingId) return;
    if (!paymentMap.has(bookingId)) paymentMap.set(bookingId, []);
    paymentMap.get(bookingId).push(payment);
  });
  const fleetMap = new Map(safeFleet.map((bus) => [String(bus.id), bus]));
  const scheduledTrips = safeTrips
    .filter((trip) => isScheduledTrip(trip, now))
    .sort((left, right) => (toTripDateTime(left)?.getTime() || 0) - (toTripDateTime(right)?.getTime() || 0));

  const recentBookings = safeBookings
    .filter((booking) => !isCancelledStatus(booking?.stato))
    .map((booking) => {
      const timestamp = booking?.created_at || booking?.updated_at || booking?.data;
      return {
        booking,
        date: toDate(timestamp)
      };
    })
    .filter((entry) => entry.date && entry.date.getTime() >= recentThreshold)
    .sort((left, right) => right.date - left.date);

  const recentQuotes = safeQuotes
    .map((quote) => {
      const timestamp = quote?.created_at || quote?.updated_at;
      return {
        quote,
        date: toDate(timestamp)
      };
    })
    .filter((entry) => entry.date && entry.date.getTime() >= recentThreshold)
    .sort((left, right) => right.date - left.date);

  const recentPayments = safePayments
    .map((payment) => ({
      payment,
      date: toDate(payment?.data_pagamento || payment?.created_at || payment?.updated_at)
    }))
    .filter((entry) => entry.date && entry.date.getTime() >= recentThreshold)
    .sort((left, right) => right.date - left.date);

  const outstandingBookings = safeBookings
    .filter((booking) => !isCancelledStatus(booking?.stato))
    .map((booking) => ({
      booking,
      summary: buildBookingPaymentSummary(booking, paymentMap.get(String(booking?.id || '')) || [])
    }))
    .filter((entry) => entry.summary.residual > 0)
    .sort((left, right) => right.summary.residual - left.summary.residual);

  const capacityAlerts = scheduledTrips
    .map((trip) => {
      const tripId = String(trip?.id || '');
      const occupied = seatMap.get(tripId) || 0;
      const totalSeats = Number(trip?.posti_totali || trip?.posti || 0);
      const ratio = totalSeats > 0 ? occupied / totalSeats : 0;
      return {
        trip,
        occupied,
        totalSeats,
        ratio,
        tripDate: toTripDateTime(trip)
      };
    })
    .filter((entry) => entry.totalSeats > 0 && entry.ratio >= 0.8)
    .sort((left, right) => {
      if (right.ratio !== left.ratio) return right.ratio - left.ratio;
      return (left.tripDate?.getTime() || 0) - (right.tripDate?.getTime() || 0);
    });

  const tomorrowTrips = scheduledTrips.filter((trip) => {
    const tripDate = toTripDateTime(trip);
    return tripDate && tripDate >= tomorrow && tripDate < dayAfterTomorrow;
  });

  const persistedErrors = safeNotifications
    .filter((notification) => lower(notification?.tipo) === 'error')
    .map((notification) => ({
      title: notification?.titolo || 'Errore di sistema',
      text: notification?.messaggio || 'Errore registrato nel gestionale.',
      meta: formatDateTime(notification?.created_at),
      at: notification?.created_at,
      tone: 'error',
      categoryId: 'errors',
      href: ADMIN_ROUTES.notifiche
    }))
    .filter((item) => (toDate(item.at)?.getTime() || 0) >= messageThreshold);

  const activityErrors = getActivityEntries()
    .map((entry) => ({
      ...entry,
      date: toDate(entry?.at)
    }))
    .filter((entry) => {
      const haystack = `${entry?.action || ''} ${entry?.detail || ''}`.toLowerCase();
      return entry.date && entry.date.getTime() >= messageThreshold && /errore|error|fallit|failed|eccezione/.test(haystack);
    })
    .map((entry) => ({
      title: entry.action || 'Errore operativo',
      text: entry.detail || 'Errore registrato nel registro attivita.',
      meta: formatDateTime(entry.at),
      at: entry.at,
      tone: 'error',
      categoryId: 'errors',
      href: `${ADMIN_ROUTES.impostazioni}#activity-section`
    }));

  const messageItems = safeNotifications
    .filter((notification) => lower(notification?.tipo) !== 'error')
    .map((notification) => ({
      title: notification?.titolo || 'Messaggio di sistema',
      text: notification?.messaggio || '',
      meta: formatDateTime(notification?.created_at),
      at: notification?.created_at,
      tone: lower(notification?.tipo) === 'warning' ? 'warning' : 'info',
      categoryId: 'messages',
      href: ADMIN_ROUTES.notifiche
    }))
    .filter((item) => (toDate(item.at)?.getTime() || 0) >= messageThreshold)
    .sort((left, right) => (toDate(right.at)?.getTime() || 0) - (toDate(left.at)?.getTime() || 0));

  const bookingCategory = createCategory({
    id: 'bookings',
    label: 'Nuove prenotazioni',
    tone: recentBookings.length ? 'info' : 'success',
    count: recentBookings.length,
    summary: recentBookings.length
      ? `${recentBookings.length} prenotazioni registrate negli ultimi 3 giorni.`
      : 'Nessuna nuova prenotazione nelle ultime 72 ore.',
    items: recentBookings.slice(0, 6).map(({ booking, date }) => ({
      title: getBookingCustomerLabel(booking),
      text: `${booking?.stato || 'In attesa'} · ${booking?.viaggio_codice || booking?.viaggio_id || 'Viaggio da verificare'}`,
      meta: formatDateTime(date),
      at: date?.toISOString(),
      tone: 'info',
      categoryId: 'bookings',
      href: ADMIN_ROUTES.prenotazioni
    }))
  });

  const quoteCategory = createCategory({
    id: 'quotes',
    label: 'Nuovi preventivi',
    tone: recentQuotes.length ? 'info' : 'success',
    count: recentQuotes.length,
    summary: recentQuotes.length
      ? `${recentQuotes.length} preventivi arrivati negli ultimi 3 giorni.`
      : 'Nessun nuovo preventivo nelle ultime 72 ore.',
    items: recentQuotes.slice(0, 6).map(({ quote, date }) => ({
      title: `${quote?.nome || ''} ${quote?.cognome || ''}`.trim() || quote?.destinazione || 'Preventivo',
      text: `${quote?.destinazione || 'Destinazione da definire'} · ${quote?.stato || 'Nuovo'}`,
      meta: formatDateTime(date),
      at: date?.toISOString(),
      tone: hasConvertedQuote(quote) ? 'success' : 'info',
      categoryId: 'quotes',
      href: ADMIN_ROUTES.preventivi
    }))
  });

  const paymentCategory = createCategory({
    id: 'payments',
    label: 'Pagamenti',
    tone: outstandingBookings.length ? 'warning' : recentPayments.length ? 'info' : 'success',
    count: outstandingBookings.length + recentPayments.length,
    summary: outstandingBookings.length
      ? `${outstandingBookings.length} prenotazioni con saldo residuo da incassare.`
      : recentPayments.length
        ? `${recentPayments.length} movimenti registrati negli ultimi 3 giorni.`
        : 'Nessun alert pagamenti attivo.',
    items: [
      ...outstandingBookings.slice(0, 4).map(({ booking, summary }) => ({
        title: getBookingCustomerLabel(booking),
        text: `${summary.status} · residuo ${summary.residual.toFixed(2)} € · ${booking?.viaggio_codice || booking?.viaggio_id || 'Prenotazione'}`,
        meta: formatDateTime(booking?.updated_at || booking?.created_at),
        at: booking?.updated_at || booking?.created_at || now.toISOString(),
        tone: 'warning',
        categoryId: 'payments',
        href: `${ADMIN_ROUTES.pagamenti}?booking=${encodeURIComponent(booking?.id || '')}`
      })),
      ...recentPayments.slice(0, 4).map(({ payment, date }) => ({
        title: payment?.cliente || 'Pagamento registrato',
        text: `${payment?.tipo || 'Movimento'} · ${payment?.metodo_pagamento || payment?.metodo || 'Metodo da verificare'}`,
        meta: `${formatDateTime(date)} · ${payment?.ricevuta || 'Senza ricevuta'}`,
        at: date?.toISOString(),
        tone: payment?.tipo === 'Rimborso' ? 'warning' : 'success',
        categoryId: 'payments',
        href: `${ADMIN_ROUTES.pagamenti}?booking=${encodeURIComponent(payment?.prenotazione_id || '')}`
      }))
    ].slice(0, 6),
    href: ADMIN_ROUTES.pagamenti
  });

  const capacityCategory = createCategory({
    id: 'capacity',
    label: 'Bus quasi pieni',
    tone: capacityAlerts.length ? 'warning' : 'success',
    count: capacityAlerts.length,
    summary: capacityAlerts.length
      ? `${capacityAlerts.length} viaggi sopra l'80% di occupazione.`
      : 'Nessun viaggio con capienza critica.',
    items: capacityAlerts.slice(0, 6).map((entry) => ({
      title: entry.ratio >= 1 ? 'Viaggio sold out' : getTripTitle(entry.trip),
      text: `${getTripTitle(entry.trip)} · ${entry.occupied}/${entry.totalSeats} posti · ${getTripBusLabel(entry.trip, fleetMap)}`,
      meta: `${formatDate(entry.tripDate)} · ${getTripTimeRaw(entry.trip)}`,
      at: entry.tripDate?.toISOString(),
      tone: 'warning',
      categoryId: 'capacity',
      href: `${ADMIN_ROUTES.viaggi}?trip=${encodeURIComponent(entry.trip?.id || '')}`
    }))
  });

  const tomorrowCategory = createCategory({
    id: 'tomorrow',
    label: 'Viaggi domani',
    tone: tomorrowTrips.length ? 'warning' : 'success',
    count: tomorrowTrips.length,
    summary: tomorrowTrips.length
      ? `${tomorrowTrips.length} partenze pianificate per domani.`
      : 'Nessuna partenza pianificata per domani.',
    items: tomorrowTrips.slice(0, 6).map((trip) => ({
      title: getTripTitle(trip),
      text: `${getTripTimeRaw(trip)} · ${getTripBusLabel(trip, fleetMap)}`,
      meta: formatDate(toTripDateTime(trip)),
      at: toTripDateTime(trip)?.toISOString(),
      tone: 'warning',
      categoryId: 'tomorrow',
      href: `${ADMIN_ROUTES.viaggi}?trip=${encodeURIComponent(trip?.id || '')}`
    }))
  });

  const backupAt = getBackupTimestamp(settings);
  const backupDate = toDate(backupAt);
  const backupAge = backupDate ? now.getTime() - backupDate.getTime() : Number.POSITIVE_INFINITY;
  const backupIssueCount = backupAge > BACKUP_STALE_MS ? 1 : 0;
  const backupCategory = createCategory({
    id: 'backup',
    label: 'Backup',
    tone: backupIssueCount ? 'warning' : 'success',
    count: backupIssueCount,
    summary: backupDate
      ? backupIssueCount
        ? `Backup da aggiornare. Ultima esecuzione ${formatDateTime(backupDate)}.`
        : `Backup aggiornato ${formatDateTime(backupDate)}.`
      : 'Nessun backup registrato.',
    items: [{
      title: backupIssueCount ? 'Backup da verificare' : 'Backup operativo',
      text: backupDate
        ? `Ultimo backup disponibile: ${formatDateTime(backupDate)}`
        : 'Apri Impostazioni ed esegui un backup locale del gestionale.',
      meta: backupDate ? formatDateTime(backupDate) : 'Azione richiesta',
      at: backupDate?.toISOString() || now.toISOString(),
      tone: backupIssueCount ? 'warning' : 'success',
      categoryId: 'backup',
      href: `${ADMIN_ROUTES.impostazioni}#backup`
    }]
  });

  const errorCategory = createCategory({
    id: 'errors',
    label: 'Errori',
    tone: persistedErrors.length || activityErrors.length ? 'error' : 'success',
    count: persistedErrors.length + activityErrors.length,
    summary: persistedErrors.length || activityErrors.length
      ? `${persistedErrors.length + activityErrors.length} errori rilevati negli ultimi 7 giorni.`
      : 'Nessun errore recente registrato.',
    items: [...persistedErrors, ...activityErrors]
      .sort((left, right) => (toDate(right.at)?.getTime() || 0) - (toDate(left.at)?.getTime() || 0))
      .slice(0, 6)
  });

  const messageCategory = createCategory({
    id: 'messages',
    label: 'Messaggi',
    tone: messageItems.length ? 'info' : 'success',
    count: messageItems.length,
    summary: messageItems.length
      ? `${messageItems.length} messaggi di sistema disponibili.`
      : 'Nessun messaggio operativo recente.',
    items: messageItems.slice(0, 6)
  });

  const categories = [
    bookingCategory,
    quoteCategory,
    paymentCategory,
    capacityCategory,
    tomorrowCategory,
    backupCategory,
    errorCategory,
    messageCategory
  ];

  const timeline = categories
    .flatMap((category) => category.items.map((item) => ({
      ...item,
      categoryLabel: category.label,
      categoryTone: category.tone
    })))
    .sort((left, right) => (toDate(right.at)?.getTime() || 0) - (toDate(left.at)?.getTime() || 0))
    .slice(0, 12);

  const summary = persistSummary({
    totalAlerts: categories.reduce((sum, category) => sum + category.count, 0),
    categories
  });

  return {
    categories,
    timeline,
    totalAlerts: summary.totalAlerts,
    updatedAt: summary.updatedAt
  };
}

function hasConvertedQuote(quote) {
  const value = lower(quote?.convertito_prenotazione_id);
  return value && value !== 'null' && value !== 'undefined';
}
