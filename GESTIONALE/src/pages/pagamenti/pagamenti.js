import { bookingService } from '../../services/bookingService.js';
import { tripService } from '../../services/tripService.js';
import {
  PAYMENT_STATUS,
  buildBookingPaymentSummary,
  getPaymentAbsoluteAmount,
  getPaymentSignedAmount,
  paymentService
} from '../../services/paymentService.js';
import { showConfirm, showMessage as showGlobalMessage } from '../../components/messageSystem.js';
import { extractData } from '../../utils/serviceResult.js';
import { downloadXlsx } from '../../utils/xlsxExport.js';
import { ADMIN_ROUTES } from '../../utils/appRoutes.js';

const tbody = document.querySelector('#paymentsTable tbody');
const searchInput = document.getElementById('searchPayment');
const filterMetodo = document.getElementById('filterMetodo');
const filterStato = document.getElementById('filterStato');
const btnRefresh = document.getElementById('btnRefresh');
const btnPending = document.getElementById('btnPending');
const btnExportExcel = document.getElementById('btnQuickExcel');
const btnExportCsv = document.getElementById('btnExportIncassi');
const btnOpenBookings = document.getElementById('btnOpenBookings');

const statsToday = document.getElementById('todayIncome');
const statsPending = document.getElementById('pendingIncome');
const statsDeposits = document.getElementById('depositIncome');
const statsBalances = document.getElementById('balanceIncome');
const statsRefunds = document.getElementById('refundIncome');

const modal = document.getElementById('modal');
const modalTitle = document.getElementById('paymentModalTitle');
const modalBookingMeta = document.getElementById('paymentBookingMeta');
const modalPayTotal = document.getElementById('modalPayTotale');
const modalPayPaid = document.getElementById('modalPayPagato');
const modalPayResidual = document.getElementById('modalPayResiduo');
const modalPayStatus = document.getElementById('modalPayStatus');
const historyTbody = document.getElementById('paymentHistoryTbody');
const fieldBookingId = document.getElementById('bookingIdInput');
const fieldMovementId = document.getElementById('movementIdInput');
const fieldImporto = document.getElementById('importoInput');
const fieldTipo = document.getElementById('tipoSelect');
const fieldMetodo = document.getElementById('metodoSelect');
const fieldData = document.getElementById('dataInput');
const fieldNote = document.getElementById('noteInput');
const saveBtn = document.getElementById('savePayment');
const closeBtn = document.getElementById('closeModal');
const cancelEditBtn = document.getElementById('cancelPaymentEdit');
const btnQuickAcconto = document.getElementById('btnQuickAcconto');
const btnQuickSaldo = document.getElementById('btnQuickSaldo');
const btnQuickRimborso = document.getElementById('btnQuickRimborso');

let bookingsCache = [];
let tripsCache = [];
let paymentsCache = [];
let bookingRows = [];
let onlyPending = false;
let currentBookingId = '';
let unsubscribePayments = null;
let unsubscribeBookings = null;
let unsubscribeTrips = null;
let paymentsModuleUnavailableNotified = false;

function showMessage(text, type = 'info') {
  showGlobalMessage({
    type: type === 'error' ? 'error' : 'info',
    title: type === 'error' ? 'Errore' : 'Pagamenti',
    message: String(text || '')
  });
}

function toAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(toAmount(value));
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('it-IT');
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getTripLabel(booking) {
  const tripId = String(booking?.viaggio_id || booking?.tratta_id || '');
  const trip = tripsCache.find((item) => String(item.id) === tripId);
  return trip?.codice || trip?.titolo || trip?.destinazione || booking?.viaggio_codice || tripId || 'Viaggio';
}

function getBookingDate(booking) {
  return booking?.data || booking?.data_prenotazione || booking?.created_at || null;
}

function isCancelledStatus(status) {
  return String(status || '').trim().toLowerCase() === 'annullata';
}

function isPaymentsModuleUnavailableError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('modulo pagamenti non disponibile') || message.includes('public.pagamenti');
}

function buildRows() {
  const paymentMap = new Map();
  paymentsCache.forEach((payment) => {
    const bookingId = String(payment?.prenotazione_id || '');
    if (!bookingId) return;
    if (!paymentMap.has(bookingId)) paymentMap.set(bookingId, []);
    paymentMap.get(bookingId).push(payment);
  });

  bookingRows = bookingsCache
    .filter((booking) => !isCancelledStatus(booking?.stato))
    .map((booking) => {
      const payments = paymentMap.get(String(booking.id || '')) || [];
      const summary = buildBookingPaymentSummary(booking, payments);
      return {
        booking,
        payments,
        summary,
        tripLabel: getTripLabel(booking)
      };
    })
    .sort((left, right) => new Date(getBookingDate(right.booking) || 0).getTime() - new Date(getBookingDate(left.booking) || 0).getTime());
}

