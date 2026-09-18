/* DELGROSSO GESTIONALE — VIAGGI V59
 * Fonte unica: Supabase Gestionale.
 * Nessuna dipendenza dal vecchio tripService/fleetService per la lettura.
 */
import { t as routes } from './appRoutes-BbuDm13X.js';
import { n as notify, t as confirmAction } from './messageSystem-jVMshBDs.js';
import { t as tripService } from './tripService-BzTorehO.js';

const SUPABASE_URL = 'https://chkuayhbmitdmzmmvona.supabase.co';
const SUPABASE_KEY = 'sb_publishable_H29K1BV5ZE1rT8xo0PIzVA_wF6zC7je';
let _client = null;
async function getClient(){
  if(_client) return _client;
  const mod = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  _client = mod.createClient(SUPABASE_URL, SUPABASE_KEY, {db:{schema:'public'},auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  return _client;
}
const state = { trips: [], bookings: [], fleet: [], query: '', statusFilter: '', publicationFilter: '', sortKey: 'data_partenza', sortDir: 'asc', editingId: null, source: '', authenticated: false };

function $(id){ return document.getElementById(id); }
const el = {};
function cacheElements(){
  el.search=$('searchTrip'); el.newBtn=$('btnNewTrip'); el.refresh=$('btnRefreshTrips');
  el.tbody=document.querySelector('#tripTable tbody'); el.modal=$('modal'); el.modalTitle=$('modalTitle');
  el.save=$('saveTrip'); el.close=$('closeTrip'); el.bus=$('bus_select');
  el.template=$('trip_template'); el.templateUse=$('useTripTemplate'); el.templateHint=$('tripTemplateHint');
  el.locFile=$('locandina_file'); el.locUpload=$('uploadLocandina'); el.locReplace=$('replaceLocandina'); el.locRemove=$('removeLocandina');
  el.locPreview=$('locandina_preview'); el.posterStatus=$('posterFormStatus'); el.uploadBox=$('uploadProgressBox'); el.uploadText=$('uploadProgressText'); el.uploadBar=$('uploadProgressBar'); el.retryUpload=$('retryUpload');
  el.stats={total:$('totTrips'),active:$('plannedTrips'),complete:$('runningTrips'),cancelled:$('completedTrips')};
  el.form=Object.fromEntries(['viaggio_id','titolo','destinazione','luogo_partenza','data_partenza','ora_partenza','prezzo','descrizione','locandina','posti_totali','stato','pubblicato','costo_totale'].map(id=>[id,$(id)]));
}
function msg(text,type='info'){
  try{ notify({type:type==='error'?'error':'info',title:'Viaggi',message:String(text||'')}); }
  catch{ console[type==='error'?'error':'log'](text); }
}
function money(v){const n=Number(v);return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2}).format(Number.isFinite(n)?n:0);}
function tripCost(v){const keys=['costo_totale','costi_totali','costo_bus','costo_mezzo','costo_autista','costi','spese'];for(const k of keys){const n=Number(v?.[k]);if(Number.isFinite(n))return n;}return 0;}
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

