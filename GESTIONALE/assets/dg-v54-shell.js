
/* DELGROSSO GESTIONALE V54 — EXECUTIVE SHELL */
(() => {
  const NAV = [
    ['OPERATIVO', [
      ['🏠','Dashboard','./dashboard.html'],
      ['🧭','Viaggi','./viaggi.html'],
      ['🎫','Prenotazioni','./prenotazioni.html'],
      ['🚌','Noleggi Bus','./noleggi-bus.html'],
      ['🛂','Check-in','./checkin.html'],
      ['⚙️','Centro Operativo','./centro-operativo.html'],
    ]],
    ['ANAGRAFICHE', [
      ['👥','Clienti','./clienti.html'],
      ['🚍','Flotta','./flotta.html'],
    ]],
    ['COMMERCIALE & CONTABILITÀ', [
      ['💳','Pagamenti','./pagamenti.html'],
      ['🧾','Preventivi','./preventivi.html'],
      ['📊','Statistiche','./statistiche.html'],
      ['🗂️','Archivio','./archivio.html'],
    ]],
    ['SISTEMA', [
      ['🔔','Notifiche','./notifiche.html'],
      ['🔧','Impostazioni','./impostazioni.html'],
    ]],
  ];
  const EXCLUDED = new Set(['login.html','index.html','prenotazione.html']);
  const page = location.pathname.split('/').pop() || 'dashboard.html';
  if (EXCLUDED.has(page)) return;
  if (!document.body) return;
  document.body.classList.add('dg-v54-app');

  const titleMap = {
    'dashboard.html':'Dashboard','viaggi.html':'Viaggi','prenotazioni.html':'Prenotazioni','noleggi-bus.html':'Noleggi Bus',
    'checkin.html':'Check-in','centro-operativo.html':'Centro Operativo','clienti.html':'Clienti','flotta.html':'Flotta',
    'pagamenti.html':'Pagamenti','preventivi.html':'Preventivi','statistiche.html':'Statistiche','archivio.html':'Archivio',
    'notifiche.html':'Notifiche','impostazioni.html':'Impostazioni','preventivi-nuovo.html':'Nuovo Preventivo',
    'prenotazione.html':'Prenotazione'
  };
  const title = titleMap[page] || document.title.split(' - ')[0] || 'Gestionale';

  const navHtml = NAV.map(([section,items]) =>
    `<div class="dg-v54-nav-section">${section}</div>` +
    items.map(([ico,label,href]) => `<a href="${href}" class="${href.endsWith(page)?'active':''}"><span class="ico">${ico}</span><span>${label}</span></a>`).join('')
  ).join('');

  const sidebar = document.createElement('aside');
  sidebar.className='dg-v54-sidebar';
  sidebar.innerHTML=`
    <div class="dg-v54-logo-box"><img src="./assets/logo-delgrosso-v54.png" alt="Del Grosso Viaggi & Limousine Bus"></div>
    <div class="dg-v54-company"><small>CRM TRAVEL SUITE · 2026</small><strong>Del Grosso Viaggi</strong></div>
    <nav class="dg-v54-nav" aria-label="Navigazione Gestionale">${navHtml}</nav>
    <div class="dg-v54-footer">Dati operativi sincronizzati con Supabase<br>Interfaccia V54 Executive</div>`;
  document.body.appendChild(sidebar);

  const top = document.createElement('header');
  top.className='dg-v54-topbar';
  top.innerHTML=`
    <button class="dg-v54-menu-btn" type="button" aria-label="Apri menu">☰</button>
    <div class="dg-v54-brand-mini"><img src="./assets/logo-delgrosso-v54.png" alt=""></div>
    <div><div class="dg-v54-page-title">${title}</div><div class="dg-v54-subtitle">Del Grosso Viaggi & Limousine Bus</div></div>
    <div class="dg-v54-spacer"></div>
    <div class="dg-v54-status" id="dgV54Status"><i></i><span>Connessione Supabase…</span></div>
    <button class="dg-v54-quick" type="button" id="dgV54Quick" title="Nuova operazione">＋ Nuovo</button>`;
  document.body.appendChild(top);

  const overlay=document.createElement('div'); overlay.className='dg-v54-mobile-overlay'; document.body.appendChild(overlay);
  const bottom=document.createElement('nav'); bottom.className='dg-v54-bottom'; bottom.setAttribute('aria-label','Accesso rapido mobile');
  const quick=[['🏠','Home','./dashboard.html'],['🧭','Viaggi','./viaggi.html'],['🎫','Prenotazioni','./prenotazioni.html'],['🚌','Noleggi','./noleggi-bus.html']];
  bottom.innerHTML=quick.map(([i,l,h])=>`<a href="${h}" class="${h.endsWith(page)?'active':''}"><span>${i}</span>${l}</a>`).join('');
  document.body.appendChild(bottom);

  const toast=document.createElement('div'); toast.className='dg-v54-live-toast'; toast.id='dgV54Toast'; document.body.appendChild(toast);
  const menuBtn=top.querySelector('.dg-v54-menu-btn');
  const closeMenu=()=>document.body.classList.remove('dg-v54-menu-open');
  menuBtn.addEventListener('click',()=>document.body.classList.toggle('dg-v54-menu-open'));
  overlay.addEventListener('click',closeMenu);
  sidebar.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));

  const quickTargets = {
    'viaggi.html':'#btnNewTrip','prenotazioni.html':'#btnNewBooking','clienti.html':'#newClientButton,#btnNewClient',
    'noleggi-bus.html':'#btnNewCharter','preventivi.html':'#btnNewQuote'
  };
  top.querySelector('#dgV54Quick').addEventListener('click',()=>{
    const target=quickTargets[page];
    if(target){
      const el=document.querySelector(target);
      if(el){el.click();return;}
    }
    location.href = page==='dashboard.html' ? './viaggi.html' : './dashboard.html';
  });

  function setStatus(online, text){
    const el=document.querySelector('#dgV54Status'); if(!el)return;
    el.classList.toggle('online',!!online); el.classList.toggle('offline',online===false);
    const span=el.querySelector('span'); if(span) span.textContent=text || (online?'Supabase sincronizzato':'Connessione offline');
  }
  window.addEventListener('dg:supabase:online',e=>setStatus(true,`Supabase · ${e.detail?.latencyMs||'—'} ms`));
  window.addEventListener('dg:supabase:offline',()=>setStatus(false,'Supabase non raggiungibile'));
  window.addEventListener('dg:supabase:realtime-status',e=>{
    const s=e.detail?.status;
    if(s==='SUBSCRIBED') setStatus(true,'Supabase · live');
  });
  window.addEventListener('online',()=>setStatus(true,'Rete disponibile'));
  window.addEventListener('offline',()=>setStatus(false,'Modalità offline'));

  // Ask the central sync layer for a health check when available.
  setTimeout(async()=>{
    try{
      if(window.DG_SUPABASE_SYNC?.healthCheck){
        const r=await window.DG_SUPABASE_SYNC.healthCheck();
        setStatus(r.ok,r.ok?`Supabase · ${r.latencyMs} ms`:'Supabase non raggiungibile');
      }
    }catch(_){setStatus(false,'Supabase non raggiungibile')}
  },500);

  // Keep page content usable when older modules have their own fixed navigation.
  document.documentElement.dataset.dgV54='1';
})();
