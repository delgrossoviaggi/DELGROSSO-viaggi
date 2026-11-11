/* DELGROSSO V68 — Gruppi viaggio & prenotazioni da verificare.
 * Browser-only: nessun invio automatico, nessuna creazione gruppi WhatsApp.
 * I recapiti sono letti dalla sessione del gestionale, non salvati sul dispositivo.
 * Inviti solo dopo consenso ESPLICITO al gruppo + link salvato per quel bus.
 */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const getState=()=>typeof state==='undefined'?null:state;
const validPhone=v=>{let p=String(v||'').replace(/\D/g,'');if(p.startsWith('00'))p=p.slice(2);if(p.length===10&&p.startsWith('3'))p='39'+p;return /^39\d{9,12}$/.test(p)?p:''};
const dateString=v=>{const s=String(v||'').slice(0,10),m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?m[3]+'/'+m[2]+'/'+m[1]:'Data da verificare'};
const active=b=>b&&!b.riserva_aziendale&&!/annull|cancel|storn|rimbors/i.test(String(b.stato||''));
const allTrips=()=>getState()?.viaggi||[];
const allBookings=()=>getState()?.prenotazioni||[];
const getTrip=id=>allTrips().find(v=>v.id===id);
const rootId=v=>{let t=v,seen=new Set();while(t&&t.bis_parent_id&&!seen.has(t.id)){seen.add(t.id);t=getTrip(t.bis_parent_id)||t; if(seen.has(t.id))break;}return t?.id||v?.id};
const groupTrips=root=>allTrips().filter(v=>rootId(v)===root).sort((a,b)=>{const na=Number(a.bis_numero||(!a.bis_parent_id?1:2)),nb=Number(b.bis_numero||(!b.bis_parent_id?1:2));return na-nb||String(a.titolo||'').localeCompare(String(b.titolo||''))});
const groupLabel=(v,i)=>Number(v.bis_numero||(!v.bis_parent_id?1:i+1))===1?'BUS 1':'BUS '+Number(v.bis_numero||(i+1))+' · BIS';
const tripLabel=t=>(t?.titolo||t?.destinazione||'Viaggio')+' · '+dateString(t?.data_partenza);
const guestName=b=>String(b.cliente_nome||b.cliente||'Cliente').trim();
const waLink=(tel,message)=>'https://wa.me/'+tel+'?text='+encodeURIComponent(message);
let consents=new Set(),consentsLoaded=false,loadingConsents=false,lastConsentRead=0;
const cache=new Map();
const show=(msg,err=false)=>{const e=$('dg68Msg');if(e){e.textContent=msg;e.style.color=err?'#a53320':'#256247';}};
async function consentRefresh(force=false){
 if(loadingConsents||typeof api!=='function')return;
 if(!force&&consentsLoaded&&Date.now()-lastConsentRead<20000)return;
 loadingConsents=true;show('Verifica dei consensi gruppo…');
 try{
  const rows=await api('dg_trip_group_consents_v65','select=booking_id,trip_id,revoked_at&limit=1000',{noCache:true});
  consents=new Set((Array.isArray(rows)?rows:[]).filter(c=>!c.revoked_at).map(c=>String(c.booking_id)+'|'+String(c.trip_id)));
  consentsLoaded=true;lastConsentRead=Date.now();show('Consensi aggiornati. Nessun invito viene inviato automaticamente.');
 }catch(e){consentsLoaded=false;consents.clear();show('Consensi non verificabili: inviti disattivati finché non sono disponibili.',true)}
 finally{loadingConsents=false;renderRoster();}
}
function roots(){
 const ids=[...new Set(allTrips().filter(v=>!v.archiviato_at).map(v=>rootId(v)))];
 const now=new Date().toISOString().slice(0,10);
 return ids.map(id=>getTrip(id)).filter(Boolean).sort((a,b)=>{
 const ba=String(a.data_partenza||'9999-12-31'),bb=String(b.data_partenza||'9999-12-31');
 const aa=ba>=now?0:1,ab=bb>=now?0:1;
 return aa-ab||(aa===0?ba.localeCompare(bb):bb.localeCompare(ba));
 });
}
function syncSelectors(){
 const root=$('dg68Root'),bus=$('dg68Bus');if(!root||!bus)return false;
 const old=root.value,ts=roots();
 const choices=ts.map(t=>'<option value="'+esc(t.id)+'">'+esc(tripLabel(t))+'</option>').join('');
 if(root.innerHTML!==choices){root.innerHTML=choices; if(ts.some(t=>t.id===old))root.value=old;}
 if(!root.value&&ts.length)root.value=ts[0].id;
 const children=groupTrips(root.value),current=bus.value;
 const opts='<option value="all">Tutti i bus del viaggio</option>'+children.map((t,i)=>'<option value="'+esc(t.id)+'">'+esc(groupLabel(t,i))+'</option>').join('');
 if(bus.innerHTML!==opts){bus.innerHTML=opts;if(children.some(t=>t.id===current))bus.value=current;else bus.value='all';}
 return Boolean(root.value);
}
function perBus(v){
 const all=allBookings().filter(b=>b.viaggio_id===v.id&&active(b));
 const withTel=new Map();let missing=0;
 for(const b of all){
  const tel=validPhone(b.telefono);if(!tel){missing++;continue}
  const rec=withTel.get(tel)||{tel,names:[],refs:[],stops:[],pax:0,bookings:[]};
  if(!rec.names.includes(guestName(b)))rec.names.push(guestName(b));
  if(b.fermata_partenza&&!rec.stops.includes(b.fermata_partenza))rec.stops.push(b.fermata_partenza);
  rec.pax+=Math.max(0,Number(b.posti||0));rec.bookings.push(b);rec.refs.push(b.id);withTel.set(tel,rec);
 }
 return {all,people:[...withTel.values()].sort((a,b)=>a.names[0].localeCompare(b.names[0],'it')),missing};
}
const linkFor=v=>(getState()?.whatsappInvites||[]).find(i=>i.trip_id===v.id)?.invite_url||'';
// Only transient in-memory selections. Never store private phone numbers in localStorage.
const chosen=new Set();
const invitedAttempted=new Set();
let nextCopyIndex=0;
const rowKey=(tripId,tel)=>tripId+'|'+tel;
function visibleContacts(){
 const root=$('dg68Root')?.value,bus=$('dg68Bus')?.value;
 if(!root)return [];
 const out=[];
 for(const trip of groupTrips(root).filter(t=>bus==='all'||t.id===bus)){
  for(const c of perBus(trip).people)out.push({...c,tripId:trip.id,trip,group:groupLabel(trip,groupTrips(root).indexOf(trip)),key:rowKey(trip.id,c.tel)});
 }
 return out;
}
function selectedContacts(){
 // Never include contacts from another trip or hidden bus: the displayed selection is authoritative.
 return visibleContacts().filter(c=>chosen.has(c.key));
}
function uniqueSelected(){
 const map=new Map();for(const r of selectedContacts())if(!map.has(r.tel))map.set(r.tel,r);
 return [...map.values()];
}
function refreshSelectionStats(){
 const nodes=$('dg68SelectionStats'),rows=selectedContacts(),unique=uniqueSelected();
 const cons=rows.filter(r=>consentsLoaded&&r.bookings.some(b=>consents.has(b.id+'|'+r.tripId))).length;
 if(nodes)nodes.textContent=rows.length+' righe selezionate · '+unique.length+' numeri unici · '+cons+' con consenso gruppo verificato';
 const button=$('dg68SelectAll');if(button){
   const visible=visibleContacts();button.textContent=visible.length&&visible.every(x=>chosen.has(x.key))?'☑ Deseleziona tutti':'☐ Seleziona tutti';
 }
 for(const id of ['dg68CopySelected','dg68CopyNext','dg68DownloadVcf','dg68CopySelectedNames','dg68NextInvite']){
   const b=$(id);if(b)b.disabled=!rows.length;
 }
}
function resetSelection(){chosen.clear();invitedAttempted.clear();nextCopyIndex=0;refreshSelectionStats()}
function copySelected(){
 const entries=uniqueSelected();if(!entries.length)return show('Seleziona almeno un numero.',true);
 // Plain E.164 +39 per line, useful for copying; WhatsApp does not bulk-add these into a group.
 clipboard(entries.map(r=>'+'+r.tel).join('\n'));
}
function copySelectedWithNames(){
 const entries=uniqueSelected();if(!entries.length)return show('Seleziona almeno un contatto.',true);
 clipboard(entries.map(r=>r.names.join(' / ')+' | +'+r.tel+' | '+r.group+' | '+r.pax+' posti').join('\n'));
}
function copyNext(){
 const entries=uniqueSelected();if(!entries.length)return show('Seleziona almeno un contatto.',true);
 const n=nextCopyIndex%entries.length;nextCopyIndex=(n+1)%entries.length;
 const x=entries[n];clipboard('+'+x.tel);
 show('Numero '+(n+1)+' di '+entries.length+' pronto per la ricerca partecipanti su WhatsApp: '+x.names[0]+'. Incolla e selezionalo, poi premi nuovamente “Copia prossimo”.');
}
function vcardEscape(v){return String(v??'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;').replace(/\r/g,'')}
function downloadVcf(){
 const entries=uniqueSelected();if(!entries.length)return show('Seleziona almeno un numero.',true);
 const root=getTrip($('dg68Root')?.value);const tripName=String(root?.titolo||'Viaggio').slice(0,48);
 const body=entries.map(r=>'BEGIN:VCARD\r\nVERSION:3.0\r\nFN:'+vcardEscape('DELGROSSO '+r.names[0])+'\r\nTEL;TYPE=CELL:+'+r.tel+'\r\nNOTE:'+vcardEscape(tripName+' - '+r.group)+'\r\nEND:VCARD').join('\r\n')+'\r\n';
 const blob=new Blob([body],{type:'text/vcard;charset=utf-8'}),url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download='DELGROSSO_contatti_'+String(root?.data_partenza||'viaggio').replace(/[^0-9-]/g,'')+'.vcf';
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
 show('File .vcf generato. Solo se lo importi nel telefono questi contatti entreranno in rubrica: l’esportazione da sola non li salva.');
}
function inviteNext(){
 const entries=selectedContacts().filter(r=>!invitedAttempted.has(r.key)&&consentsLoaded&&r.bookings.some(b=>consents.has(b.id+'|'+r.tripId))&&/^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9_-]{10,}$/.test(linkFor(r.trip)));
 if(!entries.length)return show('Nessun altro invito disponibile: verifica consenso e link gruppo, oppure seleziona altri contatti.',true);
 const r=entries[0];if(invite(r.tripId,r.tel)){invitedAttempted.add(r.key);show('Aperta chat per '+r.names[0]+'. Devi premere Invia manualmente su WhatsApp; poi usa “Apri prossimo invito”.');}
}
function renderNotifications(){
 const elem=$('dg68BookingsBox');if(!elem)return;
 const now=Date.now(),wk=now-7*86400000;
 const bs=allBookings().filter(b=>active(b)&&new Date(b.created_at||0).getTime()>=wk).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
 const unread=(getState()?.notifiche||[]).filter(n=>!n.letto&&/prenot/i.test(String(n.titolo||'')+' '+String(n.messaggio||'')));
 elem.innerHTML='<div class="dg68-metrics"><span><b>'+bs.length+'</b> prenotazioni registrate negli ultimi 7 giorni</span><span><b>'+unread.length+'</b> notifiche prenotazione non lette</span></div>'+
 '<p class="dg68-note">Questi dati provengono dal gestionale e comprendono sito e inserimenti interni. Non indicano messaggi ricevuti su WhatsApp.</p>'+
 (bs.length?bs.slice(0,6).map(b=>'<div class="dg68-line"><span><b>'+esc(guestName(b))+'</b><small>'+esc(tripLabel(getTrip(b.viaggio_id)))+' · '+esc(String(b.created_at||'').slice(0,16).replace('T',' '))+'</small></span><button type="button" class="btn btn-secondary btn-sm" data-dg68-book="'+esc(b.id)+'">Prenotazione</button></div>').join(''):'<div class="dg68-empty">Nessuna nuova prenotazione negli ultimi 7 giorni.</div>');
}
function renderRoster(){
 const box=$('dg68Roster'),stats=$('dg68Stats');if(!box||!stats)return;
 if(!syncSelectors()){stats.textContent='Nessun viaggio disponibile.';box.innerHTML='';return}
 const root=$('dg68Root').value,selected=$('dg68Bus').value,ts=groupTrips(root).filter(v=>selected==='all'||v.id===selected);
 let cnt=0,contacts=0,pax=0,missing=0;
 const contents=ts.map((v,i)=>{
  const all=groupTrips(root),label=groupLabel(v,all.indexOf(v)),data=perBus(v),link=linkFor(v),validLink=/^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9_-]{10,}$/.test(link);
  cnt+=data.all.length;contacts+=data.people.length;pax+=data.all.reduce((n,b)=>n+Number(b.posti||0),0);missing+=data.missing;
  const persons=data.people.map(rec=>{
   const approved=consentsLoaded&&rec.bookings.some(b=>consents.has(b.id+'|'+v.id));
   const invite=approved&&validLink;
   const key=rowKey(v.id,rec.tel);
   return '<div class="dg68-line"><label class="dg68-select-wrap"><input type="checkbox" class="dg68-select" data-dg68-select="'+esc(key)+'" aria-label="Seleziona '+esc(rec.names.join(' / '))+'" '+(chosen.has(key)?'checked':'')+'><span class="dg68-select-text"><b>'+esc(rec.names.join(' / '))+'</b><small>+'+esc(rec.tel)+' · '+rec.pax+' posti · '+esc(rec.stops.join(', ')||'Fermata da verificare')+(rec.bookings.length>1?' · '+rec.bookings.length+' prenotazioni':'')+'</small><small class="'+(approved?'dg68-ok':'dg68-muted')+'">'+(approved?'✓ Consenso gruppo registrato':'Invito non autorizzato: consenso gruppo mancante')+'</small></span></label><button type="button" class="btn btn-secondary btn-sm" data-dg68-invite="'+esc(v.id)+'|'+esc(rec.tel)+'" '+(invite?'':'disabled title="Serve consenso specifico al gruppo e un link WhatsApp valido"')+'>Invita</button></div>';
  }).join('');
  return '<div class="dg68-group"><div class="dg68-group-head"><div><h4>'+esc(label)+' · '+esc(v.titolo||v.destinazione||'Viaggio')+'</h4><small>'+data.all.length+' prenotazioni · '+data.people.length+' numeri unici · '+data.missing+' senza telefono</small></div><div><span class="'+(validLink?'dg68-ok':'dg68-muted')+'">'+(validLink?'✓ Link invito salvato':'Link gruppo non inserito')+'</span><button type="button" class="btn btn-secondary btn-sm" data-dg68-link="'+esc(v.id)+'">Gestisci link</button></div></div>'+
 (persons||'<div class="dg68-empty">Nessun numero WhatsApp valido per questo bus.</div>')+'</div>';
 }).join('');
 stats.innerHTML='<div class="dg68-metrics"><span><b>'+cnt+'</b> prenotazioni</span><span><b>'+pax+'</b> posti prenotati</span><span><b>'+contacts+'</b> numeri unici</span><span><b>'+missing+'</b> prenotazioni senza telefono</span></div>';
 box.innerHTML=contents;
 refreshSelectionStats();
}
function clipboard(text){
 if(!text){show('Non ci sono numeri da copiare.',true);return}
 if(navigator.clipboard?.writeText){navigator.clipboard.writeText(text).catch(()=>window.prompt('Seleziona e copia il testo',text));}
 else window.prompt('Seleziona e copia il testo',text);
}
function exportList(numbersOnly){
 const root=$('dg68Root')?.value,selected=$('dg68Bus')?.value;if(!root)return;
 let lines=[];for(const v of groupTrips(root).filter(t=>selected==='all'||t.id===selected)){
  const entries=perBus(v).people,group=groupLabel(v,groupTrips(root).indexOf(v));
  if(!numbersOnly)lines.push('DELGROSSO · '+tripLabel(v)+' · '+group);
  for(const r of entries)lines.push(numbersOnly?'+'+r.tel:r.names.join(' / ')+' | +'+r.tel+' | '+r.pax+' posti | '+r.stops.join(', '));
  if(!numbersOnly)lines.push('');
 }
 clipboard(lines.join('\n').trim());
}
function manageLink(id){
 const sel=$('dg61GroupTrip');if(!sel)return show('Sezione link non disponibile.',true);
 if(![...sel.options].some(o=>o.value===id))return show('Aggiorna il Centro WhatsApp per visualizzare questo bus nell’elenco dei link.',true);
 sel.value=id;
 if(typeof window.dg61RenderGroupLink==='function')window.dg61RenderGroupLink();
 const root=sel.closest('.card');root?.scrollIntoView({behavior:'smooth',block:'center'});
 $('dg61GroupUrl')?.focus();
}
function invite(id,tel){
 const v=getTrip(id),data=v?perBus(v):null,person=data?.people.find(p=>p.tel===tel),link=v?linkFor(v):'';
 if(!person||!consentsLoaded||!person.bookings.some(b=>consents.has(b.id+'|'+id))){show('Invito non disponibile: verifica il consenso specifico al gruppo.',true);return false;}
 if(!/^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9_-]{10,}$/.test(link)){show('Salva prima un link di invito valido per il bus.',true);return false;}
 const name=person.names[0];const m='DELGROSSO VIAGGI & LIMOUSINE BUS\n\nGentile '+name+', per gli aggiornamenti del viaggio '+tripLabel(v)+' ('+groupLabel(v,groupTrips(rootId(v)).indexOf(v))+') puoi scegliere di unirti al gruppo WhatsApp tramite questo link:\n'+link+'\n\nL’adesione è volontaria; gli altri membri potranno vedere il tuo numero di telefono.\n\nDELGROSSO VIAGGI';
 const a=document.createElement('a');a.href=waLink(tel,m);a.target='_blank';a.rel='noopener noreferrer';document.body.appendChild(a);a.click();a.remove();
 show('Chat aperta con invito pronto. Devi scegliere l’account Business e premere Invia.');
 return true;
}
function attach(){
 const section=$('page-whatsapp');if(!section||section.dataset.dg68Ready)return;
 section.dataset.dg68Ready='1';
 section.addEventListener('change',e=>{
  const c=e.target.closest('input[data-dg68-select]');if(!c)return;
  if(c.checked)chosen.add(c.dataset.dg68Select);else chosen.delete(c.dataset.dg68Select);
  invitedAttempted.delete(c.dataset.dg68Select);nextCopyIndex=0;refreshSelectionStats();
 });
 section.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.dg68Invite){const [t,p]=b.dataset.dg68Invite.split('|');invite(t,p)}
  if(b.dataset.dg68Link)manageLink(b.dataset.dg68Link);
  if(b.dataset.dg68Book){if(typeof window.go==='function')window.go('prenotazioni');const inp=$('bookSearch');if(inp){const bk=allBookings().find(x=>x.id===b.dataset.dg68Book);inp.value=bk?.cliente||'';if(typeof window.renderBookings==='function')window.renderBookings()}}
 });
 $('dg68Root')?.addEventListener('change',()=>{const el=$('dg68Bus');if(el)el.value='all';resetSelection();renderRoster()});
 $('dg68Bus')?.addEventListener('change',()=>{resetSelection();renderRoster()});
 $('dg68SelectAll')?.addEventListener('click',()=>{const rows=visibleContacts();const all=rows.length&&rows.every(r=>chosen.has(r.key));rows.forEach(r=>all?chosen.delete(r.key):chosen.add(r.key));nextCopyIndex=0;renderRoster()});
 $('dg68Clear')?.addEventListener('click',()=>{resetSelection();renderRoster()});
 $('dg68CopySelected')?.addEventListener('click',copySelected);
 $('dg68CopySelectedNames')?.addEventListener('click',copySelectedWithNames);
 $('dg68CopyNext')?.addEventListener('click',copyNext);
 $('dg68DownloadVcf')?.addEventListener('click',downloadVcf);
 $('dg68NextInvite')?.addEventListener('click',inviteNext);
 $('dg68CopyPhones')?.addEventListener('click',()=>exportList(true));
 $('dg68CopyRoster')?.addEventListener('click',()=>exportList(false));
 $('dg68Refresh')?.addEventListener('click',async()=>{renderNotifications();renderRoster();await consentRefresh(true)});
}
function update(){if(!getState()||!$('page-whatsapp'))return;attach();renderNotifications();renderRoster();void consentRefresh(false)}
// Entrando nel Centro WhatsApp leggiamo lo stato già caricato da Supabase.
const prior=window.dg61RenderWhatsApp;
if(typeof prior==='function')window.dg61RenderWhatsApp=function(){const result=prior.apply(this,arguments);update();return result};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{attach();if($('page-whatsapp')?.classList.contains('active'))update()},{once:true});else{attach();if($('page-whatsapp')?.classList.contains('active'))update()}
window.dg68RefreshTripGroups=update;
window.dg68OpenRoster=function(){if(typeof window.dg44Go==='function')window.dg44Go('whatsapp-roster');else if(typeof window.go==='function')window.go('whatsapp');};
})();