function statusBadgeClass(status) {
  if (status === PAYMENT_STATUS.paid) return 'status-paid';
  if (status === PAYMENT_STATUS.partial) return 'status-partial';
  if (status === PAYMENT_STATUS.refunded) return 'status-refunded';
  return 'status-pending';
}

function movementBadgeClass(type) {
  if (type === 'Saldo') return 'movement-badge movement-badge--saldo';
  if (type === 'Rimborso') return 'movement-badge movement-badge--refund';
  if (type === 'Acconto') return 'movement-badge movement-badge--deposit';
  return 'movement-badge movement-badge--other';
}

function filterRows() {
  const term = String(searchInput?.value || '').trim().toLowerCase();
  const method = String(filterMetodo?.value || '').trim().toLowerCase();
  const status = String(filterStato?.value || '').trim();

  return bookingRows.filter((row) => {
    const searchable = `${row.booking?.codice || ''} ${row.booking?.cliente_nome || row.booking?.cliente || ''} ${row.tripLabel} ${row.summary.latestMethod || ''}`.toLowerCase();
    if (term && !searchable.includes(term)) return false;
    if (method && String(row.summary.latestMethod || '').toLowerCase() !== method) return false;
    if (status && row.summary.status !== status) return false;
    if (onlyPending && row.summary.residual <= 0) return false;
    return true;
  });
}

function renderRow(row) {
  const { booking, summary, tripLabel } = row;
  const latestType = summary.latestMovement?.tipo || 'Nessun movimento';
  const latestDate = summary.lastPaymentAt ? formatDate(summary.lastPaymentAt) : '-';

  return `
    <tr data-booking-id="${booking.id}">
      <td>${escapeHtml(booking.codice || String(booking.id || '').slice(0, 8))}</td>
      <td>
        <strong>${escapeHtml(booking.cliente_nome || booking.cliente || 'Cliente')}</strong>
        <small>${escapeHtml(booking.telefono || booking.cliente_telefono || '')}</small>
      </td>
      <td>${escapeHtml(tripLabel)}</td>
      <td>${formatCurrency(summary.totalDue)}</td>
      <td>${formatCurrency(summary.paidNet)}</td>
      <td>${formatCurrency(summary.residual)}</td>
      <td><span class="status-badge ${statusBadgeClass(summary.status)}">${summary.status}</span></td>
      <td>${escapeHtml(summary.latestMethod || '-')}</td>
      <td>${escapeHtml(latestType)}</td>
      <td>${latestDate}</td>
      <td>
        <div class="table-actions">
          <button type="button" class="openLedgerBtn">Apri</button>
          <button type="button" class="quickDepositBtn btn-secondary">Acconto</button>
          <button type="button" class="quickBalanceBtn btn-secondary">Saldo</button>
          <button type="button" class="quickRefundBtn btn-secondary">Rimborso</button>
        </div>
      </td>
    </tr>
  `;
}

function updateStats() {
  const today = new Date().toISOString().slice(0, 10);
  const incassoOggi = paymentsCache
    .filter((payment) => String(payment.data_pagamento || '').slice(0, 10) === today)
    .reduce((sum, payment) => sum + getPaymentSignedAmount(payment), 0);
  const daIncassare = bookingRows.reduce((sum, row) => sum + row.summary.residual, 0);
  const acconti = paymentsCache
    .filter((payment) => payment.tipo === 'Acconto')
    .reduce((sum, payment) => sum + getPaymentAbsoluteAmount(payment), 0);
  const saldi = paymentsCache
    .filter((payment) => payment.tipo === 'Saldo')
    .reduce((sum, payment) => sum + getPaymentAbsoluteAmount(payment), 0);
  const rimborsi = paymentsCache
    .filter((payment) => payment.tipo === 'Rimborso')
    .reduce((sum, payment) => sum + getPaymentAbsoluteAmount(payment), 0);

  if (statsToday) statsToday.textContent = formatCurrency(incassoOggi);
  if (statsPending) statsPending.textContent = formatCurrency(daIncassare);
  if (statsDeposits) statsDeposits.textContent = formatCurrency(acconti);
  if (statsBalances) statsBalances.textContent = formatCurrency(saldi);
  if (statsRefunds) statsRefunds.textContent = formatCurrency(rimborsi);
}

