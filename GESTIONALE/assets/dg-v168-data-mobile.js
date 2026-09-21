/* DEL GROSSO GESTIONALE V104 — Data Integrity monitor. Read-only, no writes. */
import{t as tripService}from'./tripService-BzTorehO.js';
import{t as bookingService}from'./bookingService-CitenMQF.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const arr=x=>x?.success===false?[]:(Array.isArray(x?.data)?x.data:(Array.isArray(x)?x:[]));
const active=b=>!/annullat|archiv/i.test(String(b?.stato||''));
const seats=b=>Math.max(0,Number(b?.posti??b?.numero_persone??b?.num_persone??b?.passeggeri??0)||0);
const cents=v=>{const n=Number(v);return Number.isFinite(n)?Math.round(n*100):0};
const money=v=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2}).format(cents(v)/100);
async function run(){const page=location.pathname.split('/').pop().toLowerCase();if(!['economia.html','dashboard.html','dossier-viaggio.html','control-room-viaggio.html'].includes(page))return;try{const[tr,bo]=await Promise.all([tripService.getAll(),bookingService.getAll()]);const trips=arr(tr),bookings=arr(bo).filter(active);const map=new Map(trips.map(t=>[String(t.id),t]));let activePax=0,activeRevenue=0,overbooked=0,mismatches=0;const byTrip=new Map();bookings.forEach(b=>{const t=map.get(String(b?.viaggio_id||b?.tratta_id||''));const p=seats(b);const stored=cents(b?.totale??0);const expected=cents((Number(t?.prezzo)||0)*p);activePax+=p;activeRevenue+=expected||stored;const id=String(t?.id||'');if(id){const cur=byTrip.get(id)||0;byTrip.set(id,cur+p)}if(expected&&Math.abs(stored-expected)>0) mismatches++});trips.forEach(t=>{const p=byTrip.get(String(t.id))||0;const cap=Number(t?.posti_totali)||0;if(cap&&p>cap)overbooked++});mount({trips:trips.length,bookings:bookings.length,pax:activePax,revenue:activeRevenue/100,mismatches,overbooked});}catch(e){console.warn('[DG104]',e)}}
function mount(m){if(document.getElementById('dg104Integrity'))return;const host=document.querySelector('.main-content')||document.body;const el=document.createElement('section');el.id='dg104Integrity';el.className='dg104-integrity';const warn=m.mismatches||m.overbooked;el.innerHTML=`<div class="dg104-integrity-head"><div><h3>🧮 Precision & Data Integrity</h3><p>Controllo automatico dei totali senza modificare i dati salvati.</p></div><span class="dg104-integrity-badge ${warn?'warn':''}">${warn?`⚠ ${m.mismatches} differenze · ${m.overbooked} sovraccarichi`:'✓ DATI COERENTI'}</span></div><div class="dg104-integrity-grid"><div class="dg104-integrity-item"><small>PRENOTAZIONI ATTIVE</small><b>${m.bookings}</b></div><div class="dg104-integrity-item"><small>POSTI/PASSEGGERI</small><b>${m.pax.toLocaleString('it-IT')}</b></div><div class="dg104-integrity-item"><small>VALORE REALE</small><b>${money(m.revenue)}</b></div><div class="dg104-integrity-item"><small>CONTROLLO</small><b>${warn?'Richiede verifica':'OK al centesimo'}</b></div></div><div class="dg104-integrity-note">Il valore reale viene calcolato come prezzo viaggio × posti quando entrambi sono disponibili. Nessun arrotondamento a decine o centinaia.</div>`;host.prepend(el)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
/* DELGROSSO V112 — universal device behavior. Lightweight, no polling, no global MutationObserver. */
(()=>{
  'use strict';
  const root=document.documentElement;
  const ua=navigator.userAgent||'';
  const touch=('ontouchstart' in window)||navigator.maxTouchPoints>0;
  const coarse=window.matchMedia?.('(pointer:coarse)').matches||false;
  const mobile=/Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const tablet=/iPad|Android(?!.*Mobile)/i.test(ua)||(/Macintosh/i.test(ua)&&touch);
  root.dataset.dgDevice=tablet?'tablet':mobile?'mobile':'desktop';
  root.dataset.dgTouch=(touch||coarse)?'1':'0';
  if(window.visualViewport){
    const sync=()=>root.style.setProperty('--dg-vv-height',`${Math.round(window.visualViewport.height)}px`);
    window.visualViewport.addEventListener('resize',sync,{passive:true}); sync();
  }
  // Keep focus visible above the on-screen keyboard on touch devices.
  if(touch){
    document.addEventListener('focusin',e=>{
      const el=e.target;
      if(!(el instanceof HTMLElement))return;
      if(!/INPUT|SELECT|TEXTAREA/.test(el.tagName))return;
      setTimeout(()=>{try{el.scrollIntoView({block:'center',inline:'nearest',behavior:'smooth'})}catch(_){ }},120);
    },{passive:true});
  }
  // Add data labels once after initial render; the existing shell handles later table rows.
  const tables=['tripTable','bookingTable','clientiTable','fleetTable','nbTable','nbPaymentsTable','passengerTable','paymentsTable','quoteTable','reportTable'];
  const label=()=>tables.forEach(id=>{
    const t=document.getElementById(id); if(!t||!t.tHead)return;
    const heads=[...t.tHead.rows[0].cells].map(x=>x.textContent.trim().replace(/\s+/g,' '));
    [...t.tBodies].forEach(tb=>[...tb.rows].forEach(tr=>[...tr.cells].forEach((td,i)=>{if(heads[i]&&!td.dataset.label)td.dataset.label=heads[i]})));
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',label,{once:true});else label();
  // Safe-area aware body class for targeted components.
  if(touch)document.body.classList.add('dg112-touch');
})();

/* V114 polish: expose stable device classes and keep viewport changes cheap. */
(()=>{
  'use strict';
  const root=document.documentElement;
  const update=()=>{
    const w=window.innerWidth||root.clientWidth||0;
    const h=window.innerHeight||0;
    root.dataset.dgCompact=w<600?'phone':w<1100?'tablet':'desktop';
    root.dataset.dgLandscape=(w>h&&w<1100)?'1':'0';
  };
  window.addEventListener('resize',update,{passive:true});
  window.addEventListener('orientationchange',update,{passive:true});
  update();
})();
