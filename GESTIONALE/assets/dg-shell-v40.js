/* DELGROSSO VIAGGI — V40 Unified Professional Shell */
(() => {
  'use strict';
  if (window.__DG_SHELL_V40__) return;
  window.__DG_SHELL_V40__ = true;

  const ROUTES = {
    dashboard:'./dashboard.html', viaggi:'./viaggi.html', prenotazioni:'./prenotazioni.html',
    clienti:'./clienti.html', flotta:'./flotta.html', pagamenti:'./pagamenti.html',
    archivio:'./archivio.html', preventivi:'./preventivi.html', notifiche:'./notifiche.html',
    checkin:'./checkin.html', statistiche:'./statistiche.html', impostazioni:'./impostazioni.html'
  };
  const NAV = [
    ['Dashboard','dashboard','⌂'], ['Viaggi','viaggi','◫'], ['Prenotazioni','prenotazioni','▤'],
    ['Clienti','clienti','♙'], ['Flotta','flotta','▱'], ['Pagamenti','pagamenti','€'],
    ['Archivio','archivio','▣'], ['Preventivi','preventivi','▤'], ['Notifiche','notifiche','♢'],
    ['CHECK-IN','checkin','⌗'], ['Statistiche','statistiche','▥'], ['Impostazioni','impostazioni','⚙']
  ];
  const TITLES = {dashboard:'Dashboard',viaggi:'Viaggi',prenotazioni:'Prenotazioni',clienti:'Clienti',flotta:'Flotta',pagamenti:'Pagamenti',archivio:'Archivio documenti',preventivi:'Preventivi',notifiche:'Notifiche',checkin:'CHECK-IN',statistiche:'Statistiche',impostazioni:'Impostazioni'};
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const session = () => { try { return JSON.parse(localStorage.getItem('dg_session') || 'null'); } catch { return null; } };
  const pageKey = () => {
    const p = location.pathname.toLowerCase();
    if (p.endsWith('/archivio.html') || p.includes('/archivio/')) return 'archivio';
    if (p.endsWith('/prenotazione.html') || p.endsWith('/prenotazioni.html') || p.includes('/prenotazioni/')) return 'prenotazioni';
    for (const id of Object.keys(TITLES)) if (p.includes(id)) return id;
    return 'dashboard';
  };
  const cleanup = () => {
    ['dg-brand-shell','dg-shell-v39','dg-shell-v38','dg-shell-v37'].forEach(id => document.getElementById(id)?.remove());
    document.querySelectorAll('.dg-v38-shell,.dg-v39-shell,.dg-v37-shell,.dg-v36-shell,.dg-brand-shell__footer,footer.dg-brand-shell__footer').forEach(x => x.remove());
    document.querySelectorAll('.sidebar.app-card,.settings-nav').forEach(x => x.setAttribute('data-dg-legacy-hidden','true'));
    document.body.classList.remove('dg-v38-ready','dg-v39-ready','dg-v39-open','dg-shell-open','dg-mobile-menu-open');
  };
  function build(){
    if (!document.body || document.getElementById('dg-shell-v40') || /login\.html$/i.test(location.pathname)) return;
    cleanup();
    const u = session() || {nome:'Gestionale',username:'Gestionale',ruolo:'Operatore'};
    const key = pageKey();
    const title = TITLES[key] || document.querySelector('h1')?.textContent?.trim() || 'Gestionale';
    const shell = document.createElement('div');
    shell.id='dg-shell-v40'; shell.className='dg-v40-shell';
    shell.innerHTML=`
      <button class="dg-v40-menu" type="button" aria-label="Apri menu Gestionale" aria-controls="dg-v40-drawer" aria-expanded="false">
        <span class="dg-v40-hamb"><i></i><i></i><i></i></span><b>MENU</b>
      </button>
      <div class="dg-v40-backdrop" hidden></div>
      <header class="dg-v40-header" role="banner">
        <div class="dg-v40-heading"><span>DELGROSSO VIAGGI · GESTIONALE</span><strong>${esc(title)}</strong></div>
        <div class="dg-v40-status"><span class="dg-v40-dot"></span><span>Gestionale online</span></div>
      </header>
      <aside id="dg-v40-drawer" class="dg-v40-drawer" aria-label="Navigazione Gestionale" aria-hidden="true">
        <div class="dg-v40-brand">
          <div class="dg-v40-logo"><img src="./assets/logo-sidebar.png" alt="Del Grosso Viaggi"><span>DG</span></div>
          <div class="dg-v40-brand-copy"><small>TRAVEL MANAGEMENT</small><strong>DELGROSSO VIAGGI</strong><em>Gestionale professionale</em></div>
          <button class="dg-v40-close" type="button" aria-label="Chiudi menu">×</button>
        </div>
        <nav class="dg-v40-nav" aria-label="Sezioni Gestionale">
          ${NAV.map(([label,id,icon])=>`<a href="${ROUTES[id]}" data-route="${id}" class="${key===id?'is-active':''}"><span class="dg-v40-icon" aria-hidden="true">${icon}</span><span>${label}</span></a>`).join('')}
        </nav>
        <div class="dg-v40-account"><div class="dg-v40-avatar">${esc(String(u.nome||u.username||'G').trim().charAt(0).toUpperCase())}</div><div><strong>${esc(u.nome||u.username||'Gestionale')}</strong><span>${esc(u.ruolo||'Operatore')}</span></div></div>
        <button class="dg-v40-logout" type="button">Esci</button>
      </aside>`;
    document.body.appendChild(shell);
    document.body.classList.add('dg-v40-ready');
    const btn=shell.querySelector('.dg-v40-menu'), close=shell.querySelector('.dg-v40-close'), backdrop=shell.querySelector('.dg-v40-backdrop'), drawer=shell.querySelector('.dg-v40-drawer');
    const setOpen=open=>{
      document.body.classList.toggle('dg-v40-open',open); btn.setAttribute('aria-expanded',String(open)); drawer.setAttribute('aria-hidden',String(!open)); backdrop.hidden=!open;
      document.body.style.overflow=open?'hidden':'';
      if(open) setTimeout(()=>drawer.querySelector('a.is-active')?.focus(),40);
    };
    btn.addEventListener('click',()=>setOpen(!document.body.classList.contains('dg-v40-open')));
    close.addEventListener('click',()=>setOpen(false)); backdrop.addEventListener('click',()=>setOpen(false));
    shell.querySelectorAll('.dg-v40-nav a').forEach(a=>a.addEventListener('click',()=>setOpen(false)));
    document.addEventListener('keydown',e=>{if(e.key==='Escape')setOpen(false);});
    shell.querySelector('.dg-v40-logout').addEventListener('click',()=>{localStorage.removeItem('dg_session');location.href='./login.html';});
    const logo=shell.querySelector('.dg-v40-logo img'); logo?.addEventListener('error',()=>{logo.style.display='none';});
  }
  const boot=()=>{try{build();}catch(e){console.error('[DG V40 shell]',e);}};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
  window.addEventListener('load',boot,{once:true});
})();
