/* DELGROSSO V2 FUSION DG33 - additive bridge, no replacement of V2 navigation/accounting. */
(function(){
'use strict';
const VERSION='DG33 · V2 FUSION';
const URL_BASE='https://chkuayhbmitdmzmmvona.supabase.co';
const PUBLIC_KEY='sb_publishable_H29K1BV5ZE1rT8xo0PIzVA_wF6zC7je'; // Supabase public publishable key, not a secret.
const $=id=>document.getElementById(id);
const h=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=x=>JSON.parse(JSON.stringify(x));
const validActive=b=>b&&!b.riserva_aziendale&&!/annull|cancell|cancel|eliminat|storn|rimborsat/i.test(String(b.stato||''));
const num=n=>Number(n)||0;
const date=s=>/^\d{4}-\d\d-\d\d/.test(String(s||''))?String(s).slice(8,10)+'/'+String(s).slice(5,7)+'/'+String(s).slice(0,4):String(s||'');
const safeName=s=>String(s||'PARTENZA').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9_-]+/g,'_').slice(0,54);
const busName=b=>b?.titolo||[b?.marca,b?.modello].filter(Boolean).join(' ')||'Autobus da assegnare';
let snapshot=null,snapshotAt=0,promise=null,visible=false,working=false,editor=null,selectedGroup='',lastPdfUrl='';
const stats={reads:0,errors:0};
function session(){
 if(typeof authSession==='undefined'||!authSession?.access_token||!authSession?.user?.id)throw Error('Accedi come Nicola o Raffaele dalla schermata V2 per consultare i dati reali.');
 return authSession;
}
function msg(code){const s=String(code||'Errore sconosciuto');
 const text={OPERATORE_NON_AUTORIZZATO:'Operatore non autorizzato a modificare le piantine.',VIAGGIO_O_AUTOBUS_NON_DISPONIBILE:'Il viaggio non ha un autobus GT assegnato, oppure non è disponibile.',AUTOBUS_GT_NON_VALIDO:'Seleziona uno dei tre autobus GT attivi (53 o 63 posti).',PIANTINA_NON_TROVATA:'La bozza non esiste più o è archiviata.',BOZZA_PIANTINA_NON_TROVATA:'Salva prima una bozza attiva.',NUMERAZIONE_NON_COMPLETA:'Rinumera la piantina: tutti i sedili da 1 alla capienza devono comparire una sola volta.',POSTO_GIA_PRENOTATO_NON_COMPATIBILE:'Uno dei posti già prenotati è assente o bloccato: NON è stato applicato alcun cambiamento.',DATI_CAMBIATI_DA_ALTRO_OPERATORE_RICARICARE:'Il viaggio è cambiato: aggiorna e ripeti la verifica.',AUTOBUS_CON_CAPIENZA_INSUFFICIENTE:'La capienza del mezzo non copre il viaggio.',AUTOBUS_NON_DISPONIBILE:'Mezzo non disponibile per questa partenza.'};
 const found=Object.keys(text).find(x=>s.includes(x));return found?text[found]+' ('+s.slice(0,110)+')':s;
}
async function request(path,{method='GET',body=null,timeout=16000}={}){
 const sess=session(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
 try{
  const headers={apikey:PUBLIC_KEY,Authorization:'Bearer '+sess.access_token,Accept:'application/json'};
  if(body!==null)headers['Content-Type']='application/json';
  if(method!=='GET')headers.Prefer='return=representation';
  const r=await fetch(URL_BASE+'/rest/v1/'+path,{method,headers,body:body===null?undefined:JSON.stringify(body),signal:controller.signal,cache:'no-store',referrerPolicy:'no-referrer'});
  const raw=await r.text();let data;try{data=raw?JSON.parse(raw):null}catch{data=raw;}
  if(!r.ok)throw Error(msg(data?.message||data?.error||data?.hint||'HTTP '+r.status));
  stats.reads++;return data;
 }catch(e){stats.errors++;if(e.name==='AbortError')throw Error('Richiesta lenta o interrotta. Nessun salvataggio confermato: controlla Supabase e riprova.');throw e;}
 finally{clearTimeout(timer)}
}
async function rows(table,fields,filters=''){
 const all=[],limit=500;
 for(let offset=0;offset<10000;offset+=limit){
  const q=`${table}?select=${encodeURIComponent(fields)}&limit=${limit}&offset=${offset}${filters?'&'+filters:''}`;
  const page=await request(q);if(!Array.isArray(page))throw Error('Risposta Supabase inattesa per '+table);
  all.push(...page);if(page.length<limit)return all;
 }
 throw Error('Il volume dati supera il limite di sicurezza. Usa una ricerca più specifica.');
}
function clearCache(){snapshot=null;snapshotAt=0;promise=null;}
async function fetchData(force=false){
 const currentUser=session().user.id;if(snapshot&&snapshot.ownerId!==currentUser)clearCache();if(!force&&snapshot&&Date.now()-snapshotAt<30000)return snapshot;
 if(promise)return promise;
 const epoch=session().user.id;
 promise=(async()=>{
  const essential=await Promise.all([
   rows('viaggi','id,titolo,destinazione,data_partenza,ora_partenza,autobus_id,autobus,posti_totali,posti_occupati,stato,archiviato_at,bis_parent_id,bis_numero,pubblicato'),
   rows('prenotazioni','id,viaggio_id,cliente,cliente_nome,telefono,posti,posti_selezionati,fermata_partenza,stato,checkin_effettuato,riserva_aziendale'),
   rows('prenotazione_posti','viaggio_id,prenotazione_id,posto'),
   rows('flotta','id,titolo,marca,modello,categoria,posti,seat_layout,attivo,stato')
  ]);
  const optional=await Promise.allSettled([
   rows('dg28_bus_layouts','autobus_id,layout_id,versione,configurazione,pubblicata_il'),
   rows('dg28_trip_layouts','viaggio_id,autobus_id,layout_id,versione,configurazione,pubblicata_il'),
   rows('dg2_layout_library','id,nome,configurazione,attivo,updated_at')
  ]);
  if(session().user.id!==epoch)throw Error('La sessione è cambiata durante il caricamento.');
  const issues=[];const opt=optional.map((o,i)=>{
   if(o.status==='fulfilled')return o.value;
   issues.push(['Piantine ufficiali bus','Piantine ufficiali viaggio','Libreria bozze'][i]+': '+o.reason.message);return [];
  });
  snapshot={ownerId:epoch,trips:essential[0],bookings:essential[1],seatrows:essential[2],fleet:essential[3],busOfficial:opt[0],tripOfficial:opt[1],library:opt[2],issues};
  snapshotAt=Date.now();return snapshot;
 })();
 try{return await promise}finally{promise=null}
}
function seatNumbers(raw){
 if(Array.isArray(raw))return raw.map(String).filter(x=>/^\d+$/.test(x));
 const s=String(raw||'').trim();if(!s)return [];
 if(s[0]==='['){try{const a=JSON.parse(s);if(Array.isArray(a))return seatNumbers(a)}catch{}}
 return s.split(/[,;\s|]+/).map(x=>x.replace(/^0+(\d)/,'$1')).filter(x=>/^\d+$/.test(x));
}
function normaliseConfig(config,name='Piantina'){
 const input=config?.configurazione||config||{},rows=Array.isArray(input.rows)?input.rows:[];
 if(!rows.length)throw Error('Piantina senza file.');
 if(rows.length>35)throw Error('Massimo 35 file nella piantina ufficiale.');
 const arr=rows.map((r,i)=>{
  const cells=Array.isArray(r)?r:r.cells;
  if(!Array.isArray(cells)||cells.length<1||cells.length>8)throw Error('La fila '+(i+1)+' deve avere da 1 a 8 caselle.');
  return {rowNumber:i+1,label:'Fila '+(i+1),cells:cells.map(cell=>{
   if(cell&&typeof cell==='object'&&!Array.isArray(cell)){
    if(cell.type==='seat')return {type:'seat',id:String(cell.id??''),label:String(cell.id??''),status:['available','blocked','out_of_service'].includes(cell.status)?cell.status:'available'};
    return {type:['aisle','empty','door','wc','table','driver'].includes(cell.type)?cell.type:'empty'};
   }
   if(Number.isInteger(cell)&&cell>0||typeof cell==='string'&&/^\d+$/.test(cell))return {type:'seat',id:String(cell),label:String(cell),status:'available'};
   return {type:['aisle','empty','door','wc','table','driver'].includes(cell)?cell:'empty'};
  })};
 });
 return {version:2,creator:'DELGROSSO-V2-FUSION-DG33',name:String(input.name||name).slice(0,100),posti_totali:arr.flatMap(r=>r.cells).filter(c=>c.type==='seat').length,rows:arr};
}
function countSeats(layout){return(layout?.rows||[]).flatMap(r=>r.cells||[]).filter(c=>c.type==='seat').length}
function validate(layout,expected){
 if(!Number.isInteger(expected)||expected<1||expected>100)throw Error('Capienza fuori range.');
 const ids=(layout.rows||[]).flatMap(r=>r.cells||[]).filter(c=>c.type==='seat').map(c=>String(c.id||''));
 if(ids.length!==expected||new Set(ids).size!==expected||ids.some(v=>!/^\d+$/.test(v)||Number(v)<1||Number(v)>expected))throw Error('La piantina deve contenere esattamente i posti numerati da 1 a '+expected+', senza duplicati. Usa Rinumerazione.');
 if(layout.rows.length>35||layout.rows.some(r=>r.cells.length<1||r.cells.length>8))throw Error('Schema non compatibile con la pubblicazione.');
 return true;
}
function template(n,name){
 const base=window.DG2SeatModel;
 if(base){const src=n===53?base.fromLegacy('GT53'):base.fromLegacy('GT63');const v=n===57?base.limitedToCapacity(src,57):src;v.name=name;return normaliseConfig(v,name);}
 const rows=[];let i=1;while(i<=n){const cells=[];for(let c=0;c<5;c++){if(c===2)cells.push({type:'aisle'});else if(i<=n){cells.push({type:'seat',id:String(i),label:String(i),status:'available'});i++}else cells.push({type:'empty'})}rows.push({rowNumber:rows.length+1,cells})}return {name,version:2,posti_totali:n,rows};
}
function groups(data,{id='',includeArchived=false}={}){
 const all=data.trips.filter(t=>(includeArchived||!t.archiviato_at)&&!(/annull|cancell|cancel/i.test(String(t.stato||'')))).sort((a,b)=>String(a.data_partenza).localeCompare(String(b.data_partenza)));
 const byId=new Map(all.map(t=>[String(t.id),t]));
 function root(t){let x=t,seen=new Set();while(x?.bis_parent_id&&byId.has(String(x.bis_parent_id))&&!seen.has(x.id)){seen.add(x.id);x=byId.get(String(x.bis_parent_id))}return String(x.id)}
 const ids=[...new Set(all.map(root))],answer=[];
 for(const key of ids){if(id&&id!==key)continue;
  const related=all.filter(t=>root(t)===key).sort((a,b)=>Number(a.bis_numero||0)-Number(b.bis_numero||0));const main=byId.get(key)||related[0];
  const buses=related.map((t,i)=>{
   const booked=data.bookings.filter(b=>String(b.viaggio_id)===String(t.id)&&validActive(b));
   const byBooking=new Map();for(const s of data.seatrows.filter(x=>String(x.viaggio_id)===String(t.id))){const key=String(s.prenotazione_id);if(!byBooking.has(key))byBooking.set(key,[]);byBooking.get(key).push(String(s.posto));}
   const rows=booked.map(b=>{
    const both=[...new Set([...seatNumbers(b.posti_selezionati),...(byBooking.get(String(b.id))||[])])].sort((x,y)=>Number(x)-Number(y));
    return {...b,sedili:both};
   });
   const officialTrip=data.tripOfficial.find(x=>String(x.viaggio_id)===String(t.id)&&(!x.autobus_id||String(x.autobus_id)===String(t.autobus_id)));
   const officialBus=data.busOfficial.find(x=>String(x.autobus_id)===String(t.autobus_id));
   const saved=officialTrip||officialBus;
   let layout=null,official=false;const warnings=[];
   if(saved){try{layout=normaliseConfig(saved.configurazione,saved.configurazione?.name||'Ufficiale');official=true}catch(e){warnings.push('Piantina ufficiale non interpretabile: '+e.message);}}
   if(!layout){
    const fleet=data.fleet.find(f=>String(f.id)===String(t.autobus_id));const cap=Number(t.posti_totali);
    if(fleet&&[53,57,63].includes(cap))layout=template(cap,'Schema V2 di riferimento - non ufficiale');
    else warnings.push('Nessuna piantina ufficiale pubblicata: geometria non disponibile.');
   }
   const expected=new Map(),counts=new Map();let missing=0;
   rows.forEach(b=>{
    if(b.sedili.length!==Math.max(0,Number(b.posti)||0))missing++;
    for(const seat of b.sedili){counts.set(seat,(counts.get(seat)||0)+1);if(!expected.has(seat))expected.set(seat,b)}
   });
   if(missing)warnings.push(missing+' prenotazioni con numero posti diverso dai sedili ricostruiti: controllare prima della partenza.');
   const duplicated=[...counts].filter(([s,c])=>c>1).map(([s])=>s);if(duplicated.length)warnings.push('Posti condivisi fra prenotazioni: '+duplicated.slice(0,15).join(', '));
   const missingStops=rows.filter(b=>!String(b.fermata_partenza||'').trim()).length;if(missingStops)warnings.push(missingStops+' prenotazioni senza fermata di salita.');
   const seatMap=new Map(layout?.rows.flatMap(r=>r.cells||[]).filter(c=>c.type==='seat').map(c=>[String(c.id),c])||[]);
   for(const [seat,b] of expected){if(!seatMap.has(seat))warnings.push('Posto '+seat+' prenotato ma assente dalla geometria disponibile.');else if(seatMap.get(seat).status!=='available')warnings.push('Posto '+seat+' prenotato ma segnalato come bloccato.');}
   return {trip:t,seatRows:data.seatrows.filter(x=>String(x.viaggio_id)===String(t.id)),layoutSource:officialTrip?'viaggio':officialBus?'autobus':null,layoutVersion:saved?.versione||null,name:(t.bis_parent_id?'BUS BIS '+(t.bis_numero||i+1):'BUS 1')+' · '+busName(data.fleet.find(f=>String(f.id)===String(t.autobus_id))||{titolo:t.autobus}),bookings:rows,layout,official,warnings};
  });
  answer.push({trip:main,title:(main.titolo||main.destinazione||'Viaggio')+' · '+date(main.data_partenza),buses});
 }
 return answer;
}
function renderStops(groupsArr){
 if(!groupsArr.length)return '<p>Nessuna partenza trovata.</p>';
 return groupsArr.map(g=>`<article class="dg33-trip"><h3>${h(g.title)}</h3>${g.buses.map(bus=>{
  const list=bus.bookings,people=list.reduce((n,b)=>n+Math.max(0,num(b.posti)),0),stops=new Map();
  for(const b of list){const s=String(b.fermata_partenza||'NON INDICATA').trim()||'NON INDICATA';if(!stops.has(s))stops.set(s,[]);stops.get(s).push(b)}
  const grouped=[...stops].sort((a,b)=>a[0].localeCompare(b[0],'it'));
  return `<div class="dg33-bus"><h4>${h(bus.name)}</h4><p class="dg33-muted">${list.length} prenotazioni · ${people} passeggeri · ${bus.official?'Piantina ufficiale pubblicata':'Piantina V2 indicativa / non pubblicata'}</p>
   ${bus.warnings.length?`<p class="dg33-alert">⚠️ ${h(bus.warnings.slice(0,5).join(' | '))}</p>`:''}
   ${grouped.map(([s,bookings])=>`<details class="dg33-stop" open><summary><b>🚏 ${h(s)}</b> — ${bookings.reduce((n,b)=>n+num(b.posti),0)} persone, ${bookings.length} prenotazioni</summary><div class="dg33-table-scroll"><table><thead><tr><th>Referente</th><th>Persone</th><th>Posti</th><th>Check-in</th></tr></thead><tbody>${bookings.map(b=>`<tr><td>${h(b.cliente_nome||b.cliente||'NON INDICATO')}</td><td>${num(b.posti)}</td><td>${h((b.sedili||[]).join(', ')||'DA VERIFICARE')}</td><td>${b.checkin_effettuato?'✓':'—'}</td></tr>`).join('')}</tbody></table></div></details>`).join('')||'<p>Non risultano prenotati attivi.</p>'}</div>`;
 }).join('')}</article>`).join('');
}
function showStatus(text,isError=false){const el=$('dg33-status');if(el){el.textContent=text;el.className='dg33-status '+(isError?'error':'')}}
function populateTripOptions(trips){
 const select=$('dg33-group');if(!select)return;
 const keep=select.value,m=new Set();let html='<option value="">Tutte le partenze operative</option>';
 for(const t of [...(trips||[])].filter(t=>!t.archiviato_at&&!/annull|cancell|cancel/i.test(String(t.stato||''))).sort((a,b)=>String(a.data_partenza).localeCompare(String(b.data_partenza)))){
  const key=String(t.bis_parent_id||t.id);if(m.has(key))continue;m.add(key);
  html+=`<option value="${h(key)}">${h((t.titolo||t.destinazione||'Partenza')+' · '+date(t.data_partenza))}</option>`;
 }
 if(select.innerHTML!==html){select.innerHTML=html;if(m.has(keep))select.value=keep;}
}
function panel(){const p=$('page-controlroom');if(!p||$('dg33-control-entry'))return;
 const div=document.createElement('div');div.id='dg33-control-entry';div.className='dg33-control-entry';div.innerHTML=`<div class="dg33-line"><div><b>🚌 Control Room V2+ · Fermate, piantine e PDF nominativi</b><p>Resta la Control Room originale V2: questa estensione aggiunge soltanto le liste e i documenti.</p></div><button class="btn btn-secondary" data-dg33="editor">✎ Editor piantine ufficiali</button></div><div class="dg33-actions"><select id="dg33-group" aria-label="Seleziona partenza"><option value="">Tutte le partenze operative</option></select><button class="btn btn-primary" data-dg33="list">👥 Prenotati per fermata</button><button class="btn btn-primary" data-dg33="pdf">📄 PDF piantina + fermate</button><button class="btn btn-secondary" data-dg33="pdf-all">📚 PDF di tutti i viaggi</button><button class="btn btn-secondary" data-dg33="reload">↻ Aggiorna</button></div><p id="dg33-status" class="dg33-status" role="status">Seleziona una partenza e carica i prenotati. Nessuna modifica a database o pagamenti.</p><div id="dg33-report" class="dg33-report"></div><div id="dg33-pdf-link"></div>`;
 const anchor=p.querySelector('.optional-toolbar');if(anchor)anchor.insertAdjacentElement('afterend',div);else p.prepend(div);
 const nav=$('sideNav');if(nav){
  const keepNav=()=>{if($('dg33-nav-editor'))return;const b=document.createElement('button');b.id='dg33-nav-editor';b.type='button';b.dataset.dg33='editor';b.innerHTML='<span class="ico">▦</span><span>Piantine ufficiali V2+</span>';nav.appendChild(b)};
  keepNav();new MutationObserver(keepNav).observe(nav,{childList:true});
 }
 populateTripOptions(typeof state!=='undefined'?state.viaggi:[]);
 const control=$('controlTripSelect');if(control){
  const refresh=()=>{if(typeof state!=='undefined')populateTripOptions(state.viaggi)};
  new MutationObserver(refresh).observe(control,{childList:true});
 }
}
async function doReport(which){
 if(working)return;working=true;const b=$('dg33-report');try{
  showStatus('Caricamento protetto dei viaggi e dei posti…');const data=await fetchData(which==='reload');
  populateTripOptions(data.trips);
  if(data.issues.length)showStatus('Alcune informazioni non sono disponibili: '+data.issues.join(' | '),true);
  const root=String($('dg33-group')?.value||'');let all=groups(data,{id:which==='pdf-all'?'':root});
  if(!all.length)throw Error('Nessuna partenza disponibile.');
  if(which==='list'||which==='reload'){
   if(b)b.innerHTML=renderStops(all);showStatus(all.length+' partenze caricate. Nominativi e fermate letti da Supabase.');return;
  }
  if(typeof window.DG2Pdf?.makeOperationalPdf!=='function')throw Error('Modulo PDF mancante: carica anche suite/pdf-report.js aggiornato.');
  showStatus('Composizione PDF A4: '+all.length+' partenze…');await new Promise(resolve=>setTimeout(resolve,0));
  const bytes=window.DG2Pdf.makeOperationalPdf(all),blob=new Blob([bytes],{type:'application/pdf'}),url=URL.createObjectURL(blob);
  if(lastPdfUrl)URL.revokeObjectURL(lastPdfUrl);lastPdfUrl=url;
  const name='DELGROSSO_V2_PIANTINA_FERMATE_'+(all.length===1?safeName(all[0].title):'TUTTI_I_VIAGGI')+'.pdf';
  const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
  $('dg33-pdf-link').innerHTML=`<a class="btn btn-secondary" href="${url}" target="_blank" rel="noopener noreferrer">Apri il PDF per salvarlo su iPhone</a> <small>${h(name)}</small>`;
  showStatus('PDF generato: '+all.length+' partenze. Il file contiene referenti, posti e fermate.');
 }catch(e){showStatus(msg(e.message),true)}finally{working=false}
}
function shell(){if($('dg33-overlay'))return;
 const el=document.createElement('div');el.id='dg33-overlay';el.hidden=true;el.innerHTML=`<div class="dg33-window" role="dialog" aria-modal="true" aria-labelledby="dg33-title"><header><div><small>DELGROSSO VIAGGI · GESTIONALE V2</small><h2 id="dg33-title">Piantine ufficiali · V2 Fusion</h2><p>La grafica V2 resta invariata. Le modifiche diventano ufficiali solo dopo il controllo Supabase.</p></div><button type="button" class="btn btn-secondary" data-dg33="close">✕ Chiudi</button></header><div id="dg33-editor-body" class="dg33-editor-body"></div><p id="dg33-editor-message" class="dg33-editor-message" role="status"></p></div>`;document.body.append(el);
}
function notifyEditor(text,error=false){const x=$('dg33-editor-message');if(x){x.textContent=text;x.className='dg33-editor-message '+(error?'error':'')}}
function setDraft(layout,layoutId='',updatedAt=''){
 editor.layout=clone(layout);editor.layoutId=layoutId;editor.loadedUpdatedAt=updatedAt;editor.savedHash=layoutId?JSON.stringify(layout):'';editor.sel=null;editor.undo=[];editor.redo=[];
}
function digest(){return JSON.stringify(editor?.layout||null)}
function dirty(){return editor&&(!editor.layoutId||editor.savedHash!==digest())}
function pushUndo(){if(editor?.layout){editor.undo.push(clone(editor.layout));if(editor.undo.length>45)editor.undo.shift();editor.redo=[]}}
function currentBus(){return editor?.data.fleet.find(x=>String(x.id)===String(editor.busId))}
function currentTrip(){return editor?.data.trips.find(x=>String(x.id)===String(editor.tripId))}
function saveName(){const n=$('dg33-name')?.value.trim();if(n)editor.layout.name=n}
function renderEditor(){if(!editor||!$('dg33-editor-body'))return;
 const b=currentBus(),library=editor.data.library.filter(x=>x.attivo!==false&&x.configurazione&&(!b||num(x.configurazione?.posti_totali||x.configurazione?.totalSeats||countAny(x.configurazione))<=num(b.posti)));
 const tr=editor.data.trips.filter(t=>!t.archiviato_at&&(!t.autobus_id||String(t.autobus_id)===String(editor.busId))&&num(t.posti_totali)<=num(b?.posti)).sort((a,b)=>String(a.data_partenza).localeCompare(String(b.data_partenza)));
 const s=editor.sel,layout=editor.layout;
 const rows=(layout?.rows||[]).map((r,i)=>`<div class="dg33-seat-row"><span class="dg33-row-name">${i+1}</span>${r.cells.map((c,j)=>{
  const on=s&&s[0]===i&&s[1]===j;const label=c.type==='seat'?String(c.id||'??'):({aisle:'║',empty:'·',door:'PORTA',wc:'WC',table:'TAV.',driver:'AUT.'}[c.type]||'·');
  return `<button type="button" class="dg33-seat ${c.type==='seat'?'seat':''} ${c.status==='blocked'?'blocked':''} ${c.status==='out_of_service'?'outservice':''} ${on?'selected':''}" data-dg33="cell" data-r="${i}" data-c="${j}" title="Seleziona casella per modificarla">${h(label)}</button>`;
 }).join('')}</div>`).join('');
 const selCell=s?layout?.rows[s[0]]?.cells[s[1]]:null;
 const futureBooked=editor.data.trips.filter(t=>String(t.autobus_id)===String(editor.busId)&&!t.archiviato_at&&String(t.data_partenza)>=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Rome'})&&editor.data.bookings.some(p=>String(p.viaggio_id)===String(t.id)&&validActive(p))&&!editor.data.tripOfficial.some(o=>String(o.viaggio_id)===String(t.id)));
 $('dg33-editor-body').innerHTML=`
 <div class="dg33-card"><b>1. Autobus GT</b><div class="dg33-form"><select id="dg33-bus">${editor.data.fleet.filter(x=>x.attivo&&String(x.categoria).toUpperCase().includes('GT')&&[53,63].includes(num(x.posti))).map(x=>`<option value="${h(x.id)}" ${String(x.id)===String(editor.busId)?'selected':''}>${h(busName(x))} · ${num(x.posti)} posti fisici</option>`).join('')}</select><button data-dg33="new" class="btn btn-secondary">+ Nuova bozza</button><button data-dg33="make57" class="btn btn-secondary">Bozza 57 posti</button><button data-dg33="load-official" class="btn btn-secondary">Carica ufficiale</button></div><p class="dg33-note">Il mezzo e la sua capienza fisica restano registrati nella flotta. Le varianti ridotte si applicano soltanto al viaggio.</p></div>
 <div class="dg33-card"><b>2. Libreria condivisa Supabase</b><div class="dg33-form"><select id="dg33-library"><option value="">Seleziona una bozza salvata…</option>${library.map(x=>`<option value="${h(x.id)}" ${String(x.id)===String(editor.layoutId)?'selected':''}>${h(x.nome)} · ${num(x.configurazione?.posti_totali||x.configurazione?.totalSeats||countAny(x.configurazione))} posti</option>`).join('')}</select><button data-dg33="load" class="btn btn-secondary">Apri bozza</button><button data-dg33="duplicate" class="btn btn-secondary">Duplica</button><button data-dg33="archive" class="btn btn-secondary">Archivia</button></div></div>
 <div class="dg33-card"><b>3. Editor manuale dei sedili</b><label class="dg33-name">Nome piantina <input id="dg33-name" maxlength="100" value="${h(layout?.name||'')}"></label><div class="dg33-command"><button data-dg33="seat-add">+ Sedile</button><button data-dg33="empty">Spazio</button><button data-dg33="aisle">Corridoio</button><button data-dg33="door">Porta</button><button data-dg33="wc">WC</button><button data-dg33="toggle-status">Libero / Bloccato / Guasto</button><button data-dg33="left">←</button><button data-dg33="up">↑</button><button data-dg33="down">↓</button><button data-dg33="right">→</button><button data-dg33="add-row">+ Fila</button><button data-dg33="remove-row">− Fila</button><button data-dg33="renumber">Rinumera</button><button data-dg33="undo">↶ Annulla</button><button data-dg33="redo">↷ Ripeti</button></div><p class="dg33-note">Seleziona prima una casella verde o grigia, poi scegli l'operazione. Il numero del sedile non cambia durante lo spostamento. ${selCell?'Selezionato: '+h(selCell.type==='seat'?'Posto '+selCell.id:selCell.type):'Nessuna casella selezionata.'}</p><div class="dg33-seatmap"><div class="dg33-front">◉ AUTISTA · FRONTE AUTOBUS</div>${rows}<div class="dg33-front">POSTERIORE</div></div><p class="dg33-note"><b>${countSeats(layout)} sedili</b> · ${layout?.rows.length||0} file · ${dirty()?'MODIFICHE NON SALVATE':'Bozza salvata'}.</p><div class="dg33-form"><button class="btn btn-primary" data-dg33="save">Salva bozza in Supabase</button><button class="btn btn-secondary" data-dg33="export">↓ Esporta JSON</button><label class="btn btn-secondary">↑ Importa JSON<input id="dg33-import" type="file" accept=".json,application/json" hidden></label></div></div>
 <div class="dg33-card"><b>4. Pubblicazione ufficiale</b><p class="dg33-note">${futureBooked.length?'⚠️ Il mezzo ha '+futureBooked.length+' viaggi futuri prenotati senza piantina indipendente: pubblicazione generale bloccata per sicurezza.':'La pubblicazione autobus verifica la numerazione e la compatibilità dei viaggi.'}</p><div class="dg33-form"><button class="btn btn-primary" data-dg33="publish-bus" ${futureBooked.length?'disabled':''}>✓ Pubblica per autobus (${num(b?.posti)} posti)</button></div><label class="dg33-name">Variante per viaggio<select id="dg33-trip"><option value="">Seleziona una partenza…</option>${tr.map(t=>`<option value="${h(t.id)}" ${String(t.id)===String(editor.tripId)?'selected':''}>${h(t.titolo)} · ${date(t.data_partenza)} · ${num(t.posti_totali)} posti ${t.autobus_id?'':'· BUS NON ASSEGNATO'}</option>`).join('')}</select></label><div class="dg33-form"><button class="btn btn-secondary" data-dg33="availability">Verifica mezzi disponibili</button><button class="btn btn-secondary" data-dg33="assign-bus">Assegna il bus al viaggio</button><button class="btn btn-primary" data-dg33="publish-trip">✓ Applica piantina al viaggio</button></div><div id="dg33-availability" class="dg33-note"></div><p class="dg33-note">Le piantine già prenotate devono mantenere disponibili i posti assegnati. Il sito leggerà le piantine soltanto dopo la pubblicazione confermata dal server.</p></div>`;
}
function countAny(x){return (x?.rows||[]).flatMap(r=>Array.isArray(r)?r:(r?.cells||[])).filter(v=>Number.isInteger(v)&&v>0||v?.type==='seat').length}
function cellAt(){if(!editor?.sel)throw Error('Seleziona prima una casella della piantina.');const [r,c]=editor.sel;const x=editor.layout.rows[r]?.cells[c];if(!x)throw Error('Casella non più presente.');return x;}
function nextNumber(){const used=new Set(editor.layout.rows.flatMap(r=>r.cells).filter(c=>c.type==='seat').map(c=>String(c.id)));for(let n=1;n<=100;n++)if(!used.has(String(n)))return String(n);throw Error('Limite posti superato.');}
function modify(action){
 if(action==='undo'){if(!editor.undo.length)throw Error('Nessuna modifica da annullare.');editor.redo.push(clone(editor.layout));editor.layout=editor.undo.pop();renderEditor();return;}
 if(action==='redo'){if(!editor.redo.length)throw Error('Nessuna modifica da ripetere.');editor.undo.push(clone(editor.layout));editor.layout=editor.redo.pop();renderEditor();return;}
 if(action==='add-row'){if(editor.layout.rows.length>=35)throw Error('Massimo 35 file.');pushUndo();editor.layout.rows.push({rowNumber:editor.layout.rows.length+1,cells:[{type:'empty'},{type:'empty'},{type:'aisle'},{type:'empty'},{type:'empty'}]});renderEditor();return;}
 if(action==='remove-row'){if(editor.layout.rows.length<2)throw Error('Non puoi rimuovere l’unica fila.');if(!confirm('Eliminare ultima fila dalla BOZZA, senza toccare il database?'))return;pushUndo();editor.layout.rows.pop();renderEditor();return;}
 if(action==='renumber'){pushUndo();let n=1;for(const row of editor.layout.rows)for(const c of row.cells)if(c.type==='seat'){c.id=String(n);c.label=String(n++);}editor.layout.posti_totali=n-1;renderEditor();return;}
 const c=cellAt(),[r,j]=editor.sel;
 if(['left','right','up','down'].includes(action)){
  const delta={left:[0,-1],right:[0,1],up:[-1,0],down:[1,0]}[action];const nr=r+delta[0],nc=j+delta[1];const other=editor.layout.rows[nr]?.cells[nc];if(!other)throw Error('Spostamento oltre il bordo della piantina.');
  pushUndo();editor.layout.rows[nr].cells[nc]=c;editor.layout.rows[r].cells[j]=other;editor.sel=[nr,nc];
 }else{
  pushUndo();if(action==='seat-add'&&c.type!=='seat'){const n=nextNumber();editor.layout.rows[r].cells[j]={type:'seat',id:n,label:n,status:'available'};}
  else if(['empty','aisle','door','wc'].includes(action))editor.layout.rows[r].cells[j]={type:action};
  else if(action==='toggle-status'&&c.type==='seat')c.status=c.status==='available'?'blocked':c.status==='blocked'?'out_of_service':'available';
  else{editor.undo.pop();throw Error('Operazione non disponibile per questa casella.');}
 }
 editor.layout.posti_totali=countSeats(editor.layout);renderEditor();
}
async function openEditor(){
 if(visible)return;session();shell();visible=true;$('dg33-overlay').hidden=false;document.body.classList.add('dg33-open');
 notifyEditor('Caricamento libreria e flotta…');try{
  const data=await fetchData();const fleet=data.fleet.filter(x=>x.attivo&&String(x.categoria).toUpperCase().includes('GT')&&[53,63].includes(num(x.posti)));
  if(!fleet.length)throw Error('Nessun autobus GT attivo disponibile nel database.');
  const busId=String(editor?.busId&&fleet.some(x=>String(x.id)===String(editor.busId))?editor.busId:fleet[0].id);
  editor={data,busId,tripId:'',layout:null,layoutId:'',savedHash:'',sel:null,undo:[],redo:[]};setDraft(template(num(currentBus().posti),'Bozza '+busName(currentBus())));
  renderEditor();notifyEditor(data.issues.length?'Avvisi: '+data.issues.join(' | '):'Editor V2+ pronto. Salva la bozza prima di pubblicarla.',!!data.issues.length);
 }catch(e){notifyEditor(msg(e.message),true)}
}
function closeEditor(){if(working)return;if(editor&&dirty()&&!confirm('Ci sono modifiche alla piantina NON salvate. Vuoi davvero chiudere senza salvarle?'))return;visible=false;const el=$('dg33-overlay');if(el)el.hidden=true;document.body.classList.remove('dg33-open')}
function downloadJson(){const content={export_version:'DG33-V2',created_at:new Date().toISOString(),configurazione:editor.layout};const blob=new Blob([JSON.stringify(content,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='DELGROSSO_PIANTINA_'+safeName(editor.layout.name)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
async function importJson(file){if(!file)return;if(file.size>250000)throw Error('JSON troppo grande (massimo 250 KB).');const raw=JSON.parse(await file.text());const layout=normaliseConfig(raw.configurazione||raw,'Piantina importata');if(countSeats(layout)>num(currentBus()?.posti))throw Error('La bozza supera i posti fisici dell’autobus.');setDraft(layout);renderEditor();notifyEditor('Importata soltanto come bozza locale: salva prima di pubblicare.');}
async function saveDraft(){saveName();const x=editor.layout;if(!x.name||x.name.trim().length<3)throw Error('Assegna alla piantina un nome di almeno 3 caratteri.');
 const sess=session(),userId=sess.user.id;const fields={nome:x.name,configurazione:x,updated_by:userId};let record;
 if(editor.layoutId){
  const where='dg2_layout_library?id=eq.'+encodeURIComponent(editor.layoutId)+(editor.loadedUpdatedAt?'&updated_at=eq.'+encodeURIComponent(editor.loadedUpdatedAt):'');
  record=await request(where,{method:'PATCH',body:fields});
 }else record=await request('dg2_layout_library',{method:'POST',body:{...fields,attivo:true,created_by:userId}});
 if(!Array.isArray(record)||!record[0]?.id)throw Error('Il salvataggio non risulta confermato: la bozza potrebbe essere stata modificata da un altro operatore. Ricarica e verifica prima di riprovare.');
 editor.layoutId=record[0].id;editor.loadedUpdatedAt=record[0].updated_at||'';editor.savedHash=digest();clearCache();editor.data.library=await rows('dg2_layout_library','id,nome,configurazione,attivo,updated_at');
 renderEditor();notifyEditor('Bozza salvata su Supabase. Non è ancora una piantina ufficiale.');
}
function checkBeforePublish(target){if(!editor.layoutId||dirty())throw Error('Salva la bozza prima di pubblicare: la versione visualizzata non coincide con quella presente in Supabase.');validate(editor.layout,target)}
async function publishBus(){const b=currentBus();checkBeforePublish(num(b.posti));
 const now=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Rome'});
 const pending=editor.data.trips.filter(t=>String(t.autobus_id)===String(b.id)&&!t.archiviato_at&&String(t.data_partenza)>=now&&editor.data.bookings.some(p=>String(p.viaggio_id)===String(t.id)&&validActive(p))&&!editor.data.tripOfficial.some(o=>String(o.viaggio_id)===String(t.id)));
 if(pending.length)throw Error('Non si può cambiare lo schema generale: '+pending.length+' viaggi futuri hanno prenotati e nessuna piantina viaggio indipendente. Prima verifica e pubblica le varianti viaggio necessarie.');
 if(!confirm('Pubblicare per '+busName(b)+' la piantina con '+countSeats(editor.layout)+' posti? L’operazione controlla le prenotazioni già presenti.'))return;
 const r=await request('rpc/dg28_publish_bus_layout_v1',{method:'POST',body:{p_autobus_id:b.id,p_layout_id:editor.layoutId}});if(r?.success!==true)throw Error('Pubblicazione NON confermata dal server.');
 clearCache();editor.data=await fetchData(true);renderEditor();notifyEditor('Piantina ufficiale pubblicata per autobus. Versione: '+r.versione);}
async function publishTrip(){const t=currentTrip(),b=currentBus();if(!t)throw Error('Scegli prima il viaggio a cui applicare la piantina.');
 if(String(t.autobus_id)!==String(b.id))throw Error('Autobus del viaggio assente o diverso: assegna prima il mezzo tramite la verifica disponibilità.');
 checkBeforePublish(num(t.posti_totali));
 const active=editor.data.bookings.filter(x=>String(x.viaggio_id)===String(t.id)&&validActive(x));
 const expected=new Set(editor.layout.rows.flatMap(r=>r.cells).filter(c=>c.type==='seat'&&c.status==='available').map(c=>String(c.id)));
 const occupied=new Set(active.flatMap(x=>seatNumbers(x.posti_selezionati)));
 const seatEntries=editor.data.seatrows.filter(x=>String(x.viaggio_id)===String(t.id)&&active.some(b=>String(b.id)===String(x.prenotazione_id)));
 seatEntries.forEach(x=>occupied.add(String(x.posto)));
 const missing=[...occupied].filter(n=>!expected.has(n));if(missing.length)throw Error('Posti già prenotati mancanti o bloccati: '+missing.join(', ')+'. Ripristinali nella bozza.');
 if(!confirm('APPLICARE al viaggio '+t.titolo+' del '+date(t.data_partenza)+' questa disposizione? '+active.length+' prenotazioni attive saranno verificate. Controlla che i posti non cambino posizione fisica senza informare i viaggiatori.'))return;
 const r=await request('rpc/dg28_publish_trip_layout_v1',{method:'POST',body:{p_viaggio_id:t.id,p_layout_id:editor.layoutId}});if(r?.success!==true)throw Error('La pubblicazione non è stata confermata.');
 clearCache();editor.data=await fetchData(true);renderEditor();notifyEditor('Piantina del viaggio pubblicata! Versione: '+r.versione+'. Il sito potrà leggerla dal database.');
}
async function checkAvailability(){const t=currentTrip();if(!t)throw Error('Seleziona prima un viaggio.');
 const r=await request('rpc/dg3_disponibilita_autobus_viaggio_v1',{method:'POST',body:{p_viaggio_id:t.id}});
 const list=Array.isArray(r?.autobus)?r.autobus:[],row=list.find(x=>String(x.id)===String(editor.busId));
 const msg=row?('Mezzo: '+row.titolo+' · '+(row.disponibile?'DISPONIBILE':row.motivo)+' · '+row.posti+' posti'):'Mezzo non trovato nella disponibilità per questa data.';
 if($('dg33-availability'))$('dg33-availability').textContent=msg;return row;
}
async function assignBus(){const t=currentTrip(),b=currentBus();if(!t||!b)throw Error('Seleziona un viaggio e un autobus.');
 if(String(t.autobus_id)===String(b.id))throw Error('Questo mezzo è già assegnato al viaggio.');
 const available=await checkAvailability();if(!available?.disponibile)throw Error('Non è possibile assegnare il bus: '+(available?.motivo||'disponibilità non confermata'));
 if(!['Programmato','Confermato','Annullato','SOLD OUT'].includes(String(t.stato)))throw Error('Stato del viaggio non previsto dalla procedura di assegnazione: '+t.stato);
 if(!confirm('Assegnare '+busName(b)+' al viaggio '+t.titolo+'? La procedura del server verifica conflitti e passeggeri.'))return;
 const r=await request('rpc/dg3_aggiorna_viaggio_autobus_stato_v1',{method:'POST',body:{p_viaggio_id:t.id,p_autobus_id:b.id,p_stato:t.stato,p_autobus_precedente_id:t.autobus_id||null,p_stato_precedente:t.stato}});
 if(r?.success!==true)throw Error('Assegnazione non confermata dal database.');
 t.autobus_id=b.id;t.autobus=busName(b);clearCache();renderEditor();notifyEditor('Autobus assegnato. La prenotazione e i pagamenti non sono stati modificati.');
}
async function actionEditor(action,el){
 if(action==='close'){closeEditor();return;}if(working)return;
 const simple=['cell','new','make57','load-official','load','duplicate','archive','undo','redo','add-row','remove-row','renumber','seat-add','empty','aisle','door','wc','toggle-status','left','up','down','right','export'];
 if(simple.includes(action)){
  try{
   if(action==='cell'){editor.sel=[Number(el.dataset.r),Number(el.dataset.c)];renderEditor();return;}
   if(action==='new'){if(dirty()&&!confirm('La bozza corrente ha modifiche non salvate. Vuoi creare una nuova bozza?'))return;const b=currentBus();setDraft(template(num(b.posti),'Nuova piantina '+busName(b)));renderEditor();return;}
   if(action==='make57'){const b=currentBus();if(num(b.posti)!==63)throw Error('La variante 57 è prevista solo per autobus fisici da 63 posti.');if(dirty()&&!confirm('Creare una nuova bozza 57, scartando modifiche non salvate?'))return;setDraft(template(57,'VARIANTE 57 · '+busName(b)+' · DA VERIFICARE'));renderEditor();return;}
   if(action==='load-official'){const b=currentBus(),record=editor.data.busOfficial.find(x=>String(x.autobus_id)===String(b.id));if(!record)throw Error('Non esiste una piantina ufficiale salvata per questo mezzo.');if(dirty()&&!confirm('Caricare la versione ufficiale come nuova bozza, scartando modifiche non salvate?'))return;setDraft(normaliseConfig(record.configurazione,'Piantina ufficiale da modificare'));renderEditor();return;}
   if(action==='load'){const id=$('dg33-library')?.value,row=editor.data.library.find(x=>String(x.id)===String(id));if(!row)throw Error('Seleziona una bozza dalla libreria.');if(dirty()&&!confirm('Aprire un’altra bozza, scartando modifiche non salvate?'))return;setDraft(normaliseConfig(row.configurazione,row.nome),row.id,row.updated_at||'');renderEditor();return;}
   if(action==='duplicate'){setDraft({...clone(editor.layout),name:editor.layout.name+' · Copia'});renderEditor();return;}
   if(action==='export'){saveName();downloadJson();return;}
   if(action==='archive'){
    if(!editor.layoutId)throw Error('Seleziona prima una bozza salvata.');
    if(editor.data.busOfficial.some(x=>String(x.layout_id)===String(editor.layoutId))||editor.data.tripOfficial.some(x=>String(x.layout_id)===String(editor.layoutId)))throw Error('Questa bozza è collegata a una piantina ufficiale: non archiviarla.');
    if(!confirm('Archiviare la bozza senza eliminare le prenotazioni?'))return;
    working=true;try{await request('dg2_layout_library?id=eq.'+encodeURIComponent(editor.layoutId),{method:'PATCH',body:{attivo:false,updated_by:session().user.id}});editor.data.library=editor.data.library.filter(x=>x.id!==editor.layoutId);setDraft(template(num(currentBus().posti),'Nuova bozza '+busName(currentBus())));renderEditor();notifyEditor('Bozza archiviata.');clearCache()}finally{working=false}return;
   }
   modify(action);return;
  }catch(e){notifyEditor(msg(e.message),true);return;}
 }
 working=true;notifyEditor('Verifica e comunicazione protetta con Supabase…');try{
  if(action==='save')await saveDraft();
  else if(action==='publish-bus')await publishBus();
  else if(action==='publish-trip')await publishTrip();
  else if(action==='availability')await checkAvailability();
  else if(action==='assign-bus')await assignBus();
 }catch(e){notifyEditor(msg(e.message),true)}finally{working=false}
}
function wire(){
 document.addEventListener('click',e=>{const el=e.target.closest('[data-dg33]');if(!el)return;e.preventDefault();const a=el.dataset.dg33;
  if(a==='editor'){openEditor().catch(err=>notifyEditor(msg(err.message),true));return}
  if(['list','pdf','pdf-all','reload'].includes(a)){doReport(a);return}
  actionEditor(a,el);
 });
 document.addEventListener('change',e=>{
  if(!editor)return;const t=e.target;
  if(t.id==='dg33-bus'){
   if(dirty()&&!confirm('Hai modifiche non salvate. Cambiare autobus e scartarle?')){t.value=editor.busId;return;}
   editor.busId=t.value;editor.tripId='';setDraft(template(num(currentBus().posti),'Nuova piantina '+busName(currentBus())));renderEditor();notifyEditor('Autobus cambiato: nuova bozza NON pubblicata.');
  }else if(t.id==='dg33-trip')editor.tripId=t.value;
  else if(t.id==='dg33-import')importJson(t.files?.[0]).catch(err=>notifyEditor(msg(err.message),true));
 });
 document.addEventListener('input',e=>{if(editor&&e.target.id==='dg33-name')editor.layout.name=e.target.value});
 window.addEventListener('message',e=>{
  const f=$('dg-v2-iframe');if(e.origin!==location.origin||!f||e.source!==f.contentWindow)return;
  if(e.data?.kind==='dg33-open-editor')openEditor();
  if(e.data?.kind==='dg33-open-reports'){if(typeof window.go==='function')window.go('controlroom');setTimeout(()=>doReport('list'),50)}
 });
 const originalApp=$('app');if(originalApp){
  new MutationObserver(()=>{
   if(originalApp.classList.contains('on'))return;
   clearCache();editor=null;visible=false;const overlay=$('dg33-overlay');if(overlay)overlay.hidden=true;document.body.classList.remove('dg33-open');
   if($('dg33-report'))$('dg33-report').replaceChildren();if($('dg33-pdf-link'))$('dg33-pdf-link').replaceChildren();
   if(lastPdfUrl){URL.revokeObjectURL(lastPdfUrl);lastPdfUrl=''}
  }).observe(originalApp,{attributes:true,attributeFilter:['class']});
 }
 window.addEventListener('pagehide',()=>{if(lastPdfUrl)URL.revokeObjectURL(lastPdfUrl)});
}
function boot(){shell();panel();wire();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
// Read-only testing interface: no credentials or data are exposed through it.
window.DG33V2=Object.freeze({version:VERSION,seatNumbers,normaliseConfig,countSeats,validate,groups,renderStops,template,openEditor,openReports:()=>doReport('list'),getLiveSnapshot:()=>fetchData(true),clearCache,stats:()=>({...stats})});
})();
