/* DELGROSSO GESTIONALE V205 — LIVE SUPABASE SYNC
 * The local login remains the UI gate. Data sync uses the configured Supabase
 * public client because the Gestionale schema already exposes its operational
 * policies to anon/authenticated. Realtime + heartbeat + safe page refresh.
 */
(function(){
  'use strict';
  if(window.__DG_V205_LIVE_SYNC__) return;
  window.__DG_V205_LIVE_SYNC__=true;

  const HEARTBEAT=20000;
  const CRITICAL=new Set(['prenotazioni.html','pagamenti.html','checkin.html','centro-operativo.html','clienti.html','noleggi-bus.html','flotta.html','economia.html','archivio.html','dashboard.html','control-room-viaggio.html','dossier-viaggio.html','dossier-cliente.html']);
  const page=(location.pathname.split('/').pop()||'dashboard.html').toLowerCase();
  let timer=null, busy=false, lastSignature='';
  const text=v=>String(v??'').trim();
  const status=()=>document.querySelector('#dg-v155-sync-status');

  function label(message,state='online'){
    const el=status(); if(!el)return;
    el.dataset.status=state;
    const l=el.querySelector('.dg-v155-label');
    if(l) l.textContent=message;
  }

  function safeToRefresh(){
    if(!CRITICAL.has(page)) return false;
    if(window.DG_UNSAVED_CHANGES===true) return false;
    const a=document.activeElement;
    if(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return false;
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
        if(s>max) max=s;
      }
      return `${k}:${rows.length}:${max}`;
    }).join('||');
  }

  async function api(){
    for(let i=0;i<80;i++){
      if(window.DG_SUPABASE_SYNC?.pullAll) return window.DG_SUPABASE_SYNC;
      await new Promise(r=>setTimeout(r,100));
    }
    throw Error('Servizio Supabase non disponibile.');
  }

  async function pullAll(reason='heartbeat'){
    if(busy || !navigator.onLine) return null;
    busy=true;
    try{
      label('SUPABASE · sincronizzazione live…','checking');
      const sync=await api();
      const pulled=await sync.pullAll({cache:true});
      if(!pulled?.ok){
        const failed=(pulled?.errors||[]).map(x=>x.table).join(', ');
        throw Error(`Sincronizzazione incompleta${failed?`: ${failed}`:''}`);
      }
      const sig=signature(pulled.result);
      const changed=!!lastSignature && sig!==lastSignature;
      lastSignature=sig;
      localStorage.setItem('dg_v205_last_live_sync',String(Date.now()));
      window.dispatchEvent(new CustomEvent('dg:live-sync-complete',{detail:{reason,changed,counts:Object.fromEntries(Object.entries(pulled.result||{}).map(([k,v])=>[k,Array.isArray(v)?v.length:0]))}}));
      label(`SUPABASE · LIVE · ${new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}`,'online');
      if(changed && safeToRefresh()){
        setTimeout(()=>{ try{ location.reload(); }catch(_){} },250);
      }
      return pulled;
    }catch(err){
      label('SUPABASE · sincronizzazione da riprovare','warning');
      window.dispatchEvent(new CustomEvent('dg:live-sync-error',{detail:{message:text(err?.message||err)}}));
      return null;
    }finally{busy=false;}
  }

  function onRealtime(e){
    const table=e?.detail?.table;
    if(!table || !navigator.onLine) return;
    label('SUPABASE · aggiornamento ricevuto…','checking');
    clearTimeout(timer);
    timer=setTimeout(()=>pullAll(`realtime:${table}`),250);
  }

  function boot(){
    window.addEventListener('dg:supabase:changed',onRealtime);
    window.addEventListener('online',()=>pullAll('online'));
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')pullAll('visible')});
    pullAll('boot');
    timer=setInterval(()=>pullAll('heartbeat'),HEARTBEAT);
  }

  window.DG_LIVE_SYNC={pullAll,stop:()=>{if(timer)clearInterval(timer);timer=null}};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
