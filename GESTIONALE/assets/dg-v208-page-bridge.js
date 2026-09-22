/* V209 page bridge — no forced reloads. Native modules receive a fresh data event. */
(()=>{
 'use strict'; if(window.__DG_V209_PAGE_BRIDGE__)return; window.__DG_V209_PAGE_BRIDGE__=true;
 const page=(location.pathname.split('/').pop()||'').toLowerCase();
 window.addEventListener('dg:live:complete',e=>{
   const c=e.detail?.counts||{};
   if(page==='prenotazioni.html'){
     window.dispatchEvent(new CustomEvent('dg:bookings-data-changed',{detail:{table:'prenotazioni',count:c.prenotazioni||0,counts:c}}));
   }
   if(page==='flotta.html') window.dispatchEvent(new CustomEvent('dg:fleet-data-changed',{detail:{table:'flotta',count:c.flotta||0,counts:c}}));
 });
})();
