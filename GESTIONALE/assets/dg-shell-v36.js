/* DELGROSSO GESTIONALE V36 — resilient unified shell */
(() => {
  const ROUTES = {
    dashboard:'./dashboard.html', viaggi:'./viaggi.html', prenotazioni:'./prenotazioni.html',
    clienti:'./clienti.html', flotta:'./flotta.html', pagamenti:'./pagamenti.html',
    archivio:'./archivio.html', preventivi:'./preventivi.html', notifiche:'./notifiche.html',
    checkin:'./checkin.html', statistiche:'./statistiche.html', impostazioni:'./impostazioni.html'
  };
  const NAV = [
    ['Dashboard','dashboard','⌂'],['Viaggi','viaggi','◈'],['Prenotazioni','prenotazioni','▤'],['Clienti','clienti','♙'],
    ['Flotta','flotta','▱'],['Pagamenti','pagamenti','€'],['Archivio','archivio','▣'],['Preventivi','preventivi','▤'],
    ['Notifiche','notifiche','♢'],['CHECK-IN','checkin','⌗'],['Statistiche','statistiche','▥'],['Impostazioni','impostazioni','⚙']
  ];
  const session = () => { try { const s=JSON.parse(localStorage.getItem('dg_session')||'null'); return s?.authenticated?s:null; } catch { return null; } };
  const role = r => ({admin:'Amministratore',operatore:'Operatore',collaboratore:'Collaboratore'}[String(r||'').toLowerCase()]||'Operatore');
  const pageKey = () => {
    const p=location.pathname.toLowerCase();
    if(p.includes('archivio')) return 'archivio'; if(p.includes('prenotazione')) return 'prenotazioni';
    if(p.includes('dashboard')) return 'dashboard'; if(p.includes('viaggi')) return 'viaggi'; if(p.includes('clienti')) return 'clienti';
    if(p.includes('flotta')) return 'flotta'; if(p.includes('pagamenti')) return 'pagamenti'; if(p.includes('preventivi')) return 'preventivi';
    if(p.includes('notifiche')) return 'notifiche'; if(p.includes('checkin')) return 'checkin'; if(p.includes('statistiche')) return 'statistiche';
    if(p.includes('impostazioni')) return 'impostazioni'; return '';
  };
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function inject(){
    if(document.getElementById('dg-shell-v36')) { document.body.classList.add('dg-v36-ready'); return true; }
    if(document.getElementById('dg-brand-shell')) { document.body.classList.add('dg-v36-ready','dg-v36-legacy'); return true; }
    const u=session(); if(!u) return false;
    const key=pageKey();
    const shell=document.createElement('div'); shell.id='dg-shell-v36'; shell.className='dg-v36-shell';
    shell.innerHTML=`
      <button class="dg-v36-menu" type="button" aria-label="Apri menu Gestionale" aria-expanded="false"><span class="dg-v36-bars">☰</span><span class="dg-v36-menu-text">Menu</span></button>
      <div class="dg-v36-backdrop" hidden></div>
      <aside class="dg-v36-drawer" aria-label="Navigazione Gestionale">
        <div class="dg-v36-brand">
          <img src="./assets/logo-sidebar.png" alt="Del Grosso Viaggi">
          <div><strong>DELGROSSO VIAGGI</strong><span>Gestionale professionale</span></div>
          <button class="dg-v36-close" type="button" aria-label="Chiudi menu">×</button>
        </div>
        <nav class="dg-v36-nav">
          ${NAV.map(([label,id,icon])=>`<a href="${ROUTES[id]}" class="${key===id?'is-active':''}" data-route="${id}"><span class="dg-v36-icon" aria-hidden="true">${icon}</span><span>${label}</span></a>`).join('')}
        </nav>
        <div class="dg-v36-account"><div class="dg-v36-avatar">${esc(String(u.nome||u.username||'U').trim().charAt(0).toUpperCase())}</div><div><strong>${esc(u.nome||u.username||'Utente')}</strong><span>${esc(role(u.ruolo))}</span></div></div>
        <button class="dg-v36-logout" type="button">Esci</button>
      </aside>
      <header class="dg-v36-header">
        <div class="dg-v36-title"><span>DELGROSSO VIAGGI · GESTIONALE</span><strong>${esc(document.querySelector('h1')?.textContent?.trim() || document.title.split(' - ')[0] || 'Gestionale')}</strong></div>
        <div class="dg-v36-header-right"><span class="dg-v36-status"><i></i> Sistema operativo</span><span class="dg-v36-user">${esc(u.nome||u.username||'Utente')}</span></div>
      </header>`;
    document.body.appendChild(shell); document.body.classList.add('dg-v36-ready');
    const btn=shell.querySelector('.dg-v36-menu'), close=shell.querySelector('.dg-v36-close'), backdrop=shell.querySelector('.dg-v36-backdrop'), drawer=shell.querySelector('.dg-v36-drawer');
    const setOpen=open=>{document.body.classList.toggle('dg-v36-open',open);btn.setAttribute('aria-expanded',String(open));backdrop.hidden=!open;document.body.style.overflow=open?'hidden':'';if(open) drawer.querySelector('a.is-active')?.focus()};
    btn.addEventListener('click',()=>setOpen(!document.body.classList.contains('dg-v36-open'))); close.addEventListener('click',()=>setOpen(false)); backdrop.addEventListener('click',()=>setOpen(false));
    shell.querySelectorAll('.dg-v36-nav a').forEach(a=>a.addEventListener('click',()=>setOpen(false)));
    document.addEventListener('keydown',e=>{if(e.key==='Escape')setOpen(false)});
    shell.querySelector('.dg-v36-logout').addEventListener('click',()=>{localStorage.removeItem('dg_session');location.href='./login.html'});
    return true;
  }
  const run=()=>{ if(!inject() && location.pathname.toLowerCase().includes('archivio')) { /* una pagina pubblica non deve ricevere il drawer */ } };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run,{once:true}); else run();
  window.addEventListener('load',()=>{ if(!document.getElementById('dg-shell-v36')) inject(); },{once:true});
})();
