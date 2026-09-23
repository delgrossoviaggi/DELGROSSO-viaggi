

const SUPA_URL='https://chkuayhbmitdmzmmvona.supabase.co';
const APP_LOCAL_FILE=(location.protocol==='file:');
if(APP_LOCAL_FILE){
  window.addEventListener('load',()=>{
    const msg=$('loginMsg');
    if(msg) msg.textContent='Modalità file locale: provo comunque la connessione Supabase. Se il browser blocca la rete, usa AVVIA_GESTIONALE.bat.';
  });
}

const SUPA_KEY='sb_publishable_H29K1BV5ZE1rT8xo0PIzVA_wF6zC7je';
let authSession=null;
let currentOperator={username:'nicola',name:'Nicola',role:'Amministratore'};
const state={
  page:'dashboard',online:false,
  viaggi:[],prenotazioni:[],clienti:[],pagamenti:[],flotta:[],notifiche:[],
  checkin:[],preventivi:[],impostazioni:[],
  noleggi:[],noleggiMezzi:[],noleggiPagamenti:[],
  prenotazionePosti:[],attivita:[],scadenze:[],audit:[]
};
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const money=n=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(n)||0);
const dateIT=s=>s?new Date(s+'T12:00:00').toLocaleDateString('it-IT',{day:'2-digit',month:'short',year:'numeric'}):'—';
function toast(msg,ok=true){$('toast').textContent=msg;$('toast').style.background=ok?'#102b44':'#9f1239';$('toast').classList.add('on');setTimeout(()=>$('toast').classList.remove('on'),3200)}
function log(msg){const d=document.createElement('div');d.className='log-item';d.textContent=new Date().toLocaleTimeString('it-IT')+' — '+msg;$('diagLog')?.prepend(d)}
function accessHeaders(){
  return {
    apikey:SUPA_KEY,
    Authorization:'Bearer '+(authSession?.access_token||SUPA_KEY),
    Accept:'application/json',
    'Content-Type':'application/json',
    'Prefer':'return=representation'
  };
}
async function parseResponse(r){
  const txt=await r.text(); let data;
  try{data=txt?JSON.parse(txt):null}catch{data=txt}
  return {ok:r.ok,status:r.status,data};
}
async function refreshAuth(){
  const rt=authSession?.refresh_token;
  if(!rt) return false;
  const r=await fetch(`${SUPA_URL}/auth/v1/token?grant_type=refresh_token`,{
    method:'POST',headers:{apikey:SUPA_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({refresh_token:rt})
  });
  const out=await parseResponse(r);
  if(!out.ok || !out.data?.access_token) return false;
  authSession=out.data;
  sessionStorage.setItem('dg_auth',JSON.stringify(authSession));
  return true;
}
async function api(table,query='',opts={}){
  const make=()=>fetch(`${SUPA_URL}/rest/v1/${table}${query?'?'+query:''}`,{
    method:opts.method||'GET',headers:{...accessHeaders(),...(opts.headers||{})},
    body:opts.body?JSON.stringify(opts.body):undefined,cache:'no-store'
  });
  let out=await parseResponse(await make());
  if(out.status===401 && authSession?.refresh_token){
    if(await refreshAuth()) out=await parseResponse(await make());
  }
  if(!out.ok) throw new Error(`${table}: HTTP ${out.status} ${out.data?.message||out.data?.hint||out.data||''}`);
  return out.data;
}
async function rpc(name,body){
  const make=()=>fetch(`${SUPA_URL}/rest/v1/rpc/${name}`,{method:'POST',headers:accessHeaders(),body:JSON.stringify(body||{})});
  let out=await parseResponse(await make());
  if(out.status===401&&authSession?.refresh_token){if(await refreshAuth())out=await parseResponse(await make())}
  if(!out.ok)throw new Error(`RPC ${name}: HTTP ${out.status} ${out.data?.message||out.data?.hint||out.data||''}`);
  return out.data;
}
async function signIn(username,password){
  const u=username.trim().toLowerCase();
  const operators={nicola:{email:'nicola@delgrossoviaggi.it',name:'Nicola'},raffaele:{email:'nicola@delgrossoviaggi.it',name:'Raffaele'}};
  const op=operators[u]||null;
  const email=op?op.email:u;
  if(op) currentOperator={username:u,name:op.name,role:'Amministratore'};
  const r=await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`,{
    method:'POST',headers:{apikey:SUPA_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({email,password})
  });
  const out=await parseResponse(r);
  if(!out.ok || !out.data?.access_token) throw new Error(out.data?.error_description||out.data?.msg||'Credenziali non valide');
  authSession=out.data;
  sessionStorage.setItem('dg_auth',JSON.stringify(authSession));
  sessionStorage.setItem('dg_login','1');
  return out.data;
}
async function signOut(){
  try{
    if(authSession?.access_token) await fetch(`${SUPA_URL}/auth/v1/logout`,{
      method:'POST',headers:{apikey:SUPA_KEY,Authorization:'Bearer '+authSession.access_token}
    });
  }catch{}
  stopAutoSync();
  authSession=null;
  sessionStorage.removeItem('dg_auth');sessionStorage.removeItem('dg_login');
  $('app').classList.remove('on');$('login').style.display='grid';
}
async function health(){
  try{
    // Primo controllo: endpoint ufficiale Auth. Non usiamo una tabella come "ping",
    // altrimenti un problema di RLS/schema viene mostrato erroneamente come OFFLINE.
    const hr=await fetch(`${SUPA_URL}/auth/v1/health`,{headers:{apikey:SUPA_KEY},cache:'no-store'});
    if(!hr.ok) throw new Error(`Auth API HTTP ${hr.status}`);
    // Secondo controllo: REST autenticato. Qui distinguiamo rete/Auth da database/RLS.
    await api('viaggi','select=id&limit=1');
    state.online=true;setStatus('live');log('Supabase raggiungibile: Auth + REST operativi');return true;
  }catch(e){
    state.online=false;
    const msg=String(e?.message||e);
    if(/HTTP 401|HTTP 403/.test(msg)) setStatus('auth',msg);
    else if(/viaggi: HTTP/.test(msg)) setStatus('degraded','Supabase raggiungibile, ma la tabella viaggi non è leggibile');
    else setStatus('off',msg);
    log('STATO SUPABASE: '+msg);return false;
  }
}
function setStatus(kind,msg=''){
  const ok=kind===true||kind==='live';
  const degraded=kind==='degraded';
  const auth=kind==='auth';
  const e=$('connectionStatus');
  if(e){
    e.className='statusline '+(ok?'live':(degraded||auth?'warn':'off'));
    e.textContent=ok?'● Supabase connesso e operativo':degraded?'● Supabase ONLINE · dati non accessibili':auth?'● Supabase ONLINE · autenticazione da verificare':'● Supabase OFFLINE'+(msg?' — '+msg:'');
  }
  const p=$('syncPill');
  if(p){
    p.className='sync-pill '+(ok?'live':(degraded||auth?'warn':'off'));
    p.textContent=ok?'● Supabase LIVE':degraded?'● Supabase ONLINE / DATI':auth?'● Supabase AUTH':'● Supabase OFFLINE';
    p.title=msg||'';
  }
}

let autoSyncTimer=null;
let syncBusy=false;
function markSynced(){const now=new Date();const txt=now.toLocaleString('it-IT',{dateStyle:'short',timeStyle:'medium'});const e=$('lastSync');if(e)e.textContent='Ultima sincronizzazione: '+txt;localStorage.setItem('dg_last_sync',txt)}
async function syncIntegrity(){if(syncBusy)return;syncBusy=true;try{const r=await rpc('sync_gestionale_integrity',{});log('Integrità Supabase: '+JSON.stringify(r));toast(`Integrità sincronizzata · ${r?.prenotazioni_sincronizzate??0} prenotazioni · ${r?.viaggi_sincronizzati??0} viaggi`);await loadAll()}catch(e){toast('Sincronizzazione integrità fallita: '+e.message,false);log('INTEGRITÀ: '+e.message)}finally{syncBusy=false}}
function startAutoSync(){if(autoSyncTimer)clearInterval(autoSyncTimer);autoSyncTimer=setInterval(async()=>{if(document.visibilityState==='visible' && authSession && !syncBusy) await loadAll()},20000);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible' && authSession && !syncBusy)loadAll()},{passive:true})}
function stopAutoSync(){if(autoSyncTimer)clearInterval(autoSyncTimer);autoSyncTimer=null}

function go(page){window.scrollTo({left:0,top:0,behavior:'instant'});document.documentElement.scrollLeft=0;document.body.scrollLeft=0;document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));$('page-'+page)?.classList.add('active');document.querySelectorAll('#sideNav button').forEach(b=>b.classList.toggle('active',b.dataset.page===page));state.page=page;renderPage(page);history.replaceState(null,'','#'+page)}
window.go=go;
async function loadAll(){
  try{
    const [
      v,p,c,pa,f,n,ch,q,settings,nb,nbm,nbp,pp,att,sc,audit,docs
    ]=await Promise.all([
      api('viaggi','select=*&order=data_partenza.asc'),
      api('prenotazioni','select=*&order=created_at.desc'),
      api('clienti','select=*&order=created_at.desc'),
      api('pagamenti','select=*&order=data_pagamento.desc,created_at.desc'),
      api('flotta','select=*&order=marca.asc'),
      api('notifiche','select=*&order=created_at.desc'),
      api('accessi_checkin','select=*&order=created_at.desc'),
      api('preventivi','select=*&order=created_at.desc'),
      api('impostazioni','select=*&order=created_at.desc'),
      api('noleggi_bus','select=*&order=data_partenza.asc'),
      api('noleggi_bus_mezzi','select=*&order=created_at.desc'),
      api('noleggi_bus_pagamenti','select=*&order=data_pagamento.desc,created_at.desc'),
      api('prenotazione_posti','select=*&order=created_at.desc'),
      api('attivita_gestionale','select=*&order=created_at.desc'),
      api('scadenze_gestionale','select=*&order=data_scadenza.asc'),
      api('audit_log_gestionale','select=*&order=created_at.desc&limit=100')
    ]);
    Object.assign(state,{
      viaggi:v||[],prenotazioni:p||[],clienti:c||[],pagamenti:pa||[],flotta:f||[],
      notifiche:n||[],checkin:ch||[],preventivi:q||[],impostazioni:settings||[],
      noleggi:nb||[],noleggiMezzi:nbm||[],noleggiPagamenti:nbp||[],
      prenotazionePosti:pp||[],attivita:att||[],scadenze:sc||[],audit:audit||[],online:true,archivioDocumenti:[]
    });
    setStatus('live');markSynced();renderPage(state.page);updateBadge();initFleetCarousels();
    try{localStorage.setItem('dg_state_cache',JSON.stringify({ts:Date.now(),data:{viaggi:state.viaggi,prenotazioni:state.prenotazioni,clienti:state.clienti,pagamenti:state.pagamenti,flotta:state.flotta,notifiche:state.notifiche,checkin:state.checkin,preventivi:state.preventivi,impostazioni:state.impostazioni,noleggi:state.noleggi,noleggiMezzi:state.noleggiMezzi,noleggiPagamenti:state.noleggiPagamenti,prenotazionePosti:state.prenotazionePosti,attivita:state.attivita,scadenze:state.scadenze,audit:state.audit}}));}catch{}
    log(`Sincronizzazione completa: ${state.viaggi.length} viaggi · ${state.prenotazioni.length} prenotazioni · ${state.clienti.length} clienti · ${state.pagamenti.length} pagamenti · ${state.flotta.length} mezzi · ${state.noleggi.length} noleggi`);
  }catch(e){
    state.online=false;
    setStatus(/HTTP 401|HTTP 403/.test(String(e.message))?'auth':(/viaggi: HTTP/.test(String(e.message))?'degraded':'off'),e.message);
    log('Sincronizzazione fallita: '+e.message);
    // Mantiene disponibili gli ultimi dati validamente sincronizzati, marcandoli come cache.
    try{const raw=localStorage.getItem('dg_state_cache');if(raw){const c=JSON.parse(raw);if(c?.data)Object.assign(state,c.data);renderPage(state.page);initFleetCarousels();toast('Supabase non disponibile: visualizzati gli ultimi dati sincronizzati.',false);return}}catch{}
    toast('Sincronizzazione Supabase fallita: '+e.message,false);
  }
}
function updateBadge(){$('notifBadge').textContent=state.notifiche.filter(n=>!n.letto).length}
function renderPage(p){
  if(p==='dashboard')renderDashboard();
  if(p==='viaggi')renderTrips();
  if(p==='prenotazioni')renderBookings();
  if(p==='preventivi')renderQuotes();
  if(p==='clienti')renderClients();
  if(p==='pagamenti')renderPayments();
  if(p==='operativo')renderOperativo();
  if(p==='noleggi')renderRentals();
  if(p==='flotta')renderFleet();
  if(p==='comunicazioni')renderNotifications();
  if(p==='documenti')renderDocs();
  if(p==='statistiche')renderStats();
  if(p==='agenda')renderAgenda();
  if(p==='controlroom')renderControlRoom();
  if(p==='economia')renderEconomia();
  if(p==='backup')renderBackup();
}
function renderDashboard(){
 const total=state.viaggi.length, bookings=state.prenotazioni.length, clients=state.clienti.length, pays=state.pagamenti.length, fleet=state.flotta.length;
 const future=state.viaggi.filter(v=>v.data_partenza && new Date(v.data_partenza+'T23:59:00')>=new Date()).slice(0,4);
 $('dashMetrics').innerHTML=[
  ['🚌',total,'Viaggi','+ questo mese'],['👥',bookings,'Prenotazioni','+ questo mese'],['👤',clients,'Clienti','+ questo mese'],['💳',pays,'Pagamenti','+ questo mese'],['🚍',fleet,'Mezzi in flotta','Operativi'],['📅',future.length,'Prossime partenze','Questa settimana']
 ].map(x=>`<div class="metric"><div class="top"><div class="mi">${x[0]}</div><div><b>${x[1]}</b><small>${x[2]}</small></div></div><div class="trend">${x[3]} ↗</div></div>`).join('');
 $('nextTrips').innerHTML=future.length?future.map(v=>`<div class="list-row"><div class="datebox">${new Date(v.data_partenza+'T12:00:00').toLocaleDateString('it-IT',{day:'2-digit',month:'short'}).toUpperCase()}</div><div class="row-main"><strong>${esc(v.titolo||v.destinazione)}</strong><small>${dateIT(v.data_partenza)} · ${esc(v.id_viaggio||'')}</small></div><span class="pill ${v.stato==='SOLD OUT'?'danger':'info'}">${esc(v.stato||'Programmato')}</span></div>`).join(''):'<div class="empty">Nessun viaggio programmato.</div>';
 $('lastBookings').innerHTML=state.prenotazioni.slice(0,4).map(b=>`<div class="list-row"><div class="avatar" style="width:35px;height:35px;font-size:12px">${esc((b.cliente||'?').slice(0,1))}</div><div class="row-main"><strong>${esc(b.cliente)}</strong><small>${esc(tripName(b.viaggio_id))} · ${b.posti||0} posti · ${money(b.totale)}</small></div><span class="pill ${b.stato==='In attesa'?'wait':'ok'}">${esc(b.stato||'Confermata')}</span></div>`).join('')||'<div class="empty">Nessuna prenotazione.</div>';
 $('quickPay').innerHTML=`<div class="field"><label>Seleziona prenotazione</label><select id="dashPayBooking">${bookingOptions()}</select></div><div class="form-grid"><div class="field"><label>Tipo</label><select id="dashPayType"><option>Acconto</option><option>Saldo</option><option>Rimborso</option></select></div><div class="field"><label>Importo €</label><input id="dashPayAmount" type="number" step=".01"></div></div><button class="btn btn-green" style="width:100%" onclick="quickPayment()">✓ Registra pagamento</button>`;
 $('fleetStatus').innerHTML=state.flotta.slice(0,5).map(f=>`<div class="list-row"><div class="row-main"><strong>${esc((f.titolo||f.marca+' '+f.modello))}</strong><small>${f.posti||0} posti</small></div><span class="pill ${f.stato==='Disponibile'||f.stato==='Operativo'?'ok':'neutral'}">${esc(f.stato||'Disponibile')}</span></div>`).join('')||'<div class="empty">Flotta vuota.</div>';
 $('alerts').innerHTML=state.notifiche.slice(0,5).map(n=>`<div class="list-row"><div class="row-main"><strong>${esc(n.titolo)}</strong><small>${esc(n.messaggio)}</small></div><small>${dateIT((n.created_at||'').slice(0,10))}</small></div>`).join('')||'<div class="empty">Nessun avviso.</div>';
 const income=state.pagamenti.filter(p=>p.tipo!=='Rimborso').reduce((s,p)=>s+Number(p.importo||0),0), seats=state.prenotazioni.reduce((s,b)=>s+Number(b.posti||0),0), cap=state.viaggi.reduce((s,v)=>s+Number(v.posti_totali||0),0);
 $('quickStats').innerHTML=`<div><b>${money(income)}</b><small>Incasso</small></div><div><b>${seats}</b><small>Posti</small></div><div><b>${cap?Math.round(seats/cap*100):0}%</b><small>Occupazione</small></div><div><b>${state.viaggi.filter(v=>v.stato==='SOLD OUT').length}</b><small>Sold out</small></div>`;
}
function tripName(id){const v=state.viaggi.find(x=>x.id===id);return v?.titolo||v?.destinazione||'—'}
function bookingOptions(){return '<option value="">Seleziona...</option>'+state.prenotazioni.map(b=>`<option value="${b.id}">${esc(b.cliente)} · ${esc(b.codice||b.id?.slice(0,8))} · ${esc(tripName(b.viaggio_id))}</option>`).join('')}
function paymentClientOptions(selected=''){const names=[...new Set(state.prenotazioni.map(b=>String(b.cliente||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'it'));return '<option value="">Seleziona cliente...</option>'+names.map(n=>`<option value="${esc(n)}" ${n===selected?'selected':''}>${esc(n)}</option>`).join('')}
function paymentTripOptions(selected=''){return '<option value="">Seleziona viaggio...</option>'+state.viaggi.slice().sort((a,b)=>String(a.data_partenza||'').localeCompare(String(b.data_partenza||''))).map(v=>`<option value="${v.id}" ${v.id===selected?'selected':''}>${esc(v.titolo||v.destinazione||'Viaggio')} · ${dateIT(v.data_partenza)} · ${money(v.prezzo)}</option>`).join('')}
function paymentBookingOptions(client='',tripId='',selected=''){const rows=state.prenotazioni.filter(b=>(!client||String(b.cliente||'').trim()===client)&&(!tripId||b.viaggio_id===tripId));return '<option value="">'+(rows.length?'Seleziona prenotazione...':'Nessuna prenotazione per cliente/viaggio')+'</option>'+rows.map(b=>`<option value="${b.id}" ${b.id===selected?'selected':''}>${esc(b.codice||b.id?.slice(0,8))} · ${b.posti||0} posti · Totale ${money(b.totale)}</option>`).join('')}
function syncPaymentBookings(){const client=$('p_client')?.value||'',trip=$('p_trip')?.value||'',current=$('p_booking')?.value||'';if($('p_booking')){$('p_booking').innerHTML=paymentBookingOptions(client,trip,current);const rows=state.prenotazioni.filter(b=>(!client||String(b.cliente||'').trim()===client)&&(!trip||b.viaggio_id===trip));if(rows.length===1)$('p_booking').value=rows[0].id;}updatePaySummary()}
function renderTrips(){
 const q=($('tripSearch')?.value||'').toLowerCase(), st=$('tripStatus')?.value||'';
 const rows=state.viaggi.filter(v=>(!q||JSON.stringify(v).toLowerCase().includes(q))&&(!st||v.stato===st));
 $('tripsTable').innerHTML=rows.map(v=>`<tr><td>${dateIT(v.data_partenza)}</td><td><b>${esc(v.titolo)}</b><br><small>${esc(v.id_viaggio||v.destinazione)}</small></td><td>${esc(v.luogo_partenza||'—')} ${v.ora_partenza||''}</td><td>${v.posti_occupati||0}/${v.posti_totali||0}</td><td>${money(v.prezzo)}</td><td><span class="pill ${v.stato==='SOLD OUT'?'danger':v.stato==='Confermato'?'ok':'info'}">${esc(v.stato||'Programmato')}</span></td><td><button class="btn btn-secondary btn-sm" onclick="openTripModal('${v.id}')">Modifica</button></td></tr>`).join('')||'<tr><td colspan="7" class="empty">Nessun viaggio.</td></tr>';
}
function renderBookings(){
 const q=($('bookSearch')?.value||'').toLowerCase(), st=$('bookFilter')?.value||'';
 const rows=state.prenotazioni.filter(b=>(!q||JSON.stringify(b).toLowerCase().includes(q))&&(!st||b.stato===st));
 $('bookingsTable').innerHTML=rows.map(b=>`<tr><td><b>${esc(b.codice||b.id?.slice(0,8))}</b></td><td>${esc(b.cliente)}<br><small>${esc(b.telefono||'')}</small></td><td>${esc(tripName(b.viaggio_id))}</td><td>${b.posti||0}<br><small>${esc(b.posti_selezionati||'')}</small></td><td>${money(b.totale)}</td><td>${money(b.pagato)}</td><td>${money(b.saldo)}</td><td><span class="pill ${b.saldo>0?'wait':'ok'}">${esc(b.stato||'Confermata')}</span></td><td><button class="btn btn-secondary btn-sm" onclick="openBookingModal('${b.id}')">Apri</button> <button class="btn btn-ghost btn-sm" onclick="printConfirmation('${b.id}')">🎫</button> <button class="btn btn-danger btn-sm" onclick="cancelBooking('${b.id}')">Annulla</button> <button class="btn btn-ghost btn-sm" onclick="deleteBooking('${b.id}')">🗑️</button></td></tr>`).join('')||'<tr><td colspan="9" class="empty">Nessuna prenotazione.</td></tr>';
}
function quoteOrigin(q){
  const o=String(q.origine||q.provenienza||q.source||q.fonte||'').toLowerCase();
  return /sito|web|website|online|form/.test(o)?'sito':'gestionale';
}
function quoteDate(q){return String(q.created_at||q.data_richiesta||q.createdAt||q.data_viaggio||'').slice(0,10)}
function quoteStatusClass(st){return st==='Accettato'?'ok':(st==='Rifiutato'||st==='Annullato'?'danger':(st==='Inviato'||st==='In lavorazione'?'info':'wait'))}
function renderQuotes(){
 const q=($('quoteSearch')?.value||'').trim().toLowerCase();
 const st=$('quoteFilter')?.value||'';
 const origin=$('quoteOrigin')?.value||'';
 const rows=state.preventivi.filter(x=>{
   const text=JSON.stringify(x).toLowerCase();
   return (!q||text.includes(q)) && (!st||String(x.stato||'Nuovo')===st) && (!origin||quoteOrigin(x)===origin);
 }).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
 const siteCount=state.preventivi.filter(x=>quoteOrigin(x)==='sito').length;
 const newCount=state.preventivi.filter(x=>String(x.stato||'Nuovo')==='Nuovo').length;
 const openCount=state.preventivi.filter(x=>['Nuovo','In lavorazione','Inviato'].includes(String(x.stato||'Nuovo'))).length;
 $('quoteSummary').innerHTML=[['📥','Richieste dal sito',siteCount],['🆕','Nuove',newCount],['📋','In gestione',openCount]].map(x=>`<div class="module-card"><h3>${x[0]} ${x[1]}</h3><b style="font-size:25px">${x[2]}</b></div>`).join('');
 $('quotesTable').innerHTML=rows.map(x=>{
   const name=[x.nome,x.cognome].filter(Boolean).join(' ')||x.cliente||'—';
   const date=quoteDate(x);
   const trip=[x.luogo_partenza,x.destinazione].filter(Boolean).join(' → ')||'—';
   const originLabel=quoteOrigin(x)==='sito'?'🌐 Sito':'🖥️ Gestionale';
   const status=String(x.stato||'Nuovo');
   return `<tr><td>${date?dateIT(date):'—'}</td><td><b>${esc(x.numero_preventivo||x.codice||x.id?.slice(0,8)||'—')}</b><br><small>${originLabel}</small></td><td><b>${esc(name)}</b></td><td>${esc(x.telefono||'—')}<br><small>${esc(x.email||'')}</small></td><td>${esc(x.servizio||'—')}</td><td>${esc(trip)}<br><small>${x.data_viaggio?dateIT(x.data_viaggio):'data da definire'}</small></td><td>${Number(x.numero_passeggeri||x.passeggeri||1)}</td><td>${money(x.importo_preventivo??x.importo??0)}</td><td><span class="pill ${quoteStatusClass(status)}">${esc(status)}</span></td><td><button class="btn btn-secondary btn-sm" onclick="openQuoteModal('${x.id}')">Apri</button> ${x.convertito_prenotazione_id?`<span class="pill ok">✓ Convertito</span>`:(status!=='Rifiutato'&&status!=='Annullato'?`<button class="btn btn-green btn-sm" onclick="openQuoteConvertModal('${x.id}')">🎫 Converti</button>`:'')} <button class="btn btn-ghost btn-sm" onclick="updateQuoteStatus('${x.id}','In lavorazione')">▶ Prendi in carico</button> <button class="btn btn-danger btn-sm" onclick="deleteQuote('${x.id}')">🗑️</button></td></tr>`;
 }).join('')||'<tr><td colspan="10" class="empty">Nessuna richiesta/preventivo trovato.</td></tr>';
}

function renderClients(){
 const q=($('clientSearch')?.value||'').toLowerCase();const rows=state.clienti.filter(c=>!q||`${c.nome} ${c.cognome} ${c.telefono} ${c.email}`.toLowerCase().includes(q));
 $('clientsTable').innerHTML=rows.map(c=>`<tr><td>${esc(c.codice_cliente||c.id?.slice(0,8))}</td><td><b>${esc(c.nome)} ${esc(c.cognome)}</b></td><td>${esc(c.telefono||'—')}</td><td>${esc(c.email||'—')}</td><td>${esc(c.citta||'—')}</td><td><span class="pill ok">${esc(c.stato_cliente||'Attivo')}</span></td><td><button class="btn btn-secondary btn-sm" onclick="openClientModal('${c.id}')">Modifica</button></td></tr>`).join('')||'<tr><td colspan="7" class="empty">Nessun cliente.</td></tr>';
}
function renderPayments(){
 const inc=state.pagamenti.filter(p=>p.tipo!=='Rimborso').reduce((s,p)=>s+Number(p.importo||0),0), refunds=state.pagamenti.filter(p=>p.tipo==='Rimborso').reduce((s,p)=>s+Number(p.importo||0),0), today=state.pagamenti.filter(p=>p.data_pagamento===new Date().toISOString().slice(0,10)).reduce((s,p)=>s+Number(p.importo||0),0);
 $('paymentSummary').innerHTML=[['💶','Incassato',money(inc)],['🔴','Rimborsi',money(refunds)],['📅','Oggi',money(today)]].map(x=>`<div class="module-card"><h3>${x[0]} ${x[1]}</h3><b style="font-size:25px">${x[2]}</b></div>`).join('');
 $('paymentsTable').innerHTML=state.pagamenti.map(p=>{
   const b=state.prenotazioni.find(x=>x.id===p.prenotazione_id);
   const trip=tripName(p.viaggio_id||b?.viaggio_id);
   return `<tr><td>${dateIT(p.data_pagamento)}</td><td>${esc(p.receipt_number||p.ricevuta||'—')}</td><td>${esc(p.cliente||b?.cliente||'—')}</td><td>${esc(p.viaggio||trip)}</td><td><span class="pill ${p.tipo==='Rimborso'?'danger':'info'}">${esc(p.tipo)}</span></td><td>${money(p.importo)}</td><td>${esc(p.metodo_pagamento||p.metodo||'—')}</td><td>${esc(p.stato||'Registrato')} <button class="btn btn-secondary btn-sm" onclick="openEditPaymentModal('${p.id}')">✏️ Modifica</button> <button class="btn btn-ghost btn-sm" onclick="printReceipt('${p.id}')">🧾</button></td></tr>`;
 }).join('')||'<tr><td colspan="8" class="empty">Nessun pagamento.</td></tr>';
}
function renderOperativo(){
 const recent=state.checkin.slice(0,20);$('checkinList').innerHTML=recent.map(c=>`<div class="list-row"><div class="row-main"><strong>${esc(c.cliente||'—')}</strong><small>${esc(c.telefono||'')} · posto ${esc(c.posto||'—')}</small></div><span class="pill ${c.esito==='PRESENTE'?'ok':'wait'}">${esc(c.esito||'—')}</span></div>`).join('')||'<div class="empty">Nessun check-in.</div>';
 $('tasksList').innerHTML=state.attivita.filter(a=>a.stato!=='completata').slice(0,10).map(a=>`<div class="list-row"><div class="row-main"><strong>${esc(a.titolo)}</strong><small>${esc(a.descrizione||'')} · ${a.scadenza?dateIT(a.scadenza):'senza scadenza'}</small></div><span class="pill ${a.priorita==='alta'?'danger':'wait'}">${esc(a.priorita||'normale')}</span><button class="btn btn-secondary btn-sm" onclick="completeTask('${a.id}')">✓</button></div>`).join('')||'<div class="empty">Nessuna attività aperta.</div>';
 $('deadlinesList').innerHTML=state.scadenze.filter(x=>x.stato!=='completata').slice(0,10).map(a=>`<div class="list-row"><div class="row-main"><strong>${esc(a.titolo)}</strong><small>${dateIT(a.data_scadenza)} · ${esc(a.tipo||'operativa')}</small></div><span class="pill ${new Date(a.data_scadenza+'T23:59:59')<new Date()?'danger':'wait'}">${esc(a.stato||'aperta')}</span></div>`).join('')||'<div class="empty">Nessuna scadenza.</div>';
 $('operationalTrips').innerHTML=state.viaggi.slice(0,8).map(v=>`<div class="list-row"><div class="row-main"><strong>${esc(v.titolo)}</strong><small>${dateIT(v.data_partenza)} · ${v.posti_occupati||0}/${v.posti_totali||0}</small></div><button class="btn btn-secondary btn-sm" onclick="openTripDetail('${v.id}')">Control room</button></div>`).join('');
}
function renderAgenda(){
  const q=($('agendaSearch')?.value||'').trim().toLowerCase();
  const filter=$('agendaFilter')?.value||'all';
  const period=$('agendaPeriod')?.value||'all';
  const now=new Date(); now.setHours(0,0,0,0);
  const isoToday=now.toISOString().slice(0,10);
  const endWeek=new Date(now); endWeek.setDate(endWeek.getDate()+7);
  const isoWeek=endWeek.toISOString().slice(0,10);
  const isoMonth=isoToday.slice(0,7);
  const events=[];
  const add=(type,date,title,meta,status,id,extra='')=>{
    if(!date)return;
    const d=String(date).slice(0,10);
    events.push({type,date:d,title:title||'—',meta:meta||'',status:status||'',id,extra});
  };
  if(filter==='all'||filter==='viaggi') state.viaggi.forEach(v=>add('viaggi',v.data_partenza,v.titolo||v.destinazione||'Viaggio',`${v.ora_partenza||''}${v.luogo_partenza?' · '+v.luogo_partenza:''} · ${Number(v.posti_occupati||0)}/${Number(v.posti_totali||0)} posti`,v.stato,v.id));
  if(filter==='all'||filter==='noleggi') state.noleggi.forEach(r=>add('noleggi',r.data_partenza,`${r.referente||r.azienda||'Noleggio'} · ${r.tratta_partenza||'—'} → ${r.tratta_destinazione||'—'}`,`${r.ora_partenza||''} · ${r.passeggeri||0} passeggeri`,r.stato_noleggio,r.id));
  if(filter==='all'||filter==='scadenze') state.scadenze.filter(x=>x.stato!=='completata').forEach(x=>add('scadenze',x.data_scadenza,x.titolo,`${x.tipo||'Operativa'} · ${x.stato||'aperta'}`,x.stato,x.id));
  if(filter==='all'||filter==='attivita') state.attivita.filter(x=>x.stato!=='completata').forEach(x=>add('attivita',x.scadenza||isoToday,x.titolo,x.descrizione||'Attività gestionale',x.priorita,x.id));
  const matchPeriod=e=>{const d=e.date;if(period==='today')return d===isoToday;if(period==='week')return d>=isoToday&&d<=isoWeek;if(period==='month')return d.startsWith(isoMonth);if(period==='overdue')return d<isoToday;return true};
  const matchQ=e=>!q||`${e.title} ${e.meta} ${e.status}`.toLowerCase().includes(q);
  let rows=events.filter(e=>matchPeriod(e)&&matchQ(e));
  rows.sort((a,b)=>a.date.localeCompare(b.date)||a.type.localeCompare(b.type)||a.title.localeCompare(b.title,'it'));
  const counts={viaggi:events.filter(e=>e.type==='viaggi'&&matchPeriod(e)&&matchQ(e)).length,noleggi:events.filter(e=>e.type==='noleggi'&&matchPeriod(e)&&matchQ(e)).length,scadenze:events.filter(e=>e.type==='scadenze'&&matchPeriod(e)&&matchQ(e)).length,attivita:events.filter(e=>e.type==='attivita'&&matchPeriod(e)&&matchQ(e)).length};
  const overdue=events.filter(e=>e.date<isoToday&&(e.type==='scadenze'||e.type==='attivita')&&matchQ(e)).length;
  $('agendaKpis').innerHTML=[['📅',rows.length,'Eventi visualizzati'],['🚌',counts.viaggi,'Viaggi'],['🚐',counts.noleggi,'Noleggi'],['⚠️',overdue,'Scaduti']].map(x=>`<div class="agenda-kpi"><b>${x[0]} ${x[1]}</b><small>${x[2]}</small></div>`).join('');
  $('agendaCount').textContent=`${rows.length} ${rows.length===1?'evento':'eventi'}`;
  if(!rows.length){$('agendaList').innerHTML='<div class="agenda-empty">📅<br><b>Nessun evento trovato</b><br><small>Prova a cambiare filtro, periodo o ricerca.</small></div>';return;}
  let last='';
  $('agendaList').innerHTML=rows.map(e=>{
    const d=new Date(e.date+'T12:00:00'); const key=e.date; const group=key!==last?`<div class="agenda-group-title">${d.toLocaleDateString('it-IT',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}</div>`:''; last=key;
    const overdueCls=(e.date<isoToday&&e.type!=='viaggi'&&e.type!=='noleggi')?' overdue':'';
    const labels={viaggi:'🚌 Viaggio',noleggi:'🚐 Noleggio',scadenze:'⚠️ Scadenza',attivita:'✅ Attività'};
    const action=e.type==='viaggi'?`<button class="btn btn-secondary btn-sm" onclick="openTripDetail('${e.id}')">Apri</button>`:e.type==='noleggi'?`<button class="btn btn-secondary btn-sm" onclick="openRentalModal('${e.id}')">Apri</button>`:e.type==='attivita'?`<button class="btn btn-secondary btn-sm" onclick="completeTask('${e.id}')">✓</button>`:'';
    return `${group}<div class="agenda-event"><div class="agenda-date"><b>${String(d.getDate()).padStart(2,'0')}</b><small>${d.toLocaleDateString('it-IT',{month:'short'}).replace('.','')}</small></div><div><h4>${esc(e.title)}</h4><p>${esc(e.meta)}${e.status?' · '+esc(e.status):''}</p></div><div><span class="agenda-badge ${e.type}${overdueCls}">${labels[e.type]}</span>${action}</div></div>`;
  }).join('');
}

function renderControlRoom(){
  const sel=$('controlTripSelect');
  if(!sel)return;
  const current=sel.value;
  const trips=[...state.viaggi].sort((a,b)=>String(a.data_partenza||'').localeCompare(String(b.data_partenza||'')));
  sel.innerHTML=trips.map(v=>`<option value="${v.id}">${esc(v.titolo||v.destinazione||'Viaggio')} · ${dateIT(v.data_partenza)} · ${Number(v.posti_occupati||0)}/${Number(v.posti_totali||0)}</option>`).join('');
  if(current && trips.some(v=>v.id===current)) sel.value=current; else if(trips[0]) sel.value=trips[0].id;
  const v=trips.find(x=>x.id===sel.value);
  if(!v){$('controlKpis').innerHTML='<div class="empty">Nessun viaggio disponibile.</div>';$('controlSeats').innerHTML='';$('controlCheckin').innerHTML='';return;}
  const bs=state.prenotazioni.filter(b=>b.viaggio_id===v.id && !/annull|cancel/i.test(b.stato||''));
  const seats=state.prenotazionePosti.filter(x=>x.viaggio_id===v.id);
  const selected=new Set(seats.map(x=>String(x.posto)));
  const occupied=Number(v.posti_occupati||selected.size||bs.reduce((n,b)=>n+Number(b.posti||0),0));
  const capacity=Number(v.posti_totali||0);
  const free=Math.max(capacity-occupied,0);
  const check=state.checkin.filter(c=>c.viaggio_id===v.id);
  const present=check.filter(c=>String(c.esito||c.checkin_stato||'').toUpperCase()==='PRESENTE').length;
  const value=bs.reduce((n,b)=>n+Number(b.totale||0),0);
  const paid=bs.reduce((n,b)=>n+Number(b.pagato||0),0);
  const balance=bs.reduce((n,b)=>n+Math.max(Number(b.saldo||0),0),0);
  $('controlKpis').innerHTML=[
    ['👥','Prenotati',bs.reduce((n,b)=>n+Number(b.posti||0),0)],
    ['💺','Posti occupati',occupied],
    ['🟢','Posti liberi',free],
    ['💶','Valore viaggio',money(value)],
    ['💳','Incassato',money(paid)],
    ['⏳','Da incassare',money(balance)],
    ['✅','Presenti',present],
    ['📋','Prenotazioni',bs.length]
  ].map(x=>`<div class="module-card"><h3>${x[0]} ${x[1]}</h3><b style="font-size:23px">${x[2]}</b></div>`).join('');
  const grid=Array.from({length:capacity},(_,i)=>String(i+1)).map(n=>{
    const p=seats.find(x=>String(x.posto)===n);
    const b=p?bs.find(x=>x.id===p.prenotazione_id):bs.find(x=>String(x.posti_selezionati||'').split(',').map(z=>z.trim()).includes(n));
    const cls=b?'busy':'';
    return `<div class="seat ${cls}" title="${b?esc(b.cliente):'Libero'}">${n}</div>`;
  }).join('');
  $('controlSeats').innerHTML=`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><span class="pill ok">● ${occupied} occupati</span><span class="pill neutral">○ ${free} liberi</span></div><div class="seat-grid">${grid||'<div class="empty">Nessuna piantina disponibile.</div>'}</div>`;
  $('controlCheckin').innerHTML=bs.map(b=>{const c=check.find(x=>x.prenotazione_id===b.id);const presentB=b.checkin_effettuato||String(c?.esito||c?.checkin_stato||'').toUpperCase()==='PRESENTE';return `<div class="list-row"><div class="avatar" style="width:35px;height:35px;font-size:12px">${esc((b.cliente||'?').slice(0,2).toUpperCase())}</div><div class="row-main"><strong>${esc(b.cliente||'—')}</strong><small>${b.posti||0} posti · ${esc(b.posti_selezionati||'—')} · ${money(b.saldo)} residuo</small></div><span class="pill ${presentB?'ok':'wait'}">${presentB?'PRESENTE':'NON PRESENTE'}</span></div>`}).join('')||'<div class="empty">Nessun prenotato per questo viaggio.</div>';
}

function renderEconomia(){
  const payments=state.pagamenti||[];
  const bookings=state.prenotazioni.filter(b=>!/annull|cancel/i.test(b.stato||''));
  const gross=payments.filter(p=>p.tipo!=='Rimborso').reduce((n,p)=>n+Math.abs(Number(p.importo||0)),0);
  const refunds=payments.filter(p=>p.tipo==='Rimborso').reduce((n,p)=>n+Math.abs(Number(p.importo||0)),0);
  const net=gross-refunds;
  const expected=bookings.reduce((n,b)=>n+Number(b.totale||0),0);
  const paid=bookings.reduce((n,b)=>n+Number(b.pagato||0),0);
  const due=bookings.reduce((n,b)=>n+Math.max(Number(b.saldo||0),0),0);
  const methods={};
  payments.forEach(p=>{const m=p.metodo_pagamento||p.metodo||'Non specificato';const sign=p.tipo==='Rimborso'?-1:1;methods[m]=(methods[m]||0)+sign*Math.abs(Number(p.importo||0));});
  $('economyKpis').innerHTML=[['💶','Incassi lordi',money(gross)],['↩️','Rimborsi',money(refunds)],['📈','Incasso netto',money(net)],['🧾','Valore prenotazioni',money(expected)],['💳','Già pagato',money(paid)],['⏳','Da incassare',money(due)],['👥','Prenotazioni',bookings.length],['🚌','Viaggi',state.viaggi.length]].map(x=>`<div class="module-card"><h3>${x[0]} ${x[1]}</h3><b style="font-size:22px">${x[2]}</b></div>`).join('');
  const methodRows=Object.entries(methods).sort((a,b)=>b[1]-a[1]).map(([m,v])=>`<div class="list-row"><div class="row-main"><strong>${esc(m)}</strong><small>${payments.filter(p=>(p.metodo_pagamento||p.metodo||'Non specificato')===m).length} movimenti</small></div><b>${money(v)}</b></div>`).join('');
  $('economyMethods').innerHTML=methodRows||'<div class="empty">Nessun movimento registrato.</div>';
  $('economyRecent').innerHTML=payments.slice(0,20).map(p=>`<div class="list-row"><div class="row-main"><strong>${esc(p.cliente||'Cliente non indicato')}</strong><small>${dateIT(p.data_pagamento)} · ${esc(p.viaggio||tripName(p.viaggio_id))} · ${esc(p.metodo_pagamento||p.metodo||'—')}</small></div><span class="pill ${p.tipo==='Rimborso'?'danger':'ok'}">${p.tipo==='Rimborso'?'−':'+'}${money(Math.abs(Number(p.importo||0)))}</span></div>`).join('')||'<div class="empty">Nessun movimento registrato.</div>';
}

function renderRentals(){
 const q=($('rentalSearch')?.value||'').toLowerCase(), st=$('rentalStatus')?.value||'';
 const rows=state.noleggi.filter(r=>(!q||JSON.stringify(r).toLowerCase().includes(q))&&(!st||r.stato_noleggio===st));
 $('rentalsTable').innerHTML=rows.map(r=>`<tr><td><b>${esc(r.id_noleggio||r.id?.slice(0,8))}</b></td><td>${esc(r.referente||r.azienda||'—')}<br><small>${esc(r.telefono||'')}</small></td><td>${esc(r.tratta_partenza)} → ${esc(r.tratta_destinazione)}</td><td>${dateIT(r.data_partenza)}<br><small>${r.ora_partenza||''}</small></td><td>${r.passeggeri||0}</td><td>${money(r.prezzo_concordato)}</td><td>${esc(r.stato_pagamento||'Da pagare')}<br><small>Acc. ${money(r.acconto)} · Saldo ${money(r.saldo)}</small></td><td><span class="pill ${r.stato_noleggio==='Completato'?'ok':r.stato_noleggio==='Annullato'?'danger':'info'}">${esc(r.stato_noleggio||'Richiesto')}</span></td><td><button class="btn btn-secondary btn-sm" onclick="openRentalModal('${r.id}')">Apri</button></td></tr>`).join('')||'<tr><td colspan="9" class="empty">Nessun noleggio.</td></tr>';}

function renderFleet(){
 $('fleetCards').innerHTML=state.flotta.map(f=>`<div class="module-card"><img src="${esc(f.immagine||'assets/bus-bianco-reale.jpg')}" style="width:100%;height:150px;object-fit:cover;border-radius:10px"><h3 style="margin-top:10px">${esc(f.titolo||f.marca+' '+f.modello)}</h3><p>${esc(f.targa||'Targa n/d')} · ${f.posti||0} posti</p><span class="pill ${f.stato==='Disponibile'||f.stato==='Operativo'?'ok':'neutral'}">${esc(f.stato||'Disponibile')}</span> <button class="btn btn-secondary btn-sm" onclick="openFleetModal('${f.id}')">Modifica</button></div>`).join('')||'<div class="module-card"><h3>Nessun mezzo</h3><p>Aggiungi il primo mezzo della flotta.</p></div>';
}
function renderNotifications(){$('notificationsList').innerHTML=state.notifiche.map(n=>`<div class="list-row"><div class="row-main"><strong>${esc(n.titolo)}</strong><small>${esc(n.messaggio)}</small></div><span class="pill ${n.letto?'neutral':'wait'}">${n.letto?'Letta':'Nuova'}</span></div>`).join('')||'<div class="empty">Nessuna notifica.</div>'}
function renderDocs(){$('quotesList').innerHTML=state.preventivi.slice(0,10).map(q=>`<div class="list-row"><div class="row-main"><strong>${esc(q.numero_preventivo||q.codice||'Preventivo')}</strong><small>${esc(q.nome)} ${esc(q.cognome||'')} · ${esc(q.destinazione)}</small></div><b>${money(q.importo_preventivo||q.importo)}</b></div>`).join('')||'<div class="empty">Nessun preventivo.</div>'}
function renderStats(){const inc=state.pagamenti.reduce((s,p)=>s+Number(p.tipo==='Rimborso'?-Math.abs(p.importo||0):Math.abs(p.importo||0)),0), seats=state.prenotazioni.reduce((s,b)=>s+Number(b.posti||0),0), cap=state.viaggi.reduce((s,v)=>s+Number(v.posti_totali||0),0);$('statsCards').innerHTML=[['💶','Incasso netto',money(inc)],['👥','Posti prenotati',seats],['📈','Occupazione',cap?Math.round(seats/cap*100)+'%':'0%'],['🚌','Viaggi',state.viaggi.length],['🚍','Mezzi',state.flotta.length],['📋','Prenotazioni',state.prenotazioni.length]].map(x=>`<div class="module-card"><h3>${x[0]} ${x[1]}</h3><b style="font-size:24px">${x[2]}</b></div>`).join('');$('statsTrips').innerHTML=state.viaggi.map(v=>`<div class="list-row"><div class="row-main"><strong>${esc(v.titolo)}</strong><small>${dateIT(v.data_partenza)}</small></div><span>${v.posti_occupati||0}/${v.posti_totali||0} posti</span></div>`).join('')||'<div class="empty">Nessun viaggio.</div>'}

function openModal(title,body,foot){$('modalTitle').textContent=title;$('modalBody').innerHTML=body;$('modalFoot').innerHTML=foot;$('modal').classList.add('on')}
function closeModal(){$('modal').classList.remove('on')} window.closeModal=closeModal;
function openTripModal(id=''){const v=state.viaggi.find(x=>x.id===id)||{};openModal(id?'Modifica viaggio':'Nuovo viaggio',`<div class="form-grid">
<div class="field"><label>Titolo</label><input id="f_titolo" value="${esc(v.titolo||'')}"></div><div class="field"><label>Destinazione</label><input id="f_dest" value="${esc(v.destinazione||'')}"></div>
<div class="field"><label>Luogo partenza</label><input id="f_part" value="${esc(v.luogo_partenza||'')}"></div><div class="field"><label>Data</label><input id="f_date" type="date" value="${esc(v.data_partenza||'')}"></div>
<div class="field"><label>Ora</label><input id="f_time" type="time" value="${esc(v.ora_partenza||'')}"></div><div class="field"><label>Prezzo €</label><input id="f_price" type="number" step=".01" value="${v.prezzo??0}"></div>
<div class="field"><label>Posti totali</label><input id="f_seats" type="number" value="${v.posti_totali??63}"></div><div class="field"><label>Autobus</label><select id="f_bus"><option value="">Seleziona</option>${state.flotta.map(f=>`<option value="${f.id}" ${v.autobus_id===f.id?'selected':''}>${esc(f.titolo||f.marca+' '+f.modello)} · ${f.posti||0}</option>`).join('')}</select></div>
<div class="field"><label>Stato</label><select id="f_status">${['Programmato','Confermato','SOLD OUT','Annullato'].map(s=>`<option ${v.stato===s?'selected':''}>${s}</option>`).join('')}</select></div><div class="field"><label>Pubblicato</label><select id="f_pub"><option ${v.pubblicato==='SI'?'selected':''}>SI</option><option ${v.pubblicato!=='SI'?'selected':''}>NO</option></select></div>
<div class="field full"><label>Descrizione</label><textarea id="f_desc" rows="3">${esc(v.descrizione||'')}</textarea></div></div>`, `<button class="btn btn-secondary" onclick="closeModal()">Annulla</button><button class="btn btn-primary" onclick="saveTrip('${id}')">Salva viaggio</button>`)}
async function saveTrip(id){const old=id?state.viaggi.find(x=>x.id===id):null;const bus=state.flotta.find(x=>x.id===$('f_bus').value);const total=Number($('f_seats').value)||0;const occupied=Number(old?.posti_occupati||0);const body={titolo:$('f_titolo').value,destinazione:$('f_dest').value,luogo_partenza:$('f_part').value||null,data_partenza:$('f_date').value,ora_partenza:$('f_time').value||null,prezzo:Number($('f_price').value)||0,descrizione:$('f_desc').value||null,autobus_id:bus?.id||null,autobus:bus?`${bus.marca} ${bus.modello}`:null,posti_totali:total,posti_liberi:Math.max(total-occupied,0),posti_occupati:occupied,stato:$('f_status').value,pubblicato:$('f_pub').value,costo_totale:Number(old?.costo_totale||0)};try{if(id)await api('viaggi',`id=eq.${id}`,{method:'PATCH',body});else{body.id_viaggio='PR-'+String(Date.now()).slice(-4);await api('viaggi','',{method:'POST',body})}closeModal();toast('Viaggio salvato su Supabase');await loadAll()}catch(e){toast(e.message,false)}}
function openClientModal(id=''){const c=state.clienti.find(x=>x.id===id)||{};openModal(id?'Modifica cliente':'Nuovo cliente',`<div class="form-grid"><div class="field"><label>Nome</label><input id="c_nome" value="${esc(c.nome||'')}"></div><div class="field"><label>Cognome</label><input id="c_cognome" value="${esc(c.cognome||'')}"></div><div class="field"><label>Telefono</label><input id="c_tel" value="${esc(c.telefono||'')}"></div><div class="field"><label>Email</label><input id="c_email" value="${esc(c.email||'')}"></div><div class="field"><label>Codice fiscale</label><input id="c_cf" value="${esc(c.codice_fiscale||'')}"></div><div class="field"><label>Città</label><input id="c_city" value="${esc(c.citta||'')}"></div><div class="field"><label>CAP</label><input id="c_cap" value="${esc(c.cap||'')}"></div><div class="field"><label>Provincia</label><input id="c_prov" value="${esc(c.provincia||'')}"></div><div class="field full"><label>Note</label><textarea id="c_note">${esc(c.note||'')}</textarea></div></div>`,`<button class="btn btn-secondary" onclick="closeModal()">Annulla</button><button class="btn btn-primary" onclick="saveClient('${id}')">Salva cliente</button>`)}
async function saveClient(id){const body={nome:$('c_nome').value.trim(),cognome:$('c_cognome').value.trim(),telefono:$('c_tel').value||null,email:$('c_email').value||null,codice_fiscale:$('c_cf').value||null,citta:$('c_city').value||null,cap:$('c_cap').value||null,provincia:$('c_prov').value||null,note:$('c_note').value||null,stato_cliente:'Attivo',codice_cliente:id?(state.clienti.find(x=>x.id===id)?.codice_cliente||null):'CL-'+String(Date.now()).slice(-6)};try{if(id)await api('clienti',`id=eq.${id}`,{method:'PATCH',body});else await api('clienti','',{method:'POST',body});closeModal();toast('Cliente salvato su Supabase');await loadAll()}catch(e){toast(e.message,false)}}
let modalSelectedSeats=[];
function seatListForTrip(tripId,excludeBookingId=''){return state.prenotazionePosti.filter(x=>x.viaggio_id===tripId&&x.prenotazione_id!==excludeBookingId).map(x=>String(x.posto));}
function renderSeatPicker(){const tripId=$('b_trip')?.value;if(!tripId||!$('seatPicker'))return;const bId=window.currentBookingId||'';const v=state.viaggi.find(x=>x.id===tripId)||{};const busy=seatListForTrip(tripId,bId);const total=Number(v.posti_totali||0);$('seatPicker').innerHTML=Array.from({length:total},(_,i)=>{const n=String(i+1),isBusy=busy.includes(n),sel=modalSelectedSeats.includes(n);return `<button type="button" class="seat ${isBusy?'busy':''} ${sel?'selected':''}" ${isBusy?'disabled':''} onclick="toggleSeat('${n}')">${n}</button>`}).join('');$('b_selected').value=modalSelectedSeats.join(', ');$('b_seats').value=modalSelectedSeats.length||1;}
function toggleSeat(n){const i=modalSelectedSeats.indexOf(String(n));if(i>=0)modalSelectedSeats.splice(i,1);else modalSelectedSeats.push(String(n));modalSelectedSeats.sort((a,b)=>Number(a)-Number(b));const v=state.viaggi.find(x=>x.id===$('b_trip')?.value);if(v&&$('b_total'))$('b_total').value=(Number(v.prezzo)||0)*modalSelectedSeats.length;renderSeatPicker();}
function openBookingModal(id=''){window.currentBookingId=id;const b=state.prenotazioni.find(x=>x.id===id)||{};const firstTrip=b.viaggio_id||state.viaggi[0]?.id||'';modalSelectedSeats=state.prenotazionePosti.filter(x=>x.prenotazione_id===id).map(x=>String(x.posto));if(!modalSelectedSeats.length&&b.posti_selezionati)modalSelectedSeats=String(b.posti_selezionati).split(',').map(x=>x.trim()).filter(Boolean);openModal(id?'Modifica prenotazione':'Nuova prenotazione',`<div class="form-grid"><div class="field full"><label>Viaggio</label><select id="b_trip" onchange="modalSelectedSeats=[];renderSeatPicker()">${state.viaggi.map(v=>`<option value="${v.id}" ${firstTrip===v.id?'selected':''}>${esc(v.titolo)} · ${dateIT(v.data_partenza)} · ${money(v.prezzo)} · ${v.posti_liberi??v.posti_totali??0} liberi</option>`).join('')}</select></div><div class="field"><label>Cliente</label><input id="b_client" value="${esc(b.cliente||'')}"></div><div class="field"><label>Telefono</label><input id="b_tel" value="${esc(b.telefono||'')}"></div><div class="field"><label>Email (facoltativa)</label><input id="b_email" value="${esc(b.email||'')}"></div><div class="field"><label>N° posti</label><input id="b_seats" type="number" min="1" value="${b.posti||1}" readonly></div><div class="field"><label>Totale €</label><input id="b_total" type="number" step=".01" value="${b.totale??0}"></div><div class="field full"><label>Pianta posti — clicca per selezionare</label><div id="seatPicker" class="seat-picker"></div><input id="b_selected" value="${esc(b.posti_selezionati||'')}" readonly></div><div class="field"><label>Stato</label><select id="b_status">${['Confermata','In attesa','Pagata','Annullata'].map(x=>`<option ${b.stato===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field full"><label>Note</label><textarea id="b_note">${esc(b.note||'')}</textarea></div></div>`,`<button class="btn btn-secondary" onclick="closeModal()">Chiudi</button>${id?`<button class="btn btn-danger" onclick="cancelBooking('${id}')">❌ Annulla e libera posti</button><button class="btn btn-ghost" onclick="deleteBooking('${id}')">🗑️ Elimina</button><button class="btn btn-primary" onclick="printConfirmation('${id}')">🎫 Conferma</button>`:''}<button class="btn btn-primary" onclick="saveBooking('${id}')">Salva prenotazione</button>`);const v=state.viaggi.find(x=>x.id===firstTrip);if(v&&(!b.totale||b.totale===0))$('b_total').value=(Number(v.prezzo)||0)*(modalSelectedSeats.length||Number(b.posti)||1);renderSeatPicker();}
async function saveBooking(id){
 const v=state.viaggi.find(x=>x.id===$('b_trip').value);
 if(!v)return toast('Seleziona un viaggio',false);
 const client=$('b_client').value.trim();
 if(!client)return toast('Inserisci il nome del cliente',false);
 const seats=[...modalSelectedSeats];
 const count=seats.length||Number($('b_seats').value)||1;
 if(count<1)return toast('Inserisci almeno 1 posto',false);
 const total=Math.round((Number($('b_total').value)||0)*100)/100;
 const body={
   viaggio_id:v.id,
   cliente:client,
   telefono:$('b_tel').value||null,
   email:$('b_email').value||null,
   posti:count,
   totale:total,
   stato:$('b_status').value,
   note:$('b_note').value||null,
   posti_selezionati:seats.join(', '),
   cliente_nome:client,
   viaggio_codice:v.id_viaggio||null,
   data_prenotazione:new Date().toISOString().slice(0,10)
 };
 try{
   let bid=id;
   if(id){
     await api('prenotazioni',`id=eq.${id}`,{method:'PATCH',body});
   }else{
     body.codice='PR-'+String(Date.now()).slice(-6);
     body.id_prenotazione=body.codice;
     body.acconto=0;
     body.saldo=body.totale;
     body.pagato=0;
     const created=await api('prenotazioni','',{method:'POST',body});
     bid=created?.[0]?.id;
   }
   if(!bid)throw new Error('Prenotazione creata ma ID non restituito');

   // Sincronizza sempre la pianta posti. In questo modo anche una modifica
   // della prenotazione aggiorna correttamente i posti occupati/liberi.
   await rpc('dg_sync_booking_seats',{p_booking_id:bid,p_seats:seats});

   // Genera/aggiorna il numero di conferma senza bloccare il salvataggio
   // se la funzione non è disponibile nel progetto.
   try{await rpc('dg_generate_confirmation',{p_booking_id:bid})}catch(e){log('Conferma non generata: '+e.message)}

   closeModal();
   toast(id?'Prenotazione modificata e sincronizzata':'Prenotazione creata e sincronizzata');
   await loadAll();
 }catch(e){
   toast(e.message,false);
   log('PRENOTAZIONE: '+e.message);
 }
}

async function cancelBooking(id){
 if(!confirm("Confermi l'ANNULLAMENTO della prenotazione? I posti verranno liberati."))return;
 const b=state.prenotazioni.find(x=>x.id===id);
 if(!b)return toast('Prenotazione non trovata',false);
 try{
   // Prima strada: aggiorniamo lo stato e liberiamo la pianta posti.
   await api('prenotazioni',`id=eq.${id}`,{
     method:'PATCH',
     body:{
       stato:'Annullata',
       posti_selezionati:'',
       updated_at:new Date().toISOString()
     }
   });
   try{await rpc('dg_sync_booking_seats',{p_booking_id:id,p_seats:[]})}catch(e){log('Liberazione posti RPC: '+e.message)}
   closeModal();
   toast('Prenotazione annullata e posti liberati');
   await loadAll();
 }catch(e){
   toast('Impossibile annullare la prenotazione: '+e.message,false);
 }
}

async function deleteBooking(id){
 if(!confirm("ATTENZIONE: eliminare definitivamente questa prenotazione? L'operazione non è reversibile."))return;
 const b=state.prenotazioni.find(x=>x.id===id);
 if(!b)return toast('Prenotazione non trovata',false);
 try{
   // Usa la RPC esistente quando disponibile: è la via preferibile perché
   // può gestire anche le tabelle collegate.
   const r=await rpc('dg_delete_booking',{p_booking_id:id});
   closeModal();
   toast(r?.mode==='eliminata'?'Prenotazione eliminata definitivamente':'Prenotazione rimossa');
   await loadAll();
 }catch(rpcError){
   // Fallback: libera i posti e prova la cancellazione diretta.
   try{await rpc('dg_sync_booking_seats',{p_booking_id:id,p_seats:[]})}catch(_){}
   try{
     await api('prenotazioni',`id=eq.${id}`,{method:'DELETE'});
     closeModal();
     toast('Prenotazione eliminata');
     await loadAll();
   }catch(deleteError){
     toast('Eliminazione non riuscita: '+deleteError.message,false);
     log('DELETE PRENOTAZIONE RPC: '+rpcError.message+' | REST: '+deleteError.message);
   }
 }
}
function openPaymentModal(pre=''){const b=state.prenotazioni.find(x=>x.id===pre)||state.prenotazioni[0]||{};const client=String(b.cliente||'').trim(),trip=b.viaggio_id||'';openModal('Registra pagamento',`<div class="form-grid"><div class="field"><label>Cliente</label><select id="p_client">${paymentClientOptions(client)}</select></div><div class="field"><label>Viaggio</label><select id="p_trip">${paymentTripOptions(trip)}</select></div><div class="field full"><label>Prenotazione del cliente per questo viaggio</label><select id="p_booking">${paymentBookingOptions(client,trip,pre)}</select></div><div class="field"><label>Tipo movimento</label><select id="p_type"><option>Acconto</option><option>Saldo</option><option>Rimborso</option></select></div><div class="field"><label>Importo €</label><input id="p_amount" type="number" step=".01"></div><div class="field"><label>Metodo</label><select id="p_method"><option>Contanti</option><option>Bonifico</option><option>POS</option><option>PayPal</option><option>Altro</option></select></div><div class="field"><label>Data pagamento</label><input id="p_date" type="date" value="${new Date().toISOString().slice(0,10)}"></div><div class="field full"><label>Note</label><textarea id="p_note"></textarea></div></div><div class="statusline" style="margin-top:8px" id="p_summary">Seleziona cliente e viaggio per associare correttamente l'acconto.</div>`,`<button class="btn btn-secondary" onclick="closeModal()">Annulla</button><button class="btn btn-green" onclick="savePayment()">✓ Registra pagamento</button>`);$('p_client').addEventListener('change',syncPaymentBookings);$('p_trip').addEventListener('change',syncPaymentBookings);$('p_booking').addEventListener('change',updatePaySummary);updatePaySummary()}
function updatePaySummary(){const b=state.prenotazioni.find(x=>x.id===$('p_booking')?.value);if(!b){if($('p_summary'))$('p_summary').textContent="Seleziona cliente e viaggio per associare correttamente l'acconto.";return}if($('p_client'))$('p_client').value=String(b.cliente||'').trim();if($('p_trip'))$('p_trip').value=b.viaggio_id||'';$('p_summary').textContent=`${tripName(b.viaggio_id)} · Totale ${money(b.totale)} · Già pagato ${money(b.pagato)} · Residuo ${money(b.saldo)}`}
async function savePayment(){const b=state.prenotazioni.find(x=>x.id===$('p_booking')?.value);const selectedClient=String($('p_client')?.value||'').trim(),selectedTrip=$('p_trip')?.value||'';if(!selectedClient)return toast('Seleziona il cliente',false);if(!selectedTrip)return toast('Seleziona il viaggio',false);if(!b)return toast('Non esiste una prenotazione per il cliente e il viaggio selezionati',false);if(String(b.cliente||'').trim()!==selectedClient||b.viaggio_id!==selectedTrip)return toast('Cliente, viaggio e prenotazione non corrispondono',false);const amount=Math.round((Number($('p_amount').value)||0)*100)/100;if(amount<=0)return toast('Inserisci un importo valido',false);try{const r=await rpc('dg_register_payment',{p_booking_id:b.id,p_tipo:$('p_type').value,p_importo:amount,p_metodo:$('p_method').value,p_data:$('p_date').value,p_note:$('p_note').value||null});await rpc('sync_prenotazione_pagamenti',{p_prenotazione_id:b.id});closeModal();toast('Pagamento registrato sul viaggio · '+tripName(b.viaggio_id));await loadAll();setTimeout(()=>printReceipt(r.payment_id),250)}catch(e){toast(e.message,false)}}

async function saveEditedPayment(id){
 const p=state.pagamenti.find(x=>x.id===id);
 const oldBooking=state.prenotazioni.find(x=>x.id===p?.prenotazione_id);
 const b=state.prenotazioni.find(x=>x.id===$('ep_booking')?.value);
 const selectedClient=String($('ep_client')?.value||'').trim();
 const selectedTrip=$('ep_trip')?.value||'';
 if(!p)return toast('Pagamento non trovato',false);
 if(!selectedClient)return toast('Seleziona il cliente',false);
 if(!selectedTrip)return toast('Seleziona il viaggio',false);
 if(!b)return toast('Non esiste una prenotazione per il cliente e il viaggio selezionati',false);
 if(String(b.cliente||'').trim()!==selectedClient||b.viaggio_id!==selectedTrip)return toast('Cliente, viaggio e prenotazione non corrispondono',false);
 const amount=Math.round((Number($('ep_amount').value)||0)*100)/100;
 if(amount<=0)return toast('Inserisci un importo valido',false);
 const body={};
 const put=(key,val)=>{if(Object.prototype.hasOwnProperty.call(p,key))body[key]=val};
 put('prenotazione_id',b.id);
 put('viaggio_id',b.viaggio_id);
 put('cliente',selectedClient);
 put('viaggio',tripName(b.viaggio_id));
 put('tipo',$('ep_type').value);
 put('importo',amount);
 put('metodo_pagamento',$('ep_method').value);
 put('metodo',$('ep_method').value);
 put('data_pagamento',$('ep_date').value);
 put('note',$('ep_note').value||null);
 try{
   await api('pagamenti',`id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body});
   if(oldBooking?.id)await rpc('sync_prenotazione_pagamenti',{p_prenotazione_id:oldBooking.id});
   if(b.id && b.id!==oldBooking?.id)await rpc('sync_prenotazione_pagamenti',{p_prenotazione_id:b.id});
   closeModal();
   toast(oldBooking?.id!==b.id?'Pagamento spostato sul viaggio selezionato':'Pagamento modificato e sincronizzato');
   await loadAll();
 }catch(e){toast(e.message,false)}
}
function openEditPaymentModal(id){
 const p=state.pagamenti.find(x=>x.id===id);
 if(!p)return toast('Pagamento non trovato',false);
 const oldBooking=state.prenotazioni.find(x=>x.id===p.prenotazione_id)||{};
 const client=String(p.cliente||oldBooking.cliente||'').trim();
 const trip=p.viaggio_id||oldBooking.viaggio_id||'';
 const booking=p.prenotazione_id||'';
 openModal('Modifica pagamento',`<div class="statusline" style="margin-bottom:12px">Puoi correggere cliente, viaggio e prenotazione: il pagamento verrà associato al viaggio selezionato e i totali della prenotazione verranno ricalcolati.</div><div class="form-grid"><div class="field"><label>Cliente</label><select id="ep_client">${paymentClientOptions(client)}</select></div><div class="field"><label>Viaggio</label><select id="ep_trip">${paymentTripOptions(trip)}</select></div><div class="field full"><label>Prenotazione del cliente per questo viaggio</label><select id="ep_booking">${paymentBookingOptions(client,trip,booking)}</select></div><div class="field"><label>Tipo movimento</label><select id="ep_type">${['Acconto','Saldo','Rimborso'].map(x=>`<option ${p.tipo===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Importo €</label><input id="ep_amount" type="number" step=".01" value="${Number(p.importo||0)}"></div><div class="field"><label>Metodo</label><select id="ep_method">${['Contanti','Bonifico','POS','PayPal','Altro'].map(x=>`<option ${String(p.metodo_pagamento||p.metodo||'')===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Data pagamento</label><input id="ep_date" type="date" value="${esc(p.data_pagamento||new Date().toISOString().slice(0,10))}"></div><div class="field full"><label>Note</label><textarea id="ep_note">${esc(p.note||'')}</textarea></div></div><div class="statusline" style="margin-top:8px" id="ep_summary"></div>`,`<button class="btn btn-secondary" onclick="closeModal()">Annulla</button><button class="btn btn-green" onclick="saveEditedPayment('${id}')">✓ Salva modifiche</button>`);
 const sync=()=>{const c=$('ep_client')?.value||'',t=$('ep_trip')?.value||'',cur=$('ep_booking')?.value||'';if($('ep_booking')){$('ep_booking').innerHTML=paymentBookingOptions(c,t,cur);const rows=state.prenotazioni.filter(b=>(!c||String(b.cliente||'').trim()===c)&&(!t||b.viaggio_id===t));if(rows.length===1)$('ep_booking').value=rows[0].id;}const bb=state.prenotazioni.find(x=>x.id===$('ep_booking')?.value);if($('ep_summary'))$('ep_summary').textContent=bb?`${tripName(bb.viaggio_id)} · Totale ${money(bb.totale)} · Già pagato ${money(bb.pagato)} · Residuo ${money(bb.saldo)}`:'Seleziona cliente e viaggio per individuare la prenotazione corretta.'};
 $('ep_client').addEventListener('change',sync);$('ep_trip').addEventListener('change',sync);$('ep_booking').addEventListener('change',sync);sync();
}
function quickPayment(){const id=$('dashPayBooking').value;openPaymentModal(id);setTimeout(()=>{if($('p_type'))$('p_type').value=$('dashPayType').value;if($('p_amount'))$('p_amount').value=$('dashPayAmount').value;},80)}
function openFleetModal(id=''){const f=state.flotta.find(x=>x.id===id)||{};openModal(id?'Modifica mezzo':'Nuovo mezzo',`<div class="form-grid"><div class="field"><label>Titolo</label><input id="f2_title" value="${esc(f.titolo||'')}"></div><div class="field"><label>Marca</label><input id="f2_marca" value="${esc(f.marca||'Irizar')}"></div><div class="field"><label>Modello</label><input id="f2_model" value="${esc(f.modello||'Scania PB')}"></div><div class="field"><label>Targa</label><input id="f2_targa" value="${esc(f.targa||'')}"></div><div class="field"><label>Posti</label><input id="f2_posti" type="number" value="${f.posti??63}"></div><div class="field"><label>Stato</label><select id="f2_stato"><option>Disponibile</option><option>Operativo</option><option>Manutenzione</option><option>Uso privato</option><option>Fuori servizio</option></select></div><div class="field"><label>Immagine URL</label><input id="f2_img" value="${esc(f.immagine||'assets/bus-bianco-reale.jpg')}"></div><div class="field"><label>Categoria</label><input id="f2_cat" value="${esc(f.categoria||'GT')}"></div><div class="field full"><label>Descrizione</label><textarea id="f2_desc">${esc(f.descrizione||'')}</textarea></div></div>`,`<button class="btn btn-secondary" onclick="closeModal()">Annulla</button><button class="btn btn-primary" onclick="saveFleet('${id}')">Salva mezzo</button>`)}
async function saveFleet(id){const body={titolo:$('f2_title').value||`${$('f2_marca').value} ${$('f2_model').value}`,marca:$('f2_marca').value,modello:$('f2_model').value,targa:$('f2_targa').value||null,posti:Number($('f2_posti').value)||0,stato:$('f2_stato').value,immagine:$('f2_img').value||null,categoria:$('f2_cat').value||null,descrizione:$('f2_desc').value||null,attivo:true};try{if(id)await api('flotta',`id=eq.${id}`,{method:'PATCH',body});else await api('flotta','',{method:'POST',body});closeModal();toast('Mezzo salvato su Supabase');await loadAll()}catch(e){toast(e.message,false)}}
function openCheckinModal(){openModal('Check-in manuale',`<div class="form-grid"><div class="field full"><label>Prenotazione</label><select id="ci_booking">${bookingOptions()}</select></div><div class="field"><label>Esito</label><select id="ci_esito"><option>PRESENTE</option><option>ASSENTE</option></select></div><div class="field"><label>Fermata / Gate</label><input id="ci_gate"></div><div class="field"><label>Posto</label><input id="ci_seat"></div><div class="field full"><label>Note</label><textarea id="ci_note"></textarea></div></div>`,`<button class="btn btn-secondary" onclick="closeModal()">Annulla</button><button class="btn btn-green" onclick="saveCheckin()">Registra</button>`)}
async function saveCheckin(){const b=state.prenotazioni.find(x=>x.id===$('ci_booking').value);if(!b)return;const body={prenotazione_id:b.id,prenotazione_codice:b.codice,viaggio_id:b.viaggio_id,cliente:b.cliente,telefono:b.telefono,email:b.email,posto:$('ci_seat').value||null,esito:$('ci_esito').value,operatore:currentOperator.name,gate:$('ci_gate').value||null,note:$('ci_note').value||null,qr_payload:b.confirmation_token||b.codice};try{await api('accessi_checkin','',{method:'POST',body});await api('prenotazioni',`id=eq.${b.id}`,{method:'PATCH',body:{checkin_effettuato:body.esito==='PRESENTE',checkin_stato:body.esito,checkin_fermata:body.gate,checked_in_at:new Date().toISOString(),checkin_operatore:currentOperator.name,checkin_note:body.note}});closeModal();toast('Check-in registrato');await loadAll()}catch(e){toast(e.message,false)}}
function openTripDetail(id){const v=state.viaggi.find(x=>x.id===id);const bs=state.prenotazioni.filter(b=>b.viaggio_id===id);openModal('Control Room — '+(v?.titolo||''),`<div class="detail-grid"><div><h3>${esc(v?.destinazione||'')}</h3><p>${dateIT(v?.data_partenza)} · ${esc(v?.luogo_partenza||'')} · ${v?.ora_partenza||''}</p><div class="seat-grid">${Array.from({length:Number(v?.posti_totali||0)},(_,i)=>{const n=i+1;const busy=bs.some(b=>String(b.posti_selezionati||'').split(',').map(x=>x.trim()).includes(String(n)));return `<div class="seat ${busy?'busy':''}">${n}${busy?' •':''}</div>`}).join('')}</div></div><div><h3>Prenotati (${bs.length})</h3>${bs.map(b=>`<div class="list-row"><div class="row-main"><strong>${esc(b.cliente)}</strong><small>${b.posti||0} posti · ${money(b.saldo)} residuo</small></div><span class="pill ${b.checkin_effettuato?'ok':'wait'}">${b.checkin_effettuato?'PRESENTE':'NON PRESENTE'}</span></div>`).join('')}</div></div>`,`<button class="btn btn-secondary" onclick="closeModal()">Chiudi</button>`)}
function openQuoteModal(id=''){
 const q=state.preventivi.find(x=>x.id===id)||{};
 const title=id?'Modifica richiesta / preventivo':'Nuovo preventivo';
 openModal(title,`<div class="form-grid"><div class="field"><label>Nome *</label><input id="q_nome" value="${esc(q.nome||'')}"></div><div class="field"><label>Cognome</label><input id="q_cog" value="${esc(q.cognome||'')}"></div><div class="field"><label>Telefono *</label><input id="q_tel" value="${esc(q.telefono||'')}"></div><div class="field"><label>Email (facoltativa)</label><input id="q_email" type="email" value="${esc(q.email||'')}"></div><div class="field full"><label>Azienda</label><input id="q_company" value="${esc(q.azienda||'')}"></div><div class="field"><label>Servizio</label><input id="q_serv" value="${esc(q.servizio||q.servizio_richiesto||'')}"></div><div class="field"><label>Data viaggio</label><input id="q_date" type="date" value="${esc(q.data_viaggio||q.data_partenza||'')}"></div><div class="field"><label>Partenza</label><input id="q_part" value="${esc(q.luogo_partenza||q.partenza||'')}"></div><div class="field"><label>Destinazione *</label><input id="q_dest" value="${esc(q.destinazione||'')}"></div><div class="field"><label>Passeggeri</label><input id="q_pax" type="number" min="1" value="${Number(q.numero_passeggeri||q.passeggeri||1)}"></div><div class="field"><label>Importo €</label><input id="q_imp" type="number" step=".01" value="${Number(q.importo_preventivo??q.importo??0)}"></div><div class="field"><label>Validità preventivo</label><input id="q_valid" type="date" value="${esc(q.validita_preventivo||'')}"></div><div class="field"><label>Stato</label><select id="q_status">${['Nuovo','In lavorazione','Inviato','Accettato','Rifiutato','Annullato'].map(x=>`<option ${String(q.stato||'Nuovo')===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Provenienza</label><select id="q_origin"><option value="gestionale" ${quoteOrigin(q)==='gestionale'?'selected':''}>Gestionale</option><option value="sito" ${quoteOrigin(q)==='sito'?'selected':''}>Sito / richiesta online</option></select></div><div class="field full"><label>Richiesta del cliente</label><textarea id="q_det" rows="4">${esc(q.dettagli_offerta||q.note_cliente||q.messaggio||q.dettagli||'')}</textarea></div><div class="field full"><label>Note interne</label><textarea id="q_internal" rows="3">${esc(q.note_interne||'')}</textarea></div></div>`,`<button class="btn btn-secondary" onclick="closeModal()">Annulla</button>${id?`<button class="btn btn-danger" onclick="deleteQuote('${id}')">🗑️ Elimina</button>`:''}<button class="btn btn-primary" onclick="saveQuote('${id}')">${id?'Salva modifiche':'Salva preventivo'}</button>`);
}
async function saveQuote(id=''){
 const existing=id?state.preventivi.find(x=>x.id===id):null;
 const code=existing?.numero_preventivo||existing?.codice||'PV-'+String(Date.now()).slice(-6);
 const body={numero_preventivo:code,codice:code,nome:$('q_nome').value.trim(),cognome:$('q_cog').value.trim()||null,telefono:$('q_tel').value.trim()||null,email:$('q_email').value.trim()||null,azienda:$('q_company').value.trim()||null,origine:$('q_origin').value,stato:$('q_status').value,servizio:$('q_serv').value||null,servizio_richiesto:$('q_serv').value||null,data_viaggio:$('q_date').value||null,data_partenza:$('q_date').value||null,luogo_partenza:$('q_part').value||null,partenza:$('q_part').value||null,destinazione:$('q_dest').value.trim(),numero_passeggeri:Number($('q_pax').value)||1,passeggeri:Number($('q_pax').value)||1,importo:Number($('q_imp').value)||0,importo_preventivo:Number($('q_imp').value)||0,validita_preventivo:$('q_valid').value||null,note_cliente:$('q_det').value||null,dettagli_offerta:$('q_det').value||null,note_interne:$('q_internal').value||null,operatore:currentOperator.name,data_modifica:new Date().toISOString(),updated_at:new Date().toISOString()};
 if(!body.nome||!body.telefono||!body.destinazione)return toast('Compila nome, telefono e destinazione.',false);
 try{if(id)await api('preventivi',`id=eq.${id}`,{method:'PATCH',body});else await api('preventivi','',{method:'POST',body});closeModal();toast(id?'Preventivo/richiesta aggiornato':'Preventivo salvato');await loadAll()}catch(e){toast(e.message,false)}
}
async function updateQuoteStatus(id,status){try{await api('preventivi',`id=eq.${id}`,{method:'PATCH',body:{stato:status,data_modifica:new Date().toISOString(),updated_at:new Date().toISOString()}});toast(status==='In lavorazione'?'Richiesta presa in carico':'Stato aggiornato');await loadAll()}catch(e){toast('Impossibile aggiornare la richiesta: '+e.message,false)}}
async function deleteQuote(id){if(!confirm('Eliminare definitivamente questo preventivo/richiesta?'))return;try{await api('preventivi',`id=eq.${id}`,{method:'DELETE'});closeModal();toast('Preventivo/richiesta eliminato');await loadAll()}catch(e){toast('Impossibile eliminare il preventivo: '+e.message,false)}}

let quoteConvertSeats=[];
function quoteConvertSeatPicker(){
 const tid=$('qc_trip')?.value, box=$('qc_picker'); if(!tid||!box)return;
 const v=state.viaggi.find(x=>x.id===tid)||{};
 const busy=state.prenotazionePosti.filter(x=>x.viaggio_id===tid).map(x=>String(x.posto));
 const total=Number(v.posti_totali||0);
 box.innerHTML=Array.from({length:total},(_,i)=>{const n=String(i+1),isBusy=busy.includes(n),sel=quoteConvertSeats.includes(n);return `<button type="button" class="seat ${isBusy?'busy':''} ${sel?'selected':''}" ${isBusy?'disabled':''} onclick="toggleQuoteConvertSeat('${n}')">${n}</button>`}).join('');
 $('qc_selected').value=quoteConvertSeats.join(', ');
 $('qc_count').value=quoteConvertSeats.length;
 $('qc_total').value=((Number(v.prezzo)||0)*quoteConvertSeats.length).toFixed(2);
}
function toggleQuoteConvertSeat(n){const i=quoteConvertSeats.indexOf(String(n));if(i>=0)quoteConvertSeats.splice(i,1);else quoteConvertSeats.push(String(n));quoteConvertSeats.sort((a,b)=>Number(a)-Number(b));quoteConvertSeatPicker()}
function openQuoteConvertModal(id){
 const q=state.preventivi.find(x=>x.id===id);if(!q)return;
 const preferred=q.viaggio_id||state.viaggi.find(v=>q.data_viaggio&&v.data_partenza===q.data_viaggio)?.id||state.viaggi[0]?.id||'';
 quoteConvertSeats=[];
 openModal('Converti preventivo in prenotazione',`<div class="statusline info" style="margin-bottom:12px"><b>${esc(q.numero_preventivo||q.codice||'Preventivo')}</b> · ${esc([q.nome,q.cognome].filter(Boolean).join(' '))} · ${esc(q.destinazione||'')}</div><div class="form-grid"><div class="field full"><label>Viaggio *</label><select id="qc_trip" onchange="quoteConvertSeats=[];quoteConvertSeatPicker()">${state.viaggi.map(v=>`<option value="${v.id}" ${preferred===v.id?'selected':''}>${esc(v.titolo||v.destinazione)} · ${dateIT(v.data_partenza)} · ${money(v.prezzo)} · ${v.posti_liberi??v.posti_totali??0} liberi</option>`).join('')}</select></div><div class="field"><label>N° posti selezionati</label><input id="qc_count" type="number" readonly value="0"></div><div class="field"><label>Totale prenotazione €</label><input id="qc_total" type="number" step=".01" readonly value="0"></div><div class="field full"><label>Pianta posti — seleziona i posti da assegnare</label><div id="qc_picker" class="seat-picker"></div><input id="qc_selected" readonly></div></div>`,`<button class="btn btn-secondary" onclick="closeModal()">Annulla</button><button class="btn btn-green" onclick="convertQuoteToBooking('${id}')">✓ Crea prenotazione</button>`);
 quoteConvertSeatPicker();
}
async function convertQuoteToBooking(id){
 if(!quoteConvertSeats.length)return toast('Seleziona almeno un posto.',false);
 const tid=$('qc_trip')?.value;if(!tid)return toast('Seleziona il viaggio.',false);
 try{
   const result=await rpc('dg_convert_preventivo_to_booking',{p_preventivo_id:id,p_viaggio_id:tid,p_posti:quoteConvertSeats});
   if(!result?.success)throw new Error(result?.error||'Conversione non riuscita');
   closeModal();toast(`Prenotazione ${result.codice||''} creata dal preventivo`);await loadAll();
 }catch(e){toast('Impossibile convertire il preventivo: '+e.message,false);log('CONVERSIONE PREVENTIVO: '+e.message)}
}
/* === CAROUSEL FLOTTA DELGROSSO === */
const fleetCarouselDefaults = [
  {src:'assets/bus-bianco-dashboard.jpg', label:'DELGROSSO · GT', type:'GT'},
  {src:'assets/bus-extra.jpg', label:'DELGROSSO · GT', type:'GT'},
  {src:'assets/bus-bianco-reale.jpg', label:'DELGROSSO · GT', type:'GT'}
];
const fleetCarousels = {};
function fleetCarouselSources(){
  const out=[...fleetCarouselDefaults];
  const seen=new Set(out.map(x=>x.src));
  (state.flotta||[]).forEach(f=>{
    const src=String(f.immagine||'').trim();
    if(!src || seen.has(src)) return;
    const txt=((f.categoria||'')+' '+(f.titolo||'')+' '+(f.descrizione||'')).toLowerCase();
    const isLim=txt.includes('limousine') || txt.includes('party');
    out.push({src,label:`DELGROSSO · ${isLim?'Limousine BUS':'GT'}`,type:isLim?'Limousine BUS':'GT'});
    seen.add(src);
  });
  return out;
}
function buildFleetCarousel(id, kind){
  const root=document.getElementById(id); if(!root) return;
  const img=root.querySelector(kind==='hero'?'.hero-carousel-img':'.fleet-carousel-img');
  const dots=root.querySelector(kind==='hero'?'.hero-dots':'.fleet-dots');
  const label=kind==='hero'?root.querySelector('.hero-carousel-label'):root.querySelector('.fleet-caption span');
  const prev=root.querySelector(kind==='hero'?'.hero-prev':'.fleet-prev');
  const next=root.querySelector(kind==='hero'?'.hero-next':'.fleet-next');
  const slides=fleetCarouselSources();
  if(!img || slides.length===0) return;
  if(fleetCarousels[id]?.timer) clearInterval(fleetCarousels[id].timer);
  let idx=fleetCarousels[id]?.idx||0;
  idx=Math.max(0,Math.min(idx,slides.length-1));
  const stateObj=fleetCarousels[id]||{idx:0,timer:null};
  stateObj.idx=idx; stateObj.timer=null; fleetCarousels[id]=stateObj;
  function render(i){
    stateObj.idx=(i+slides.length)%slides.length;
    const s=slides[stateObj.idx];
    img.style.opacity='0.35';
    const pre=new Image();
    pre.onload=()=>{img.src=s.src;img.alt=s.label;img.style.opacity='1'};
    pre.onerror=()=>{img.style.opacity='1'};
    pre.src=s.src;
    if(label) label.textContent=s.label;
    if(dots){
      dots.innerHTML=slides.map((_,n)=>`<button type="button" class="${n===stateObj.idx?'active':''}" aria-label="Foto ${n+1}"></button>`).join('');
      [...dots.children].forEach((b,n)=>b.onclick=()=>{render(n);restart()});
    }
  }
  function restart(){clearInterval(stateObj.timer);if(slides.length>1)stateObj.timer=setInterval(()=>render(stateObj.idx+1),5200)}
  if(prev) prev.onclick=()=>{render(stateObj.idx-1);restart()};
  if(next) next.onclick=()=>{render(stateObj.idx+1);restart()};
  root.onmouseenter=()=>clearInterval(stateObj.timer);
  root.onmouseleave=restart;
  render(idx);restart();
}
function initFleetCarousels(){
  buildFleetCarousel('sideFleetCarousel','side');
  buildFleetCarousel('dashboardFleetCarousel','hero');
}
function printWindow(title,body){const w=window.open('','_blank','width=760,height=900');if(!w)return toast('Il browser ha bloccato la finestra di stampa',false);w.document.write(`<!doctype html><html><head><title>${esc(title)}</title><style>body{font-family:Arial,sans-serif;padding:35px;color:#10233d}h1{margin:0 0 5px}.logo{max-width:260px;max-height:100px;object-fit:contain}.box{border:1px solid #dbe5ef;border-radius:14px;padding:18px;margin-top:18px}.row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #edf2f7}.row:last-child{border:0}@media print{button{display:none}}.seat-picker{display:grid;grid-template-columns:repeat(4,minmax(38px,1fr));gap:8px;padding:12px;background:#f5f9fd;border:1px solid #dce7f2;border-radius:12px;max-height:300px;overflow:auto}.seat-picker .seat{border:1px solid #bcd0e3;background:#fff;border-radius:8px;padding:8px 4px;cursor:pointer;font-weight:700}.seat-picker .seat.selected{background:#1677e8;color:#fff;border-color:#1677e8}.seat-picker .seat.busy{background:#e7edf3;color:#8b98a7;cursor:not-allowed;text-decoration:line-through}.seat-picker .seat:nth-child(4n+3){margin-left:8px}.btn-ghost{background:#f1f6fb;color:#1266c5;border:1px solid #d7e3ef}.btn-ghost:hover{background:#e8f1fa}


@media(max-width:380px){
  .top-brand small{display:none!important}.top-brand strong{font-size:12px}.content{padding-left:6px;padding-right:6px}.metrics{gap:6px}.metric{padding:9px 8px}.metric b{font-size:17px}.hero-photo{height:155px;min-height:155px}.mobile-menu-panel{width:94vw}.mobile-menu-grid{gap:6px}.mobile-menu-grid button{min-height:61px;padding:8px}
}
@media(min-width:1001px){.mobile-menu-btn{display:none!important}}
</style></head><body>${body}<script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close()}
async function printReceipt(paymentId){const p=state.pagamenti.find(x=>x.id===paymentId);if(!p)return;const b=state.prenotazioni.find(x=>x.id===p.prenotazione_id);printWindow('Ricevuta '+(p.receipt_number||p.ricevuta||''),`<img class="logo" src="assets/delgrosso-logo-cropped.jpg"><h1>Ricevuta pagamento</h1><p><b>${esc(p.receipt_number||p.ricevuta||'—')}</b></p><div class="box"><div class="row"><span>Cliente</span><b>${esc(p.cliente||b?.cliente||'—')}</b></div><div class="row"><span>Viaggio</span><b>${esc(p.viaggio||tripName(p.viaggio_id))}</b></div><div class="row"><span>Tipo</span><b>${esc(p.tipo)}</b></div><div class="row"><span>Importo</span><b>${money(p.importo)}</b></div><div class="row"><span>Metodo</span><b>${esc(p.metodo_pagamento||p.metodo||'—')}</b></div><div class="row"><span>Data</span><b>${dateIT(p.data_pagamento)}</b></div><div class="row"><span>Residuo</span><b>${money(b?.saldo||p.saldo||0)}</b></div></div><p style="margin-top:30px">DELGROSSO Viaggi & Limousine BUS</p>`)}
async function printConfirmation(id){let b=state.prenotazioni.find(x=>x.id===id);if(!b)return;try{if(!b.confirmation_number){await rpc('dg_generate_confirmation',{p_booking_id:id});await loadAll();b=state.prenotazioni.find(x=>x.id===id)||b}}catch(e){return toast(e.message,false)}const seats=state.prenotazionePosti.filter(x=>x.prenotazione_id===id).map(x=>x.posto).join(', ')||b.posti_selezionati||'—';const v=state.viaggi.find(v=>v.id===b.viaggio_id);printWindow('Conferma '+(b.confirmation_number||b.codice||''),`<img class="logo" src="assets/delgrosso-logo-cropped.jpg"><h1>Conferma prenotazione</h1><p>Codice: <b>${esc(b.confirmation_number||b.codice||'—')}</b></p><div class="box"><div class="row"><span>Cliente</span><b>${esc(b.cliente)}</b></div><div class="row"><span>Telefono</span><b>${esc(b.telefono||'—')}</b></div><div class="row"><span>Viaggio</span><b>${esc(tripName(b.viaggio_id))}</b></div><div class="row"><span>Data</span><b>${dateIT(v?.data_partenza)}</b></div><div class="row"><span>Posti</span><b>${b.posti||0}</b></div><div class="row"><span>Posti scelti</span><b>${esc(seats)}</b></div><div class="row"><span>Totale</span><b>${money(b.totale)}</b></div><div class="row"><span>Pagato</span><b>${money(b.pagato)}</b></div><div class="row"><span>Residuo</span><b>${money(b.saldo)}</b></div></div><p>Conservare questa conferma per il viaggio.</p>`)}
function openTaskModal(){openModal('Nuova attività',`<div class="form-grid"><div class="field full"><label>Titolo</label><input id="t_title"></div><div class="field full"><label>Descrizione</label><textarea id="t_desc"></textarea></div><div class="field"><label>Priorità</label><select id="t_pri"><option>normale</option><option>alta</option><option>bassa</option></select></div><div class="field"><label>Scadenza</label><input id="t_date" type="date"></div></div>`,`<button class="btn btn-secondary" onclick="closeModal()">Annulla</button><button class="btn btn-primary" onclick="saveTask()">Salva</button>`)}
async function saveTask(){const body={titolo:$('t_title').value.trim(),descrizione:$('t_desc').value||null,priorita:$('t_pri').value,scadenza:$('t_date').value||null,assegnata_a:currentOperator.name};if(!body.titolo)return toast('Inserisci un titolo',false);try{await api('attivita_gestionale','',{method:'POST',body});closeModal();toast('Attività salvata');await loadAll()}catch(e){toast(e.message,false)}}
async function completeTask(id){try{await api('attivita_gestionale',`id=eq.${id}`,{method:'PATCH',body:{stato:'completata',completata_at:new Date().toISOString(),updated_at:new Date().toISOString()}});toast('Attività completata');await loadAll()}catch(e){toast(e.message,false)}}
function openRentalModal(id=''){const r=state.noleggi.find(x=>x.id===id)||{};openModal(id?'Modifica noleggio':'Nuovo noleggio',`<div class="form-grid"><div class="field"><label>Referente</label><input id="r_ref" value="${esc(r.referente||'')}"></div><div class="field"><label>Azienda</label><input id="r_company" value="${esc(r.azienda||'')}"></div><div class="field"><label>Telefono</label><input id="r_tel" value="${esc(r.telefono||'')}"></div><div class="field"><label>Email</label><input id="r_email" value="${esc(r.email||'')}"></div><div class="field"><label>Partenza</label><input id="r_from" value="${esc(r.tratta_partenza||'')}"></div><div class="field"><label>Destinazione</label><input id="r_to" value="${esc(r.tratta_destinazione||'')}"></div><div class="field"><label>Data partenza</label><input id="r_date" type="date" value="${esc(r.data_partenza||'')}"></div><div class="field"><label>Ora</label><input id="r_time" type="time" value="${esc(r.ora_partenza||'')}"></div><div class="field"><label>Data ritorno</label><input id="r_back" type="date" value="${esc(r.data_ritorno||'')}"></div><div class="field"><label>Passeggeri</label><input id="r_pax" type="number" value="${r.passeggeri??1}"></div><div class="field"><label>Prezzo concordato €</label><input id="r_price" type="number" step=".01" value="${r.prezzo_concordato??0}"></div><div class="field"><label>Stato noleggio</label><select id="r_status">${['Richiesto','Confermato','In servizio','Completato','Annullato'].map(x=>`<option ${r.stato_noleggio===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field full"><label>Note</label><textarea id="r_note">${esc(r.note||'')}</textarea></div></div>`,`<button class="btn btn-secondary" onclick="closeModal()">Annulla</button><button class="btn btn-primary" onclick="saveRental('${id}')">Salva noleggio</button>`)}
async function saveRental(id){const old=id?state.noleggi.find(x=>x.id===id):null;const price=Number($('r_price').value)||0;const body={id_noleggio:old?.id_noleggio||'NL-'+String(Date.now()).slice(-6),referente:$('r_ref').value||null,azienda:$('r_company').value||null,telefono:$('r_tel').value||null,email:$('r_email').value||null,tratta_partenza:$('r_from').value,tratta_destinazione:$('r_to').value,data_partenza:$('r_date').value,ora_partenza:$('r_time').value||null,data_ritorno:$('r_back').value||null,passeggeri:Number($('r_pax').value)||1,servizio_tipo:'Andata e ritorno',prezzo_concordato:price,acconto:old?.acconto||0,saldo:Math.max(price-(old?.acconto||0),0),stato_pagamento:old?.stato_pagamento||'Da pagare',stato_noleggio:$('r_status').value,note:$('r_note').value||null};try{if(id)await api('noleggi_bus',`id=eq.${id}`,{method:'PATCH',body});else await api('noleggi_bus','',{method:'POST',body});closeModal();toast('Noleggio salvato');await loadAll()}catch(e){toast(e.message,false)}}
async function markNotificationsRead(){try{await api('notifiche','letto=eq.false',{method:'PATCH',body:{letto:true,updated_at:new Date().toISOString()}});toast('Notifiche segnate come lette');await loadAll()}catch(e){toast(e.message,false)}}
$('sideNav').addEventListener('click',e=>{const b=e.target.closest('button[data-page]');if(b)go(b.dataset.page)});
['tripSearch','tripStatus','bookSearch','bookFilter','quoteSearch','quoteFilter','quoteOrigin','clientSearch','rentalSearch','rentalStatus','agendaSearch','agendaFilter','agendaPeriod'].forEach(id=>$(id)?.addEventListener('input',()=>renderPage(state.page)));
['agendaFilter','agendaPeriod'].forEach(id=>$(id)?.addEventListener('change',()=>renderAgenda()));
['quoteFilter','quoteOrigin'].forEach(id=>$(id)?.addEventListener('change',()=>renderQuotes()));
$('globalSearch').addEventListener('input',e=>{const q=e.target.value.trim().toLowerCase();if(!q)return;const found=state.prenotazioni.find(x=>JSON.stringify(x).toLowerCase().includes(q))||state.clienti.find(x=>JSON.stringify(x).toLowerCase().includes(q))||state.viaggi.find(x=>JSON.stringify(x).toLowerCase().includes(q));if(found){if(found.viaggio_id)go('prenotazioni');else if(found.destinazione)go('viaggi');else go('clienti')}});
$('notifBtn').onclick=()=>go('comunicazioni');
document.addEventListener('change',e=>{if(e.target?.id==='controlTripSelect')renderControlRoom()});

$('loginBtn').onclick=async()=>{const btn=$('loginBtn');btn.disabled=true;$('loginMsg').textContent='Autenticazione in corso…';try{await signIn($('loginUser').value,$('loginPass').value);$('currentOperatorName').textContent=currentOperator.name;$('currentOperatorRole').textContent='Ruolo: '+currentOperator.role;if($('mobileOperatorName'))$('mobileOperatorName').textContent=currentOperator.name;$('login').style.display='none';$('app').classList.add('on');go(location.hash.slice(1)||'dashboard');await loadAll();await health();startAutoSync();$('loginMsg').textContent=''}catch(e){$('loginMsg').textContent=e.message||'Credenziali non valide'}finally{btn.disabled=false}};
$('loginPass').addEventListener('keydown',e=>{if(e.key==='Enter')$('loginBtn').click()});
(function(){const e=$('lastSync');const v=localStorage.getItem('dg_last_sync');if(e&&v)e.textContent='Ultima sincronizzazione: '+v})();
(async()=>{try{const raw=sessionStorage.getItem('dg_auth');if(raw){authSession=JSON.parse(raw);$('login').style.display='none';$('app').classList.add('on');go(location.hash.slice(1)||'dashboard');if(!(await health())){if(await refreshAuth()){await loadAll()}else await signOut()}else await loadAll();startAutoSync()}}catch(e){await signOut()}})();


if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(()=>{});
}

function toggleMobileMenu(force){
  const el=document.getElementById('mobileMenu');
  if(!el)return;
  const show=typeof force==='boolean'?force:!el.classList.contains('on');
  el.classList.toggle('on',show);
  el.setAttribute('aria-hidden',show?'false':'true');
  document.body.style.overflow=show?'hidden':'';
}
function mobileGo(page){toggleMobileMenu(false);go(page);window.setTimeout(()=>window.scrollTo({top:0,left:0,behavior:'smooth'}),40);}

