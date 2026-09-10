import { getClient } from './dg-supabase-sync-v3.js';
import { t as tripService } from './tripService-BzTorehO.js';
import { t as fleetService } from './fleetService-DSMpWv9k.js';
import { n as routes } from './appRoutes-BbuDm13X.js';
import { n as notify, t as confirmAction } from './messageSystem-jVMshBDs.js';

const state = { trips: [], fleet: [], query: '', sortKey: 'data_partenza', sortDir: 'asc', editingId: null };
const el = {
  search: document.getElementById('searchTrip'), newBtn: document.getElementById('btnNewTrip'),
  tbody: document.querySelector('#tripTable tbody'), modal: document.getElementById('modal'),
  modalTitle: document.getElementById('modalTitle'), save: document.getElementById('saveTrip'), close: document.getElementById('closeTrip'),
  bus: document.getElementById('bus_select'),
  stats: { total: document.getElementById('totTrips'), active: document.getElementById('plannedTrips'), complete: document.getElementById('runningTrips'), cancelled: document.getElementById('completedTrips') },
  form: Object.fromEntries(['viaggio_id','titolo','destinazione','luogo_partenza','data_partenza','ora_partenza','prezzo','descrizione','locandina','posti_totali','stato','pubblicato'].map(id => [id, document.getElementById(id)])),
};

function ok(v){ return v !== null && v !== undefined && String(v).trim() !== ''; }
function money(v){ return Number(v||0).toLocaleString('it-IT',{style:'currency',currency:'EUR'}); }
function date(v){ if(!v) return '-'; const d=new Date(`${String(v).slice(0,10)}T00:00:00`); return Number.isNaN(d.getTime())?String(v):d.toLocaleDateString('it-IT'); }
function msg(text,type='info'){ try{ notify({type:type==='error'?'error':'info',title:'Viaggi',message:String(text||'')}); }catch{ console[type==='error'?'error':'log'](text); } }
function unwrap(r){ if(r?.success===false) throw (r.error instanceof Error?r.error:new Error(r?.error?.message||r?.error||'Operazione non riuscita')); return Array.isArray(r?.data)?r.data:r?.data??r??[]; }

async function loadTrips(){
  const sb = await getClient();
  const { data, error } = await sb.from('viaggi').select('*').order('data_partenza',{ascending:true}).order('ora_partenza',{ascending:true,nullsFirst:false});
  if(error) throw error;
  state.trips = Array.isArray(data)?data:[];
  localStorage.setItem('dg_viaggi_snapshot_v53', JSON.stringify({at:new Date().toISOString(),rows:state.trips}));
}
async function loadFleet(){
  try { state.fleet = unwrap(await fleetService.getAll()); } catch(e){ console.warn('[VIAGGI V53] flotta non caricata',e); state.fleet=[]; }
}
function busLabel(v){
  if(v.autobus) return v.autobus;
  const f=state.fleet.find(x=>String(x.id)===String(v.autobus_id));
  return f ? `${f.marca||''} ${f.modello||''}`.trim() || f.targa || '-' : '-';
}
function filtered(){
  const q=state.query.trim().toLowerCase();
  let rows=state.trips.filter(v=>!q || [v.id_viaggio,v.titolo,v.destinazione,v.data_partenza,v.luogo_partenza,v.autobus].some(x=>String(x||'').toLowerCase().includes(q)));
  const k=state.sortKey, dir=state.sortDir==='asc'?1:-1;
  return rows.sort((a,b)=>String(a?.[k]??'').localeCompare(String(b?.[k]??''),'it',{numeric:true})*dir);
}
function render(){
  const rows=filtered();
  el.stats.total.textContent=state.trips.length;
  el.stats.active.textContent=state.trips.filter(v=>String(v.stato||'').toLowerCase()!=='annullato').length;
  el.stats.complete.textContent=state.trips.filter(v=>String(v.stato||'').toLowerCase()==='confermato').length;
  el.stats.cancelled.textContent=state.trips.filter(v=>String(v.stato||'').toLowerCase()==='annullato').length;
  el.tbody.innerHTML=rows.length?rows.map(v=>`<tr>
<td><strong>${v.id_viaggio||`DG-V-${String(v.id||'').replace(/-/g,'').slice(0,8).toUpperCase()}`}</strong></td>
<td>${v.titolo||'-'}</td><td>${v.destinazione||'-'}</td><td>${date(v.data_partenza)}</td><td>${String(v.ora_partenza||'').slice(0,5)||'-'}</td>
<td>${money(v.prezzo)}</td><td>${busLabel(v)}</td><td>${v.posti_totali??0}</td>
<td><button type="button" data-action="open" data-id="${v.id}">Apri Viaggio</button> <button type="button" data-action="edit" data-id="${v.id}">Modifica</button> <button type="button" data-action="delete" data-id="${v.id}">Elimina</button></td></tr>`).join(''):`<tr><td colspan="9">Nessun viaggio trovato</td></tr>`;
}
function fillBus(selected=''){ el.bus.innerHTML='<option value="">-- Seleziona Bus --</option>'+state.fleet.filter(v=>v?.id).map(v=>`<option value="${v.id}">${v.titolo||`${v.marca||''} ${v.modello||''}`.trim()||v.targa||'Bus'}</option>`).join(''); el.bus.value=selected||''; }
function openModal(v=null){ state.editingId=v?.id||null; el.modalTitle.textContent=v?'Modifica Viaggio':'Nuovo Viaggio';
  for(const [k,node] of Object.entries(el.form)) if(node) node.value=v?.[k]??'';
  el.form.viaggio_id.value=v?.id||''; el.form.stato.value=v?.stato||'Programmato'; el.form.pubblicato.value=v?.pubblicato||'NO'; fillBus(v?.autobus_id||'');
  el.modal.classList.add('open'); el.modal.setAttribute('aria-hidden','false');
}
function closeModal(){el.modal.classList.remove('open');el.modal.setAttribute('aria-hidden','true');}
function payload(){ const f=state.fleet.find(x=>String(x.id)===String(el.bus.value)); return { titolo:el.form.titolo.value.trim(), destinazione:el.form.destinazione.value.trim(), luogo_partenza:el.form.luogo_partenza.value.trim(), data_partenza:el.form.data_partenza.value, ora_partenza:el.form.ora_partenza.value||null, prezzo:Number(el.form.prezzo.value||0), descrizione:el.form.descrizione.value.trim(), locandina:el.form.locandina.value.trim()||null, autobus_id:el.bus.value||null, autobus:f?`${f.marca||''} ${f.modello||''}`.trim()||f.targa||'':'' , posti_totali:Number(el.form.posti_totali.value||0), posti_occupati:0, posti_liberi:Number(el.form.posti_totali.value||0), stato:el.form.stato.value||'Programmato', pubblicato:el.form.pubblicato.value||'NO' }; }
async function save(){ const p=payload(); if(!p.titolo||!p.destinazione||!p.data_partenza){msg('Compila titolo, destinazione e data di partenza.','error');return;} el.save.disabled=true; try{ const sb=await getClient(); let q;
  if(state.editingId) q=await sb.from('viaggi').update(p).eq('id',state.editingId).select('*').single();
  else q=await sb.from('viaggi').insert(p).select('*').single();
  if(q.error) throw q.error; msg(state.editingId?'Viaggio aggiornato correttamente':'Viaggio creato correttamente'); closeModal(); await refresh();
 }catch(e){ console.error(e); msg(e.message||'Errore salvataggio viaggio','error'); }finally{el.save.disabled=false;} }
