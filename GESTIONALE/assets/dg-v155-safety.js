/* DELGROSSO GESTIONALE — V155 SAFETY / SYNC GUARD */
(function(){
  'use strict';
  const ID='dg-v155-sync-status';
  const text=(s)=>String(s||'').trim();
  function mount(){
    if(document.getElementById(ID)) return document.getElementById(ID);
    const el=document.createElement('div');
    el.id=ID;
    el.innerHTML='<span class="dg-v155-dot"></span><span class="dg-v155-label">Connessione…</span><button type="button" class="dg-v155-refresh" title="Controlla connessione">↻</button>';
    document.body.appendChild(el);
    return el;
  }
  function set(status,message){
    const el=mount();
    el.dataset.status=status;
    const label=el.querySelector('.dg-v155-label');
    if(label) label.textContent=message;
  }
  async function check(){
    if(!navigator.onLine){ set('offline','OFFLINE — dati non sincronizzati'); return false; }
    const api=window.DG_SUPABASE_SYNC;
    if(!api?.healthCheck){ set('waiting','SUPABASE — avvio…'); return false; }
    set('checking','Verifica Supabase…');
    try{
      const r=await api.healthCheck();
      if(r?.ok){ set('online',`SUPABASE ONLINE${r.latencyMs!=null?` · ${r.latencyMs} ms`:''}`); return true; }
      set('error','SUPABASE NON RAGGIUNGIBILE');
      return false;
    }catch(e){ set('error','SUPABASE NON RAGGIUNGIBILE'); return false; }
  }
  function bind(){
    const el=mount();
    el.querySelector('.dg-v155-refresh')?.addEventListener('click',()=>check());
    window.addEventListener('online',()=>check());
    window.addEventListener('offline',()=>set('offline','OFFLINE — dati non sincronizzati'));
    window.addEventListener('dg:supabase:online',e=>set('online',`SUPABASE ONLINE${e.detail?.latencyMs!=null?` · ${e.detail.latencyMs} ms`:''}`));
    window.addEventListener('dg:supabase:offline',()=>set('error','SUPABASE NON RAGGIUNGIBILE'));
    window.addEventListener('dg:supabase:realtime-status',e=>{
      const s=e.detail?.status;
      if(s==='SUBSCRIBED') set('online','SUPABASE ONLINE · REALTIME ATTIVO');
      else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(s)) set('warning','REALTIME IN RICONNESSIONE…');
    });
    window.addEventListener('dg:supabase:changed',()=>{
      if(navigator.onLine) set('online','AGGIORNAMENTO SUPABASE RICEVUTO');
    });
    window.addEventListener('dg:supabase:init-error',()=>set('error','ERRORE AVVIO SUPABASE'));
    window.addEventListener('beforeunload',function(e){
      if(window.DG_UNSAVED_CHANGES===true){e.preventDefault();e.returnValue='';}
    });
    check();
    window.setInterval(check,30000);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true}); else bind();
})();
