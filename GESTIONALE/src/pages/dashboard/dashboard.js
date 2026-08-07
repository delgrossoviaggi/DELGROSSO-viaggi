import { bookingService } from '../../services/bookingService.js';
import { buildBookingPaymentSummary, getPaymentSignedAmount, paymentService } from '../../services/paymentService.js';
import { fleetService } from '../../services/fleetService.js';
import { tripService } from '../../services/tripService.js';
import { clientService } from '../../services/clientService.js';
import { notificationService } from '../../services/notificationService.js';
import { quoteService } from '../../services/quoteService.js';
import { getCurrentUser, getDisplayRole } from '../../services/localAuthService.js';
import { applyRuntimeSettings, getCachedSettingsSync, loadImpostazioni } from '../../services/settingsService.js';
import { buildNotificationCenterModel } from '../../services/notificationCenterService.js';
import { getSeatCountForBooking } from '../../services/seatAssignmentService.js';
import { ADMIN_ROUTES } from '../../utils/appRoutes.js';
import Chart from 'chart.js/auto';

const PAYMENTS_MODULE_DISABLED = false;
const THEME_KEY = 'dg_theme_preference';
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast?latitude=41.6854&longitude=15.3815&current=temperature_2m,weather_code&timezone=Europe%2FBerlin';
const MONTH_LABELS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const CHART_CANVAS_IDS = ['passengersChart', 'revenueChart', 'tripsChart', 'quotesChart', 'destinationsChart', 'busesChart'];

let lastSnapshot = null;
let notificationUnsubscribe = null;
let chartPeriod = 'monthly';
let chartsToolbarBound = false;
const dashboardCharts = new Map();

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function lower(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeQuoteStatus(value) {
  const status = lower(value);
  if (status === 'bozza') return 'nuovo';
  if (status === 'offerta inviata') return 'inviato';
  if (status === 'archiviato') return 'rifiutato';
  if (status === 'in lavorazione') return 'in lavorazione';
  return status;
}

function toAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(toAmount(value));
}

function formatNumber(value) {
  return new Intl.NumberFormat('it-IT').format(Number(value || 0));
}

function formatDate(value, options = {}) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...options
  });
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
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
  const value = new Date(`${datePart}T${getTripTimeRaw(trip)}:00`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildChartScope(period = 'monthly', now = new Date()) {
  if (period === 'annual') {
    const year = now.getFullYear();
    return {
      period: 'annual',
      start: new Date(year, 0, 1, 0, 0, 0, 0),
      end: new Date(year, 11, 31, 23, 59, 59, 999),
      labels: MONTH_LABELS,
      getIndex: (date) => date.getMonth(),
      headline: `Vista annuale ${year}`,
      rangeLabel: `nell'anno ${year}`
    };
  }

  const year = now.getFullYear();
  const month = now.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const monthLabel = now.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  return {
    period: 'monthly',
    start: new Date(year, month, 1, 0, 0, 0, 0),
    end: new Date(year, month, lastDay, 23, 59, 59, 999),
    labels: Array.from({ length: lastDay }, (_, index) => String(index + 1).padStart(2, '0')),
    getIndex: (date) => date.getDate() - 1,
    headline: `Vista mensile ${monthLabel}`,
    rangeLabel: `nel mese di ${monthLabel}`
  };
}

function isDateInScope(date, scope) {
  return Boolean(date && scope && date >= scope.start && date <= scope.end);
}

function createNumberSeries(length) {
  return Array.from({ length }, () => 0);
}

function roundSeries(series, digits = 0) {
  const factor = 10 ** digits;
  return series.map((value) => Math.round(Number(value || 0) * factor) / factor);
}

function buildSeries(scope, items, getDate, getValue, digits = 0) {
  const series = createNumberSeries(scope.labels.length);
  (Array.isArray(items) ? items : []).forEach((item) => {
    const date = normalizeDate(getDate(item));
    if (!isDateInScope(date, scope)) return;
    const index = scope.getIndex(date);
    if (!Number.isInteger(index) || index < 0 || index >= series.length) return;
    series[index] += Number(getValue(item) || 0);
  });
  return roundSeries(series, digits);
}

function shortLabel(value, maxLength = 24) {
  const text = String(value || '').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

function getPaymentAmount(payment) {
  return getPaymentSignedAmount(payment);
}

function getPaymentDate(payment) {
  return payment?.data_pagamento || payment?.created_at || payment?.updated_at || payment?.data || null;
}

function getQuoteDate(quote) {
  return quote?.created_at || quote?.updated_at || quote?.data || null;
}

function getBusUsageDate(trip) {
  return toTripDateTime(trip) || normalizeDate(trip?.data_partenza || trip?.data_servizio || null);
}

function buildRanking(items, getLabel, getValue = () => 1, limit = 6) {
  const counts = new Map();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const label = String(getLabel(item) || '').trim();
    if (!label) return;
    counts.set(label, (counts.get(label) || 0) + Number(getValue(item) || 0));
  });
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit);
}

function getChartTheme() {
  const styles = window.getComputedStyle(document.documentElement);
  return {
    text: styles.getPropertyValue('--text').trim() || '#142133',
    muted: styles.getPropertyValue('--muted').trim() || '#62748a',
    border: styles.getPropertyValue('--border').trim() || 'rgba(15, 76, 129, 0.1)',
    brand: styles.getPropertyValue('--brand').trim() || '#0f4c81',
    brandStrong: styles.getPropertyValue('--brand-strong').trim() || '#0a2c47',
    accent: styles.getPropertyValue('--accent').trim() || '#f57c00',
    success: styles.getPropertyValue('--success').trim() || '#0f9d66',
    warning: styles.getPropertyValue('--warning').trim() || '#d97706',
    danger: styles.getPropertyValue('--danger').trim() || '#dc2626',
    violet: styles.getPropertyValue('--violet').trim() || '#7c3aed',
    sky: '#2563eb',
    orange: '#f97316'
  };
}

function buildChartOptions(theme, overrides = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    animation: false,
    plugins: {
      legend: {
        labels: {
          color: theme.text,
          usePointStyle: true,
          boxWidth: 10,
          boxHeight: 10,
          padding: 16
        }
      },
      tooltip: {
        backgroundColor: theme.brandStrong,
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: theme.border,
        borderWidth: 1,
        padding: 12
      }
    },
    scales: {
      x: {
        ticks: { color: theme.muted },
        grid: { color: theme.border, drawBorder: false }
      },
      y: {
        beginAtZero: true,
        ticks: { color: theme.muted },
        grid: { color: theme.border, drawBorder: false }
      }
    },
    ...overrides
  };
}

