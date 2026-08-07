import { bookingService } from '../../services/bookingService.js';
import { fleetService } from '../../services/fleetService.js';
import { notificationService } from '../../services/notificationService.js';
import { paymentService } from '../../services/paymentService.js';
import { quoteService } from '../../services/quoteService.js';
import { tripService } from '../../services/tripService.js';
import { applyRuntimeSettings, getCachedSettingsSync, loadImpostazioni } from '../../services/settingsService.js';
import { buildNotificationCenterModel } from '../../services/notificationCenterService.js';
import { ADMIN_ROUTES } from '../../utils/appRoutes.js';

const state = {
  filter: 'all',
  search: '',
  model: null,
  persistedNotifications: [],
  unsubscribe: null,
  unsubscribePayments: null
};

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

function formatNumber(value) {
  return new Intl.NumberFormat('it-IT').format(Number(value || 0));
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

function getSearchMatches(text, query) {
  return lower(text).includes(lower(query));
}

function getPersistedTone(notification) {
  const tone = lower(notification?.tipo);
  if (tone === 'error') return 'error';
  if (tone === 'warning') return 'warning';
  if (tone === 'success') return 'success';
  return 'info';
}

function categoryMatchesNotification(filter, notification) {
  if (filter === 'all') return true;
  const tone = getPersistedTone(notification);
  if (filter === 'errors') return tone === 'error';
  if (filter === 'messages') return tone !== 'error';
  return true;
}

function getFilteredTimeline() {
  if (!state.model) return [];
  return state.model.timeline.filter((item) => {
    const matchesCategory = state.filter === 'all' || item.categoryId === state.filter;
    const haystack = `${item.categoryLabel || ''} ${item.title || ''} ${item.text || ''} ${item.meta || ''}`;
    const matchesSearch = !state.search || getSearchMatches(haystack, state.search);
    return matchesCategory && matchesSearch;
  });
}

function getFilteredPersistedNotifications() {
  return state.persistedNotifications.filter((item) => {
    const matchesCategory = categoryMatchesNotification(state.filter, item);
    const haystack = `${item.titolo || ''} ${item.messaggio || ''} ${item.tipo || ''}`;
    const matchesSearch = !state.search || getSearchMatches(haystack, state.search);
    return matchesCategory && matchesSearch;
  });
}

function renderCategoryGrid() {
  const grid = document.getElementById('notificationCategoryGrid');
  const totalBadge = document.getElementById('notificationTotalBadge');
  const summary = document.getElementById('notificationPageSummary');
  if (!grid || !totalBadge || !summary || !state.model) return;

  totalBadge.textContent = formatNumber(state.model.totalAlerts);
  summary.textContent = state.model.totalAlerts
    ? `Aggiornato alle ${formatDateTime(state.model.updatedAt)} · ${formatNumber(state.model.totalAlerts)} alert attivi distribuiti su 7 categorie.`
    : `Aggiornato alle ${formatDateTime(state.model.updatedAt)} · nessun alert attivo.`;

  grid.innerHTML = state.model.categories.map((category) => `
    <article class="category-card ${escapeHtml(category.tone)} ${state.filter === category.id ? 'is-active' : ''}" data-category="${escapeHtml(category.id)}">
      <header>
        <strong>${escapeHtml(category.label)}</strong>
        <span class="category-count">${formatNumber(category.count)}</span>
      </header>
      <p>${escapeHtml(category.summary)}</p>
    </article>
  `).join('');

  grid.querySelectorAll('[data-category]').forEach((node) => {
    node.addEventListener('click', () => {
      state.filter = node.dataset.category || 'all';
      renderAll();
    });
  });
}

function renderFilterBar() {
  const bar = document.getElementById('notificationFilterBar');
  if (!bar || !state.model) return;

  const filters = [{ id: 'all', label: 'Tutte', count: state.model.totalAlerts }, ...state.model.categories.map((category) => ({
    id: category.id,
    label: category.label,
    count: category.count
  }))];

  bar.innerHTML = filters.map((filter) => `
    <button type="button" class="filter-pill ${state.filter === filter.id ? 'is-active' : ''}" data-filter="${escapeHtml(filter.id)}">
      ${escapeHtml(filter.label)} · ${formatNumber(filter.count)}
    </button>
  `).join('');

  bar.querySelectorAll('[data-filter]').forEach((node) => {
    node.addEventListener('click', () => {
      state.filter = node.dataset.filter || 'all';
      renderAll();
    });
  });
}

function renderTimeline() {
  const timeline = document.getElementById('notificationTimeline');
  if (!timeline) return;

  const items = getFilteredTimeline();
  if (!items.length) {
    timeline.innerHTML = '<div class="empty-state">Nessun alert corrisponde ai filtri selezionati.</div>';
    return;
  }

  timeline.innerHTML = items.map((item) => `
    <article class="timeline-item ${escapeHtml(item.tone || 'info')}">
      <div class="timeline-item__header">
        <div>
          <strong>${escapeHtml(item.title)}</strong>
          <p>${escapeHtml(item.text)}</p>
        </div>
        <a class="icon-button" href="${escapeHtml(item.href || ADMIN_ROUTES.dashboard)}">Apri modulo</a>
      </div>
      <div class="timeline-item__meta">
        <span class="meta-chip">${escapeHtml(item.categoryLabel || 'Notifica')}</span>
        <span class="meta-chip">${escapeHtml(item.meta || '-')}</span>
      </div>
    </article>
  `).join('');
}

function renderPersistedNotifications() {
  const container = document.getElementById('persistedNotificationsList');
  const meta = document.getElementById('savedNotificationsMeta');
  if (!container || !meta) return;

  const unread = state.persistedNotifications.filter((item) => !item.letto).length;
  meta.textContent = state.persistedNotifications.length
    ? `${formatNumber(unread)} non lette · ${formatNumber(state.persistedNotifications.length)} salvate`
    : 'Nessuna notifica salvata';

  const items = getFilteredPersistedNotifications();
  if (!items.length) {
    container.innerHTML = '<div class="empty-state">Nessuna notifica persistente corrisponde ai filtri selezionati.</div>';
    return;
  }

  container.innerHTML = items.map((item) => `
    <article class="saved-item ${escapeHtml(getPersistedTone(item))}">
      <div class="saved-item__header">
        <div>
          <strong>${escapeHtml(item.titolo || 'Notifica')}</strong>
          <p>${escapeHtml(item.messaggio || '')}</p>
        </div>
        <div class="saved-item__actions">
          ${item.letto ? '' : `<button type="button" class="icon-button" data-read-id="${escapeHtml(item.id)}">Segna letta</button>`}
          <button type="button" class="icon-button danger" data-delete-id="${escapeHtml(item.id)}">Elimina</button>
        </div>
      </div>
      <div class="saved-item__meta">
        <span class="meta-chip">${escapeHtml(item.tipo || 'INFO')}</span>
        <span class="meta-chip">${escapeHtml(formatDateTime(item.created_at))}</span>
      </div>
    </article>
  `).join('');

  container.querySelectorAll('[data-read-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      await notificationService.markRead(button.dataset.readId);
      await refreshNotifications();
    });
  });

  container.querySelectorAll('[data-delete-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      await notificationService.remove(button.dataset.deleteId);
      await refreshNotifications();
    });
  });
}

