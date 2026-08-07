import { clientService } from '../../services/clientService.js';
import { bookingService } from '../../services/bookingService.js';
import { tripService } from '../../services/tripService.js';
import { paymentService } from '../../services/paymentService.js';
import { extractData } from '../../utils/serviceResult.js';
import { downloadXlsx } from '../../utils/xlsxExport.js';
import { showConfirm, showMessage as showGlobalMessage } from '../../components/messageSystem.js';
import { bookingMatchesClient, getClientFullName, normalizeClientIdentity } from '../../utils/clientIdentity.js';

const tbody = document.querySelector('#clientiTable tbody');
const btnNew = document.getElementById('newCustomer');
const search = document.getElementById('search');
const filterStateEl = document.getElementById('filterState');
const filterTripsEl = document.getElementById('filterTrips');
const filterCityEl = document.getElementById('filterCity');
const filterSpentMinEl = document.getElementById('filterSpentMin');
const exportCsvBtn = document.getElementById('exportCsv');
const exportXlsxBtn = document.getElementById('exportXlsx');

let modalEl = null;
let currentList = [];
let filteredList = [];
let allBookings = [];
let allTrips = [];
let allPayments = [];
let statsByClient = new Map();
let unsubscribeClienti = null;
let unsubscribePrenotazioni = null;
let unsubscribeViaggi = null;
let unsubscribePagamenti = null;
let paymentsModuleUnavailableNotified = false;

function showMessage(message, type = 'info') {
  showGlobalMessage({
    type: type === 'error' ? 'error' : 'info',
    title: type === 'error' ? 'Errore' : 'Clienti',
    message: String(message || '')
  });
}

function formatName(cliente) {
  return `${cliente.nome || ''} ${cliente.cognome || ''}`.trim();
}

