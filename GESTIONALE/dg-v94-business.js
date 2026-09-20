/* DEL GROSSO — ECONOMIA CONSOLIDATA / produzione
   Unica implementazione per il controllo economico: ricavi, incassi, residui, costi e margini.
   Nessuna scrittura sulle tabelle operative. */
import { t as tripService } from './tripService-BzTorehO.js';
import { t as bookingService } from './bookingService-CitenMQF.js';
import { c as paymentService } from './notificationCenterService-CaZQlods.js';
import { money as exactMoney } from './dg-v98-money.js';

const money = exactMoney;
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const cents = v => Math.round(num(v) * 100) / 100;
const active = v => !/annull|archiv/i.test(String(v?.stato || ''));
const tripTitle = t => String(t?.titolo || t?.destinazione || 'Viaggio senza titolo').trim();
const tripId = v => String(v?.viaggio_id || v?.tratta_id || v?.id_viaggio || '').trim();
const pax = b => Math.max(0, Math.round(num(b?.posti ?? b?.numero_persone ?? b?.num_persone ?? b?.passeggeri ?? b?.adulti)));
const cost = t => Math.max(0, cents(t?.costo_totale ?? t?.costi_totali ?? t?.costo_bus ?? t?.costo_mezzo ?? t?.costo_autista ?? t?.costi ?? t?.spese));

function bookingRevenue(b, trip) {
  const people = pax(b);
  const price = num(trip?.prezzo ?? trip?.prezzo_persona ?? b?.prezzo);
  const stored = num(b?.totale);
  return people > 0 && price > 0 ? cents(people * price) : Math.max(0, cents(stored));
}

function paymentNet(p) {
  const amount = Math.abs(num(p?.importo ?? p?.pagato ?? p?.totale));
  const type = String(p?.tipo || '').trim().toLowerCase();
  return type.includes('rimborso') ? -amount : amount;
}

function arr(x) { return x?.success === false ? [] : (Array.isArray(x?.data) ? x.data : (Array.isArray(x) ? x : [])); }
function formatDate(v) { const s = String(v || '').slice(0,10); if (!s) return '—'; const d = new Date(`${s}T00:00:00`); return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('it-IT'); }

function inject() {
  if (document.getElementById('dg94')) return;
  const host = document.querySelector('.main-content') || document.body;
  const el = document.createElement('section');
  el.id = 'dg94'; el.className = 'dg94 dg111-economia';
  el.innerHTML = `
    <div class="dg94-head dg111-head">
      <div><span class="dg111-eyebrow">DELGROSSO · CONTROLLO FINANZIARIO</span><h2>Economia & controllo viaggi</h2><p>Controlla in un'unica schermata quanto deve produrre ogni viaggio, quanto è già stato incassato, quanto manca, il costo sostenuto e il margine.</p></div>
      <div class="dg94-actions"><button type="button" id="dg111Refresh">↻ Aggiorna</button><a href="./viaggi.html">🚌 Viaggi</a><a href="./pagamenti.html">💳 Pagamenti</a></div>
    </div>
    <div class="dg94-kpis dg111-kpis">
      <article class="dg94-kpi"><small>Totale da incassare</small><strong id="dg94Revenue">€ 0,00</strong><em>quote delle prenotazioni attive</em></article>
      <article class="dg94-kpi"><small>Totale incassato</small><strong id="dg94Paid">€ 0,00</strong><em>acconti + saldi − rimborsi</em></article>
      <article class="dg94-kpi dg111-due"><small>Ancora da incassare</small><strong id="dg94Due">€ 0,00</strong><em>totale dovuto − incassato</em></article>
      <article class="dg94-kpi"><small>Costo totale viaggi</small><strong id="dg111Cost">€ 0,00</strong><em>costi valorizzati nei viaggi</em></article>
      <article class="dg94-kpi"><small>Margine attuale</small><strong id="dg111CashMargin">€ 0,00</strong><em>incassato − costo</em></article>
      <article class="dg94-kpi"><small>Margine previsto</small><strong id="dg94Margin">€ 0,00</strong><em>totale dovuto − costo</em></article>
    </div>
    <div class="dg111-equation"><div><span>TOTALE DOVUTO</span><b id="dg111EqRevenue">€ 0,00</b></div><i>−</i><div><span>INCASSATO</span><b id="dg111EqPaid">€ 0,00</b></div><i>=</i><div class="result"><span>ANCORA DA INCASSARE</span><b id="dg111EqDue">€ 0,00</b></div></div>
    <div class="dg94-panel dg111-panel"><div class="dg94-panel-head"><div><strong>Situazione economica per viaggio</strong><span> · numeri calcolati sui dati effettivi</span></div><span id="dg94Updated">—</span></div>
      <div class="dg111-toolbar"><input id="dg111Search" type="search" placeholder="Cerca viaggio…" autocomplete="off"><select id="dg111Status"><option value="all">Tutti gli stati</option><option value="open">Con residuo</option><option value="paid">Completamente incassati</option><option value="cost">Con costo</option></select></div>
      <div class="dg94-table-wrap"><table class="dg94-table dg111-table"><thead><tr><th>Viaggio</th><th>Data</th><th>Passeggeri</th><th class="num">Totale dovuto</th><th class="num">Incassato</th><th class="num">Residuo</th><th class="num">Costo</th><th class="num">Margine attuale</th><th class="num">Margine previsto</th></tr></thead><tbody id="dg94Rows"></tbody></table></div>
    </div>
    <div class="dg94-panel dg111-panel"><div class="dg94-panel-head"><strong>Legenda operativa</strong><span>lettura immediata dei conti</span></div><div class="dg111-legend"><span>💰 <b>Totale dovuto</b> = somma delle quote dei clienti</span><span>💳 <b>Incassato</b> = acconti + saldi − rimborsi</span><span>⏳ <b>Residuo</b> = totale dovuto − incassato</span><span>📉 <b>Margine attuale</b> = incassato − costo</span><span>📈 <b>Margine previsto</b> = totale dovuto − costo</span></div></div>`;
  host.prepend(el);
  document.getElementById('dg111Refresh')?.addEventListener('click', () => load());
}

