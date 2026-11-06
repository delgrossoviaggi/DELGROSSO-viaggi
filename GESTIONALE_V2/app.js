/* DELGROSSO 2.0 — primo modulo operativo; produzione: SOLO LETTURA */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const M=window.DG2SeatModel;
 const EXPECTED_URL='https://chkuayhbmitdmzmmvona.supabase.co';
 const STORAGE='dg2_layout_drafts_20261106';
 const pages={dashboard:'Control Room',piantine:'Editor piantine',viaggi:'Viaggi e BUS BIS',prenotazioni:'Prenotazioni',cassa:'Cassa e pagamenti',flotta:'Flotta'};
 const state={key:'GT53',layout:M.fromLegacy('GT53'),drafts:{},trips:[],bookings:[],seats:[],fleet:[],jwt:'',publishable:'',connected:false};
 try{const raw=JSON.parse(localStorage.getItem(STORAGE)||'{}');if(raw&&typeof raw==='object'&&!Array.isArray(raw)){Object.keys(raw).slice(0,150).forEach(k=>{if(!M.validate(raw[k]))state.drafts[k]=raw[k]})}}catch(e){console.warn('Bozze locali non leggibili')}
 function status(message,isError){$('editor-status').textContent=message;$('editor-status').classList.toggle('bad',!!isError)}
 function replaceOptions(id,items){const x=$(id);x.replaceChildren(...items.map(a=>new Option(a[1],a[0])))}
 function updateLayouts(){
  const options=[...Object.keys(M.legacy).map(k=>[k,M.legacy[k].name+' · originale']),...Object.keys(state.drafts).map(k=>[k,state.drafts[k].name+' · bozza'])];
  replaceOptions('layout-select',options);$('layout-select').value=state.key;
 }
 function selectLayout(key){
  state.key=key;state.layout=M.fromLegacy(key);
  if(state.drafts[key])state.layout=M.clone(state.drafts[key]);
  $('layout-name').value=state.layout.name;updateLayouts();renderSeats();
 }
 function occupiedForTrip(){
  const tripId=$('seat-trip-select').value;if(!tripId)return new Set();
  const inactive=new Set(state.bookings.filter(b=>['annullata','cancellata','cancelled'].includes(String(b.stato||'').toLowerCase())).map(b=>b.id));
  return new Set(state.seats.filter(x=>x.viaggio_id===tripId&&!inactive.has(x.prenotazione_id)).map(x=>String(x.posto)));
 }
 function renderSeats(){
  const host=$('seats-map');host.replaceChildren();
  const occupied=occupiedForTrip();
  state.layout.rows.forEach((row,ri)=>{
   const line=document.createElement('div');line.className='bus-row';
   row.forEach((v,ci)=>{
    const btn=document.createElement('button');btn.type='button';btn.className='seat '+(typeof v==='number'?'seat-number':v);
    if(typeof v==='number'&&occupied.has(String(v)))btn.classList.add('occupied');
    btn.textContent=typeof v==='number'?String(v):(v==='door'?'PORTA':v==='aisle'?'·':'+');
    btn.title='Fila '+(ri+1)+', cella '+(ci+1)+' · tocca per modificare';
    btn.setAttribute('aria-label',btn.title);
    btn.addEventListener('click',()=>editSeat(ri,ci));
    line.appendChild(btn);
   });host.appendChild(line);
  });
  const count=M.count(state.layout);
  $('layout-info').textContent=count+' sedili su '+state.layout.rows.length+' file. '+(occupied.size?'Occupati nel viaggio selezionato: '+occupied.size+'. ':'')+'Ogni modifica resta una bozza.';
 }
 function editSeat(ri,ci){
  const old=state.layout.rows[ri][ci];
  const result=prompt('Numero sedile oppure: empty / aisle / door. Lascia vuoto per cella vuota.',typeof old==='number'?String(old):old);
  if(result===null)return;
  const val=result.trim().toLowerCase();
  const next=(val===''||val==='empty')?'empty':(['aisle','door'].includes(val)?val:(/^[1-9]\d{0,3}$/.test(val)?Number(val):null));
  if(next===null){status('Valore non valido',true);return}
  const copy=M.clone(state.layout);copy.rows[ri][ci]=next;
  const dup=M.validate(copy);
  if(dup&&dup.indexOf('duplicato')>=0){status(dup,true);return}
  state.layout=copy;renderSeats();status('Modifica locale non salvata. Premi Salva bozza.');
 }
 function saveDraft(){
  state.layout.name=$('layout-name').value.trim();
  const err=M.validate(state.layout);
  if(err){status(err,true);return}
  state.layout.totalSeats=M.count(state.layout);
  if(!state.drafts[state.key])state.key='bozza-'+Date.now()+'-'+Math.random().toString(36).slice(2,6);
  state.drafts[state.key]=M.clone(state.layout);
  try{localStorage.setItem(STORAGE,JSON.stringify(state.drafts));updateLayouts();status('Bozza salvata solo su questo dispositivo. Esporta il JSON per conservarla.')}
  catch(e){status('Il browser non permette il salvataggio locale. Esporta il JSON.',true)}
 }
 function exportDraft(){
  const err=M.validate(state.layout);if(err){status(err,true);return}
  const safe=state.layout.name.replace(/[^a-z0-9_-]/gi,'-').slice(0,60)||'piantina';
  const blob=new Blob([JSON.stringify({...state.layout,totalSeats:M.count(state.layout)},null,2)],{type:'application/json'});
  const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='delgrosso-'+safe+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),2000);
  status('Piantina esportata.');
 }
 async function importDraft(input){
  const file=input.files&&input.files[0];if(!file)return;
  try{
   if(file.size>200000)throw Error('File troppo grande');
   const data=JSON.parse(await file.text());const err=M.validate(data);if(err)throw Error(err);
   state.layout=M.clone(data);state.key='bozza-import-'+Date.now();$('layout-name').value=data.name;renderSeats();saveDraft();status('Piantina importata come bozza locale.');
  }catch(e){status('Importazione fallita: '+e.message,true)}finally{input.value=''}
 }
 function td(row,value){const c=document.createElement('td');c.textContent=String(value??'—');row.appendChild(c)}
 function emptyTable(id,message,colspan){const tr=document.createElement('tr');const c=document.createElement('td');c.className='empty';c.colSpan=colspan;c.textContent=message;tr.appendChild(c);$(id).replaceChildren(tr)}
 function listTable(id,items,mapper,cols){
  const host=$(id);host.replaceChildren();
  if(!items.length){emptyTable(id,'Nessun dato da visualizzare',cols);return}
  items.forEach(item=>{const tr=document.createElement('tr');mapper(item).forEach(v=>td(tr,v));host.appendChild(tr)});
 }
 function date(d){if(!d)return '—';const p=String(d).split('-');return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:String(d)}
 function renderData(){
  $('kpi-trips').textContent=state.trips.length;
  $('kpi-bookings').textContent=state.bookings.length;
  $('kpi-seats').textContent=state.seats.length;
  $('kpi-buses').textContent=state.fleet.length;
  const trips=state.trips.slice().sort((a,b)=>String(a.data_partenza).localeCompare(String(b.data_partenza)));
  listTable('dashboard-trips',trips.slice(-15),t=>[t.titolo,date(t.data_partenza),t.stato||'—',t.bis_parent_id?'BUS BIS':'BUS 1'],4);
  listTable('trips-list',trips,t=>[t.titolo,date(t.data_partenza),String(t.ora_partenza||'').slice(0,5),t.posti_totali||'—',t.bis_parent_id?'BUS BIS '+(t.bis_numero||''): 'Principale'],5);
  listTable('fleet-list',state.fleet,f=>[(f.marca||'')+' '+(f.modello||''),f.posti||'—',f.seat_layout||'—',f.stato||'—'],4);
  $('bookings-summary').textContent='Prenotazioni trovate: '+state.bookings.length+'. Dettagli dei clienti esclusi da questa prima anteprima; nessun record viene modificato.';
  replaceOptions('seat-trip-select',[['','Nessun viaggio selezionato'],...trips.map(t=>[t.id,t.titolo+' · '+date(t.data_partenza)])]);
  renderSeats();
 }
 async function getRows(table,fields,key){
  const output=[];let start=0;const limit=1000;
  while(true){
   const endpoint=EXPECTED_URL+'/rest/v1/'+table+'?select='+encodeURIComponent(fields)+'&order='+encodeURIComponent(key+'.asc');
   const resp=await fetch(endpoint,{method:'GET',headers:{apikey:state.publishable,Authorization:'Bearer '+state.jwt,Range:start+'-'+(start+limit-1),'Range-Unit':'items'},cache:'no-store'});
   if(!resp.ok)throw Error(table+': HTTP '+resp.status);
   const page=await resp.json();if(!Array.isArray(page))throw Error('Risposta dati non valida: '+table);
   output.push(...page);if(page.length<limit)break;
   start+=limit;if(start>100000)throw Error('Troppe righe: '+table);
  }
  return output;
 }
 async function loadReadOnly(){
  if(!state.jwt)throw Error('Accesso richiesto');
  const [trips,bookings,seats,fleet]=await Promise.all([
   getRows('viaggi','id,titolo,data_partenza,ora_partenza,stato,posti_totali,autobus_id,bis_parent_id,bis_numero','id'),
   getRows('prenotazioni','id,viaggio_id,stato,posti','id'),
   getRows('prenotazione_posti','id,viaggio_id,prenotazione_id,posto','id'),
   getRows('flotta','id,marca,modello,posti,seat_layout,stato','id')
  ]);
  Object.assign(state,{trips,bookings,seats,fleet,connected:true});renderData();
  $('mode-badge').textContent='SUPABASE · SOLA LETTURA';$('mode-badge').classList.add('connected');
  $('login-button').hidden=true;$('logout-button').hidden=false;
 }
 async function login(e){
  e.preventDefault();$('login-error').textContent='';
  const url=$('supa-url').value.trim().replace(/\/+$/,'');
  if(url!==EXPECTED_URL){$('login-error').textContent='URL non corrispondente al progetto gestionale verificato.';return}
  const apiKey=$('supa-key').value.trim();
  if(!apiKey||/^(sb_secret_|eyJ.*service_role)/.test(apiKey)){$('login-error').textContent='Non utilizzare una chiave segreta. Serve publishable / anon.';return}
  const email=$('supa-email').value.trim(),password=$('supa-password').value;
  $('confirm-login').disabled=true;
  try{
   const r=await fetch(EXPECTED_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:apiKey,'Content-Type':'application/json'},body:JSON.stringify({email,password}),cache:'no-store'});
   const data=await r.json();if(!r.ok||!data.access_token)throw Error('Credenziali non valide o accesso non autorizzato');
   state.jwt=data.access_token;state.publishable=apiKey;
   await loadReadOnly();
   $('supa-password').value='';$('supa-key').value='';$('login-dialog').close();
  }catch(err){state.jwt='';state.publishable='';$('login-error').textContent='Impossibile connettersi: '+err.message}
  finally{$('confirm-login').disabled=false}
 }
 function init(){
  Object.keys(pages).forEach(p=>{$('page-'+p).classList.remove('active')});
  document.querySelectorAll('[data-page]').forEach(btn=>btn.addEventListener('click',()=>{
   const page=btn.dataset.page;
   document.querySelectorAll('[data-page]').forEach(x=>x.classList.toggle('active',x===btn));
   document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id==='page-'+page));
   $('page-title').textContent=pages[page];
  }));
  $('page-dashboard').classList.add('active');
  $('supa-url').value=EXPECTED_URL;$('supa-url').readOnly=true;
  $('login-button').addEventListener('click',()=>$('login-dialog').showModal());
  $('close-login').addEventListener('click',()=>$('login-dialog').close());
  $('login-form').addEventListener('submit',login);
  $('logout-button').addEventListener('click',()=>{
   Object.assign(state,{jwt:'',publishable:'',connected:false,trips:[],bookings:[],seats:[],fleet:[]});
   $('mode-badge').textContent='MODALITÀ DEMO';$('mode-badge').classList.remove('connected');
   $('login-button').hidden=false;$('logout-button').hidden=true;
   ['kpi-trips','kpi-bookings','kpi-seats','kpi-buses'].forEach(id=>$(id).textContent='—');
   emptyTable('dashboard-trips','Connetti un operatore autorizzato.',4);emptyTable('trips-list','Connetti un operatore autorizzato.',5);
   emptyTable('fleet-list','Connetti un operatore autorizzato.',4);
   $('bookings-summary').textContent='Collega Supabase per visualizzare il riepilogo.';
   replaceOptions('seat-trip-select',[['','Nessun viaggio selezionato']]);renderSeats();
  });
  $('refresh').addEventListener('click',async()=>{
   if(!state.jwt){$('login-dialog').showModal();return}
   try{await loadReadOnly()}catch(e){alert('Aggiornamento non riuscito: '+e.message)}
  });
  $('layout-select').addEventListener('change',e=>selectLayout(e.target.value));
  $('seat-trip-select').addEventListener('change',()=>{
   const trip=state.trips.find(t=>t.id===$('seat-trip-select').value);
   const bus=trip&&state.fleet.find(b=>b.id===trip.autobus_id);
   if(bus&&M.legacy[bus.seat_layout])selectLayout(bus.seat_layout);
   renderSeats();
  });
  $('new-layout').addEventListener('click',()=>{
   const name=prompt('Nome della nuova piantina','Piantina personalizzata');if(!name||!name.trim())return;
   state.key='nuova-'+Date.now();state.layout=M.fresh(name.trim());$('layout-name').value=name.trim();
   renderSeats();status('Inserisci i sedili premendo sulle celle vuote. Poi salva la bozza.');
  });
  $('add-row').addEventListener('click',()=>{if(state.layout.rows.length>=100)return status('Massimo 100 file',true);state.layout.rows.push(['empty','empty','aisle','empty','empty']);renderSeats()});
  $('remove-row').addEventListener('click',()=>{if(state.layout.rows.length<=1)return status('Almeno una fila necessaria',true);if(!confirm('Rimuovere l’ultima fila della bozza?'))return;state.layout.rows.pop();renderSeats()});
  $('copy-layout').addEventListener('click',()=>{state.layout=M.clone(state.layout);state.key='copia-'+Date.now();state.layout.name+=' · copia';$('layout-name').value=state.layout.name;saveDraft()});
  $('reset-layout').addEventListener('click',()=>{if(!confirm('Ripristinare il modello selezionato e perdere le modifiche non salvate?'))return;selectLayout(state.key);status('Ripristinato')});
  $('save-layout').addEventListener('click',saveDraft);
  $('export-layout').addEventListener('click',exportDraft);
  $('import-layout').addEventListener('change',e=>importDraft(e.target));
  updateLayouts();selectLayout('GT53');
 }
 document.addEventListener('DOMContentLoaded',init);
})();