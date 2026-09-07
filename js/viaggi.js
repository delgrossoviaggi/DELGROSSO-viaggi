import { getPublicTrips, getBookedSeats } from './services/viaggiService.js';

const $ = id => document.getElementById(id);
let trips = [];
let availability = new Map();

function parseDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  const match = s.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
  if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function money(v) {
  const n = Number(v);
  return n > 0 ? new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(n) : 'Prezzo su richiesta';
}

function capacity(trip) {
  const m = String(trip.modello_bus || '').toLowerCase();
  if (m.includes('53')) return 53;
  return 63;
}

function availabilityState(trip) {
  const total = capacity(trip);
  const booked = (availability.get(trip.id) || []).length;
  const free = Math.max(0, total - booked);
  if (free <= 0) return { free, key:'soldout', label:'Sold Out' };
  if (free <= 8) return { free, key:'ultimi', label:`Ultimi ${free} posti` };
  return { free, key:'disponibile', label:`${free} posti disponibili` };
}

function dateLabel(raw) {
  const d = parseDate(raw);
  return d ? new Intl.DateTimeFormat('it-IT',{day:'2-digit',month:'long',year:'numeric'}).format(d) : (raw || 'Data da definire');
}

function render() {
  const q = ($('searchInput')?.value || '').trim().toLowerCase();
  const destination = $('destinationFilter')?.value || '';
  const stateFilter = $('availabilityFilter')?.value || '';
  const grid = $('tripsGrid');
  if (!grid) return;

  const filtered = trips.filter(t => {
    const hay = `${t.titolo || ''} ${t.modello_bus || ''}`.toLowerCase();
    if (q && !hay.includes(q)) return false;
    if (destination && t.titolo !== destination) return false;
    if (stateFilter && availabilityState(t).key !== stateFilter) return false;
    return true;
  });

  grid.innerHTML = filtered.map(t => {
    const a = availabilityState(t);
    const disabled = a.free <= 0;
    return `<article class="departure-card">
      <div class="departure-card__media">
        ${t.immagine_url ? `<img src="${escapeHtml(t.immagine_url)}" alt="${escapeHtml(t.titolo || 'Viaggio Del Grosso')}" loading="lazy">` : '<div style="height:100%;display:grid;place-items:center;font-size:48px;color:#64748b"><i class="fas fa-bus"></i></div>'}
        <div class="departure-card__badge"><span class="availability-pill availability-pill--${a.key}"><span class="availability-pill__dot"></span>${escapeHtml(a.label)}</span></div>
      </div>
      <div class="departure-card__content">
        <div><p class="departure-card__kicker">Del Grosso Viaggi</p><h3 class="departure-card__title">${escapeHtml(t.titolo || 'Partenza')}</h3></div>
        <div class="departure-card__meta">
          <div class="departure-chip"><i class="fas fa-calendar"></i><span>${escapeHtml(dateLabel(t.data_partenza))}</span></div>
          <div class="departure-chip"><i class="fas fa-bus"></i><span>${escapeHtml(t.modello_bus || 'GT Deluxe')}</span></div>
        </div>
        <div class="departure-card__footer">
          <div><span class="departure-price-label">Quota</span><strong class="departure-price">${money(t.prezzo)}</strong></div>
          ${disabled ? '<button class="departure-btn departure-btn--disabled" disabled>Posti esauriti</button>' : `<a class="btn-primary departure-btn" href="prenota.html?viaggio=${encodeURIComponent(t.id)}"><i class="fas fa-ticket"></i> Prenota ora</a>`}
        </div>
      </div>
    </article>`;
  }).join('');

  $('counterLabel').textContent = `${filtered.length} ${filtered.length === 1 ? 'partenza disponibile' : 'partenze disponibili'}`;
  $('emptyState')?.classList.toggle('hidden', filtered.length !== 0);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

async function load() {
  $('errorState')?.classList.add('hidden');
  $('tripsGrid').innerHTML = Array.from({length:3}, () => '<div class="trip-skeleton"></div>').join('');
  try {
    trips = await getPublicTrips();
    const destinations = [...new Set(trips.map(t => t.titolo).filter(Boolean))].sort();
    if ($('destinationFilter')) $('destinationFilter').innerHTML = '<option value="">Tutte le destinazioni</option>' + destinations.map(x => `<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join('');
    await Promise.all(trips.map(async t => { availability.set(t.id, await getBookedSeats(t.id)); }));
    render();
  } catch (e) {
    $('tripsGrid').innerHTML = '';
    $('errorMessage').textContent = e.message || 'Impossibile caricare le partenze.';
    $('errorState')?.classList.remove('hidden');
  }
}

['searchInput','destinationFilter','availabilityFilter'].forEach(id => $(id)?.addEventListener('input', render));
$('reloadButton')?.addEventListener('click', load);
$('retryButton')?.addEventListener('click', load);
load();