function resetPaymentForm() {
  if (fieldMovementId) fieldMovementId.value = '';
  if (fieldImporto) fieldImporto.value = '';
  if (fieldTipo) fieldTipo.value = 'Acconto';
  if (fieldMetodo) fieldMetodo.value = 'Contanti';
  if (fieldData) fieldData.value = new Date().toISOString().slice(0, 10);
  if (fieldNote) fieldNote.value = '';
  if (saveBtn) saveBtn.textContent = 'Salva movimento';
  cancelEditBtn?.classList.add('hidden');
}

function suggestAmount(type, summary) {
  if (!fieldImporto) return;
  if (type === 'Saldo') {
    fieldImporto.value = summary.residual > 0 ? summary.residual.toFixed(2) : '';
    return;
  }
  if (type === 'Rimborso') {
    fieldImporto.value = summary.paidNet > 0 ? summary.paidNet.toFixed(2) : '';
  }
}

function renderMovementRow(payment) {
  const amount = getPaymentSignedAmount(payment);
  const amountPrefix = amount < 0 ? '-' : '+';
  return `
    <tr data-movement-id="${payment.id}">
      <td>${formatDate(payment.data_pagamento || payment.created_at)}</td>
      <td>${escapeHtml(payment.ricevuta || '-')}</td>
      <td><span class="${movementBadgeClass(payment.tipo)}">${escapeHtml(payment.tipo || 'Acconto')}</span></td>
      <td class="${amount < 0 ? 'amount-negative' : 'amount-positive'}">${amountPrefix}${formatCurrency(Math.abs(amount))}</td>
      <td>${escapeHtml(payment.metodo_pagamento || payment.metodo || '-')}</td>
      <td>${escapeHtml(payment.note || '')}</td>
      <td>
        <div class="table-actions">
          <button type="button" class="editMovementBtn btn-secondary">Modifica</button>
          <button type="button" class="deleteMovementBtn">Elimina</button>
        </div>
      </td>
    </tr>
  `;
}

function renderHistory(bookingRow) {
  if (!historyTbody) return;
  historyTbody.innerHTML = bookingRow.payments.length
    ? bookingRow.payments.map(renderMovementRow).join('')
    : '<tr><td colspan="7" class="empty-state">Nessun movimento registrato</td></tr>';

  historyTbody.querySelectorAll('.editMovementBtn').forEach((button) => {
    button.addEventListener('click', () => {
      const movementId = button.closest('tr')?.dataset?.movementId;
      const movement = bookingRow.payments.find((item) => item.id === movementId);
      if (!movement) return;
      if (fieldMovementId) fieldMovementId.value = movement.id;
      if (fieldImporto) fieldImporto.value = getPaymentAbsoluteAmount(movement).toFixed(2);
      if (fieldTipo) fieldTipo.value = movement.tipo || 'Acconto';
      if (fieldMetodo) fieldMetodo.value = movement.metodo_pagamento || movement.metodo || 'Contanti';
      if (fieldData) fieldData.value = String(movement.data_pagamento || '').slice(0, 10);
      if (fieldNote) fieldNote.value = movement.note || '';
      if (saveBtn) saveBtn.textContent = 'Aggiorna movimento';
      cancelEditBtn?.classList.remove('hidden');
    });
  });

  historyTbody.querySelectorAll('.deleteMovementBtn').forEach((button) => {
    button.addEventListener('click', async () => {
      const movementId = button.closest('tr')?.dataset?.movementId;
      if (!movementId) return;
      const confirmed = await showConfirm({
        title: 'Elimina pagamento',
        message: 'Confermi l\'eliminazione del movimento selezionato?',
        confirmText: 'Elimina',
        cancelText: 'Annulla'
      });
      if (!confirmed) return;
      try {
        extractData(await paymentService.delete(movementId), null);
        showMessage('Movimento eliminato', 'info');
        await load();
        openModal(currentBookingId);
      } catch (error) {
        showMessage(error.message || 'Errore eliminazione movimento', 'error');
      }
    });
  });
}

function updateModalSummary(bookingRow) {
  if (!bookingRow) return;
  const { booking, summary, tripLabel } = bookingRow;
  if (modalTitle) modalTitle.textContent = `Pagamenti ${booking.codice || String(booking.id || '').slice(0, 8)}`;
  if (modalBookingMeta) {
    modalBookingMeta.textContent = `${booking.cliente_nome || booking.cliente || 'Cliente'} • ${tripLabel}`;
  }
  if (modalPayTotal) modalPayTotal.textContent = formatCurrency(summary.totalDue);
  if (modalPayPaid) modalPayPaid.textContent = formatCurrency(summary.paidNet);
  if (modalPayResidual) modalPayResidual.textContent = formatCurrency(summary.residual);
  if (modalPayStatus) modalPayStatus.innerHTML = `<span class="status-badge ${statusBadgeClass(summary.status)}">${summary.status}</span>`;
}