function renderOrReplaceChart(canvasId, config) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (dashboardCharts.has(canvasId)) {
    dashboardCharts.get(canvasId)?.destroy();
  }
  dashboardCharts.set(canvasId, new Chart(canvas, config));
}

function destroyDashboardCharts() {
  CHART_CANVAS_IDS.forEach((canvasId) => {
    dashboardCharts.get(canvasId)?.destroy();
    dashboardCharts.delete(canvasId);
  });
}

function getScopedTrips(snapshot, scope) {
  return snapshot.trips.filter((trip) => {
    if (isCancelledStatus(trip?.stato)) return false;
    return isDateInScope(getBusUsageDate(trip), scope);
  });
}

function buildDashboardChartsModel(snapshot, period = chartPeriod) {
  const scope = buildChartScope(period);
  const scopedTrips = getScopedTrips(snapshot, scope);
  const passengers = buildSeries(scope, snapshot.activeBookings, (booking) => booking?.created_at || booking?.updated_at || booking?.data, getBookingSeats);
  const revenueSourceItems = snapshot.payments.length ? snapshot.payments : snapshot.activeBookings;
  const revenue = snapshot.payments.length
    ? buildSeries(scope, revenueSourceItems, getPaymentDate, getPaymentAmount, 2)
    : buildSeries(scope, revenueSourceItems, (booking) => booking?.created_at || booking?.updated_at || booking?.data, getBookingTotal, 2);
  const trips = buildSeries(scope, snapshot.trips.filter((trip) => !isCancelledStatus(trip?.stato)), getBusUsageDate, () => 1);
  const quotes = buildSeries(scope, snapshot.quotes.filter((quote) => lower(quote?.stato) !== 'archiviato'), getQuoteDate, () => 1);
  const destinationRanking = buildRanking(scopedTrips, (trip) => trip?.destinazione || trip?.titolo || 'Destinazione da definire');
  const busRanking = buildRanking(scopedTrips, (trip) => getTripBusLabel(trip, snapshot.fleetMap), () => 1, 5);

  return {
    scope,
    passengers,
    revenue,
    trips,
    quotes,
    destinationRanking,
    busRanking,
    totalPassengers: passengers.reduce((sum, value) => sum + value, 0),
    totalRevenue: revenue.reduce((sum, value) => sum + value, 0),
    totalTrips: trips.reduce((sum, value) => sum + value, 0),
    totalQuotes: quotes.reduce((sum, value) => sum + value, 0),
    revenueSourceLabel: snapshot.payments.length ? 'incassi registrati' : 'valore stimato dalle prenotazioni'
  };
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

function getStoredTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.body.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  const toggle = document.getElementById('themeToggle');
  if (toggle) toggle.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
}

function getUserDisplayName(user) {
  if (!user) return 'Nicola';
  return String(user.username || user.nome || 'Nicola').split(' ')[0];
}

function setUserHeader() {
  const loggedEmail = document.getElementById('loggedEmail');
  const loggedRole = document.getElementById('loggedRole');
  const heroGreeting = document.getElementById('heroGreeting');
  const user = getCurrentUser();

  if (!user) {
    window.location.replace(ADMIN_ROUTES.login);
    return null;
  }

  if (loggedEmail) loggedEmail.textContent = user.nome || user.username || 'Nicola';
  if (loggedRole) loggedRole.textContent = getDisplayRole(user.ruolo);
  if (heroGreeting) heroGreeting.textContent = `Buongiorno ${getUserDisplayName(user)} 👋`;
  return user;
}

function showDashboardMessage(message, type = 'info') {
  const box = document.getElementById('dashboardMessage');
  if (!box) return;
  box.classList.remove('hidden');
  box.textContent = message;

  if (type === 'error') {
    box.style.background = 'rgba(220, 38, 38, 0.08)';
    box.style.borderColor = 'rgba(220, 38, 38, 0.18)';
    box.style.color = '#b91c1c';
    return;
  }

  if (type === 'warning') {
    box.style.background = 'rgba(217, 119, 6, 0.08)';
    box.style.borderColor = 'rgba(217, 119, 6, 0.18)';
    box.style.color = '#b45309';
    return;
  }

  box.style.background = 'rgba(15, 76, 129, 0.08)';
  box.style.borderColor = 'rgba(15, 76, 129, 0.16)';
  box.style.color = '#0f4c81';
}

