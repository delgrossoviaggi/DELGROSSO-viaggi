/* DELGROSSO VIAGGI — V41 stable unified shell */
(() => {
  'use strict';
  if (window.__DG_SHELL_V41__) return;
  window.__DG_SHELL_V41__ = true;

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
  const TITLES = {
    dashboard:'Dashboard',viaggi:'Viaggi',prenotazioni:'Prenotazioni',clienti:'Clienti',flotta:'Flotta',
    pagamenti:'Pagamenti',archivio:'Archivio documenti',preventivi:'Preventivi',notifiche:'Notifiche',
    checkin:'CHECK-IN',statistiche:'Statistiche',impostazioni:'Impostazioni'
  };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const getSession = () => {
    try { return JSON.parse(localStorage.getItem('dg_session') || 'null'); }
    catch { return null; }
  };
  const pageKey = () => {
    const p = location.pathname.toLowerCase();
    if (p.endsWith('/archivio.html') || p.includes('/archivio/')) return 'archivio';
    if (p.endsWith('/prenotazione.html') || p.endsWith('/prenotazioni.html') || p.includes('/prenotazioni/')) return 'prenotazioni';
    if (p.endsWith('/preventivi-nuovo.html')) return 'preventivi';
    for (const id of Object.keys(TITLES)) if (p.includes(id)) return id;
    return 'dashboard';
  };
  const removeLegacyShells = () => {
    ['dg-brand-shell','dg-shell-v39','dg-shell-v38','dg-shell-v37','dg-shell-v36'].forEach(id => document.getElementById(id)?.remove());
    document.querySelectorAll('.dg-v38-shell,.dg-v39-shell,.dg-v37-shell,.dg-v36-shell,footer.dg-brand-shell__footer').forEach(el => el.remove());
    document.body.classList.remove('dg-v38-ready','dg-v39-ready','dg-v39-open','dg-shell-open','dg-mobile-menu-open');
  };
  function build() {
    if (!document.body || /(?:^|\/)login\.html$/i.test(location.pathname)) return;
    if (document.getElementById('dg-shell-v41')) return;
    removeLegacyShells();
    const u = getSession() || {nome:'Gestionale', username:'Gestionale', ruolo:'Operatore'};
    const key = pageKey();
    const shell = document.createElement('div');
    shell.id = 'dg-shell-v41';
    shell.className = 'dg-v41-shell';
    shell.innerHTML = `
      <button class="dg-v41-menu" type="button" aria-label="Apri menu Gestionale" aria-controls="dg-v41-drawer" aria-expanded="false">
        <span class="dg-v41-hamb"><i></i><i></i><i></i></span><b>MENU</b>
      </button>
      <div class="dg-v41-backdrop" hidden></div>
      <header class="dg-v41-header" role="banner">
        <div class="dg-v41-heading"><span>DELGROSSO VIAGGI · GESTIONALE</span><strong>${esc(TITLES[key] || 'Gestionale')}</strong></div>
        <div class="dg-v41-status"><span class="dg-v41-dot"></span><span>Operativo · V45</span></div>
      </header>
      <aside id="dg-v41-drawer" class="dg-v41-drawer" aria-label="Navigazione Gestionale" aria-hidden="true">
        <div class="dg-v41-brand">
          <div class="dg-v41-logo"><img src="./assets/logo-sidebar.png" alt="Del Grosso Viaggi"><span>DG</span></div>
          <div class="dg-v41-brand-copy"><small>TRAVEL MANAGEMENT</small><strong>DELGROSSO VIAGGI</strong><em>Gestionale professionale</em></div>
          <button class="dg-v41-close" type="button" aria-label="Chiudi menu">×</button>
        </div>
        <nav class="dg-v41-nav" aria-label="Sezioni Gestionale">
          ${NAV.map(([label,id,icon]) => `<a href="${ROUTES[id]}" data-route="${id}" class="${key===id?'is-active':''}"><span class="dg-v41-icon" aria-hidden="true">${icon}</span><span>${label}</span></a>`).join('')}
        </nav>
        <div class="dg-v41-account"><div class="dg-v41-avatar">${esc(String(u.nome||u.username||'G').trim().charAt(0).toUpperCase())}</div><div><strong>${esc(u.nome||u.username||'Gestionale')}</strong><span>${esc(u.ruolo||'Operatore')}</span></div></div>
        <button class="dg-v41-logout" type="button">Esci</button>
      </aside>`;
    document.body.appendChild(shell);
    document.body.classList.add('dg-v41-ready');

    const btn = shell.querySelector('.dg-v41-menu');
    const close = shell.querySelector('.dg-v41-close');
    const backdrop = shell.querySelector('.dg-v41-backdrop');
    const drawer = shell.querySelector('.dg-v41-drawer');
    const setOpen = open => {
      document.body.classList.toggle('dg-v41-open', open);
      btn.setAttribute('aria-expanded', String(open));
      drawer.setAttribute('aria-hidden', String(!open));
      backdrop.hidden = !open;
      if (open) {
        document.body.dataset.dgScrollLock = '1';
        document.body.style.overflow = 'hidden';
        setTimeout(() => drawer.querySelector('a.is-active')?.focus(), 30);
      } else {
        delete document.body.dataset.dgScrollLock;
        document.body.style.overflow = '';
        btn.focus({preventScroll:true});
      }
    };
    btn.addEventListener('click', () => setOpen(!document.body.classList.contains('dg-v41-open')));
    close.addEventListener('click', () => setOpen(false));
    backdrop.addEventListener('click', () => setOpen(false));
    shell.querySelectorAll('.dg-v41-nav a').forEach(a => a.addEventListener('click', () => setOpen(false)));
    const onKey = e => { if (e.key === 'Escape' && document.body.classList.contains('dg-v41-open')) setOpen(false); };
    document.addEventListener('keydown', onKey);
    shell.querySelector('.dg-v41-logout').addEventListener('click', () => {
      try { localStorage.removeItem('dg_session'); } finally { location.href = './login.html'; }
    });
    const logo = shell.querySelector('.dg-v41-logo img');
    logo?.addEventListener('error', () => { logo.style.display='none'; shell.querySelector('.dg-v41-logo span').style.display='block'; }, {once:true});
  }
  const boot = () => { try { build(); } catch (e) { console.error('[DG V41 shell]', e); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();
})();
