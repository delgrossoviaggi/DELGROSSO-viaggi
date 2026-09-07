import { getTripById, getBookedSeats } from './services/viaggiService.js';
import { createPublicBooking } from './services/prenotazioniService.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const tripId = params.get('viaggio') || params.get('tratta') || params.get('id');
let trip = null;
let booked = new Set();
let selected = new Set();

function money(v) { return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(v)||0); }
function capacity(t) { return String(t?.modello_bus||'').includes('53') ? 53 : 63; }
function esc(v) { return String(v ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function setStep(n) {
  document.querySelectorAll('.progress-step').forEach(el => el.classList.toggle('active', Number(el.dataset.step) <= n));
  const bar = document.querySelector('.progress-card .w-full.h-1 > div');
  if (bar) bar.style.width = `${Math.min(100,n/3*100)}%`;
}
function seatLayout(total) {
  const seats = [];
  for (let i=1;i<=total;i++) seats.push(String(i).padStart(2,'0'));
  return seats;
}
function renderSeats() {
  const total = capacity(trip);
  const seats = seatLayout(total);
  $('seatmap-container').innerHTML = `<div class="seat-map-container" style="display:grid;gap:18px">
    <div class="seat-map-front" style="padding:14px;border-radius:18px;text-align:center;font-weight:900;letter-spacing:.12em">FRONTE BUS</div>
    <div style="display:grid;grid-template-columns:repeat(4,minmax(44px,1fr));gap:10px;max-width:560px;margin:auto;width:100%">
      ${seats.map(s => { const isBooked = booked.has(s) || booked.has(String(Number(s))); const isSelected = selected.has(s); return `<button type="button" data-seat="${s}" ${isBooked?'disabled':''} aria-label="Posto ${s}" style="min-height:52px;border-radius:14px;border:2px solid ${isBooked?'#dc2626':isSelected?'#d97706':'#15803d'};background:${isBooked?'#ef4444':isSelected?'#f59e0b':'#16a34a'};color:${isSelected?'#111827':'#fff'};font-weight:900;cursor:${isBooked?'not-allowed':'pointer'};opacity:${isBooked?.8:1}">${s}</button>`; }).join('')}
    </div>
    <div style="display:flex;justify-content:center;gap:18px;font-size:12px;font-weight:800"><span>🟢 Disponibile</span><span>🟠 Selezionato</span><span>🔴 Occupato</span></div>
  </div>`;
  $('seatmap-container').querySelectorAll('[data-seat]').forEach(btn => btn.addEventListener('click', () => {
    const s = btn.dataset.seat;
    selected.has(s) ? selected.delete(s) : selected.add(s);
    updateSummary(); renderSeats();
  }));
}
function updateSummary() {
  const seats = [...selected].sort((a,b)=>Number(a)-Number(b));
  const price = Number(trip?.prezzo)||0;
  $('summary-seats').textContent = seats.length ? seats.join(', ') : 'Nessuno';
  $('summary-price').textContent = price ? money(price) : 'Su richiesta';
  $('summary-total').textContent = price ? money(price*seats.length) : 'Su richiesta';
  $('seats-available').textContent = `${capacity(trip)-booked.size} / ${capacity(trip)}`;
  $('continue-btn').disabled = !seats.length;
}
function fillTrip() {
  $('trip-title').textContent = trip.titolo || '-';
  $('trip-date').textContent = trip.data_partenza || '-';
  $('trip-time').textContent = 'Come indicato nella partenza';
  $('bus-model').textContent = trip.modello_bus || 'GT';
  $('bus-seats').textContent = capacity(trip);
  $('trip-price').textContent = trip.prezzo ? money(trip.prezzo) : 'Su richiesta';
  if (trip.immagine_url) $('trip-image').style.backgroundImage = `url("${String(trip.immagine_url).replace(/"/g,'&quot;')}")`;
}
function showError(msg) { $('loading-state')?.classList.add('hidden'); $('booking-content')?.classList.add('hidden'); $('error-state')?.classList.remove('hidden'); const p=$('error-state').querySelector('p'); if(p && msg) p.textContent=msg; }
function showFeedback(msg, type='error') { const el=$('booking-feedback'); el.textContent=msg; el.className=`form-feedback form-feedback--${type}`; }

async function init() {
  try {
    if (!tripId) throw new Error('Manca l’identificativo della partenza.');
    trip = await getTripById(tripId);
    if (!trip) throw new Error('La partenza non è disponibile.');
    booked = new Set(await getBookedSeats(trip.id));
    fillTrip(); renderSeats(); updateSummary();
    $('loading-state')?.classList.add('hidden'); $('booking-content')?.classList.remove('hidden');
  } catch(e) { showError(e.message); }
}

$('continue-btn')?.addEventListener('click', () => {
  $('booking-content').classList.add('hidden'); $('passenger-form-section').classList.remove('hidden'); $('passenger-form-section').scrollIntoView({behavior:'smooth',block:'start'}); setStep(2);
});
$('back-btn')?.addEventListener('click', () => {
  $('passenger-form-section').classList.add('hidden'); $('booking-content').classList.remove('hidden'); setStep(1);
});
$('passenger-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  if (!selected.size) return showFeedback('Seleziona almeno un posto.');
  const btn=$('confirm-btn'); btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Verifica disponibilità...';
  try {
    // RPC atomica: il controllo definitivo dei posti avviene dentro Supabase.
    const result = await createPublicBooking({
      trattaId: trip.id,
      nome: $('passenger-name').value,
      cognome: $('passenger-surname').value,
      telefono: $('passenger-phone').value,
      email: $('passenger-email').value,
      note: $('passenger-notes').value,
      posti: [...selected]
    });
    setStep(3);
    $('passenger-form-section').classList.add('hidden'); $('success-state').classList.remove('hidden');
    $('success-message').textContent = `Prenotazione ${result.numero} registrata. Posti: ${result.posti.join(', ')}.`;
    const link = $('success-whatsapp-link'); if(link) link.href=`https://wa.me/393205730466?text=${encodeURIComponent(`Ciao Del Grosso, ho appena effettuato la prenotazione ${result.numero}.`)}`;
  } catch(e) {
    showFeedback(e.message || 'Prenotazione non completata. Riprova.', 'error');
    // Ricarica disponibilità dopo eventuale conflitto.
    try { booked = new Set(await getBookedSeats(trip.id)); renderSeats(); updateSummary(); } catch {}
  } finally { btn.disabled=false; btn.innerHTML='<i class="fas fa-check"></i> Conferma prenotazione'; }
});

init();
