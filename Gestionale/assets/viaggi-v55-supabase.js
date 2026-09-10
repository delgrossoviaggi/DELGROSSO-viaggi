/* DELGROSSO GESTIONALE — VIAGGI V55
 * Fonte unica: Supabase Gestionale.
 * Nessuna dipendenza dal vecchio tripService/fleetService per la lettura.
 */
import { getClient } from './dg-supabase-sync-v2.js';
import { n as routes } from './appRoutes-BbuDm13X.js';
import { n as notify, t as confirmAction } from './messageSystem-jVMshBDs.js';

const SUPABASE_URL = 'https://chkuayhbmitdmzmmvona.supabase.co';
const SUPABASE_KEY = 'sb_publishable_H29K1BV5ZE1rT8xo0PIzVA_wF6zC7je';
const state = { trips: [], fleet: [], query: '', sortKey: 'data_partenza', sortDir: 'asc', editingId: null, source: '' };

function $(id){ return document.getElementById(id); }
const el = {};
function cacheElements(){
  el.search=$('searchTrip'); el.newBtn=$('btnNewTrip'); el.refresh=$('btnRefreshTrips');
  el.tbody=document.querySelector('#tripTable tbody'); el.modal=$('modal'); el.modalTitle=$('modalTitle');
  el.save=$('saveTrip'); el.close=$('closeTrip'); el.bus=$('bus_select');
  el.stats={total:$('totTrips'),active:$('plannedTrips'),complete:$('runningTrips'),cancelled:$('completedTrips')};
  el.form=Object.fromEntries(['viaggio_id','titolo','destinazione','luogo_partenza','data_partenza','ora_partenza','prezzo','descrizione','locandina','posti_totali','stato','pubblicato'].map(id=>[id,$(id)]));
}
function msg(text,type='info'){
  try{ notify({type:type==='error'?'error':'info',title:'Viaggi',message:String(text||'')}); }
  catch{ console[type==='error'?'error':'log'](text); }
}
function money(v){return Number(v||0).toLocaleString('it-IT',{style:'currency',currency:'EUR'});}
function fmtDate(v){if(!v)return '-';const d=new Date(`${String(v).slice(0,10)}T00:00:00`);return Number.isNaN(d.getTime())?String(v):d.toLocaleDateString('it-IT');}
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function jsonRows(data){return Array.isArray(data)?data:[];}

async function fetchRest(path, options={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),Number(options.timeout||12000));
  try{
    const r=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,Accept:'application/json'},signal:controller.signal,cache:'no-store'});
    const text=await r.text();
    let body=null; try{body=text?JSON.parse(text):null;}catch{body=text;}
    if(!r.ok) throw new Error(body?.message||body?.hint||`Supabase HTTP ${r.status}`);
    return body;
  }finally{clearTimeout(timer);}
}