function openModal(bookingId, presetType = null) {
  const bookingRow = bookingRows.find((row) => String(row.booking.id) === String(bookingId));
  if (!bookingRow || !modal) return;
  currentBookingId = String(bookingRow.booking.id);
  if (fieldBookingId) fieldBookingId.value = currentBookingId;
  resetPaymentForm();
  updateModalSummary(bookingRow);
  renderHistory(bookingRow);
  modal.style.display = 'flex';
  if (presetType && fieldTipo) {
    fieldTipo.value = presetType;
    suggestAmount(presetType, bookingRow.summary);
  }
}

function closeModal() {
  if (!modal) return;
  modal.style.display = 'none';
  currentBookingId = '';
}

function attachTableEvents() {
  tbody.querySelectorAll('.openLedgerBtn').forEach((button) => {
    button.addEventListener('click', () => openModal(button.closest('tr')?.dataset?.bookingId));
  });
  tbody.querySelectorAll('.quickDepositBtn').forEach((button) => {
    button.addEventListener('click', () => openModal(button.closest('tr')?.dataset?.bookingId, 'Acconto'));
  });
  tbody.querySelectorAll('.quickBalanceBtn').forEach((button) => {
    button.addEventListener('click', () => openModal(button.closest('tr')?.dataset?.bookingId, 'Saldo'));
  });
  tbody.querySelectorAll('.quickRefundBtn').forEach((button) => {
    button.addEventListener('click', () => openModal(button.closest('tr')?.dataset?.bookingId, 'Rimborso'));
  });
}

function renderTable() {
  const filtered = filterRows();
  tbody.innerHTML = filtered.length
    ? filtered.map(renderRow).join('')
    : '<tr><td colspan="11" class="empty-state">Nessuna prenotazione corrisponde ai filtri selezionati.</td></tr>';
  attachTableEvents(filtered);
}

async function load() {
  bookingsCache = extractData(await bookingService.getAll(), []);
  tripsCache = extractData(await tripService.getAll(), []);
  const paymentsResult = await paymentService.getAll();
  if (paymentsResult?.success === false) {
    if (!isPaymentsModuleUnavailableError(paymentsResult.error)) throw paymentsResult.error;
    paymentsCache = [];
    if (!paymentsModuleUnavailableNotified) {
      showMessage('Modulo pagamenti non ancora disponibile su Supabase live: vista in sola consultazione prenotazioni.', 'info');
      paymentsModuleUnavailableNotified = true;
    }
  } else {
    paymentsCache = Array.isArray(paymentsResult?.data) ? paymentsResult.data : [];
  }
  buildRows();
  updateStats();
  renderTable();
  if (modal?.style.display === 'flex' && currentBookingId) {
    openModal(currentBookingId);
  }
}

async function saveMovement() {
  const bookingId = fieldBookingId?.value || '';
  const movementId = fieldMovementId?.value || '';
  const amount = toAmount(fieldImporto?.value);
  const type = fieldTipo?.value || 'Acconto';

  if (!bookingId) throw new Error('Prenotazione non selezionata.');
  if (amount <= 0) throw new Error('Inserisci un importo valido.');

  const bookingRow = bookingRows.find((row) => String(row.booking.id) === String(bookingId));
  if (!bookingRow) throw new Error('Prenotazione non trovata.');

  const payload = {
    prenotazione_id: bookingId,
    viaggio_id: bookingRow.booking.viaggio_id || bookingRow.booking.tratta_id || null,
    cliente: bookingRow.booking.cliente_nome || bookingRow.booking.cliente || '',
    viaggio: bookingRow.tripLabel,
    importo: amount,
    tipo: type,
    metodo_pagamento: fieldMetodo?.value || 'Contanti',
    data_pagamento: fieldData?.value || new Date().toISOString().slice(0, 10),
    note: fieldNote?.value?.trim() || ''
  };

  if (movementId) {
    extractData(await paymentService.update(movementId, payload), null);
  } else {
    extractData(await paymentService.aggiungiPagamento(bookingId, payload), null);
  }
}

