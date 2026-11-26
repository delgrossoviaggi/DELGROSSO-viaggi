/* DELGROSSO · Gestionale semplice (v1, 26/11/2026)
 * Nuova interfaccia sugli STESSI dati Supabase del gestionale.
 * - Chiave pubblicabile, nessuna chiave di servizio nel browser.
 * - Ogni scrittura passa dalle funzioni già usate dal gestionale (RLS + controlli lato server):
 *   dg_register_payment, dg_save_booking_v13, dg_generate_confirmation, dg_transfer_cash,
 *   dg_close_cash_day_v2, dg_delete_payment, insert economia_movimenti (spese).
 * - Nessun messaggio automatico ai clienti.
 */
(function(){
'use strict';
const API='https://chkuayhbmitdmzmmvona.supabase.co';
const KEY='sb_publishable_H29K1BV5ZE1rT8xo0PIzVA_wF6zC7je';
const STORE='dg-semplice-session';
const FERMATE=['San Nicandro Garganico','San Severo','Apricena','San Marco in Lamis','Lesina & Poggio Imperiale','Foggia','Termoli'];
const SPESE=['Parcheggio','Pranzo','Autista','Compenso','Carburante','Pedaggio','Altro'];

/* ---------- utilità ---------- */
const $=s=>document.querySelector(s);
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const r2=n=>Math.round(num(n)*100)/100;
const eur=n=>{const v=r2(n),neg=v<0,a=Math.abs(v),int=Math.floor(a+1e-9),dec=Math.round((a-int)*100);return (neg?'− ':'')+'€ '+String(int).replace(/\B(?=(\d{3})+(?!\d))/g,'.')+(dec?','+String(dec).padStart(2,'0'):'')};
const today=()=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day};
const addDays=(iso,d)=>{const t=new Date(iso+'T12:00:00Z');t.setUTCDate(t.getUTCDate()+d);return t.toISOString().slice(0,10)};
const GG=['dom','lun','mar','mer','gio','ven','sab'];
const dateShort=iso=>{if(!/^\d{4}-\d{2}-\d{2}/.test(String(iso||'')))return '—';const d=new Date(String(iso).slice(0,10)+'T12:00:00Z');return GG[d.getUTCDay()]+' '+String(iso).slice(8,10)+'/'+String(iso).slice(5,7)};
const active=b=>!/annull|cancel|eliminat/i.test(String(b&&b.stato||''));
const residuo=b=>Math.max(0,r2(num(b.totale)-num(b.pagato)));
const nameOf=b=>String(b.cliente_nome||b.cliente||'Cliente').trim();
const seatsOf=b=>String(b.posti_selezionati||'').split(/[,;\s]+/).map(s=>s.trim()).filter(s=>/^[1-9]\d{0,3}$/.test(s));
const phoneDigits=p=>String(p||'').replace(/[^\d]/g,'');
const waNumber=p=>{let d=phoneDigits(p);if(!d)return '';if(d.startsWith('00'))d=d.slice(2);if(d.length===10&&d.startsWith('3'))d='39'+d;return d};
const uuid=()=>crypto.randomUUID?crypto.randomUUID():'10000000-1000-4000-8000-100000000000'.replace(/[018]/g,c=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16));
const tripLabel=t=>String(t&&(t.titolo||t.destinazione)||'Viaggio').replace(/\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}/g,' ').replace(/[—–]\s*BIS.*$/i,' ').replace(/\s{2,}/g,' ').replace(/[\s\-–—·]+$/,'').trim();
const fold=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();

/* ---------- sessione e API ---------- */
let session=null, me=null, refreshing=null;
function saveSession(s){session={...s,expires_at:s.expires_at||Math.floor(Date.now()/1000)+num(s.expires_in||3600)};try{localStorage.setItem(STORE,JSON.stringify(session))}catch{}}
function dropSession(){session=null;me=null;try{localStorage.removeItem(STORE)}catch{}}
async function raw(path,opt={},auth=true){
  const headers={apikey:KEY,Accept:'application/json',...(opt.headers||{})};
  if(auth){await ensureToken();headers.Authorization='Bearer '+session.access_token}
  const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),20000);
  let res;
  try{res=await fetch(API+path,{...opt,headers,signal:ctl.signal,cache:'no-store'})}
  catch(e){throw new Error(e.name==='AbortError'?'Connessione lenta: riprova tra poco.':'Nessuna connessione internet.')}
  finally{clearTimeout(tm)}
  const text=await res.text();let data=null;
  if(text){try{data=JSON.parse(text)}catch{data=text}}
  if(!res.ok){
    if(res.status===401&&auth){dropSession();render();throw new Error('Accesso scaduto: entra di nuovo.')}
    throw new Error(friendly(data&&(data.message||data.error_description||data.msg||data.error)||('Errore '+res.status)));
  }
  return data;
}
async function ensureToken(){
  if(!session||!session.refresh_token)throw new Error('Accesso richiesto.');
  if(num(session.expires_at)*1000>Date.now()+90000)return;
  if(refreshing)return refreshing;
  refreshing=(async()=>{
    const next=await raw('/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})},false);
    if(!next||!next.access_token||(session.user&&next.user&&next.user.id!==session.user.id))throw new Error('Sessione non valida.');
    saveSession(next);
  })();
  try{await refreshing}finally{refreshing=null}
}
function friendly(m){
  const s=String(m||'');
  const map={IMPORTO_SUPERIORE_AL_RESIDUO:'L’importo supera quanto resta da pagare.',IMPORTO_NON_VALIDO:'Importo non valido.',POSTI_INSUFFICIENTI:'Non ci sono abbastanza posti liberi su questo viaggio.',DATI_PRENOTAZIONE_NON_VALIDI:'Mancano dati della prenotazione (nome o fermata).',OPERATORE_NON_AUTORIZZATO:'Operatore non autorizzato.',AUTH_REQUIRED:'Accesso richiesto.',PRENOTAZIONE_NON_TROVATA:'Prenotazione non trovata: aggiorna.'};
  for(const k in map)if(s.includes(k))return map[k];
  if(/Cassa insufficiente/i.test(s))return 'Il gestionale non vede abbastanza contanti nella tua cassa per questa consegna.';
  if(/nota per la differenza/i.test(s))return 'C’è una differenza: scrivi una nota.';
  return s.slice(0,240);
}
const get=(table,params)=>raw('/rest/v1/'+table+'?'+new URLSearchParams(params).toString());
const rpc=(name,args)=>raw('/rest/v1/rpc/'+name,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args||{})});
const insert=(table,row)=>raw('/rest/v1/'+table,{method:'POST',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(row)});

