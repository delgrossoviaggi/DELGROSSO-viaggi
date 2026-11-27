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
const dateShort=iso=>{if(!/^\d{4}-\d{2}-\d{2}/.test(String(iso||'')))return '—';const d=new Date(String(iso).slice(0,10)+'T12:00:00Z');const y=String(iso).slice(0,4);return GG[d.getUTCDay()]+' '+String(iso).slice(8,10)+'/'+String(iso).slice(5,7)+(y!==today().slice(0,4)?'/'+y.slice(2):'')};
const MESI=['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'],GIORNI=['domenica','lunedì','martedì','mercoledì','giovedì','venerdì','sabato'];
const dateParts=iso=>{const d=new Date(String(iso).slice(0,10)+'T12:00:00Z');return isNaN(d)?{d:'—',m:'',w:''}:{d:d.getUTCDate(),m:MESI[d.getUTCMonth()],w:GIORNI[d.getUTCDay()]}};
const dateLong=iso=>{const p=dateParts(iso);return p.w?p.w.charAt(0).toUpperCase()+p.w.slice(1)+' '+p.d+' '+['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'][MESI.indexOf(p.m)]:''};
const titleCase=s=>String(s||'').replace(/\s*\(\s*[A-Za-z]{2}\s*\)\s*$/,'').toLowerCase().replace(/(^|[\s'(-])([a-zà-ù])/g,(m,a,b)=>a+b.toUpperCase()).replace(/\b(E|Di|De|Del|Della|In|A|Al|Alla|Da|Con|Per)\b/g,(w,_,i)=>i===0?w:w.toLowerCase()).replace(/\bG\.co\b/i,'G.co');
const SVG=(d,w)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w||2}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const IC={arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',seat:'<path d="M7 4v8a3 3 0 0 0 3 3h7"/><path d="M7 15v5M17 11v9M7 18h10"/>',list:'<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',chat:'<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>',coins:'<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',plus:'<path d="M12 5v14M5 12h14"/>',ext:'<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',bell:'<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',bus:'<rect x="4" y="3" width="16" height="14" rx="3"/><path d="M4 11h16M8 21v-4M16 21v-4"/>',van:'<path d="M3 17V7a2 2 0 0 1 2-2h9l5 5h1a1 1 0 0 1 1 1v6"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',doc:'<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>',chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',move:'<path d="M4 12h16M14 6l6 6-6 6"/>',x:'<path d="M6 6l12 12M18 6 6 18"/>',out:'<path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9"/>'};
const firstStop=t=>titleCase(String(t.luogo_partenza||'').split(/\s*[|]\s*|\s+-\s*|\s*-\s+/)[0]||'');
function ticketHtml(t,big){
  const st=tripStats(t),pct=st.cap?Math.min(100,Math.round(st.pax/st.cap*100)):0,p=dateParts(t.data_partenza),from=firstStop(t),to=titleCase(t.destinazione||'');
  return `<span class="stub"><span class="d">${p.d}</span><span class="m">${esc(p.m)}</span><span class="w">${esc(p.w.slice(0,3))}${t.ora_partenza?' '+esc(String(t.ora_partenza).slice(0,5)):''}</span></span>
  <span class="tb"><span class="t">${esc(titleCase(tripLabel(t)))}${t.bis_parent_id?' <span class="tag warn">bus '+esc(t.bis_numero||2)+'</span>':''}</span>
  ${from||to?`<span class="route">${esc(from||'Partenza')} ${SVG(IC.arrow)} ${esc(to||'')}</span>`:''}
  <span class="bar ${pct>=100?'full':''}"><i style="width:${pct}%"></i></span>
  <span class="foot"><span>${st.pax} su ${st.cap} posti${t.autobus_id?'':' <span class="tag bad">bus da assegnare</span>'}</span>${st.res>0?`<span>da incassare <b class="money-due">${eur(st.res)}</b></span>`:'<span class="money-ok">tutto incassato</span>'}</span></span>`;
}
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
const S={tab:'oggi',fleet:[],tripLayouts:[],busLayouts:[],allBookings:null,clientQ:'',clientKey:null,showMap:false,trips:[],bookings:[],seats:[],stops:[],customers:[],cash:null,spese:[],paysToday:[],lastClose:null,operators:[],
  tripId:null,incTrip:null,search:'',loading:false,error:'',book:null,lastPayment:null,rpTrip:null,rpFilter:'',rpB:{},rpPast:null};
async function loadAll(){
  S.loading=true;S.error='';render();
  try{
    const t0=today(),from=addDays(t0,-10);
    const trips=await get('viaggi',{select:'id,id_viaggio,titolo,destinazione,luogo_partenza,descrizione,minimo_partecipanti,autobus,data_partenza,ora_partenza,prezzo,stato,pubblicato,posti_totali,posti_occupati,autobus_id,bis_parent_id,bis_numero,archiviato_at',data_partenza:'gte.'+from,archiviato_at:'is.null',order:'data_partenza.asc,titolo.asc',limit:'200'});
    S.trips=(trips||[]).filter(t=>!/annullat/i.test(String(t.stato||''))).sort((a,b)=>String(a.data_partenza).localeCompare(String(b.data_partenza))||num(a.bis_numero)-num(b.bis_numero)||String(a.titolo).localeCompare(String(b.titolo)));
    const ids=S.trips.map(t=>t.id);
    const inList='in.('+ids.join(',')+')';
    const [bookings,seats,stops,cash,spese,pays,closes,customers,fleet,tl,bl]=await Promise.all([
      ids.length?get('prenotazioni',{select:'id,viaggio_id,cliente,cliente_nome,telefono,posti,totale,pagato,stato,posti_selezionati,fermata_partenza,giorni_acconto,created_at,note,email,checkin_effettuato,checked_in_at,checkin_stato,riserva_aziendale',viaggio_id:inList,limit:'3000'}):[],
      ids.length?get('prenotazione_posti',{select:'viaggio_id,prenotazione_id,posto',viaggio_id:inList,limit:'6000'}):[],
      ids.length?get('viaggi_fermate',{select:'viaggio_id,nome,orario,ordine,attiva',viaggio_id:inList}).catch(()=>[]):[],
      rpc('dg_cash_preview_v2',{p_date:t0}).catch(e=>({error:e.message})),
      get('economia_movimenti',{select:'id,categoria,descrizione,importo,metodo,viaggio_id,created_at',tipo:'eq.Uscita',data_movimento:'eq.'+t0,operatore_user_id:'eq.'+me.user_id,order:'created_at.desc'}).catch(()=>[]),
      get('pagamenti',{select:'id,prenotazione_id,viaggio_id,cliente,importo,tipo,metodo,receipt_number,created_at,incassato_da_user_id',incassato_da_user_id:'eq.'+me.user_id,created_at:'gte.'+t0+'T00:00:00+01:00',order:'created_at.desc'}).catch(()=>[]),
      get('cassa_chiusure',{select:'data_chiusura,contanti_contati,created_at',operatore_user_id:'eq.'+me.user_id,order:'created_at.desc',limit:'1'}).catch(()=>[]),
      get('clienti',{select:'nome,cognome,telefono',limit:'3000'}).catch(()=>[]),
      get('flotta',{select:'id,titolo,marca,modello,posti,targa,stato,attivo',order:'titolo.asc'}).catch(()=>[]),
      ids.length?get('dg28_trip_layouts',{select:'viaggio_id,autobus_id,configurazione',viaggio_id:inList}).catch(()=>[]):[],
      get('dg28_bus_layouts',{select:'autobus_id,configurazione'}).catch(()=>[])
    ]);
    S.bookings=bookings||[];S.seats=seats||[];S.stops=stops||[];S.cash=cash;S.spese=spese||[];S.paysToday=pays||[];S.lastClose=(closes||[])[0]||null;S.customers=customers||[];S.fleet=(fleet||[]).filter(f=>f.attivo!==false);S.tripLayouts=tl||[];S.busLayouts=bl||[];S.allBookings=null;S.acc=null;S.extra=null;S.rpB={};
  }catch(e){S.error=e.message}
  S.loading=false;render();
  setTimeout(pollNotifiche,1500);
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
  const occ=occupied(t.id),free=seatNumbers(t).filter(x=>!occ.has(String(x)));
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
  cassa:'<path d="M4 7h16v12H4z"/><path d="M4 7l2-3h12l2 3M9 12h6"/>',
  altro:'<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>'
};
const TABS=[['oggi','Oggi'],['viaggi','Viaggi'],['prenota','Prenota'],['incassi','Incassi'],['cassa','Cassa'],['altro','Altro']];
const TITLES={oggi:'Oggi',viaggi:'Viaggi',viaggio:'Viaggio',prenota:'Nuova prenotazione',incassi:'Saldi a bordo',cassa:'La mia cassa',altro:'Altro',clienti:'Clienti',flotta:'Flotta',conti:'Contabilità',agenda:'Agenda',presenze:'Presenze a bordo',notifiche:'Avvisi',noleggi:'Noleggi',preventivi:'Preventivi',riepilogo:'Riepilogo viaggio'};

function render(){
  const app=$('#app');
  if(!session||!me){app.innerHTML=loginView();bindLogin();return}
  const view=S.tab==='viaggi'&&S.tripId?'viaggio':S.tab;document.body.dataset.view=view;setTimeout(()=>{const nb=document.querySelector('.nav [data-tab="altro"]');if(nb)nb.dataset.badge=unseen?String(unseen):''},0);
  let body='';
  if(S.error)body+=`<div class="err">${esc(S.error)} <button class="link" data-act="reload">Riprova</button></div>`;
  if(S.loading&&!S.trips.length)body+='<div class="empty">Carico i dati…</div>';
  else body+=({oggi:viewOggi,viaggi:viewViaggi,viaggio:viewViaggio,prenota:viewPrenota,incassi:viewIncassi,cassa:viewCassa,altro:viewAltro,clienti:viewClienti,flotta:viewFlotta,conti:viewConti,agenda:viewAgenda,notifiche:viewNotifiche,noleggi:viewNoleggi,preventivi:viewPreventivi,presenze:viewPresenze,riepilogo:viewRiepilogo}[view]||viewOggi)();
  app.innerHTML=`<div class="shell">
  <header class="top"><div class="id"><img class="logo" src="../delgrosso-logo-originale-bianco.png" alt="DELGROSSO Viaggi"><h1>${esc(TITLES[view])}</h1></div>
  <div class="tools"><button data-act="reload" aria-label="Aggiorna">${S.loading?'…':'↻'}</button><a href="../index.html" aria-label="Apri il gestionale completo">${SVG(IC.ext)}<span class="lbl">Versione completa</span></a></div></header>
  <main>${body}</main>
  <nav class="nav" aria-label="Menu principale"><div class="in"><img class="rail-logo" src="../delgrosso-logo-originale-bianco.png" alt="DELGROSSO Viaggi">${TABS.map(([k,l])=>`<button data-tab="${k}" class="${S.tab===k||(k==='altro'&&['clienti','flotta','conti','agenda','notifiche','noleggi','preventivi','riepilogo'].includes(S.tab))?'on':''}" aria-current="${S.tab===k?'page':'false'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]}</svg>${l}</button>`).join('')}</div></nav>
  </div>`;
}

/* ----- login ----- */
let loginUser='nicola';
function loginView(){
  return `<form class="login" id="loginForm" autocomplete="on">
  <img class="logo" src="../delgrosso-logo-originale-bianco.png" alt="DELGROSSO Viaggi">
  <h1>Il gestionale</h1><p>Scegli chi sei e scrivi la tua password.</p>
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
  const nt=nextTrips(),cash=cashInHand(),t0=today(),hr=new Date().getHours();
  const week=upcoming().filter(t=>t.data_partenza<=addDays(t0,7)).reduce((a,t)=>a+tripStats(t).res,0);
  const inc=defaultIncTrip(),incT=inc&&tripById(inc);
  const saluto=hr<13?'Buongiorno':hr<18?'Buon pomeriggio':'Buonasera';
  const sub=nt.length?(nt[0].data_partenza===t0?'Oggi partono ':dateLong(nt[0].data_partenza)+' partono ')+(nt.length===1?'1 bus.':nt.length+' bus.'):'Nessuna partenza in programma.';
  const todo=[];
  for(const t of upcoming().filter(t=>t.data_partenza<=addDays(t0,30)&&!t.autobus_id))todo.push({tone:'bad',html:`Assegna l’autobus a <b>${esc(titleCase(tripLabel(t)))}</b> del ${esc(dateShort(t.data_partenza))}`,act:`data-act="openTrip" data-id="${t.id}"`});
  const lateAcc=S.bookings.filter(b=>active(b)&&num(b.pagato)<=0&&num(b.totale)>0&&(tripById(b.viaggio_id)||{}).data_partenza>=t0&&String(b.created_at||'').slice(0,10)<=addDays(t0,-num(b.giorni_acconto||2)));
  for(const b of lateAcc.slice(0,3)){const t=tripById(b.viaggio_id);todo.push({tone:'warn',html:`<b>${esc(nameOf(b))}</b> non ha ancora dato l’acconto per ${esc(titleCase(tripLabel(t)))} del ${esc(dateShort(t.data_partenza))}`,act:`data-act="openBooking" data-id="${b.id}"`})}
  if(lateAcc.length>3)todo.push({tone:'warn',html:`Altri ${lateAcc.length-3} clienti senza acconto: li vedi aprendo ogni viaggio`});
  const lc=S.lastClose&&S.lastClose.data_chiusura;
  if(!lc||lc<addDays(t0,-2))todo.push({tone:'warn',html:`Chiudi la cassa: ${lc?'l’ultima chiusura è del '+esc(dateShort(lc)):'non l’hai mai chiusa'}`,act:'data-tab="cassa"'});
  const left=`<div class="col">
   ${incT?`<button class="big gold" data-act="goInc" data-id="${incT.id}">${SVG(IC.coins)}<span class="bt"><b>Saldi a bordo</b><span>${esc(titleCase(tripLabel(incT)))}, ${esc(dateShort(incT.data_partenza))}: da incassare ${eur(tripStats(incT).res)}</span></span></button>`:''}
   <button class="big navy" data-tab="prenota">${SVG(IC.plus)}<span class="bt"><b>Nuova prenotazione</b><span>Cliente, viaggio, acconto</span></span></button>
   ${nt.length?`<h2 style="margin:8px 2px 0;font-size:21px">Prossime partenze</h2><div class="list2" style="grid-template-columns:1fr">${nt.map(tripRow).join('')}</div>`:''}
  </div>`;
  const right=`<div class="col">
   <div class="grid2"><div class="kpi"><span>Contanti in mano</span><b>${cash==null?'—':eur(cash)}</b></div><div class="kpi"><span>Da incassare in 7 giorni</span><b>${eur(week)}</b></div></div>
   <section class="card"><h2>Da fare</h2>${todo.length?todo.map(x=>`<button class="link" style="display:flex;gap:10px;align-items:flex-start;color:var(--strada);font-weight:400;padding:8px 0;border-top:1px solid #EEF2F6" ${x.act||''}><span class="tag ${x.tone}" style="padding:2px 8px">!</span><span>${x.html}</span></button>`).join(''):'<span class="muted">Tutto in ordine.</span>'}</section>
   <button class="link small" style="align-self:center" data-act="logout">Esci (${esc(me.nome||me.username)})</button>
  </div>`;
  return `<div class="greet"><h2>${saluto}, ${esc(me.nome||me.username)}</h2><p>${esc(sub)}</p></div><div class="oggi">${left}${right}</div>`;
}

/* ----- Viaggi ----- */
function tripRow(t){return `<button class="ticket" data-act="openTrip" data-id="${t.id}" aria-label="${esc(tripLabel(t)+' '+dateLong(t.data_partenza))}">${ticketHtml(t)}</button>`}
function viewViaggi(){
  const up=upcoming();
  return `<button class="btn" data-act="tripForm">＋ Nuovo viaggio</button><div class="list2">`+(up.length?up.map(tripRow).join(''):'<div class="empty">Nessun viaggio in programma.</div>')+'</div>';
}
function viewViaggio(){
  const t=tripById(S.tripId);if(!t){S.tripId=null;return viewViaggi()}
  const st=tripStats(t),q=fold(S.search);
  const list=st.bs.filter(b=>!q||fold(nameOf(b)+' '+b.telefono+' '+b.fermata_partenza).includes(q)).sort((a,b)=>nameOf(a).localeCompare(nameOf(b),'it'));
  const paid=st.bs.filter(b=>residuo(b)<=0).length;
  let h=`<button class="link" data-act="backTrips">‹ Tutti i viaggi</button>
  <div class="ticket big-ticket">${ticketHtml(t,true)}</div>
  <button class="btn ghost" data-act="presenze" data-id="${t.id}">${SVG(IC.user)}Presenze a bordo · ${bookingsOf(t.id).filter(onBoard).reduce((a,b)=>a+num(b.posti),0)} su ${st.pax}</button>
  <div class="grid2"><button class="btn gold" data-act="goInc" data-id="${t.id}">Saldi a bordo</button><button class="btn" data-act="bookTrip" data-id="${t.id}">${SVG(IC.plus)} Prenota qui</button></div>
  <div class="actions">
   <button class="action" data-act="toggleMap" aria-pressed="${S.showMap}">${SVG(IC.seat)}${S.showMap?'Nascondi piantina':'Piantina posti'}</button>
   <button class="action" data-act="paxList" data-id="${t.id}">${SVG(IC.list)}Lista passeggeri</button>
   <button class="action" data-act="waGroup" data-id="${t.id}">${SVG(IC.chat)}Numeri WhatsApp</button>
   <button class="action" data-act="tripForm" data-id="${t.id}">${SVG(IC.edit)}Modifica viaggio</button>
   <button class="action wide" data-act="riepilogo" data-id="${t.id}">${SVG(IC.coins)}Riepilogo pagamenti e PDF di chi deve pagare</button>
  </div>
  ${t.autobus_id?'':'<div class="note">Nessun autobus assegnato: tocca «Modifica viaggio» per sceglierlo.</div>'}
  ${S.showMap?`<section class="card"><h2>Piantina · ${esc(busName(t.autobus_id)||'posti')}</h2>${seatMapHtml(t,{})}<span class="small muted">Tocca un posto occupato per aprire la prenotazione.</span></section>`:''}
  <input class="search" type="search" placeholder="Cerca passeggero, telefono o fermata" value="${esc(S.search)}" data-input="search" aria-label="Cerca passeggero">
  <p class="small muted" style="margin:0">${st.bs.length} prenotazioni: ${paid} pagate, ${st.bs.length-paid} devono ancora qualcosa. ${st.free} posti liberi.</p>`;
  h+='<div class="list2">'+list.map(b=>{
    const r=residuo(b),seats=seatsOf(b),wa=waNumber(b.telefono);
    const tag=r<=0?'<span class="tag ok">Pagato</span>':num(b.pagato)<=0?`<span class="tag bad">Senza acconto · ${eur(r)}</span>`:`<span class="tag warn">Resta ${eur(r)}</span>`;
    return `<div class="pax" style="flex-direction:column;align-items:stretch"><div class="row" style="align-items:flex-start"><div class="who"><button class="link" style="padding:0;font-size:16px;font-weight:700;color:var(--ink)" data-act="openBooking" data-id="${b.id}">${esc(nameOf(b))} ›</button><span>${num(b.posti)} ${num(b.posti)===1?'posto':'posti'}${seats.length?' · '+esc(seats.join(', ')):''}${b.fermata_partenza?' · '+esc(titleCase(b.fermata_partenza)):''}</span></div>${tag}</div>
    ${b.telefono?`<div class="contacts"><a href="tel:${esc(phoneDigits(b.telefono))}">Chiama ${esc(b.telefono)}</a>${wa?`<a href="https://wa.me/${wa}" target="_blank" rel="noopener">WhatsApp</a>`:''}</div>`:''}</div>`;
  }).join('')||'<div class="empty">Nessun passeggero trovato.</div>';
  return h+'</div>';
}

/* ----- Incassi: saldi a bordo ----- */
function viewIncassi(){
  const t0=today();
  const trips=S.trips.filter(t=>t.data_partenza>=addDays(t0,-10)&&(tripStats(t).res>0||t.id===S.incTrip));
  if(!S.incTrip||!tripById(S.incTrip))S.incTrip=defaultIncTrip();
  const t=tripById(S.incTrip);
  let h=`<div class="chips" role="tablist" aria-label="Viaggio">${trips.map(x=>`<button class="chip ${x.id===S.incTrip?'on':''}" data-act="incTrip" data-id="${x.id}"><b>${esc(dateShort(x.data_partenza))}</b> ${esc(titleCase(tripLabel(x)))}${x.bis_parent_id?' · bus '+esc(x.bis_numero||2):''}</button>`).join('')}</div>`;
  if(!t)return h+'<div class="empty">Nessun saldo da incassare. Ottimo!</div>';
  const st=tripStats(t),due=st.bs.filter(b=>residuo(b)>0).sort((a,b)=>nameOf(a).localeCompare(nameOf(b),'it'));
  const doneToday=S.paysToday.filter(p=>p.viaggio_id===t.id);
  const incToday=doneToday.reduce((a,p)=>a+num(p.importo),0);
  h+=`<div class="hero"><div style="display:flex;flex-direction:column;gap:3px"><b style="font-size:18px">${esc(titleCase(tripLabel(t)))}${t.bis_parent_id?' · bus '+esc(t.bis_numero||2):''}</b><span class="small" style="color:#C9D6E6">${esc(dateLong(t.data_partenza))}</span><span>Incassati oggi <b>${eur(incToday)}</b></span></div><div style="text-align:right"><span class="big-n">${eur(st.res)}</span><div class="small" style="color:#C9D6E6">${due.length} da saldare</div></div></div>
  <p class="small muted" style="margin:0">Tocca il pulsante quando il passeggero ti paga. Viene registrato in contanti a nome tuo. Nessun messaggio al cliente.</p>`;
  if(S.lastPayment&&S.lastPayment.tripId===t.id)h+=`<div class="note row"><span>Registrato: ${esc(S.lastPayment.name)} ${eur(S.lastPayment.amount)}</span><span style="display:flex;gap:14px">${S.lastPayment.id?`<button class="link" data-act="shareRcpt" data-id="${S.lastPayment.id}" data-b="${S.lastPayment.bookingId}">Invia ricevuta</button>`:''}<button class="link" data-act="undoPay">Annulla</button></span></div>`;
  h+='<div class="list2">'+due.map(b=>{const r=residuo(b),seats=seatsOf(b);return `<div class="pax"><div class="who"><b>${esc(nameOf(b))}</b><span>${num(b.posti)} ${num(b.posti)===1?'posto':'posti'}${seats.length?' · '+esc(seats.slice(0,8).join(', '))+(seats.length>8?'…':''):''}${num(b.pagato)<=0?' · nessun acconto':''}</span><button class="link small" data-act="payOther" data-id="${b.id}">Importo diverso</button></div><button class="pay" data-act="pay" data-id="${b.id}">Incassato ${eur(r)}</button></div>`}).join('')+'</div>'+(due.length?'':'<div class="empty">Tutti hanno pagato su questo viaggio.</div>');
  if(doneToday.length)h+=`<section class="card"><h2>Incassati oggi su questo viaggio</h2>${doneToday.map(p=>`<div class="line"><span>${esc(p.cliente||'')}</span><b>${eur(p.importo)}</b></div>`).join('')}</section>`;
  return h;
}

/* ----- Cassa ----- */
let speseCat='Parcheggio';
function viewCassa(){
  const c=S.cash,cash=cashInHand(),other=otherOperator();
  let h='';
  if(c&&c.error)h+=`<div class="err">Non riesco a calcolare la cassa: ${esc(c.error)}</div>`;
  h+=`<section class="card" style="align-items:center"><span class="muted" style="font-weight:600">Contanti che dovresti avere ora</span><div class="money">${cash==null?'—':eur(cash)}</div>`;
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

/* ----- piantine ----- */
const busName=id=>{const f=S.fleet.find(x=>x.id===id);return f?(f.titolo||[f.marca,f.modello].filter(Boolean).join(' '))+(f.targa?' · '+f.targa:''):''};
function layoutFor(t){
  const tl=S.tripLayouts.find(x=>x.viaggio_id===t.id&&(!t.autobus_id||!x.autobus_id||x.autobus_id===t.autobus_id));
  const bl=t.autobus_id&&S.busLayouts.find(x=>x.autobus_id===t.autobus_id);
  const rows=(tl&&tl.configurazione&&tl.configurazione.rows)||(bl&&bl.configurazione&&bl.configurazione.rows);
  if(Array.isArray(rows)&&rows.length)return rows;
  const out=[],n=num(t.posti_totali);// piantina generica 2+2
  for(let i=1;i<=n;i+=4){const c=[];for(let k=0;k<4;k++){if(k===2)c.push({type:'aisle'});const v=i+k;c.push(v<=n?{type:'seat',id:String(v)}:{type:'empty'})}out.push({cells:c})}
  return out;
}
const seatCells=t=>layoutFor(t).flatMap(r=>(r.cells||[]).filter(c=>c.type==='seat'));
const seatId=c=>String(c.label||c.id||'');
const seatUsable=c=>!c.status||c.status==='available';
function seatNumbers(t){const xs=seatCells(t).filter(seatUsable).map(c=>Number(seatId(c))).filter(Number.isFinite);return xs.length?[...new Set(xs)].sort((a,b)=>a-b):Array.from({length:num(t.posti_totali)},(_,i)=>i+1)}
function seatOwner(t,seat){
  for(const s of S.seats)if(s.viaggio_id===t.id&&String(s.posto)===seat){const b=S.bookings.find(x=>x.id===s.prenotazione_id&&active(x));if(b)return b}
  return bookingsOf(t.id).find(b=>seatsOf(b).includes(seat))||null;
}
/* opts.pick = Set dei posti scelti (modalità scelta), opts.except = prenotazione che sta cambiando posti */
function seatMapHtml(t,opts){
  const rows=layoutFor(t),pick=opts.pick;
  const maxCols=Math.max(...rows.map(r=>(r.cells||[]).length),1);
  return `<div class="seatmap" style="--cols:${maxCols}"><div class="seatfront">FRONTE · AUTISTA</div>${rows.map(r=>`<div class="seatrow">${(r.cells||[]).map(c=>{
    if(c.type!=='seat')return `<span class="sc ${c.type==='door'?'door':'gap'}">${c.type==='door'?'porta':''}</span>`;
    const id=seatId(c),owner=seatOwner(t,id),mine=owner&&opts.except&&owner.id===opts.except,usable=seatUsable(c);
    if(pick){
      const on=pick.has(id),busy=(owner&&!mine)||!usable;
      return `<button class="sc seat ${on?'sel':busy?'busy':'free'}" ${busy?'disabled':''} data-act="pickSeat" data-v="${esc(id)}" aria-pressed="${on}" aria-label="Posto ${esc(id)}${busy?' occupato':''}">${esc(id)}</button>`;
    }
    if(owner)return `<button class="sc seat busy" data-act="openBooking" data-id="${owner.id}" title="${esc(nameOf(owner))}" aria-label="Posto ${esc(id)}: ${esc(nameOf(owner))}">${esc(id)}</button>`;
    return `<span class="sc seat ${usable?'free':'off'}" aria-label="Posto ${esc(id)} ${usable?'libero':'non disponibile'}">${esc(id)}</span>`;
  }).join('')}</div>`).join('')}</div>`;
}

/* ----- Altro, Clienti, Flotta ----- */
function viewAltro(){
  const ico={riepilogo:IC.coins,clienti:IC.user,conti:IC.chart,agenda:IC.cal,noleggi:IC.van,preventivi:IC.doc,notifiche:IC.bell,flotta:IC.bus};
  const it=(k,t,d)=>`<button class="tile" data-tab="${k}">${SVG(ico[k])}<span class="tt">${t}</span><span class="td">${d}</span></button>`;
  return `<div class="tiles">${it('riepilogo','Riepilogo viaggio','Chi ha saldato, chi ha l’acconto, chi deve ancora pagare. Con PDF')}${it('clienti','Clienti','Cerca un cliente: viaggi fatti, pagamenti, telefono')}${it('conti','Contabilità','Nicola, Raffaele, compenso, guadagno per viaggio')}${it('agenda','Agenda','Appuntamenti, scadenze, promemoria')}${it('noleggi','Noleggi','Noleggi bus con prezzi e pagamenti')}${it('preventivi','Preventivi','Richieste dal sito e dal gestionale')}${it('notifiche','Avvisi','Nuove prenotazioni e messaggi del sistema')}${it('flotta','Flotta','Autobus, posti e targhe')}</div>
  <section class="card"><h2>Versione completa</h2><span class="muted small">Per le cose rare (piantine nuove, bus BIS, locandine, rimborsi, impostazioni) resta disponibile il gestionale di prima.</span>
  <a class="btn ghost" href="../index.html">${SVG(IC.ext)}Apri la versione completa</a></section>
  <button class="btn light" data-act="logout">${SVG(IC.out)}Esci (${esc(me.nome||me.username)})</button>`;
}
async function ensureAllBookings(){
  if(S.allBookings)return;
  const [bs,ts,ps]=await Promise.all([
    get('prenotazioni',{select:'id,viaggio_id,cliente,cliente_nome,telefono,email,posti,totale,pagato,stato,posti_selezionati,fermata_partenza,created_at',order:'created_at.desc',limit:'5000'}),
    get('viaggi',{select:'id,titolo,destinazione,data_partenza,bis_numero,bis_parent_id',limit:'2000'}),
    get('pagamenti',{select:'id,prenotazione_id,importo,tipo,metodo,data_pagamento,receipt_number,receipt_professional_path,receipt_professional_generated_at,incassato_da',order:'data_pagamento.asc',limit:'10000'})
  ]);
  S.allBookings=bs||[];S.allTrips=ts||[];S.allPays=ps||[];
}
const clientKey=b=>phoneDigits(b.telefono).slice(-9)||fold(nameOf(b));
function viewClienti(){
  if(!S.allBookings){ensureAllBookings().then(render).catch(e=>{S.error=e.message;render()});return '<div class="empty">Carico l’archivio clienti…</div>'}
  const groups=new Map();
  for(const b of S.allBookings){const k=clientKey(b);if(!groups.has(k))groups.set(k,{key:k,name:nameOf(b),tel:b.telefono||'',bs:[]});groups.get(k).bs.push(b)}
  if(S.clientKey&&groups.has(S.clientKey))return viewCliente(groups.get(S.clientKey));
  const q=fold(S.clientQ),qd=phoneDigits(S.clientQ);
  const list=[...groups.values()].filter(g=>!q||fold(g.name).includes(q)||(qd.length>=3&&phoneDigits(g.tel).includes(qd))).sort((a,b)=>a.name.localeCompare(b.name,'it'));
  return `<input class="search" type="search" data-input="clientQ" value="${esc(S.clientQ)}" placeholder="Cerca per nome o telefono" aria-label="Cerca cliente">
  <p class="small muted" style="margin:0">${list.length} clienti</p><div class="list2">${list.slice(0,150).map(g=>{const res=g.bs.filter(active).reduce((a,b)=>a+residuo(b),0);
    return `<button class="trip" data-act="openClient" data-id="${esc(g.key)}"><div class="row"><span class="t">${esc(g.name)}</span>${res>0?`<span class="tag warn">deve ${eur(res)}</span>`:''}</div><span class="small muted">${esc(g.tel||'senza telefono')} · ${g.bs.length} ${g.bs.length===1?'prenotazione':'prenotazioni'}</span></button>`}).join('')}</div>`;
}
function viewCliente(g){
  const trip=id=>(S.allTrips||[]).find(t=>t.id===id)||tripById(id)||{};
  const wa=waNumber(g.tel);
  const bs=g.bs.slice().sort((a,b)=>String(trip(b.viaggio_id).data_partenza).localeCompare(String(trip(a.viaggio_id).data_partenza)));
  const paid=bs.filter(active).reduce((a,b)=>a+num(b.pagato),0),res=bs.filter(active).reduce((a,b)=>a+residuo(b),0);
  return `<button class="link" data-act="closeClient">‹ Tutti i clienti</button>
  <div class="hero"><div style="display:flex;flex-direction:column;gap:3px"><b style="font-size:18px">${esc(g.name)}</b><span class="small" style="color:#C9D6E6">${esc(g.tel||'senza telefono')} · ${bs.length} prenotazioni</span></div><span class="big-n">${eur(res)}</span></div>
  ${g.tel?`<div class="contacts"><a href="tel:${esc(phoneDigits(g.tel))}">Chiama</a>${wa?`<a href="https://wa.me/${wa}" target="_blank" rel="noopener">WhatsApp</a>`:''}</div>`:''}
  <div class="grid2"><div class="kpi"><span>Pagato in totale</span><b>${eur(paid)}</b></div><div class="kpi"><span>Deve ancora</span><b>${eur(res)}</b></div></div>
  ${bs.map(b=>{const t=trip(b.viaggio_id),pays=(S.allPays||[]).filter(p=>p.prenotazione_id===b.id);
    return `<section class="card"><div class="row"><b>${esc(tripLabel(t))} · ${esc(dateShort(t.data_partenza))}${t.bis_parent_id?' (bus '+esc(t.bis_numero||2)+')':''}</b>${!active(b)?'<span class="tag bad">Annullata</span>':residuo(b)<=0?'<span class="tag ok">Pagato</span>':`<span class="tag warn">Resta ${eur(residuo(b))}</span>`}</div>
    <span class="small muted">${num(b.posti)} posti${seatsOf(b).length?' · '+esc(seatsOf(b).join(', ')):''} · ${esc(b.fermata_partenza||'')} · totale ${eur(b.totale)}</span>
    ${pays.map(p=>`<div class="line"><span>${esc(String(p.data_pagamento||'').split('-').reverse().join('/'))} · ${esc(p.tipo||'')} · ${esc(p.metodo||'')}${p.incassato_da?' · '+esc(p.incassato_da):''}</span><b>${eur(p.importo)} <button class="link small" style="padding:0" data-act="receipt" data-id="${p.id}">PDF</button></b></div>`).join('')}
    ${tripById(b.viaggio_id)&&active(b)?`<button class="link" data-act="openBooking" data-id="${b.id}">Apri prenotazione ›</button>`:''}</section>`}).join('')}`;
}
function viewFlotta(){
  return `<div class="list2">${S.fleet.map(f=>{const next=upcoming().filter(t=>t.autobus_id===f.id).slice(0,3);
    return `<section class="card"><div class="row"><b>${esc(f.titolo||[f.marca,f.modello].filter(Boolean).join(' '))}</b><span class="tag ${/manut|fermo|guast/i.test(f.stato||'')?'bad':'ok'}">${esc(f.stato||'attivo')}</span></div>
    <span class="small muted">${esc(f.targa||'targa n/d')} · ${num(f.posti)} posti</span>
    ${next.length?next.map(t=>`<div class="line"><span>${esc(dateShort(t.data_partenza))} · ${esc(tripLabel(t))}</span></div>`).join(''):'<span class="small muted">Nessun viaggio assegnato a breve</span>'}</section>`}).join('')||'<div class="empty">Nessun mezzo.</div>'}</div>`;
}

/* ----- viaggio: crea / modifica ----- */
function tripFormSheet(id){
  const t=id?tripById(id):null;
  const stops=t?(S.stops.filter(x=>x.viaggio_id===t.id).sort((a,b)=>num(a.ordine)-num(b.ordine)).map(x=>x.nome)):[];
  const stopText=(stops.length?stops:String(t&&t.luogo_partenza||'').split('|').map(x=>x.trim()).filter(Boolean)).join('\n')||(t?'':'San Severo\nApricena\nSan Nicandro Garganico');
  const v=k=>esc(t&&t[k]!=null?t[k]:'');
  sheet(`<h3>${t?'Modifica viaggio':'Nuovo viaggio'}</h3>
  <label class="f">Titolo<input id="tfTitolo" value="${v('titolo')}" placeholder="es. NAPOLI & SPACCANAPOLI 20/12/2026"></label>
  <label class="f">Destinazione<input id="tfDest" value="${v('destinazione')}" placeholder="es. Napoli"></label>
  <div class="grid2"><label class="f">Data<input id="tfData" type="date" value="${v('data_partenza')}"></label><label class="f">Ora<input id="tfOra" type="time" value="${esc(String(t&&t.ora_partenza||'').slice(0,5))}"></label></div>
  <div class="grid2"><label class="f">Prezzo a persona (€)<input id="tfPrezzo" type="number" inputmode="decimal" min="0" step="0.01" value="${v('prezzo')}"></label><label class="f">Posti totali<input id="tfPosti" type="number" inputmode="numeric" min="1" value="${v('posti_totali')}"></label></div>
  <label class="f">Autobus<select id="tfBus"><option value="">Da assegnare</option>${S.fleet.map(f=>`<option value="${f.id}" ${t&&t.autobus_id===f.id?'selected':''}>${esc(busName(f.id))} · ${num(f.posti)} posti</option>`).join('')}</select></label>
  <label class="f">Fermate di partenza (una per riga)<textarea id="tfStops" rows="4">${esc(stopText)}</textarea></label>
  <label class="f">Descrizione (facoltativa)<textarea id="tfDesc" rows="3">${v('descrizione')}</textarea></label>
  <div class="grid2"><label class="f">Sul sito<select id="tfPub"><option value="SI" ${t&&t.pubblicato==='SI'?'selected':''}>Visibile</option><option value="NO" ${!t||t.pubblicato!=='SI'?'selected':''}>Nascosto</option></select></label>
  <label class="f">Stato<select id="tfStato">${['Programmato','Confermato','SOLD OUT','Concluso'].concat(t&&t.stato&&!['Programmato','Confermato','SOLD OUT','Concluso'].includes(t.stato)?[t.stato]:[]).map(x=>`<option ${t&&t.stato===x?'selected':''}>${esc(x)}</option>`).join('')}</select></label></div>
  <span class="small muted">La locandina e il bus BIS si gestiscono dalla versione completa.</span>
  <button class="btn" id="tfOk">${t?'Salva modifiche':'Crea viaggio'}</button><button class="btn light" id="tfNo">Annulla</button>`);
  $('#tfNo').onclick=closeSheet;
  $('#tfBus').onchange=e=>{const f=S.fleet.find(x=>x.id===e.target.value);if(f&&num(f.posti)&&!t)$('#tfPosti').value=num(f.posti)};
  $('#tfOk').onclick=e=>guard(e.currentTarget,async()=>{
    const stops=$('#tfStops').value.split('\n').map(x=>x.trim()).filter(Boolean),busId=$('#tfBus').value,f=S.fleet.find(x=>x.id===busId);
    const body={titolo:$('#tfTitolo').value.trim(),destinazione:$('#tfDest').value.trim(),data_partenza:$('#tfData').value,ora_partenza:$('#tfOra').value||null,
      prezzo:r2($('#tfPrezzo').value),posti_totali:Math.floor(num($('#tfPosti').value)),autobus_id:busId||null,autobus:f?busName(f.id).split(' · ')[0]:null,
      descrizione:$('#tfDesc').value.trim()||null,pubblicato:$('#tfPub').value,stato:$('#tfStato').value,minimo_partecipanti:num(t&&t.minimo_partecipanti)||40};
    if(!body.titolo||!body.destinazione||!body.data_partenza)throw new Error('Titolo, destinazione e data sono obbligatori.');
    if(!(body.posti_totali>=1))throw new Error('Scrivi i posti totali.');
    if(!stops.length)throw new Error('Scrivi almeno una fermata.');
    if(f&&num(f.posti)&&body.posti_totali>num(f.posti))throw new Error('Questo autobus ha solo '+num(f.posti)+' posti.');
    const nid=t?t.id:uuid();
    await rpc('dg_save_trip_v14',{p_id:nid,p_data:body,p_stops:stops});
    closeSheet();toast(t?'Viaggio aggiornato':'Viaggio creato');S.tab='viaggi';S.tripId=nid;await loadAll();
  });
}

/* ----- prenotazione: modifica, posti, sposta, annulla ----- */
let seatPick=null;
function bookingBody(b,over){return {viaggio_id:b.viaggio_id,fermata_partenza:b.fermata_partenza||'Non indicata',giorni_acconto:num(b.giorni_acconto)||2,cliente:nameOf(b),cliente_nome:nameOf(b),telefono:b.telefono||null,email:b.email||null,posti:num(b.posti)||1,totale:num(b.totale),stato:b.stato||'In attesa acconto',note:b.note||null,...over}}
const currentSeats=b=>{const xs=S.seats.filter(s=>s.prenotazione_id===b.id).map(s=>String(s.posto));return xs.length?xs:seatsOf(b)};
function bookingSheet(id){
  const b=S.bookings.find(x=>x.id===id);if(!b)return toast('Prenotazione non trovata: aggiorna.',true);
  const t=tripById(b.viaggio_id),r=residuo(b),wa=waNumber(b.telefono);
  sheet(`<h3>${esc(nameOf(b))}</h3>
  <span class="muted">${esc(t?titleCase(tripLabel(t))+', '+dateShort(t.data_partenza):'')} · ${num(b.posti)} ${num(b.posti)===1?'posto':'posti'}${currentSeats(b).length?' (n. '+esc(currentSeats(b).join(', '))+')':''}${b.fermata_partenza?' · da '+esc(titleCase(b.fermata_partenza)):''}</span>
  <div class="line"><span>Totale</span><b>${eur(b.totale)}</b></div><div class="line"><span>Pagato</span><b>${eur(b.pagato)}</b></div><div class="line"><span>Resta</span><b>${eur(r)}</b></div>
  ${b.telefono?`<div class="contacts"><a href="tel:${esc(phoneDigits(b.telefono))}">Chiama</a>${wa?`<a href="https://wa.me/${wa}" target="_blank" rel="noopener">WhatsApp</a>`:''}</div>`:''}
  ${r>0?`<button class="btn gold" id="bsPay">Registra pagamento</button>`:''}
  <div class="actions two">
  <button class="action" id="bsEdit">${SVG(IC.edit)}Modifica dati</button>
  <button class="action" id="bsSeats">${SVG(IC.seat)}Cambia posti</button>
  <button class="action" id="bsMove">${SVG(IC.move)}Sposta viaggio</button>
  <button class="action" id="bsPdf">${SVG(IC.doc)}Conferma PDF</button>
  </div>
  <div id="bsPays" class="small muted">Carico i pagamenti…</div>
  ${num(b.pagato)>0?`<button class="action" id="bsRefund">${SVG(IC.coins)}Registra un rimborso</button>`:''}
  <button class="action danger" id="bsCancel">${SVG(IC.x)}Annulla prenotazione</button>
  <button class="btn light" id="bsClose">Chiudi</button>`);
  bookingPayments(b.id).then(ps=>{const el=$('#bsPays');if(!el)return;el.className='';el.innerHTML=ps.length?`<b style="font-size:15px">Pagamenti</b>${ps.map(p=>`<div class="line"><span>${esc(dateShort(p.data_pagamento))} · ${esc(p.tipo||'')} · ${esc(p.metodo||'')}</span><span style="display:flex;gap:10px;align-items:center"><b>${eur(p.importo)}</b>${num(p.importo)>0?`<button class="link small" style="padding:0" data-act="shareRcpt" data-id="${p.id}" data-b="${b.id}">Invia ricevuta</button>`:''}</span></div>`).join('')}`:'<span class="small muted">Nessun pagamento registrato.</span>'}).catch(()=>{const el=$('#bsPays');if(el)el.textContent=''});
  if($('#bsRefund'))$('#bsRefund').onclick=()=>refundSheet(b);
  $('#bsClose').onclick=closeSheet;
  if($('#bsPay'))$('#bsPay').onclick=()=>askPay(b,r,true);
  $('#bsEdit').onclick=()=>editBookingSheet(b);
  $('#bsPdf').onclick=()=>shareConfirmationSheet(b);
  $('#bsSeats').onclick=()=>{seatPick={id:b.id,trip:b.viaggio_id,sel:new Set(currentSeats(b)),need:num(b.posti)};seatSheet()};
  $('#bsMove').onclick=()=>moveSheet(b);
  $('#bsCancel').onclick=()=>cancelSheet(b);
}
function editBookingSheet(b){
  const t=tripById(b.viaggio_id);
  sheet(`<h3>Modifica prenotazione</h3>
  <label class="f">Nome e cognome<input id="ebNome" value="${esc(nameOf(b))}"></label>
  <label class="f">Telefono<input id="ebTel" type="tel" value="${esc(b.telefono||'')}"></label>
  <label class="f">Fermata di partenza<input id="ebFerm" list="ebFermL" value="${esc(b.fermata_partenza||'')}"><datalist id="ebFermL">${FERMATE.map(x=>`<option value="${esc(x)}">`).join('')}</datalist></label>
  <div class="grid2"><label class="f">Persone<input id="ebPosti" type="number" min="1" value="${num(b.posti)}"></label><label class="f">Totale (€)<input id="ebTot" type="number" min="0" step="0.01" value="${num(b.totale)}"></label></div>
  <label class="f">Note<input id="ebNote" value="${esc(b.note||'')}"></label>
  <span class="small muted">Se cambi il numero di persone, i posti vengono riassegnati in automatico (puoi poi sceglierli da «Cambia posti»). Prezzo a persona: ${eur(t&&t.prezzo)}.</span>
  <button class="btn" id="ebOk">Salva</button><button class="btn light" id="ebNo">Annulla</button>`);
  $('#ebNo').onclick=()=>bookingSheet(b.id);
  $('#ebPosti').oninput=e=>{if(t)$('#ebTot').value=r2(num(t.prezzo)*num(e.target.value))};
  $('#ebOk').onclick=e=>guard(e.currentTarget,async()=>{
    const posti=Math.floor(num($('#ebPosti').value)),tot=r2($('#ebTot').value),nome=$('#ebNome').value.trim(),ferm=$('#ebFerm').value.trim();
    if(nome.length<3||!ferm)throw new Error('Nome e fermata sono obbligatori.');
    if(!(posti>=1))throw new Error('Persone non valide.');
    if(tot<num(b.pagato))throw new Error('Il totale non può essere minore di quanto già pagato ('+eur(b.pagato)+').');
    let seats=currentSeats(b);
    if(posti!==seats.length&&t){const occ=occupied(t.id,b.id),free=seatNumbers(t).filter(x=>!occ.has(String(x))).map(String);
      seats=posti<seats.length?seats.slice(0,posti):seats.concat(free.filter(x=>!seats.includes(x)).slice(0,posti-seats.length));if(seats.length!==posti)seats=[]}
    await rpc('dg_save_booking_v13',{p_id:b.id,p_data:bookingBody(b,{cliente:nome,cliente_nome:nome,telefono:$('#ebTel').value.trim()||null,fermata_partenza:ferm,posti,totale:tot,note:$('#ebNote').value.trim()||null}),p_seats:seats});
    closeSheet();toast('Prenotazione aggiornata');await loadAll();
  });
}
function seatSheet(){
  const P=seatPick,b=S.bookings.find(x=>x.id===P.id),t=tripById(P.trip);
  sheet(`<h3>Scegli ${P.need} ${P.need===1?'posto':'posti'}</h3><span class="muted">${esc(nameOf(b))} · ${esc(tripLabel(t))} · scelti ${P.sel.size} di ${P.need}</span>
  ${seatMapHtml(t,{pick:P.sel,except:b.id})}
  <div class="legend small"><span class="sc seat free"></span> libero <span class="sc seat sel"></span> scelto <span class="sc seat busy"></span> occupato</div>
  <button class="btn" id="spOk" ${P.sel.size!==P.need?'disabled':''}>Salva posti</button><button class="btn light" id="spNo">Annulla</button>`);
  $('#spNo').onclick=()=>{seatPick=null;bookingSheet(b.id)};
  $('#spOk').onclick=e=>guard(e.currentTarget,async()=>{
    const seats=[...P.sel].sort((a,b)=>num(a)-num(b));
    await rpc('dg_save_booking_v13',{p_id:b.id,p_data:bookingBody(b,{viaggio_id:t.id}),p_seats:seats});
    seatPick=null;closeSheet();toast('Posti aggiornati: '+seats.join(', '));await loadAll();
  });
}
function moveSheet(b){
  const from=tripById(b.viaggio_id),opts=upcoming().filter(t=>t.id!==b.viaggio_id&&tripStats(t).free>=num(b.posti));
  sheet(`<h3>Sposta su un altro viaggio</h3><span class="muted">${esc(nameOf(b))} · ${num(b.posti)} posti · da ${esc(tripLabel(from))} ${esc(dateShort(from&&from.data_partenza))}</span>
  <label class="f">Nuovo viaggio<select id="mvTrip">${opts.map(t=>`<option value="${t.id}">${esc(dateShort(t.data_partenza))} · ${esc(tripLabel(t))}${t.bis_parent_id?' (bus '+esc(t.bis_numero||2)+')':''} · ${tripStats(t).free} liberi</option>`).join('')}</select></label>
  <span class="small muted">I pagamenti già fatti restano collegati alla prenotazione. I posti vengono assegnati in automatico (vicini se possibile).</span>
  <button class="btn" id="mvOk" ${opts.length?'':'disabled'}>Sposta</button><button class="btn light" id="mvNo">Annulla</button>`);
  $('#mvNo').onclick=()=>bookingSheet(b.id);
  if(opts.length)$('#mvOk').onclick=e=>guard(e.currentTarget,async()=>{
    const t=tripById($('#mvTrip').value),seats=autoSeats(t,num(b.posti));
    await rpc('dg_save_booking_v13',{p_id:b.id,p_data:bookingBody(b,{viaggio_id:t.id}),p_seats:seats});
    closeSheet();toast('Prenotazione spostata su '+tripLabel(t)+' '+dateShort(t.data_partenza));S.tripId=t.id;await loadAll();
  });
}
function cancelSheet(b){
  sheet(`<h3>Annullare la prenotazione?</h3><p style="margin:0">${esc(nameOf(b))} · ${num(b.posti)} posti. I posti tornano liberi.</p>
  ${num(b.pagato)>0?`<div class="note">Ha già pagato ${eur(b.pagato)}: i pagamenti restano registrati. Se restituisci i soldi, registra il rimborso dalla scheda della prenotazione.</div>`:''}
  <button class="btn danger" id="cnOk">Sì, annulla la prenotazione</button><button class="btn light" id="cnNo">No</button>`);
  $('#cnNo').onclick=()=>bookingSheet(b.id);
  $('#cnOk').onclick=e=>guard(e.currentTarget,async()=>{
    await rpc('dg_save_booking_v13',{p_id:b.id,p_data:bookingBody(b,{stato:'Annullata'}),p_seats:[]});
    closeSheet();toast('Prenotazione annullata');await loadAll();
  });
}

/* ----- Contabilità (tappa 2) ----- */
let accTab='me';
async function ensureAcc(force){
  if(S.acc&&!force)return;
  const [pays,rent,tr,eco,cl,comp,liq,prof,trips]=await Promise.all([
    get('pagamenti',{select:'id,prenotazione_id,viaggio_id,cliente,importo,tipo,stato,metodo,metodo_pagamento,data_pagamento,created_at,incassato_da_user_id,incassato_da,receipt_number,receipt_professional_path,receipt_professional_generated_at',order:'data_pagamento.desc,created_at.desc',limit:'10000'}),
    get('noleggi_bus_pagamenti',{select:'id,importo,tipo,metodo,data_pagamento,created_at,incassato_da_user_id',limit:'5000'}).catch(()=>[]),
    get('cassa_trasferimenti',{select:'id,da_operatore_user_id,a_operatore_user_id,importo,stato,data_trasferimento,note,created_at',order:'created_at.desc',limit:'5000'}),
    get('economia_movimenti',{select:'id,tipo,categoria,descrizione,importo,data_movimento,metodo,viaggio_id,origine,pagamento_id,operatore_user_id,operatore,created_at',order:'data_movimento.desc,created_at.desc',limit:'10000'}),
    get('cassa_chiusure',{select:'data_chiusura,operatore_user_id,saldo_teorico,contanti_contati,differenza,created_at',order:'created_at.desc',limit:'500'}).catch(()=>[]),
    get('dg_compensi_nicola',{select:'id,data_compenso,viaggio_id,descrizione,importo_compenso,note',order:'data_compenso.desc'}).catch(()=>[]),
    get('dg_compensi_nicola_liquidazioni',{select:'id,compenso_id,trasferimento_id,importo'}).catch(()=>[]),
    get('dg_viaggi_redditivita',{select:'viaggio_id,titolo,data_partenza,posti_occupati,entrate,uscite,margine',order:'data_partenza.desc',limit:'500'}).catch(()=>[]),
    get('viaggi',{select:'id,titolo,destinazione,data_partenza,bis_numero,bis_parent_id',limit:'2000'}).catch(()=>[])
  ]);
  S.acc={pays:pays||[],rent:rent||[],tr:(tr||[]).filter(x=>x.stato==='Confermato'),eco:eco||[],cl:cl||[],comp:comp||[],liq:liq||[],prof:prof||[],trips:trips||[]};
}
const isCash=m=>/contant/i.test(String(m||''));
const isRefund=p=>/rimbors/i.test(String(p.tipo||''));
const opName=uid=>{const o=S.operators.find(x=>x.user_id===uid);return o?(o.nome||o.username):'—'};
const tripOfAcc=id=>(S.acc&&S.acc.trips.find(t=>t.id===id))||tripById(id)||null;
function ledger(uid){
  const A=S.acc,rows=[];
  for(const p of A.pays.filter(p=>p.incassato_da_user_id===uid&&!/annull|storn/i.test(p.stato||''))){const v=isRefund(p)?-Math.abs(num(p.importo)):Math.abs(num(p.importo));rows.push({d:p.data_pagamento||String(p.created_at).slice(0,10),kind:isRefund(p)?'Rimborso':p.tipo||'Incasso',who:p.cliente,trip:p.viaggio_id,v,cash:isCash(p.metodo_pagamento||p.metodo),method:p.metodo_pagamento||p.metodo,pid:p.id})}
  for(const p of A.rent.filter(p=>p.incassato_da_user_id===uid)){const v=isRefund(p)?-Math.abs(num(p.importo)):Math.abs(num(p.importo));rows.push({d:p.data_pagamento||String(p.created_at).slice(0,10),kind:'Noleggio',who:'',v,cash:isCash(p.metodo),method:p.metodo})}
  for(const t of A.tr.filter(t=>t.da_operatore_user_id===uid||t.a_operatore_user_id===uid)){const out=t.da_operatore_user_id===uid;rows.push({d:t.data_trasferimento||String(t.created_at).slice(0,10),kind:out?'Consegnati a '+opName(t.a_operatore_user_id):'Ricevuti da '+opName(t.da_operatore_user_id),who:t.note||'',v:out?-num(t.importo):num(t.importo),cash:true,method:'Contanti',transfer:true})}
  for(const e of A.eco.filter(e=>e.operatore_user_id===uid&&!e.pagamento_id&&!/^(automatico|migrazione)/i.test(e.origine||''))){const out=/uscita/i.test(e.tipo);rows.push({d:e.data_movimento,kind:(out?'Spesa · ':'Entrata · ')+(e.categoria||''),who:e.descrizione&&e.descrizione!==e.categoria?e.descrizione:'',trip:e.viaggio_id,v:out?-num(e.importo):num(e.importo),cash:isCash(e.metodo),method:e.metodo||'non indicato'})}
  rows.sort((a,b)=>String(b.d).localeCompare(String(a.d)));
  const sum=f=>r2(rows.filter(f).reduce((a,r)=>a+r.v,0));
  return {rows,
    incCash:sum(r=>!r.transfer&&r.v>0&&r.cash&&!/^Entrata|^Spesa/.test(r.kind)),
    incOther:sum(r=>!r.transfer&&r.v>0&&!r.cash&&!/^Entrata|^Spesa/.test(r.kind)),
    spese:-sum(r=>/^Spesa/.test(r.kind)&&r.cash),
    tin:sum(r=>r.transfer&&r.v>0),tout:-sum(r=>r.transfer&&r.v<0),
    cash:sum(r=>r.cash)};
}
function viewConti(){
  if(!S.acc){ensureAcc().then(render).catch(e=>{S.error=e.message;render()});return '<div class="empty">Carico la contabilità…</div>'}
  const ops=S.operators;
  const chips=[...ops.map(o=>[o.user_id,o.nome||o.username]),['compenso','Compenso Nicola'],['viaggi','Guadagno viaggi']];
  if(accTab==='me')accTab=me.user_id;
  let h=`<div class="chips">${chips.map(([k,l])=>`<button class="chip ${accTab===k?'on':''}" data-act="accTab" data-v="${esc(k)}">${esc(l)}</button>`).join('')}<button class="chip" data-act="accReload">↻</button></div>`;
  if(accTab==='compenso')return h+viewCompenso();
  if(accTab==='viaggi')return h+viewGuadagno();
  const L=ledger(accTab),lastC=S.acc.cl.find(c=>c.operatore_user_id===accTab),official=accTab===me.user_id?cashInHand():null;
  h+=`<div class="hero"><div style="display:flex;flex-direction:column;gap:3px"><b style="font-size:18px">Contabilità ${esc(opName(accTab))}</b><span class="small" style="color:#C9D6E6">${official!=null?'Contanti che dovresti avere ora (come in Cassa)':'Contanti teorici, calcolo indicativo da tutti i movimenti'}${lastC?' · ultima chiusura '+esc(dateShort(lastC.data_chiusura))+': contati '+eur(lastC.contanti_contati):''}</span></div><span class="big-n">${eur(official!=null?official:L.cash)}</span></div>
  <div class="grid2"><div class="kpi"><span>Incassi in contanti</span><b>${eur(L.incCash)}</b></div><div class="kpi"><span>Incassi POS/bonifico</span><b>${eur(L.incOther)}</b></div>
  <div class="kpi"><span>Ricevuti da collega</span><b>${eur(L.tin)}</b></div><div class="kpi"><span>Consegnati a collega</span><b>${eur(L.tout)}</b></div>
  <div class="kpi"><span>Spese in contanti</span><b>${eur(L.spese)}</b></div><div class="kpi"><span>Movimenti</span><b>${L.rows.length}</b></div></div>
  <section class="card"><h2>Movimenti</h2>${L.rows.slice(0,S.accMore?2000:60).map(r=>{const t=r.trip&&tripOfAcc(r.trip);return `<div class="line"><span>${esc(dateShort(r.d))} · <b>${esc(r.kind)}</b>${r.who?' · '+esc(r.who):''}${t?' · '+esc(tripLabel(t))+' '+esc(dateShort(t.data_partenza)):''}${r.cash?'':' <span class="tag warn">'+esc(r.method||'non contanti')+'</span>'}${r.pid?` <button class="link small" style="padding:0" data-act="receipt" data-id="${r.pid}">PDF</button>`:''}</span><b style="white-space:nowrap;color:${r.v<0?'var(--bad)':'var(--ok)'}">${r.v<0?'− ':'+ '}${eur(Math.abs(r.v))}</b></div>`}).join('')||'<span class="muted">Nessun movimento.</span>'}
  ${L.rows.length>60&&!S.accMore?`<button class="link" data-act="accMore">Mostra tutti (${L.rows.length})</button>`:''}</section>`;
  return h;
}
function viewCompenso(){
  const A=S.acc,nic=S.operators.find(o=>/nicola/i.test(o.username)),raf=S.operators.find(o=>/raffaele/i.test(o.username));
  const valid=t=>nic&&raf&&t.da_operatore_user_id===raf.user_id&&t.a_operatore_user_id===nic.user_id;
  const used=new Set(A.liq.map(l=>l.trasferimento_id));
  const rows=A.comp.map(c=>{const got=A.liq.filter(l=>l.compenso_id===c.id).reduce((a,l)=>a+num(l.importo),0);return {...c,got,rem:Math.max(0,r2(num(c.importo_compenso)-got))}});
  const mat=rows.reduce((a,c)=>a+num(c.importo_compenso),0),got=rows.reduce((a,c)=>a+c.got,0);
  const free=A.tr.filter(t=>valid(t)&&!used.has(t.id));
  return `<div class="grid2"><div class="kpi"><span>Maturato</span><b>${eur(mat)}</b></div><div class="kpi"><span>Da ricevere</span><b>${eur(Math.max(0,mat-got))}</b></div></div>
  <button class="btn" data-act="compNew">＋ Registra una giornata / compenso</button>
  <section class="card"><h2>Compensi</h2>${rows.map(c=>{const t=c.viaggio_id&&tripOfAcc(c.viaggio_id);return `<div class="line"><span>${esc(dateShort(c.data_compenso))} · ${esc(c.descrizione||'')}${t?' · '+esc(tripLabel(t)):''}<br><span class="small muted">ricevuto ${eur(c.got)} di ${eur(c.importo_compenso)}</span></span><span style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">${c.rem>0?`<span class="tag warn">mancano ${eur(c.rem)}</span>${free.some(t=>num(t.importo)<=c.rem+0.005)?`<button class="link small" style="padding:0" data-act="compLink" data-id="${c.id}">Abbina pagamento</button>`:''}`:'<span class="tag ok">Pagato</span>'}</span></div>`}).join('')||'<span class="muted">Nessun compenso registrato.</span>'}</section>
  <p class="small muted" style="margin:0">Il pagamento del compenso si registra come consegna di contanti da Raffaele a Nicola (dalla Cassa), poi si abbina qui.</p>`;
}
function viewGuadagno(){
  const P=S.acc.prof.slice().sort((a,b)=>String(b.data_partenza).localeCompare(String(a.data_partenza)));
  const tot=k=>P.reduce((a,x)=>a+num(x[k]),0);
  return `<div class="grid2"><div class="kpi"><span>Entrate viaggi</span><b>${eur(tot('entrate'))}</b></div><div class="kpi"><span>Margine</span><b>${eur(tot('margine'))}</b></div></div>
  <div class="list2">${P.map(x=>`<button class="trip" data-act="profTrip" data-id="${x.viaggio_id}"><div class="row"><span class="t">${esc(tripLabel(x))}</span><span class="small muted">${esc(dateShort(x.data_partenza))}</span></div>
  <div class="row small"><span>Entrate <b>${eur(x.entrate)}</b> · Spese <b>${eur(x.uscite)}</b></span><span class="tag ${num(x.margine)>=0?'ok':'bad'}">${num(x.margine)>=0?'+':''}${eur(x.margine)}</span></div></button>`).join('')||'<div class="empty">Nessun dato.</div>'}</div>`;
}
function profTripSheet(id){
  const x=S.acc.prof.find(p=>p.viaggio_id===id)||{},mv=S.acc.eco.filter(e=>e.viaggio_id===id);
  sheet(`<h3>${esc(tripLabel(x))} · ${esc(dateShort(x.data_partenza))}</h3>
  <div class="line"><span>Entrate</span><b>${eur(x.entrate)}</b></div><div class="line"><span>Spese</span><b>${eur(x.uscite)}</b></div><div class="line"><span>Margine</span><b>${eur(x.margine)}</b></div>
  <h3 style="font-size:16px;margin-top:6px">Spese e voci registrate</h3>
  ${mv.filter(e=>/uscita/i.test(e.tipo)).map(e=>`<div class="line"><span>${esc(e.categoria||'')} · ${esc(e.descrizione||'')}${e.operatore?' · '+esc(e.operatore):''}</span><b>− ${eur(e.importo)}</b></div>`).join('')||'<span class="muted small">Nessuna spesa registrata.</span>'}
  <button class="btn light" id="ptClose">Chiudi</button>`);
  $('#ptClose').onclick=closeSheet;
}
function compNewSheet(){
  sheet(`<h3>Registra compenso Nicola</h3>
  <div class="grid2"><label class="f">Data<input id="cnData" type="date" value="${today()}"></label><label class="f">Importo (€)<input id="cnImp" type="number" inputmode="decimal" min="0.01" step="0.01"></label></div>
  <label class="f">Descrizione<input id="cnDesc" placeholder="es. Giornata Napoli 29/11"></label>
  <label class="f">Viaggio (facoltativo)<select id="cnTrip"><option value="">Nessuno</option>${S.acc.trips.slice().sort((a,b)=>String(b.data_partenza).localeCompare(String(a.data_partenza))).slice(0,60).map(t=>`<option value="${t.id}">${esc(dateShort(t.data_partenza))} · ${esc(tripLabel(t))}</option>`).join('')}</select></label>
  <span class="small muted">Registrare il compenso non muove soldi: serve a sapere quanto spetta.</span>
  <button class="btn" id="cnOk">Registra</button><button class="btn light" id="cnNo">Annulla</button>`);
  $('#cnNo').onclick=closeSheet;
  $('#cnOk').onclick=e=>guard(e.currentTarget,async()=>{
    const imp=r2($('#cnImp').value),desc=$('#cnDesc').value.trim();
    if(!(imp>0)||desc.length<4)throw new Error('Scrivi importo e descrizione.');
    await insert('dg_compensi_nicola',{data_compenso:$('#cnData').value,descrizione:desc,importo_compenso:imp,viaggio_id:$('#cnTrip').value||null,note:null});
    closeSheet();toast('Compenso registrato');await ensureAcc(true);render();
  });
}
function compLinkSheet(id){
  const A=S.acc,c=A.comp.find(x=>x.id===id),got=A.liq.filter(l=>l.compenso_id===id).reduce((a,l)=>a+num(l.importo),0),rem=r2(num(c.importo_compenso)-got);
  const nic=S.operators.find(o=>/nicola/i.test(o.username)),raf=S.operators.find(o=>/raffaele/i.test(o.username)),used=new Set(A.liq.map(l=>l.trasferimento_id));
  const free=A.tr.filter(t=>t.da_operatore_user_id===(raf&&raf.user_id)&&t.a_operatore_user_id===(nic&&nic.user_id)&&!used.has(t.id)&&num(t.importo)<=rem+0.005);
  sheet(`<h3>Abbina un pagamento</h3><span class="muted">${esc(c.descrizione)} · mancano ${eur(rem)}</span>
  <label class="f">Consegna di Raffaele a Nicola<select id="clTr">${free.map(t=>`<option value="${t.id}">${esc(dateShort(t.data_trasferimento))} · ${eur(t.importo)} · ${esc(String(t.note||'').slice(0,40))}</option>`).join('')}</select></label>
  <button class="btn" id="clOk">Abbina</button><button class="btn light" id="clNo">Annulla</button>`);
  $('#clNo').onclick=closeSheet;
  $('#clOk').onclick=e=>guard(e.currentTarget,async()=>{const t=free.find(x=>x.id===$('#clTr').value);if(!t)throw new Error('Scegli un pagamento.');
    await insert('dg_compensi_nicola_liquidazioni',{compenso_id:c.id,trasferimento_id:t.id,importo:num(t.importo)});closeSheet();toast('Pagamento abbinato');await ensureAcc(true);render()});
}
/* ricevute e conferme PDF: apre il documento in una nuova scheda */
async function openPdf(getUrl){
  const w=window.open('','_blank');
  if(w)w.document.write('<p style="font-family:sans-serif;padding:20px">Preparo il documento…</p>');
  try{const url=await getUrl();if(!url)throw new Error('Documento non disponibile.');if(w)w.location.href=url;else location.href=url}
  catch(e){if(w)w.close();toast(e.message,true)}
}
async function signStorage(path){
  const enc=String(path).split('/').map(encodeURIComponent).join('/');
  const r=await raw('/storage/v1/object/sign/ricevute-prenotazioni/'+enc,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expiresIn:300})});
  const u=r&&(r.signedURL||r.signedUrl);if(!u)throw new Error('Documento non disponibile.');
  return u.startsWith('http')?u:API+'/storage/v1'+u;
}
function receipt(pid){
  const p=(S.acc&&S.acc.pays.find(x=>x.id===pid))||(S.allPays||[]).find(x=>x.id===pid);
  openPdf(async()=>{
    // le ricevute create prima del logo ufficiale vengono rifatte, le altre si riaprono
    if(p&&p.receipt_professional_path&&String(p.receipt_professional_generated_at||'')>=LOGO_SINCE)return signStorage(p.receipt_professional_path);
    const r=await raw('/functions/v1/professional-receipts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'generate',kind:'trip',id:pid})});
    if(!r||!r.success)throw new Error((r&&r.error)||'Ricevuta non generata.');
    if(p){p.receipt_professional_path=r.path;p.receipt_professional_generated_at=new Date().toISOString()}
    return r.signedUrl;
  });
}
const LOGO_SINCE='2026-11-26T18:24:00Z';
/* conferma di prenotazione: creata ogni volta aggiornata (posti, pagamenti) e con il logo ufficiale */
async function confirmationUrl(bid){const r=await raw('/functions/v1/dg67-booking-pdf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bookingId:bid})});if(!r||!r.success||!r.signedUrl)throw new Error((r&&r.error)||'Conferma PDF non creata.');return r}
function confirmationPdf(bid){openPdf(async()=>(await confirmationUrl(bid)).signedUrl)}

/* ----- Tappa 3: liste, WhatsApp, agenda, notifiche, noleggi, preventivi ----- */
function passengerList(t){
  if(!t)return;
  openPdf(async()=>{const r=await raw('/functions/v1/dg67-booking-pdf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'passengers',tripId:t.id})});if(!r||!r.success||!r.signedUrl)throw new Error((r&&r.error)||'Lista passeggeri non creata.');return r.signedUrl});
}
function waGroupSheet(t){
  const bs=tripStats(t).bs.filter(b=>waNumber(b.telefono));
  const nums=[...new Map(bs.map(b=>[waNumber(b.telefono),b])).values()];
  sheet(`<h3>Numeri per il gruppo WhatsApp</h3><span class="muted">${esc(tripLabel(t))} · ${esc(dateShort(t.data_partenza))} · ${nums.length} numeri</span>
  <div style="max-height:40vh;overflow:auto">${nums.map(b=>`<div class="line"><span>${esc(nameOf(b))}</span><a href="https://wa.me/${waNumber(b.telefono)}" target="_blank" rel="noopener">+${esc(waNumber(b.telefono))}</a></div>`).join('')}</div>
  <button class="btn" id="waCopy">Copia tutti i numeri</button>
  <button class="btn light" id="waVcf">Scarica contatti (per aggiungerli alla rubrica)</button>
  <span class="small muted">Per creare il gruppo: salva i contatti in rubrica, poi in WhatsApp «Nuovo gruppo» e scegli i nomi.</span>
  <button class="btn light" id="waNo">Chiudi</button>`);
  $('#waNo').onclick=closeSheet;
  $('#waCopy').onclick=async()=>{const txt=nums.map(b=>'+'+waNumber(b.telefono)).join('\n');try{await navigator.clipboard.writeText(txt);toast('Numeri copiati')}catch{prompt('Copia i numeri:',txt)}};
  $('#waVcf').onclick=()=>{
    const tag=tripLabel(t)+' '+String(t.data_partenza).slice(8,10)+'/'+String(t.data_partenza).slice(5,7);
    const vcf=nums.map(b=>`BEGIN:VCARD\r\nVERSION:3.0\r\nFN:${nameOf(b).replace(/[\r\n;]/g,' ')} (${tag})\r\nTEL;TYPE=CELL:+${waNumber(b.telefono)}\r\nEND:VCARD`).join('\r\n');
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([vcf],{type:'text/vcard'}));a.download='contatti-'+fold(tripLabel(t)).replace(/[^a-z0-9]+/g,'-')+'.vcf';document.body.appendChild(a);a.click();a.remove();
  };
}
async function ensureExtra(force){
  if(S.extra&&!force)return;
  const [ag,old,no,ren,pre]=await Promise.all([
    get('scadenze_gestionale',{select:'id,titolo,descrizione,tipo,stato,priorita,data_scadenza,note,updated_at',order:'data_scadenza.asc',limit:'2000'}).catch(()=>[]),
    get('attivita_gestionale',{select:'id,titolo,descrizione,stato,priorita,scadenza,updated_at',order:'scadenza.asc',limit:'2000'}).catch(()=>[]),
    get('notifiche',{select:'id,titolo,messaggio,tipo,letto,created_at',order:'created_at.desc',limit:'80'}).catch(()=>[]),
    get('noleggi_bus',{select:'id,referente,azienda,telefono,tratta_partenza,tratta_destinazione,data_partenza,ora_partenza,data_ritorno,passeggeri,prezzo_concordato,acconto,saldo,stato_pagamento,stato_noleggio,archiviato_at',order:'data_partenza.desc',limit:'500'}).catch(()=>[]),
    get('preventivi',{select:'id,numero_preventivo,nome,cognome,azienda,telefono,email,servizio,destinazione,luogo_partenza,data_partenza,data_viaggio,numero_passeggeri,importo_preventivo,importo,stato,created_at',order:'created_at.desc',limit:'500'}).catch(()=>[])
  ]);
  S.extra={ag:(ag||[]).map(x=>({...x,src:'scadenze_gestionale',data:x.data_scadenza})).concat((old||[]).map(x=>({...x,src:'attivita_gestionale',data:x.scadenza}))).filter(x=>!/eliminat/i.test(x.stato||'')),no:no||[],ren:(ren||[]).filter(x=>!x.archiviato_at),pre:pre||[]};
}
function lazy(fn){if(!S.extra){ensureExtra().then(render).catch(e=>{S.error=e.message;render()});return '<div class="empty">Carico…</div>'}return fn()}
const done=x=>/complet|fatt|chius/i.test(x.stato||'');
function viewAgenda(){return lazy(()=>{
  const t0=today(),A=S.extra.ag.slice().sort((a,b)=>String(a.data||'').localeCompare(String(b.data||'')));
  const open=A.filter(x=>!done(x)),late=open.filter(x=>String(x.data||'').slice(0,10)<t0);
  const row=x=>`<div class="pax"><div class="who"><b>${esc(x.titolo||'Senza titolo')}</b><span>${esc(dateShort(String(x.data||'').slice(0,10)))}${x.tipo?' · '+esc(x.tipo):''}${x.descrizione?' · '+esc(x.descrizione):''}</span></div>${done(x)?'<span class="tag ok">Fatto</span>':`<button class="pay" style="background:#EEF2F7;color:var(--ink)" data-act="agDone" data-id="${x.id}">Fatto</button>`}</div>`;
  return `<button class="btn" data-act="agNew">＋ Nuovo appuntamento o scadenza</button>
  ${late.length?`<section class="card"><h2 style="color:var(--bad)">In ritardo (${late.length})</h2></section><div class="list2">${late.map(row).join('')}</div>`:''}
  <section class="card"><h2>Da fare (${open.length-late.length})</h2></section><div class="list2">${open.filter(x=>!late.includes(x)).map(row).join('')||'<div class="empty">Niente in programma.</div>'}</div>
  ${A.filter(done).length?`<details class="card"><summary style="font-weight:700">Completati (${A.filter(done).length})</summary>${A.filter(done).map(row).join('')}</details>`:''}`;
})}
function agNewSheet(){
  sheet(`<h3>Nuovo appuntamento / scadenza</h3>
  <label class="f">Cosa<input id="agT" placeholder="es. Revisione bus FW125XE"></label>
  <div class="grid2"><label class="f">Data<input id="agD" type="date" value="${today()}"></label><label class="f">Tipo<select id="agK"><option>Appuntamento</option><option>Scadenza</option><option>Promemoria</option></select></label></div>
  <label class="f">Dettagli (facoltativi)<input id="agDesc"></label>
  <button class="btn" id="agOk">Salva</button><button class="btn light" id="agNo">Annulla</button>`);
  $('#agNo').onclick=closeSheet;
  $('#agOk').onclick=e=>guard(e.currentTarget,async()=>{const t=$('#agT').value.trim();if(t.length<3)throw new Error('Scrivi cosa devi fare.');
    await insert('scadenze_gestionale',{titolo:t,descrizione:$('#agDesc').value.trim()||null,tipo:$('#agK').value,stato:'aperta',priorita:'normale',data_scadenza:$('#agD').value});
    closeSheet();toast('Salvato in agenda');await ensureExtra(true);render()});
}
async function agDone(id){
  const x=S.extra.ag.find(a=>a.id===id);if(!x)return;
  await guard(null,async()=>{
    const q=new URLSearchParams({id:'eq.'+x.id});if(x.updated_at)q.set('updated_at','eq.'+x.updated_at);
    const r=await raw('/rest/v1/'+x.src+'?'+q.toString(),{method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify({stato:'completata'})});
    if(!Array.isArray(r)||!r.length)throw new Error('Non aggiornato: forse è stato modificato da un altro operatore. Aggiorna e riprova.');
    toast('Segnato come fatto');await ensureExtra(true);render();
  });
}
function viewNotifiche(){try{localStorage.setItem(SEEN,new Date().toISOString())}catch{}unseen=0;return lazy(()=>`<div class="list2">${S.extra.no.map(n=>`<div class="pax"><div class="who"><b>${esc(n.titolo||'Avviso')}</b><span>${esc(n.messaggio||'')}</span><span>${esc(new Date(n.created_at).toLocaleString('it-IT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}))}</span></div>${n.letto?'':'<span class="tag warn">Nuova</span>'}</div>`).join('')||'<div class="empty">Nessun avviso.</div>'}</div>`)}
function viewNoleggi(){return lazy(()=>`<button class="btn" data-act="rentEdit">${SVG(IC.plus)}Nuovo noleggio</button><div class="list2">${S.extra.ren.map(n=>{const wa=waNumber(n.telefono);return `<section class="card"><div class="row"><b>${esc(n.azienda||n.referente||'Noleggio')}</b><span class="tag ${/saldat/i.test(n.stato_pagamento||'')?'ok':'warn'}">${esc(n.stato_pagamento||'')}</span></div>
  <span class="small muted">${esc(dateShort(n.data_partenza))}${n.ora_partenza?' ore '+esc(String(n.ora_partenza).slice(0,5)):''} · ${esc(n.tratta_partenza||'')} → ${esc(n.tratta_destinazione||'')} · ${num(n.passeggeri)} passeggeri</span>
  <div class="line"><span>Prezzo</span><b>${eur(n.prezzo_concordato)}</b></div><div class="line"><span>Resta</span><b>${eur(n.saldo)}</b></div>
  ${n.telefono?`<div class="contacts"><a href="tel:${esc(phoneDigits(n.telefono))}">Chiama</a>${wa?`<a href="https://wa.me/${wa}" target="_blank" rel="noopener">WhatsApp</a>`:''}</div>`:''}
  <div class="grid2"><button class="btn light" data-act="rentEdit" data-id="${n.id}">${SVG(IC.edit)}Modifica</button><button class="btn gold" data-act="rentPay" data-id="${n.id}">${SVG(IC.coins)}Pagamento</button></div></section>`}).join('')||'<div class="empty">Nessun noleggio. Creane uno con il pulsante qui sopra.</div>'}</div>`)}
function viewPreventivi(){return lazy(()=>`<button class="btn" data-act="quoteEdit">${SVG(IC.plus)}Nuovo preventivo</button><div class="list2">${S.extra.pre.map(q=>{const wa=waNumber(q.telefono);return `<section class="card"><div class="row"><b>${esc([q.nome,q.cognome].filter(Boolean).join(' ')||q.azienda||'Richiesta')}</b><span class="tag warn">${esc(q.stato||'')}</span></div>
  <span class="small muted">${esc(q.numero_preventivo||'')} · ${esc(q.servizio||'')} · ${esc(q.luogo_partenza||'')} → ${esc(q.destinazione||'')} · ${esc(dateShort(q.data_partenza||q.data_viaggio))} · ${num(q.numero_passeggeri)} persone</span>
  ${num(q.importo_preventivo||q.importo)?`<div class="line"><span>Importo</span><b>${eur(q.importo_preventivo||q.importo)}</b></div>`:''}
  ${q.telefono?`<div class="contacts"><a href="tel:${esc(phoneDigits(q.telefono))}">Chiama</a>${wa?`<a href="https://wa.me/${wa}" target="_blank" rel="noopener">WhatsApp</a>`:''}${q.email?`<a href="mailto:${esc(q.email)}">Email</a>`:''}</div>`:''}
  <div class="grid2"><button class="btn light" data-act="quoteEdit" data-id="${q.id}">${SVG(IC.edit)}Modifica</button><button class="btn light" data-act="quotePdf" data-id="${q.id}">${SVG(IC.doc)}PDF</button></div></section>`}).join('')||'<div class="empty">Nessun preventivo. Creane uno con il pulsante qui sopra.</div>'}</div>`)}

/* ----- Riepilogo viaggio: chi ha saldato, chi ha l’acconto, chi deve ancora pagare ----- */
const payState=b=>residuo(b)<=0?'ok':num(b.pagato)>0?'acc':'none';
const RP={none:{t:'Senza acconto',d:'Devono pagare tutto'},acc:{t:'Con acconto',d:'Devono saldare'},ok:{t:'Saldati',d:'Hanno pagato tutto'}};
const rpOption=t=>`${esc(dateShort(t.data_partenza))} · ${esc(titleCase(tripLabel(t)))}${t.bis_parent_id?' · bus '+esc(t.bis_numero||2):''}`;
function rpTrips(){
  const t0=today(),up=S.trips.filter(t=>t.data_partenza>=t0);
  const past=S.trips.filter(t=>t.data_partenza<t0).concat((S.rpPast||[]).filter(t=>!tripById(t.id))).sort((a,b)=>String(b.data_partenza).localeCompare(String(a.data_partenza))||num(a.bis_numero)-num(b.bis_numero));
  return {up,past};
}
let rpPastLoading=false;const rpLoading=new Set();
function rpLoadPast(){
  if(S.rpPast||rpPastLoading)return;rpPastLoading=true;
  get('viaggi',{select:'id,titolo,destinazione,luogo_partenza,data_partenza,ora_partenza,posti_totali,autobus_id,bis_parent_id,bis_numero,stato',data_partenza:'lt.'+addDays(today(),-10),order:'data_partenza.desc',limit:'150'})
   .then(r=>{S.rpPast=(r||[]).filter(t=>!/annullat/i.test(String(t.stato||'')))}).catch(()=>{S.rpPast=[]}).finally(()=>{rpPastLoading=false;if(S.tab==='riepilogo')render()});
}
function rpBookings(t){
  const own=b=>active(b)&&!b.riserva_aziendale;
  if(tripById(t.id))return {list:bookingsOf(t.id).filter(own),ris:bookingsOf(t.id).filter(b=>b.riserva_aziendale)};
  const all=S.rpB[t.id];
  if(!all){
    if(!rpLoading.has(t.id)){rpLoading.add(t.id);get('prenotazioni',{select:'id,viaggio_id,cliente,cliente_nome,telefono,posti,totale,pagato,stato,posti_selezionati,fermata_partenza,giorni_acconto,created_at,riserva_aziendale',viaggio_id:'eq.'+t.id,limit:'2000'})
      .then(r=>{S.rpB[t.id]=r||[]}).catch(e=>{S.rpB[t.id]=[];toast(e.message,true)}).finally(()=>{rpLoading.delete(t.id);render()})}
    return null;
  }
  return {list:all.filter(own),ris:all.filter(b=>active(b)&&b.riserva_aziendale)};
}
function viewRiepilogo(){
  rpLoadPast();
  const {up,past}=rpTrips(),all=up.concat(past);
  if(!S.rpTrip||!all.some(t=>t.id===S.rpTrip))S.rpTrip=(nextTrips()[0]||up[0]||past[0]||{}).id||null;
  const t=all.find(x=>x.id===S.rpTrip);
  let h=`<label class="f">Scegli il viaggio<select data-input="rpTrip" aria-label="Viaggio">
   ${up.length?`<optgroup label="Prossimi viaggi">${up.map(x=>`<option value="${x.id}" ${x.id===S.rpTrip?'selected':''}>${rpOption(x)}</option>`).join('')}</optgroup>`:''}
   <optgroup label="Viaggi passati">${past.map(x=>`<option value="${x.id}" ${x.id===S.rpTrip?'selected':''}>${rpOption(x)}</option>`).join('')}${S.rpPast?'':'<option disabled>Carico i viaggi passati…</option>'}</optgroup>
  </select></label>`;
  if(!t)return h+'<div class="empty">Nessun viaggio da mostrare.</div>';
  const data=rpBookings(t);
  if(!data)return h+'<div class="empty">Carico le prenotazioni…</div>';
  const bs=data.list,sum=(xs,f)=>r2(xs.reduce((a,b)=>a+f(b),0));
  const G={none:[],acc:[],ok:[]};for(const b of bs.slice().sort((a,b)=>nameOf(a).localeCompare(nameOf(b),'it')))G[payState(b)].push(b);
  const tot=sum(bs,b=>num(b.totale)),paid=sum(bs,b=>num(b.pagato)),due=sum(bs,residuo),pax=bs.reduce((a,b)=>a+num(b.posti),0);
  const ris=data.ris.reduce((a,b)=>a+num(b.posti),0),future=t.data_partenza>=today(),canOpen=!!tripById(t.id);
  h+=`<div class="hero"><div style="display:flex;flex-direction:column;gap:3px;min-width:0"><b style="font-size:18px">${esc(titleCase(tripLabel(t)))}${t.bis_parent_id?' · bus '+esc(t.bis_numero||2):''}</b><span class="small" style="color:#C9D6E6">${esc(dateLong(t.data_partenza))} · ${bs.length} prenotazioni, ${pax} persone</span><span>Incassati <b>${eur(paid)}</b> su ${eur(tot)}</span></div><div style="text-align:right"><span class="big-n">${eur(due)}</span><div class="small" style="color:#C9D6E6">ancora da incassare</div></div></div>
  <div class="stati" role="group" aria-label="Mostra solo">${['ok','acc','none'].map(k=>`<button class="st ${k}" data-act="rpFilter" data-v="${k}" aria-pressed="${S.rpFilter===k}"><span class="n">${G[k].length}</span><span class="l">${RP[k].t}</span><span class="a">${k==='ok'?eur(sum(G.ok,b=>num(b.pagato)))+' incassati':'devono '+eur(sum(G[k],residuo))}</span></button>`).join('')}</div>
  <div class="pdfs"><button class="btn gold" data-act="rpPdf" data-v="due">${SVG(IC.doc)}PDF di chi deve ancora pagare</button><button class="btn light" data-act="rpPdf" data-v="all">${SVG(IC.doc)}PDF riepilogo completo</button></div>
  ${ris?`<p class="small muted" style="margin:0">Non conteggiati: ${ris} posti riservati DELGROSSO.</p>`:''}
  ${S.rpFilter?`<button class="link" data-act="rpFilter" data-v="${S.rpFilter}">Mostra tutte le prenotazioni</button>`:''}`;
  if(!bs.length)return h+'<div class="empty">Nessuna prenotazione su questo viaggio.</div>';
  for(const k of ['none','acc','ok']){
    if(S.rpFilter&&S.rpFilter!==k)continue;
    const list=G[k];if(!list.length&&!S.rpFilter)continue;
    h+=`<div class="rp-h ${k}"><h2>${RP[k].t} <span>(${list.length})</span></h2><span class="small muted">${RP[k].d}${k==='ok'?'':': '+eur(sum(list,residuo))}</span></div>`;
    h+='<div class="list2">'+(list.map(b=>{
      const r=residuo(b),wa=waNumber(b.telefono),seats=currentSeats(b).slice().sort((x,y)=>num(x)-num(y)),created=String(b.created_at||'').slice(0,10);
      const late=k==='none'&&future&&created&&created<=addDays(today(),-num(b.giorni_acconto||2));
      const tag=k==='ok'?'<span class="tag ok">Saldato</span>':k==='acc'?`<span class="tag warn">Resta ${eur(r)}</span>`:`<span class="tag bad">Deve ${eur(r)}</span>`;
      return `<div class="pax rp"><div class="row" style="align-items:flex-start"><div class="who">${canOpen?`<button class="link nm" data-act="openBooking" data-id="${b.id}">${esc(nameOf(b))} ›</button>`:`<b>${esc(nameOf(b))}</b>`}
      <span>${num(b.posti)} ${num(b.posti)===1?'posto':'posti'}${seats.length?' (n. '+esc(seats.join(', '))+')':''}${b.fermata_partenza?' · '+esc(titleCase(b.fermata_partenza)):''}</span>
      <span>Totale ${eur(b.totale)} · versato ${eur(b.pagato)}${created?' · prenotato il '+esc(created.slice(8,10)+'/'+created.slice(5,7)):''}</span>
      ${late?'<span class="late">Oltre i 2 giorni senza acconto</span>':''}</div>${tag}</div>
      ${k!=='ok'&&b.telefono?`<div class="contacts"><a href="tel:${esc(phoneDigits(b.telefono))}">Chiama</a>${wa?`<a href="https://wa.me/${wa}" target="_blank" rel="noopener">WhatsApp</a>`:''}</div>`:''}</div>`;
    }).join('')||'<div class="empty">Nessuno.</div>')+'</div>';
  }
  return h;
}
function rpPdf(scope){
  const t=rpTrips().up.concat(rpTrips().past).find(x=>x.id===S.rpTrip);if(!t)return;
  const label=titleCase(tripLabel(t))+(t.bis_parent_id?' bus '+(t.bis_numero||2):'')+' del '+dateShort(t.data_partenza);
  sharePdfSheet({title:scope==='all'?'Riepilogo pagamenti':'Chi deve ancora pagare',ready:'PDF pronto',name:label,tel:'',
    hint:'Si apre il menu di condivisione del telefono: puoi mandarlo su WhatsApp (per esempio a Raffaele) o salvarlo.',
    load:async()=>{const r=await raw('/functions/v1/dg67-booking-pdf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'payments',tripId:t.id,scope})});
      if(!r||!r.success||!r.signedUrl)throw new Error((r&&r.error)||'PDF non creato.');
      return {file:await pdfFile(r.signedUrl,r.filename||'DELGROSSO_Riepilogo.pdf'),url:r.signedUrl,number:''}},
    msg:()=>(scope==='all'?'Riepilogo pagamenti ':'Chi deve ancora pagare: ')+label});
}

/* ----- Tappa 4: presenze, rimborsi, ricevute su WhatsApp, noleggi e preventivi completi, avvisi ----- */
const onBoard=b=>b.checkin_effettuato===true;
function viewPresenze(){
  const t=tripById(S.tripId);if(!t){S.tab='viaggi';S.tripId=null;return viewViaggi()}
  const bs=bookingsOf(t.id),tot=bs.reduce((a,b)=>a+num(b.posti),0),up=bs.filter(onBoard).reduce((a,b)=>a+num(b.posti),0);
  const groups={};for(const b of bs.slice().sort((a,b)=>nameOf(a).localeCompare(nameOf(b),'it'))){const f=titleCase(b.fermata_partenza||'Fermata non indicata');(groups[f]=groups[f]||[]).push(b)}
  return `<button class="link" data-act="openTrip" data-id="${t.id}">‹ Torna al viaggio</button>
  <div class="hero"><div style="display:flex;flex-direction:column;gap:3px"><b style="font-size:18px">Presenze · ${esc(titleCase(tripLabel(t)))}</b><span class="small" style="color:#C9D6E6">${esc(dateLong(t.data_partenza))} · tocca «Salito» quando il passeggero è sul bus</span></div><div style="text-align:right"><span class="big-n">${up}/${tot}</span><div class="small" style="color:#C9D6E6">persone a bordo</div></div></div>
  <div class="bar ${up>=tot&&tot?'full':''}"><i style="width:${tot?Math.round(up/tot*100):0}%"></i></div>
  ${Object.entries(groups).map(([f,list])=>`<section class="card"><h2>${esc(f)} <span class="muted small">${list.filter(onBoard).reduce((a,b)=>a+num(b.posti),0)} su ${list.reduce((a,b)=>a+num(b.posti),0)}</span></h2>
  ${list.map(b=>`<div class="row" style="padding:6px 0;border-top:1px solid #EEF2F6"><div class="who" style="display:flex;flex-direction:column"><b>${esc(nameOf(b))}</b><span class="small muted">${num(b.posti)} ${num(b.posti)===1?'posto':'posti'}${currentSeats(b).length?' · n. '+esc(currentSeats(b).join(', ')):''}${residuo(b)>0?' · <span style="color:var(--residuo);font-weight:700">deve '+eur(residuo(b))+'</span>':''}</span></div>
  <button class="pay ${onBoard(b)?'done':''}" data-act="checkin" data-id="${b.id}" aria-pressed="${onBoard(b)}">${onBoard(b)?'✓ Salito':'Salito'}</button></div>`).join('')}</section>`).join('')||'<div class="empty">Nessun passeggero.</div>'}`;
}
async function toggleCheckin(id){
  const b=S.bookings.find(x=>x.id===id);if(!b||busy)return;
  const on=!onBoard(b),prev={checkin_effettuato:b.checkin_effettuato,checked_in_at:b.checked_in_at,checkin_stato:b.checkin_stato};
  Object.assign(b,{checkin_effettuato:on,checked_in_at:on?new Date().toISOString():null,checkin_stato:on?'PRESENTE':'NON_PRESENTE'});render();
  try{
    const r=await raw('/rest/v1/prenotazioni?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=representation'},
      body:JSON.stringify({checkin_effettuato:on,checked_in_at:on?new Date().toISOString():null,checkin_stato:on?'PRESENTE':'NON_PRESENTE',checkin_operatore:on?(me.nome||me.username):null,checkin_fermata:on?(b.fermata_partenza||null):null})});
    if(!Array.isArray(r)||!r.length)throw new Error('Presenza non salvata: aggiorna e riprova.');
  }catch(e){Object.assign(b,prev);render();toast(e.message,true)}
}
function refundSheet(b){
  const max=num(b.pagato);
  sheet(`<h3>Rimborso a ${esc(nameOf(b))}</h3><span class="muted">Ha pagato ${eur(max)}. Il rimborso viene registrato e tolto dal pagato.</span>
  <label class="f">Importo restituito (€)<input id="rfImp" type="number" inputmode="decimal" min="0.01" max="${max}" step="0.01" value="${max}"></label>
  <label class="f">Come lo restituisci<select id="rfMet"><option>Contanti</option><option>Bonifico</option><option>POS</option></select></label>
  <label class="f">Motivo<input id="rfNote" placeholder="es. viaggio annullato dal cliente"></label>
  <button class="btn danger" id="rfOk">Registra rimborso</button><button class="btn light" id="rfNo">Annulla</button>`);
  $('#rfNo').onclick=()=>bookingSheet(b.id);
  $('#rfOk').onclick=e=>guard(e.currentTarget,async()=>{
    const imp=r2($('#rfImp').value),note=$('#rfNote').value.trim();
    if(!(imp>0)||imp>max+0.005)throw new Error('Importo non valido (massimo '+eur(max)+').');
    if(note.length<3)throw new Error('Scrivi il motivo del rimborso.');
    await rpc('dg_register_payment',{p_booking_id:b.id,p_tipo:'Rimborso',p_importo:imp,p_metodo:$('#rfMet').value,p_data:today(),p_note:note});
    closeSheet();toast('Rimborso registrato: '+eur(imp));await loadAll();
  });
}
/* ricevuta: prepara il PDF e lo condivide (WhatsApp, Messaggi, Mail…) dal menu del telefono */
/* documenti PDF (tutti con il logo ufficiale): si preparano e si condividono dal menu del telefono */
async function pdfFile(url,filename){const res=await fetch(url);if(!res.ok)throw new Error('Documento non scaricabile.');const blob=await res.blob();return new File([blob],filename,{type:'application/pdf'})}
async function receiptFile(pid,kind){
  const r=await raw('/functions/v1/professional-receipts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'generate',kind:kind||'trip',id:pid})});
  if(!r||!r.success||!r.signedUrl)throw new Error((r&&r.error)||'Ricevuta non generata.');
  return {file:await pdfFile(r.signedUrl,'Ricevuta_'+String(r.receiptNumber||pid).replace(/[^A-Za-z0-9_-]+/g,'_')+'.pdf'),url:r.signedUrl,number:r.receiptNumber};
}
async function confirmationFile(bid){
  const r=await confirmationUrl(bid);
  return {file:await pdfFile(r.signedUrl,r.filename||'Conferma_prenotazione.pdf'),url:r.signedUrl,number:''};
}
function sharePdfSheet(o){
  sheet(`<h3>${esc(o.title)}</h3><span class="muted">Preparo il PDF…</span><div class="empty">Attendi qualche secondo</div><button class="btn light" id="shNo">Chiudi</button>`);
  $('#shNo').onclick=closeSheet;
  o.load().then(R=>{
    const canFiles=!!(navigator.canShare&&navigator.canShare({files:[R.file]}));
    const wa=waNumber(o.tel),msg=o.msg(R);
    sheet(`<h3>${esc(o.ready)}</h3><span class="muted">${R.number?esc(R.number)+' · ':''}${esc(o.name)}</span>
    ${canFiles?`<button class="btn gold" id="shGo">${SVG(IC.chat)}Invia il PDF (scegli WhatsApp)</button><span class="small muted">${esc(o.hint||'Si apre il menu di condivisione del telefono: scegli WhatsApp e poi il cliente.')}</span>`:`${wa?`<a class="btn gold" href="https://wa.me/${wa}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">${SVG(IC.chat)}Scrivi al cliente su WhatsApp</a><span class="small muted">Da computer: apri il PDF, scaricalo e allegalo nella chat di WhatsApp.</span>`:''}`}
    <a class="btn ${canFiles?'light':wa?'light':'gold'}" href="${esc(R.url)}" target="_blank" rel="noopener">${SVG(IC.doc)}Apri il PDF</a>
    <button class="btn light" id="shNo2">Chiudi</button>`);
    $('#shNo2').onclick=closeSheet;
    if(canFiles)$('#shGo').onclick=async()=>{try{await navigator.share({files:[R.file],text:msg})}catch(e){if(e&&e.name!=='AbortError')toast('Condivisione non riuscita: apri il PDF e invialo a mano.',true)}};
  }).catch(e=>{closeSheet();toast(e.message,true)});
}
function shareReceiptSheet(pid,name,tel,kind){
  sharePdfSheet({title:'Ricevuta per '+name,ready:'Ricevuta pronta',name,tel,load:()=>receiptFile(pid,kind),msg:R=>`Buongiorno ${name}, le inviamo la ricevuta ${R.number||''} del pagamento. Grazie, DELGROSSO Viaggi`});
}
function shareConfirmationSheet(b){
  const name=nameOf(b);
  sharePdfSheet({title:'Conferma per '+name,ready:'Conferma di prenotazione pronta',name,tel:b.telefono,load:()=>confirmationFile(b.id),msg:()=>`Buongiorno ${name}, le inviamo la conferma della sua prenotazione. Grazie, DELGROSSO Viaggi`});
}
async function bookingPayments(bid){return get('pagamenti',{select:'id,importo,tipo,metodo,data_pagamento,receipt_number,receipt_professional_path,receipt_professional_generated_at,incassato_da',prenotazione_id:'eq.'+bid,order:'data_pagamento.asc,created_at.asc'})}

/* noleggi: crea, modifica, pagamenti */
async function rentalVehicles(id){try{return (await get('noleggi_bus_mezzi',{select:'flotta_id',noleggio_id:'eq.'+id})).map(x=>x.flotta_id)}catch{return []}}
async function rentalSheet(id){
  const r=id?S.extra.ren.find(x=>x.id===id):null,veh=id?await rentalVehicles(id):[];
  const v=k=>esc(r&&r[k]!=null?r[k]:'');
  sheet(`<h3>${r?'Modifica noleggio':'Nuovo noleggio'}</h3>
  <div class="grid2"><label class="f">Referente<input id="rnRef" value="${v('referente')}"></label><label class="f">Azienda / gruppo<input id="rnAz" value="${v('azienda')}"></label></div>
  <div class="grid2"><label class="f">Telefono<input id="rnTel" type="tel" value="${v('telefono')}"></label><label class="f">Email<input id="rnMail" type="email" value="${v('email')}"></label></div>
  <div class="grid2"><label class="f">Partenza da<input id="rnFrom" value="${v('tratta_partenza')}"></label><label class="f">Destinazione<input id="rnTo" value="${v('tratta_destinazione')}"></label></div>
  <div class="grid2"><label class="f">Data<input id="rnData" type="date" value="${v('data_partenza')}"></label><label class="f">Ora<input id="rnOra" type="time" value="${esc(String(r&&r.ora_partenza||'').slice(0,5))}"></label></div>
  <div class="grid2"><label class="f">Ritorno (facoltativo)<input id="rnRit" type="date" value="${v('data_ritorno')}"></label><label class="f">Passeggeri<input id="rnPax" type="number" min="1" value="${v('passeggeri')||1}"></label></div>
  <div class="grid2"><label class="f">Prezzo concordato (€)<input id="rnPrezzo" type="number" inputmode="decimal" min="0" step="0.01" value="${v('prezzo_concordato')}"></label>
  <label class="f">Stato<select id="rnStato">${['Richiesto','Confermato','In corso','Completato','Annullato'].map(x=>`<option ${r&&r.stato_noleggio===x?'selected':''}>${x}</option>`).join('')}</select></label></div>
  <fieldset class="f" style="border:0;padding:0;margin:0"><legend style="font-weight:600;font-size:14px;margin-bottom:6px">Mezzi</legend>${S.fleet.map(f=>`<label style="display:flex;gap:10px;align-items:center;padding:6px 0"><input type="checkbox" class="rnVeh" value="${f.id}" ${veh.includes(f.id)?'checked':''} style="width:22px;height:22px"> ${esc(busName(f.id))} · ${num(f.posti)} posti</label>`).join('')}</fieldset>
  <label class="f">Note<input id="rnNote" value="${v('note')}"></label>
  <span class="small muted">Per mettere «Confermato» serve almeno un acconto registrato e un mezzo scelto.</span>
  <button class="btn" id="rnOk">${r?'Salva modifiche':'Crea noleggio'}</button><button class="btn light" id="rnNo">Annulla</button>`);
  $('#rnNo').onclick=closeSheet;
  $('#rnOk').onclick=e=>guard(e.currentTarget,async()=>{
    const ids=[...document.querySelectorAll('.rnVeh:checked')].map(x=>x.value),pax=Math.floor(num($('#rnPax').value));
    const cap=S.fleet.filter(f=>ids.includes(f.id)).reduce((a,f)=>a+num(f.posti),0);
    if(!$('#rnFrom').value.trim()||!$('#rnTo').value.trim()||!$('#rnData').value)throw new Error('Partenza, destinazione e data sono obbligatorie.');
    if(ids.length&&cap<pax)throw new Error('I mezzi scelti hanno '+cap+' posti per '+pax+' passeggeri.');
    const nid=r?r.id:uuid();
    await rpc('dg_save_rental_v15',{p_id:nid,p_vehicle_ids:ids,p_data:{id_noleggio:r&&r.id_noleggio||null,referente:$('#rnRef').value.trim()||null,azienda:$('#rnAz').value.trim()||null,telefono:$('#rnTel').value.trim()||null,email:$('#rnMail').value.trim()||null,
      tratta_partenza:$('#rnFrom').value.trim(),tratta_destinazione:$('#rnTo').value.trim(),data_partenza:$('#rnData').value,ora_partenza:$('#rnOra').value||null,data_ritorno:$('#rnRit').value||null,
      passeggeri:pax,servizio_tipo:r&&r.servizio_tipo||'Andata e ritorno',prezzo_concordato:r2($('#rnPrezzo').value),stato_noleggio:$('#rnStato').value,note:$('#rnNote').value.trim()||null}});
    closeSheet();toast(r?'Noleggio aggiornato':'Noleggio creato');await ensureExtra(true);render();
  });
}
function rentalPaySheet(id){
  const r=S.extra.ren.find(x=>x.id===id);if(!r)return;
  sheet(`<h3>Pagamento noleggio</h3><span class="muted">${esc(r.azienda||r.referente||'')} · resta ${eur(r.saldo)}</span>
  <div class="grid2"><label class="f">Tipo<select id="rpTipo"><option>Acconto</option><option ${num(r.acconto)>0?'selected':''}>Saldo</option><option>Rimborso</option></select></label><label class="f">Come<select id="rpMet"><option>Contanti</option><option>Bonifico</option><option>POS</option></select></label></div>
  <label class="f">Importo (€)<input id="rpImp" type="number" inputmode="decimal" min="0.01" step="0.01" value="${num(r.saldo)||''}"></label>
  <label class="f">Nota (facoltativa)<input id="rpNote"></label>
  <button class="btn gold" id="rpOk">Registra pagamento</button><button class="btn light" id="rpNo">Annulla</button>`);
  $('#rpNo').onclick=closeSheet;
  $('#rpOk').onclick=e=>guard(e.currentTarget,async()=>{
    const imp=r2($('#rpImp').value),tipo=$('#rpTipo').value;
    if(!(imp>0))throw new Error('Importo non valido.');
    if(tipo!=='Rimborso'&&num(r.saldo)>0&&imp>num(r.saldo)+0.005)throw new Error('Supera quanto resta ('+eur(r.saldo)+').');
    const res=await rpc('dg_register_rental_payment',{p_noleggio_id:r.id,p_tipo:tipo,p_importo:imp,p_metodo:$('#rpMet').value,p_data:today(),p_note:$('#rpNote').value.trim()||null});
    toast('Pagamento noleggio registrato');await ensureExtra(true);render();
    const pid=res&&(res.payment_id||res.id);
    if(pid&&tipo!=='Rimborso')shareReceiptSheet(pid,r.referente||r.azienda||'cliente',r.telefono,'rental');else closeSheet();
  });
}
/* preventivi: crea, modifica stato, PDF */
const QSTATI=['Nuovo','In Lavorazione','Inviato','Accettato','Rifiutato','Annullato'];
const QSERV=['Gran Turismo','Limousine Bus','NCC / Mercedes V250D','Navetta Eventi','Viaggio di Gruppo'];
function quoteSheet(id){
  const q=id?S.extra.pre.find(x=>x.id===id):null,v=k=>esc(q&&q[k]!=null?q[k]:'');
  sheet(`<h3>${q?'Modifica preventivo':'Nuovo preventivo'}</h3>
  <div class="grid2"><label class="f">Nome<input id="qNome" value="${v('nome')}"></label><label class="f">Cognome<input id="qCog" value="${v('cognome')}"></label></div>
  <div class="grid2"><label class="f">Telefono<input id="qTel" type="tel" value="${v('telefono')}"></label><label class="f">Email<input id="qMail" type="email" value="${v('email')}"></label></div>
  <label class="f">Azienda / gruppo (facoltativo)<input id="qAz" value="${v('azienda')}"></label>
  <label class="f">Servizio<select id="qServ">${QSERV.concat(q&&(q.servizio||q.servizio_richiesto)&&!QSERV.includes(q.servizio||q.servizio_richiesto)?[q.servizio||q.servizio_richiesto]:[]).map(x=>`<option ${q&&(q.servizio||q.servizio_richiesto)===x?'selected':''}>${x}</option>`).join('')}</select></label>
  <div class="grid2"><label class="f">Partenza da<input id="qFrom" value="${v('luogo_partenza')}"></label><label class="f">Destinazione<input id="qTo" value="${v('destinazione')}"></label></div>
  <div class="grid2"><label class="f">Data<input id="qData" type="date" value="${esc(String(q&&(q.data_partenza||q.data_viaggio)||'').slice(0,10))}"></label><label class="f">Passeggeri<input id="qPax" type="number" min="1" value="${v('numero_passeggeri')}"></label></div>
  <div class="grid2"><label class="f">Importo proposto (€)<input id="qImp" type="number" inputmode="decimal" min="0" step="0.01" value="${v('importo_preventivo')}"></label><label class="f">Stato<select id="qStato">${QSTATI.concat(q&&!QSTATI.includes(q.stato)?[q.stato]:[]).map(x=>`<option ${q&&q.stato===x?'selected':''}>${x}</option>`).join('')}</select></label></div>
  <label class="f">Dettagli dell'offerta (vanno nel PDF)<textarea id="qDet" rows="3">${v('dettagli_offerta')}</textarea></label>
  <button class="btn" id="qOk">${q?'Salva':'Crea preventivo'}</button><button class="btn light" id="qNo">Annulla</button>`);
  $('#qNo').onclick=closeSheet;
  $('#qOk').onclick=e=>guard(e.currentTarget,async()=>{
    const body={nome:$('#qNome').value.trim(),cognome:$('#qCog').value.trim()||null,telefono:$('#qTel').value.trim(),email:$('#qMail').value.trim()||null,azienda:$('#qAz').value.trim()||null,servizio:$('#qServ').value,
      luogo_partenza:$('#qFrom').value.trim()||null,destinazione:$('#qTo').value.trim(),data_partenza:$('#qData').value||null,data_viaggio:$('#qData').value||null,numero_passeggeri:Math.max(1,Math.floor(num($('#qPax').value))||1),passeggeri:Math.max(1,Math.floor(num($('#qPax').value))||1),
      importo_preventivo:r2($('#qImp').value),importo:r2($('#qImp').value),stato:$('#qStato').value,dettagli_offerta:$('#qDet').value.trim()||null,operatore:me.nome||me.username,data_modifica:new Date().toISOString()};
    if(!body.nome||!body.telefono||!body.destinazione)throw new Error('Nome, telefono e destinazione sono obbligatori.');
    if(q){const res=await raw('/rest/v1/preventivi?id=eq.'+encodeURIComponent(q.id),{method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(body)});if(!Array.isArray(res)||!res.length)throw new Error('Preventivo non aggiornato.')}
    else await insert('preventivi',{...body,origine:'gestionale'});
    closeSheet();toast(q?'Preventivo aggiornato':'Preventivo creato');await ensureExtra(true);render();
  });
}
function quotePdf(id){openPdf(async()=>{const r=await raw('/functions/v1/professional-quotes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'generate',id})});if(!r||!r.success)throw new Error((r&&r.error)||'PDF non creato.');return r.signedUrl})}

/* avvisi: controllo ogni minuto mentre l'app è aperta */
const SEEN='dg-semplice-avvisi-visti';
let unseen=0,lastNotif=null;
async function pollNotifiche(){
  if(!session||!me||document.visibilityState!=='visible')return;
  try{
    const since=localStorage.getItem(SEEN)||new Date(Date.now()-86400000).toISOString();
    const rows=await get('notifiche',{select:'id,titolo,messaggio,created_at',created_at:'gt.'+since,order:'created_at.desc',limit:'20'});
    const n=(rows||[]).length;
    if(n&&rows[0].id!==lastNotif){lastNotif=rows[0].id;if(unseen)toast('Nuovo avviso: '+(rows[0].titolo||'')+(rows[0].messaggio?' · '+rows[0].messaggio:''))}
    if(n!==unseen){unseen=n;const b=document.querySelector('.nav [data-tab="altro"]');if(b)b.dataset.badge=n?String(n):''}
  }catch{}
}
setInterval(pollNotifiche,60000);
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
    S.lastPayment={id:res&&res.payment_id,name:nameOf(b),amount:amt,tripId:b.viaggio_id,bookingId:b.id};
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
  if(tab&&!tab.closest('.login')){S.tab=tab.dataset.tab;S.clientKey=null;if(S.tab==='viaggi')S.tripId=null;if(S.tab==='prenota'&&S.book&&S.book.done)S.book=null;S.search='';render();window.scrollTo(0,0);return}
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
    case 'tripForm':tripFormSheet(id);break;
    case 'toggleMap':S.showMap=!S.showMap;render();break;
    case 'openBooking':closeSheet();bookingSheet(id);break;
    case 'pickSeat':{const P=seatPick;if(!P)break;const v=a.dataset.v;if(P.sel.has(v))P.sel.delete(v);else{if(P.sel.size>=P.need){const first=[...P.sel][0];P.sel.delete(first)}P.sel.add(v)}seatSheet();break}
    case 'openClient':S.clientKey=id;render();window.scrollTo(0,0);break;
    case 'closeClient':S.clientKey=null;render();break;
    case 'accTab':accTab=a.dataset.v;S.accMore=false;render();break;
    case 'accMore':S.accMore=true;render();break;
    case 'accReload':S.acc=null;render();break;
    case 'compNew':compNewSheet();break;
    case 'compLink':compLinkSheet(id);break;
    case 'profTrip':profTripSheet(id);break;
    case 'receipt':receipt(id);break;
    case 'paxList':passengerList(tripById(id));break;
    case 'waGroup':waGroupSheet(tripById(id));break;
    case 'agNew':agNewSheet();break;
    case 'agDone':agDone(id);break;
    case 'riepilogo':S.tab='riepilogo';if(id)S.rpTrip=id;S.rpFilter='';render();window.scrollTo(0,0);break;
    case 'rpFilter':S.rpFilter=S.rpFilter===a.dataset.v?'':a.dataset.v;render();break;
    case 'rpPdf':rpPdf(a.dataset.v);break;
    case 'presenze':S.tab='presenze';S.tripId=id;render();window.scrollTo(0,0);break;
    case 'checkin':toggleCheckin(id);break;
    case 'shareRcpt':{const b=S.bookings.find(x=>x.id===a.dataset.b);shareReceiptSheet(id,b?nameOf(b):'cliente',b&&b.telefono,'trip');break}
    case 'rentEdit':rentalSheet(id);break;
    case 'rentPay':rentalPaySheet(id);break;
    case 'quoteEdit':quoteSheet(id);break;
    case 'quotePdf':quotePdf(id);break;
  }
});
document.addEventListener('input',e=>{
  const k=e.target.dataset&&e.target.dataset.input;if(!k)return;const v=e.target.value,B=S.book;
  if(k==='clientQ'){S.clientQ=v;const pos=e.target.selectionStart;render();const s=document.querySelector('[data-input="clientQ"]');if(s){s.focus();try{s.setSelectionRange(pos,pos)}catch{}}return}
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
  if(k==='rpTrip'){S.rpTrip=e.target.value;S.rpFilter='';render()}
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