function renderAll() {
  renderCategoryGrid();
  renderFilterBar();
  renderTimeline();
  renderPersistedNotifications();
}

async function refreshNotifications() {
  const [tripsResult, bookingsResult, paymentsResult, fleetResult, notificationsResult, quotesResult] = await Promise.all([
    tripService.getAll(),
    bookingService.getAll(),
    paymentService.getAll(),
    fleetService.getAll(),
    notificationService.all(),
    quoteService.all({ tolerateMissingTable: true })
  ]);

  state.persistedNotifications = ensureArrayData(notificationsResult, 'notifiche');
  state.model = buildNotificationCenterModel({
    trips: ensureArrayData(tripsResult, 'viaggi'),
    bookings: ensureArrayData(bookingsResult, 'prenotazioni'),
    payments: ensureOptionalPaymentsData(paymentsResult),
    fleet: ensureArrayData(fleetResult, 'flotta'),
    notifications: state.persistedNotifications,
    quotes: ensureArrayData(quotesResult, 'preventivi'),
    settings: getCachedSettingsSync()
  });

  renderAll();
}

function bindUi() {
  document.getElementById('notificationSearch')?.addEventListener('input', (event) => {
    state.search = event.target.value || '';
    renderTimeline();
    renderPersistedNotifications();
  });

  document.getElementById('refreshNotificationsBtn')?.addEventListener('click', async () => {
    await refreshNotifications();
  });

  document.getElementById('markSavedNotificationsRead')?.addEventListener('click', async () => {
    await notificationService.markAllRead();
    await refreshNotifications();
  });

  document.getElementById('clearSavedNotifications')?.addEventListener('click', async () => {
    await notificationService.clear();
    await refreshNotifications();
  });
}

async function init() {
  const settings = await loadImpostazioni();
  if (settings.success !== false) {
    applyRuntimeSettings(settings.data);
  }

  bindUi();
  await refreshNotifications();

  state.unsubscribe = notificationService.subscribe(() => {
    refreshNotifications().catch((error) => console.error('Errore sync Notification Center', error));
  });
  state.unsubscribePayments = paymentService.subscribe(() => {
    refreshNotifications().catch((error) => console.error('Errore sync pagamenti Notification Center', error));
  });
}

window.addEventListener('beforeunload', () => {
  state.unsubscribe?.();
  state.unsubscribePayments?.();
});

init().catch((error) => {
  console.error(error);
  const timeline = document.getElementById('notificationTimeline');
  if (timeline) {
    timeline.innerHTML = `<div class="empty-state">${escapeHtml(error.message || 'Errore caricamento Notification Center')}</div>`;
  }
});

window.addEventListener('beforeunload', () => {
  if (typeof state.unsubscribe === 'function') {
    state.unsubscribe();
    state.unsubscribe = null;
  }
});