function bookingIsActive(b){return !['annullata','annullato','cancellata','cancellato'].includes(String(b?.stato||'').trim().toLowerCase())}
function parseSeats(v){const raw=Array.isArray(v)?v.join(','):String(v??'');return raw.split(/[,;\s]+/).map(x=>String(x).trim()).filter(Boolean).filter(x=>/^\d+$/.test(x))}
function realOccupied(trip){const id=String(trip?.id||trip?.id_viaggio||'');const rows=state.bookings.filter(b=>bookingIsActive(b)&&String(b?.viaggio_id||b?.tratta_id||'')===id);const set=new Set();let fallback=0;for(const b of rows){const seats=parseSeats(b?.posti_selezionati);if(seats.length) seats.forEach(x=>set.add(x)); else fallback+=Math.max(Number(b?.posti||0),0)}return set.size||fallback}
function realFree(trip){return Math.max(Math.max(Number(trip?.posti_totali||0),0)-realOccupied(trip),0)}
async function loadBookings(){try{const sb=await getClient();const q=await sb.from('prenotazioni').select('*');if(q.error)throw q.error;state.bookings=jsonRows(q.data)}catch(e){try{state.bookings=jsonRows(await fetchRest('prenotazioni?select=*'))}catch{state.bookings=[];console.warn('[VIAGGI V107] prenotazioni non caricate',e)}}}
async function loadTrips(){
  let rows=[]; let source='Supabase';
  state.authenticated=true;
  try{
    const sb=await getClient();
    const q=await sb.from('viaggi').select('*').order('data_partenza',{ascending:true}).order('ora_partenza',{ascending:true});
    if(q.error) throw q.error;
    rows=jsonRows(q.data);
  }catch(firstError){
    console.warn('[VIAGGI V59] client Supabase non riuscito, provo REST diretto',firstError);
    try{
      rows=jsonRows(await fetchRest('viaggi?select=*&order=data_partenza.asc,ora_partenza.asc'));
      source='Supabase REST';
    }catch(secondError){
      const snap=localStorage.getItem('dg_viaggi_snapshot_v59');
      if(snap){try{rows=jsonRows(JSON.parse(snap).rows);source='snapshot locale';}catch{}}
      if(!rows.length) throw secondError;
      source='snapshot locale';
    }
  }
  state.trips=rows;
  await loadBookings();
  state.source=source;
  localStorage.setItem('dg_viaggi_snapshot_v59',JSON.stringify({at:new Date().toISOString(),rows}));
}
async function loadFleet(){
  try{
    const sb=await getClient(); const q=await sb.from('flotta').select('*').order('marca').order('modello');
    if(q.error) throw q.error; state.fleet=jsonRows(q.data);
  }catch(e){
    try{state.fleet=jsonRows(await fetchRest('flotta?select=*&order=marca.asc,modello.asc'));}
    catch{state.fleet=[];console.warn('[VIAGGI V59] flotta non caricata',e);}
  }
}
function busLabel(v){
  if(v.autobus) return v.autobus;
  const f=state.fleet.find(x=>String(x.id)===String(v.autobus_id));
  return f ? `${f.marca||''} ${f.modello||''}`.trim()||f.targa||'-' : '-';
}
function filtered(){
  const q=state.query.trim().toLowerCase();
  const sf=state.statusFilter.toLowerCase(); const pf=state.publicationFilter.toLowerCase();
  const rows=state.trips.filter(v=>{
    const hay=[v.id_viaggio,v.titolo,v.destinazione,v.data_partenza,v.luogo_partenza,v.autobus].some(x=>String(x||'').toLowerCase().includes(q));
    const status=!sf||String(v.stato||'').toLowerCase()===sf;
    const pub=!pf||String(v.pubblicato||'').toLowerCase()===pf;
    return (!q||hay)&&status&&pub;
  });
  const k=state.sortKey,dir=state.sortDir==='asc'?1:-1;
  return rows.sort((a,b)=>String(a?.[k]??'').localeCompare(String(b?.[k]??''),'it',{numeric:true})*dir);
}
function tripRevenue(v){
  const seats=Number(v.posti_totali)||0, price=Number(v.prezzo)||0;
  return Math.round(seats*price*100)/100;
}
function render(){
  if(!el.tbody)return;
  const rows=filtered();
  if(el.stats.total)el.stats.total.textContent=state.trips.length;
  if(el.stats.active)el.stats.active.textContent=state.trips.filter(v=>String(v.stato||'').toLowerCase()!=='annullato').length;
  if(el.stats.complete)el.stats.complete.textContent=state.trips.filter(v=>String(v.stato||'').toLowerCase()==='confermato').length;
  if(el.stats.cancelled)el.stats.cancelled.textContent=state.trips.filter(v=>String(v.stato||'').toLowerCase()==='annullato').length;
  const revenue=state.trips.filter(v=>String(v.stato||'').toLowerCase()!=='annullato').reduce((a,v)=>a+tripRevenue(v),0);
  const costs=state.trips.filter(v=>String(v.stato||'').toLowerCase()!=='annullato').reduce((a,v)=>a+tripCost(v),0);
  const revEl=document.getElementById('dg106Revenue'), costEl=document.getElementById('dg106Costs'), countEl=document.getElementById('dg106TableCount');
  if(revEl)revEl.textContent=money(revenue); if(costEl)costEl.textContent=money(costs); if(countEl)countEl.textContent=`${rows.length} risultati`;
  el.tbody.innerHTML=rows.length?rows.map(v=>{
    const status=String(v.stato||'Programmato'); const low=status.toLowerCase();
    const statusClass=low==='annullato'?'danger':low==='confermato'?'ok':'warn';
    const capacity=Math.max(Number(v.posti_totali)||0,0); const occ=realOccupied(v); const free=Math.max(capacity-occ,0);
    const poster=String(v?.locandina||'').trim();
    const published=String(v?.pubblicato||'NO').toUpperCase()==='SI';
    const posterCell=poster
      ? `<a class="dg117-poster" href="${esc(poster)}" target="_blank" rel="noopener" title="Apri locandina"><img src="${esc(poster)}" alt="Locandina ${esc(v.destinazione||v.titolo||'viaggio')}" loading="lazy"><span>Presente</span><small class="dg121-site-state ${published?'is-on':'is-off'}">${published?'🌐 Sito ON':'○ Sito OFF'}</small></a>`
      : `<span class="dg117-poster-empty"><strong>⚠️ Assente</strong><small class="dg121-site-state ${published?'is-on':'is-off'}">${published?'🌐 Sito ON · senza locandina':'○ Sito OFF'}</small></span>`;
    return `<tr><td><span class="dg106-id">${esc(v.id_viaggio||`DG-V-${String(v.id||'').replace(/-/g,'').slice(0,8).toUpperCase()}`)}</span></td><td><div class="dg106-title">${esc(v.titolo||'-')}</div></td><td>${esc(v.destinazione||'-')}</td><td><span class="dg106-date">${esc(fmtDate(v.data_partenza))}</span></td><td>${esc(String(v.ora_partenza||'').slice(0,5)||'-')}</td><td>${money(v.prezzo)}</td><td><strong class="dg-trip-cost">${money(tripCost(v))}</strong></td><td>${posterCell}</td><td><div class="dg106-bus" title="${esc(busLabel(v))}">${esc(busLabel(v))}</div></td><td><strong>${capacity}</strong><div style="font-size:10px;color:#64748b">${occ} occupati · ${free} liberi</div></td><td><span class="dg106-status ${statusClass}">${esc(status)}</span></td><td><div class="dg106-actions"><button type="button" data-action="open" data-id="${esc(v.id)}">Apri</button><button type="button" data-action="dossier" data-id="${esc(v.id)}">360°</button><button type="button" data-action="duplicate" data-id="${esc(v.id)}">Duplica</button><button type="button" data-action="edit" data-id="${esc(v.id)}">Modifica</button><button class="danger" type="button" data-action="delete" data-id="${esc(v.id)}">Elimina</button></div></td></tr>`;
  }).join(''):`<tr><td colspan="12" class="dg106-empty">Nessun viaggio trovato con i filtri selezionati.</td></tr>`;
  // V118 — verifica visiva dell'URL pubblico della locandina senza polling/observer globale.
  document.querySelectorAll('.dg117-poster img').forEach(img=>{
    img.addEventListener('load',()=>img.closest('.dg117-poster')?.classList.add('is-valid'),{once:true});
    img.addEventListener('error',()=>{
      const card=img.closest('.dg117-poster');
      if(card){card.classList.remove('is-valid');card.classList.add('is-broken');const label=card.querySelector('span');if(label)label.textContent='⚠️ URL non raggiungibile';}
    },{once:true});
  });
  document.body.dataset.viaggiSource=state.source;
}
function fillBus(selected=''){
  if(!el.bus)return;
  el.bus.innerHTML='<option value="">-- Seleziona Bus --</option>'+state.fleet.filter(v=>v?.id).map(v=>`<option value="${esc(v.id)}">${esc(v.titolo||`${v.marca||''} ${v.modello||''}`.trim()||v.targa||'Bus')}</option>`).join('');
  el.bus.value=selected||'';
}
function normalizeDestination(v){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\([^)]*\)/g,' ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');}
function findDestinationTemplate(destination){const key=normalizeDestination(destination);if(!key)return null;const candidates=state.trips.filter(v=>String(v?.id)!==String(state.editingId||'')&&normalizeDestination(v?.destinazione)===key);return candidates.sort((a,b)=>{const ap=!!String(a?.locandina||'').trim(),bp=!!String(b?.locandina||'').trim();if(ap!==bp)return bp-ap;return String(b?.data_partenza||'').localeCompare(String(a?.data_partenza||''));})[0]||null;}
function setPosterStatus(url){if(!el.posterStatus)return;const u=String(url||'').trim();if(!u){el.posterStatus.className='dg120-poster-status empty';el.posterStatus.textContent='📷 Nessuna locandina collegata a questo viaggio.';return;}if(!/^https?:\/\//i.test(u)){el.posterStatus.className='dg120-poster-status invalid';el.posterStatus.textContent='⚠️ Inserisci un URL pubblico http/https.';return;}el.posterStatus.className='dg120-poster-status ready';el.posterStatus.textContent='✓ Locandina collegata — sarà utilizzata anche come modello per la stessa destinazione.';}
function setLocPreview(url){if(!el.locPreview)return;if(url){el.locPreview.src=url;el.locPreview.style.display='block';}else{el.locPreview.removeAttribute('src');el.locPreview.style.display='none';}setPosterStatus(url);}
function setUploadProgress(pct,text='',stateClass=''){if(!el.uploadBox)return;el.uploadBox.style.display='block';el.uploadBox.classList.remove('error','success');if(stateClass)el.uploadBox.classList.add(stateClass);if(el.uploadBar)el.uploadBar.style.width=`${Math.max(0,Math.min(100,Number(pct)||0))}%`;if(el.uploadText)el.uploadText.textContent=text||`Caricamento ${Math.round(Number(pct)||0)}%`;if(stateClass==='success')setTimeout(()=>{if(el.uploadBox)el.uploadBox.style.display='none';},1800);}
function clearUploadUI(){if(el.uploadBox){el.uploadBox.style.display='none';el.uploadBox.classList.remove('error','success');}if(el.uploadBar)el.uploadBar.style.width='0%';if(el.uploadText)el.uploadText.textContent='';if(el.retryUpload)el.retryUpload.style.display='none';}
function populateTemplates(){if(!el.template)return;const seen=new Map();state.trips.forEach(v=>{const key=normalizeDestination(v?.destinazione);if(!key)return;const current=seen.get(key);if(!current||(!String(current?.locandina||'').trim()&&String(v?.locandina||'').trim())||String(v?.data_partenza||'')>String(current?.data_partenza||''))seen.set(key,v);});el.template.innerHTML='<option value="">— Seleziona una destinazione esistente —</option>'+[...seen.values()].sort((a,b)=>String(a?.destinazione||'').localeCompare(String(b?.destinazione||''),'it')).map(v=>`<option value="${esc(v.id)}">${esc(v.destinazione||v.titolo||'Destinazione')} · ${esc(fmtDate(v.data_partenza))}${v.locandina?' · 📷 locandina':''}</option>`).join('');}
function applyTripTemplate(v,autoPoster=false){if(!v)return false;const f=el.form||{};if(!autoPoster){if(f.titolo&&!f.titolo.value.trim())f.titolo.value=v.titolo||'';if(f.descrizione&&!f.descrizione.value.trim())f.descrizione.value=v.descrizione||'';if(f.prezzo&&!f.prezzo.value)f.prezzo.value=v.prezzo??'';if(f.luogo_partenza&&!f.luogo_partenza.value.trim())f.luogo_partenza.value=v.luogo_partenza||'';if(f.posti_totali&&!f.posti_totali.value)f.posti_totali.value=v.posti_totali??'';if(el.bus&&!el.bus.value&&v.autobus_id)el.bus.value=v.autobus_id||'';}if(v.locandina&&!f.locandina.value.trim()){f.locandina.value=v.locandina;setLocPreview(v.locandina);if(el.templateHint)el.templateHint.textContent=`📷 Locandina mantenuta automaticamente da “${v.destinazione||v.titolo||'questa destinazione'}”.`;return true;}if(el.templateHint)el.templateHint.textContent=v.locandina?'Locandina già presente nel viaggio corrente.':'Destinazione trovata, ma il viaggio modello non ha una locandina.';return false;}
function checkDestinationTemplate(){if(state.editingId)return;const value=el.form?.destinazione?.value||'';const v=findDestinationTemplate(value);if(!v){if(el.templateHint)el.templateHint.textContent='';return;}const hasPoster=!!String(v?.locandina||'').trim();applyTripTemplate(v,true);if(el.templateHint){el.templateHint.textContent=hasPoster?`♻️ Destinazione riconosciuta: locandina pronta per il nuovo viaggio.`:`Destinazione riconosciuta, ma non è disponibile una locandina precedente.`;}}
function openDuplicate(v){
  if(!v)return;
  const label=v.titolo||v.destinazione||'questo viaggio';
  if(!window.confirm(`Vuoi creare una nuova copia di “${label}”\n\nLa copia manterrà impostazioni e locandina, ma avrà una nuova data e un nuovo ID.`))return;
  state.editingId=null;
  if(el.modalTitle)el.modalTitle.textContent='Nuovo Viaggio · copia';
  for(const [k,node] of Object.entries(el.form||{}))if(node)node.value=v?.[k]??'';
  if(el.form?.viaggio_id)el.form.viaggio_id.value='';
  if(el.form?.data_partenza)el.form.data_partenza.value='';
  if(el.form?.ora_partenza)el.form.ora_partenza.value=v?.ora_partenza||'';
  if(el.form?.stato)el.form.stato.value='Programmato';
  if(el.form?.pubblicato)el.form.pubblicato.value='NO';
  fillBus(v?.autobus_id||'');
  populateTemplates();
  if(el.template)el.template.value=String(v.id||'');
  if(el.templateHint)el.templateHint.textContent='📋 Copia pronta: inserisci la nuova data. Destinazione e locandina sono state mantenute.';
  setLocPreview(v?.locandina||'');
  clearUploadUI();
  el.modal?.classList.add('open'); el.modal?.setAttribute('aria-hidden','false');
}
function openModal(v=null){
  state.editingId=v?.id||null; if(el.modalTitle)el.modalTitle.textContent=v?'Modifica Viaggio':'Nuovo Viaggio';
  for(const [k,node] of Object.entries(el.form||{}))if(node)node.value=v?.[k]??'';
  if(el.form?.viaggio_id)el.form.viaggio_id.value=v?.id||'';
  if(el.form?.stato)el.form.stato.value=v?.stato||'Programmato';
  if(el.form?.pubblicato)el.form.pubblicato.value=v?.pubblicato||'NO';
  fillBus(v?.autobus_id||''); populateTemplates(); if(el.template)el.template.value=''; if(el.templateHint)el.templateHint.textContent=''; setLocPreview(v?.locandina||''); clearUploadUI();
  el.modal?.classList.add('open'); el.modal?.setAttribute('aria-hidden','false');
}
async function uploadPoster(){const file=el.locFile?.files?.[0];if(!file){msg('Seleziona prima una locandina.','error');return;}if(!/^image\/(jpeg|png|webp)$/.test(file.type)){msg('Formato non supportato. Usa JPG, PNG o WEBP.','error');return;}if(file.size>12*1024*1024){msg('La locandina supera 12 MB.','error');return;}setUploadProgress(5,'Preparazione locandina…');try{const result=await tripService.uploadLocandina(file,{onProgress:p=>setUploadProgress(p,`Caricamento locandina… ${Math.round(p)}%`)});if(result?.success===false)throw result.error||new Error('Upload locandina non riuscito');const url=String(result?.data?.url||result?.url||'');if(!url)throw new Error('URL pubblico della locandina non disponibile.');el.form.locandina.value=url;setLocPreview(url);setUploadProgress(100,'Locandina caricata con successo','success');if(el.locFile)el.locFile.value='';msg('Locandina caricata. Premi Salva per collegarla al viaggio.');}catch(e){console.error('[VIAGGI V121] upload locandina',e);setUploadProgress(0,e?.message||'Upload locandina non riuscito','error');if(el.retryUpload)el.retryUpload.style.display='inline-flex';msg(e?.message||'Upload locandina non riuscito','error');}}
function closeModal(){el.modal?.classList.remove('open');el.modal?.setAttribute('aria-hidden','true');}
function payload(){
  const f=state.fleet.find(x=>String(x.id)===String(el.bus?.value));
  const posti=Number(el.form.posti_totali?.value||0);
  let poster=el.form.locandina.value.trim()||'';
  if(poster && !/^https?:\/\//i.test(poster)){poster='';if(el.templateHint)el.templateHint.textContent='⚠️ La locandina deve essere un URL pubblico http/https.';}
  if(!state.editingId && !poster){const template=findDestinationTemplate(el.form.destinazione.value);if(template?.locandina){poster=String(template.locandina).trim();setLocPreview(poster);if(el.templateHint)el.templateHint.textContent=`📷 Locandina copiata automaticamente dalla destinazione “${template.destinazione||el.form.destinazione.value}”.`;}}
  return {titolo:el.form.titolo.value.trim(),destinazione:el.form.destinazione.value.trim(),luogo_partenza:el.form.luogo_partenza.value.trim(),data_partenza:el.form.data_partenza.value,ora_partenza:el.form.ora_partenza.value||null,prezzo:Number(el.form.prezzo.value||0),descrizione:el.form.descrizione.value.trim(),costo_totale:Math.round((Number(el.form.costo_totale?.value||0)||0)*100)/100,locandina:poster||null,autobus_id:el.bus?.value||null,autobus:f?`${f.marca||''} ${f.modello||''}`.trim()||f.targa||'':'',posti_totali:posti,posti_occupati:state.editingId?undefined:0,posti_liberi:state.editingId?undefined:posti,stato:el.form.stato.value||'Programmato',pubblicato:el.form.pubblicato.value||'NO'};
}
async function save(){
  const p=payload(); if(!p.titolo||!p.destinazione||!p.data_partenza){msg('Compila titolo, destinazione e data di partenza.','error');return;}
  const duplicate=state.trips.find(v=>String(v?.id)!==String(state.editingId||'')&&normalizeDestination(v?.destinazione)===normalizeDestination(p.destinazione)&&String(v?.data_partenza||'')===String(p.data_partenza||''));
  if(duplicate){
    const label=duplicate.titolo||duplicate.destinazione||'un viaggio';
    const ok=window.confirm(`Esiste già un viaggio per “${duplicate.destinazione||p.destinazione}” nella data ${fmtDate(duplicate.data_partenza)}\n\nViaggio esistente: ${label}\n\nVuoi comunque creare/salvare questo viaggio?`);
    if(!ok)return;
  }
  if(!state.editingId){const same=findDestinationTemplate(p.destinazione);if(same?.locandina&&!p.locandina){p.locandina=String(same.locandina).trim();setLocPreview(p.locandina);}}
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
  try{await Promise.all([loadTrips(),loadFleet()]);fillBus();populateTemplates();render();if(showMessage)msg(`${state.trips.length} viaggi caricati da ${state.source}.`);}
  catch(e){console.error('[VIAGGI V59]',e);msg(`Impossibile caricare i viaggi: ${e.message||e}`,'error');}
}
function bind(){
  el.search?.addEventListener('input',e=>{state.query=e.target.value||'';render();});
  document.getElementById('dg106StatusFilter')?.addEventListener('change',e=>{state.statusFilter=e.target.value||'';render();});
  document.getElementById('dg106PublicationFilter')?.addEventListener('change',e=>{state.publicationFilter=e.target.value||'';render();});
  el.newBtn?.addEventListener('click',()=>openModal()); el.refresh?.addEventListener('click',()=>refresh(true)); el.close?.addEventListener('click',closeModal); el.save?.addEventListener('click',save); el.modal?.addEventListener('click',e=>{if(e.target===el.modal)closeModal();});
  el.form?.destinazione?.addEventListener('input',checkDestinationTemplate);
  el.form?.locandina?.addEventListener('input',()=>setPosterStatus(el.form.locandina.value));
  el.template?.addEventListener('change',()=>{const v=state.trips.find(x=>String(x.id)===String(el.template.value));if(v){applyTripTemplate(v,false);el.form.destinazione.value=v.destinazione||el.form.destinazione.value;}});
  el.templateUse?.addEventListener('click',()=>{const v=state.trips.find(x=>String(x.id)===String(el.template?.value));if(v)applyTripTemplate(v,false);else checkDestinationTemplate();});
  el.locUpload?.addEventListener('click',uploadPoster); el.locReplace?.addEventListener('click',uploadPoster);
  el.locRemove?.addEventListener('click',()=>{if(el.form?.locandina)el.form.locandina.value='';setLocPreview('');if(el.locFile)el.locFile.value='';clearUploadUI();});
  el.retryUpload?.addEventListener('click',uploadPoster);
  el.tbody?.addEventListener('click',async e=>{const b=e.target.closest('button[data-action]');if(!b)return;const id=b.dataset.id,v=state.trips.find(x=>String(x.id)===String(id));if(b.dataset.action==='edit'&&v)openModal(v);else if(b.dataset.action==='duplicate'&&v)openDuplicate(v);else if(b.dataset.action==='delete')await del(id);else if(b.dataset.action==='open')window.location.href=`${routes.centroOperativo}?trip=${encodeURIComponent(id)}`;else if(b.dataset.action==='dossier')window.location.href=`./dossier-viaggio.html?trip=${encodeURIComponent(id)}`;});
  document.querySelectorAll('#tripTable thead th[data-sort]').forEach(th=>th.addEventListener('click',()=>{const k=th.dataset.sort;state.sortDir=state.sortKey===k&&state.sortDir==='asc'?'desc':'asc';state.sortKey=k;render();}));
  window.addEventListener('dg:supabase:realtime',e=>{if(e.detail?.table==='viaggi')refresh().catch(()=>{});});
  window.addEventListener('dg:supabase:changed',e=>{if(e.detail?.table==='viaggi')refresh().catch(()=>{});});
  window.addEventListener('online',()=>refresh().catch(()=>{}));
}
async function realtime(){try{const sb=await getClient();const ch=sb.channel('dg-viaggi-v59').on('postgres_changes',{event:'*',schema:'public',table:'viaggi'},()=>refresh().catch(()=>{})).subscribe();window.addEventListener('beforeunload',()=>sb.removeChannel(ch));}catch(e){console.warn('[VIAGGI V59] realtime',e);}}
async function init(){
  const start=()=>{cacheElements();bind();refresh().then(realtime);};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
}
init();
