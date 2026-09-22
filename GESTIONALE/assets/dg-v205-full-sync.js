/* DELGROSSO GESTIONALE V205 — FULL SYNC LOCAL-AUTH SAFE */
(function(){
  'use strict';
  if(window.__DG_V205_FULL_SYNC__) return;
  window.__DG_V205_FULL_SYNC__=true;
  const LAST='dg_v205_last_full_sync';
  const MIN_INTERVAL=0;
  const text=v=>String(v??'').trim();
  const statusEl=()=>document.querySelector('#dg-v155-sync-status');
  function setLabel(message,state='online'){
    const el=statusEl(); if(!el)return;
    el.dataset.status=state;
    const label=el.querySelector('.dg-v155-label');
    if(label) label.textContent=message;
  }
  function addButton(){
    const el=statusEl();
    if(!el || el.querySelector('.dg-v205-full-sync')) return;
    const b=document.createElement('button');
    b.type='button'; b.className='dg-v205-full-sync';
    b.textContent='↻ Sincronizza tutto';
    b.title='Ricarica dal Supabase tutti i dati operativi del Gestionale';
    b.addEventListener('click',()=>run({manual:true}));
    el.appendChild(b);
  }
  async function api(){
    for(let i=0;i<40;i++){
      if(window.DG_SUPABASE_SYNC?.pullAll) return window.DG_SUPABASE_SYNC;
      await new Promise(r=>setTimeout(r,125));
    }
    throw new Error('Servizio Supabase non disponibile.');
  }
  function localAuthOk(){
    try{
      const u=JSON.parse(localStorage.getItem('dg_session')||'null');
      return !!u?.authenticated;
    }catch{return false}
  }
  async function run({manual=false}={}){
    if(window.__DG_V205_SYNC_BUSY__) return window.__DG_V205_SYNC_BUSY__;
    const job=(async()=>{
      if(!navigator.onLine) throw new Error('Connessione assente.');
      addButton();
      setLabel('SINCRONIZZAZIONE DATI…','checking');
      const sync=await api();
      const pulled=await sync.pullAll({cache:true});
      if(!pulled.ok){
        const failed=(pulled.errors||[]).map(x=>x.table).join(', ');
        throw new Error(`Alcune tabelle non sono state sincronizzate${failed?`: ${failed}`:''}.`);
      }
      localStorage.setItem(LAST,String(Date.now()));
      const counts=Object.fromEntries(Object.entries(pulled.result||{}).map(([k,v])=>[k,Array.isArray(v)?v.length:0]));
      const detail={ok:true,mode:'local-auth-safe-pull',counts,pulled,at:new Date().toISOString(),manual};
      window.dispatchEvent(new CustomEvent('dg:full-sync-complete',{detail}));
      setLabel(`DATI SINCRONIZZATI · ${new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}`,'online');
      window.dispatchEvent(new CustomEvent('dg:live-sync-complete',{detail:{manual,counts}}));
      return detail;
    })().catch(err=>{
      const message=text(err?.message||err)||'Sincronizzazione non riuscita.';
      setLabel('SYNC: '+message,'error');
      window.dispatchEvent(new CustomEvent('dg:full-sync-error',{detail:{message}}));
      if(manual) console.error('[DG V205 FULL SYNC]',err);
      throw err;
    }).finally(()=>{window.__DG_V205_SYNC_BUSY__=null;});
    window.__DG_V205_SYNC_BUSY__=job;
    return job;
  }
  async function maybeAuto(){
    const last=Number(localStorage.getItem(LAST)||0);
    if(Date.now()-last<MIN_INTERVAL) return;
    try{await run({manual:false})}catch(_){/* stato già mostrato nell'header */}
  }
  function boot(){
    addButton();
    window.addEventListener('dg:supabase:online',addButton);
    window.addEventListener('dg:supabase:auth',addButton);
    setTimeout(maybeAuto,1800);
  }
  window.DG_FULL_SYNC={run,addButton,getLastSync:()=>Number(localStorage.getItem(LAST)||0)};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