let model = [];
function render() {
  const q = String(document.getElementById('dg111Search')?.value || '').trim().toLowerCase();
  const status = document.getElementById('dg111Status')?.value || 'all';
  const filtered = model.filter(x => {
    if (q && !`${tripTitle(x.trip)} ${x.trip?.codice || ''}`.toLowerCase().includes(q)) return false;
    if (status === 'open' && x.due <= 0.005) return false;
    if (status === 'paid' && x.due > 0.005) return false;
    if (status === 'cost' && x.cost <= 0) return false;
    return true;
  });
  const set = (id,v) => { const e=document.getElementById(id); if(e)e.textContent=money(v); };
  const totalRevenue = cents(model.reduce((s,x)=>s+x.revenue,0));
  const totalPaid = cents(model.reduce((s,x)=>s+x.paid,0));
  const totalDue = cents(Math.max(totalRevenue-totalPaid,0));
  const totalCost = cents(model.reduce((s,x)=>s+x.cost,0));
  set('dg94Revenue',totalRevenue); set('dg94Paid',totalPaid); set('dg94Due',totalDue); set('dg111Cost',totalCost); set('dg111CashMargin',cents(totalPaid-totalCost)); set('dg94Margin',cents(totalRevenue-totalCost));
  set('dg111EqRevenue',totalRevenue); set('dg111EqPaid',totalPaid); set('dg111EqDue',totalDue);
  const dueEl=document.getElementById('dg94Due'); if(dueEl) dueEl.className=totalDue>0?'dg111-warn':'';
  const body=document.getElementById('dg94Rows');
  if(body) body.innerHTML=filtered.map(x=>`<tr>
    <td data-label="Viaggio"><strong>${esc(tripTitle(x.trip))}</strong>${x.trip?.codice?`<small class="dg111-code">${esc(x.trip.codice)}</small>`:''}</td>
    <td data-label="Data">${esc(formatDate(x.trip?.data_partenza))}</td>
    <td data-label="Passeggeri">${x.pax}</td>
    <td data-label="Totale dovuto" class="num"><b>${money(x.revenue)}</b></td>
    <td data-label="Incassato" class="num dg111-paid">${money(x.paid)}</td>
    <td data-label="Residuo" class="num ${x.due>0.005?'dg111-residual':'dg111-settled'}"><b>${money(x.due)}</b></td>
    <td data-label="Costo" class="num">${money(x.cost)}</td>
    <td data-label="Margine attuale" class="num ${x.cashMargin>=0?'dg94-pos':'dg94-neg'}">${money(x.cashMargin)}</td>
    <td data-label="Margine previsto" class="num ${x.expectedMargin>=0?'dg94-pos':'dg94-neg'}">${money(x.expectedMargin)}</td>
  </tr>`).join('') || `<tr><td colspan="9" class="dg94-empty">Nessun viaggio corrisponde ai filtri.</td></tr>`;
  const upd=document.getElementById('dg94Updated'); if(upd) upd.textContent=`${filtered.length} viaggi · aggiornato ${new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}`;
}

async function load() {
  try {
    const [tr,bo,pa] = await Promise.all([tripService.getAll(),bookingService.getAll(),paymentService.getAll()]);
    const trips=arr(tr).filter(active), bookings=arr(bo).filter(active), payments=arr(pa);
    const byId=new Map(trips.map(t=>[String(t.id),t]));
    const byBooking=new Map();
    const rows=new Map(trips.map(t=>[String(t.id),{trip:t,revenue:0,paid:0,pax:0,cost:cost(t)}]));
    bookings.forEach(b=>{
      const id=tripId(b); const t=byId.get(id); if(!t)return;
      const r=rows.get(id); r.pax+=pax(b); r.revenue=cents(r.revenue+bookingRevenue(b,t)); byBooking.set(String(b.id),id);
    });
    payments.forEach(p=>{
      let id=tripId(p);
      if(!id && p?.prenotazione_id) id=byBooking.get(String(p.prenotazione_id)) || '';
      if(!id || !rows.has(id)) return;
      const r=rows.get(id); r.paid=cents(Math.max(0,r.paid+paymentNet(p)));
    });
    model=Array.from(rows.values()).map(r=>{r.due=cents(Math.max(r.revenue-r.paid,0));r.cashMargin=cents(r.paid-r.cost);r.expectedMargin=cents(r.revenue-r.cost);return r;}).filter(r=>r.revenue>0||r.paid>0||r.cost>0).sort((a,b)=>String(a.trip?.data_partenza||'').localeCompare(String(b.trip?.data_partenza||'')) || tripTitle(a.trip).localeCompare(tripTitle(b.trip),'it'));
    render();
  } catch(e) { console.warn('[DG ECONOMIA]',e); const body=document.getElementById('dg94Rows'); if(body)body.innerHTML=`<tr><td colspan="9" class="dg94-empty">Errore nel caricamento dei dati economici: ${esc(e?.message||e)}</td></tr>`; }
}

function init(){ inject(); document.getElementById('dg111Search')?.addEventListener('input',render); document.getElementById('dg111Status')?.addEventListener('change',render); load(); }
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
