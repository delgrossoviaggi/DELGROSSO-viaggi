/* DEL GROSSO GESTIONALE V74 — PREMIUM UNIVERSAL SHELL
   Presentation/navigation layer only. Supabase/data services remain untouched. */
(() => {
  const NAV=[
    ['OPERATIVO',[['🏠','Dashboard','./dashboard.html'],['🧭','Viaggi','./viaggi.html'],['🎫','Prenotazioni','./prenotazioni.html'],['🚌','Noleggi Bus','./noleggi-bus.html'],['🛂','Check-in','./checkin.html'],['⚙️','Centro Operativo','./centro-operativo.html']]],
    ['ANAGRAFICHE',[['👥','Clienti','./clienti.html'],['🚍','Flotta','./flotta.html']]],
    ['COMMERCIALE & CONTABILITÀ',[['💳','Pagamenti','./pagamenti.html'],['🧾','Preventivi','./preventivi.html'],['📊','Statistiche','./statistiche.html'],['🗂️','Archivio','./archivio.html']]],
    ['SISTEMA',[['🔔','Notifiche','./notifiche.html'],['🔧','Impostazioni','./impostazioni.html']]]
  ];
  const excluded=new Set(['login.html','index.html',]);
  const page=location.pathname.split('/').pop()||'dashboard.html';
  if(excluded.has(page)||!document.body)return;
  if(document.getElementById('dg-v74-shell'))return;
  document.body.classList.add('dg-v74-app');
  const titles={'dashboard.html':'Dashboard','viaggi.html':'Viaggi','prenotazioni.html':'Prenotazioni','noleggi-bus.html':'Noleggi Bus','checkin.html':'Check-in','centro-operativo.html':'Centro Operativo','clienti.html':'Clienti','flotta.html':'Flotta','pagamenti.html':'Pagamenti','preventivi.html':'Preventivi','statistiche.html':'Statistiche','archivio.html':'Archivio','notifiche.html':'Notifiche','impostazioni.html':'Impostazioni','preventivi-nuovo.html':'Nuovo Preventivo','prenotazione.html':'Prenotazione'};
  const title=titles[page]||document.title.split(' - ')[0]||'Gestionale';
  const navHtml=NAV.map(([section,items])=>`<div class="dg-v74-nav-section">${section}</div>`+items.map(([ico,label,href])=>`<a href="${href}" class="${href.endsWith(page)?'active':''}"><span class="ico">${ico}</span><span>${label}</span></a>`).join('')).join('');
  const sidebar=document.createElement('aside');sidebar.className='dg-v74-sidebar';sidebar.innerHTML=`<div class="dg-v74-logo-box"><img src="./assets/logo-delgrosso-v54.png" alt="Del Grosso Viaggi & Limousine Bus"></div><div class="dg-v74-company"><small>TRAVEL MANAGEMENT · 2026</small><strong>Del Grosso Viaggi</strong></div><nav class="dg-v74-nav" aria-label="Navigazione Gestionale">${navHtml}</nav><div class="dg-v74-footer">Dati operativi sincronizzati con Supabase<br>Interfaccia V74 Premium</div>`;
  document.body.appendChild(sidebar);
  const top=document.createElement('header');top.className='dg-v74-topbar';top.innerHTML=`<button class="dg-v74-menu-btn" type="button" aria-label="Apri menu" aria-expanded="false">☰</button><div class="dg-v74-brand-mini"><img src="./assets/logo-delgrosso-v54.png" alt=""></div><div><div class="dg-v74-page-title">${title}</div><div class="dg-v74-subtitle">Del Grosso Viaggi & Limousine Bus</div></div><div class="dg-v74-spacer"></div><div class="dg-v74-status" id="dgV74Status"><i></i><span>Connessione Supabase…</span></div><button class="dg-v74-quick" type="button" id="dgV74Quick" title="Nuova operazione">＋ Nuovo</button>`;document.body.appendChild(top);
  const overlay=document.createElement('div');overlay.className='dg-v74-mobile-overlay';document.body.appendChild(overlay);
  const bottom=document.createElement('nav');bottom.className='dg-v74-bottom';bottom.setAttribute('aria-label','Accesso rapido mobile');bottom.innerHTML=[['🏠','Home','./dashboard.html'],['🧭','Viaggi','./viaggi.html'],['🎫','Prenotazioni','./prenotazioni.html'],['🚌','Noleggi','./noleggi-bus.html']].map(([i,l,h])=>`<a href="${h}" class="${h.endsWith(page)?'active':''}"><span>${i}</span>${l}</a>`).join('');document.body.appendChild(bottom);
  const toast=document.createElement('div');toast.className='dg-v54-live-toast';toast.id='dgV74Toast';document.body.appendChild(toast);
  const menuBtn=top.querySelector('.dg-v74-menu-btn');const closeMenu=()=>{document.body.classList.remove('dg-v74-menu-open');menuBtn?.setAttribute('aria-expanded','false')};menuBtn.addEventListener('click',()=>{const open=!document.body.classList.contains('dg-v74-menu-open');document.body.classList.toggle('dg-v74-menu-open',open);menuBtn.setAttribute('aria-expanded',String(open));});overlay.addEventListener('click',closeMenu);sidebar.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});
  const quickTargets={'viaggi.html':'#btnNewTrip','prenotazioni.html':'#btnNewBooking','clienti.html':'#newClientButton,#btnNewClient','noleggi-bus.html':'#btnNewCharter','preventivi.html':'#btnNewQuote'};top.querySelector('#dgV74Quick').addEventListener('click',()=>{const target=quickTargets[page];if(target){const el=document.querySelector(target);if(el){el.click();return}}location.href=page==='dashboard.html'?'./viaggi.html':'./dashboard.html'});
  const setStatus=(online,text)=>{const el=document.getElementById('dgV74Status');if(!el)return;el.classList.toggle('online',!!online);el.classList.toggle('offline',online===false);const span=el.querySelector('span');if(span)span.textContent=text||(online?'Supabase sincronizzato':'Connessione offline')};
  window.addEventListener('dg:supabase:online',e=>setStatus(true,`Supabase · ${e.detail?.latencyMs||'—'} ms`));window.addEventListener('dg:supabase:offline',()=>setStatus(false,'Supabase non raggiungibile'));window.addEventListener('dg:supabase:realtime-status',e=>{if(e.detail?.status==='SUBSCRIBED')setStatus(true,'Supabase · live')});window.addEventListener('online',()=>setStatus(true,'Rete disponibile'));window.addEventListener('offline',()=>setStatus(false,'Modalità offline'));
  setTimeout(async()=>{try{if(window.DG_SUPABASE_SYNC?.healthCheck){const r=await window.DG_SUPABASE_SYNC.healthCheck();setStatus(r.ok,r.ok?`Supabase · ${r.latencyMs} ms`:'Supabase non raggiungibile')}}catch(_){setStatus(false,'Supabase non raggiungibile')}},600);
  document.documentElement.dataset.dgV74='1';
})();