function formatCurrency(value) {
  const amount = Number(value || 0);
  return `€ ${amount.toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function getClientCode(cliente, index = 0) {
  if (cliente.codice_cliente) return cliente.codice_cliente;
  if (cliente.codice) return cliente.codice;
  if (cliente.cf || cliente.codice_fiscale) return String(cliente.cf || cliente.codice_fiscale).toUpperCase().slice(0, 10);
  const year = new Date(cliente.created_at || Date.now()).getFullYear();
  return `CL-${year}-${String(index + 1).padStart(4, '0')}`;
}

function isPaymentsModuleUnavailableError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('modulo pagamenti non disponibile')
    || message.includes('public.pagamenti');
}

function mapByClient(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const key = normalizeClientIdentity(row.cliente);
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  });
  return map;
}

function mapBookingsByClient(rows, clienti) {
  const map = new Map();
  (clienti || []).forEach((cliente) => {
    map.set(cliente.id, (rows || []).filter((row) => bookingMatchesClient(row, cliente)));
  });
  return map;
}

function enrichStats(clienti) {
  const bookingsMap = mapBookingsByClient(allBookings, clienti);
  const paymentsByBookingId = new Map();
  (allPayments || []).forEach((payment) => {
    const bookingId = String(payment?.prenotazione_id || '').trim();
    if (!bookingId) return;
    if (!paymentsByBookingId.has(bookingId)) paymentsByBookingId.set(bookingId, []);
    paymentsByBookingId.get(bookingId).push(payment);
  });
  const paymentsMap = mapByClient(allPayments);
  const tripsById = new Map(allTrips.map((trip) => [String(trip.id), trip]));
  statsByClient = new Map();

  clienti.forEach((cliente, index) => {
    const bookings = bookingsMap.get(cliente.id) || [];
    const trips = bookings
      .map((booking) => tripsById.get(String(booking.viaggio_id || booking.tratta_id || '')))
      .filter(Boolean);
    const bookingPayments = bookings.flatMap((booking) => paymentsByBookingId.get(String(booking.id || '')) || []);
    const legacyPayments = paymentsMap.get(normalizeClientIdentity(getClientFullName(cliente))) || [];
    const payments = bookingPayments.length ? bookingPayments : legacyPayments;
    const totalSpent = payments.reduce((sum, item) => sum + Number(item.importo ?? item.totale ?? 0), 0);
    const lastTrip = trips
      .slice()
      .sort((a, b) => new Date(b.data_partenza || 0) - new Date(a.data_partenza || 0))[0];

    statsByClient.set(cliente.id, {
      code: getClientCode(cliente, index),
      bookings,
      trips,
      payments,
      totalBookings: bookings.length,
      totalTrips: trips.length,
      totalSpent,
      lastTripLabel: lastTrip ? `${lastTrip.destinazione || '-'} (${formatDate(lastTrip.data_partenza)})` : '-'
    });
  });
}

async function load() {
  try {
    const [clienti, prenotazioni, viaggi] = await Promise.all([
      clientService.getAll(),
      bookingService.getAll(),
      tripService.getAll()
    ]);
    const pagamenti = await paymentService.getAll();
    currentList = extractData(clienti, []).slice();
    allBookings = extractData(prenotazioni, []).slice();
    allTrips = extractData(viaggi, []).slice();
    if (pagamenti?.success === false) {
      if (!isPaymentsModuleUnavailableError(pagamenti.error)) throw pagamenti.error;
      allPayments = [];
      if (!paymentsModuleUnavailableNotified) {
        showMessage('Modulo pagamenti non disponibile su schema Supabase live: totale speso calcolato senza movimenti pagamenti.', 'info');
        paymentsModuleUnavailableNotified = true;
      }
    } else {
      allPayments = extractData(pagamenti, []).slice();
    }
    enrichStats(currentList);
    applySearchAndFilters();
    renderStats(filteredList);
  } catch (error) {
    console.error(error);
    showMessage(error.message || 'Errore caricamento clienti', 'error');
  }
}

function renderTable(list) {
  tbody.innerHTML = list.map((cliente) => {
    const summary = statsByClient.get(cliente.id) || {};
    return `<tr data-id="${cliente.id}">
<td>${summary.code || ''}</td>
<td>${formatName(cliente)}</td>
<td>${cliente.telefono || ''}</td>
<td>${cliente.email || ''}</td>
<td>${cliente.comune || cliente.citta || ''}</td>
<td>${summary.lastTripLabel || '-'}</td>
<td>${summary.totalTrips || 0}</td>
<td>${summary.totalBookings || 0}</td>
<td>${summary.bookings?.length || 0}</td>
<td>${formatCurrency(summary.totalSpent || 0)}</td>
<td><button class="openBtn">Apri</button> <button class="delBtn">Elimina</button></td>
</tr>`;
  }).join('');
  attachEvents();
}

function renderStats(list) {
  const total = list.length;
  const totalEl = document.getElementById('totClienti');
  if (totalEl) totalEl.textContent = String(total);
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const newMonth = list.filter((cliente) => {
    const date = new Date(cliente.created_at || cliente.updated_at || 0);
    return date.getMonth() === month && date.getFullYear() === year;
  }).length;
  const newMonthEl = document.getElementById('newMonth');
  if (newMonthEl) newMonthEl.textContent = String(newMonth);
  const vipCount = list.filter((cliente) => (statsByClient.get(cliente.id)?.totalSpent || 0) >= 1000).length;
  const vipEl = document.getElementById('vip');
  if (vipEl) vipEl.textContent = String(vipCount);
}

function normalizeText(text) {
  return String(text || '').toLowerCase().trim();
}

function applySearchAndFilters() {
  const query = normalizeText(search?.value);
  const state = normalizeText(filterStateEl?.value);
  const tripsFilter = filterTripsEl?.value || '';
  const cityFilter = normalizeText(filterCityEl?.value);
  const minSpent = Number(filterSpentMinEl?.value || 0);

  filteredList = currentList.filter((cliente) => {
    const summary = statsByClient.get(cliente.id) || {};
    const searchable = [
      formatName(cliente),
      cliente.telefono,
      cliente.email,
      cliente.comune,
      cliente.citta,
      cliente.codice_fiscale,
      cliente.cf,
      summary.code
    ].map(normalizeText).join(' ');
    if (query && !searchable.includes(query)) return false;
    if (state && normalizeText(cliente.stato_cliente || 'Attivo') !== state) return false;
    if (cityFilter) {
      const city = normalizeText(cliente.comune || cliente.citta);
      if (!city.includes(cityFilter)) return false;
    }
    if (tripsFilter === 'withTrips' && (summary.totalTrips || 0) <= 0) return false;
    if (tripsFilter === 'withoutTrips' && (summary.totalTrips || 0) > 0) return false;
    if (Number.isFinite(minSpent) && minSpent > 0 && (summary.totalSpent || 0) < minSpent) return false;
    return true;
  });

  renderTable(filteredList);
  renderStats(filteredList);
}

function attachEvents() {
  document.querySelectorAll('.delBtn').forEach((button) => {
    button.onclick = async (event) => {
      const id = event.target.closest('tr').dataset.id;
      try {
        const confirmed = await showConfirm({
          title: 'Elimina cliente',
          message: 'Confermi l\'eliminazione del cliente selezionato?',
          confirmText: 'Elimina',
          cancelText: 'Annulla'
        });
        if (!confirmed) return;
        extractData(await clientService.delete(id), null);
        showMessage('Cliente eliminato con successo', 'info');
        await load();
      } catch (error) {
        console.error('Errore eliminazione cliente', error);
        showMessage(error.message || 'Errore eliminazione cliente', 'error');
      }
    };
  });

  document.querySelectorAll('.openBtn').forEach((button) => {
    button.onclick = async (event) => {
      const id = event.target.closest('tr').dataset.id;
      try {
        const cliente = extractData(await clientService.getById(id), null);
        openClientModal(cliente);
      } catch (error) {
        showMessage(error.message || 'Errore apertura cliente', 'error');
      }
    };
  });
}

function buildHistoryList(items = [], formatter) {
  if (!items.length) return '<li>Nessun dato disponibile</li>';
  return items.map((item) => `<li>${formatter(item)}</li>`).join('');
}

async function loadClientHistory(id) {
  const storicoResult = await clientService.getStorico(id);
  const storico = extractData(storicoResult, { prenotazioni: [], viaggi: [], pagamenti: [] });
  const totalSpent = (storico.pagamenti || []).reduce((sum, payment) => sum + Number(payment.importo ?? payment.totale ?? 0), 0);
  return { storico, totalSpent };
}

function buildClientModal() {
  if (modalEl) return modalEl;
  modalEl = document.createElement('div');
  modalEl.className = 'modal client-modal';
  modalEl.innerHTML = `
    <div class="content">
      <h2>Cliente</h2>
      <input id="cli_id" type="hidden">
      <label for="cli_codice_cliente">Codice Cliente</label><input id="cli_codice_cliente" readonly aria-label="Codice Cliente" />
      <label for="cli_nome">Nome</label><input id="cli_nome" aria-label="Nome" />
      <label for="cli_cognome">Cognome</label><input id="cli_cognome" aria-label="Cognome" />
      <label for="cli_telefono">Telefono</label><input id="cli_telefono" aria-label="Telefono" />
      <label for="cli_email">Email</label><input id="cli_email" aria-label="Email" />
      <label for="cli_cf">Codice Fiscale</label><input id="cli_cf" aria-label="Codice Fiscale" />
      <label for="cli_data">Data Nascita</label><input id="cli_data" type="date" aria-label="Data Nascita" />
      <label for="cli_comune">Comune</label><input id="cli_comune" aria-label="Comune" />
      <label for="cli_provincia">Provincia</label><input id="cli_provincia" aria-label="Provincia" />
      <label for="cli_indirizzo">Indirizzo</label><input id="cli_indirizzo" aria-label="Indirizzo" />
      <label for="cli_cap">CAP</label><input id="cli_cap" aria-label="CAP" />
      <label for="cli_stato">Stato Cliente</label>
      <select id="cli_stato" aria-label="Stato Cliente">
        <option value="">-- Seleziona --</option>
        <option value="Attivo">Attivo</option>
        <option value="Inattivo">Inattivo</option>
      </select>
      <label for="cli_provenienza">Provenienza</label><input id="cli_provenienza" aria-label="Provenienza" />
      <label for="cli_note">Note</label><textarea id="cli_note" aria-label="Note"></textarea>
      <div class="history-box">
        <h3>Storico Viaggi</h3>
        <ul id="cli_storico_viaggi"></ul>
        <h3>Storico Prenotazioni</h3>
        <ul id="cli_storico_prenotazioni"></ul>
        <p><strong>Totale Speso:</strong> <span id="cli_totale_speso">€ 0.00</span></p>
      </div>
      <div class="actions"><button id="cli_save">Salva</button> <button id="cli_close">Chiudi</button></div>
    </div>
  `;
  document.body.appendChild(modalEl);
  modalEl.querySelector('#cli_close').onclick = () => { modalEl.style.display = 'none'; };
  modalEl.querySelector('#cli_save').onclick = async () => {
    const isEditing = Boolean(modalEl.querySelector('#cli_id').value);
    const code = modalEl.querySelector('#cli_codice_cliente').value;
    const payload = {
      id: isEditing ? modalEl.querySelector('#cli_id').value : undefined,
      codice_cliente: code || undefined,
      nome: modalEl.querySelector('#cli_nome').value.trim(),
      cognome: modalEl.querySelector('#cli_cognome').value.trim(),
      telefono: modalEl.querySelector('#cli_telefono').value.trim(),
      email: modalEl.querySelector('#cli_email').value.trim(),
      codice_fiscale: modalEl.querySelector('#cli_cf').value.trim(),
      data_nascita: modalEl.querySelector('#cli_data').value || null,
      comune: modalEl.querySelector('#cli_comune').value.trim(),
      provincia: modalEl.querySelector('#cli_provincia').value.trim(),
      indirizzo: modalEl.querySelector('#cli_indirizzo').value.trim(),
      cap: modalEl.querySelector('#cli_cap').value.trim(),
      stato_cliente: modalEl.querySelector('#cli_stato').value || 'Attivo',
      provenienza: modalEl.querySelector('#cli_provenienza').value.trim(),
      note: modalEl.querySelector('#cli_note').value.trim(),
      updated_at: new Date().toISOString(),
      ...(isEditing ? {} : { created_at: new Date().toISOString() })
    };
    if (!payload.nome) { showMessage('Nome obbligatorio', 'error'); return; }
    if (!payload.cognome) { showMessage('Cognome obbligatorio', 'error'); return; }
    if (!payload.telefono) { showMessage('Telefono obbligatorio', 'error'); return; }
    if (payload.email && !/^\S+@\S+\.\S+$/.test(payload.email)) { showMessage('Email non valida', 'error'); return; }
    if (!/^\+?[0-9 \-]{6,20}$/.test(payload.telefono)) { showMessage('Telefono non valido', 'error'); return; }
    if (payload.cap && !/^\d{2,10}$/.test(payload.cap)) { showMessage('CAP non valido', 'error'); return; }
    if (payload.codice_fiscale && !/^[A-Z0-9]{11,16}$/i.test(payload.codice_fiscale)) { showMessage('Codice fiscale non valido', 'error'); return; }

    try {
      const all = extractData(await clientService.getAll(), []);
      const existsEmail = all.find((x) => x.email && payload.email && x.email.toLowerCase() === payload.email.toLowerCase() && x.id !== payload.id);
      if (existsEmail) { showMessage('Esiste già un cliente con questa email', 'error'); return; }
      const existsCF = all.find((x) => (x.codice_fiscale || x.cf) && payload.codice_fiscale && ((x.codice_fiscale || x.cf).toLowerCase() === payload.codice_fiscale.toLowerCase()) && x.id !== payload.id);
      if (existsCF) { showMessage('Esiste già un cliente con questo codice fiscale', 'error'); return; }

      if (payload.id) extractData(await clientService.update(payload.id, payload), null);
      else extractData(await clientService.create(payload), null);
      showMessage(payload.id ? 'Cliente aggiornato con successo' : 'Cliente creato con successo', 'info');
      modalEl.style.display = 'none';
      await load();
    } catch (error) {
      console.error('Errore salvataggio cliente', error);
      showMessage(error.message || 'Errore salvataggio cliente', 'error');
    }
  };
  return modalEl;
}

async function openClientModal(cliente) {
  const modal = buildClientModal();
  modal.style.display = 'flex';
  modal.querySelector('#cli_id').value = cliente?.id || '';
  modal.querySelector('#cli_codice_cliente').value = cliente ? (statsByClient.get(cliente.id)?.code || getClientCode(cliente)) : getClientCode({ created_at: new Date().toISOString() }, currentList.length);
  modal.querySelector('#cli_nome').value = cliente?.nome || '';
  modal.querySelector('#cli_cognome').value = cliente?.cognome || '';
  modal.querySelector('#cli_telefono').value = cliente?.telefono || '';
  modal.querySelector('#cli_email').value = cliente?.email || '';
  modal.querySelector('#cli_cf').value = cliente?.codice_fiscale || cliente?.cf || '';
  modal.querySelector('#cli_data').value = cliente?.data_nascita || '';
  modal.querySelector('#cli_comune').value = cliente?.comune || cliente?.citta || '';
  modal.querySelector('#cli_provincia').value = cliente?.provincia || '';
  modal.querySelector('#cli_indirizzo').value = cliente?.indirizzo || '';
  modal.querySelector('#cli_cap').value = cliente?.cap || '';
  modal.querySelector('#cli_stato').value = cliente?.stato_cliente || '';
  modal.querySelector('#cli_provenienza').value = cliente?.provenienza || '';
  modal.querySelector('#cli_note').value = cliente?.note || '';

  const tripsListEl = modal.querySelector('#cli_storico_viaggi');
  const bookingsListEl = modal.querySelector('#cli_storico_prenotazioni');
  const totalSpentEl = modal.querySelector('#cli_totale_speso');

  if (!cliente?.id) {
    tripsListEl.innerHTML = '<li>Nessun dato disponibile</li>';
    bookingsListEl.innerHTML = '<li>Nessun dato disponibile</li>';
    totalSpentEl.textContent = '€ 0.00';
    return;
  }

  try {
    const { storico, totalSpent } = await loadClientHistory(cliente.id);
    tripsListEl.innerHTML = buildHistoryList(storico.viaggi, (trip) => {
      const tripCode = trip.codice || trip.codice_viaggio || trip.numero_viaggio || '';
      const tripDestination = trip.destinazione || trip.titolo || '-';
      const tripDate = formatDate(trip.data_partenza || trip.data_servizio) || '-';
      return tripCode ? `${tripCode} - ${tripDestination} (${tripDate})` : `${tripDestination} (${tripDate})`;
    });
    bookingsListEl.innerHTML = buildHistoryList(storico.prenotazioni, (booking) => `${booking.codice || '-'} - ${booking.viaggio_codice || '-'} (${booking.posti || 0} posti)`);
    totalSpentEl.textContent = formatCurrency(totalSpent);
  } catch (error) {
    tripsListEl.innerHTML = '<li>Errore caricamento storico</li>';
    bookingsListEl.innerHTML = '<li>Errore caricamento storico</li>';
    totalSpentEl.textContent = '€ 0.00';
    showMessage(error.message || 'Errore caricamento storico cliente', 'error');
  }
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportCSV() {
  const cols = ['codice_cliente', 'nome', 'cognome', 'telefono', 'email', 'comune', 'stato_cliente', 'totale_speso', 'storico_viaggi', 'storico_prenotazioni'];
  const rows = [cols.join(',')];
  filteredList.forEach((cliente) => {
    const summary = statsByClient.get(cliente.id) || {};
    const values = [
      summary.code || '',
      cliente.nome || '',
      cliente.cognome || '',
      cliente.telefono || '',
      cliente.email || '',
      cliente.comune || cliente.citta || '',
      cliente.stato_cliente || 'Attivo',
      Number(summary.totalSpent || 0).toFixed(2),
      String(summary.totalTrips || 0),
      String(summary.totalBookings || 0)
    ];
    rows.push(values.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','));
  });
  downloadBlob(rows.join('\n'), 'clienti_export.csv', 'text/csv;charset=utf-8;');
}

async function exportXLSX() {
  const data = filteredList.map((cliente) => {
    const summary = statsByClient.get(cliente.id) || {};
    return {
      'Codice Cliente': summary.code || '',
      Nome: cliente.nome || '',
      Cognome: cliente.cognome || '',
      Telefono: cliente.telefono || '',
      Email: cliente.email || '',
      Citta: cliente.comune || cliente.citta || '',
      'Stato Cliente': cliente.stato_cliente || 'Attivo',
      'Totale Speso': Number(summary.totalSpent || 0).toFixed(2),
      'Storico Viaggi': summary.totalTrips || 0,
      'Storico Prenotazioni': summary.totalBookings || 0
    };
  });
  downloadXlsx(data, 'Clienti', 'clienti_export.xlsx');
}

btnNew.onclick = () => { openClientModal(null); };
search.oninput = () => applySearchAndFilters();
filterStateEl.onchange = () => applySearchAndFilters();
filterTripsEl.onchange = () => applySearchAndFilters();
filterCityEl.oninput = () => applySearchAndFilters();
filterSpentMinEl.oninput = () => applySearchAndFilters();
exportCsvBtn.onclick = () => exportCSV();
exportXlsxBtn.onclick = () => {
  exportXLSX().catch((error) => {
    console.error(error);
    showMessage(error.message || 'Errore esportazione XLSX', 'error');
  });
};

unsubscribeClienti = clientService.subscribe(() => { load(); });
unsubscribePrenotazioni = bookingService.subscribe(() => { load(); });
unsubscribeViaggi = tripService.subscribe(() => { load(); });
unsubscribePagamenti = paymentService.subscribe(() => { load(); });

window.addEventListener('beforeunload', () => {
  if (typeof unsubscribeClienti === 'function') unsubscribeClienti();
  if (typeof unsubscribePrenotazioni === 'function') unsubscribePrenotazioni();
  if (typeof unsubscribeViaggi === 'function') unsubscribeViaggi();
  if (typeof unsubscribePagamenti === 'function') unsubscribePagamenti();
});

load();
