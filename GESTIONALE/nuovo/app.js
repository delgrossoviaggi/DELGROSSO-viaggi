/* DELGROSSO VIAGGI DG36 - nuovo nucleo operativo.
   Le credenziali restano su Supabase Auth, le scritture usano RLS/RPC server.
   Niente service role, dati persistenti, cache locale o geometrie inventate. */
(function(){
'use strict';
const URL='https://chkuayhbmitdmzmmvona.supabase.co';
const KEY='sb_publishable_H29K1BV5ZE1rT8xo0PIzVA_wF6zC7je'; // chiave publishable
const COL={
trips:['viaggi','id,titolo,destinazione,data_partenza,ora_partenza,stato,posti_totali,posti_occupati,autobus,autobus_id,bis_parent_id,bis_numero,archiviato_at'],
bookings:['prenotazioni','id,viaggio_id,cliente,cliente_nome,telefono,email,posti,posti_selezionati,totale,pagato,saldo,stato,fermata_partenza,checkin_effettuato,codice,riserva_aziendale'],
seatrows:['prenotazione_posti','id,viaggio_id,prenotazione_id,posto'],
payments:['pagamenti','id,prenotazione_id,viaggio_id,cliente,importo,tipo,stato,metodo,metodo_pagamento,incassato_da,incassato_da_user_id,receipt_number,data_pagamento,created_at'],
operators:['operatori_gestionale','user_id,username,nome,attivo'],
transfers:['cassa_trasferimenti','id,da_operatore_user_id,a_operatore_user_id,importo,stato,data_trasferimento'],
economy:['economia_movimenti','id,tipo,categoria,descrizione,importo,data_movimento,operatore,viaggio_id'],
cashoperators:['dg_cassa_operatori','user_id,username,nome,cassa_netto,contanti_netto,trasferimenti_entrata,trasferimenti_uscita'],
rentals:['noleggi_bus','id,referente,azienda,tratta_partenza,tratta_destinazione,data_partenza,prezzo_concordato,acconto,saldo,stato_pagamento,stato_noleggio'],
rentalPayments:['noleggi_bus_pagamenti','id,noleggio_id,tipo,importo,metodo,data_pagamento,incassato_da,incassato_da_user_id,receipt_number'],
customers:['clienti','id,nome,cognome,telefono,email'],
agenda:['scadenze_gestionale','id,titolo,descrizione,data_scadenza,stato,priorita,tipo'],
fleet:['flotta','id,titolo,modello,posti,categoria,attivo,stato'],
layoutDrafts:['dg2_layout_library','id,nome,configurazione,attivo,updated_at'],
busOfficial:['dg28_bus_layouts','autobus_id,layout_id,configurazione,versione,pubblicata_il'],
tripOfficial:['dg28_trip_layouts','viaggio_id,autobus_id,layout_id,configurazione,versione,pubblicata_il']
};
const PAGE={dashboard:'Dashboard',trips:'Viaggi e partenze',bookings:'Prenotazioni',control:'Control Room',layouts:'Piantine GT',accounting:'Contabilità e cassa',economy:'Economia',fleet:'Flotta GT',rentals:'Noleggi autobus',customers:'Clienti',agenda:'Agenda'};
let session=null,operator='',page='dashboard',fetchTicket=0,mutation=false,unsafeRetry=false,sessionEpoch=0;
let filters={trip:'',term:'',stop:''},selectedTrip='',temp={},lastNotice='';
const cache=new Map(),ongoing=new Map();
const $=id=>document.getElementById(id);
const txt=v=>String(v==null?'':v);
const esc=v=>txt(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(n)||0);
const moneyCents=n=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format((Number(n)||0)/100);
const validBooking=b=>!/annull|cancel|cancell|eliminat/i.test(b.stato||'');
const dateIT=s=>{s=txt(s).slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)?s.slice(8)+'/'+s.slice(5,7)+'/'+s.slice(0,4):'—'};
const today=()=>{const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const m=Object.fromEntries(parts.map(x=>[x.type,x.value]));return m.year+'-'+m.month+'-'+m.day};
const nameBooking=b=>b.cliente_nome||b.cliente||'Senza nome';
const nameTrip=t=>t.titolo||t.destinazione||'Viaggio';
const look=(k,id)=>cache.get(k)?.data?.find(v=>v.id===id);
const tag=s=>'<span class="tag '+(/annull|rimbors|errore/i.test(s||'')?'bad':/attesa|parzial|sospes/i.test(s||'')?'warn':'')+'">'+esc(s||'—')+'</span>';
function notice(s,kind=''){lastNotice=s;const el=$('notice');el.textContent=s;el.hidden=!s;el.className='notice '+kind}
function errorMsg(e){return txt(e?.message||e).replace(/(Bearer\s+[A-Za-z0-9-_.]+)/g,'Bearer ***')}
function setLoading(s='Caricamento dati Supabase…'){$('content').innerHTML='<div class="loading">'+esc(s)+'</div>'}
function setBusy(b){document.querySelectorAll('.btn.solid').forEach(x=>x.disabled=b)}
function clearSensitive(){sessionEpoch++;session=null;operator='';cache.clear();ongoing.clear();temp={};window.DG37Layouts?.clear();try{sessionStorage.removeItem('dg_auth');sessionStorage.removeItem('dg_login')}catch(e){}}
function hasSession(){return !!session?.access_token&&!!session?.user?.id}
async function raw(path,method='GET',body=null,authenticated=true){
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),16000);
 try{
  if(authenticated){if(!hasSession())throw Error('Sessione scaduta: effettua il login.');await refreshToken();}
  const h={'apikey':KEY,'Accept':'application/json'};if(authenticated)h.Authorization='Bearer '+session.access_token;
  const o={method,headers:h,cache:'no-store',referrerPolicy:'no-referrer',mode:'cors',signal:ctl.signal};
  if(body!==null){h['Content-Type']='application/json';o.body=JSON.stringify(body)}
  if(['POST','PATCH'].includes(method)&&path.startsWith('/rest/v1/')&&!path.startsWith('/rest/v1/rpc/'))h.Prefer='return=representation';
  const res=await fetch(URL+path,o),s=await res.text();let data;
  try{data=s?JSON.parse(s):null}catch(e){data={message:s.slice(0,180)}}
  if(!res.ok)throw Error((data&&(data.message||data.error_description||data.error||data.hint))||('Supabase HTTP '+res.status));
  return data;
 }catch(e){if(e.name==='AbortError')throw Error('Connessione scaduta: controlla la rete. Se stavi registrando un pagamento, verifica prima il registro.');throw e}
 finally{clearTimeout(timer)}
}
async function refreshToken(){
 if(!session?.refresh_token)throw Error('Sessione scaduta, nuovo accesso necessario.');
 if(session.expires_at&&session.expires_at*1000>Date.now()+90000)return;
 const oldId=session.user.id;
 const next=await raw('/auth/v1/token?grant_type=refresh_token','POST',{refresh_token:session.refresh_token},false);
 if(next?.user?.id!==oldId||!next.access_token)throw Error('Sessione non riconosciuta: rientra con il tuo profilo.');
 session=next;
 session.expires_at=session.expires_at||Math.floor(Date.now()/1000)+Number(session.expires_in||3600);
 try{sessionStorage.setItem('dg_auth',JSON.stringify(session))}catch(e){}
}
async function authorize(){
 const user=await raw('/auth/v1/user');
 if(user?.id!==session?.user?.id)throw Error('Identità Supabase non verificata.');
 const permission=await raw('/rest/v1/rpc/is_gestionale_admin','POST',{});
 if(permission!==true)throw Error('Il profilo non è autorizzato ad accedere ai dati aziendali.');
 return user;
}
async function login(ev){
 ev?.preventDefault();if(mutation)return;
 mutation=true;$('login-btn').disabled=true;$('auth-error').hidden=true;
 try{
  const u=$('user').value.toLowerCase();
  if(!['nicola','raffaele'].includes(u))throw Error('Operatore non valido');
  const data=await raw('/functions/v1/dg2-operator-login','POST',{username:u,password:$('pass').value},false);
  if(!data?.access_token||!data?.refresh_token||!data?.user?.id)throw Error('Accesso non confermato: controlla le credenziali.');
  session=data;session.expires_at=session.expires_at||Math.floor(Date.now()/1000)+Number(session.expires_in||3600);
  await authorize();operator=u;
  $('pass').value='';
  try{sessionStorage.setItem('dg_auth',JSON.stringify(session));sessionStorage.setItem('dg_login','1')}catch(e){}
  $('operator-label').textContent='Operatore: '+(u==='nicola'?'Nicola':'Raffaele');
  $('auth').hidden=true;$('shell').hidden=false;notice('Supabase autenticato come '+u+'.');
  await navigate('dashboard');
 }catch(e){clearSensitive();$('auth-error').textContent=errorMsg(e);$('auth-error').hidden=false;}
 finally{mutation=false;$('login-btn').disabled=false}
}
async function adopt(){
 try{
  const old=JSON.parse(sessionStorage.getItem('dg_auth')||'null');
  if(!old?.access_token||!old?.refresh_token||!old?.user?.id)return;
  session=old;await authorize();
  // Nome realmente associato all'account Auth, non dedotto da dati scrivibili.
  const users=await load('operators',true);
  operator=txt(users.find(x=>x.user_id===session.user.id)?.username).toLowerCase();
  if(!['nicola','raffaele'].includes(operator))throw Error('Profilo operatore non collegato.');
  $('operator-label').textContent='Operatore: '+operator;
  $('auth').hidden=true;$('shell').hidden=false;await navigate((location.hash||'').slice(1)||'dashboard');
 }catch(e){clearSensitive();$('auth').hidden=false;$('shell').hidden=true;}
}
async function logout(){
 const token=session?.access_token;clearSensitive();fetchTicket++;
 $('shell').hidden=true;$('auth').hidden=false;$('auth-error').hidden=true;
 notice('');
 if(token){fetch(URL+'/auth/v1/logout',{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+token},cache:'no-store'}).catch(()=>{})}
}
async function load(key,force=false){
 if(!COL[key])throw Error('Archivio non previsto: '+key);
 if(!hasSession())throw Error('Accesso non autorizzato.');
 const hit=cache.get(key);if(hit&&!force&&Date.now()-hit.ts<20000)return hit.data;
 if(ongoing.has(key))return ongoing.get(key);
 const promise=(async()=>{
  const [table,select]=COL[key],rows=[],chunk=400,readEpoch=sessionEpoch;
  for(let offset=0;offset<12000;offset+=chunk){
   const q=new URLSearchParams({select,limit:String(chunk),offset:String(offset),order:({operators:'user_id.asc',cashoperators:'user_id.asc',busOfficial:'autobus_id.asc',tripOfficial:'viaggio_id.asc'}[key]||'id.asc')});
   const part=await raw('/rest/v1/'+table+'?'+q.toString());
   if(!Array.isArray(part))throw Error('Archivio '+table+' non leggibile.');
   if(readEpoch!==sessionEpoch)throw Error('Sessione cambiata durante la lettura.');rows.push(...part);if(part.length<chunk){cache.set(key,{data:rows,ts:Date.now()});return rows}
  }
  throw Error('Archivio troppo grande: consultare con filtri server.');
 })();
 ongoing.set(key,promise);
 try{return await promise}finally{ongoing.delete(key)}
}
function invalidate(...keys){for(const k of keys)cache.delete(k)}
function table(headers,items){return '<div class="scroll"><table><thead><tr>'+headers.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+items.join('')+'</tbody></table></div>'}
function tr(items){return '<tr>'+items.map(x=>'<td>'+x+'</td>').join('')+'</tr>'}
function headerCard(title,description){return '<section class="card"><h2>'+esc(title)+'</h2><p class="sub">'+esc(description)+'</p></section>'}
function options(items,selected='',title='Seleziona'){return '<option value="">'+esc(title)+'</option>'+items.map(x=>'<option value="'+esc(x.id)+'" '+(x.id===selected?'selected':'')+'>'+esc(x.label)+'</option>').join('')}
function currentPageName(){return PAGE[page]||PAGE.dashboard}
function navState(){document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));$('crumb').textContent=currentPageName().toUpperCase();$('heading').textContent=currentPageName()}
async function navigate(to){
 if(!hasSession())return;
 page=PAGE[to]?to:'dashboard';filters.term='';filters.trip='';fetchTicket++;
 navState();notice('');setLoading();
 const ticket=fetchTicket;
 try{
  const html=await (pages[page]||pages.dashboard)();
  if(ticket!==fetchTicket)return;
  $('content').innerHTML=html;
  if(page==='bookings')applyBookingsFilter();
  if(page==='accounting')applyAccountingFilter();
 }catch(e){if(ticket===fetchTicket){$('content').innerHTML=headerCard('Caricamento non riuscito',errorMsg(e))+'<button type="button" class="btn solid" data-action="retry">Riprova</button>';notice('Errore: '+errorMsg(e),'bad')}}
}
const pages={
async dashboard(){
 const [trips,bookings]=await Promise.all([load('trips'),load('bookings')]);
 const active=bookings.filter(validBooking);
 const upcoming=trips.filter(t=>!t.archiviato_at&&t.data_partenza>=today()).sort((a,b)=>txt(a.data_partenza).localeCompare(txt(b.data_partenza))).slice(0,8);
 const metrics=[['Viaggi presenti',trips.length],['Prenotazioni attive',active.length],['Posti prenotati',active.reduce((a,b)=>a+Number(b.posti||0),0)],['Prossime partenze',upcoming.length]].map(([t,v])=>'<div class="metric"><span>'+esc(t)+'</span><b>'+esc(v)+'</b></div>').join('');
 const actions=['trips','bookings','control','layouts','accounting','economy','rentals','fleet','customers','agenda'].map(k=>'<button data-page="'+k+'">'+esc(PAGE[k])+'</button>').join('');
 return '<div class="metrics">'+metrics+'</div><section class="card"><h2>Accessi operativi</h2><div class="quick">'+actions+'</div></section><section class="card"><h2>Prossime partenze</h2>'+table(['Data','Viaggio','Capienza','Stato','Azione'],upcoming.map(t=>tr([esc(dateIT(t.data_partenza)),esc(nameTrip(t)),esc(t.posti_occupati||0)+' / '+esc(t.posti_totali||0),tag(t.stato),'<button class="btn" data-control="'+esc(t.id)+'">Apri Control Room</button>'])) )+'</section>';
},
async layouts(){return window.DG37Layouts.render()},
async trips(){
 const trips=await load('trips');
 const list=[...trips].sort((a,b)=>txt(b.data_partenza).localeCompare(txt(a.data_partenza)));
 return '<section class="card"><h2>Viaggi e partenze</h2><p class="sub">Dati originali Supabase. Il BUS BIS resta separato dal viaggio principale.</p>'+table(['Data','Viaggio','Autobus','Posti','Stato','Control Room'],list.map(t=>tr([esc(dateIT(t.data_partenza)),esc(nameTrip(t))+(Number(t.bis_numero)>1?' · BUS '+esc(t.bis_numero):''),esc(t.autobus||'Da assegnare'),esc((t.posti_occupati??'—')+' / '+(t.posti_totali??'—')),tag(t.stato),'<button class="btn" data-control="'+esc(t.id)+'">Apri</button>'])))+'</section>';
},
async bookings(){
 const [trips,bookings]=await Promise.all([load('trips'),load('bookings')]);
 temp.bookings={trips,bookings};
 return '<section class="card"><div class="row"><h2>Prenotazioni</h2><button class="btn" data-action="bookings-csv">Esporta CSV</button><button class="btn" data-action="bookings-print">Stampa / PDF</button></div><p class="sub">Il numero di posti viene letto dalla prenotazione, senza spostamenti automatici.</p><div class="fields"><label>Viaggio<select id="book-trip">'+options(trips.map(t=>({id:t.id,label:dateIT(t.data_partenza)+' · '+nameTrip(t)})),'','Tutti i viaggi')+'</select></label><label>Cerca cliente, paese o posto<input type="search" id="book-search" placeholder="Nome o fermata"></label></div><div id="book-results"></div></section>';
},
async control(){
 const trips=await load('trips');
 const t=trips.find(x=>x.id===selectedTrip)||trips.find(x=>x.data_partenza>=today()&&!x.archiviato_at)||trips[0];
 if(!t)return headerCard('Control Room','Non ci sono viaggi presenti.');
 selectedTrip=t.id;
 return '<section class="card"><div class="row"><h2>Control Room · prenotazioni e fermate</h2><button class="btn solid" data-action="control-pdf">⇩ PDF nominativi e piantina</button><button class="btn" data-action="control-pdf-sunday">PDF domenica 22/11</button><button class="btn" data-action="control-csv">Esporta CSV</button></div><div class="fields"><label>Seleziona viaggio<select id="control-trip">'+options(trips.map(x=>({id:x.id,label:dateIT(x.data_partenza)+' · '+nameTrip(x)})),t.id)+'</select></label></div><div id="control-detail">'+await controlDetail(t)+'</div></section>';
},
async accounting(){
 if(!window.DG2OperatorLedger?.build)throw Error('Modulo di contabilità non disponibile. Ricarica la pagina.');
 const [trips,bookings,payments,operators,transfers]=await Promise.all([load('trips'),load('bookings'),load('payments'),load('operators'),load('transfers')]);
 const model=window.DG2OperatorLedger.build({trips,bookings,payments,operators,transfers});
 temp.accounting={model,trips,payments,operators,bookings};
 const ps=model.profiles,all=Object.values(ps).flatMap(x=>x.movements);
 const m=[['Incassi gite netti',moneyCents(all.reduce((a,m)=>a+m.amount,0))],['Nicola',moneyCents(ps.nicola.net)],['Raffaele',moneyCents(ps.raffaele.net)],['Da attribuire',moneyCents(ps.nonAttribuiti.net)]];
 const stats=m.map(x=>'<div class="metric"><span>'+esc(x[0])+'</span><b>'+esc(x[1])+'</b></div>').join('');
 const transferText='<p class="sub">Trasferimenti tra operatori esclusi dagli incassi: Nicola entrata '+moneyCents(ps.nicola.transferredIn)+' / uscita '+moneyCents(ps.nicola.transferredOut)+' · Raffaele entrata '+moneyCents(ps.raffaele.transferredIn)+' / uscita '+moneyCents(ps.raffaele.transferredOut)+'.</p>';
 return '<div class="metrics">'+stats+'</div><section class="card"><div class="row"><h2>Contabilità operativa · Supabase</h2><button class="btn solid" data-action="payment-form">＋ Registra acconto / saldo</button><button class="btn" data-action="accounting-pdf-nicola">⇩ PDF Nicola</button><button class="btn" data-action="accounting-pdf-raffaele">⇩ PDF Raffaele</button><button class="btn" data-action="accounting-csv">CSV</button></div>'+transferText+'<div class="fields"><label>Operatore<select id="account-who"><option value="">Tutti</option><option value="nicola">Nicola</option><option value="raffaele">Raffaele</option><option value="nonAttribuiti">Da verificare</option></select></label><label>Viaggio<select id="account-trip">'+options(trips.map(t=>({id:t.id,label:dateIT(t.data_partenza)+' · '+nameTrip(t)})),'','Tutti i viaggi')+'</select></label><label>Cerca cliente o ricevuta<input type="search" id="account-search" placeholder="Nome / ricevuta"></label></div><div id="account-results"></div></section>'+
 (model.issues?.length?'<div class="notice warn">'+esc(model.issues.length)+' avvisi contabili da verificare. Non correggere i dati automaticamente.</div>':'');
},
async economy(){
 const entries=await load('economy');
 const income=entries.filter(x=>/entrata/i.test(x.tipo||'')).reduce((a,x)=>a+Number(x.importo||0),0);
 const expense=entries.filter(x=>/uscita|rimborso/i.test(x.tipo||'')).reduce((a,x)=>a+Math.abs(Number(x.importo||0)),0);
 const last=[...entries].sort((a,b)=>txt(b.data_movimento).localeCompare(txt(a.data_movimento)));
 return '<div class="metrics"><div class="metric"><span>Entrate registrate</span><b>'+money(income)+'</b></div><div class="metric"><span>Uscite e rimborsi</span><b>'+money(expense)+'</b></div><div class="metric"><span>Saldo teorico movimenti</span><b>'+money(income-expense)+'</b></div><div class="metric"><span>Movimenti economia</span><b>'+entries.length+'</b></div></div><section class="card"><h2>Economia · movimenti sincronizzati</h2><p class="sub">I movimenti automatici dei pagamenti sono già inclusi in questo archivio: non sommarli una seconda volta al Registro Pagamenti. Non sostituisce la quadratura bancaria o fiscale.</p>'+table(['Data','Tipo','Categoria','Descrizione','Operatore','Importo'],last.map(x=>tr([esc(dateIT(x.data_movimento)),tag(x.tipo),esc(x.categoria),esc(x.descrizione),esc(x.operatore),money(x.importo)])))+'</section>';
},
async fleet(){
 const buses=await load('fleet');return '<section class="card"><h2>Flotta DELGROSSO</h2><p class="sub">Solo lettura: mantenute targhe e configurazioni esistenti, nessuna modifica automatica alla capienza.</p>'+table(['Autobus','Categoria','Capienza','Stato','Attivo'],buses.filter(x=>!(/mercedes|v250/i.test((x.titolo||'')+' '+(x.modello||'')))).map(x=>tr([esc(x.titolo||x.modello),esc(x.categoria),esc(x.posti),tag(x.stato),x.attivo?tag('Sì'):tag('No')])))+'</section>';
},
async rentals(){
 const [rentals,payments]=await Promise.all([load('rentals'),load('rentalPayments')]);
 const opMap=new Map(payments.map(x=>[x.noleggio_id,true]));
 return '<section class="card"><div class="row"><h2>Noleggi autobus</h2><button class="btn solid" data-action="rental-payment-form">＋ Registra pagamento noleggio</button></div><p class="sub">Incassi separati dalle gite, gestiti dalle procedure ufficiali Supabase.</p>'+table(['Data','Referente','Tratta','Prezzo','Residuo','Pagamento','Stato'],rentals.map(r=>tr([esc(dateIT(r.data_partenza)),esc(r.referente||r.azienda),esc(r.tratta_partenza||'')+' → '+esc(r.tratta_destinazione||''),money(r.prezzo_concordato),money(r.saldo),opMap.has(r.id)?'<span class="tag">Movimenti presenti</span>':'—',tag(r.stato_pagamento)])))+'</section>';
},
async customers(){
 const rows=await load('customers');
 temp.customers=rows;
 return '<section class="card"><div class="row"><h2>Anagrafica clienti</h2><button class="btn solid" data-action="customer-form">＋ Nuovo cliente</button></div><div class="fields"><label>Cerca cliente<input type="search" id="customers-search" placeholder="Cognome, nome, telefono"></label></div><div id="customers-results">'+customerRows(rows)+'</div></section>';
},
async agenda(){
 const rows=await load('agenda');
 return '<section class="card"><div class="row"><h2>Agenda e scadenze</h2><button class="btn solid" data-action="agenda-form">＋ Nuova scadenza</button></div>'+table(['Scadenza','Titolo','Priorità','Stato'],rows.sort((a,b)=>txt(a.data_scadenza).localeCompare(txt(b.data_scadenza))).map(x=>tr([esc(dateIT(x.data_scadenza)),esc(x.titolo),tag(x.priorita),tag(x.stato)])))+'</section>';
}
};
function customerRows(rows){return table(['Nome','Telefono','Email'],rows.slice(0,500).map(x=>tr([esc((x.nome||'')+' '+(x.cognome||'')),esc(x.telefono),esc(x.email)])))}
function applyBookingsFilter(){
 if(!temp.bookings)return;
 const id=$('book-trip')?.value||'',q=txt($('book-search')?.value).toLowerCase();
 const list=temp.bookings.bookings.filter(b=>(!id||b.viaggio_id===id)&&(!q||[b.cliente,b.cliente_nome,b.fermata_partenza,b.posti_selezionati,b.telefono].some(v=>txt(v).toLowerCase().includes(q))));
 const tmap=new Map(temp.bookings.trips.map(x=>[x.id,x]));
 $('book-results').innerHTML='<p class="sub">'+list.length+' prenotazioni trovate</p>'+table(['Cliente','Viaggio','Posti','Persone','Fermata','Quota pagata','Stato'],list.map(b=>tr([esc(nameBooking(b)),esc(nameTrip(tmap.get(b.viaggio_id)||{})),esc(b.posti_selezionati||'Da verificare'),esc(b.posti),esc(b.fermata_partenza||'—'),money(b.pagato),tag(b.stato)])));
}
function applyAccountingFilter(){
 if(!temp.accounting)return;
 const m=temp.accounting.model,all=Object.values(m.profiles).flatMap(x=>x.movements).sort((a,b)=>txt(b.timestamp).localeCompare(txt(a.timestamp)));
 const who=$('account-who')?.value||'',trip=$('account-trip')?.value||'',q=txt($('account-search')?.value).toLowerCase();
 const list=all.filter(x=>(!who||x.who===who)&&(!trip||x.tripId===trip||x.rootTripId===trip)&&(!q||[x.client,x.receipt,x.trip,x.booking].some(y=>txt(y).toLowerCase().includes(q))));
 temp.accountFiltered=list;
 $('account-results').innerHTML='<p class="sub">'+list.length+' movimenti. Totale visibile: <strong>'+moneyCents(list.reduce((a,x)=>a+x.amount,0))+'</strong></p>'+table(['Data','Operatore','Cliente','Viaggio','Tipo','Metodo','Importo','Ricevuta'],list.map(x=>tr([esc(dateIT(x.date)),esc(x.who),esc(x.client),esc(x.trip),tag(x.refund?'Rimborso':'Incasso'),esc(x.method),'<strong>'+moneyCents(x.amount)+'</strong>',esc(x.receipt)])));
}
function seatIds(b){
 const ids=txt(b.posti_selezionati).split(/[,;\s]+/).map(s=>s.trim()).filter(x=>/^\d{1,3}$/.test(x));
 return [...new Set(ids)];
}
async function controlDetail(t){
 const [bookings,seatrows]=await Promise.all([load('bookings'),load('seatrows')]);
 const b=bookings.filter(x=>x.viaggio_id===t.id&&validBooking(x)).sort((x,y)=>nameBooking(x).localeCompare(nameBooking(y),'it'));
 const fromIndex=new Map(),duplicates=new Set();
 for(const r of seatrows.filter(x=>x.viaggio_id===t.id)){
  const seat=txt(r.posto).trim();if(!/^\d+$/.test(seat))continue;
  if(fromIndex.has(seat)&&fromIndex.get(seat)!==r.prenotazione_id)duplicates.add(seat);
  fromIndex.set(seat,r.prenotazione_id);
 }
 const lookup=new Map(b.map(x=>[x.id,x])),seats=new Map();
 for(const x of b){for(const no of seatIds(x))seats.set(no,x)}
 for(const [no,bid] of fromIndex){const x=lookup.get(bid);if(x)seats.set(no,x)}
 const groups={};for(const x of b){const stop=txt(x.fermata_partenza).trim()||'Fermata non specificata';(groups[stop]??=[]).push(x)}
 const total=b.reduce((s,x)=>s+Number(x.posti||0),0);
 const warnings=[];
 if(duplicates.size)warnings.push('Attenzione: posti duplicati nell’indice prenotazioni: '+[...duplicates].join(', '));
 if(total!==Number(t.posti_occupati||0))warnings.push('Contatore viaggi '+t.posti_occupati+' diverso dai posti dichiarati prenotazioni '+total);
 if(seats.size!==total)warnings.push('Nominativi/posti da riconciliare: '+seats.size+' posti numerati, '+total+' persone registrate.');
 const capacity=Math.max(0,Math.min(100,Number(t.posti_totali)||0));
 const cells=[];for(let i=1;i<=capacity;i++){let booking=seats.get(String(i));cells.push('<div class="seat '+(booking?'occupied':'')+'"><strong>Posto '+i+'</strong><small>'+esc(booking?nameBooking(booking):'Libero')+'</small></div>')}
 const officialMap=await window.DG37Layouts.renderControlMap(t,b,seats);
 temp.control={trip:t,bookings:b,seats,groups};
 return '<div class="metrics"><div class="metric"><span>Capienza vendibile</span><b>'+capacity+'</b></div><div class="metric"><span>Passeggeri registrati</span><b>'+total+'</b></div><div class="metric"><span>Posti numerati</span><b>'+seats.size+'</b></div><div class="metric"><span>Check-in completati</span><b>'+b.filter(x=>x.checkin_effettuato).length+' / '+b.length+'</b></div></div>'+
 (warnings.length?'<div class="notice warn">'+warnings.map(esc).join(' · ')+'</div>':'')+
 officialMap+'<h3>Elenco posti nominativi</h3><p class="sub">Ordine numerico, NON disposizione fisica certificata: la geometria dell’autobus viene mostrata soltanto dopo validazione del layout ufficiale.</p><div class="seat-list">'+cells.join('')+'</div>'+
 '<h3 style="margin-top:22px">Prenotati suddivisi per fermata</h3><p class="sub">Check-in aggiornabile solo dagli operatori autorizzati. Puoi segnare la presenza o annullarla, senza cambiare posti e pagamenti.</p>'+
 Object.entries(groups).sort((a,b)=>a[0].localeCompare(b[0],'it')).map(([stop,list])=>'<h3>'+esc(stop)+' · '+list.reduce((sum,x)=>sum+Number(x.posti||0),0)+' persone</h3>'+table(['Nominativo','Persone','Posti','Telefono','Check-in'],list.map(x=>tr([esc(nameBooking(x)),esc(x.posti),esc(seatIds(x).join(', ')||'Da verificare'),esc(x.telefono),'<button type="button" class="btn '+(x.checkin_effettuato?'quiet':'solid')+'" data-checkin="'+esc(x.id)+'">'+(x.checkin_effettuato?'✓ Presente · annulla':'Segna presente')+'</button>'])))).join('');
}
async function changeCheckin(id){
 if(mutation)return;
 const t=temp.control?.trip,b=temp.control?.bookings?.find(x=>x.id===id);
 if(!t||!b)throw Error('Prenotazione non più disponibile. Ricarica la Control Room.');
 const next=!b.checkin_effettuato;
 if(!confirm((next?'Confermi il check-in':'Vuoi annullare il check-in')+' per '+nameBooking(b)+'?'+
 '\nViaggio: '+nameTrip(t)+'\nFermata: '+(b.fermata_partenza||'non indicata')+
 '\nNon saranno modificati posti o quote.'))return;
 mutation=true;
 try{
  await authorize();
  const fields={checkin_effettuato:next,checkin_stato:next?'Presente':'Da effettuare',
    checked_in_at:next?new Date().toISOString():null,checkin_fermata:next?(b.fermata_partenza||null):null,
    checkin_operatore:next?operator:null};
  const q=new URLSearchParams({id:'eq.'+b.id,viaggio_id:'eq.'+t.id,select:'id,checkin_effettuato'});
  const rows=await raw('/rest/v1/prenotazioni?'+q.toString(),'PATCH',fields);
  if(!Array.isArray(rows)||rows.length!==1||rows[0].checkin_effettuato!==next)
    throw Error('La modifica potrebbe essere stata eseguita: verifica lo stato prima di riprovare.');
  invalidate('bookings');
  const fresh=await load('bookings',true);
  const current=await load('trips').then(ts=>ts.find(x=>x.id===t.id));
  if(!current)throw Error('Viaggio non trovato dopo il salvataggio.');
  $('control-detail').innerHTML=await controlDetail(current);
  notice('Check-in '+(next?'registrato':'annullato')+' per '+nameBooking(b)+'.');
 }catch(e){notice('Check-in da verificare: '+errorMsg(e),'bad')}
 finally{mutation=false}
}
function modal(title,html){$('modal-title').textContent=title;$('modal-body').innerHTML=html;$('modal').hidden=false}
function closeModal(){$('modal').hidden=true;$('modal-body').innerHTML=''}
function cashPayForm(rental=false){
 if(mutation)return;
 const formName=rental?'rental-form':'payment-form';
 Promise.all([load(rental?'rentals':'trips'),load(rental?'rentalPayments':'bookings')]).then(([items,bs])=>{
  if(rental)temp.payment={rental:true,rentals:items,bookings:bs};
  else temp.payment={rental:false,trips:items,bookings:bs};
  const choices=items.map(x=>({id:x.id,label:dateIT(x.data_partenza)+' · '+(rental?(x.referente||x.azienda||'Noleggio'):nameTrip(x))}));
  const selection='<label>'+(rental?'Noleggio':'Viaggio')+'<select id="pay-ref" required>'+options(choices,'','Seleziona')+'</select></label>';
  const bselect=rental?'':'<label>Prenotazione / cliente<select id="pay-book" required><option value="">Seleziona prima il viaggio</option></select></label>';
  modal(rental?'Pagamento noleggio autobus':'Nuovo acconto, saldo o rimborso','<form id="'+formName+'"><div class="fields">'+selection+bselect+
   '<label>Tipo<select id="pay-type"><option value="Acconto">Acconto</option><option value="Saldo">Saldo</option><option value="Rimborso">Rimborso</option></select></label>'+
   '<label>Importo in euro<input id="pay-amount" type="text" inputmode="decimal" placeholder="20,00" required></label>'+
   '<label>Metodo<select id="pay-method"><option>Contanti</option><option>POS</option><option>Bonifico</option><option>Altro</option></select></label>'+
   '<label>Data<input id="pay-date" type="date" required value="'+today()+'"></label>'+
   '<label>Note<input id="pay-note" maxlength="200" placeholder="Facoltative"></label></div>'+
   '<div id="pay-context" class="notice warn">Seleziona la prenotazione prima di registrare.</div>'+
   '<button class="btn solid" type="submit">Conferma registrazione ufficiale</button></form>');
  updatePayChoices();
 }).catch(e=>notice('Impossibile preparare il pagamento: '+errorMsg(e),'bad'));
}
function updatePayChoices(){
 const data=temp.payment;if(!data)return;
 if(!data.rental){
  const id=$('pay-ref')?.value||'',list=data.bookings.filter(b=>b.viaggio_id===id&&validBooking(b));
  if($('pay-book'))$('pay-book').innerHTML=options(list.map(b=>({id:b.id,label:nameBooking(b)+' · '+b.posti+' persone · residuo '+money(b.saldo)})),'','Seleziona prenotazione');
 }
 const b=data.rental?data.rentals.find(x=>x.id===$('pay-ref')?.value):data.bookings.find(x=>x.id===$('pay-book')?.value);
 if($('pay-context'))$('pay-context').textContent=b?(data.rental?'Noleggio: '+(b.referente||b.azienda)+' · saldo indicato '+money(b.saldo):'Prenotazione '+nameBooking(b)+' · pagato '+money(b.pagato)+' · residuo '+money(b.saldo)):'Seleziona il riferimento corretto.';
}
function amountFrom(v){
 const s=txt(v).replace(/\s/g,'').trim();if(!/^\d{1,7}([,.]\d{1,2})?$/.test(s))throw Error('Importo non valido (es. 20,00)');
 const num=Number(s.replace(',','.'));if(!Number.isFinite(num)||num<=0||num>100000)throw Error('Importo fuori limite');
 return Math.round(num*100)/100;
}
async function registerPayment(ev){
 ev.preventDefault();if(mutation||unsafeRetry)return;
 const source=temp.payment;if(!source)throw Error('Sorgente pagamento mancante');
 let sent=false,button=ev.target.querySelector('button[type=submit]');
 try{
  const ref=source.rental?$('pay-ref').value:$('pay-book').value;
  const current=(source.rental?source.rentals:source.bookings).find(x=>x.id===ref);
  if(!current)throw Error('Scegli una prenotazione o un noleggio.');
  const type=$('pay-type').value,amount=amountFrom($('pay-amount').value),method=$('pay-method').value,date=$('pay-date').value,note=$('pay-note').value.trim();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Data pagamento non valida');
  const label=source.rental?(current.referente||current.azienda):nameBooking(current);
  if(!confirm('REGISTRARE SU SUPABASE?\n\n'+label+'\n'+type+' · '+money(amount)+' · '+date+'\nOperatore: '+operator+'\n\nSe il salvataggio termina con errore di rete, controlla il registro prima di riprovare.'))return;
  mutation=true;button.disabled=true;notice('Registrazione in corso, non chiudere la pagina.');
  await authorize();
  const params={p_tipo:type,p_importo:amount,p_metodo:method,p_data:date,p_note:note||null};
  if(source.rental)params.p_noleggio_id=ref;else params.p_booking_id=ref;
  sent=true;
  const result=await raw('/rest/v1/rpc/'+(source.rental?'dg_register_rental_payment':'dg_register_payment'),'POST',params);
  if(!result?.payment_id)throw Error('La risposta non contiene il numero del pagamento. Controlla il registro prima di riprovare.');
  const table=source.rental?'noleggi_bus_pagamenti':'pagamenti';
  const q=new URLSearchParams({select:'id,receipt_number,importo',id:'eq.'+result.payment_id,limit:'1'});
  const verified=await raw('/rest/v1/'+table+'?'+q);
  if(!Array.isArray(verified)||verified.length!==1)throw Error('Il pagamento potrebbe essere registrato: controlla il registro prima di riprovare.');
  const receipt=result.receipt_number||verified[0].receipt_number||'(in emissione)';
  invalidate('payments','bookings','rentalPayments','rentals');
  closeModal();
  mutation=false;unsafeRetry=false;
  await navigate(source.rental?'rentals':'accounting');
  notice('Incasso verificato in Supabase: '+money(amount)+' · ricevuta '+receipt+'.');
 }catch(e){
  if(sent){unsafeRetry=true;notice('ATTENZIONE: '+errorMsg(e)+' Il salvataggio potrebbe essere riuscito. Vai nel registro e verifica prima di un nuovo invio.','bad');closeModal();}
  else notice('Pagamento non inviato: '+errorMsg(e),'bad');
 }finally{mutation=false;if(button)button.disabled=false}
}
async function formCustomer(ev){
 ev.preventDefault();if(mutation)return;
 const body={nome:$('new-name').value.trim(),cognome:$('new-surname').value.trim(),telefono:$('new-phone').value.trim()||null,email:$('new-email').value.trim()||null};
 if(!body.nome||!body.cognome)throw Error('Nome e cognome necessari.');
 if(!confirm('Creare la scheda cliente '+body.nome+' '+body.cognome+'?'))return;
 mutation=true;try{
  await authorize();
  const res=await raw('/rest/v1/clienti','POST',body);
  if(!res)throw Error('Creazione cliente non confermata.');
  invalidate('customers');closeModal();notice('Cliente registrato.');await navigate('customers');
 }catch(e){notice('Verifica se il cliente è stato inserito: '+errorMsg(e),'bad')}finally{mutation=false}
}
async function formAgenda(ev){
 ev.preventDefault();if(mutation)return;
 const body={titolo:$('agenda-title').value.trim(),descrizione:$('agenda-desc').value.trim(),data_scadenza:$('agenda-date').value,stato:'aperta',priorita:$('agenda-priority').value,tipo:'operativa'};
 if(!body.titolo||!body.data_scadenza)throw Error('Titolo e scadenza necessari');
 if(!confirm('Registrare la scadenza '+body.titolo+'?'))return;
 mutation=true;try{
  await authorize();
  const res=await raw('/rest/v1/scadenze_gestionale','POST',body);
  if(!res)throw Error('Salvataggio non confermato.');
  invalidate('agenda');closeModal();notice('Scadenza registrata.');await navigate('agenda');
 }catch(e){notice('Verifica se la scadenza è stata registrata: '+errorMsg(e),'bad')}finally{mutation=false}
}
function csv(rows,name){
 const safe=s=>{s=txt(s);if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'};
 const content='\ufeff'+rows.map(r=>r.map(safe).join(';')).join('\r\n');
 const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download='DELGROSSO_'+name+'_'+today()+'.csv';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),12000);
}
function printCurrent(){window.print()}
function handleAction(action){
 if(action==='retry')return navigate(page);
 if(action==='control-pdf'||action==='control-pdf-sunday'){
  if(!window.DG37Layouts)return notice('Modulo PDF non caricato.','bad');
  if(action==='control-pdf')window.DG37Layouts.selectedTrip=selectedTrip;
  return window.DG37Layouts.pdf(action==='control-pdf'?'trip':'sunday').then(f=>notice('Scaricato '+f)).catch(e=>notice('Errore PDF: '+errorMsg(e),'bad'));
 }
 if(action==='accounting-pdf-nicola'||action==='accounting-pdf-raffaele'){
  const key=action.endsWith('nicola')?'nicola':'raffaele',profile=temp.accounting?.model?.profiles?.[key];
  if(!profile||!window.DG2Pdf?.saveOperatorPdf)return notice('Ricarica la contabilità e il generatore PDF.','bad');
  try{const file=window.DG2Pdf.saveOperatorPdf(profile,$('account-trip')?.value||'');notice('PDF generato: '+file)}catch(e){notice('PDF: '+errorMsg(e),'bad')}return;
 }
 if(action==='payment-form')return cashPayForm(false);
 if(action==='rental-payment-form')return cashPayForm(true);
 if(action==='accounting-print'||action==='bookings-print'||action==='control-print')return printCurrent();
 if(action==='bookings-csv'&&temp.bookings){return csv([['Cliente','Viaggio ID','Posti','Persone','Fermata','Pagato','Stato'],...temp.bookings.bookings.map(b=>[nameBooking(b),b.viaggio_id,b.posti_selezionati,b.posti,b.fermata_partenza,b.pagato,b.stato])],'PRENOTAZIONI')}
 if(action==='accounting-csv'&&temp.accounting){const movements=temp.accountFiltered||Object.values(temp.accounting.model.profiles).flatMap(x=>x.movements);return csv([['Data','Operatore','Cliente','Viaggio','Importo','Metodo','Ricevuta'],...movements.map(x=>[x.date,x.who,x.client,x.trip,(x.amount/100).toFixed(2),x.method,x.receipt])],'CONTABILITA')}
 if(action==='control-csv'&&temp.control){const t=temp.control.trip;return csv([['Viaggio','Cliente','Persone','Fermata','Posti','Check-in'],...temp.control.bookings.map(b=>[nameTrip(t),nameBooking(b),b.posti,b.fermata_partenza,seatIds(b).join(','),b.checkin_effettuato?'SI':'NO'])],'CONTROL_ROOM')}
 if(action==='customer-form')return modal('Nuovo cliente','<form id="form-customer"><div class="fields"><label>Nome<input id="new-name" required maxlength="80"></label><label>Cognome<input id="new-surname" required maxlength="80"></label><label>Telefono<input id="new-phone" type="tel" maxlength="35"></label><label>Email<input id="new-email" type="email" maxlength="120"></label></div><button class="btn solid" type="submit">Salva cliente in Supabase</button></form>');
 if(action==='agenda-form')return modal('Nuova scadenza','<form id="form-agenda"><div class="fields"><label>Titolo<input id="agenda-title" required maxlength="100"></label><label>Scadenza<input id="agenda-date" type="date" required></label><label>Priorità<select id="agenda-priority"><option value="normale">Normale</option><option value="alta">Alta</option></select></label><label>Descrizione<textarea id="agenda-desc" maxlength="500"></textarea></label></div><button class="btn solid" type="submit">Registra scadenza</button></form>');
}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.page){navigate(b.dataset.page);return}
 if(b.dataset.control){selectedTrip=b.dataset.control;navigate('control');return}
 if(b.dataset.tripLayout){window.DG37Layouts.selectedTrip=b.dataset.tripLayout;navigate('layouts');return}
 if(b.dataset.checkin){changeCheckin(b.dataset.checkin).catch(e=>notice(errorMsg(e),'bad'));return}
 if(b.dataset.action){try{handleAction(b.dataset.action)}catch(err){notice(errorMsg(err),'bad')}}
});
document.addEventListener('change',e=>{
 if(e.target.id==='book-trip')applyBookingsFilter();
 if(e.target.id==='account-who'||e.target.id==='account-trip')applyAccountingFilter();
 if(e.target.id==='control-trip'){selectedTrip=e.target.value;navigate('control')}
 if(e.target.id==='pay-ref'||e.target.id==='pay-book')updatePayChoices()
});
document.addEventListener('input',e=>{
 if(e.target.id==='book-search')applyBookingsFilter();
 if(e.target.id==='account-search')applyAccountingFilter();
 if(e.target.id==='customers-search'){
  const q=txt(e.target.value).toLowerCase();$('customers-results').innerHTML=customerRows((temp.customers||[]).filter(c=>[c.nome,c.cognome,c.telefono,c.email].some(v=>txt(v).toLowerCase().includes(q))))
 }
});
document.addEventListener('submit',e=>{
 const id=e.target.id;
 if(id==='payment-form'||id==='rental-form'){registerPayment(e).catch(err=>notice(errorMsg(err),'bad'));return}
 if(id==='form-customer'){formCustomer(e).catch(err=>notice(errorMsg(err),'bad'));return}
 if(id==='form-agenda'){formAgenda(e).catch(err=>notice(errorMsg(err),'bad'));return}
});
$('login-form').addEventListener('submit',login);
$('refresh').addEventListener('click',()=>{invalidate(...Object.keys(COL));navigate(page)});
$('logout').addEventListener('click',logout);
$('close-modal').addEventListener('click',closeModal);
$('modal').addEventListener('click',e=>{if(e.target===$('modal'))closeModal()});
window.DG37Layouts.init({raw,load,authorize,invalidate,notice,esc,get currentDrafts(){return temp.currentDrafts||[]},set currentDrafts(v){temp.currentDrafts=v}});
adopt();
window.DG36=Object.freeze({version:'37.0',get page(){return page}});
})();
