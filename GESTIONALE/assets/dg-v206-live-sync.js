/* DELGROSSO GESTIONALE V206 — OPERATIONAL LIVE SYNC
 * Realtime first + periodic reconciliation + safe page refresh hooks.
 * The local Gestionale login remains the UI gate; Supabase is the source of truth.
 */
(function(){
  'use strict';
  if(window.__DG_V206_LIVE_SYNC__) return;
  window.__DG_V206_LIVE_SYNC__=true;
  const HEARTBEAT=20000;
  const CRITICAL=new Set(['prenotazioni.html','pagamenti.html','checkin.html','centro-operativo.html','clienti.html','noleggi-bus.html','flotta.html','economia.html','archivio.html','dashboard.html','control-room-viaggio.html','dossier-viaggio.html','dossier-cliente.html']);
  const page=(location.pathname.split('/').pop()||'dashboard.html').toLowerCase();
  let timer=null,busy=false,lastSignature='';
  const status=()=>document.querySelector('#dg-v155-sync-status');
  const label=(message,state='online')=>{const el=status();if(!el)return;el.dataset.status=state;const l=el.querySelector('.dg-v155-label');if(l)l.textContent=message};
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  function safeToRefresh(){
    if(!CRITICAL.has(page)) return true;
    if(window.DG_UNSAVED_CHANGES===true) return false;
    const a=document.activeElement;
    if(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return false;
    if(document.querySelector('dialog[open],.modal:not(.hidden),[aria-modal="true"]')) return false;
    return true;
  }
  function signature(result){
    const keys=['viaggi','prenotazioni','clienti','flotta','pagamenti','preventivi','noleggi_bus','noleggi_bus_mezzi','noleggi_bus_pagamenti','accessi_checkin','notifiche','attivita_gestionale','scadenze_gestionale','impostazioni','push_subscriptions'];
    return keys.map(k=>{
      const rows=Array.isArray(result?.[k])?result[k]:[];
      let max='';
      for(const r of rows){
        const s=`${r?.id||''}|${r?.updated_at||r?.created_at||r?.data_pagamento||r?.data||''}|${r?.confirmation_storage_path||r?.receipt_storage_path||''}|${r?.posti_occupati??''}|${r?.pagato??''}|${r?.saldo??''}`;
        if(s>max)max=s;
      }
      return `${k}:${rows.length}:${max}`;
    }).join('||');
  }
  async function api(){
    for(let i=0;i<100;i++){if(window.DG_SUPABASE_SYNC?.pullAll)return window.DG_SUPABASE_SYNC;await wait(100)}
    throw Error('Servizio Supabase non disponibile.');
  }
  async function refreshPage(reason){
    try{
      if(typeof window.DG_PAGE_REFRESH==='function'){await window.DG_PAGE_REFRESH(reason);return true}
      window.dispatchEvent(new CustomEvent('dg:request-page-refresh',{detail:{reason}}));
      return false;
    }catch(e){window.dispatchEvent(new CustomEvent('dg:page-refresh-error',{detail:{message:e?.message||String(e)}}));return false}
  }
  async function pullAll(reason='heartbeat'){
    if(busy||!navigator.onLine)return null;
    busy=true;
    try{
      label('SUPABASE · sincronizzazione…','checking');
      const sync=await api();
      const pulled=await sync.pullAll({cache:true});
      if(!pulled?.ok){const failed=(pulled?.errors||[]).map(x=>x.table).join(', ');throw Error(`Sincronizzazione incompleta${failed?`: ${failed}`:''}`)}
      const sig=signature(pulled.result),changed=!!lastSignature&&sig!==lastSignature;lastSignature=sig;
      localStorage.setItem('dg_v206_last_live_sync',String(Date.now()));
      const counts=Object.fromEntries(Object.entries(pulled.result||{}).map(([k,v])=>[k,Array.isArray(v)?v.length:0]));
      window.dispatchEvent(new CustomEvent('dg:live-sync-complete',{detail:{reason,changed,counts}}));
      label(`SUPABASE · LIVE · ${new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}`,'online');
      if(changed && safeToRefresh()){
        const refreshed=await refreshPage(reason);
        if(!refreshed && !window.DG_PAGE_REFRESH && CRITICAL.has(page)){
          setTimeout(()=>{try{if(safeToRefresh())location.reload()}catch(_){}},150);
        }
      }
      return pulled;
    }catch(err){
      label('SUPABASE · sincronizzazione da riprovare','warning');
      window.dispatchEvent(new CustomEvent('dg:live-sync-error',{detail:{message:String(err?.message||err)}}));
      return null;
    }finally{busy=false}
  }
  function onRealtime(e){const table=e?.detail?.table;if(!table||!navigator.onLine)return;label(`SUPABASE · ${table} aggiornato…`,'checking');clearTimeout(timer);timer=setTimeout(()=>pullAll(`realtime:${table}`),250)}
  function boot(){
    window.addEventListener('dg:supabase:changed',onRealtime);
    window.addEventListener('online',()=>pullAll('online'));
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')pullAll('visible')});
    pullAll('boot');
    timer=setInterval(()=>pullAll('heartbeat'),HEARTBEAT);
  }
  window.DG_LIVE_SYNC={pullAll,stop:()=>{if(timer)clearInterval(timer);timer=null},getLastSync:()=>Number(localStorage.getItem('dg_v206_last_live_sync')||0)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