function updateClock() {
  const now = new Date();
  const liveDate = document.getElementById('liveDate');
  const liveTime = document.getElementById('liveTime');

  if (liveDate) {
    liveDate.textContent = now.toLocaleDateString('it-IT', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }

  if (liveTime) {
    liveTime.textContent = now.toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
}

function weatherLabel(code, temperature) {
  const temp = Number.isFinite(Number(temperature)) ? `${Math.round(Number(temperature))}°C` : '--';
  const labels = {
    0: 'Sereno',
    1: 'Quasi sereno',
    2: 'Poco nuvoloso',
    3: 'Coperto',
    45: 'Nebbia',
    48: 'Nebbia',
    51: 'Pioviggine',
    53: 'Pioviggine',
    55: 'Pioviggine',
    61: 'Pioggia',
    63: 'Pioggia',
    65: 'Pioggia forte',
    71: 'Neve',
    80: 'Rovesci',
    95: 'Temporale'
  };
  return `${labels[code] || 'Meteo'} · ${temp}`;
}

async function loadWeather() {
  const weatherNow = document.getElementById('weatherNow');
  if (!weatherNow) return;

  try {
    const response = await fetch(WEATHER_URL, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Weather ${response.status}`);
    const data = await response.json();
    weatherNow.textContent = weatherLabel(data?.current?.weather_code, data?.current?.temperature_2m);
  } catch (error) {
    console.error(error);
    weatherNow.textContent = 'Meteo non disponibile';
  }
}

function getBusLabel(bus) {
  if (!bus) return 'Non assegnato';
  return `${bus.marca || ''} ${bus.modello || ''} ${bus.targa || ''}`.trim() || bus.targa || 'Bus';
}

function resolveBusStatus(bus) {
  const status = lower(bus?.stato);
  if (status.includes('fuori servizio') || status.includes('manut')) return 'Manutenzione';
  if (status.includes('viaggio') || status.includes('servizio')) return 'In viaggio';
  if (status.includes('dispon')) return 'Disponibile';
  if (bus?.viaggio_id) return 'In viaggio';
  return 'Disponibile';
}

function getTripBusLabel(trip, fleetMap) {
  const busId = String(trip?.autobus_id || trip?.mezzo_id || '');
  if (busId && fleetMap.has(busId)) return getBusLabel(fleetMap.get(busId));
  return String(trip?.autobus || trip?.mezzo || 'Bus non assegnato');
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

function getBookingTotal(booking) {
  return toAmount(booking?.totale ?? booking?.importo);
}

function getBookingSeats(booking) {
  const explicitSeats = getSeatCountForBooking(booking);
  if (explicitSeats > 0) return explicitSeats;
  const fallbackCount = Number(booking?.numero_persone ?? 0);
  return Number.isFinite(fallbackCount) && fallbackCount > 0 ? fallbackCount : 0;
}

function getBookingStatusClass(status) {
  const normalized = lower(status);
  if (normalized.includes('saldat') || normalized.includes('confermat')) return 'status-confermata';
  if (normalized.includes('attesa') || normalized.includes('acconto')) return 'status-attesa';
  if (normalized.includes('annull')) return 'status-annullata';
  return 'status-muted';
}

function buildSeatMap(bookings) {
  const safeBookings = Array.isArray(bookings) ? bookings : [];
  const seatMap = new Map();
  safeBookings.forEach((booking) => {
    if (isCancelledStatus(booking?.stato)) return;
    const tripId = String(booking?.viaggio_id || booking?.tratta_id || '');
    if (!tripId) return;
    seatMap.set(tripId, (seatMap.get(tripId) || 0) + getBookingSeats(booking));
  });
  return seatMap;
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = value;
}

function renderMetrics(snapshot) {
  setText('metricTripsToday', formatNumber(snapshot.tripsToday));
  setText('metricTripsTodayMeta', snapshot.tripsToday
    ? `${formatNumber(snapshot.tripsNext7Days)} partenze programmate nei prossimi 7 giorni.`
    : 'Nessuna partenza pianificata per oggi.');

  setText('metricPassengersToday', formatNumber(snapshot.passengersToday));
  setText('metricPassengersTodayMeta', snapshot.passengersToday
    ? `${formatNumber(snapshot.todayBookings.length)} prenotazioni collegate alle partenze odierne.`
    : 'Nessun passeggero assegnato alle partenze di oggi.');

  setText('metricBusAvailable', formatNumber(snapshot.busAvailable));
  setText('metricBusAvailableMeta', `${formatNumber(snapshot.busInService)} in servizio · ${formatNumber(snapshot.busMaintenance)} in manutenzione.`);

  setText('metricExpectedRevenue', formatCurrency(snapshot.expectedRevenue));
  setText('metricExpectedRevenueMeta', `${formatCurrency(snapshot.pendingRevenue)} ancora da incassare sulle prenotazioni attive.`);

  setText('metricQuotes', formatNumber(snapshot.quotesCount));
  setText('metricQuotesMeta', snapshot.quotesCount
    ? `${formatNumber(snapshot.quotesCount)} preventivi attualmente tracciati.`
    : 'Modulo preventivi predisposto e pronto ad essere popolato.');

  setText('metricBookings', formatNumber(snapshot.activeBookings.length));
  setText('metricBookingsMeta', `${formatNumber(snapshot.bookings.length)} totali · ${formatNumber(snapshot.cancelledBookingsCount)} annullate.`);

  setText('metricCollectedToday', formatCurrency(snapshot.collectedToday));
  setText('metricCollectedTodayMeta', 'Totale movimenti registrati oggi al netto dei rimborsi.');

  setText('metricOutstandingRevenue', formatCurrency(snapshot.pendingRevenue));
  setText('metricOutstandingRevenueMeta', `${formatNumber(snapshot.activeBookings.length)} prenotazioni attive con residui ricalcolati dal ledger.`);

  setText('metricDeposits', formatCurrency(snapshot.depositVolume));
  setText('metricDepositsMeta', 'Somma degli acconti registrati dal gestionale.');

  setText('metricBalances', formatCurrency(snapshot.balanceVolume));
  setText('metricBalancesMeta', 'Saldi incassati e chiusure prenotazione.');

  setText('metricRefunds', formatCurrency(snapshot.refundVolume));
  setText('metricRefundsMeta', 'Rimborsi contabilizzati sulle prenotazioni.');

  const quoteStatusCounters = snapshot.quotes.reduce((acc, quote) => {
    const status = normalizeQuoteStatus(quote?.stato);
    if (status === 'nuovo') acc.newCount += 1;
    if (status === 'in lavorazione') acc.workingCount += 1;
    if (status === 'accettato') acc.acceptedCount += 1;
    if (status === 'rifiutato') acc.rejectedCount += 1;
    return acc;
  }, {
    newCount: 0,
    workingCount: 0,
    acceptedCount: 0,
    rejectedCount: 0
  });

  setText('widgetQuoteNew', formatNumber(quoteStatusCounters.newCount));
  setText('widgetQuoteWorking', formatNumber(quoteStatusCounters.workingCount));
  setText('widgetQuoteAccepted', formatNumber(quoteStatusCounters.acceptedCount));
  setText('widgetQuoteRejected', formatNumber(quoteStatusCounters.rejectedCount));
}

function renderCharts(snapshot) {
  const theme = getChartTheme();
  const model = buildDashboardChartsModel(snapshot, chartPeriod);
  const topDestination = model.destinationRanking[0]?.[0] || 'Nessuna destinazione';
  const topBus = model.busRanking[0]?.[0] || 'Nessun autobus';
  const destinationLabels = model.destinationRanking.length
    ? model.destinationRanking.map(([label]) => shortLabel(label, 26))
    : ['Nessun dato'];
  const destinationValues = model.destinationRanking.length
    ? model.destinationRanking.map(([, value]) => value)
    : [0];
  const busLabels = model.busRanking.length
    ? model.busRanking.map(([label]) => shortLabel(label, 18))
    : ['Nessun dato'];
  const busValues = model.busRanking.length
    ? model.busRanking.map(([, value]) => value)
    : [1];
  const busFullLabels = model.busRanking.length
    ? model.busRanking.map(([label]) => label)
    : ['Nessun dato'];

  setText('chartsPeriodMeta', `${model.scope.headline} · Monitoraggio professionale di passeggeri, incassi, viaggi, preventivi, destinazioni e utilizzo flotta.`);
  setText('passengersChartMeta', `${formatNumber(model.totalPassengers)} passeggeri registrati ${model.scope.rangeLabel}.`);
  setText('revenueChartMeta', `${formatCurrency(model.totalRevenue)} di ${model.revenueSourceLabel} ${model.scope.rangeLabel}.`);
  setText('tripsChartMeta', `${formatNumber(model.totalTrips)} viaggi operativi ${model.scope.rangeLabel}.`);
  setText('quotesChartMeta', `${formatNumber(model.totalQuotes)} preventivi caricati ${model.scope.rangeLabel}.`);
  setText('destinationsChartMeta', model.destinationRanking.length
    ? `${topDestination} guida il ranking ${model.scope.rangeLabel}.`
    : `Nessuna destinazione attiva ${model.scope.rangeLabel}.`);
  setText('busesChartMeta', model.busRanking.length
    ? `${topBus} e il mezzo piu utilizzato ${model.scope.rangeLabel}.`
    : `Nessun autobus assegnato ${model.scope.rangeLabel}.`);

  renderOrReplaceChart('passengersChart', {
    type: 'line',
    data: {
      labels: model.scope.labels,
      datasets: [{
        label: 'Passeggeri',
        data: model.passengers,
        borderColor: theme.brand,
        backgroundColor: 'rgba(15, 76, 129, 0.14)',
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: theme.brand,
        tension: 0.35,
        fill: true
      }]
    },
    options: buildChartOptions(theme)
  });

  renderOrReplaceChart('revenueChart', {
    type: 'bar',
    data: {
      labels: model.scope.labels,
      datasets: [{
        label: 'Incassi',
        data: model.revenue,
        backgroundColor: 'rgba(245, 124, 0, 0.76)',
        borderColor: theme.accent,
        borderRadius: 10,
        maxBarThickness: 22
      }]
    },
    options: buildChartOptions(theme, {
      scales: {
        x: {
          ticks: { color: theme.muted },
          grid: { color: theme.border, drawBorder: false }
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: theme.muted,
            callback: (value) => formatCurrency(value)
          },
          grid: { color: theme.border, drawBorder: false }
        }
      }
    })
  });

  renderOrReplaceChart('tripsChart', {
    type: 'bar',
    data: {
      labels: model.scope.labels,
      datasets: [{
        label: 'Viaggi',
        data: model.trips,
        backgroundColor: 'rgba(37, 99, 235, 0.74)',
        borderColor: theme.sky,
        borderRadius: 10,
        maxBarThickness: 20
      }]
    },
    options: buildChartOptions(theme)
  });

  renderOrReplaceChart('quotesChart', {
    type: 'line',
    data: {
      labels: model.scope.labels,
      datasets: [{
        label: 'Preventivi',
        data: model.quotes,
        borderColor: theme.violet,
        backgroundColor: 'rgba(124, 58, 237, 0.12)',
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: theme.violet,
        tension: 0.35,
        fill: true
      }]
    },
    options: buildChartOptions(theme)
  });

  renderOrReplaceChart('destinationsChart', {
    type: 'bar',
    data: {
      labels: destinationLabels,
      datasets: [{
        label: 'Destinazioni',
        data: destinationValues,
        backgroundColor: [
          'rgba(245, 124, 0, 0.78)',
          'rgba(15, 76, 129, 0.82)',
          'rgba(124, 58, 237, 0.78)',
          'rgba(15, 157, 102, 0.78)',
          'rgba(249, 115, 22, 0.78)',
          'rgba(37, 99, 235, 0.78)'
        ],
        borderRadius: 10
      }]
    },
    options: buildChartOptions(theme, {
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: theme.brandStrong,
          titleColor: '#ffffff',
          bodyColor: '#ffffff',
          borderColor: theme.border,
          borderWidth: 1,
          padding: 12
        }
      }
    })
  });

  renderOrReplaceChart('busesChart', {
    type: 'doughnut',
    data: {
      labels: busLabels,
      fullLabels: busFullLabels,
      datasets: [{
        label: 'Utilizzo autobus',
        data: busValues,
        backgroundColor: [
          theme.brand,
          theme.accent,
          theme.violet,
          theme.success,
          theme.sky
        ],
        borderColor: theme.border,
        borderWidth: 0,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: theme.text,
            usePointStyle: true,
            boxWidth: 10,
            boxHeight: 10,
            padding: 16
          }
        },
        tooltip: {
          backgroundColor: theme.brandStrong,
          titleColor: '#ffffff',
          bodyColor: '#ffffff',
          borderColor: theme.border,
          borderWidth: 1,
          padding: 12,
          callbacks: {
            title: (items) => {
              const index = items[0]?.dataIndex ?? 0;
              return busFullLabels[index] || busLabels[index] || 'Autobus';
            },
            label: (context) => `${context.raw} assegnazioni`
          }
        }
      },
      cutout: '62%'
    }
  });

  updateChartPeriodButtons();
}

function updateChartPeriodButtons() {
  document.getElementById('chartPeriodMonthly')?.classList.toggle('is-active', chartPeriod === 'monthly');
  document.getElementById('chartPeriodAnnual')?.classList.toggle('is-active', chartPeriod === 'annual');
}

function renderCalendar(snapshot) {
  const container = document.getElementById('departureCalendar');
  if (!container) return;

  const today = startOfDay(new Date());
  const days = Array.from({ length: 21 }, (_, index) => addDays(today, index));
  const grouped = new Map();

  snapshot.scheduledTrips.forEach((trip) => {
    const key = getTripDateRaw(trip);
    if (!key) return;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(trip);
  });

  container.innerHTML = days.map((date) => {
    const key = date.toISOString().slice(0, 10);
    const list = grouped.get(key) || [];
    const rendered = list
      .slice(0, 3)
      .map((trip) => `<li>${escapeHtml(getTripTimeRaw(trip))} · ${escapeHtml(trip.destinazione || trip.titolo || 'Viaggio')}</li>`)
      .join('');
    const extra = list.length > 3 ? `<li>+${list.length - 3} altre partenze</li>` : '';
    return `
      <article class="calendar-day ${list.length ? 'has-events' : ''}">
        <strong>${escapeHtml(date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }))}</strong>
        ${list.length ? `<span>${list.length} partenza${list.length > 1 ? 'e' : ''}</span>` : '<span>Nessuna partenza</span>'}
        <ul class="calendar-list">${rendered}${extra}</ul>
      </article>
    `;
  }).join('');
}

function renderNotificationWidget(snapshot) {
  const container = document.getElementById('notificationsCenterList');
  const summary = document.getElementById('notificationsCenterSummary');
  if (!container || !summary) return;

  renderNotificationCategories(summary, snapshot.notificationCenter.categories);

  if (!snapshot.notificationCenter.timeline.length) {
    container.innerHTML = '<div class="empty-state">Nessuna priorita operativa disponibile.</div>';
    return;
  }

  container.innerHTML = snapshot.notificationCenter.timeline.slice(0, 6).map((item) => `
    <article class="stack-item ${escapeHtml(item.tone || 'info')}">
      <strong>${escapeHtml(item.title)}</strong>
      <p>${escapeHtml(item.text)}</p>
      <div class="stack-item__meta">
        <span class="record-chip">${escapeHtml(item.categoryLabel || 'Notifica')}</span>
        <small>${escapeHtml(item.meta)}</small>
      </div>
    </article>
  `).join('');
}

function renderRecentTrips(snapshot) {
  const container = document.getElementById('recentTripsList');
  if (!container) return;

  if (!snapshot.recentTrips.length) {
    container.innerHTML = '<div class="empty-state">Nessun viaggio imminente da monitorare.</div>';
    return;
  }

  container.innerHTML = snapshot.recentTrips.map((trip) => {
    const tripId = String(trip.id || '');
    const occupied = snapshot.seatMap.get(tripId) || 0;
    const totalSeats = Number(trip.posti_totali || trip.posti || 0);
    const available = Math.max(totalSeats - occupied, 0);
    return `
      <article class="stack-item">
        <div class="record-row">
          <div class="record-row__main">
            <strong>${escapeHtml(trip.destinazione || trip.titolo || 'Viaggio')}</strong>
            <p>${escapeHtml(trip.luogo_partenza || 'Partenza da definire')}</p>
            <div class="record-row__meta">
              <span class="record-chip">${escapeHtml(getTripTimeRaw(trip))}</span>
              <span class="record-chip">${escapeHtml(getTripBusLabel(trip, snapshot.fleetMap))}</span>
            </div>
          </div>
          <div class="record-row__aside">
            <strong>${formatDate(toTripDateTime(trip), { day: '2-digit', month: 'short' })}</strong>
            <small>${formatNumber(available)} liberi / ${formatNumber(occupied)} occupati</small>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function renderRecentBookings(snapshot) {
  const container = document.getElementById('recentBookingsList');
  if (!container) return;

  if (!snapshot.recentBookings.length) {
    container.innerHTML = '<div class="empty-state">Nessuna prenotazione recente disponibile.</div>';
    return;
  }

  container.innerHTML = snapshot.recentBookings.map((booking) => {
    const trip = snapshot.trips.find((item) => String(item.id) === String(booking.viaggio_id || booking.tratta_id || ''));
    return `
      <article class="stack-item">
        <div class="record-row">
          <div class="record-row__main">
            <strong>${escapeHtml(getBookingCustomerLabel(booking))}</strong>
            <p>${escapeHtml(trip?.destinazione || trip?.titolo || booking.viaggio_codice || 'Viaggio')}</p>
            <div class="record-row__meta">
              <span class="record-chip">${formatNumber(getBookingSeats(booking))} posti</span>
              <span class="status-badge ${escapeHtml(getBookingStatusClass(booking.stato))}">${escapeHtml(booking.stato || 'In Attesa')}</span>
            </div>
          </div>
          <div class="record-row__aside">
            <strong>${formatCurrency(getBookingTotal(booking))}</strong>
            <small>${escapeHtml(formatDateTime(booking.created_at || booking.updated_at || booking.data))}</small>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function renderRecentClients(snapshot) {
  const container = document.getElementById('recentClientsList');
  if (!container) return;

  if (!snapshot.recentClients.length) {
    container.innerHTML = '<div class="empty-state">Nessun cliente recente disponibile.</div>';
    return;
  }

  container.innerHTML = snapshot.recentClients.map((client) => {
    const initials = `${String(client.nome || '').charAt(0)}${String(client.cognome || '').charAt(0)}`.trim().toUpperCase() || 'CL';
    return `
      <article class="stack-item">
        <div class="record-row">
          <div class="record-row__main">
            <div class="record-row__meta" style="margin-top:0;">
              <span class="client-avatar">${escapeHtml(initials)}</span>
              <div>
                <strong>${escapeHtml(`${client.nome || ''} ${client.cognome || ''}`.trim() || client.email || 'Cliente')}</strong>
                <p>${escapeHtml(client.telefono || client.email || 'Contatto non disponibile')}</p>
              </div>
            </div>
          </div>
          <div class="record-row__aside">
            <small>${escapeHtml(formatDate(client.created_at || client.updated_at))}</small>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function renderHero(snapshot) {
  const nextDeparture = document.getElementById('heroNextDeparture');
  const passengersToday = document.getElementById('heroPassengersToday');
  const collectedToday = document.getElementById('heroCollectedToday');
  const nextTrip = snapshot.recentTrips[0] || null;
  if (passengersToday) passengersToday.textContent = formatNumber(snapshot.passengersToday);
  if (collectedToday) collectedToday.textContent = formatCurrency(snapshot.collectedToday);
  if (!nextDeparture) return;

  if (!nextTrip) {
    nextDeparture.textContent = 'Nessuna partenza';
    return;
  }

  nextDeparture.textContent = `${nextTrip.destinazione || nextTrip.titolo || 'Viaggio'} · ${formatDate(toTripDateTime(nextTrip), { day: '2-digit', month: 'short' })} ${getTripTimeRaw(nextTrip)}`;
}

function bindKpiNavigation() {
  document.querySelectorAll('.kpi-card[data-route]').forEach((card) => {
    if (card.dataset.bound === 'true') return;
    const navigate = () => {
      const route = String(card.dataset.route || '').trim();
      if (route) window.location.href = route;
    };
    card.dataset.bound = 'true';
    card.addEventListener('click', navigate);
    card.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      navigate();
    });
  });
}

function buildSearchDataset(snapshot) {
  const entries = [];

  snapshot.clients.forEach((client) => {
    entries.push({
      type: 'Cliente',
      title: `${client.nome || ''} ${client.cognome || ''}`.trim() || client.email || 'Cliente',
      meta: `${client.telefono || ''} ${client.email || ''}`.trim(),
      href: ADMIN_ROUTES.clienti
    });
  });

  snapshot.trips.forEach((trip) => {
    entries.push({
      type: 'Viaggio',
      title: trip.destinazione || trip.titolo || 'Viaggio',
      meta: `${formatDate(toTripDateTime(trip))} · ${getTripBusLabel(trip, snapshot.fleetMap)}`,
      href: `${ADMIN_ROUTES.viaggi}?trip=${encodeURIComponent(trip.id || '')}`
    });
  });

  snapshot.bookings.forEach((booking) => {
    entries.push({
      type: 'Prenotazione',
      title: getBookingCustomerLabel(booking),
      meta: `${booking.viaggio_codice || booking.viaggio_id || ''} · ${booking.stato || ''}`,
      href: ADMIN_ROUTES.prenotazioni
    });
  });

  snapshot.fleet.forEach((bus) => {
    entries.push({
      type: 'Autobus',
      title: getBusLabel(bus),
      meta: `${bus.categoria || 'Bus'} · ${resolveBusStatus(bus)}`,
      href: ADMIN_ROUTES.flotta
    });
  });

  snapshot.quotes.forEach((quote) => {
    entries.push({
      type: 'Preventivo',
      title: `${quote.nome || ''} ${quote.cognome || ''}`.trim() || quote.destinazione || 'Preventivo',
      meta: `${quote.destinazione || 'Destinazione'} · ${quote.stato || 'Nuovo'}`,
      href: ADMIN_ROUTES.preventivi
    });
  });

  return entries;
}

function renderSearchResults(query) {
  const resultsBox = document.getElementById('searchResults');
  if (!resultsBox) return;

  if (!lastSnapshot || query.trim().length < 2) {
    resultsBox.classList.add('hidden');
    resultsBox.innerHTML = '';
    return;
  }

  const normalized = lower(query);
  const matches = buildSearchDataset(lastSnapshot)
    .filter((entry) => `${entry.type} ${entry.title} ${entry.meta}`.toLowerCase().includes(normalized))
    .slice(0, 10);

  if (!matches.length) {
    resultsBox.classList.remove('hidden');
    resultsBox.innerHTML = '<div class="empty-state">Nessun risultato trovato.</div>';
    return;
  }

  resultsBox.classList.remove('hidden');
  resultsBox.innerHTML = matches.map((entry) => `
    <a class="search-result-item" href="${escapeHtml(entry.href)}">
      <div>
        <span class="result-type">${escapeHtml(entry.type)}</span>
        <span class="result-title">${escapeHtml(entry.title)}</span>
        <span class="result-meta">${escapeHtml(entry.meta)}</span>
      </div>
      <span class="record-chip">Apri</span>
    </a>
  `).join('');
}

function bindSearch() {
  const input = document.getElementById('globalSearch');
  const results = document.getElementById('searchResults');
  if (!input || !results) return;

  input.addEventListener('input', () => renderSearchResults(input.value));
  input.addEventListener('focus', () => renderSearchResults(input.value));
  document.addEventListener('click', (event) => {
    if (!results.contains(event.target) && event.target !== input) {
      results.classList.add('hidden');
    }
  });
}

function bindChartToolbar() {
  if (chartsToolbarBound) return;
  chartsToolbarBound = true;

  document.getElementById('chartPeriodMonthly')?.addEventListener('click', () => {
    if (chartPeriod === 'monthly') return;
    chartPeriod = 'monthly';
    updateChartPeriodButtons();
    if (lastSnapshot) renderAll(lastSnapshot);
  });

  document.getElementById('chartPeriodAnnual')?.addEventListener('click', () => {
    if (chartPeriod === 'annual') return;
    chartPeriod = 'annual';
    updateChartPeriodButtons();
    if (lastSnapshot) renderAll(lastSnapshot);
  });
}

function bindThemeToggle(rerender) {
  const toggle = document.getElementById('themeToggle');
  if (!toggle) return;
  toggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
    rerender(false);
  });
}

function renderNotificationCategories(container, categories) {
  container.innerHTML = categories.map((category) => `
    <article class="notification-category-card ${escapeHtml(category.tone || 'info')}">
      <header>
        <strong>${escapeHtml(category.label)}</strong>
        <span class="notification-category-count">${formatNumber(category.count)}</span>
      </header>
      <p>${escapeHtml(category.summary)}</p>
    </article>
  `).join('');
}

function resolveSystemTone(categories) {
  if (categories.some((category) => category.tone === 'error')) return 'error';
  if (categories.some((category) => category.tone === 'warning')) return 'warning';
  if (categories.some((category) => category.tone === 'info')) return 'info';
  return 'success';
}

function buildDashboardNotificationView(center) {
  const sourceCategories = Array.isArray(center?.categories) ? center.categories : [];
  const priorityCategoryIds = ['bookings', 'quotes', 'payments', 'messages'];
  const visibleCategories = priorityCategoryIds
    .map((id) => sourceCategories.find((category) => category.id === id))
    .filter(Boolean);
  const systemCategories = sourceCategories.filter((category) => !priorityCategoryIds.includes(category.id));

  visibleCategories.push({
    id: 'system',
    label: 'Notifiche di sistema',
    tone: resolveSystemTone(systemCategories),
    count: systemCategories.reduce((sum, category) => sum + Number(category.count || 0), 0),
    summary: systemCategories.some((category) => Number(category.count || 0) > 0)
      ? `${formatNumber(systemCategories.reduce((sum, category) => sum + Number(category.count || 0), 0))} alert tra partenze, backup, capienza ed errori.`
      : 'Nessuna notifica di sistema attiva.',
    items: systemCategories
      .flatMap((category) => (category.items || []).map((item) => ({
        ...item,
        categoryLabel: 'Notifiche di sistema',
        tone: item.tone || category.tone || 'info'
      })))
      .sort((left, right) => (new Date(right.at || 0).getTime() || 0) - (new Date(left.at || 0).getTime() || 0))
      .slice(0, 6)
  });

  const priorityTimeline = (Array.isArray(center?.timeline) ? center.timeline : []).map((item) => {
    const isPriority = priorityCategoryIds.includes(item.categoryId);
    return {
      ...item,
      categoryLabel: isPriority ? item.categoryLabel : 'Notifiche di sistema'
    };
  });

  return {
    categories: visibleCategories,
    timeline: priorityTimeline.slice(0, 12),
    totalAlerts: Number(center?.totalAlerts || 0)
  };
}

function renderNotificationCenter(center, rows) {
  const list = document.getElementById('notificationList');
  const badge = document.getElementById('notificationBadge');
  const summaryGrid = document.getElementById('notificationSummaryGrid');
  const panelMeta = document.getElementById('notificationPanelMeta');
  const persistedMeta = document.getElementById('notificationPersistedMeta');
  if (!list || !badge || !summaryGrid || !panelMeta || !persistedMeta) return;

   const view = buildDashboardNotificationView(center);

  badge.textContent = String(view.totalAlerts);
  badge.hidden = view.totalAlerts === 0;
  panelMeta.textContent = view.totalAlerts
    ? `${formatNumber(view.totalAlerts)} alert attivi su 5 categorie operative.`
    : 'Nessun alert attivo al momento.';
  renderNotificationCategories(summaryGrid, view.categories);

  const unreadSaved = rows.filter((item) => !item.letto).length;
  persistedMeta.textContent = rows.length
    ? `${formatNumber(unreadSaved)} non lette · ${formatNumber(rows.length)} salvate`
    : 'Nessuna notifica salvata';

  list.innerHTML = view.timeline.length ? view.timeline.map((item) => `
    <a class="notification-item ${escapeHtml(item.tone || 'info')}" href="${escapeHtml(item.href || ADMIN_ROUTES.notifiche)}">
      <strong>${escapeHtml(item.title)}</strong>
      <p>${escapeHtml(item.text)}</p>
      <div class="notification-item__meta">
        <span class="notification-item__chip">${escapeHtml(item.categoryLabel || 'Notifica')}</span>
        <small>${escapeHtml(item.meta)}</small>
      </div>
    </a>
  `).join('') : '<p class="notification-empty">Nessun alert operativo presente.</p>';
}

function bindNotificationCenter() {
  const toggle = document.getElementById('notificationToggle');
  const panel = document.getElementById('notificationPanel');
  const backdrop = document.getElementById('notificationBackdrop');
  const closeButton = document.getElementById('closeNotificationPanel');
  if (!toggle || !panel || !backdrop) return;

  const openPanel = () => {
    panel.removeAttribute('hidden');
    backdrop.removeAttribute('hidden');
    window.requestAnimationFrame(() => {
      panel.classList.add('is-open');
      backdrop.classList.add('is-open');
    });
    toggle.setAttribute('aria-expanded', 'true');
  };

  const closePanel = () => {
    panel.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    window.setTimeout(() => {
      if (!panel.classList.contains('is-open')) panel.setAttribute('hidden', '');
      if (!backdrop.classList.contains('is-open')) backdrop.setAttribute('hidden', '');
    }, 220);
  };

  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    const isHidden = panel.hasAttribute('hidden');
    if (isHidden) openPanel();
    else closePanel();
  });

  closeButton?.addEventListener('click', closePanel);
  backdrop.addEventListener('click', closePanel);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hasAttribute('hidden')) closePanel();
  });

  document.getElementById('markNotificationsRead')?.addEventListener('click', async () => {
    const result = await notificationService.markAllRead();
    if (result?.success === false) {
      showDashboardMessage(result.error?.message || 'Errore durante l\'aggiornamento notifiche', 'error');
      return;
    }
    showDashboardMessage('Notifiche salvate segnate come lette');
    await renderDashboard(false);
  });

  notificationUnsubscribe = notificationService.subscribe(() => {
    renderDashboard(false).catch((error) => console.error('Errore sync notifiche', error));
  });
}