function exportCsv(rows) {
  const header = ['Prenotazione', 'Cliente', 'Viaggio', 'Totale', 'Incassato', 'Residuo', 'Stato', 'Ultimo metodo'];
  const lines = [header.join(',')];
  rows.forEach(({ booking, summary, tripLabel }) => {
    const values = [
      booking.codice || booking.id || '',
      booking.cliente_nome || booking.cliente || '',
      tripLabel,
      summary.totalDue.toFixed(2),
      summary.paidNet.toFixed(2),
      summary.residual.toFixed(2),
      summary.status,
      summary.latestMethod || ''
    ];
    lines.push(values.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'pagamenti-prenotazioni.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function bindUi() {
  searchInput?.addEventListener('input', renderTable);
  filterMetodo?.addEventListener('change', renderTable);
  filterStato?.addEventListener('change', renderTable);
  btnRefresh?.addEventListener('click', () => {
    load().then(() => showMessage('Modulo pagamenti aggiornato', 'info')).catch((error) => showMessage(error.message || 'Errore refresh pagamenti', 'error'));
  });
  btnPending?.addEventListener('click', () => {
    onlyPending = !onlyPending;
    btnPending.classList.toggle('is-active', onlyPending);
    renderTable();
  });
  btnOpenBookings?.addEventListener('click', () => {
    window.location.href = ADMIN_ROUTES.prenotazioni;
  });
  btnExportExcel?.addEventListener('click', () => {
    const rows = filterRows().map(({ booking, summary, tripLabel }) => ({
      Prenotazione: booking.codice || booking.id || '',
      Cliente: booking.cliente_nome || booking.cliente || '',
      Viaggio: tripLabel,
      Totale: summary.totalDue,
      Incassato: summary.paidNet,
      Residuo: summary.residual,
      Stato: summary.status,
      Metodo: summary.latestMethod || ''
    }));
    downloadXlsx(rows, 'Pagamenti', 'pagamenti-enterprise.xlsx');
    showMessage('Export Excel completato', 'info');
  });
  btnExportCsv?.addEventListener('click', () => {
    exportCsv(filterRows());
    showMessage('Export CSV completato', 'info');
  });
  closeBtn?.addEventListener('click', closeModal);
  cancelEditBtn?.addEventListener('click', resetPaymentForm);
  fieldTipo?.addEventListener('change', () => {
    const bookingRow = bookingRows.find((row) => String(row.booking.id) === String(fieldBookingId?.value || ''));
    if (bookingRow) suggestAmount(fieldTipo.value, bookingRow.summary);
  });
  btnQuickAcconto?.addEventListener('click', () => {
    fieldTipo.value = 'Acconto';
    resetPaymentForm();
  });
  btnQuickSaldo?.addEventListener('click', () => {
    const bookingRow = bookingRows.find((row) => String(row.booking.id) === String(fieldBookingId?.value || ''));
    if (!bookingRow) return;
    resetPaymentForm();
    fieldTipo.value = 'Saldo';
    suggestAmount('Saldo', bookingRow.summary);
  });
  btnQuickRimborso?.addEventListener('click', () => {
    const bookingRow = bookingRows.find((row) => String(row.booking.id) === String(fieldBookingId?.value || ''));
    if (!bookingRow) return;
    resetPaymentForm();
    fieldTipo.value = 'Rimborso';
    suggestAmount('Rimborso', bookingRow.summary);
  });
  saveBtn?.addEventListener('click', async () => {
    try {
      await saveMovement();
      showMessage(fieldMovementId?.value ? 'Movimento aggiornato' : 'Movimento registrato', 'info');
      await load();
      openModal(fieldBookingId?.value || currentBookingId);
      resetPaymentForm();
    } catch (error) {
      showMessage(error.message || 'Errore salvataggio movimento', 'error');
    }
  });
  modal?.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });
}

async function init() {
  bindUi();
  await load();
  unsubscribePayments = paymentService.subscribe(() => {
    load().catch((error) => showMessage(error.message || 'Errore sync pagamenti', 'error'));
  });
  unsubscribeBookings = bookingService.subscribe(() => {
    load().catch((error) => showMessage(error.message || 'Errore sync prenotazioni', 'error'));
  });
  unsubscribeTrips = tripService.subscribe(() => {
    load().catch((error) => showMessage(error.message || 'Errore sync viaggi', 'error'));
  });
}

window.addEventListener('beforeunload', () => {
  if (typeof unsubscribePayments === 'function') unsubscribePayments();
  if (typeof unsubscribeBookings === 'function') unsubscribeBookings();
  if (typeof unsubscribeTrips === 'function') unsubscribeTrips();
});

init().catch((error) => {
  showMessage(error.message || 'Errore inizializzazione pagamenti', 'error');
});