async function loadTrips(){
  let rows=[]; let source='Supabase';
  try{
    const sb=await getClient();
    const q=await sb.from('viaggi').select('*').order('data_partenza',{ascending:true}).order('ora_partenza',{ascending:true});
    if(q.error) throw q.error;
    rows=jsonRows(q.data);
  }catch(firstError){
    console.warn('[VIAGGI V55] client Supabase non riuscito, provo REST diretto',firstError);
    try{
      rows=jsonRows(await fetchRest('viaggi?select=*&order=data_partenza.asc,ora_partenza.asc'));
      source='Supabase REST';
    }catch(secondError){
      const snap=localStorage.getItem('dg_viaggi_snapshot_v55');
      if(snap){try{rows=jsonRows(JSON.parse(snap).rows);source='snapshot locale';}catch{}}
      if(!rows.length) throw secondError;
      source='snapshot locale';
    }
  }
  state.trips=rows;
  state.source=source;
  localStorage.setItem('dg_viaggi_snapshot_v55',JSON.stringify({at:new Date().toISOString(),rows}));
}
async function loadFleet(){
  try{
    const sb=await getClient(); const q=await sb.from('flotta').select('*').order('marca').order('modello');
    if(q.error) throw q.error; state.fleet=jsonRows(q.data);
  }catch(e){
    try{state.fleet=jsonRows(await fetchRest('flotta?select=*&order=marca.asc,modello.asc'));}
    catch{state.fleet=[];console.warn('[VIAGGI V55] flotta non caricata',e);}
  }
}
function busLabel(v){
  if(v.autobus) return v.autobus;
  const f=state.fleet.find(x=>String(x.id)===String(v.autobus_id));
  return f ? `${f.marca||''} ${f.modello||''}`.trim()||f.targa||'-' : '-';
}
function filtered(){
  const q=state.query.trim().toLowerCase();
  const rows=state.trips.filter(v=>!q||[v.id_viaggio,v.titolo,v.destinazione,v.data_partenza,v.luogo_partenza,v.autobus].some(x=>String(x||'').toLowerCase().includes(q)));
  const k=state.sortKey,dir=state.sortDir==='asc'?1:-1;
  return rows.sort((a,b)=>String(a?.[k]??'').localeCompare(String(b?.[k]??''),'it',{numeric:true})*dir);
}
function render(){
  if(!el.tbody)return;
  const rows=filtered();
  if(el.stats.total)el.stats.total.textContent=state.trips.length;
  if(el.stats.active)el.stats.active.textContent=state.trips.filter(v=>String(v.stato||'').toLowerCase()!=='annullato').length;
  if(el.stats.complete)el.stats.complete.textContent=state.trips.filter(v=>String(v.stato||'').toLowerCase()==='confermato').length;
  if(el.stats.cancelled)el.stats.cancelled.textContent=state.trips.filter(v=>String(v.stato||'').toLowerCase()==='annullato').length;
  el.tbody.innerHTML=rows.length?rows.map(v=>`<tr><td><strong>${esc(v.id_viaggio||`DG-V-${String(v.id||'').replace(/-/g,'').slice(0,8).toUpperCase()}`)}</strong></td><td>${esc(v.titolo||'-')}</td><td>${esc(v.destinazione||'-')}</td><td>${esc(fmtDate(v.data_partenza))}</td><td>${esc(String(v.ora_partenza||'').slice(0,5)||'-')}</td><td>${money(v.prezzo)}</td><td>${esc(busLabel(v))}</td><td>${esc(v.posti_totali??0)}</td><td><button type="button" data-action="open" data-id="${esc(v.id)}">Apri Viaggio</button> <button type="button" data-action="edit" data-id="${esc(v.id)}">Modifica</button> <button type="button" data-action="delete" data-id="${esc(v.id)}">Elimina</button></td></tr>`).join(''):`<tr><td colspan="9" style="text-align:center;padding:30px">Nessun viaggio trovato</td></tr>`;
  document.body.dataset.viaggiSource=state.source;
}
function fillBus(selected=''){
  if(!el.bus)return;
  el.bus.innerHTML='<option value="">-- Seleziona Bus --</option>'+state.fleet.filter(v=>v?.id).map(v=>`<option value="${esc(v.id)}">${esc(v.titolo||`${v.marca||''} ${v.modello||''}`.trim()||v.targa||'Bus')}</option>`).join('');
  el.bus.value=selected||'';
}
function openModal(v=null){
  state.editingId=v?.id||null; if(el.modalTitle)el.modalTitle.textContent=v?'Modifica Viaggio':'Nuovo Viaggio';
  for(const [k,node] of Object.entries(el.form||{}))if(node)node.value=v?.[k]??'';
  if(el.form?.viaggio_id)el.form.viaggio_id.value=v?.id||'';
  if(el.form?.stato)el.form.stato.value=v?.stato||'Programmato';
  if(el.form?.pubblicato)el.form.pubblicato.value=v?.pubblicato||'NO';
  fillBus(v?.autobus_id||''); el.modal?.classList.add('open'); el.modal?.setAttribute('aria-hidden','false');
}
function closeModal(){el.modal?.classList.remove('open');el.modal?.setAttribute('aria-hidden','true');}
function payload(){
  const f=state.fleet.find(x=>String(x.id)===String(el.bus?.value));
  const posti=Number(el.form.posti_totali?.value||0);
  return {titolo:el.form.titolo.value.trim(),destinazione:el.form.destinazione.value.trim(),luogo_partenza:el.form.luogo_partenza.value.trim(),data_partenza:el.form.data_partenza.value,ora_partenza:el.form.ora_partenza.value||null,prezzo:Number(el.form.prezzo.value||0),descrizione:el.form.descrizione.value.trim(),locandina:el.form.locandina.value.trim()||null,autobus_id:el.bus?.value||null,autobus:f?`${f.marca||''} ${f.modello||''}`.trim()||f.targa||'':'',posti_totali:posti,posti_occupati:state.editingId?undefined:0,posti_liberi:state.editingId?undefined:posti,stato:el.form.stato.value||'Programmato',pubblicato:el.form.pubblicato.value||'NO'};
}
async function save(){
  const p=payload(); if(!p.titolo||!p.destinazione||!p.data_partenza){msg('Compila titolo, destinazione e data di partenza.','error');return;}
  delete p.posti_occupati; delete p.posti_liberi;
  if(!state.editingId){p.posti_occupati=0;p.posti_liberi=p.posti_totali;}
  el.save.disabled=true;
  try{const sb=await getClient();let q=state.editingId?await sb.from('viaggi').update(p).eq('id',state.editingId).select('*').single():await sb.from('viaggi').insert(p).select('*').single();if(q.error)throw q.error;msg(state.editingId?'Viaggio aggiornato correttamente':'Viaggio creato correttamente');closeModal();await refresh();}
  catch(e){console.error(e);msg(e.message||'Errore salvataggio viaggio','error');}
  finally{el.save.disabled=false;}
}
async function del(id){
  if(!await confirmAction({title:'Conferma eliminazione',message:'Eliminare definitivamente questo viaggio?',confirmText:'Elimina',cancelText:'Annulla'}))return;
  try{const sb=await getClient();const q=await sb.from('viaggi').delete().eq('id',id);if(q.error)throw q.error;msg('Viaggio eliminato');await refresh();}catch(e){msg(e.message||'Errore eliminazione','error');}
}
async function refresh(showMessage=false){
  try{await Promise.all([loadTrips(),loadFleet()]);fillBus();render();if(showMessage)msg(`${state.trips.length} viaggi caricati da ${state.source}.`);}
  catch(e){console.error('[VIAGGI V55]',e);msg(`Impossibile caricare i viaggi: ${e.message||e}`,'error');}
}
function bind(){
  el.search?.addEventListener('input',e=>{state.query=e.target.value||'';render();});
  el.newBtn?.addEventListener('click',()=>openModal()); el.refresh?.addEventListener('click',()=>refresh(true)); el.close?.addEventListener('click',closeModal); el.save?.addEventListener('click',save); el.modal?.addEventListener('click',e=>{if(e.target===el.modal)closeModal();});
  el.tbody?.addEventListener('click',async e=>{const b=e.target.closest('button[data-action]');if(!b)return;const id=b.dataset.id,v=state.trips.find(x=>String(x.id)===String(id));if(b.dataset.action==='edit'&&v)openModal(v);else if(b.dataset.action==='delete')await del(id);else if(b.dataset.action==='open')window.location.href=`${routes.centroOperativo}?trip=${encodeURIComponent(id)}`;});
  document.querySelectorAll('#tripTable thead th[data-sort]').forEach(th=>th.addEventListener('click',()=>{const k=th.dataset.sort;state.sortDir=state.sortKey===k&&state.sortDir==='asc'?'desc':'asc';state.sortKey=k;render();}));
  window.addEventListener('dg:supabase:realtime',e=>{if(e.detail?.table==='viaggi')refresh().catch(()=>{});});
  window.addEventListener('dg:supabase:changed',e=>{if(e.detail?.table==='viaggi')refresh().catch(()=>{});});
  window.addEventListener('online',()=>refresh().catch(()=>{}));
}
async function realtime(){try{const sb=await getClient();const ch=sb.channel('dg-viaggi-v55').on('postgres_changes',{event:'*',schema:'public',table:'viaggi'},()=>refresh().catch(()=>{})).subscribe();window.addEventListener('beforeunload',()=>sb.removeChannel(ch));}catch(e){console.warn('[VIAGGI V55] realtime',e);}}
async function init(){
  const start=()=>{cacheElements();bind();refresh().then(realtime);};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
}
init();