function ensureArrayData(result, label) {
  if (!result || result.success === false) {
    const error = result?.error instanceof Error ? result.error : new Error(`Errore caricamento ${label}`);
    throw error;
  }
  return Array.isArray(result.data) ? result.data : [];
}

function ensureOptionalPaymentsData(result) {
  if (!result) return [];
  if (result.success === false) {
    const message = String(result.error?.message || result.error || '').toLowerCase();
    if (message.includes('modulo pagamenti non disponibile') || message.includes('public.pagamenti')) {
      return [];
    }
    throw (result.error instanceof Error ? result.error : new Error('Errore caricamento pagamenti'));
  }
  return Array.isArray(result.data) ? result.data : [];
}

function computeSnapshot(trips, bookings, payments, fleet, clients, notifications, quotes) {
  const safeTrips = Array.isArray(trips) ? trips : [];
  const safeBookings = Array.isArray(bookings) ? bookings : [];
  const safePayments = Array.isArray(payments) ? payments : [];
  const safeFleet = Array.isArray(fleet) ? fleet : [];
  const safeClients = Array.isArray(clients) ? clients : [];
  const safeNotifications = Array.isArray(notifications) ? notifications : [];
  const safeQuotes = Array.isArray(quotes) ? quotes : [];
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const nextWeek = addDays(today, 7);
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
  const todayTrips = scheduledTrips.filter((trip) => {
    const tripDate = toTripDateTime(trip);
    return tripDate && tripDate >= today && tripDate < tomorrow;
  });
  const todayTripIds = new Set(todayTrips.map((trip) => String(trip.id || '')));
  const activeBookings = safeBookings.filter((booking) => !isCancelledStatus(booking.stato));
  const activeBookingSummaries = activeBookings.map((booking) => ({
    booking,
    summary: buildBookingPaymentSummary(booking, paymentMap.get(String(booking?.id || '')) || [])
  }));
  const todayBookings = activeBookings.filter((booking) => todayTripIds.has(String(booking.viaggio_id || booking.tratta_id || '')));
  const cancelledBookingsCount = safeBookings.length - activeBookings.length;
  const busAvailable = safeFleet.filter((bus) => resolveBusStatus(bus) === 'Disponibile').length;
  const busInService = safeFleet.filter((bus) => resolveBusStatus(bus) === 'In viaggio').length;
  const busMaintenance = safeFleet.filter((bus) => resolveBusStatus(bus) === 'Manutenzione').length;
  const expectedRevenue = activeBookingSummaries.reduce((sum, entry) => sum + entry.summary.totalDue, 0);
  const pendingRevenue = activeBookingSummaries.reduce((sum, entry) => sum + entry.summary.residual, 0);
  const collectedToday = safePayments
    .filter((payment) => {
      const date = normalizeDate(getPaymentDate(payment));
      return date && date >= today && date < tomorrow;
    })
    .reduce((sum, payment) => sum + getPaymentSignedAmount(payment), 0);
  const depositVolume = safePayments
    .filter((payment) => lower(payment?.tipo) === 'acconto')
    .reduce((sum, payment) => sum + Math.max(getPaymentSignedAmount(payment), 0), 0);
  const balanceVolume = safePayments
    .filter((payment) => lower(payment?.tipo) === 'saldo')
    .reduce((sum, payment) => sum + Math.max(getPaymentSignedAmount(payment), 0), 0);
  const refundVolume = safePayments
    .filter((payment) => lower(payment?.tipo) === 'rimborso')
    .reduce((sum, payment) => sum + Math.abs(getPaymentSignedAmount(payment)), 0);
  const recentTrips = scheduledTrips.slice(0, 6);
  const recentBookings = activeBookings
    .slice()
    .sort((left, right) => new Date(right.created_at || right.updated_at || right.data || 0) - new Date(left.created_at || left.updated_at || left.data || 0))
    .slice(0, 6);
  const recentClients = safeClients
    .slice()
    .sort((left, right) => new Date(right.created_at || right.updated_at || 0) - new Date(left.created_at || left.updated_at || 0))
    .slice(0, 6);
  const recentQuotes = safeQuotes
    .slice()
    .sort((left, right) => new Date(right.created_at || right.updated_at || 0) - new Date(left.created_at || left.updated_at || 0))
    .slice(0, 6);

  const snapshot = {
    trips: safeTrips,
    bookings: safeBookings,
    payments: safePayments,
    fleet: safeFleet,
    clients: safeClients,
    quotes: safeQuotes,
    persistedNotifications: safeNotifications,
    fleetMap,
    seatMap,
    scheduledTrips,
    recentTrips,
    recentBookings,
    recentClients,
    recentQuotes,
    todayBookings,
    activeBookings,
    cancelledBookingsCount,
    tripsToday: todayTrips.length,
    tripsNext7Days: scheduledTrips.filter((trip) => {
      const date = toTripDateTime(trip);
      return date && date >= today && date < nextWeek;
    }).length,
    passengersToday: todayBookings.reduce((sum, booking) => sum + getBookingSeats(booking), 0),
    busAvailable,
    busInService,
    busMaintenance,
    expectedRevenue,
    pendingRevenue,
    collectedToday,
    depositVolume,
    balanceVolume,
    refundVolume,
    quotesCount: safeQuotes.filter((quote) => normalizeQuoteStatus(quote.stato) !== 'rifiutato').length
  };

  snapshot.notificationCenter = buildNotificationCenterModel({
    trips: safeTrips,
    bookings: safeBookings,
    payments: safePayments,
    fleet: safeFleet,
    notifications: safeNotifications,
    quotes: safeQuotes,
    settings: getCachedSettingsSync()
  });
  return snapshot;
}

