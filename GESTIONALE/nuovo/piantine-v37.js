/* DELGROSSO DG37 — editor piantine e PDF reali. Nessuna modifica diretta a prenotazioni/pagamenti. */
(function(global){
'use strict';
let api=null, editor=null, tool='move', source='', chosenTrip='', chosenBus='', busy=false, available=null;
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const seat=x=>({type:'seat',id:String(x),status:'available'});
const nonseat=t=>({type:t});
const isSeat=x=>x&&x.type==='seat';
const nameTrip=t=>t.titolo||t.destinazione||'Viaggio';
const dateIT=s=>{s=String(s||'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)?s.slice(8)+'/'+s.slice(5,7)+'/'+s.slice(0,4):'—'};
const state=()=>editor&&editor.config;
const serial=()=>JSON.stringify({name:editor.name,config:editor.config});
const isDirty=()=>editor&&editor.saved!==serial();
const clone=x=>JSON.parse(JSON.stringify(x));
function makeConfig(capacity){
 const count=Number(capacity);if(![53,57,63].includes(count))throw Error('Scegli 53, 57 oppure 63 posti.');
 const rows=[];let next=1;
 while(next<=count){
  const cells=[0,1,2,3,4].map(i=>i===2?nonseat('aisle'):next<=count?seat(next++):nonseat('empty'));
  rows.push({cells});
 }
 return {version:2,source:'dg37-editor-operativo',posti_totali:count,rows};
}
function normalize(conf){
 if(!conf||!Array.isArray(conf.rows))throw Error('La piantina non contiene file riconoscibili.');
 const rows=conf.rows.map(row=>{
  let list=Array.isArray(row)?row:row.cells;
  if(!Array.isArray(list))throw Error('Fila non valida.');
  const cells=list.map(c=>{
   if(c&&typeof c==='object')return {type:String(c.type||'empty'),...(c.type==='seat'?{id:String(c.id),status:String(c.status||'available')}:{})};
   if(typeof c==='number'||/^\d+$/.test(String(c)))return seat(c);
   return nonseat(['aisle','door','empty','wc','driver','table'].includes(String(c))?String(c):'empty');
  });
  return {cells};
 });
 const count=Number(conf.posti_totali||conf.totalSeats||rows.flatMap(r=>r.cells).filter(isSeat).length);
 return {version:2,source:'dg37-editor-operativo',posti_totali:count,rows};
}
function validate(config,cap,strict=true){
 if(!config||!Array.isArray(config.rows)||!config.rows.length||config.rows.length>35)throw Error('La piantina richiede da 1 a 35 file.');
 const all=[];
 for(const row of config.rows){
  if(!Array.isArray(row.cells)||row.cells.length<1||row.cells.length>8)throw Error('Ogni fila deve contenere da 1 a 8 celle.');
  for(const cell of row.cells){
   if(isSeat(cell)){
    if(!/^[1-9][0-9]{0,2}$/.test(String(cell.id))||Number(cell.id)>cap)throw Error('Sedile numero '+cell.id+' non valido per '+cap+' posti.');
    if(!['available','blocked','out_of_service'].includes(cell.status||'available'))throw Error('Stato sedile non valido.');
    all.push(Number(cell.id));
   }else if(!['aisle','door','empty','wc','driver','table'].includes(cell?.type))throw Error('Elemento non ammesso nella piantina.');
  }
 }
 if(new Set(all).size!==all.length)throw Error('Esistono numeri di posto duplicati.');
 if(strict&&(all.length!==cap||Array.from({length:cap},(_,i)=>i+1).some(x=>!all.includes(x))))
  throw Error('NUMERAZIONE INCOMPLETA: il modello richiede esattamente '+cap+' sedili da 1 a '+cap+'.');
 if(JSON.stringify(config).length>58000)throw Error('Piantina troppo grande.');
 return {seats:all.length,rows:config.rows.length};
}
function newEditor(count=63){
 editor={id:'',name:'GT '+count+' · nuova piantina',config:makeConfig(count),selected:null,undo:[],redo:[],saved:null};
 source='';tool='move';
}
function loadDraft(d){
 const config=normalize(d.configurazione),id=d.attivo===true?d.id:'';
 editor={id,name:d.attivo===true?d.nome:d.nome+' (copia)',config,selected:null,undo:[],redo:[],saved:null};
 if(id)editor.saved=serial();
 source=d.id;tool='move';
 if(!d.attivo)api.notice('Bozza storica archiviata caricata come copia: salvandola creerai un nuovo modello.', 'warn');
}
function history(){
 if(!editor)return;
 editor.undo.push(JSON.stringify(editor.config));
 if(editor.undo.length>35)editor.undo.shift();
 editor.redo=[];
}
function step(dir){
 if(!editor)return;
 const from=dir==='undo'?editor.undo:editor.redo,other=dir==='undo'?editor.redo:editor.undo;
 if(!from.length)return;
 other.push(JSON.stringify(editor.config));editor.config=JSON.parse(from.pop());editor.selected=null;paint();
}
function toolButton(k,label){return '<button type="button" class="btn '+(tool===k?'solid':'quiet')+'" data-dl="tool" data-tool="'+k+'">'+label+'</button>'}
function editorHtml(){
 if(!editor)return '<p class="empty">Crea o seleziona una bozza.</p>';
 const cap=editor.config.posti_totali;
 const layout=editor.config.rows.map((r,ri)=>
 '<div class="dg37-row"><span class="dg37-idx">'+(ri+1)+'</span>'+
 r.cells.map((c,ci)=>'<button type="button" data-dl="cell" data-ri="'+ri+'" data-ci="'+ci+'" class="dg37-cell '+(isSeat(c)?(c.status==='blocked'?'blocked':c.status==='out_of_service'?'out':'seat'):'cell-'+esc(c.type))+' '+(editor.selected?.ri===ri&&editor.selected.ci===ci?'selected':'')+'" title="Fila '+(ri+1)+' - colonna '+(ci+1)+'">'+(isSeat(c)?'<strong>'+esc(c.id)+'</strong>':c.type==='aisle'?'↕':c.type==='door'?'PORTA':c.type==='wc'?'WC':c.type==='driver'?'AUTISTA':c.type==='table'?'TAVOLO':'·')+'</button>').join('')+
 '</div>').join('');
 const s=validate(editor.config,Number(cap),false);
 return '<section class="card"><div class="row"><h2>Editor piantine · '+cap+' sedili</h2><span class="tag '+(isDirty()?'warn':'')+'">'+(isDirty()?'Modifiche non salvate':'Salvato')+'</span></div>'+
 '<div class="fields"><label>Nome del modello<input id="dg37-name" maxlength="100" value="'+esc(editor.name)+'"></label><label>Capienza nuova piantina<select id="dg37-capacity"><option value="53" '+(cap===53?'selected':'')+'>53 posti · GT Century</option><option value="57" '+(cap===57?'selected':'')+'>57 posti · variante per viaggio</option><option value="63" '+(cap===63?'selected':'')+'>63 posti · GT PB</option></select></label><label>Carica bozza salvata<select id="dg37-draft"><option value="">— Scegli una bozza —</option>'+((api.currentDrafts||[]).map(d=>'<option value="'+esc(d.id)+'" '+(source===d.id?'selected':'')+'>'+esc(d.nome)+(d.attivo?'':' · archiviata')+'</option>').join(''))+'</select></label></div>'+
 '<div class="row" style="margin-bottom:12px"><button type="button" class="btn solid" data-dl="new">＋ Nuova piantina</button><button type="button" class="btn" data-dl="save">Salva bozza su Supabase</button><button type="button" class="btn" data-dl="clone">Duplica</button><button type="button" class="btn quiet" data-dl="undo">↶ Annulla</button><button type="button" class="btn quiet" data-dl="redo">↷ Ripeti</button><button type="button" class="btn quiet" data-dl="row-add">＋ Fila vuota</button></div>'+
 '<p class="sub">Tocca un sedile e poi un altro sedile/cella per scambiarli o spostarlo. Le modifiche **non** cambiano le prenotazioni. Usa gli strumenti per porte, corridoio e WC soltanto sulle celle senza sedile.</p>'+
 '<div class="row" style="margin-bottom:12px">'+toolButton('move','↔ Sposta / scambia')+toolButton('door','Porta')+toolButton('aisle','Corridoio')+toolButton('wc','WC')+toolButton('table','Tavolo')+toolButton('empty','Vuoto')+toolButton('available','Sedile disponibile')+toolButton('blocked','Blocca sedile')+'</div>'+
 '<div class="notice">File: '+s.rows+' · Sedili numerati: '+s.seats+'/'+cap+'. Fronte autobus in alto: schema da verificare fisicamente prima della pubblicazione.</div>'+
 '<div class="dg37-editor"><div class="dg37-front">FRONTE AUTOBUS · AUTISTA</div>'+layout+'</div></section>';
}
function assignmentHtml(trips,buses,tripOfficial,busOfficial){
 const upcoming=trips.filter(t=>!t.archiviato_at).sort((a,b)=>String(a.data_partenza||'').localeCompare(String(b.data_partenza||'')));
 const choices=upcoming.map(t=>'<option value="'+esc(t.id)+'" '+(chosenTrip===t.id?'selected':'')+'>'+esc(dateIT(t.data_partenza)+' · '+nameTrip(t))+' · '+esc(t.posti_totali)+' posti</option>').join('');
 const selected=trips.find(t=>t.id===chosenTrip);
 const busOpt=buses.map(b=>'<option value="'+esc(b.id)+'" '+(chosenBus===b.id?'selected':'')+'>'+esc(b.titolo||b.modello)+' · '+esc(b.posti)+' posti</option>').join('');
 const existingTrip=tripOfficial.find(x=>x.viaggio_id===chosenTrip);
 const existingBus=busOfficial.find(x=>x.autobus_id===chosenBus);
 return '<section class="card"><h2>Applica la piantina ai mezzi e ai viaggi</h2><p class="sub">Prima salva la bozza. La pubblicazione usa le funzioni ufficiali Supabase: controlla i sedili occupati e rifiuta numeri mancanti o incompatibili. Non sposta i prenotati.</p>'+
 '<div class="fields"><label>Viaggio da aggiornare<select id="dg37-trip">'+choices+'</select></label><label>Autobus GT da aggiornare<select id="dg37-bus">'+busOpt+'</select></label></div>'+
 '<div class="row"><button type="button" class="btn solid" data-dl="publish-trip">Applica al viaggio selezionato</button><button type="button" class="btn" data-dl="publish-bus">Pubblica sull’autobus GT</button><button type="button" class="btn" data-dl="availability">Controlla/assegna autobus al viaggio</button><button type="button" class="btn" data-dl="pdf-trip">Scarica PDF viaggio + BUS BIS</button><button type="button" class="btn" data-dl="pdf-sunday">PDF domenica 22/11</button><button type="button" class="btn quiet" data-dl="pdf-all">PDF tutti i viaggi</button></div>'+
 '<p class="sub">Viaggio: '+esc(selected?.autobus||'Nessun autobus assegnato')+' · Piantina ufficiale viaggio: '+(existingTrip?'versione '+esc(existingTrip.versione):'**assente**')+' · Piantina ufficiale autobus scelto: '+(existingBus?'versione '+esc(existingBus.versione):'**assente**')+'.</p>'+
 '<div id="dg37-availability">'+(available||'')+'</div></section>';
}
async function render(){
 if(!api)throw Error('Piantine non inizializzate');
 const [drafts,trips,fleet,busOfficial,tripOfficial]=await Promise.all([api.load('layoutDrafts'),api.load('trips'),api.load('fleet'),api.load('busOfficial'),api.load('tripOfficial')]);
 api.currentDrafts=drafts;
 const buses=fleet.filter(x=>x.categoria==='GT'&&[53,63].includes(Number(x.posti))&&x.attivo);
 if(!editor)newEditor(63);
 if(!chosenTrip){
  chosenTrip=trips.find(t=>t.data_partenza>='2026-11-16'&&!t.archiviato_at)?.id||trips[0]?.id||'';
 }
 if(!chosenBus)chosenBus=buses.find(x=>x.posti===63)?.id||buses[0]?.id||'';
 return '<div class="notice warn">DELGROSSO · piantine operative DG37. Verifica la posizione fisica dei sedili: una bozza non diventa ufficiale automaticamente. Le prenotazioni e i pagamenti non vengono modificati dall’editor.</div>'+
 '<div id="dg37-editor-container">'+editorHtml()+'</div><div id="dg37-assignment">'+assignmentHtml(trips,buses,tripOfficial,busOfficial)+'</div>';
}
function paint(){
 const el=$('dg37-editor-container');if(el)el.innerHTML=editorHtml();
}
function seatClick(button){
 if(!editor||busy)return;
 const ri=Number(button.dataset.ri),ci=Number(button.dataset.ci),c=editor.config.rows[ri]?.cells[ci];
 if(!c)return;
 if(['available','blocked'].includes(tool)){
  if(!isSeat(c)){api.notice('Scegli un sedile numerato.','warn');return}
  if(c.status!==tool){history();c.status=tool;paint()}
  return;
 }
 if(tool!=='move'){
  if(isSeat(c)){api.notice('Quella cella contiene un sedile. Spostalo prima su una cella vuota, così non perdi il numero.','warn');return}
  if(c.type!==tool){history();editor.config.rows[ri].cells[ci]=nonseat(tool);paint()}
  return;
 }
 if(!editor.selected){if(isSeat(c))editor.selected={ri,ci};else api.notice('Per spostare un sedile, seleziona prima il numero.','warn');paint();return}
 const first=editor.selected;
 if(first.ri===ri&&first.ci===ci){editor.selected=null;paint();return}
 history();
 const a=editor.config.rows[first.ri].cells[first.ci];
 editor.config.rows[first.ri].cells[first.ci]=editor.config.rows[ri].cells[ci];
 editor.config.rows[ri].cells[ci]=a;editor.selected=null;paint();
}
function nameInput(){
 if(!editor)return;
 const v=$('dg37-name')?.value?.trim();if(v)editor.name=v;
 // Non ridipingere durante la digitazione per non perdere il cursore.
}
function currentDraft(){
 return (api.currentDrafts||[]).find(d=>d.id===source);
}
async function save(){
 if(busy||!editor)return;
 nameInput();const count=Number(editor.config.posti_totali);
 if(editor.name.length<3||editor.name.length>100)throw Error('Nome del modello da 3 a 100 caratteri');
 validate(editor.config,count,true);
 busy=true;
 try{
  const user=await api.authorize(),id=user.id;
  const record={nome:editor.name,configurazione:editor.config,updated_by:id};
  let result;
  if(editor.id){
   const q=new URLSearchParams({id:'eq.'+editor.id,select:'id,nome,attivo'});
   result=await api.raw('/rest/v1/dg2_layout_library?'+q.toString(),'PATCH',record);
  }else{
   record.created_by=id;record.attivo=true;
   result=await api.raw('/rest/v1/dg2_layout_library?select=id,nome,attivo','POST',record);
  }
  if(!Array.isArray(result)||result.length!==1||!result[0].id)throw Error('Supabase non ha confermato il salvataggio della bozza: verifica prima di ripetere.');
  editor.id=result[0].id;source=editor.id;editor.saved=serial();
  api.invalidate('layoutDrafts');
  api.currentDrafts=await api.load('layoutDrafts',true);
  api.notice('Bozza salvata su Supabase. Ora puoi pubblicarla per viaggio/autobus.', '');
  paint();
 }finally{busy=false}
}
function exactModel(){
 if(!editor||!editor.id||isDirty())throw Error('Salva prima la bozza corrente. La pubblicazione usa esclusivamente il modello salvato su Supabase.');
 validate(editor.config,editor.config.posti_totali,true);
}
async function publish(kind){
 if(busy)return;
 exactModel();
 const trips=await api.load('trips',true),fleet=await api.load('fleet',true);
 const t=trips.find(x=>x.id===chosenTrip),b=fleet.find(x=>x.id===chosenBus);
 let payload,fn,label;
 if(kind==='trip'){
  if(!t)throw Error('Seleziona un viaggio');
  if(!t.autobus_id)throw Error('Al viaggio non è assegnato un GT. Usa il controllo disponibilità e assegna il mezzo prima di pubblicare.');
  const realBus=fleet.find(x=>x.id===t.autobus_id);
  if(realBus?.categoria!=='GT')throw Error('Il viaggio non ha un autobus GT valido.');
  if(Number(editor.config.posti_totali)!==Number(t.posti_totali))throw Error('Capienza diversa: la piantina ha '+editor.config.posti_totali+' posti, il viaggio '+t.posti_totali+'.');
  payload={p_viaggio_id:t.id,p_layout_id:editor.id};fn='dg28_publish_trip_layout_v1';label=nameTrip(t);
 }else{
  if(!b||b.categoria!=='GT')throw Error('Seleziona un autobus GT valido');
  if(Number(editor.config.posti_totali)!==Number(b.posti))throw Error('La piantina deve avere '+b.posti+' sedili per '+(b.titolo||b.modello)+'. Un modello da 57 posti è soltanto per un viaggio.');
  payload={p_autobus_id:b.id,p_layout_id:editor.id};fn='dg28_publish_bus_layout_v1';label=b.titolo||b.modello;
 }
 if(!confirm('PUBBLICARE PIANTINA UFFICIALE?\n\n'+label+'\nModello: '+editor.name+'\nSedili: '+editor.config.posti_totali+'\n\nNon saranno spostati né cancellati i prenotati. Supabase bloccherà eventuali incompatibilità.'))return;
 busy=true;
 try{
  await api.authorize();
  const response=await api.raw('/rest/v1/rpc/'+fn,'POST',payload);
  if(response?.success!==true)throw Error('Supabase non ha confermato la pubblicazione.');
  const key=kind==='trip'?'tripOfficial':'busOfficial';
  const rows=await api.load(key,true);
  const hit=rows.find(x=>kind==='trip'?x.viaggio_id===t.id:x.autobus_id===b.id);
  if(!hit||hit.layout_id!==editor.id)throw Error('Pubblicazione inviata ma non risulta nell’archivio: controllare prima di riprovare.');
  api.invalidate('tripOfficial','busOfficial');available=null;
  api.notice('Piantina ufficiale applicata a '+label+' · versione '+hit.versione+'. Posti e pagamenti invariati.','');
  const container=$('dg37-assignment');if(container)container.innerHTML=assignmentHtml(trips,fleet.filter(x=>x.categoria==='GT'&&x.attivo),kind==='trip'?rows:await api.load('tripOfficial'),kind==='bus'?rows:await api.load('busOfficial'));
 }finally{busy=false}
}
async function availabilityCheck(){
 const trips=await api.load('trips',true),t=trips.find(x=>x.id===chosenTrip);
 if(!t)throw Error('Seleziona un viaggio');
 const data=await api.raw('/rest/v1/rpc/dg3_disponibilita_autobus_viaggio_v1','POST',{p_viaggio_id:t.id});
 if(!Array.isArray(data?.autobus))throw Error('Disponibilità autobus non leggibile');
 const choices=data.autobus.filter(x=>x.disponibile||x.attualmente_assegnato);
 available='<div class="notice"><strong>Autobus per '+esc(nameTrip(t))+'</strong><p class="sub">Se il mezzo è già assegnato non cambiarlo senza necessità. La procedura controlla blocchi e sovrapposizioni.</p>'+
 (choices.length?choices.map(x=>'<button type="button" class="btn" data-dl="assign" data-bus-id="'+esc(x.id)+'">'+esc(x.titolo||x.modello)+' · '+esc(x.posti)+' posti '+(x.attualmente_assegnato?'(già assegnato)':'— disponibile')+'</button>').join(' '):'<p>Nessun mezzo disponibile. Non forzare la modifica.</p>')+'</div>';
 const el=$('dg37-availability');if(el)el.innerHTML=available;
}
async function assignBus(id){
 const trips=await api.load('trips',true),t=trips.find(x=>x.id===chosenTrip);
 if(!t)throw Error('Viaggio non trovato');
 if(t.autobus_id===id){api.notice('Autobus già assegnato al viaggio.','');return}
 const data=await api.raw('/rest/v1/rpc/dg3_disponibilita_autobus_viaggio_v1','POST',{p_viaggio_id:t.id});
 const bus=(data.autobus||[]).find(x=>x.id===id&&x.disponibile);
 if(!bus)throw Error('Autobus non disponibile per questa data. Nessun dato è stato modificato.');
 if(!confirm('Assegnare '+bus.titolo+' al viaggio '+nameTrip(t)+'?\nIl database verificherà prenotati, capienza e sovrapposizioni.'))return;
 const params={p_viaggio_id:t.id,p_autobus_id:id,p_stato:t.stato,p_autobus_precedente_id:t.autobus_id||null,p_stato_precedente:t.stato};
 busy=true;
 try{
  await api.authorize();
  const response=await api.raw('/rest/v1/rpc/dg3_aggiorna_viaggio_autobus_stato_v1','POST',params);
  if(response?.success!==true)throw Error('Supabase non ha confermato l’assegnazione.');
  const refreshed=await api.load('trips',true);
  if(refreshed.find(x=>x.id===t.id)?.autobus_id!==id)throw Error('La nuova assegnazione non risulta verificata: non ripetere senza controllo.');
  chosenBus=id;available=null;
  api.notice('Mezzo assegnato ufficialmente a '+nameTrip(t)+' senza modifiche ai prenotati.','');
  const html=await render();const main=$('content');if(main)main.innerHTML=html;
 }finally{busy=false}
}
function parseSeats(b){
 return String(b.posti_selezionati||'').split(/[,;\s]+/).map(x=>x.trim()).filter(x=>/^[1-9]\d{0,2}$/.test(x));
}
function ticket(b,seatrows){
 const seats=new Set(parseSeats(b));
 for(const x of seatrows)if(x.prenotazione_id===b.id&&/^[1-9]\d{0,2}$/.test(String(x.posto)))seats.add(String(x.posto));
 return {...b,sedili:[...seats].sort((a,b)=>Number(a)-Number(b))};
}
function active(b){return !/annull|cancel|cancell|eliminat/i.test(b.stato||'')&&!b.riserva_aziendale;}
function root(t){return t.bis_parent_id||t.id}
async function pdfGroups(selected){
 const [trips,bookings,seatrows,tripOfficial,busOfficial]=await Promise.all([api.load('trips',true),api.load('bookings',true),api.load('seatrows',true),api.load('tripOfficial',true),api.load('busOfficial',true)]);
 const target=trips.filter(t=>!t.archiviato_at&&(!selected||selected==='all'||selected==='sunday'?true:t.id===selected||root(t)===root(trips.find(x=>x.id===selected)||{id:selected})));
 const eligible=selected==='sunday'?target.filter(t=>t.data_partenza==='2026-11-22'):target;
 const groups=new Map();
 for(const t of eligible.sort((a,b)=>String(a.data_partenza).localeCompare(String(b.data_partenza)))){
  const rid=root(t);if(!groups.has(rid)){const parent=trips.find(x=>x.id===rid)||t;groups.set(rid,{title:nameTrip(parent),trip:parent,buses:[]})}
  const list=bookings.filter(b=>b.viaggio_id===t.id&&active(b)).map(b=>ticket(b,seatrows.filter(x=>x.viaggio_id===t.id)));
  const mapping=tripOfficial.find(x=>x.viaggio_id===t.id)||busOfficial.find(x=>x.autobus_id===t.autobus_id);
  const count=list.reduce((n,b)=>n+(Number(b.posti)||0),0);
  const counted=new Set(list.flatMap(b=>b.sedili));
  const warnings=[];
  if(count!==Number(t.posti_occupati||0))warnings.push('Contatore '+t.posti_occupati+' diverso da somma prenotati '+count);
  if(count!==counted.size)warnings.push('Posti nominativi '+counted.size+' diversi da persone '+count);
  groups.get(rid).buses.push({name:nameTrip(t),trip:t,bookings:list,layout:mapping?.configurazione||null,official:!!mapping,warnings});
 }
 return [...groups.values()];
}
function downloadPdf(bytes,filename){
 if(!bytes?.length)throw Error('Il generatore non ha prodotto un PDF.');
 const blob=new Blob([bytes],{type:'application/pdf'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
 return filename;
}
async function pdf(kind){
 if(!global.DG2Pdf?.makeOperationalPdf)throw Error('Generatore PDF non caricato: ricarica la pagina.');
 const trips=await api.load('trips');
 if(kind==='trip'&&!trips.some(t=>t.id===chosenTrip))throw Error('Seleziona un viaggio.');
 const groups=await pdfGroups(kind==='all'?'all':kind==='sunday'?'sunday':chosenTrip);
 if(!groups.length)throw Error('Nessun viaggio disponibile per il documento.');
 const bytes=global.DG2Pdf.makeOperationalPdf(groups);
 return downloadPdf(bytes,'DELGROSSO_CONTROL_ROOM_'+(kind==='sunday'?'22_11_2026':kind==='all'?'TUTTI_I_VIAGGI':'VIAGGIO')+'.pdf');
}
async function renderControlMap(trip,bookings,occupiedBySeat){
 const [tripLayouts,busLayouts]=await Promise.all([api.load('tripOfficial'),api.load('busOfficial')]);
 const official=tripLayouts.find(x=>x.viaggio_id===trip.id)||busLayouts.find(x=>x.autobus_id===trip.autobus_id);
 if(!official)return '<p class="notice warn">Nessuna piantina fisica ufficiale pubblicata: sotto resta l’elenco numerico dei posti. Creala in Piantine GT e pubblicala per questo viaggio.</p>';
 const config=normalize(official.configurazione);
 try{validate(config,Number(trip.posti_totali),true)}catch(e){return '<div class="notice bad">Piantina ufficiale non compatibile con la capienza corrente: '+esc(e.message)+'</div>'}
 const map=new Map([...occupiedBySeat].map(([k,v])=>[String(k),v]));
 const html=config.rows.map((row,ri)=>'<div class="dg37-row"><span class="dg37-idx">'+(ri+1)+'</span>'+row.cells.map(c=>{
  if(!isSeat(c))return '<span class="dg37-cell cell-'+esc(c.type)+'">'+(c.type==='aisle'?'↕':c.type==='door'?'PORTA':c.type==='wc'?'WC':'·')+'</span>';
  const b=map.get(c.id),label=b?b.cliente_nome||b.cliente||'Prenotato':'Libero';
  return '<span class="dg37-cell '+(b?'occupied':'seat')+'"><strong>'+esc(c.id)+'</strong><small>'+esc(label)+'</small></span>';
 }).join('')+'</div>').join('');
 return '<section><h3>Piantina ufficiale · versione '+esc(official.versione)+'</h3><div class="dg37-editor"><div class="dg37-front">FRONTE AUTOBUS · AUTISTA</div>'+html+'</div></section>';
}
function click(e){
 const b=e.target.closest('button[data-dl]');if(!b||!api)return;
 e.preventDefault();
 const k=b.dataset.dl;
 const run=async()=>{
  if(k==='new'){if(isDirty()&&!confirm('Le modifiche non salvate saranno perse. Continuare?'))return;newEditor(Number($('dg37-capacity')?.value||63));paint()}
  else if(k==='tool'){tool=b.dataset.tool;paint()}
  else if(k==='cell')seatClick(b);
  else if(k==='save')await save();
  else if(k==='clone'){if(!editor)return;editor.id='';editor.name+=' · copia';editor.saved=null;source='';paint()}
  else if(k==='undo'||k==='redo')step(k);
  else if(k==='row-add'){if(editor.config.rows.length>=35)throw Error('Massimo 35 file.');history();editor.config.rows.push({cells:[nonseat('empty'),nonseat('empty'),nonseat('aisle'),nonseat('empty'),nonseat('empty')]});paint()}
  else if(k==='publish-trip')await publish('trip');
  else if(k==='publish-bus')await publish('bus');
  else if(k==='availability')await availabilityCheck();
  else if(k==='assign')await assignBus(b.dataset.busId);
  else if(k==='pdf-trip')await pdf('trip');
  else if(k==='pdf-all')await pdf('all');
  else if(k==='pdf-sunday')await pdf('sunday');
 };
 run().catch(err=>api.notice('Operazione non riuscita: '+String(err?.message||err),'bad'));
}
function change(e){
 if(!api)return;
 const k=e.target.id;
 if(k==='dg37-name')nameInput();
 if(k==='dg37-capacity'){
  if(isDirty()&&!confirm('Creare una nuova piantina? Le modifiche non salvate andranno perse.')){e.target.value=editor.config.posti_totali;return}
  newEditor(Number(e.target.value));paint();
 }
 if(k==='dg37-draft'){
  if(isDirty()&&!confirm('Caricare la bozza? Le modifiche non salvate andranno perse.')){e.target.value=source;return}
  const d=(api.currentDrafts||[]).find(x=>x.id===e.target.value);
  if(d){loadDraft(d);paint()}
 }
 if(k==='dg37-trip'){chosenTrip=e.target.value;available=null;const el=$('dg37-availability');if(el)el.innerHTML=''}
 if(k==='dg37-bus')chosenBus=e.target.value;
}
function clear(){editor=null;source='';chosenTrip='';chosenBus='';busy=false;available=null;}
function init(deps){
 api=deps;
 document.addEventListener('click',click);
 document.addEventListener('change',change);
}
global.DG37Layouts=Object.freeze({init,clear,render,renderControlMap,makeConfig,normalize,validate,get selectedTrip(){return chosenTrip},set selectedTrip(x){chosenTrip=x},pdf});
})(window);