/* DG V51 synchronization guard: connectivity + safe refresh signal. */
(()=>{'use strict';if(window.__DG_SYNC_V51__)return;window.__DG_SYNC_V51__=1;
const state={online:navigator.onLine,lastCheck:null};
window.DG_SYNC_V51={get state(){return {...state}},refresh(){window.dispatchEvent(new CustomEvent('dg:refresh',{detail:{source:'supabase',at:new Date().toISOString()}}))}};
window.addEventListener('online',()=>{state.online=true;window.dispatchEvent(new CustomEvent('dg:connection',{detail:{online:true}}));DG_SYNC_V51.refresh()});
window.addEventListener('offline',()=>{state.online=false;window.dispatchEvent(new CustomEvent('dg:connection',{detail:{online:false}}))});
})();
