/* DEL GROSSO GESTIONALE V85 — STABILITY / BOOT GUARD
 * Keeps the frontend responsive by removing redundant dashboard UI layers,
 * throttling recovery work and avoiding duplicate realtime reconnect requests.
 */
(()=>{
 'use strict';
 if(window.__DG_V85_STABILITY__) return;
 window.__DG_V85_STABILITY__=true;

 // Dashboard V76 Agency and V76 Cockpit previously rendered overlapping KPI blocks.
 // The cockpit is the authoritative dashboard layer in V85.
 const page=location.pathname.split('/').pop()||'dashboard.html';
 const cleanDashboard=()=>{
   if(page!=='dashboard.html') return;
   document.querySelectorAll('.dg-v76-cockpit').forEach((el,i)=>{ if(i>0) el.remove(); });
   const legacy=document.querySelector('.dg-v76-cockpit:not(.dg76-cockpit)');
   if(legacy) legacy.remove();
 };
 if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',cleanDashboard,{once:true});
 else cleanDashboard();

 // Keep recovery/health checks single-flight and rate-limited.
 let healthTimer=0, healthBusy=false, lastHealth=0;
 const health=()=>{
   const now=Date.now();
   if(healthBusy || now-lastHealth<8000) return;
   const api=window.DG_SUPABASE_SYNC;
   if(!api?.healthCheck) return;
   lastHealth=now; healthBusy=true;
   Promise.resolve(api.healthCheck()).catch(()=>{}).finally(()=>{healthBusy=false;});
 };
 const scheduleHealth=(delay=900)=>{
   clearTimeout(healthTimer);
   healthTimer=setTimeout(health,delay);
 };
 addEventListener('online',()=>scheduleHealth(1200));
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')scheduleHealth(1200)});

 // Do not add another realtime reconnect loop: the central Supabase layer already
 // owns its bounded reconnect policy. This guard only records the latest status.
 let lastRealtimeStatus='';
 addEventListener('dg:supabase:realtime-status',e=>{
   const s=String(e.detail?.status||'');
   if(s===lastRealtimeStatus) return;
   lastRealtimeStatus=s;
   document.documentElement.dataset.dgRealtime=s.toLowerCase().replace(/[^a-z0-9_-]+/g,'-');
 });

 // One deferred cleanup pass after all legacy DOM enhancers have mounted.
 setTimeout(cleanDashboard,1200);
})();