async function login(username,password){
  const data=await raw('/functions/v1/dg2-operator-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})},false);
  if(!data||!data.access_token)throw new Error('Nome o password non corretti.');
  saveSession(data);
  try{await authorize()}catch(e){dropSession();throw e}
}
async function authorize(){
  const ok=await rpc('is_gestionale_admin',{});
  if(ok!==true)throw new Error('Questo account non è un operatore del gestionale.');
  const rows=await get('operatori_gestionale',{select:'user_id,username,nome,attivo'});
  const uid=session.user&&session.user.id;
  me=(rows||[]).find(o=>o.user_id===uid&&o.attivo===true);
  if(!me)throw new Error('Operatore non attivo.');
  S.operators=(rows||[]).filter(o=>o.attivo===true);
}

/* ---------- dati ---------- */
const S={tab:'oggi',trips:[],bookings:[],seats:[],stops:[],customers:[],cash:null,spese:[],paysToday:[],lastClose:null,operators:[],
  tripId:null,incTrip:null,search:'',loading:false,error:'',book:null,lastPayment:null};
async function loadAll(){
  S.loading=true;S.error='';render();
  try{
    const t0=today(),from=addDays(t0,-10);
    const trips=await get('viaggi',{select:'id,id_viaggio,titolo,destinazione,data_partenza,ora_partenza,prezzo,stato,pubblicato,posti_totali,posti_occupati,autobus_id,bis_parent_id,bis_numero,archiviato_at',data_partenza:'gte.'+from,archiviato_at:'is.null',order:'data_partenza.asc,titolo.asc',limit:'200'});
    S.trips=(trips||[]).filter(t=>!/annullat/i.test(String(t.stato||''))).sort((a,b)=>String(a.data_partenza).localeCompare(String(b.data_partenza))||num(a.bis_numero)-num(b.bis_numero)||String(a.titolo).localeCompare(String(b.titolo)));
    const ids=S.trips.map(t=>t.id);
    const inList='in.('+ids.join(',')+')';
    const [bookings,seats,stops,cash,spese,pays,closes,customers]=await Promise.all([
      ids.length?get('prenotazioni',{select:'id,viaggio_id,cliente,cliente_nome,telefono,posti,totale,pagato,stato,posti_selezionati,fermata_partenza,giorni_acconto,created_at,note',viaggio_id:inList,limit:'3000'}):[],
      ids.length?get('prenotazione_posti',{select:'viaggio_id,prenotazione_id,posto',viaggio_id:inList,limit:'6000'}):[],
      ids.length?get('viaggi_fermate',{select:'viaggio_id,nome,orario,ordine,attiva',viaggio_id:inList}).catch(()=>[]):[],
      rpc('dg_cash_preview_v2',{p_date:t0}).catch(e=>({error:e.message})),
      get('economia_movimenti',{select:'id,categoria,descrizione,importo,metodo,viaggio_id,created_at',tipo:'eq.Uscita',data_movimento:'eq.'+t0,operatore_user_id:'eq.'+me.user_id,order:'created_at.desc'}).catch(()=>[]),
      get('pagamenti',{select:'id,prenotazione_id,viaggio_id,cliente,importo,tipo,metodo,receipt_number,created_at,incassato_da_user_id',incassato_da_user_id:'eq.'+me.user_id,created_at:'gte.'+t0+'T00:00:00+01:00',order:'created_at.desc'}).catch(()=>[]),
      get('cassa_chiusure',{select:'data_chiusura,contanti_contati,created_at',operatore_user_id:'eq.'+me.user_id,order:'created_at.desc',limit:'1'}).catch(()=>[]),
      get('clienti',{select:'nome,cognome,telefono',limit:'3000'}).catch(()=>[])
    ]);
    S.bookings=bookings||[];S.seats=seats||[];S.stops=stops||[];S.cash=cash;S.spese=spese||[];S.paysToday=pays||[];S.lastClose=(closes||[])[0]||null;S.customers=customers||[];
  }catch(e){S.error=e.message}
  S.loading=false;render();
}
const tripById=id=>S.trips.find(t=>t.id===id);
const bookingsOf=id=>S.bookings.filter(b=>b.viaggio_id===id&&active(b));
function tripStats(t){
  const bs=bookingsOf(t.id);
  const pax=bs.reduce((a,b)=>a+num(b.posti),0);
  return {bs,pax,cap:num(t.posti_totali),free:Math.max(0,num(t.posti_totali)-pax),res:r2(bs.reduce((a,b)=>a+residuo(b),0))};
}
function occupied(tripId,exceptId){
  const set=new Set();
  const ok=new Set(bookingsOf(tripId).filter(b=>b.id!==exceptId).map(b=>b.id));
  for(const s of S.seats)if(s.viaggio_id===tripId&&ok.has(s.prenotazione_id))set.add(String(s.posto));
  for(const b of bookingsOf(tripId))if(b.id!==exceptId)for(const x of seatsOf(b))set.add(x);
  return set;
}
function autoSeats(t,n){
  const occ=occupied(t.id),cap=num(t.posti_totali),free=[];for(let i=1;i<=cap;i++)if(!occ.has(String(i)))free.push(i);
  if(free.length<n)return [];
  for(let k=0;k+n<=free.length;k++)if(free[k+n-1]-free[k]===n-1)return free.slice(k,k+n).map(String); // posti vicini
  return free.slice(0,n).map(String);
}
const upcoming=()=>S.trips.filter(t=>String(t.data_partenza)>=today());
function nextTrips(){const up=upcoming();if(!up.length)return [];const d=up[0].data_partenza;return up.filter(t=>t.data_partenza===d)}
function defaultIncTrip(){
  const t0=today();
  const cand=S.trips.filter(t=>t.data_partenza>=addDays(t0,-3)&&tripStats(t).res>0);
  const todayT=cand.find(t=>t.data_partenza===t0);
  return (todayT||cand.find(t=>t.data_partenza>=t0)||cand[cand.length-1]||{}).id||null;
}
const cashInHand=()=>S.cash&&!S.cash.error?num(S.cash.saldo_teorico):null;
const otherOperator=()=>S.operators.find(o=>o.user_id!==me.user_id);

/* ---------- interfaccia ---------- */
const ICONS={
  oggi:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  viaggi:'<rect x="4" y="3" width="16" height="14" rx="3"/><path d="M4 11h16M8 21v-4M16 21v-4M7 14h.01M17 14h.01"/>',
  prenota:'<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  incassi:'<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 10v4M18 10v4"/>',
  cassa:'<path d="M4 7h16v12H4z"/><path d="M4 7l2-3h12l2 3M9 12h6"/>'
};
const TABS=[['oggi','Oggi'],['viaggi','Viaggi'],['prenota','Prenota'],['incassi','Incassi'],['cassa','Cassa']];
const TITLES={oggi:'Oggi',viaggi:'Viaggi',viaggio:'Viaggio',prenota:'Nuova prenotazione',incassi:'Saldi a bordo',cassa:'La mia cassa'};

function render(){
  const app=$('#app');
  if(!session||!me){app.innerHTML=loginView();bindLogin();return}
  const view=S.tab==='viaggi'&&S.tripId?'viaggio':S.tab;
  let body='';
  if(S.error)body+=`<div class="err">${esc(S.error)} <button class="link" data-act="reload">Riprova</button></div>`;
  if(S.loading&&!S.trips.length)body+='<div class="empty">Carico i dati…</div>';
  else body+=({oggi:viewOggi,viaggi:viewViaggi,viaggio:viewViaggio,prenota:viewPrenota,incassi:viewIncassi,cassa:viewCassa}[view]||viewOggi)();
  app.innerHTML=`<div class="shell">
  <header class="top"><div><div class="brand">DELGROSSO VIAGGI</div><h1>${esc(TITLES[view])}</h1></div>
  <div class="tools"><button data-act="reload" aria-label="Aggiorna">${S.loading?'…':'↻'}</button><a href="../index.html">Avanzate</a></div></header>
  <main>${body}</main>
  <nav class="nav" aria-label="Menu principale"><div class="in">${TABS.map(([k,l])=>`<button data-tab="${k}" class="${S.tab===k?'on':''}" aria-current="${S.tab===k?'page':'false'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]}</svg>${l}</button>`).join('')}</div></nav>
  </div>`;
}

/* ----- login ----- */
let loginUser='nicola';
function loginView(){
  return `<form class="login" id="loginForm" autocomplete="on">
  <div class="brand" style="font-weight:700;letter-spacing:.12em;color:#F2C25B">DELGROSSO VIAGGI</div>
  <h1>Gestionale semplice</h1>
  <div class="who" role="radiogroup" aria-label="Chi sei">
   <button type="button" data-user="nicola" class="${loginUser==='nicola'?'on':''}" aria-pressed="${loginUser==='nicola'}">Nicola</button>
   <button type="button" data-user="raffaele" class="${loginUser==='raffaele'?'on':''}" aria-pressed="${loginUser==='raffaele'}">Raffaele</button>
  </div>
  <label style="display:flex;flex-direction:column;gap:8px;font-weight:600">Password<input id="pw" type="password" autocomplete="current-password" required></label>
  <button class="btn gold" type="submit" id="loginBtn">Entra</button>
  <div id="loginErr" class="err" hidden></div>
  <a href="../index.html" style="color:#C9D6E6;text-align:center">Apri il gestionale completo</a>
  </form>`;
}
function bindLogin(){
  document.querySelectorAll('[data-user]').forEach(b=>b.onclick=()=>{loginUser=b.dataset.user;const pw=$('#pw').value;render();$('#pw').value=pw;$('#pw').focus()});
  $('#loginForm').onsubmit=async e=>{
    e.preventDefault();const btn=$('#loginBtn'),err=$('#loginErr');btn.disabled=true;btn.textContent='Accesso…';err.hidden=true;
    try{await login(loginUser,$('#pw').value);await loadAll()}
    catch(x){err.textContent=x.message;err.hidden=false;btn.disabled=false;btn.textContent='Entra'}
  };
}

/* ----- Oggi ----- */
function viewOggi(){
  const nt=nextTrips(),cash=cashInHand(),t0=today();
  const week=upcoming().filter(t=>t.data_partenza<=addDays(t0,7)).reduce((a,t)=>a+tripStats(t).res,0);
  const inc=defaultIncTrip(),incT=inc&&tripById(inc);
  let h=`<p style="margin:0;font-size:16px;color:#334155">Ciao <b>${esc(me.nome||me.username)}</b>.`+
   (nt.length?` Prossima partenza: <b>${esc(dateShort(nt[0].data_partenza))}</b>, ${nt.length===1?'1 bus':nt.length+' bus'}.`:' Nessuna partenza in programma.')+`</p>`;
  if(incT){const st=tripStats(incT);h+=`<button class="big gold" data-act="goInc" data-id="${incT.id}"><b>€ Saldi a bordo</b><span>${esc(tripLabel(incT))} · ${esc(dateShort(incT.data_partenza))} · da incassare ${eur(st.res)}</span></button>`}
  h+=`<button class="big navy" data-tab="prenota"><b>＋ Nuova prenotazione</b></button>`;
  h+=`<div class="grid2"><div class="kpi"><span>Contanti in mano</span><b>${cash==null?'—':eur(cash)}</b></div><div class="kpi"><span>Da incassare · 7 gg</span><b>${eur(week)}</b></div></div>`;
  const todo=[];
  for(const t of upcoming().filter(t=>t.data_partenza<=addDays(t0,30)&&!t.autobus_id))todo.push(`Assegna l’autobus a <b>${esc(tripLabel(t))}</b> (${esc(dateShort(t.data_partenza))}) dal gestionale completo`);
  const lateAcc=S.bookings.filter(b=>active(b)&&num(b.pagato)<=0&&num(b.totale)>0&&(tripById(b.viaggio_id)||{}).data_partenza>=t0&&String(b.created_at||'').slice(0,10)<=addDays(t0,-num(b.giorni_acconto||2)));
  for(const b of lateAcc.slice(0,3)){const t=tripById(b.viaggio_id);todo.push(`<b>${esc(nameOf(b))}</b> (${esc(tripLabel(t))} ${esc(dateShort(t.data_partenza))}): acconto non ancora ricevuto`)}
  if(lateAcc.length>3)todo.push(`Altri ${lateAcc.length-3} clienti senza acconto: li trovi aprendo ogni viaggio`);
  const lc=S.lastClose&&S.lastClose.data_chiusura;
  if(!lc||lc<addDays(t0,-2))todo.push(`Chiusura di cassa: ${lc?'ultima il '+esc(dateShort(lc)):'mai fatta'}`);
  h+=`<section class="card"><h2>Da fare</h2>${todo.length?todo.map(x=>`<div class="row" style="justify-content:flex-start;align-items:flex-start"><b style="color:#B45309">!</b><span>${x}</span></div>`).join(''):'<span class="muted">Tutto in ordine.</span>'}</section>`;
  if(nt.length)h+=`<section class="card"><h2>Prossime partenze</h2>${nt.map(t=>tripRow(t)).join('')}</section>`;
  h+=`<button class="link small" style="align-self:center" data-act="logout">Esci (${esc(me.nome||me.username)})</button>`;
  return h;
}

/* ----- Viaggi ----- */
function tripRow(t){
  const st=tripStats(t),pct=st.cap?Math.min(100,Math.round(st.pax/st.cap*100)):0;
  return `<button class="trip" data-act="openTrip" data-id="${t.id}">
   <div class="row" style="align-items:baseline"><span class="t">${esc(tripLabel(t))}${t.bis_parent_id?' <span class="tag warn">bus '+esc(t.bis_numero||2)+'</span>':''}</span><span class="small muted" style="white-space:nowrap">${esc(dateShort(t.data_partenza))}</span></div>
   <div class="bar"><i style="width:${pct}%"></i></div>
   <div class="row small" style="color:#334155"><span>${st.pax} / ${st.cap} posti${t.autobus_id?'':' · <span class="tag bad">bus da assegnare</span>'}</span><span>Da incassare <b>${eur(st.res)}</b></span></div>
  </button>`;
}
function viewViaggi(){
  const up=upcoming();
  return up.length?up.map(tripRow).join(''):'<div class="empty">Nessun viaggio in programma.</div>';
}
function viewViaggio(){
  const t=tripById(S.tripId);if(!t){S.tripId=null;return viewViaggi()}
  const st=tripStats(t),q=fold(S.search);
  const list=st.bs.filter(b=>!q||fold(nameOf(b)+' '+b.telefono+' '+b.fermata_partenza).includes(q)).sort((a,b)=>nameOf(a).localeCompare(nameOf(b),'it'));
  const paid=st.bs.filter(b=>residuo(b)<=0).length;
  let h=`<button class="link" data-act="backTrips">‹ Tutti i viaggi</button>
  <div class="hero"><div style="display:flex;flex-direction:column;gap:3px"><b style="font-size:17px">${esc(t.titolo||tripLabel(t))}</b><span class="small" style="color:#C9D6E6">${esc(dateShort(t.data_partenza))}${t.ora_partenza?' · ore '+esc(String(t.ora_partenza).slice(0,5)):''} · ${st.pax}/${st.cap} posti · ${st.free} liberi</span></div><span class="big-n">${eur(st.res)}</span></div>
  <div class="grid2"><button class="btn gold" data-act="goInc" data-id="${t.id}">Saldi a bordo</button><button class="btn" data-act="bookTrip" data-id="${t.id}">＋ Prenota qui</button></div>
  <input class="search" type="search" placeholder="Cerca passeggero, telefono o fermata" value="${esc(S.search)}" data-input="search" aria-label="Cerca passeggero">
  <p class="small muted" style="margin:0">${st.bs.length} prenotazioni · ${paid} pagate · ${st.bs.length-paid} con residuo</p>`;
  h+=list.map(b=>{
    const r=residuo(b),seats=seatsOf(b),wa=waNumber(b.telefono);
    const tag=r<=0?'<span class="tag ok">Pagato</span>':num(b.pagato)<=0?`<span class="tag bad">Senza acconto · ${eur(r)}</span>`:`<span class="tag warn">Resta ${eur(r)}</span>`;
    return `<div class="pax" style="flex-direction:column;align-items:stretch"><div class="row" style="align-items:flex-start"><div class="who"><b>${esc(nameOf(b))}</b><span>${num(b.posti)} ${num(b.posti)===1?'posto':'posti'}${seats.length?' · '+esc(seats.join(', ')):''}${b.fermata_partenza?' · '+esc(b.fermata_partenza):''}</span></div>${tag}</div>
    ${b.telefono?`<div class="contacts"><a href="tel:${esc(phoneDigits(b.telefono))}">Chiama ${esc(b.telefono)}</a>${wa?`<a href="https://wa.me/${wa}" target="_blank" rel="noopener">WhatsApp</a>`:''}</div>`:''}</div>`;
  }).join('')||'<div class="empty">Nessun passeggero trovato.</div>';
  return h;
}

/* ----- Incassi: saldi a bordo ----- */
function viewIncassi(){
  const t0=today();
  const trips=S.trips.filter(t=>t.data_partenza>=addDays(t0,-10)&&(tripStats(t).res>0||t.id===S.incTrip));
  if(!S.incTrip||!tripById(S.incTrip))S.incTrip=defaultIncTrip();
  const t=tripById(S.incTrip);
  let h=`<div class="chips" role="tablist" aria-label="Viaggio">${trips.map(x=>`<button class="chip ${x.id===S.incTrip?'on':''}" data-act="incTrip" data-id="${x.id}">${esc(dateShort(x.data_partenza))} · ${esc(tripLabel(x))}${x.bis_parent_id?' (bus '+esc(x.bis_numero||2)+')':''}</button>`).join('')}</div>`;
  if(!t)return h+'<div class="empty">Nessun saldo da incassare. Ottimo!</div>';
  const st=tripStats(t),due=st.bs.filter(b=>residuo(b)>0).sort((a,b)=>nameOf(a).localeCompare(nameOf(b),'it'));
  const doneToday=S.paysToday.filter(p=>p.viaggio_id===t.id);
  const incToday=doneToday.reduce((a,p)=>a+num(p.importo),0);
  h+=`<div class="hero"><div style="display:flex;flex-direction:column;gap:3px"><span class="small" style="color:#C9D6E6">${esc(t.titolo||tripLabel(t))}</span><span>Incassati oggi <b>${eur(incToday)}</b> · restano <b>${eur(st.res)}</b></span></div><span class="big-n">${due.length}</span></div>
  <p class="small muted" style="margin:0">Tocca il pulsante quando il passeggero ti paga. Viene registrato in contanti a nome tuo. Nessun messaggio al cliente.</p>`;
  if(S.lastPayment&&S.lastPayment.tripId===t.id)h+=`<div class="note row"><span>Registrato: ${esc(S.lastPayment.name)} ${eur(S.lastPayment.amount)}</span><button class="link" data-act="undoPay">Annulla</button></div>`;
  h+=due.map(b=>{const r=residuo(b),seats=seatsOf(b);return `<div class="pax"><div class="who"><b>${esc(nameOf(b))}</b><span>${num(b.posti)} ${num(b.posti)===1?'posto':'posti'}${seats.length?' · '+esc(seats.slice(0,8).join(', '))+(seats.length>8?'…':''):''}${num(b.pagato)<=0?' · nessun acconto':''}</span><button class="link small" data-act="payOther" data-id="${b.id}">Importo diverso</button></div><button class="pay" data-act="pay" data-id="${b.id}">Incassato ${eur(r)}</button></div>`}).join('')||'<div class="empty">Tutti hanno pagato su questo viaggio.</div>';
  if(doneToday.length)h+=`<section class="card"><h2>Incassati oggi su questo viaggio</h2>${doneToday.map(p=>`<div class="line"><span>${esc(p.cliente||'')}</span><b>${eur(p.importo)}</b></div>`).join('')}</section>`;
  return h;
}

/* ----- Cassa ----- */
let speseCat='Parcheggio';
function viewCassa(){
  const c=S.cash,cash=cashInHand(),other=otherOperator();
  let h='';
  if(c&&c.error)h+=`<div class="err">Non riesco a calcolare la cassa: ${esc(c.error)}</div>`;
  h+=`<section class="card" style="align-items:center"><span class="small muted" style="font-weight:700">CONTANTI CHE DOVRESTI AVERE ORA</span><div class="money">${cash==null?'—':eur(cash)}</div>`;
  if(c&&!c.error)h+=`<div style="width:100%">
   <div class="line"><span>Dall’ultima chiusura${c.previous_date?' ('+esc(dateShort(c.previous_date))+')':''}</span><b>${eur(c.saldo_iniziale)}</b></div>
   <div class="line"><span>Acconti e saldi incassati</span><b>+ ${eur(num(c.incassi_viaggi)+num(c.incassi_noleggi))}</b></div>
   <div class="line"><span>Altre entrate</span><b>+ ${eur(c.entrate_manual)}</b></div>
   <div class="line"><span>Spese pagate</span><b>− ${eur(c.uscite_manual)}</b></div>
   <div class="line"><span>Rimborsi</span><b>− ${eur(num(c.rimborsi_viaggi)+num(c.rimborsi_noleggi))}</b></div>
   <div class="line"><span>Ricevuti / consegnati</span><b>+ ${eur(c.trasferimenti_entrata)} / − ${eur(c.trasferimenti_uscita)}</b></div></div>`;
  h+=`</section>`;
  const t0=today(),tripsNear=S.trips.filter(t=>t.data_partenza>=addDays(t0,-3)&&t.data_partenza<=addDays(t0,3));
  h+=`<section class="card"><h2>Aggiungi una spesa pagata in contanti</h2>
   <div class="chips">${SPESE.map(s=>`<button class="chip ${s===speseCat?'on':''}" data-act="speseCat" data-v="${esc(s)}">${esc(s)}</button>`).join('')}</div>
   <label class="f">Importo (€)<input id="spImp" type="number" inputmode="decimal" min="0.01" step="0.01" placeholder="0"></label>
   <label class="f">Descrizione (facoltativa)<input id="spDesc" placeholder="es. parcheggio bus a Napoli"></label>
   ${tripsNear.length?`<label class="f">Viaggio<select id="spTrip"><option value="">Nessuno</option>${tripsNear.map(t=>`<option value="${t.id}" ${t.data_partenza===t0&&!t.bis_parent_id?'selected':''}>${esc(dateShort(t.data_partenza))} · ${esc(tripLabel(t))}${t.bis_parent_id?' (bus '+esc(t.bis_numero||2)+')':''}</option>`).join('')}</select></label>`:''}
   <button class="btn" data-act="addSpesa">Registra spesa</button>
   ${S.spese.length?`<div>${S.spese.map(x=>`<div class="line"><span>${esc(x.categoria)}${x.descrizione&&x.descrizione!==x.categoria?' · '+esc(x.descrizione):''}${/contant/i.test(x.metodo||'')?'':' <span class="tag warn">non in contanti</span>'}</span><b>− ${eur(x.importo)}</b></div>`).join('')}</div>`:''}
  </section>`;
  if(other)h+=`<section class="card"><h2>Consegna contanti a ${esc(other.nome||other.username)}</h2>
   <label class="f">Importo consegnato (€)<input id="trImp" type="number" inputmode="decimal" min="0.01" step="0.01" placeholder="quanto gli hai dato"></label>
   <label class="f">Nota (facoltativa)<input id="trNote" placeholder="es. saldi Napoli 29/11"></label>
   <button class="btn" data-act="transfer">Registra consegna</button></section>`;
  h+=`<section class="card"><h2>Chiusura serale</h2><p class="small muted" style="margin:0">Conta i contanti che hai davvero e scrivi la cifra. Il gestionale la confronta con il conto qui sopra.</p>
   <label class="f">Contanti contati (€)<input id="clImp" type="number" inputmode="decimal" min="0" step="0.01"></label>
   <label class="f">Nota (serve solo se c’è differenza)<input id="clNote"></label>
   <button class="btn ghost" data-act="closeCash">Chiudi la cassa di oggi</button>
   ${S.lastClose?`<span class="small muted">Ultima chiusura: ${esc(dateShort(S.lastClose.data_chiusura))} · contati ${eur(S.lastClose.contanti_contati)}</span>`:''}</section>`;
  return h;
}

/* ----- Prenota ----- */
function newBook(tripId){return {step:1,nome:'',tel:'',tripId:tripId||'',persone:1,fermata:'',totale:null,acconto:'meta',accontoAltro:'',note:'',done:null}}
function viewPrenota(){
  const B=S.book||(S.book=newBook());
  const bar=`<div class="steps">${[1,2,3].map(i=>`<i class="${B.step>=i?'on':''}"></i>`).join('')}</div>`;
  if(B.done){const d=B.done,wa=waNumber(d.tel);
    const msg=`Buongiorno ${d.nome}, confermiamo la prenotazione per ${d.viaggio} (${d.data}): ${d.persone} ${d.persone===1?'posto':'posti'}${d.posti?' (n. '+d.posti+')':''}, partenza da ${d.fermata}. Totale ${eur(d.totale)}${d.acconto>0?', acconto ricevuto '+eur(d.acconto)+', resta '+eur(d.totale-d.acconto):''}. DELGROSSO Viaggi`;
    return bar+`<section class="card" style="background:#DCFCE7;color:#14532D;align-items:center;text-align:center"><b style="font-size:21px">✓ Prenotazione salvata</b><span>${esc(d.nome)} · ${esc(d.viaggio)} ${esc(d.data)}</span><span>${d.persone} ${d.persone===1?'posto':'posti'}${d.posti?' · n. '+esc(d.posti):''} · totale ${eur(d.totale)}${d.acconto>0?' · acconto '+eur(d.acconto):''}</span>${d.warn?`<span class="small">${esc(d.warn)}</span>`:''}</section>
    ${wa?`<a class="btn gold" style="display:flex;align-items:center;justify-content:center;text-decoration:none" href="https://wa.me/${wa}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">Manda conferma su WhatsApp</a>`:''}
    <button class="btn" data-act="bookNew">Nuova prenotazione</button><button class="btn light" data-act="bookOpenTrip" data-id="${esc(d.tripId)}">Vai al viaggio</button>`;
  }
  let h=bar;
  if(B.step===1){
    const q=fold(B.nome),qd=phoneDigits(B.tel);
    const sugg=(q.length>=3||qd.length>=4)?S.customers.map(c=>({n:[c.nome,c.cognome].filter(Boolean).join(' ').trim(),t:c.telefono||''})).filter(c=>c.n&&((q.length>=3&&fold(c.n).includes(q))||(qd.length>=4&&phoneDigits(c.t).includes(qd)))).slice(0,4):[];
    h+=`<section class="card"><h2>1 · Chi prenota</h2>
    <label class="f">Nome e cognome<input id="bkNome" data-input="bkNome" autocomplete="off" value="${esc(B.nome)}"></label>
    <label class="f">Telefono<input id="bkTel" data-input="bkTel" type="tel" inputmode="tel" value="${esc(B.tel)}"></label>
    ${sugg.length?`<div class="small muted">Clienti già registrati:</div>${sugg.map((c,i)=>`<button class="chip" style="text-align:left" data-act="pickCust" data-n="${esc(c.n)}" data-t="${esc(c.t)}">${esc(c.n)}${c.t?' · '+esc(c.t):''}</button>`).join('')}`:''}
    </section><button class="btn" data-act="bkNext">Avanti</button>`;
  }else if(B.step===2){
    const ups=upcoming().filter(t=>tripStats(t).free>0||t.id===B.tripId);
    if(!B.tripId&&ups[0])B.tripId=ups[0].id;
    const t=tripById(B.tripId),st=t?tripStats(t):null;
    const tot=B.totale!=null?B.totale:r2(num(t&&t.prezzo)*B.persone);
    const stops=[...new Set([...S.stops.filter(s=>s.viaggio_id===B.tripId&&s.attiva!==false).sort((a,b)=>num(a.ordine)-num(b.ordine)).map(s=>s.nome),...FERMATE])];
    h+=`<section class="card"><h2>2 · Viaggio e posti</h2>
    <label class="f">Viaggio<select data-input="bkTrip">${ups.map(x=>{const s=tripStats(x);return `<option value="${x.id}" ${x.id===B.tripId?'selected':''}>${esc(dateShort(x.data_partenza))} · ${esc(tripLabel(x))}${x.bis_parent_id?' (bus '+esc(x.bis_numero||2)+')':''} · ${s.free} liberi · ${eur(x.prezzo)}</option>`}).join('')}</select></label>
    <div class="row"><span style="font-weight:600">Persone</span><div class="stepper"><button data-act="bkMinus" aria-label="Una persona in meno">−</button><b>${B.persone}</b><button data-act="bkPlus" aria-label="Una persona in più">+</button></div></div>
    ${st&&B.persone>st.free?`<div class="err">Su questo viaggio restano solo ${st.free} posti.</div>`:''}
    <label class="f">Fermata di partenza<input data-input="bkFermata" list="fermateList" value="${esc(B.fermata)}" placeholder="es. San Severo"><datalist id="fermateList">${stops.map(s=>`<option value="${esc(s)}">`).join('')}</datalist></label>
    <div class="chips">${stops.slice(0,5).map(s=>`<button class="chip ${B.fermata===s?'on':''}" data-act="bkStop" data-v="${esc(s)}">${esc(s)}</button>`).join('')}</div>
    <label class="f">Totale (€)<input data-input="bkTot" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(tot)}"></label>
    <span class="small muted">I posti vengono assegnati in automatico (i primi liberi). Si possono cambiare dal gestionale completo.</span>
    </section><div class="grid2"><button class="btn light" data-act="bkBack">Indietro</button><button class="btn" data-act="bkNext">Avanti</button></div>`;
  }else{
    const t=tripById(B.tripId),tot=bookTotal(B),acc=bookAcconto(B);
    h+=`<section class="card"><h2>3 · Acconto in contanti</h2>
    <div class="pick">${[['meta','Metà · '+eur(r2(tot/2))],['tutto','Tutto · '+eur(tot)],['niente','Niente per ora'],['altro','Altra cifra']].map(([k,l])=>`<button class="${B.acconto===k?'on':''}" data-act="bkAcc" data-v="${k}">${esc(l)}</button>`).join('')}</div>
    ${B.acconto==='altro'?`<label class="f">Acconto (€)<input data-input="bkAccAltro" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(B.accontoAltro)}"></label>`:''}
    <label class="f">Note (facoltative)<input data-input="bkNote" value="${esc(B.note)}"></label>
    <div><div class="line"><span>${esc(B.nome)}</span><b>${B.persone} ${B.persone===1?'posto':'posti'}</b></div>
    <div class="line"><span>${esc(t?tripLabel(t)+' · '+dateShort(t.data_partenza):'')}</span><b>${esc(B.fermata)}</b></div>
    <div class="line"><span>Totale</span><b>${eur(tot)}</b></div>
    <div class="line"><span>Acconto adesso</span><b>${eur(acc)}</b></div>
    <div class="line"><span>Resta da saldare</span><b>${eur(Math.max(0,tot-acc))}</b></div></div>
    </section><div class="grid2"><button class="btn light" data-act="bkBack">Indietro</button><button class="btn gold" data-act="bkSave">Conferma</button></div>`;
  }
  return h;
}
const bookTotal=B=>{const t=tripById(B.tripId);return r2(B.totale!=null?B.totale:num(t&&t.prezzo)*B.persone)};
const bookAcconto=B=>{const tot=bookTotal(B);return B.acconto==='meta'?r2(tot/2):B.acconto==='tutto'?tot:B.acconto==='altro'?Math.min(tot,r2(num(B.accontoAltro))):0};

/* ---------- azioni ---------- */
function toast(msg,bad){const t=$('#toast');t.textContent=msg;t.className='toast'+(bad?' bad':'');t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>t.hidden=true,bad?6000:3200)}
function sheet(html){const s=$('#sheet');s.innerHTML=`<div class="box" role="dialog" aria-modal="true">${html}</div>`;s.hidden=false;s.onclick=e=>{if(e.target===s)closeSheet()};const f=s.querySelector('input');if(f)setTimeout(()=>f.focus(),50)}
function closeSheet(){const s=$('#sheet');s.hidden=true;s.innerHTML=''}
let busy=false;
async function guard(btn,fn){if(busy)return;busy=true;const old=btn&&btn.textContent;if(btn){btn.disabled=true;btn.textContent='Attendi…'}try{await fn()}catch(e){toast(e.message,true)}finally{busy=false;if(btn&&document.body.contains(btn)){btn.disabled=false;btn.textContent=old}}}

function askPay(b,amount,custom){
  const r=residuo(b);
  sheet(`<h3>${esc(nameOf(b))}</h3>
  ${custom?`<label class="f">Importo ricevuto in contanti (€)<input id="payAmt" type="number" inputmode="decimal" min="0.01" max="${r}" step="0.01" value="${r}"></label><span class="small muted">Resta da pagare ${eur(r)}. Se paga meno, resta il residuo.</span>`:`<p style="margin:0;font-size:17px">Confermi che ti ha dato <b>${eur(amount)}</b> in contanti?</p>`}
  <button class="btn gold" id="payOk">Sì, incassato</button><button class="btn light" id="payNo">Annulla</button>`);
  $('#payNo').onclick=closeSheet;
  $('#payOk').onclick=e=>guard(e.currentTarget,async()=>{
    const amt=custom?r2($('#payAmt').value):amount;
    if(!(amt>0))throw new Error('Scrivi un importo valido.');
    if(amt>r+0.005)throw new Error('L’importo supera quanto resta da pagare ('+eur(r)+').');
    const tipo=num(b.pagato)<=0&&amt<r?'Acconto':'Saldo';
    const res=await rpc('dg_register_payment',{p_booking_id:b.id,p_tipo:tipo,p_importo:amt,p_metodo:'Contanti',p_data:today(),p_note:'Registrato dal gestionale semplice'});
    S.lastPayment={id:res&&res.payment_id,name:nameOf(b),amount:amt,tripId:b.viaggio_id};
    closeSheet();toast('Registrato: '+nameOf(b)+' '+eur(amt));await loadAll();
  });
}
async function undoPay(){
  const p=S.lastPayment;if(!p||!p.id)return;
  sheet(`<h3>Annullare l’incasso?</h3><p style="margin:0">${esc(p.name)} · ${eur(p.amount)}. Il pagamento viene tolto e il residuo torna come prima.</p><button class="btn danger" id="unOk">Sì, annulla l’incasso</button><button class="btn light" id="unNo">No</button>`);
  $('#unNo').onclick=closeSheet;
  $('#unOk').onclick=e=>guard(e.currentTarget,async()=>{await rpc('dg_delete_payment',{p_payment_id:p.id,p_reason:'Annullato subito dopo la registrazione (gestionale semplice)'});S.lastPayment=null;closeSheet();toast('Incasso annullato');await loadAll()});
}
async function addSpesa(btn){
  const imp=r2($('#spImp').value),desc=($('#spDesc').value||'').trim(),trip=$('#spTrip')?$('#spTrip').value:'';
  if(!(imp>0))return toast('Scrivi l’importo della spesa.',true);
  sheet(`<h3>Registrare la spesa?</h3><p style="margin:0;font-size:17px">${esc(speseCat)}${desc?' · '+esc(desc):''}: <b>${eur(imp)}</b> pagati da te in contanti.</p><button class="btn" id="spOk">Sì, registra</button><button class="btn light" id="spNo">Annulla</button>`);
  $('#spNo').onclick=closeSheet;
  $('#spOk').onclick=e=>guard(e.currentTarget,async()=>{
    await insert('economia_movimenti',{tipo:'Uscita',categoria:speseCat,descrizione:desc||speseCat,importo:imp,data_movimento:today(),metodo:'Contanti',viaggio_id:trip||null,origine:'manuale',note:'Registrata dal gestionale semplice'});
    closeSheet();toast('Spesa registrata');await loadAll();
  });
}
async function transfer(){
  const o=otherOperator(),imp=r2($('#trImp').value),note=($('#trNote').value||'').trim();
  if(!o)return;if(!(imp>0))return toast('Scrivi quanto hai consegnato.',true);
  sheet(`<h3>Confermi la consegna?</h3><p style="margin:0;font-size:17px">Hai dato <b>${eur(imp)}</b> in contanti a <b>${esc(o.nome||o.username)}</b>.</p><button class="btn" id="trOk">Sì, registra</button><button class="btn light" id="trNo">Annulla</button>`);
  $('#trNo').onclick=closeSheet;
  $('#trOk').onclick=e=>guard(e.currentTarget,async()=>{await rpc('dg_transfer_cash',{p_to_user_id:o.user_id,p_amount:imp,p_note:note||'Consegna contanti (gestionale semplice)'});closeSheet();toast('Consegna registrata');await loadAll()});
}
async function closeCash(){
  const raw=$('#clImp').value,note=($('#clNote').value||'').trim();
  if(raw==='')return toast('Scrivi quanti contanti hai contato.',true);
  const counted=r2(raw),theo=cashInHand(),diff=theo==null?0:r2(counted-theo);
  if(Math.abs(diff)>=0.01&&!note)return toast('C’è una differenza di '+eur(diff)+': scrivi una nota.',true);
  sheet(`<h3>Chiudere la cassa di oggi?</h3><p style="margin:0;font-size:17px">Contati <b>${eur(counted)}</b>${theo!=null?` · il gestionale si aspetta ${eur(theo)}${Math.abs(diff)>=0.01?` · <b>differenza ${eur(diff)}</b>`:' · tutto torna'}`:''}.</p><button class="btn" id="clOk">Sì, chiudi</button><button class="btn light" id="clNo">Annulla</button>`);
  $('#clNo').onclick=closeSheet;
  $('#clOk').onclick=e=>guard(e.currentTarget,async()=>{await rpc('dg_close_cash_day_v2',{p_counted:counted,p_note:note||null,p_date:today()});closeSheet();toast('Cassa chiusa');await loadAll()});
}
async function saveBooking(btn){
  const B=S.book,t=tripById(B.tripId);
  if(!t)return toast('Scegli il viaggio.',true);
  const tot=bookTotal(B),acc=bookAcconto(B),st=tripStats(t);
  if(B.persone>st.free)return toast('Su questo viaggio restano solo '+st.free+' posti.',true);
  if(acc<0||acc>tot)return toast('Acconto non valido.',true);
  await guard(btn,async()=>{
    const id=uuid(),seats=autoSeats(t,B.persone);
    const body={viaggio_id:t.id,fermata_partenza:B.fermata.trim(),giorni_acconto:2,cliente:B.nome.trim(),cliente_nome:B.nome.trim(),telefono:B.tel.trim()||null,email:null,posti:B.persone,totale:tot,stato:'In attesa acconto',note:B.note.trim()||null,viaggio_codice:t.id_viaggio||null,data_prenotazione:today()};
    await rpc('dg_save_booking_v13',{p_id:id,p_data:body,p_seats:seats});
    let warn='';
    try{await rpc('dg_generate_confirmation',{p_booking_id:id})}catch(e){warn='Prenotazione salvata, ma il codice di conferma non è stato generato: controlla dal gestionale completo.'}
    if(acc>0){
      try{await rpc('dg_register_payment',{p_booking_id:id,p_tipo:acc>=tot?'Saldo':'Acconto',p_importo:acc,p_metodo:'Contanti',p_data:today(),p_note:'Acconto alla prenotazione (gestionale semplice)'})}
      catch(e){warn='Prenotazione salvata, ma l’acconto NON è stato registrato ('+e.message+'). Registralo da Incassi.'}
    }
    B.done={tripId:t.id,nome:B.nome.trim(),tel:B.tel,viaggio:tripLabel(t),data:dateShort(t.data_partenza),persone:B.persone,posti:seats.join(', '),fermata:B.fermata.trim(),totale:tot,acconto:warn.includes('acconto')?0:acc,warn};
    toast('Prenotazione salvata');await loadAll();
  });
}

/* ---------- eventi ---------- */
document.addEventListener('click',e=>{
  const tab=e.target.closest('[data-tab]');
  if(tab&&!tab.closest('.login')){S.tab=tab.dataset.tab;if(S.tab==='viaggi')S.tripId=null;if(S.tab==='prenota'&&S.book&&S.book.done)S.book=null;S.search='';render();window.scrollTo(0,0);return}
  const a=e.target.closest('[data-act]');if(!a)return;
  const id=a.dataset.id,B=S.book;
  switch(a.dataset.act){
    case 'reload':loadAll();break;
    case 'goInc':S.tab='incassi';S.incTrip=id;render();window.scrollTo(0,0);break;
    case 'openTrip':S.tab='viaggi';S.tripId=id;S.search='';render();window.scrollTo(0,0);break;
    case 'backTrips':S.tripId=null;render();break;
    case 'bookTrip':S.tab='prenota';S.book=newBook(id);render();window.scrollTo(0,0);break;
    case 'incTrip':S.incTrip=id;S.lastPayment=null;render();break;
    case 'pay':{const b=S.bookings.find(x=>x.id===id);if(b)askPay(b,residuo(b),false);break}
    case 'payOther':{const b=S.bookings.find(x=>x.id===id);if(b)askPay(b,residuo(b),true);break}
    case 'undoPay':undoPay();break;
    case 'speseCat':speseCat=a.dataset.v;{const v=[$('#spImp').value,$('#spDesc').value];render();$('#spImp').value=v[0];$('#spDesc').value=v[1]}break;
    case 'addSpesa':addSpesa(a);break;
    case 'transfer':transfer();break;
    case 'closeCash':closeCash();break;
    case 'pickCust':B.nome=a.dataset.n;B.tel=a.dataset.t;render();break;
    case 'bkNext':
      if(B.step===1&&B.nome.trim().length<3)return toast('Scrivi nome e cognome.',true);
      if(B.step===2){const t=tripById(B.tripId);if(!t)return toast('Scegli il viaggio.',true);if(!B.fermata.trim())return toast('Scegli la fermata di partenza.',true);if(B.persone>tripStats(t).free)return toast('Posti non sufficienti.',true)}
      B.step++;render();window.scrollTo(0,0);break;
    case 'bkBack':B.step=Math.max(1,B.step-1);render();break;
    case 'bkMinus':B.persone=Math.max(1,B.persone-1);B.totale=null;render();break;
    case 'bkPlus':B.persone++;B.totale=null;render();break;
    case 'bkStop':B.fermata=a.dataset.v;render();break;
    case 'bkAcc':B.acconto=a.dataset.v;render();break;
    case 'bkSave':saveBooking(a);break;
    case 'bookNew':S.book=newBook();render();break;
    case 'bookOpenTrip':S.tab='viaggi';S.tripId=id;S.book=null;render();break;
    case 'logout':dropSession();render();break;
  }
});
document.addEventListener('input',e=>{
  const k=e.target.dataset&&e.target.dataset.input;if(!k)return;const v=e.target.value,B=S.book;
  if(k==='search'){S.search=v;const pos=e.target.selectionStart;render();const s=document.querySelector('[data-input="search"]');if(s){s.focus();try{s.setSelectionRange(pos,pos)}catch{}}return}
  if(k==='bkNome'||k==='bkTel'){B[k==='bkNome'?'nome':'tel']=v;const pos=e.target.selectionStart;render();const s=document.querySelector(`[data-input="${k}"]`);if(s){s.focus();try{s.setSelectionRange(pos,pos)}catch{}}return}
  if(k==='bkFermata')B.fermata=v;
  if(k==='bkTot')B.totale=v===''?null:r2(v);
  if(k==='bkAccAltro')B.accontoAltro=v;
  if(k==='bkNote')B.note=v;
});
document.addEventListener('change',e=>{
  const k=e.target.dataset&&e.target.dataset.input;
  if(k==='bkTrip'){S.book.tripId=e.target.value;S.book.totale=null;S.book.fermata='';render()}
  if(k==='bkTot'||k==='bkAccAltro')render();
});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&session&&me&&!busy)loadAll()});

/* ---------- avvio ---------- */
(async()=>{
  try{const s=JSON.parse(localStorage.getItem(STORE)||'null');if(s&&s.refresh_token){session=s;await authorize();await loadAll();return}}
  catch(e){dropSession()}
  render();
})();
})();
