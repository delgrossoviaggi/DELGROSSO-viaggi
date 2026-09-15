/* DEL GROSSO GESTIONALE V76 — Agency 2.0 UX enhancement
   Reads the existing DOM/data services only. It never writes to Supabase. */
(()=>{
 const page=location.pathname.split('/').pop()||'dashboard.html';
 if(!document.body||['login.html','index.html','setup-amministratori.html'].includes(page))return;
 const tableIds=['tripTable','bookingTable','clientiTable','fleetTable','nbTable','nbPaymentsTable','paymentsTable','quoteTable','reportTable','passengerTable'];
 const labels=()=>{
  tableIds.forEach(id=>{
   const table=document.getElementById(id); if(!table)return;
   table.classList.add('dg-v76-mobile-table');
   const heads=[...table.querySelectorAll('thead th')].map(x=>x.textContent.trim().replace(/\s+/g,' '));
   table.querySelectorAll('tbody tr').forEach(tr=>[...tr.children].forEach((td,i)=>{
    if(heads[i]&&!td.dataset.label)td.dataset.label=heads[i];
   }));
  });
 };
 const actions={
  'dashboard.html':[
   ['🧭','Nuovo viaggio','Crea una nuova partenza','./viaggi.html','#btnNewTrip'],
   ['🎫','Nuova prenotazione','Registra un cliente e assegna i posti','./prenotazioni.html','#btnNew'],
   ['👤','Nuovo cliente','Apri una nuova anagrafica','./clienti.html','#newCustomer'],
   ['🚌','Nuovo noleggio','Apri una pratica di noleggio','./noleggi-bus.html','#btnNewCharter']
  ],
  'viaggi.html':[['＋','Nuovo viaggio','Nuova partenza','./viaggi.html','#btnNewTrip'],['↻','Aggiorna','Sincronizza la lista','./viaggi.html','#btnRefreshTrips'],['🎫','Prenotazioni','Apri le prenotazioni','./prenotazioni.html',null],['◉','Centro operativo','Controlla una partenza','./centro-operativo.html',null]],
  'prenotazioni.html':[['＋','Nuova prenotazione','Nuova pratica','./prenotazioni.html','#btnNew'],['🪑','Gestisci posti','Apri una prenotazione per assegnare i posti','./prenotazioni.html',null],['💳','Pagamenti','Gestisci acconti e saldi','./pagamenti.html',null],['🧭','Viaggi','Vai alle partenze','./viaggi.html',null]],
  'clienti.html':[['＋','Nuovo cliente','Nuova anagrafica','./clienti.html','#newCustomer'],['🎫','Prenotazioni','Consulta le prenotazioni','./prenotazioni.html',null],['💶','Pagamenti','Controlla gli incassi','./pagamenti.html',null],['📤','Esporta','Esporta l’elenco clienti','./clienti.html','#exportCsv']],
  'noleggi-bus.html':[['＋','Nuovo noleggio','Nuova pratica','./noleggi-bus.html','#btnNewCharter'],['🚍','Flotta','Gestisci i mezzi','./flotta.html',null],['💳','Pagamenti','Controlla i pagamenti','./pagamenti.html',null],['📊','Statistiche','Analizza i dati','./statistiche.html',null]],
  'pagamenti.html':[['💳','Nuovo movimento','Apri le prenotazioni','./prenotazioni.html','#btnOpenBookings'],['🎫','Prenotazioni','Gestisci il ledger','./prenotazioni.html',null],['📊','Statistiche','Analizza incassi','./statistiche.html',null],['📤','Export','Esporta gli incassi','./pagamenti.html','#btnExportIncassi']],
  'preventivi.html':[['＋','Nuovo preventivo','Crea una nuova offerta','./preventivi-nuovo.html','#btnNewQuote'],['🎫','Prenotazioni','Converti in prenotazione','./prenotazioni.html',null],['👥','Clienti','Apri anagrafiche','./clienti.html',null],['📊','Statistiche','Analizza il commerciale','./statistiche.html',null]]
 };
 function clickSelector(sel){if(!sel)return false;const el=document.querySelector(sel);if(el){el.click();return true}return false}
 function buildDashboard(){
  if(page!=='dashboard.html'||document.querySelector('.dg-v76-cockpit'))return;
  const main=document.querySelector('main.main-content')||document.querySelector('.main-content'); if(!main)return;
  const h=main.querySelector('h1');
  const cockpit=document.createElement('section'); cockpit.className='dg-v76-cockpit'; cockpit.setAttribute('aria-label','Cruscotto operativo');
  cockpit.innerHTML=`<div class="dg-v76-cockpit-main"><small>DEL GROSSO · AGENZIA 2.0</small><strong>Cruscotto operativo</strong><span>Partenze, clienti, prenotazioni e incassi in un'unica vista.</span></div>
   <div class="dg-v76-cockpit-card"><small>Partenze oggi</small><strong id="dg76Trips">0</strong><span>operazioni pianificate</span></div>
   <div class="dg-v76-cockpit-card"><small>Passeggeri oggi</small><strong id="dg76Passengers">0</strong><span>posti movimentati</span></div>
   <div class="dg-v76-cockpit-card"><small>Incasso oggi</small><strong id="dg76Income">€ 0,00</strong><span>movimenti registrati</span></div>
   <div class="dg-v76-cockpit-card"><small>Da incassare</small><strong id="dg76Due">€ 0,00</strong><span>residuo clienti</span></div>`;
  if(h)h.closest('.app-card')?.after(cockpit); else main.prepend(cockpit);
  const actionBar=document.createElement('section'); actionBar.className='dg-v76-actions'; actionBar.setAttribute('aria-label','Azioni rapide');
  actionBar.innerHTML=actions[page].map((a,i)=>`<a class="dg-v76-action" href="${a[3]}" data-dg76-action="${i}"><i>${a[0]}</i><span><strong>${a[1]}</strong><span>${a[2]}</span></span></a>`).join('');
  cockpit.after(actionBar);
  actionBar.addEventListener('click',e=>{const a=e.target.closest('[data-dg76-action]');if(!a)return;const item=actions[page][Number(a.dataset.dg76Action)];if(item?.[4]&&clickSelector(item[4]))e.preventDefault()});
  const sync=()=>{
   const map=[['dg76Trips','metricTripsToday'],['dg76Passengers','metricPassengersToday'],['dg76Income','metricCollectedToday'],['dg76Due','metricOutstandingRevenue']];
   map.forEach(([to,from])=>{const src=document.getElementById(from),dst=document.getElementById(to);if(!src||!dst)return;const next=src.textContent.trim()||'0';if(dst.textContent!==next)dst.textContent=next});
  };
  sync();
  // V83 HOTFIX: observe only the source KPI nodes. The previous observer watched
  // the entire main DOM while sync() rewrote KPI text, creating a self-triggering
  // MutationObserver loop that could freeze the Chrome renderer.
  const mo=new MutationObserver(()=>sync());
  map.forEach(([,from])=>{const src=document.getElementById(from);if(src)mo.observe(src,{childList:true,characterData:true,subtree:true})});
  window.setTimeout(()=>mo.disconnect(),1000*60*30);
 }
 function buildActionBar(){
  if(page==='dashboard.html'||document.querySelector('.dg-v76-actions'))return;
  const main=document.querySelector('main.main-content')||document.body; const first=main.querySelector('h1'); if(!first)return;
  const bar=document.createElement('section');bar.className='dg-v76-actions';bar.setAttribute('aria-label','Azioni rapide');
  bar.innerHTML=(actions[page]||[]).map((a,i)=>`<a class="dg-v76-action" href="${a[3]}" data-dg76-action="${i}"><i>${a[0]}</i><span><strong>${a[1]}</strong><span>${a[2]}</span></span></a>`).join('');
  first.closest('section,header,.page-header')?.after(bar)||first.after(bar);
  bar.addEventListener('click',e=>{const a=e.target.closest('[data-dg76-action]');if(!a)return;const item=actions[page][Number(a.dataset.dg76Action)];if(item?.[4]&&clickSelector(item[4]))e.preventDefault()});
 }
 function init(){document.body.classList.add('dg-v76-ready');labels();buildDashboard();buildActionBar();
  const obs=new MutationObserver(()=>{labels()}); tableIds.forEach(id=>{const t=document.getElementById(id);if(t?.tBodies?.[0])obs.observe(t.tBodies[0],{childList:true,subtree:true})});
  setTimeout(()=>{labels();buildDashboard();buildActionBar()},600);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
