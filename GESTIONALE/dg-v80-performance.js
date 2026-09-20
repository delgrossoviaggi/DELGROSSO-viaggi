/* DEL GROSSO V80 — Performance & resilience layer.
   Keeps UI responsive: no synchronous polling, no global DOM rescans, no forced scrolling.
   Data/services are untouched. */
(()=>{
 'use strict';
 if(window.__DG_V80_PERF__) return; window.__DG_V80_PERF__=true;
 const raf=window.requestAnimationFrame||((fn)=>setTimeout(fn,16));
 // Prevent accidental double-submit while an action is already running.
 document.addEventListener('click',e=>{
   const b=e.target?.closest?.('button[type="submit"],button[data-busy-lock]');
   if(!b || b.disabled || b.dataset.dgBusy==='1') return;
   if(b.type==='submit' || b.hasAttribute('data-busy-lock')){
     b.dataset.dgBusy='1';
     const unlock=()=>{b.dataset.dgBusy='';};
     setTimeout(unlock,1200);
   }
 },true);
 // Yield long bursts of DOM work back to the browser.
 const original=window.DG_YIELD;
 window.DG_YIELD=original||function(fn){
   if(typeof fn!=='function') return;
   if('requestIdleCallback' in window) return requestIdleCallback(()=>fn(),{timeout:120});
   return raf(fn);
 };
 // Lightweight connectivity indicator; never blocks navigation or data requests.
 const setOnline=()=>document.documentElement.toggleAttribute('data-dg-online',navigator.onLine!==false);
 window.addEventListener('online',setOnline,{passive:true});
 window.addEventListener('offline',setOnline,{passive:true});
 setOnline();
 // Report errors without replacing the application's own handlers.
 window.addEventListener('error',()=>document.documentElement.setAttribute('data-dg-ui-error','1'),{passive:true});
 window.addEventListener('unhandledrejection',()=>document.documentElement.setAttribute('data-dg-ui-error','1'),{passive:true});
})();