async function del(id){ if(!await confirmAction({title:'Conferma eliminazione',message:'Eliminare definitivamente questo viaggio?',confirmText:'Elimina',cancelText:'Annulla'})) return; try{const sb=await getClient(); const q=await sb.from('viaggi').delete().eq('id',id); if(q.error) throw q.error; msg('Viaggio eliminato'); await refresh();}catch(e){msg(e.message||'Errore eliminazione','error');}}
async function refresh(){ await Promise.all([loadTrips(),loadFleet()]); fillBus(); render(); }
function bind(){
  el.search?.addEventListener('input',e=>{state.query=e.target.value||'';render();});
  el.newBtn?.addEventListener('click',()=>openModal()); el.close?.addEventListener('click',closeModal); el.save?.addEventListener('click',save); el.modal?.addEventListener('click',e=>{if(e.target===el.modal)closeModal();});
  el.tbody?.addEventListener('click',async e=>{const b=e.target.closest('button[data-action]');if(!b)return;const id=b.dataset.id,v=state.trips.find(x=>String(x.id)===String(id));if(b.dataset.action==='edit'&&v)openModal(v);else if(b.dataset.action==='delete')await del(id);else if(b.dataset.action==='open')window.location.href=`${routes.centroOperativo}?trip=${encodeURIComponent(id)}`;});
  document.querySelectorAll('#tripTable thead th[data-sort]').forEach(th=>th.addEventListener('click',()=>{const k=th.dataset.sort;state.sortDir=state.sortKey===k&&state.sortDir==='asc'?'desc':'asc';state.sortKey=k;render();}));
  window.addEventListener('dg:supabase:realtime',e=>{if(e.detail?.table==='viaggi') refresh().catch(console.error);});
  window.addEventListener('dg:supabase:changed',e=>{if(e.detail?.table==='viaggi') refresh().catch(console.error);});
  window.addEventListener('online',()=>refresh().catch(console.error));
}
async function realtime(){ try{const sb=await getClient(); const ch=sb.channel('dg-viaggi-v53').on('postgres_changes',{event:'*',schema:'public',table:'viaggi'},()=>refresh().catch(console.error)).subscribe(); window.addEventListener('beforeunload',()=>sb.removeChannel(ch));}catch(e){console.warn('[VIAGGI V53] realtime',e);} }
async function init(){bind(); try{await refresh(); await realtime();}catch(e){console.error('[VIAGGI V53]',e);msg(e.message||'Impossibile caricare i viaggi da Supabase','error');}}
init();
