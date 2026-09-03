/* DELGROSSO GESTIONALE V37 — ONE SHELL, ALL DEVICES */
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
  const session = () => { try { const s=JSON.parse(localStorage.getItem('dg_session')||'null'); return s?.authenticated ? s : null; } catch { return null; } };
  const role = r => ({admin:'Amministratore',operatore:'Operatore',collaboratore:'Collaboratore'}[String(r||'').toLowerCase()]||'Operatore');
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const pageKey=()=>{
    const p=location.pathname.toLowerCase();
    if(p.includes('archivio'))return'archivio'; if(p.includes('prenotazione'))return'prenotazioni';
    if(p.includes('dashboard'))return'dashboard'; if(p.includes('viaggi'))return'viaggi'; if(p.includes('clienti'))return'clienti';
    if(p.includes('flotta'))return'flotta'; if(p.includes('pagamenti'))return'pagamenti'; if(p.includes('preventivi'))return'preventivi';
    if(p.includes('notifiche'))return'notifiche'; if(p.includes('checkin'))return'checkin'; if(p.includes('statistiche'))return'statistiche';
    if(p.includes('impostazioni'))return'impostazioni'; return'';
  };
  function removeLegacy(){
    document.getElementById('dg-brand-shell')?.remove();
    document.querySelectorAll('body > .dg-brand-shell__footer, footer.dg-brand-shell__footer').forEach(x=>x.remove());
    document.body.classList.remove('dg-has-brand-shell','dg-shell-open');
  }
  function inject(){
    if(document.getElementById('dg-shell-v37'))return true;
    const u=session();
    if(!u){ if(!/login\.html$/i.test(location.pathname)) location.replace('./login.html'); return false; }
    removeLegacy();
    const key=pageKey();
    const shell=document.createElement('div'); shell.id='dg-shell-v37'; shell.className='dg-v37-shell';
    shell.innerHTML=`
      <button class="dg-v37-menu" type="button" aria-label="Apri menu Gestionale" aria-expanded="false"><span aria-hidden="true">☰</span><span class="dg-v37-menu-word">Menu</span></button>
      <div class="dg-v37-backdrop" hidden></div>
      <header class="dg-v37-header">
        <div class="dg-v37-heading"><span>DELGROSSO VIAGGI · GESTIONALE</span><strong>${esc(document.querySelector('h1')?.textContent?.trim() || document.title.split(' - ')[0] || 'Gestionale')}</strong></div>
        <div class="dg-v37-user"><span class="dg-v37-online"></span><span class="dg-v37-user-name">${esc(u.nome||u.username||'Utente')}</span></div>
      </header>
      <aside class="dg-v37-drawer" aria-label="Navigazione Gestionale">
        <div class="dg-v37-brand"><div class="dg-v37-logo-wrap"><img src="./assets/logo-sidebar.png" alt="Del Grosso Viaggi"></div><div><span>TRAVEL CRM</span><strong>DELGROSSO VIAGGI</strong><small>Gestionale professionale</small></div><button class="dg-v37-close" type="button" aria-label="Chiudi menu">×</button></div>
        <nav class="dg-v37-nav">${NAV.map(([label,id,icon])=>`<a href="${ROUTES[id]}" class="${key===id?'is-active':''}" data-route="${id}"><span class="dg-v37-icon" aria-hidden="true">${icon}</span><span>${label}</span></a>`).join('')}</nav>
        <div class="dg-v37-account"><div class="dg-v37-avatar">${esc(String(u.nome||u.username||'U').trim().charAt(0).toUpperCase())}</div><div><strong>${esc(u.nome||u.username||'Utente')}</strong><span>${esc(role(u.ruolo))}</span></div></div>
        <button class="dg-v37-logout" type="button">Esci</button>
      </aside>`;
    document.body.appendChild(shell);
    document.body.classList.add('dg-v37-ready');
    const btn=shell.querySelector('.dg-v37-menu'), close=shell.querySelector('.dg-v37-close'), backdrop=shell.querySelector('.dg-v37-backdrop'), drawer=shell.querySelector('.dg-v37-drawer');
    const setOpen=open=>{document.body.classList.toggle('dg-v37-open',open);btn.setAttribute('aria-expanded',String(open));backdrop.hidden=!open;document.body.style.overflow=open?'hidden':'';};
    btn.addEventListener('click',()=>setOpen(!document.body.classList.contains('dg-v37-open')));
    close.addEventListener('click',()=>setOpen(false)); backdrop.addEventListener('click',()=>setOpen(false));
    shell.querySelectorAll('.dg-v37-nav a').forEach(a=>a.addEventListener('click',()=>setOpen(false)));
    shell.querySelector('.dg-v37-logout').addEventListener('click',()=>{localStorage.removeItem('dg_session');location.href='./login.html';});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')setOpen(false);});
    return true;
  }
  const boot=()=>{removeLegacy();inject();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.addEventListener('load',boot,{once:true});
  const observer=new MutationObserver(()=>{
    if(document.getElementById('dg-brand-shell')) removeLegacy();
    if(!document.getElementById('dg-shell-v37') && session()) inject();
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
})();
