/* DELGROSSO GESTIONALE V203 — FULL DATA SYNC / COHERENCE CENTER */
(function(){
  'use strict';
  if(window.__DG_V203_FULL_SYNC__) return;
  window.__DG_V203_FULL_SYNC__=true;
  const LAST='dg_v203_last_full_sync';
  const MIN_INTERVAL=5*60*1000;
  const text=v=>String(v??'').trim();
  const statusEl=()=>document.querySelector('#dg-v155-sync-status');
  function setLabel(message,state='online'){
    const el=statusEl();
    if(!el)return;
    el.dataset.status=state;
    const label=el.querySelector('.dg-v155-label');
    if(label) label.textContent=message;
  }
  function addButton(){
    const el=statusEl();
    if(!el || el.querySelector('.dg-v203-full-sync')) return;
    const b=document.createElement('button');
    b.type='button'; b.className='dg-v203-full-sync';
    b.textContent='↻ Sincronizza tutto';
    b.title='Allinea prenotazioni, pagamenti, viaggi e dati operativi';
    b.addEventListener('click',()=>run({manual:true}));
    el.appendChild(b);
  }
  async function api(){
    for(let i=0;i<40;i++){
      if(window.DG_SUPABASE_SYNC?.getClient) return window.DG_SUPABASE_SYNC;
      await new Promise(r=>setTimeout(r,125));
    }
    throw new Error('Servizio Supabase non disponibile.');
  }
  async function run({manual=false}={}){
    if(window.__DG_V203_SYNC_BUSY__) return window.__DG_V203_SYNC_BUSY__;
    const job=(async()=>{
      if(!navigator.onLine) throw new Error('Connessione assente.');
      addButton();
      setLabel('SINCRONIZZAZIONE COMPLETA…','checking');
      const sync=await api();
      const sb=await sync.getClient();
      const session=await sb.auth.getSession();
      if(!session?.data?.session) throw new Error('Sessione gestionale non autenticata.');
      let integrity=null;
      const rpc=await sb.rpc('sync_gestionale_integrity');
      if(rpc.error) throw new Error(rpc.error.message||'Sincronizzazione server non riuscita.');
      integrity=rpc.data;
      const pulled=await sync.pullAll({cache:true});
      if(!pulled.ok) throw new Error('Sincronizzazione server completata, ma alcune tabelle non sono state lette.');
      localStorage.setItem(LAST,String(Date.now()));
      const detail={ok:true,integrity,pulled,at:new Date().toISOString(),manual};
      window.dispatchEvent(new CustomEvent('dg:full-sync-complete',{detail}));
      setLabel(`TUTTO SINCRONIZZATO · ${new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}`,'online');
      if(manual && window.DG_UNSAVED_CHANGES!==true) setTimeout(()=>location.reload(),450);
      return detail;
    })().catch(err=>{
      const message=text(err?.message||err)||'Sincronizzazione non riuscita.';
      setLabel('SYNC: '+message,'error');
      window.dispatchEvent(new CustomEvent('dg:full-sync-error',{detail:{message}}));
      throw err;
    }).finally(()=>{window.__DG_V203_SYNC_BUSY__=null;});
    window.__DG_V203_SYNC_BUSY__=job;
    return job;
  }
  async function maybeAuto(){
    const last=Number(localStorage.getItem(LAST)||0);
    if(Date.now()-last<MIN_INTERVAL) return;
    try{await run({manual:false})}catch(_){/* health UI already reports the issue */}
  }
  function boot(){
    addButton();
    window.addEventListener('dg:supabase:online',addButton);
    setTimeout(maybeAuto,1800);
  }
  window.DG_FULL_SYNC={run,addButton,getLastSync:()=>Number(localStorage.getItem(LAST)||0)};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
