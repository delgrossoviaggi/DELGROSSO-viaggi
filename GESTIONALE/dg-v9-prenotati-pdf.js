/* DELGROSSO Business Suite V9 — Liste nominativi in PDF, desktop / iOS / Android.
   I documenti sono generati localmente DOPO il login: nessun upload né link pubblico.
   Modalità: partenza singola (BUS e BIS) oppure tutte le partenze, archiviati opzionali.
 */
(function(){'use strict';
const $=id=>document.getElementById(id);
const getState=()=>typeof state!=='undefined'?state:null;
const auth=()=>typeof authSession!=='undefined'&&Boolean(authSession?.access_token);
const sanitized=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const active=b=>b&&!b.riserva_aziendale&&!/annull|cancel|storn|rimbors/i.test(String(b.stato||''));
const niceDate=t=>{const s=String(t?.data_partenza||'').slice(0,10);return /^\d{4}-\d\d-\d\d$/.test(s)?s.slice(8)+'/'+s.slice(5,7)+'/'+s.slice(0,4):'Data da verificare'};
const safeFile=x=>String(x||'viaggio').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9_-]+/g,'_').slice(0,55);
const status=(s,err)=>{const el=$('dg9Status');if(el){el.textContent=s;el.style.color=err?'#a3213b':'#123b60'}};
let snapshot=null;
let prepared=null;
let preparing=false;
function sources(){const s=getState();return snapshot||{trips:Array.isArray(s?.viaggi)?s.viaggi:[],bookings:Array.isArray(s?.prenotazioni)?s.prenotazioni:[]}}
function parents(trips,allowArchives){
 const byId=new Map(trips.map(x=>[x.id,x]));
 const root=t=>{let x=t,seen=new Set();while(x?.bis_parent_id&&!seen.has(x.id)){seen.add(x.id);x=byId.get(x.bis_parent_id)||x}return x.id};
 const available=trips.filter(t=>allowArchives||!t.archiviato_at);
 const keys=[...new Set(available.map(root))];
 return keys.map(id=>byId.get(id)).filter(Boolean).sort((a,b)=>String(a.data_partenza||'9999').localeCompare(String(b.data_partenza||'9999')));
}
function groupData(trips,bookings,{includeArchived=false,tripId=''}={}){
 const byId=new Map(trips.map(x=>[x.id,x]));
 const root=t=>{let x=t,seen=new Set();while(x?.bis_parent_id&&!seen.has(x.id)){seen.add(x.id);x=byId.get(x.bis_parent_id)||x}return x.id};
 const available=trips.filter(t=>includeArchived||!t.archiviato_at);
 const p=parents(trips,includeArchived).filter(t=>!tripId||t.id===tripId);
 return p.map(t=>{
  const connected=available.filter(v=>root(v)===t.id).sort((a,b)=>Number(a.bis_numero||0)-Number(b.bis_numero||0));
  return {trip:t,buses:connected.map((bus,i)=>({name:bus.bis_parent_id?'BUS BIS '+(bus.bis_numero||i+1):'BUS 1',bookings:bookings.filter(b=>b.viaggio_id===bus.id&&active(b)).slice().sort((a,b)=>String(a.created_at||a.data_prenotazione||'').localeCompare(String(b.created_at||b.data_prenotazione||'')))}))};
 });
}
function refreshTrips(){const select=$('dg9Trip');if(!select)return;
 const includeArchived=Boolean($('dg9Archived')?.checked),all=parents(sources().trips,includeArchived);
 const html='<option value="">Scegli il viaggio...</option>'+all.map(x=>'<option value="'+sanitized(x.id)+'">'+sanitized((x.titolo||x.destinazione||'Viaggio')+' · '+niceDate(x)+(x.archiviato_at?' · ARCHIVIATO':''))+'</option>').join('');
 const prior=select.value;if(select.innerHTML!==html)select.innerHTML=html;
 if(all.some(x=>x.id===prior))select.value=prior;
 if(!$('dg9PdfTrip'))return;
 $('dg9PdfTrip').disabled=!select.value;
 $('dg9PdfAll').disabled=!all.length;
 const allRows=sources().bookings.filter(active),pax=allRows.reduce((n,b)=>n+Math.max(0,Number(b.posti)||0),0);
 if(!prepared)status(all.length+' viaggi disponibili. '+allRows.length+' prenotazioni registrate ('+pax+' posti, anche in viaggi eventualmente archiviati). Scegli un viaggio o scarica tutti.');
}
function clearPdf(){if(prepared?.url)URL.revokeObjectURL(prepared.url);prepared=null;
 if($('dg9OpenPdf')){$('dg9OpenPdf').hidden=true;$('dg9OpenPdf').removeAttribute('href')}
 if($('dg9Share'))$('dg9Share').disabled=true;
}
function checkReady(){
 if(!auth())throw Error('Accedi al gestionale prima di generare liste con dati personali.');
 const s=getState();if(!s)throw Error('Dati gestionali non disponibili');
 const fail=(s.syncErrors||[]).filter(x=>/^(prenotazioni|viaggi)$/.test(x.table));
 if(fail.length&&!snapshot)throw Error('Supabase non ha caricato tutti i viaggi o prenotati. Premi Aggiorna elenchi e riprova.');
 const src=sources();if(!src.trips.length)throw Error('Nessun viaggio caricato: premi Aggiorna elenchi.');
 if(src.bookings.length>=1000&&!snapshot)throw Error('Elenco molto ampio: premi Aggiorna elenchi per evitare prenotati mancanti.');
 return src;
}
function prepare(which){
 try{
  const src=checkReady();const tripId=which==='one'?($('dg9Trip')?.value||''):'';
  if(which==='one'&&!tripId)throw Error('Seleziona il viaggio prima di scaricare il PDF.');
  const group=groupData(src.trips,src.bookings,{includeArchived:Boolean($('dg9Archived')?.checked),tripId});
  if(!group.length)throw Error('Non ci sono viaggi disponibili con questo filtro.');
  if(!window.DG2Pdf?.makeRosterPdf)throw Error('Generatore PDF non disponibile. Controlla che tutti i file V9 siano stati caricati.');
  const bytes=window.DG2Pdf.makeRosterPdf(group,{includeArchived:Boolean($('dg9Archived')?.checked)});
  const pax=group.flatMap(g=>g.buses).flatMap(b=>b.bookings).reduce((n,b)=>n+Math.max(0,Number(b.posti)||0),0);
  const count=group.flatMap(g=>g.buses).reduce((n,b)=>n+b.bookings.length,0);
  clearPdf();
  const filename=which==='one'?'DELGROSSO_PRENOTATI_'+safeFile(group[0].trip.titolo||group[0].trip.destinazione)+'_'+String(group[0].trip.data_partenza||'').slice(0,10)+'.pdf':'DELGROSSO_PRENOTATI_TUTTI_I_VIAGGI'+($('dg9Archived')?.checked?'_CON_ARCHIVIATI':'')+'.pdf';
  const blob=new Blob([bytes],{type:'application/pdf'}),url=URL.createObjectURL(blob);
  prepared={blob,bytes,url,filename,count,pax};
  const open=$('dg9OpenPdf');if(open){open.href=url;open.hidden=false}
  const share=$('dg9Share');if(share)share.disabled=false;
  // Desktop browsers save directly; iOS can also use Download, Open PDF or Share to Files.
  const a=document.createElement('a');a.href=url;a.download=filename;a.style.display='none';document.body.appendChild(a);a.click();a.remove();
  status('✅ PDF pronto: '+group.length+' viaggi, '+count+' prenotazioni, '+pax+' posti. Su iPhone usa "Condividi / Salva su File" oppure "Apri PDF preparato".');
 }catch(e){status('⚠ '+String(e?.message||e),true)}
}
async function share(){if(!prepared){status('Genera prima il PDF del viaggio o di tutti i viaggi.',true);return}
 const file=new File([prepared.blob],prepared.filename,{type:'application/pdf'});
 if(navigator.share&&navigator.canShare?.({files:[file]})){
  try{await navigator.share({files:[file],title:'Lista prenotati DELGROSSO'});status('✅ PDF inviato al menu Condividi. Scegli “Salva su File” per conservarlo su iPhone.');return}
  catch(e){if(e?.name==='AbortError'){status('Condivisione annullata: puoi aprire o scaricare il PDF.');return}}
 }
 // Alternative Safari: open local Blob in another tab, then Share -> Save to Files.
 const w=window.open(prepared.url,'_blank','noopener');if(!w)status('Il dispositivo blocca le nuove schede. Tocca “Apri PDF preparato” e usa il pulsante Condividi di Safari.',true);
 else status('PDF aperto. Usa Condividi → Salva su File sul tuo iPhone.');
}
// Supabase default PostgREST page limit: paginate, rather than truncating at the first 1000 rows.
async function paginated(table,order){
 const limit=700,all=[];
 for(let offset=0,part=0;part<150;part++,offset+=limit){
  const batch=await api(table,'select=*&order='+order+'&limit='+limit+'&offset='+offset,{noCache:true});
  if(!Array.isArray(batch))throw Error('Dati non validi: '+table);
  all.push(...batch);if(batch.length<limit)return all;
 }
 throw Error('Troppi risultati: '+table+'. Esportazione interrotta per evitare una lista incompleta.');
}
async function refresh(){if(preparing)return;if(!auth()){status('Accedi prima di aggiornare gli elenchi.',true);return}
 preparing=true;const btn=$('dg9Refresh');if(btn)btn.disabled=true;status('Sto leggendo TUTTI i viaggi e i prenotati da Supabase (pagine complete)...');
 try{
  const [trips,bookings]=await Promise.all([paginated('viaggi','data_partenza.asc'),paginated('prenotazioni','created_at.desc')]);
  snapshot={trips,bookings};clearPdf();refreshTrips();
  status('✅ Aggiornati da Supabase: '+trips.length+' viaggi e '+bookings.length+' prenotazioni. Adesso puoi scaricare il PDF.');
 }catch(e){status('⚠ Aggiornamento fallito: '+String(e?.message||e)+'. Non generare un report incompleto.',true)}
 finally{preparing=false;if(btn)btn.disabled=false}
}
function openRoster(id){if(typeof window.go==='function')window.go('prenotazioni');refreshTrips();
 if(id){const t=sources().trips.find(x=>x.id===id);if(t){const byId=new Map(sources().trips.map(x=>[x.id,x]));let root=t;const seen=new Set();while(root.bis_parent_id&&!seen.has(root.id)){seen.add(root.id);root=byId.get(root.bis_parent_id)||root}if(root.archiviato_at&&$('dg9Archived'))$('dg9Archived').checked=true;refreshTrips();if($('dg9Trip'))$('dg9Trip').value=root.id;}}
 refreshTrips();$('dg9RosterPdfPanel')?.scrollIntoView({behavior:'smooth',block:'start'});
}
function init(){if(!$('dg9RosterPdfPanel'))return;
 $('dg9Trip')?.addEventListener('change',()=>{clearPdf();refreshTrips()});
 $('dg9Archived')?.addEventListener('change',()=>{clearPdf();refreshTrips()});
 $('dg9PdfTrip')?.addEventListener('click',()=>prepare('one'));
 $('dg9PdfAll')?.addEventListener('click',()=>prepare('all'));
 $('dg9Refresh')?.addEventListener('click',refresh);
 $('dg9Share')?.addEventListener('click',share);
 refreshTrips();
 const oldRender=window.renderBookings;
 if(typeof oldRender==='function'&&!oldRender.__dg9){const wrapped=function(){const out=oldRender.apply(this,arguments);refreshTrips();return out};wrapped.__dg9=true;window.renderBookings=wrapped;try{renderBookings=wrapped}catch{}}
}
window.dg9OpenRoster=openRoster;
window.dg9RosterTest={active,groupData,parents,prepare,refresh,sources};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
