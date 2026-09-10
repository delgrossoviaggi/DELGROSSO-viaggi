
(() => {
  if(location.pathname.endsWith('dashboard.html')===false) return;
  const mount=()=>{
    if(document.querySelector('.dg-v54-dashboard-strip')) return;
    const host=document.querySelector('.app-shell') || document.body;
    const strip=document.createElement('section');
    strip.className='dg-v54-dashboard-strip';
    strip.innerHTML=`
      <div><span>CONTROL ROOM</span><strong>Gestionale sincronizzato</strong><small>Viaggi, prenotazioni, clienti, flotta, pagamenti, preventivi e noleggi in un unico ambiente.</small></div>
      <div class="dg-v54-dashboard-badges"><b>⚡ Live</b><b>☁ Supabase</b><b>📱 Responsive</b></div>`;
    host.prepend(strip);
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else setTimeout(mount,50);
})();
