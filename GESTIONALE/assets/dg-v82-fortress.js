/* DEL GROSSO GESTIONALE V82 — FORTRESS / RESILIENCE LAYER
 * Non sostituisce i servizi dati: aggiunge osservabilità, recupero errori e gestione rete.
 */
(()=>{
 'use strict';
 if(window.__DG_V82_FORTRESS__) return; window.__DG_V82_FORTRESS__=true;
 const state={errors:0,online:navigator.onLine!==false,longTask:0,lastError:null,retries:0};
 window.DG_FORTRESS=Object.freeze({version:'V82',state});
 const root=()=>{let x=document.getElementById('dg-v82-fortress');if(x)return x;x=document.createElement('div');x.id='dg-v82-fortress';x.className='dg-v82-fortress';x.setAttribute('role','status');x.setAttribute('aria-live','polite');document.body?.appendChild(x);return x};
 const show=(kind,title,msg,action)=>{const x=root();x.className=`dg-v82-fortress is-visible ${kind}`;x.innerHTML=`<div class="dg-v82-fortress-dot"></div><div class="dg-v82-fortress-copy"><strong>${title}</strong><span>${msg}</span></div>${action?`<button type="button" id="dgV82Action">${action}</button>`:''}<button type="button" class="dg-v82-close" aria-label="Chiudi">×</button>`;x.querySelector('.dg-v82-close').onclick=()=>x.classList.remove('is-visible');x.querySelector('#dgV82Action')?.addEventListener('click',()=>location.reload());};
 const hide=()=>document.getElementById('dg-v82-fortress')?.classList.remove('is-visible');
 const humanError=e=>String(e?.message||e||'Errore inatteso').replace(/\s+/g,' ').slice(0,220);
 window.addEventListener('error',e=>{state.errors++;state.lastError=humanError(e.error||e.message);if(state.errors>=2)show('warn','Protezione attiva','È stato rilevato un errore nell’interfaccia. I dati Supabase non vengono modificati automaticamente.','Ricarica');});
 window.addEventListener('unhandledrejection',e=>{state.errors++;state.lastError=humanError(e.reason);if(state.errors>=2)show('warn','Operazione da riprovare','Una richiesta non è andata a buon fine. Puoi continuare a usare il gestionale o ricaricare la pagina.','Ricarica');});
 const net=online=>{state.online=online;document.documentElement.dataset.dgNetwork=online?'online':'offline';if(online){hide();state.retries=0;setTimeout(()=>{try{window.DG_SUPABASE_SYNC?.healthCheck?.().catch(()=>{})}catch(_){ }},700);}else show('offline','Connessione assente','Nessun dato viene cancellato: appena la rete torna disponibile il gestionale riprova a sincronizzarsi.');};
 addEventListener('online',()=>net(true));addEventListener('offline',()=>net(false));
 // Realtime reconnect ownership stays in the central Supabase layer.
 // This layer only records status, avoiding duplicate reconnect timers.
 addEventListener('dg:supabase:realtime-status',e=>{
   const s=e.detail?.status;
   if(s==='SUBSCRIBED') state.retries=0;
 });
 // Long-task observation is diagnostic only; it never blocks application work.
 try{if('PerformanceObserver' in window){const po=new PerformanceObserver(list=>{for(const e of list.getEntries()){if(e.duration>120){state.longTask++;document.documentElement.dataset.dgLongTask='1';}}});po.observe({entryTypes:['longtask']});}}catch(_){ }
 // Keep pages responsive when hidden: ask realtime consumers to refresh only when visible again.
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){setTimeout(()=>{try{window.DG_SUPABASE_SYNC?.healthCheck?.().catch(()=>{})}catch(_){ }},350);}});
})();