function renderAll(snapshot) {
  renderMetrics(snapshot);
  renderHero(snapshot);
  renderCharts(snapshot);
  renderCalendar(snapshot);
  renderNotificationWidget(snapshot);
  renderRecentTrips(snapshot);
  renderRecentBookings(snapshot);
  renderRecentClients(snapshot);
  renderNotificationCenter(snapshot.notificationCenter, snapshot.persistedNotifications);
  renderSearchResults(document.getElementById('globalSearch')?.value || '');
}

async function renderDashboard(showSuccess = true) {
  const [tripsResult, bookingsResult, paymentsResult, fleetResult, clientsResult, notificationsResult, quotesResult] = await Promise.all([
    tripService.getAll(),
    bookingService.getAll(),
    PAYMENTS_MODULE_DISABLED ? Promise.resolve({ success: true, data: [], error: null }) : paymentService.getAll(),
    fleetService.getAll(),
    clientService.getAll(),
    notificationService.all(),
    quoteService.all({ tolerateMissingTable: true })
  ]);

  const snapshot = computeSnapshot(
    ensureArrayData(tripsResult, 'viaggi'),
    ensureArrayData(bookingsResult, 'prenotazioni'),
    ensureOptionalPaymentsData(paymentsResult),
    ensureArrayData(fleetResult, 'flotta'),
    ensureArrayData(clientsResult, 'clienti'),
    ensureArrayData(notificationsResult, 'notifiche'),
    ensureArrayData(quotesResult, 'preventivi')
  );

  lastSnapshot = snapshot;
  renderAll(snapshot);

  if (showSuccess) {
    showDashboardMessage('Dashboard aggiornata con successo');
  }
}

