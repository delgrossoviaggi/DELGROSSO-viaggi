/* DELGROSSO VIAGGI — Editor piantine GT, v2.8; layout ufficiali Supabase */
(function SeatLayoutEditor28(){
'use strict';
let activeBusId='', draft=null, selectedLayoutId='', currentBusLabel='',busy=false;
let fleet=[],library=[],busOfficial=[],tripOfficial=[],trips=[],message='';
const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function clone(x){return JSON.parse(JSON.stringify(x))}
function createTemplate(n,name){
 const rows=[];let next=1;
 while(next<=n){let cells=[];for(let col=0;col<5;col++){if(col===2){cells.push({type:'aisle'});continue}
  if(next<=n){cells.push({type:'seat',id:String(next),label:String(next).padStart(2,'0'),status:'available'});next++}
  else cells.push({type:'empty'});
 }
 rows.push({rowNumber:rows.length+1,label:`Fila ${rows.length+1}`,cells});
 }
 return {version:2,creator:'DELGROSSO-EDITOR-2.8',name,posti_totali:n,rows};
}
const countSeats=()=>draft?.rows?.flatMap(r=>r.cells||[]).filter(c=>c.type==='seat').length||0;
function selectedBus(){return fleet.find(x=>x.id===activeBusId)}
function defaultConfig(bus){return createTemplate(Number(bus?.posti)||53,bus?.titolo||'Autobus')}
function grid(){
 if(!draft)return '<div class="empty">Seleziona un autobus per iniziare.</div>';
 return `<div class="dg28-map"><div class="dg28-front">◉ AUTISTA &nbsp; · &nbsp; FRONTE AUTOBUS</div>
 ${draft.rows.map((r,i)=>`<div class="dg28-row"><b>Fila ${i+1}</b><div class="dg28-cells">${(r.cells||[]).map((c,j)=>`<div class="dg28-cell ${c.type==='seat'?'dg28-seat '+(c.status==='blocked'?'dg28-blocked':c.status==='out_of_service'?'dg28-service':''):'dg28-nonseat'}" draggable="true" data-r="${i}" data-c="${j}" title="Trascina per scambiare posizione">
 <button type="button" data-dg28="cell" data-r="${i}" data-c="${j}" title="Cambia elemento">${c.type==='seat'?h(c.id):h(({aisle:'║',empty:'·',door:'PORTA',wc:'WC',driver:'GUIDA',table:'TAV.'})[c.type]||'·')}</button>
 ${c.type==='seat'?`<button type="button" class="dg28-mini" data-dg28="status" data-r="${i}" data-c="${j}" title="Libero / bloccato / fuori servizio">${c.status==='blocked'?'🔒':c.status==='out_of_service'?'⚠':'✓'}</button>`:''}
 </div>`).join('')}</div></div>`).join('')}
 <div class="dg28-rear">POSTERIORE</div></div>`;
}
function style(){
 if(document.getElementById('dg28-style'))return;
 const el=document.createElement('style');el.id='dg28-style';
 el.textContent=`.dg28-buses{display:flex;flex-wrap:wrap;gap:9px;margin:12px 0}.dg28-buses button,.dg28-toolbar button{border:1px solid #b8d0d0;background:white;color:#124653;padding:9px 11px;border-radius:9px;cursor:pointer}.dg28-buses button.active{background:#0d6267;color:#fff}.dg28-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin:13px 0}.dg28-toolbar button.primary{background:#087779;color:white;border-color:#087779}.dg28-map{max-width:690px;border:2px solid #c7d7d9;border-radius:18px;background:#f6fafa;padding:12px;margin:15px auto}.dg28-front,.dg28-rear{text-align:center;padding:10px;color:#37606c;font-size:12px;font-weight:bold}.dg28-row{display:grid;grid-template-columns:70px 1fr;align-items:center;gap:8px;margin:5px 0}.dg28-row>b{font-size:11px;color:#607781}.dg28-cells{display:grid;grid-template-columns:1fr 1fr .65fr 1fr 1fr;gap:6px}.dg28-cell{min-height:49px;border:1px dashed #bdc9cf;border-radius:8px;text-align:center;display:flex;flex-direction:column;justify-content:center;align-items:center}.dg28-cell button{background:transparent;border:0;cursor:pointer;font-weight:bold;color:inherit}.dg28-seat{background:#d6f4e9;border-color:#62b59d}.dg28-blocked{background:#ffe5a6;border-color:#dbab41}.dg28-service{background:#f4cfcb;border-color:#be716b}.dg28-nonseat{background:#e9eff1;color:#8596a0}.dg28-mini{font-size:11px}.dg28-cell:focus-within{outline:2px solid #2b939b}.dg28-options{display:grid;grid-template-columns:1fr 1fr;gap:10px}.dg28-options label{display:grid;gap:5px}.dg28-options select,.dg28-options input{padding:10px;border-radius:8px;border:1px solid #c2d3d6;max-width:100%}.dg28-status{padding:12px;background:#f0f8f8;border:1px solid #c9e2e1;border-radius:8px}.dg28-note{font-size:12px;color:#44636d}.dg28-lib{margin:12px 0;display:flex;align-items:center;gap:8px;flex-wrap:wrap}.dg28-lib select{padding:9px;max-width:400px}@media(max-width:680px){.dg28-row{grid-template-columns:45px 1fr;gap:3px}.dg28-cells{gap:3px}.dg28-map{padding:6px}.dg28-cell{min-height:41px}.dg28-options{grid-template-columns:1fr}}`;
 document.head.appendChild(el);
}
async function fetchData(){
 if(typeof DGData==='undefined')throw Error('Modulo Supabase mancante');
 const [f,l,bo,to,t]=await Promise.all([
 DGData.rows('fleet'),DGData.rows('layouts'),DGData.rows('officialBusLayouts'),DGData.rows('officialTripLayouts'),DGData.rows('trips')
 ]);
 fleet=(f||[]).filter(x=>x.categoria==='GT'&&[53,63].includes(Number(x.posti))&&x.attivo&&!/mercedes|v250/i.test(x.titolo||''));
 library=l||[];busOfficial=bo||[];tripOfficial=to||[];trips=t||[];
 if(!fleet.some(x=>x.id===activeBusId)){activeBusId=fleet[0]?.id||'';draft=activeBusId?defaultConfig(selectedBus()):null;selectedLayoutId='';}
}
function ui(){
 style();let bus=selectedBus(),official=busOfficial.find(x=>x.autobus_id===activeBusId);
 const warnings=`Le piantine iniziali sono schemi da correggere manualmente, NON rappresentazioni omologate. Il sito utilizza soltanto piantine pubblicate. Una modifica alla bozza non cambia le prenotazioni esistenti.`;
 const busButtons=fleet.map(b=>{let officialFor=busOfficial.find(x=>x.autobus_id===b.id);
 return `<button type="button" class="${b.id===activeBusId?'active':''}" data-dg28="bus" data-id="${h(b.id)}">${h(b.titolo||b.modello)} · ${b.posti} posti ${officialFor?'✓ UFFICIALE':''}</button>`}).join('');
 const matching=library.filter(x=>x.attivo&&Number(x.configurazione?.posti_totali||x.configurazione?.totalSeats)===Number(bus?.posti||0));
 const options='<option value="">Seleziona una bozza salvata…</option>'+matching.map(x=>`<option value="${h(x.id)}" ${selectedLayoutId===x.id?'selected':''}>${h(x.nome)} (${h(x.configurazione?.posti_totali)} posti)</option>`).join('');
 const available=trips.filter(t=>t.autobus_id===bus?.id&&!t.archiviato_at&&!/annull/i.test(t.stato||'')).sort((a,b)=>String(a.data_partenza).localeCompare(String(b.data_partenza)));
 return sec('Editor ufficiale delle piantine autobus','Modifica sedili manualmente · Salva la bozza · Pubblica sull’autobus o su un singolo viaggio')+
 `<section class="panel"><h3>Seleziona uno dei 3 autobus GT</h3><div class="dg28-buses">${busButtons||'<span>Nessun autobus GT trovato in Supabase.</span>'}</div><p class="dg28-note">${h(warnings)}</p>
 <div class="dg28-status"><b>${h(bus?.titolo||'Seleziona autobus')}</b> · Capienza registrata ${h(bus?.posti||'—')} · Piantina pubblicata: ${official?'SÌ (versione '+official.versione+')':'NO'}<br>
 Bozza corrente: ${countSeats()} sedili · Stato: ${selectedLayoutId?'Salvata':'Non salvata'}. ${h(message)}</div></section>
 <section class="panel"><h3>Disegna la disposizione dei posti</h3><div class="dg28-lib"><select id="dg28-library">${options}</select><button type="button" class="btn-secondary" data-dg28="load">Apri bozza</button><button type="button" class="btn-secondary" data-dg28="fresh">Nuova bozza</button></div>
 <div class="dg28-options"><label>Nome piantina<input id="dg28-name" value="${h(draft?.name||bus?.titolo||'')}" maxlength="100"></label><label>Numero di sedili / Capienza attesa<input value="${h(bus?.posti||'')}" readonly aria-label="Capienza omologata già registrata"></label></div>
 <div class="dg28-toolbar"><button data-dg28="row-add">+ Fila</button><button data-dg28="row-remove">− Ultima fila</button><button data-dg28="renumber">Rinumerazione automatica</button><button data-dg28="copy-official">Carica piantina ufficiale</button></div>
 <p class="dg28-note">Tocca un elemento per cambiare tra sedile, spazio, corridoio e porta; tocca ✓ per bloccare o mettere fuori servizio il posto. Su PC trascina le celle per scambiarle. Poi rinumera se necessario.</p>
 ${grid()}
 <div class="dg28-toolbar"><button class="primary" data-dg28="save">Salva bozza in Supabase</button>
 <button class="primary" data-dg28="publish-bus">✓ Applica ufficialmente all’autobus</button></div>
 <div class="dg28-options"><label>Variante per un viaggio con questo autobus<select id="dg28-trip"><option value="">Seleziona viaggio</option>${available.map(t=>`<option value="${h(t.id)}">${h(t.titolo)} · ${h(t.data_partenza)} · ${h(t.posti_totali)} posti</option>`).join('')}</select></label><div style="align-self:end"><button class="btn-secondary" data-dg28="publish-trip">Applica piantina personalizzata al viaggio</button></div></div>
 <p class="dg28-note">La capienza non si modifica da qui. Per un viaggio da 57 posti su autobus da 63, crea una variante di 57 sedili: la pubblicazione verifica le prenotazioni già presenti e blocca gli errori.</p></section>`;
}
async function reload(){
 try{await fetchData();message='';if(document.body.dataset.startPage==='layouts')await loadPage()}catch(e){message=e.message;if(document.body.dataset.startPage==='layouts')await loadPage();}
}
function swap(a,b){let t=draft.rows[a[0]].cells[a[1]];draft.rows[a[0]].cells[a[1]]=draft.rows[b[0]].cells[b[1]];draft.rows[b[0]].cells[b[1]]=t}
function renumber(){let n=1;draft.rows.forEach((r,i)=>{r.rowNumber=i+1;r.label=`Fila ${i+1}`;r.cells.forEach(c=>{if(c.type==='seat'){c.id=String(n);c.label=String(n).padStart(2,'0');n++}})});draft.posti_totali=n-1}
function getCurrentName(){return document.querySelector('#dg28-name')?.value.trim()||currentBusLabel||selectedBus()?.titolo}
async function run(action,id,el){
 if(busy)return;busy=true;
 try{
 const bus=selectedBus();if(!bus)throw Error('Autobus non selezionato');if(!['bus','fresh','load','copy-official'].includes(action)&&draft){const name=document.querySelector('#dg28-name')?.value.trim();if(name)draft.name=name;}
 if(['cell','status','row-add','row-remove','renumber','copy-official','fresh','load','save','publish-bus','publish-trip'].includes(action)&&!draft)draft=defaultConfig(bus);
 if(action==='bus'){activeBusId=id;selectedLayoutId='';draft=defaultConfig(fleet.find(x=>x.id===id));message='Schema iniziale da verificare';}
 else if(action==='fresh'){draft=defaultConfig(bus);selectedLayoutId='';message='Nuova bozza: modifiche non ancora salvate';}
 else if(action==='copy-official'){const o=busOfficial.find(x=>x.autobus_id===bus.id);if(!o)throw Error('Non esiste ancora una piantina ufficiale per questo autobus');draft=clone(o.configurazione);selectedLayoutId='';message='Copia dell’ufficiale: salvarla come nuova bozza';}
 else if(action==='load'){const id=document.querySelector('#dg28-library')?.value;const l=library.find(x=>x.id===id);if(!l)throw Error('Seleziona una bozza dalla libreria');draft=clone(l.configurazione);
 if(Array.isArray(draft.rows)&&draft.rows.some(r=>Array.isArray(r))){
  draft.rows=draft.rows.map((r,i)=>({rowNumber:i+1,label:'Fila '+(i+1),cells:r.map(c=>
   typeof c==='number'?{type:'seat',id:String(c),label:String(c).padStart(2,'0'),status:'available'}:
   typeof c==='string'&&/^\d+$/.test(c)?{type:'seat',id:c,label:c.padStart(2,'0'),status:'available'}:
   {type:['aisle','door','empty','wc','table'].includes(c)?c:'empty'})}));
 }
 selectedLayoutId=id;message='Bozza caricata';}
 else if(action==='cell'){const r=Number(el.dataset.r),c=Number(el.dataset.c),cell=draft.rows[r]?.cells[c];if(!cell)throw Error('Cella non trovata');const seq=['seat','empty','aisle','door','wc','table'];const index=seq.indexOf(cell.type);cell.type=seq[(index+1)%seq.length];if(cell.type==='seat'){cell.id='0';cell.label='--';cell.status='available'}else{delete cell.id;delete cell.label;delete cell.status};message='Modifiche da salvare; rinumera prima della pubblicazione';}
 else if(action==='status'){const r=Number(el.dataset.r),c=Number(el.dataset.c),cell=draft.rows[r]?.cells[c];if(!cell||cell.type!=='seat')throw Error('Sedile non presente');cell.status=cell.status==='available'?'blocked':cell.status==='blocked'?'out_of_service':'available';}
 else if(action==='row-add'){if(draft.rows.length>=35)throw Error('Massimo 35 file');draft.rows.push({rowNumber:draft.rows.length+1,cells:[{type:'empty'},{type:'empty'},{type:'aisle'},{type:'empty'},{type:'empty'}]});}
 else if(action==='row-remove'){if(draft.rows.length<=1)throw Error('Almeno una fila obbligatoria');if(!confirm('Rimuovere l’ultima fila? I sedili inclusi saranno rimossi dalla bozza.'))return;draft.rows.pop();}
 else if(action==='renumber'){renumber();message='Sedili rinumerati. Verifica la geometria reale prima di pubblicare.';}
 else if(action==='save'){
  renumber();let name=getCurrentName();if(name.length<3)throw Error('Nome della piantina troppo breve');
  draft.name=name;draft.posti_totali=countSeats();
  if(selectedLayoutId){const saved=await DGData.update('dg2_layout_library',selectedLayoutId,{nome:name,configurazione:draft,updated_by:DGData.actor?.id});selectedLayoutId=saved.id}
  else{const saved=await DGData.insert('dg2_layout_library',{nome:name,configurazione:draft,attivo:true,created_by:DGData.actor?.id,updated_by:DGData.actor?.id});selectedLayoutId=saved.id;}
  message='Bozza salvata in Supabase. Non ancora pubblicata.';library=await DGData.rows('layouts');}
 else if(action==='publish-bus'){
  if(!selectedLayoutId)throw Error('Salva prima la bozza');
  if(countSeats()!==Number(bus.posti))throw Error(`L’autobus ha ${bus.posti} posti: la bozza contiene ${countSeats()} sedili.`);
  if(!confirm('PUBBLICARE come piantina ufficiale di '+bus.titolo+'? Il sito userà questa disposizione. Posti e prenotazioni esistenti saranno verificati.'))return;
  await DGData.rpc('dg28_publish_bus_layout_v1',{p_autobus_id:bus.id,p_layout_id:selectedLayoutId});
  message='Piantina ufficiale pubblicata: il sito la leggerà da Supabase.';busOfficial=await DGData.rows('officialBusLayouts');
 }
 else if(action==='publish-trip'){
  if(!selectedLayoutId)throw Error('Salva prima la variante');
  const tripId=document.querySelector('#dg28-trip')?.value;if(!tripId)throw Error('Seleziona il viaggio');
  const t=trips.find(x=>x.id===tripId);if(!t)throw Error('Viaggio non trovato');
  if(countSeats()!==Number(t.posti_totali))throw Error(`Per il viaggio sono richiesti esattamente ${t.posti_totali} sedili.`);
  if(!confirm(`Applica questa piantina al viaggio ${t.titolo} del ${t.data_partenza}? La procedura verifica i posti già venduti.`))return;
  await DGData.rpc('dg28_publish_trip_layout_v1',{p_viaggio_id:tripId,p_layout_id:selectedLayoutId});
  message='Variante ufficiale pubblicata per il viaggio.';tripOfficial=await DGData.rows('officialTripLayouts');
 }
 if(document.body.dataset.startPage==='layouts')await loadPage();
 }catch(e){message='Errore: '+e.message;toast(message);if(document.body.dataset.startPage==='layouts')await loadPage();}
 finally{busy=false;}
}
document.addEventListener('click',async e=>{const el=e.target.closest('[data-dg28]');if(!el)return;e.preventDefault();await run(el.dataset.dg28,el.dataset.id,el)});
let drag=null;
document.addEventListener('dragstart',e=>{const el=e.target.closest('.dg28-cell[data-r]');if(!el)return;drag=[Number(el.dataset.r),Number(el.dataset.c)];});
document.addEventListener('dragover',e=>{if(drag&&e.target.closest('.dg28-cell[data-r]'))e.preventDefault();});
document.addEventListener('drop',e=>{const el=e.target.closest('.dg28-cell[data-r]');if(!el||!drag||!draft)return;e.preventDefault();swap(drag,[Number(el.dataset.r),Number(el.dataset.c)]);drag=null;if(document.body.dataset.startPage==='layouts')loadPage();});
if(typeof renders!=='undefined'){
 renders.layouts=async function(){
  if(isDemo())return sec('Piantine degli autobus','Editor disponibile dopo l’accesso Nicola/Raffaele')+cardInfo('Accedi con Supabase per modificare le piantine ufficiali. Nessuna modifica in modalità demo.','warn');
  try{await fetchData();return ui()}catch(err){return sec('Editor piantine','Verifica collegamento a Supabase')+cardInfo(err.message,'warn')}
 };
 if(document.body.dataset.startPage==='layouts'&&DGData?.sessionActive)loadPage();
}
window.DGPiantine28=Object.freeze({version:'2.8',makeTemplate:createTemplate,countSeats});
})();
