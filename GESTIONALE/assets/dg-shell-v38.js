/* DELGROSSO GESTIONALE V38 — single navigation shell, resilient on every device */
(() => {
  'use strict';
  const ROUTES = {
    dashboard:'./dashboard.html', viaggi:'./viaggi.html', prenotazioni:'./prenotazioni.html',
    clienti:'./clienti.html', flotta:'./flotta.html', pagamenti:'./pagamenti.html',
    archivio:'./archivio.html', preventivi:'./preventivi.html', notifiche:'./notifiche.html',
    checkin:'./checkin.html', statistiche:'./statistiche.html', impostazioni:'./impostazioni.html'
  };
  const NAV = [
    ['Dashboard','dashboard','⌂'], ['Viaggi','viaggi','◈'], ['Prenotazioni','prenotazioni','▤'],
    ['Clienti','clienti','♙'], ['Flotta','flotta','▱'], ['Pagamenti','pagamenti','€'],
    ['Archivio','archivio','▣'], ['Preventivi','preventivi','▤'], ['Notifiche','notifiche','♢'],
    ['CHECK-IN','checkin','⌗'], ['Statistiche','statistiche','▥'], ['Impostazioni','impostazioni','⚙']
  ];
  const getSession = () => { try { return JSON.parse(localStorage.getItem('dg_session') || 'null'); } catch { return null; } };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const role = r => ({admin:'Amministratore',operatore:'Operatore',collaboratore:'Collaboratore'}[String(r||'').toLowerCase()] || 'Operatore');
  const pageKey = () => {
    const p = location.pathname.toLowerCase();
    if (p.endsWith('/archivio.html') || p.includes('/archivio/')) return 'archivio';
    if (p.endsWith('/prenotazione.html') || p.endsWith('/prenotazioni.html') || p.includes('/prenotazioni/')) return p.endsWith('prenotazione.html') ? 'prenotazioni' : 'prenotazioni';
    for (const id of ['dashboard','viaggi','clienti','flotta','pagamenti','preventivi','notifiche','checkin','statistiche','impostazioni']) if (p.includes(id)) return id;
    return '';
  };
  function removeLegacy() {
    document.getElementById('dg-brand-shell')?.remove();
    document.querySelectorAll('.dg-brand-shell__footer, footer.dg-brand-shell__footer').forEach(x => x.remove());
    document.body.classList.remove('dg-has-brand-shell','dg-shell-open','dg-mobile-menu-open','dg-v36-ready','dg-v37-ready');
  }
  function inject() {
    if (document.getElementById('dg-shell-v38')) return true;
    if (/login\.html$/i.test(location.pathname)) return false;
    const u = getSession() || { nome:'Gestionale', username:'Gestionale', ruolo:'operatore' };
    removeLegacy();
    const key = pageKey();
    const title = document.querySelector('h1')?.textContent?.trim() || document.title.split(' - ')[0] || 'Gestionale';
    const shell = document.createElement('div');
    shell.id = 'dg-shell-v38'; shell.className = 'dg-v38-shell';
    shell.innerHTML = `
      <button class="dg-v38-menu" type="button" aria-label="Apri menu Gestionale" aria-controls="dg-v38-drawer" aria-expanded="false"><span>☰</span><b>MENU</b></button>
      <div class="dg-v38-backdrop" hidden></div>
      <header class="dg-v38-header">
        <div class="dg-v38-heading"><span>DELGROSSO VIAGGI · GESTIONALE</span><strong>${esc(title)}</strong></div>
        <div class="dg-v38-system"><span class="dg-v38-online"></span><span>Sistema operativo</span></div>
      </header>
      <aside id="dg-v38-drawer" class="dg-v38-drawer" aria-label="Navigazione Gestionale" aria-hidden="true">
        <div class="dg-v38-brand">
          <div class="dg-v38-logo"><img src="./assets/logo-sidebar.png" alt="Del Grosso Viaggi"></div>
          <div class="dg-v38-brand-text"><span>TRAVEL CRM</span><strong>DELGROSSO VIAGGI</strong><small>Gestionale professionale</small></div>
          <button class="dg-v38-close" type="button" aria-label="Chiudi menu">×</button>
        </div>
        <nav class="dg-v38-nav">
          ${NAV.map(([label,id,icon]) => `<a href="${ROUTES[id]}" class="${key===id?'is-active':''}" data-route="${id}"><span class="dg-v38-icon" aria-hidden="true">${icon}</span><span>${label}</span></a>`).join('')}
        </nav>
        <div class="dg-v38-account"><div class="dg-v38-avatar">${esc(String(u.nome||u.username||'G').trim().charAt(0).toUpperCase())}</div><div><strong>${esc(u.nome||u.username||'Gestionale')}</strong><span>${esc(role(u.ruolo))}</span></div></div>
        <button class="dg-v38-logout" type="button">Esci</button>
      </aside>`;
    document.body.appendChild(shell);
    document.body.classList.add('dg-v38-ready');
    const btn=shell.querySelector('.dg-v38-menu'), close=shell.querySelector('.dg-v38-close'), backdrop=shell.querySelector('.dg-v38-backdrop'), drawer=shell.querySelector('.dg-v38-drawer');
    const setOpen = open => {
      document.body.classList.toggle('dg-v38-open', open); btn.setAttribute('aria-expanded', String(open)); drawer.setAttribute('aria-hidden', String(!open)); backdrop.hidden=!open;
      document.body.style.overflow = open ? 'hidden' : '';
      if (open) setTimeout(() => drawer.querySelector('a.is-active')?.focus(), 20);
    };
    btn.addEventListener('click', () => setOpen(!document.body.classList.contains('dg-v38-open')));
    close.addEventListener('click', () => setOpen(false)); backdrop.addEventListener('click', () => setOpen(false));
    shell.querySelectorAll('.dg-v38-nav a').forEach(a => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });
    shell.querySelector('.dg-v38-logout').addEventListener('click', () => { localStorage.removeItem('dg_session'); location.href='./login.html'; });
    return true;
  }
  const boot = () => inject();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();
  window.addEventListener('load', boot, {once:true});
})();
