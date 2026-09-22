/* DELGROSSO GESTIONALE V209 — DIRECT SUPABASE REST CORE
   No Supabase JS CDN dependency. Uses the project's publishable key directly over REST.
*/
(()=>{
'use strict';
if(window.__DG_V209_CORE__)return;window.__DG_V209_CORE__=true;
const SUPABASE_URL='https://chkuayhbmitdmzmmvona.supabase.co';
const SUPABASE_KEY='sb_publishable_H29K1BV5ZE1rT8xo0PIzVA_wF6zC7je';
const API=SUPABASE_URL+'/rest/v1';
const VERSION='V209';
const TABLES=['viaggi','prenotazioni','clienti','flotta','pagamenti','preventivi','noleggi_bus','noleggi_bus_mezzi','noleggi_bus_pagamenti','accessi_checkin','notifiche','attivita_gestionale','scadenze_gestionale','impostazioni','push_subscriptions'];
const CRITICAL=['prenotazioni','flotta','viaggi','clienti','pagamenti'];
let pulling=false,initialized=false,timer=null;
const now=()=>new Date().toISOString();
const stateKey='dg_live_sync_v209';
const headers=()=>({apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY,Accept:'application/json','Cache-Control':'no-cache','x-dg-client':'delgrosso-gestionale-v209'});
const emit=(name,detail={})=>window.dispatchEvent(new CustomEvent(name,{detail:{...detail,version:VERSION,at:now()}}));
function setState(p){let s={};try{s=JSON.parse(localStorage.getItem(stateKey)||'{}')}catch{};s={...s,...p,url:SUPABASE_URL,version:VERSION,at:now()};try{localStorage.setItem(stateKey,JSON.stringify(s))}catch{};emit('dg:live:status',s);return s}
async function rest(table,query='select=*'){
 const u=API+'/'+encodeURIComponent(table)+'?'+query;
 const r=await fetch(u,{method:'GET',headers:headers(),cache:'no-store',credentials:'omit'});
 const text=await r.text();
 if(!r.ok)throw Error(`Supabase REST ${table} HTTP ${r.status}${text?' — '+text.slice(0,240):''}`);
 try{const data=JSON.parse(text);return Array.isArray(data)?data:[]}catch{throw Error(`Supabase REST ${table}: risposta non JSON`)}
}
async function pullTable(table){
 const rows=await rest(table,'select=*');
 try{localStorage.setItem(`dg_snapshot_${table}_v209`,JSON.stringify({at:now(),rows}))}catch{}
 emit('dg:live:table:'+table,{table,rows,count:rows.length,source:'rest'});
 emit('dg:supabase:changed',{table,rows,count:rows.length,source:'rest'});
 return rows;
}
async function pullAll(){
 if(pulling)return{ok:false,busy:true}; pulling=true; setState({status:'syncing',error:null});
 const result={},errors=[];
 try{for(const table of TABLES){try{result[table]=await pullTable(table)}catch(e){errors.push({table,message:e.message})}}
 const counts=Object.fromEntries(TABLES.map(t=>[t,(result[t]||[]).length]));
 const ok=errors.length===0; setState({status:ok?'online':'degraded',ok,errors:errors.length,counts,lastSync:now()});
 emit('dg:live:complete',{ok,result,errors,counts});
 emit('dg:supabase:online',{latencyMs:state().latency||null,counts});
 return{ok,result,errors,counts};
 }finally{pulling=false}
}
function state(){try{return JSON.parse(localStorage.getItem(stateKey)||'{}')}catch{return{}}}
async function healthCheck(){
 const started=performance.now();
 try{const rows=await rest('viaggi','select=id&limit=1');const latency=Math.round(performance.now()-started);setState({status:'online',ok:true,reachable:true,latency,viaggiSample:rows.length});emit('dg:supabase:online',{latencyMs:latency});return{ok:true,latency,count:rows.length}}
 catch(e){setState({status:'offline',ok:false,reachable:false,error:e.message});emit('dg:supabase:offline',{error:e.message});return{ok:false,error:e.message}}
}
function installUI(){
 if(document.getElementById('dg-v209-live'))return;
 const el=document.createElement('div');el.id='dg-v209-live';
 el.innerHTML='<span class="dot"></span><span class="txt">SUPABASE • collegamento…</span><button type="button">↻ Sincronizza</button>';
 Object.assign(el.style,{position:'fixed',right:'14px',bottom:'14px',zIndex:'2147483646',display:'flex',alignItems:'center',gap:'8px',padding:'9px 12px',borderRadius:'14px',background:'rgba(9,23,39,.96)',color:'#fff',font:'600 12px system-ui,-apple-system,sans-serif',boxShadow:'0 8px 30px rgba(0,0,0,.25)'});
 el.querySelector('button').onclick=()=>pullAll().catch(()=>{});document.body.appendChild(el);
 window.addEventListener('dg:live:status',e=>{const s=e.detail||{},dot=el.querySelector('.dot'),txt=el.querySelector('.txt');dot.style.cssText='width:9px;height:9px;border-radius:50%;background:'+(s.status==='online'?'#16c784':s.status==='syncing'?'#f59e0b':'#ef4444');txt.textContent=s.status==='online'?`SUPABASE LIVE • ${VERSION}`:s.status==='syncing'?'SUPABASE • sincronizzazione…':'SUPABASE • '+(s.error||'non raggiungibile')});
}
function installAPI(){
 window.DG_SUPABASE_SYNC={url:SUPABASE_URL,key:SUPABASE_KEY,tables:TABLES,rest,pullTable,pullAll,syncNow:pullAll,healthCheck,subscribeAll:()=>null,getStatus:state,markDirty(){document.documentElement.dataset.dgUnsaved='1'},clearDirty(){delete document.documentElement.dataset.dgUnsaved},version:VERSION};
}
async function init(){if(initialized)return;initialized=true;installAPI();installUI();const h=await healthCheck();if(h.ok)await pullAll();timer=setInterval(()=>{if(!document.hidden&&document.documentElement.dataset.dgUnsaved!=='1')pullAll().catch(()=>{})},30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden&&document.documentElement.dataset.dgUnsaved!=='1')pullAll().catch(()=>{})});window.addEventListener('online',()=>pullAll().catch(()=>{}));emit('dg:supabase:ready',{url:SUPABASE_URL,version:VERSION})}
init().catch(e=>setState({status:'offline',ok:false,error:e.message}));
})();