async function init() {
  loadImpostazioni().then((response) => {
    if (response.success === false) return;
    applyRuntimeSettings(response.data, { applyThemePreference: true });
  }).catch(() => {});
  const user = setUserHeader();
  if (!user) return;

  applyTheme(getStoredTheme());
  updateClock();
  await loadWeather();
  bindSearch();
  bindChartToolbar();
  bindNotificationCenter();
  bindKpiNavigation();

  let renderRunning = false;
  let renderQueued = false;
  let queuedShowSuccess = false;
  let renderTimer = null;
  const RENDER_DEBOUNCE_MS = 250;

  const performRender = async () => {
    if (renderRunning || !renderQueued) return;
    renderRunning = true;
    renderQueued = false;
    const showSuccess = queuedShowSuccess;
    queuedShowSuccess = false;
    try {
      await renderDashboard(showSuccess);
    } catch (error) {
      console.error(error);
      showDashboardMessage(error.message || 'Errore aggiornamento dashboard', 'error');
    } finally {
      renderRunning = false;
      if (renderQueued) window.setTimeout(performRender, 0);
    }
  };

  const scheduleRerender = (showSuccess = false, immediate = false) => {
    queuedShowSuccess = queuedShowSuccess || showSuccess;
    renderQueued = true;
    if (immediate) {
      if (renderTimer) {
        window.clearTimeout(renderTimer);
        renderTimer = null;
      }
      performRender();
      return;
    }
    if (renderTimer) window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(() => {
      renderTimer = null;
      performRender();
    }, RENDER_DEBOUNCE_MS);
  };

  bindThemeToggle((showSuccess = false) => scheduleRerender(showSuccess, true));

  const clockTimer = window.setInterval(updateClock, 1000);
  const dataRefreshTimer = window.setInterval(() => { scheduleRerender(false); }, 15000);
  const weatherTimer = window.setInterval(() => { loadWeather(); }, 30 * 60 * 1000);
  const onFocus = () => { scheduleRerender(false, true); };
  window.addEventListener('focus', onFocus);

  const unsubscribeBookings = bookingService.subscribe(() => { scheduleRerender(false); });
  const unsubscribePayments = PAYMENTS_MODULE_DISABLED ? () => {} : paymentService.subscribe(() => { scheduleRerender(false); });
  const unsubscribeFleet = fleetService.subscribe(() => { scheduleRerender(false); });
  const unsubscribeTrips = tripService.subscribe(() => { scheduleRerender(false); });
  const unsubscribeClients = clientService.subscribe(() => { scheduleRerender(false); });

  window.addEventListener('beforeunload', () => {
    window.clearInterval(clockTimer);
    window.clearInterval(dataRefreshTimer);
    window.clearInterval(weatherTimer);
    window.removeEventListener('focus', onFocus);
    if (renderTimer) window.clearTimeout(renderTimer);
    unsubscribeBookings();
    unsubscribePayments();
    unsubscribeFleet();
    unsubscribeTrips();
    unsubscribeClients();
    notificationUnsubscribe?.();
    destroyDashboardCharts();
  });

  scheduleRerender(true, true);
}

init().catch((error) => {
  console.error('Errore dashboard', error);
  showDashboardMessage(error.message || 'Errore caricamento dashboard', 'error');
});
