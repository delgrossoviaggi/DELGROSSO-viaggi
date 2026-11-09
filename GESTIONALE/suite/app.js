/* DELGROSSO VIAGGI 2.0 — standalone, no dependencies.
   Production data is never bundled or cached. Server-side Supabase RLS and RPC enforce writes.
   After verified operator login, writes are available without repeated settings toggles.
   Supabase Auth, RLS, server checks and explicit confirmation for destructive tasks remain. */
(function(){'use strict';
const $=id=>document.getElementById(id),Model=window.DG2SeatModel,Cash=window.DG2Cash,Ledger=window.DG2Ledger,Pdf=window.DG2Pdf;
const URL_BASE='https://chkuayhbmitdmzmmvona.supabase.co';
// Public publishable key; intentionally never use or embed service_role/sb_secret.
const PUBLIC_KEY='sb_publishable_H29K1BV5ZE1rT8xo0PIzVA_wF6zC7je';
const DRAFT_KEY='delgrosso_v2_layouts_20261106';
const SESSION_KEY='dg2_operator_session_tab_v1';
// Only names are entered by operators; account emails are resolved on the Supabase
// Edge Function, never stored in the browser or included in this release.
const ALLOWED_OPERATOR_ALIASES=['nicola','raffaele'];
const normalizeLogin=input=>String(input||'').trim().toLowerCase();

const pageInfo={dashboard:['Control Room','Il tuo centro operativo'],viaggi:['Viaggi e partenze','Pianificazione, fermate e BUS BIS'],prenotazioni:['Prenotazioni','Clienti, caparre e saldo'],control:['Posti e Check-in','Piantine originali e spostamenti'],piantine:['Editor piantine','Crea e modifica gli schemi'],cassa:['Cassa Nicola e Raffaele','Incassi separati, trasferimenti e rimborsi'],pagamenti:['Movimenti e pagamenti','Ricevute, acconti e saldi'],operativo:['Centro operativo','Presenze, attività e partenze'],assistente:['Assistente operativo','Acconti da verificare e segnalazioni'],agenda:['Agenda completa','Appuntamenti, attività e scadenze'],fermate:['Passeggeri per paese','Conteggio per fermata di partenza e BUS BIS'],statistiche:['Statistiche','Viaggi, occupazione e dati operativi'],economia:['Economia','Entrate e uscite registrate'],backup:['Backup & export','Esportazione CSV degli archivi'],flotta:['Flotta','Tutti i mezzi e le piantine'],noleggi:['Noleggi autobus','Disponibilità e contratti'],preventivi:['Preventivi','Richieste e offerte'],clienti:['Clienti','Rubrica clienti e prenotazioni'],whatsapp:['WhatsApp gruppi','Inviti con controllo del consenso'],comunicazioni:['Comunicazioni','Messaggi tra operatori'],flottaoperativa:['Manutenzioni e carburante','Controlli tecnici, rifornimenti e blocchi mezzi'],centropro:['Centro Pro','CRM, anomalie e checklist'],notifiche:['Notifiche','Aggiornamenti gestionali'],integrita:['Integrità dati','Controlli tra prenotazioni, posti e pagamenti'],archivio:['Archivio documenti','Storico documenti e ricevute esistenti'],chiusure:['Chiusura 360','Chiusure storiche, saldi e margini'],impostazioni:['Impostazioni','Accesso, sicurezza, esportazione dati']};
const initial={trips:[],bookings:[],seats:[],fleet:[],payments:[],operators:[],transfers:[],stops:[],rentals:[],quotes:[],clients:[],notifications:[],assistantEvents:[],documents:[],receipts:[],closures:[],waitlist:[],groupInvites:[],groupConsents:[],tasks:[],activities:[],economy:[],layoutTemplates:[],operatorMessages:[],maintenances:[],fuel:[],fleetBlocks:[],crm:[],anomalies:[],checklists:[]};
const state={bookingDraft:null,noticeCount:0,writeBusy:false,page:'dashboard',mode:'locked',write:false,token:'',refreshToken:'',expiresAt:0,userId:'',failedTables:[],data:structuredClone(initial),options:{search:'',tripId:'',bookingId:'',cashTrip:'',agendaMonth:new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit'}).format(new Date()),agendaFilter:'tutti',agendaSearch:'',agendaStatus:'aperti',boardingTripId:'',statsTripId:'',tripView:'attivi'},layoutKey:'GT53',layout:Model.fromLegacy('GT53'),drafts:{},selectedSeats:new Set(),busy:false};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=x=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(x)||0);
const date=x=>x&&/^\d{4}-\d{2}-\d{2}/.test(x)?x.slice(8,10)+'/'+x.slice(5,7)+'/'+x.slice(0,4):x||'—';
const dateISO=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),num=x=>Number(x)||0;
const localTime=x=>{if(!x)return '—';const d=new Date(x);return Number.isNaN(d.getTime())?'Data non valida':d.toLocaleString('it-IT',{timeZone:'Europe/Rome',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});};
const fmt=x=>esc(x??'—'),asOptions=(items,active)=>items.map(([v,t])=>`<option value="${esc(v)}" ${String(v)===String(active)?'selected':''}>${esc(t)}</option>`).join('');
const tag=s=>{const x=String(s||'').toLowerCase();return `<span class="tag ${/conferm|pagat|attiv|disponib|registrat/.test(x)?'green':/annull|scadut|rifiut/.test(x)?'red':'amber'}">${esc(s||'—')}</span>`};
const section=(title,caption,actions='')=>`<div class="sectionhead"><div><h2>${title}</h2><p>${caption}</p></div><div class="actions">${actions}</div></div>`;
const btn=(name,action,cls='outline',attrs='')=>`<button type="button" class="btn ${cls}" data-action="${action}" ${attrs}>${name}</button>`;
const panel=(title,body)=>`<article class="panel"><h3>${title}</h3>${body}</article>`;
const tr=(cells,actions='')=>`<tr>${cells.map(v=>`<td>${v}</td>`).join('')}${actions?`<td><div class="tableactions">${actions}</div></td>`:''}</tr>`;
const table=(cols,rows,empty='Nessun dato disponibile')=>`<div class="scroll"><table><thead><tr>${cols.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.join(''):`<tr><td colspan="${cols.length}" class="empty">${esc(empty)}</td></tr>`}</tbody></table></div>`;
const options=(name,id,allowBlank=true)=>`${allowBlank?'<option value="">Tutti / Seleziona</option>':''}${asOptions((state.data[name]||[]).map(t=>[t.id,tripLabel(t)]),id)}`;
const tripLabel=t=>(t.titolo||t.destinazione||'Viaggio')+' · '+date(t.data_partenza)+(t.bis_parent_id?' · BUS BIS '+(t.bis_numero||2):'');
const tripFor=id=>state.data.trips.find(t=>t.id===id),bookingFor=id=>state.data.bookings.find(b=>b.id===id),busFor=id=>state.data.fleet.find(f=>f.id===id);
const isCancelled=b=>/annull|cancel|cancell/i.test(String(b?.stato||''));
const tripBookings=id=>state.data.bookings.filter(b=>b.viaggio_id===id&&!isCancelled(b));
// Legacy bookings sometimes store the seat numbers only in prenotazioni.posti_selezionati.
// Merge both sources to avoid showing reserved seats as available (Larino 13/12/2026).
const bookingSeatNumbers=b=>String(b?.posti_selezionati||'').split(/[;,\s]+/).map(s=>s.trim()).filter(s=>/^[1-9]\d*$/.test(s)).map(s=>String(Number(s)));
const occupied=(tripId,excludeBookingId='')=>{
 const taken=new Set();
 for(const s of state.data.seats){
  if(s.viaggio_id!==tripId||s.prenotazione_id===excludeBookingId||isCancelled(bookingFor(s.prenotazione_id)))continue;
  const seat=String(s.posto||'').trim();if(/^[1-9]\d*$/.test(seat))taken.add(String(Number(seat)));
 }
 for(const b of tripBookings(tripId)){
  if(b.id===excludeBookingId)continue;
  for(const seat of bookingSeatNumbers(b))taken.add(seat);
 }
 return taken;
};
const bookingsCount=id=>tripBookings(id).reduce((a,b)=>a+num(b.posti),0);
function notify(text,bad=false){document.getElementById('toast')?.remove();const x=document.createElement('div');x.id='toast';x.textContent=text;x.setAttribute('role','status');if(bad)x.style.background='#a5314c';document.body.append(x);setTimeout(()=>x.remove(),4900)}
function safeParse(x){try{return JSON.parse(x)}catch{return {}}}
function getDrafts(){const result={};try{const x=safeParse(localStorage.getItem(DRAFT_KEY)||'{}');if(x&&typeof x==='object'&&!Array.isArray(x)){for(const [k,v]of Object.entries(x).slice(0,100))if(!Model.validate(v))result[k]=v}}catch(e){console.warn('Bozze locali non disponibili')}return result}
state.drafts=getDrafts();state.data=structuredClone(initial);
function updateMode(){
 const online=state.mode==='live'&&Boolean(state.token);
 const x=$('mode-indicator');
 x.className='mode '+(online?(state.write?'write':'live'):'');
 x.textContent=!online?'ACCESSO RICHIESTO':'SUPABASE · OPERATIVO';
 $('side-state').textContent=!online?'Accedi con l’account operatore':'Operatore verificato · modifiche disponibili';
 $('btn-login').hidden=online;$('btn-logout').hidden=!online;
 $('banner').innerHTML=!online?'🔐 <b>Accesso operatore obbligatorio.</b> Il gestionale è collegato a Supabase ma non mostra dati prima del login.':'🔐 <b>Operatore autenticato.</b> Operazioni disponibili secondo i tuoi permessi Supabase. Non serve attivare la scrittura nelle Impostazioni.';
 $('banner').classList.toggle('warning',false);
}
const canWrite=()=>state.mode==='live'&&state.write&&Boolean(state.token);
function requireWrite(){if(canWrite())return true;notify('Accedi come operatore autorizzato per apportare modifiche su Supabase.',true);return false}
const uuid=()=>{if(globalThis.crypto?.randomUUID)return crypto.randomUUID();const a=new Uint8Array(16);crypto.getRandomValues(a);a[6]=a[6]&15|64;a[8]=a[8]&63|128;return [...a].map((v,i)=>v.toString(16).padStart(2,'0')+([3,5,7,9].includes(i)?'-':'')).join('')};
const isConfigured=()=>state.mode==='live'&&!!state.token;
function persistSession(){
 try{if(state.mode==='live'&&state.token&&state.refreshToken)sessionStorage.setItem(SESSION_KEY,JSON.stringify({token:state.token,refreshToken:state.refreshToken,expiresAt:state.expiresAt,userId:state.userId}));else sessionStorage.removeItem(SESSION_KEY)}catch{}
}
async function withTimeout(url,opts={},milliseconds=22000){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),milliseconds);
 try{return await fetch(url,{...opts,signal:controller.signal})}catch(e){if(e?.name==='AbortError')throw Error('Connessione lenta: richiesta scaduta. Aggiorna lo stato prima di riprovare.');throw e}finally{clearTimeout(timer)}
}
async function request(path,{method='GET',body,prefer}={}){
 if(!isConfigured())throw Error('Accesso Supabase richiesto');
 if(method!=='GET'&&!requireWrite())throw Error('Accesso operatore richiesto per modificare i dati');
 const go=async()=>withTimeout(URL_BASE+'/rest/v1/'+path,{method,headers:{apikey:PUBLIC_KEY,Authorization:'Bearer '+state.token,'Content-Type':'application/json',...(prefer?{'Prefer':prefer}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{}),cache:'no-store'});
 let r;
 try{r=await go()}catch(e){if(method==='GET')r=await go();else throw e} // Never blindly retry writes.
 if(r.status===401){if(await refreshToken())r=await go();else{logout();throw Error('Sessione scaduta: effettua nuovamente l’accesso')}}
 const txt=await r.text();let out;try{out=txt?JSON.parse(txt):null}catch{out=txt}
 if(!r.ok)throw Error(typeof out==='object'&&(out?.message||out?.error)?(out.message||out.error):'HTTP '+r.status);
 return out;
}
async function rpc(name,args){return request('rpc/'+name,{method:'POST',body:args,prefer:'return=representation'})}
async function refreshToken(){
  // Same-origin embedded mode uses the V1 parent as the single Supabase refresh-token owner.
  try{
    if(window.parent!==window && window.parent.location.origin===location.origin
       && typeof window.parent.dgSuiteGetSession==='function'){
      const parentSession=await window.parent.dgSuiteGetSession();
      if(!parentSession?.access_token||!parentSession?.refresh_token)return false;
      state.token=parentSession.access_token;state.refreshToken=parentSession.refresh_token;
      state.expiresAt=Number(parentSession.expires_at||0)*1000;
      state.userId=parentSession.user?.id||state.userId;
      persistSession();return true;
    }
  }catch(e){console.warn('Sessione condivisa da rinnovare:',e.message);return false;}
  if(!state.refreshToken)return false;try{const r=await withTimeout(URL_BASE+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:PUBLIC_KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:state.refreshToken}),cache:'no-store'});const d=await r.json();if(!r.ok||!d.access_token)return false;state.token=d.access_token;state.refreshToken=d.refresh_token;state.expiresAt=Date.now()+(Number(d.expires_in)||3600)*1000;persistSession();return true}catch{return false}}
async function verifyOperatorSession(){
 if(!state.token||!state.userId)return false;
 const r=await withTimeout(URL_BASE+'/rest/v1/operatori_gestionale?select=user_id,attivo,username&user_id=eq.'+encodeURIComponent(state.userId)+'&limit=1',{headers:{apikey:PUBLIC_KEY,Authorization:'Bearer '+state.token},cache:'no-store'});
 if(!r.ok)return false;
 const o=await r.json();return Array.isArray(o)&&o.some(x=>x.user_id===state.userId&&x.attivo===true&&ALLOWED_OPERATOR_ALIASES.includes(normalizeLogin(x.username)));
}
async function restoreSession(){
 let old;try{old=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null')}catch{}
 if(!old?.token||!old?.refreshToken||!old?.userId)return false;
 state.token=old.token;state.refreshToken=old.refreshToken;state.expiresAt=old.expiresAt||0;state.userId=old.userId;
 try{
  if(Date.now()>state.expiresAt-60000&&!await refreshToken())throw Error('Sessione scaduta');
  if(!await verifyOperatorSession())throw Error('Operatore non autorizzato');
  state.mode='live';state.write=true;persistSession();return true;
 }catch{state.token='';state.refreshToken='';state.userId='';state.mode='locked';persistSession();return false}
}
async function rows(name,select='*'){
 if(!isConfigured())return [];
 const all=[];const size=750;
 for(let i=0;i<100;i++){
  const endpoint=`${encodeURIComponent(name)}?select=${encodeURIComponent(select)}&limit=${size}&offset=${i*size}`;
  const page=await request(endpoint);
  if(!Array.isArray(page))throw Error('Risposta non valida per '+name);
  all.push(...page);if(page.length<size)return all;
 }
 throw Error('Elenco '+name+' troppo grande: usare filtri server');
}
const datasets=[['trips','viaggi'],['bookings','prenotazioni'],['seats','prenotazione_posti'],['fleet','flotta'],['payments','pagamenti'],['operators','operatori_gestionale'],['transfers','cassa_trasferimenti'],['stops','viaggi_fermate'],['rentals','noleggi_bus'],['quotes','preventivi'],['clients','clienti'],['notifications','notifiche'],['assistantEvents','assistente_eventi'],['documents','documenti_gestionali'],['receipts','ricevute_versioni'],['closures','dg_viaggi_chiusure'],['waitlist','lista_attesa'],['groupInvites','dg_whatsapp_trip_invites_v61'],['groupConsents','dg_trip_group_consents_v65'],['tasks','scadenze_gestionale'],['activities','attivita_gestionale'],['economy','economia_movimenti'],['operatorMessages','dg_operator_communications'],['maintenances','manutenzioni_flotta'],['fuel','carburante_flotta'],['fleetBlocks','dg_blocchi_flotta'],['crm','crm_attivita'],['anomalies','anomalie_gestionale'],['checklists','checklist_mezzi'],['layoutTemplates','dg2_piantine']];
async function sync(){if(!isConfigured())return;if(state.busy)return;state.busy=true; const newData=structuredClone(initial),fail=[];
 try{
 // Parallelismo limitato: più fluido del caricamento seriale, senza sovraccaricare Supabase.
 for(let j=0;j<datasets.length;j+=4){
  await Promise.all(datasets.slice(j,j+4).map(async([key,tablename])=>{
   try{newData[key]=await rows(tablename)}catch(err){fail.push(tablename+': '+err.message);newData[key]=[]}
  }));
 }
 for(const [key,table] of datasets)if(fail.some(x=>x.startsWith(table+':')))newData[key]=state.data[key]||[];
 state.failedTables=fail;state.data=newData;$('sync-time').textContent='ultimo aggiornamento '+new Date().toLocaleTimeString('it-IT');
 render();if(fail.length&&fail.some(x=>!x.startsWith('dg2_piantine:')))notify('Alcune sezioni non sono leggibili per i permessi attuali: '+fail.slice(0,3).join(' | '),true);else notify('Dati aggiornati senza modifiche al database');
 }finally{state.busy=false}
}
async function login(event){
 event.preventDefault();
 const errorEl=$('auth-error'),submit=event.submitter||$('auth-form').querySelector('[type="submit"]');
 errorEl.textContent='';errorEl.hidden=true;
 const username=normalizeLogin($('auth-email').value),password=$('auth-password').value;
 if(location.protocol==='file:'){
   errorEl.textContent='Il gestionale è stato aperto come file locale. Chiudi questa scheda, avvia AVVIA_WINDOWS.bat e apri http://127.0.0.1:8787/GESTIONALE_V2/index.html. Non è un problema di password.';
   errorEl.hidden=false;return;
 }
 if(!ALLOWED_OPERATOR_ALIASES.includes(username)){
   errorEl.textContent='Inserisci Nicola oppure Raffaele.';errorEl.hidden=false;
   $('auth-email').focus();return;
 }
 if(!password){errorEl.textContent='Inserisci la password.';errorEl.hidden=false;return;}
 if(submit){submit.disabled=true;submit.textContent='Verifica credenziali…';}
 try{
  // The server translates the username to the existing Auth account and verifies the
  // password through Supabase Auth. No service key or stored operator email in client.
  const resp=await fetch(URL_BASE+'/functions/v1/dg2-operator-login',{
   method:'POST',headers:{'Content-Type':'application/json',apikey:PUBLIC_KEY},
   body:JSON.stringify({username,password}),cache:'no-store'
  });
  const d=await resp.json().catch(()=>({}));
  if(!resp.ok||!d?.access_token||!d?.refresh_token)
    throw Error(d.error||'Accesso non riuscito. Verifica utente e password.');
  state.token=d.access_token;state.refreshToken=d.refresh_token;
  state.expiresAt=Date.now()+(Number(d.expires_in)||3600)*1000;state.userId=d.user?.id||'';
  if(!state.userId)throw Error('Account operatore non riconosciuto.');
  // Defense in depth: also verify the RLS-visible operator record in the browser.
  const opResp=await fetch(URL_BASE+'/rest/v1/operatori_gestionale?select=user_id,attivo,username&user_id=eq.'+encodeURIComponent(state.userId)+'&limit=1',{
   headers:{apikey:PUBLIC_KEY,Authorization:'Bearer '+state.token},cache:'no-store'
  });
  if(!opResp.ok)throw Error('Impossibile verificare i permessi operatore.');
  const ops=await opResp.json();
  if(!Array.isArray(ops)||!ops.some(o=>o.user_id===state.userId&&o.attivo===true&&normalizeLogin(o.username)===username))
   throw Error('Profilo operatore non autorizzato.');
  state.mode='live';state.write=true;persistSession();$('auth-password').value='';$('auth-dialog').close();updateMode();await sync();
 }catch(err){
  // Never leave a partially authenticated session accessible after an error.
  state.token='';state.refreshToken='';state.expiresAt=0;state.userId='';state.mode='locked';state.write=false;
  state.data=structuredClone(initial);persistSession();updateMode();render();$('auth-password').value='';
  const message=String(err?.message||'Impossibile accedere.');
  errorEl.textContent=message==='Failed to fetch'||/networkerror|fetch failed|network request failed/i.test(message)?
    'Connessione al login Supabase bloccata dal browser o dalla rete. Apri il gestionale dal server locale usando AVVIA_WINDOWS.bat e verifica che l’indirizzo inizi con http://127.0.0.1:8787/.' : message;
  errorEl.hidden=false;
 }finally{if(submit){submit.disabled=false;submit.innerHTML='Accedi al gestionale <span aria-hidden="true">→</span>';}}
}

function logout(){
 const token=state.token;if(token)fetch(URL_BASE+'/auth/v1/logout',{method:'POST',headers:{apikey:PUBLIC_KEY,Authorization:'Bearer '+token},cache:'no-store'}).catch(()=>{});
 Object.assign(state,{mode:'locked',write:false,token:'',refreshToken:'',expiresAt:0,userId:'',failedTables:[],data:structuredClone(initial)});
 state.options.bookingId='';state.selectedSeats.clear();state.bookingDraft=null;persistSession();
 $('sync-time').textContent='nessun accesso attivo';
 updateMode();render();if(!$('auth-dialog').open)$('auth-dialog').showModal();notify('Sessione chiusa. I dati privati non sono conservati nel browser.');
}
function printHtml(title,body){
 const w=window.open('','_blank');if(!w){notify('Consenti l’apertura della finestra per stampare o salvare il PDF',true);return}
 w.document.open();w.document.write(`<!doctype html><html lang="it"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
 @page{size:A4;margin:15mm}body{font-family:Arial,sans-serif;color:#15243b;font-size:11px}header{border-bottom:4px solid #3158ac;padding-bottom:10px;margin-bottom:20px;display:flex;justify-content:space-between}.brand{font-size:22px;font-weight:800;color:#143564}.sub{color:#6d7d94}h2{font-size:18px;margin:20px 0 8px}table{border-collapse:collapse;width:100%;font-size:10px;margin-top:12px}td,th{border:1px solid #d9e1ed;padding:7px;text-align:left}th{background:#f0f4fa}.total{display:inline-block;padding:10px 18px;background:#eef3ff;margin:8px 8px 8px 0;border-radius:5px;font-weight:700}.muted{color:#748198}.print-note{margin-top:20px;font-size:9px;color:#75839a}button{padding:10px;margin:10px 0;background:#294ca2;color:#fff;border:0;border-radius:5px}@media print{button{display:none!important}}
 </style></head><body><header><div><div class="brand"><img src="${esc(new URL('./assets/logo-delgrosso-wordmark.webp',location.href).href)}" style="max-width:190px;max-height:80px;object-fit:contain" alt="DELGROSSO VIAGGI"></div><div class="sub">Documento operativo · ${esc(date(dateISO()))}</div></div><div>${esc(title)}</div></header><button onclick="window.print()">🖨️ Stampa / Salva come PDF</button>${body}<div class="print-note">Documento elaborato da DELGROSSO VIAGGI 2.0. Verificare l’esattezza delle informazioni prima della consegna.</div></body></html>`);w.document.close();w.focus();
}
function exportCSV(rows,filename){const raw=rows.map(row=>row.map(v=>{const t=String(v??'').replace(/\r?\n/g,' ');return '"'+( /^[=+@-]/.test(t)?'\t':'')+t.replace(/"/g,'""')+'"'}).join(';')).join('\r\n');const blob=new Blob(['\uFEFF'+raw],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000)}
function renderDashboard(){const d=state.data,trips=d.trips.filter(t=>!t.archiviato_at);const book=d.bookings.filter(b=>!isCancelled(b));const paid=d.payments.filter(p=>/registrat|confermat|pagat/i.test(p.stato||''));const events=trips.slice().sort((a,b)=>String(a.data_partenza||'').localeCompare(String(b.data_partenza||''))).slice(0,12);
 const kpis=[['Partenze',trips.length,'Viaggi registrati'],['Prenotazioni',book.length,'Prenotazioni attive'],['Posti occupati',book.reduce((n,b)=>n+num(b.posti),0),'Somma passeggeri'],['Pagamenti',paid.length,'Movimenti registrati']].map(([t,n,s])=>`<div class="kpi"><span>${t}</span><strong>${n}</strong><small>${s}</small></div>`).join('');
 const rows=events.map(t=>tr([`<b>${fmt(t.titolo)}</b>`,date(t.data_partenza),tag(t.stato),`<b>${bookingsCount(t.id)}/${num(t.posti_totali)}</b>`,t.bis_parent_id?'BUS BIS '+num(t.bis_numero):'Principale'],btn('Apri','trip-select','small',`data-id="${esc(t.id)}"`)));
 const due=d.bookings.filter(b=>!isCancelled(b)&&num(b.totale)>num(b.pagato)).length;
 return section('Panoramica operativa','Viaggi, posti e pagamenti in un unico colpo d’occhio',btn('Esporta riepilogo','dashboard-print'))+`<div class="kpis">${kpis}</div><div class="two-col">${panel('Prossime partenze',table(['Viaggio','Data','Stato','Posti','Autobus',''],rows,'Nessun viaggio configurato'))}${panel('Da tenere sotto controllo',`<div class="helpbox"><b>${due} prenotazioni con importi da saldare</b><p class="subtle">Controlla gli acconti e i saldi. I movimenti finanziari dipendono dalle autorizzazioni Supabase.</p></div><div class="separator"></div><div class="helpbox"><b>Gestione dei posti</b><p class="subtle">Le piantine GT53 e GT63 / GT63B mantengono la disposizione originale. Modifica solo attraverso i comandi dedicati.</p></div><div class="separator"></div><p class="subtle">Dati aggiornati solo su richiesta. Non vengono salvate password né dati passeggeri in questo browser.</p>` )}</div>`;
}
function getLedger(){if(state.failedTables.some(e=>/^(viaggi|prenotazioni|pagamenti|operatori_gestionale):/.test(e)))throw Error('Report non disponibile: impossibile leggere tutti gli archivi viaggi, prenotazioni, pagamenti e operatori');return Ledger.build({trips:state.data.trips,bookings:state.data.bookings,payments:state.data.payments,operators:state.data.operators})}
function reportForTrip(id){const report=getLedger(),group=report.groupsById.get(report.rootOf(id));if(!group)throw Error('Viaggio non trovato nel report contabile');return group}
function renderTrips(){const q=state.options.search.toLowerCase(),view=state.options.tripView;
 const all=state.data.trips,active=all.filter(t=>!t.archiviato_at).length,archived=all.length-active;
 const list=all.filter(t=>(view==='tutti'||(view==='archiviati'?!!t.archiviato_at:!t.archiviato_at))&&((t.titolo||'')+' '+(t.destinazione||'')+' '+(t.data_partenza||'')).toLowerCase().includes(q)).sort((a,b)=>String(b.data_partenza).localeCompare(String(a.data_partenza)));
 const cards=list.map(t=>{const a=!!t.archiviato_at;const actions=btn('Modifica','trip-edit','small',`data-id="${esc(t.id)}"`)+btn(a?'Ripristina':'Archivia',a?'trip-restore':'trip-archive','small',`data-id="${esc(t.id)}"`)+btn('Elimina','trip-delete','small',`data-id="${esc(t.id)}"`)+btn('PDF quote','trip-pdf','small',`data-id="${esc(t.id)}"`)+(a?'':btn('Apri posti','trip-select','small',`data-id="${esc(t.id)}"`)+(t.bis_parent_id?btn('Cambia BUS BIS','trip-bis-bus','small',`data-id="${esc(t.id)}"`):btn('+ BUS BIS','trip-bis','small',`data-id="${esc(t.id)}"`)));
 return `<article class="trip-card"><div class="trip-top"><div><h3>${fmt(t.titolo)}</h3><p>${fmt(t.destinazione)}</p></div>${a?tag('Archiviato'):tag(t.stato)}</div><div class="trip-facts"><div><small>DATA</small><b>${date(t.data_partenza)}</b></div><div><small>ORARIO</small><b>${fmt(String(t.ora_partenza||'').slice(0,5))}</b></div><div><small>POSTI</small><b>${bookingsCount(t.id)} / ${num(t.posti_totali)}</b></div><div><small>PREZZO</small><b>${money(t.prezzo)}</b></div></div><div class="trip-bus">${t.bis_parent_id?'BUS BIS '+num(t.bis_numero):'BUS PRINCIPALE'}${t.autobus_id?' · '+fmt(busFor(t.autobus_id)?.modello||t.autobus||'Autobus assegnato'):''}</div><div class="trip-actions">${actions}</div></article>`;
 });
 return section('Viaggi e partenze','Modifica, archiviazione, ripristino ed eliminazione protetta · PDF per ogni viaggio',btn('+ Nuovo viaggio','trip-new','primary')+btn('Esporta CSV','trip-csv'))+
 `<div class="panel"><div class="filterbar"><label>Visualizza<select id="trip-view">${asOptions([['attivi','Attivi ('+active+')'],['archiviati','Archiviati ('+archived+')'],['tutti','Tutti i viaggi']],view)}</select></label><input data-filter="search" value="${esc(state.options.search)}" placeholder="Cerca viaggio, destinazione o data"><span class="subtle">${list.length} viaggi visualizzati</span></div><p class="hint">Prima di scaricare il PDF premi Aggiorna, così riporti gli ultimi incassi. Archiviare un viaggio lo nasconde dagli elenchi operativi e mantiene prenotazioni e incassi. Eliminazione definitiva disponibile solo se il controllo Supabase non rileva dati storici da conservare.</p><div class="trip-grid">${cards.join('')||'<p class="subtle">Nessun viaggio da visualizzare con questi filtri.</p>'}</div></div>`;
}
function renderBookings(){
 const q=state.options.search.toLowerCase();const entries=state.data.bookings.filter(b=>((b.cliente||'')+' '+(b.codice||'')+' '+(tripFor(b.viaggio_id)?.titolo||'')+' '+(b.telefono||'')).toLowerCase().includes(q));
 const archived=entries.filter(b=>Boolean(b.confirmation_storage_path)).length;
 const rs=entries.slice().sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).map(b=>{
  const doc=b.confirmation_storage_path?'<span class="tag green">PDF archiviato</span>':'<span class="tag amber">PDF da archiviare</span>';
  const actions=btn('Apri','booking-view','small',`data-id="${esc(b.id)}"`)+btn('Modifica','booking-edit','small',`data-id="${esc(b.id)}"`)+(b.confirmation_storage_path?btn('PDF','booking-archive-open','small',`data-id="${esc(b.id)}"`):btn('Archivia PDF','booking-archive-create','small',`data-id="${esc(b.id)}"`));
  return tr([`<b>${fmt(b.cliente)}</b><div class="subtle">${fmt(b.codice||b.id)}</div>`,fmt(tripFor(b.viaggio_id)?.titolo||'—'),num(b.posti),fmt(b.posti_selezionati),tag(b.stato),money(b.totale),money(num(b.totale)-num(b.pagato)),doc,localTime(b.created_at)],actions);
 });
 return section('Prenotazioni','Piantina durante l’inserimento, salvataggio su Supabase e archivio PDF',btn('+ Prenotazione con piantina','booking-new','primary')+btn('Esporta CSV','booking-csv'))+`<div class="panel"><div class="filterbar"><input data-filter="search" value="${esc(state.options.search)}" placeholder="Cerca nome, codice, telefono o viaggio"><span class="subtle">${entries.length} prenotazioni · ${archived} conferme archiviate</span></div><p class="hint">Il salvataggio avviene prima della generazione del PDF. Se l’archiviazione fallisce, la prenotazione rimane nell’elenco e puoi riprovare dal pulsante “Archivia PDF”.</p>${table(['Cliente','Viaggio','Persone','Posti','Stato','Totale','Residuo','Conferma','Inserita il',''],rs)}</div>`;
}

function layoutForTrip(t){const custom=state.data.layoutTemplates?.find(x=>x.flotta_id===t?.autobus_id&&x.attivo!==false);if(custom?.configurazione&&!Model.validate(custom.configurazione))return Model.clone(custom.configurazione);const b=busFor(t?.autobus_id);const key=String(b?.seat_layout||'').toUpperCase();if(Model.legacy[key])return Model.fromLegacy(key);return Model.fromLegacy(num(t?.posti_totali)>53?'GT63':'GT53')}
function seatMap(layout,tripId='',editing=false){const taken=tripId?occupied(tripId):new Set(),s=state.selectedSeats;return `<div class="bus"><div class="bus-front"><span>${esc(layout.frontLabel||'FRONTE BUS')}</span><span>◉ AUTISTA</span></div>${layout.rows.map((row,r)=>`<div class="bus-row">${row.map((cell,c)=>{const value=typeof cell==='number'?String(cell):cell,sel=typeof cell==='number'&&s.has(String(cell)),busy=typeof cell==='number'&&taken.has(String(cell));return `<button type="button" aria-label="Fila ${r+1} cella ${c+1} ${esc(value)}" title="${busy?'Posto già occupato':editing?'Modifica cella':'Seleziona posto'}" data-action="${editing?'edit-seat':'control-seat'}" data-row="${r}" data-col="${c}" data-seat="${esc(value)}" ${!editing&&!Number.isInteger(cell)?'disabled':''} class="seat ${Number.isInteger(cell)?'seat-number':esc(cell)} ${busy?'occupied':''} ${sel?'selected':''}">${Number.isInteger(cell)?cell:cell==='door'?'PORTA':cell==='aisle'?'·':'+'}</button>`}).join('')}</div>`).join('')}</div>`}
function renderControl(){const trips=state.data.trips.filter(t=>!t.archiviato_at).sort((a,b)=>String(a.data_partenza).localeCompare(String(b.data_partenza)));
 if(!state.options.tripId||!tripFor(state.options.tripId))state.options.tripId=trips[0]?.id||'';
 const trip=tripFor(state.options.tripId),book=state.data.bookings.filter(b=>b.viaggio_id===trip?.id&&!isCancelled(b));
 const bk=bookingFor(state.options.bookingId);
 const layout=trip?layoutForTrip(trip):Model.fromLegacy('GT53');const busy=occupied(trip?.id);
 const root=trip?.bis_parent_id||trip?.id,linked=trips.filter(t=>(t.bis_parent_id||t.id)===root);
 return section('Control Room · posti','Posti numerati, spostamenti e check-in',btn('Ricarica posti','refresh')+btn('Elenco partenza PDF','departure-print'))+`<div class="filterbar"><label>Seleziona viaggio<select id="control-trip">${asOptions(trips.map(t=>[t.id,tripLabel(t)]),trip?.id)}</select></label><label>Autobus del viaggio<select id="control-bus">${asOptions(linked.map(t=>[t.id,tripLabel(t)]),trip?.id)}</select></label></div>${trip?`<div class="editor-grid"><article class="panel"><div class="legend"><span>Libero</span><span class="busy">Occupato</span><span class="sel">Selezionato</span><span class="doorlabel">Porta</span></div>${seatMap(layout,trip.id)}<p class="inlineinfo"><b>${busy.size} posti occupati</b> · ${num(trip.posti_totali)} posti dichiarati · ${state.selectedSeats.size} selezionati</p><p class="hint">Seleziona prima una prenotazione, poi clicca sui posti liberi. Quando il numero di posti coincide con i passeggeri, puoi confermare la riassegnazione in modo atomico.</p></article><article class="panel"><h3>Passeggeri e posti assegnati</h3><div class="filterbar"><select id="control-booking"><option value="">Seleziona una prenotazione</option>${asOptions(book.map(b=>[b.id,(b.cliente||'Cliente')+' · '+b.posti+' posti · '+(b.posti_selezionati||'')]),bk?.viaggio_id&&((tripFor(bk.viaggio_id)?.bis_parent_id||bk.viaggio_id)===(trip.bis_parent_id||trip.id))?bk.id:'')}</select></div><div id="control-book-info" class="helpbox">${bk?.viaggio_id&&((tripFor(bk.viaggio_id)?.bis_parent_id||bk.viaggio_id)===(trip.bis_parent_id||trip.id))?'Prenotazione: '+fmt(bk.cliente)+' · '+num(bk.posti)+' passeggeri':'Seleziona una prenotazione da spostare.'}</div><p class="inlineinfo" id="control-seat-selection">Posti in selezione: ${[...state.selectedSeats].sort((a,b)=>num(a)-num(b)).join(', ')||'nessuno'}</p><div class="actions">${btn('Salva nuovi posti','control-save','primary')}${btn('Svuota selezione','control-clear')}</div><div class="separator"></div><h3>Check-in</h3>${table(['Cliente','Posti','Fermata','Stato',''],book.map(b=>tr([fmt(b.cliente),fmt(b.posti_selezionati),fmt(b.fermata_partenza),b.checkin_effettuato?'<span class="tag green">Presente</span>':'<span class="tag amber">Da verificare</span>'],btn(b.checkin_effettuato?'Annulla check-in':'Check-in','checkin','small',`data-id="${esc(b.id)}"`))))}</article></div>`:panel('Nessun viaggio','Crea un viaggio e assegnagli un autobus per usare le piantine.')}`;
}
function renderEditor(){const keys=[...Object.keys(Model.legacy),...Object.keys(state.drafts)];if(!keys.includes(state.layoutKey)){state.layoutKey='GT53';state.layout=Model.fromLegacy('GT53')}
 return section('Editor piantine bus','Modifica sedili, corridoi e porte senza toccare gli originali',btn('+ Nuovo schema','layout-new')+btn('Salva bozza','layout-save','primary')+btn('Assegna a un bus (V2)','layout-publish'))+`<div class="editor-grid"><article class="panel"><div class="formgrid"><label>Modello<select id="layout-select">${asOptions(keys.map(k=>[k,(state.drafts[k]?.name||Model.legacy[k]?.name||k)+(state.drafts[k]?' · bozza':' · originale')]),state.layoutKey)}</select></label><label>Nome piantina<input id="layout-name" value="${esc(state.layout.name)}" maxlength="80"></label></div><div class="separator"></div>${seatMap(state.layout,'',true)}<p class="hint">Premi una cella e scegli numero posto, empty (vuoto), aisle (corridoio), door (porta). I modelli originali non vengono mai modificati: le copie vengono salvate nel browser.</p></article><div class="editor-panel">${panel('Strumenti di costruzione',`<div class="actions">${btn('+ Aggiungi fila','layout-row-add')}${btn('− Rimuovi fila','layout-row-remove')}${btn('Duplica','layout-copy')}${btn('Ripristina','layout-reset')}</div><p class="inlineinfo">${Model.count(state.layout)} posti · ${state.layout.rows.length} file · numerazione controllata.</p><div class="separator"></div><div class="actions">${btn('Esporta JSON','layout-export','primary')}<label class="btn outline" style="cursor:pointer">Importa JSON<input id="layout-file" type="file" accept="application/json,.json" hidden></label></div><p class="hint">Le bozze sono locali, esporta il JSON per conservarle. Nessuna modifica ai record Supabase in questa sezione.</p>`)}${panel('Modelli di partenza',`<div class="helpbox">✔ GT53 · 53 posti<br>✔ GT63 · 63 posti<br>✔ GT63B · 63 posti<br><p>La numerazione, la posizione della porta e i corridoi sono identici ai modelli già nel vecchio gestionale e sul sito di prenotazione.</p></div>`)}</div></div>`;
}
function getCash(){return Cash.build({trips:state.data.trips,bookings:state.data.bookings,payments:state.data.payments,operators:state.data.operators,cashTransfers:state.data.transfers})}
function renderCash(){if(state.mode==='live'&&state.failedTables?.some(e=>/^(pagamenti|operatori_gestionale|cassa_trasferimenti):/.test(e)))return panel('Cassa non disponibile','<p class="error">Permessi insufficienti o archivio incompleto: non mostriamo totali parziali o fuorvianti. Verifica l’accesso a pagamenti, operatori e trasferimenti.</p>');let result;try{result=getCash()}catch(e){return panel('Errore di riconciliazione',`<p class="error">${esc(e.message)}</p>`)}
 const totals=result.totals,inc=result.inCaricoViaggi;
 const kpis=[['Incassati da Nicola',Cash.euro(totals.nicola),'Contanti netti'],['Incassati da Raffaele',Cash.euro(totals.raffaele),'Contanti netti'],['Non attribuiti',Cash.euro(totals.nonAttribuiti),'Da verificare'],['Netto totale viaggio',Cash.euro(totals.netto),'Rimborsi già sottratti']].map(([t,n,s])=>`<div class="kpi"><span>${t}</span><strong style="font-size:23px">${n}</strong><small>${s}</small></div>`).join('');
 const rs=result.groups.map(g=>tr([`<b>${fmt(g.trip.titolo)}</b><div class="subtle">${date(g.trip.data_partenza)} · ${g.buses.length} bus</div>`,Cash.euro(g.nicola),Cash.euro(g.raffaele),Cash.euro(g.nonAttribuiti),`<b>${Cash.euro(g.netto)}</b>`,String(g.movements.length)],btn('Dettaglio','cash-detail','small',`data-id="${esc(g.id)}"`)+btn('Scarica PDF','cash-trip-download','small',`data-id="${esc(g.id)}"`)));
 return section('Cassa Nicola e Raffaele','Ogni incasso attribuito all’operatore effettivo, mai supposto',btn('Riepilogo PDF','cash-print')+btn('CSV','cash-csv')+btn('Trasferimento cassa','cash-transfer','primary'))+`<div class="kpis">${kpis}</div>${panel('Contanti per viaggio',table(['Viaggio','Nicola','Raffaele','Da attribuire','Totale','Movimenti',''],rs))}${panel('Saldo in carico dopo i trasferimenti',`<div class="three-col"><div class="helpbox"><b>Nicola</b><h2>${Cash.euro(inc.nicola)}</h2></div><div class="helpbox"><b>Raffaele</b><h2>${Cash.euro(inc.raffaele)}</h2></div><div class="helpbox"><b>Da attribuire</b><h2>${Cash.euro(inc.nonAttribuiti)}</h2></div></div><p class="hint">I trasferimenti tra operatori non diventano nuovi incassi. Pagamenti POS e non contanti sono esclusi. Rimborsi e prenotazioni annullate restano tracciabili.</p>`)}${panel('Controlli automatici',`<p class="inlineinfo">Movimenti non contanti esclusi: <b>${result.excludedMethods}</b>. Rimborsi: <b>${Cash.euro(totals.refunds)}</b>.</p>${result.issues.length?result.issues.map(s=>`<p class="error">⚠ ${esc(s)}</p>`).join(''):'<p class="textgood">✓ Nessuna anomalia rilevata dal modello contanti.</p>'}`)}`;
}
function renderPayments(){const q=state.options.search.toLowerCase();const ps=state.data.payments.filter(p=>((p.cliente||'')+' '+(p.receipt_number||'')+' '+(p.tipo||'')+' '+(tripFor(p.viaggio_id)?.titolo||'')).toLowerCase().includes(q));const operMap=new Map(state.data.operators.map(o=>[o.user_id,o.nome||o.username]));
 const rs=ps.slice().sort((a,b)=>String(b.data_pagamento||b.created_at).localeCompare(String(a.data_pagamento||a.created_at))).map(p=>tr([fmt(p.receipt_number||String(p.id||'').slice(0,8)),fmt(p.cliente||bookingFor(p.prenotazione_id)?.cliente),fmt(tripFor(p.viaggio_id)?.titolo),tag(p.tipo),money(p.importo),fmt(p.metodo_pagamento||p.metodo),fmt(operMap.get(p.incassato_da_user_id)||p.incassato_da||'Non indicato'),date(p.data_pagamento||p.created_at)],btn(p.receipt_professional_path?'Apri ricevuta originale':'Genera ricevuta','payment-print','small',`data-id="${esc(p.id)}"`)+(p.receipt_professional_path?btn('Rigenera','payment-reissue','small',`data-id="${esc(p.id)}"`):'')+btn('Modifica movimento','payment-edit','small',`data-id="${esc(p.id)}"`)));
 return section('Pagamenti e movimenti','Seleziona il viaggio, cerca il prenotato e registra la quota con ricevuta professionale',btn('+ Registra pagamento','payment-new','primary')+btn('Esporta CSV','payments-csv'))+panel('Registro pagamenti',`<div class="filterbar"><input data-filter="search" value="${esc(state.options.search)}" placeholder="Cerca cliente, ricevuta, tipo, viaggio"></div>${table(['Ricevuta','Cliente','Viaggio','Tipo','Importo','Metodo','Incassato da','Data',''],rs)}`);
}
function agendaEvents(){
 const d=state.data, events=[];
 for(const t of d.trips||[])if(t.data_partenza)events.push({kind:'viaggio',date:t.data_partenza,title:t.titolo||t.destinazione||'Viaggio',detail:(t.ora_partenza||'')+' · '+(t.luogo_partenza||'')+' · '+bookingsCount(t.id)+' passeggeri',status:t.stato||'',id:t.id,closed:false});
 for(const t of d.rentals||[])if(t.data_partenza)events.push({kind:'noleggio',date:t.data_partenza,title:(t.referente||t.azienda||'Noleggio')+' · '+(t.tratta_partenza||'')+' → '+(t.tratta_destinazione||''),detail:(t.ora_partenza||'')+' · '+(t.passeggeri||0)+' pax',status:t.stato_noleggio||'',id:t.id,closed:!!t.archiviato_at});
 for(const t of d.tasks||[])if(t.data_scadenza)events.push({kind:'scadenza',date:t.data_scadenza,title:t.titolo||'Scadenza',detail:(t.tipo||'')+' · '+(t.note||t.descrizione||''),status:t.stato||'aperta',id:t.id,closed:/completat|chius|annull/i.test(t.stato||'')});
 for(const t of d.activities||[])if(t.scadenza)events.push({kind:'attivita',date:t.scadenza,title:t.titolo||'Attività',detail:(t.assegnata_a||'')+' · '+(t.descrizione||''),status:t.stato||'aperta',id:t.id,closed:/completat|chius|annull/i.test(t.stato||'')});
 return events.sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.kind).localeCompare(String(b.kind)));
}
function renderMonthCalendar(events,month){
 const [y,m]=String(month||'').split('-').map(Number);
 if(!Number.isInteger(y)||!Number.isInteger(m)||m<1||m>12)return '';
 const blanks=(new Date(y,m-1,1).getDay()+6)%7,days=new Date(y,m,0).getDate();
 const labels=['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
 const cells=labels.map(s=>`<span class="agenda-weekday">${s}</span>`);
 for(let k=0;k<blanks;k++)cells.push('<span class="agenda-blank" aria-hidden="true"></span>');
 for(let day=1;day<=days;day++){
  const key=month+'-'+String(day).padStart(2,'0');const items=events.filter(e=>e.date===key),today=key===dateISO();
  const chips=items.slice(0,3).map(e=>`<span class="agenda-chip ${esc(e.kind)}" title="${esc(e.title)}">${esc(e.title)}</span>`).join('');
  const overflow=items.length>3?`<span class="agenda-more">+${items.length-3} altri</span>`:'';
  cells.push(`<button type="button" class="agenda-day ${today?'today':''}" data-action="agenda-day" data-date="${esc(key)}" title="Aggiungi impegno il ${date(key)}"><strong>${day}</strong><span class="agenda-day-count">${items.length?items.length+' eventi':'+'}</span>${chips}${overflow}</button>`);
 }
 return `<div class="agenda-calendar" role="group" aria-label="Calendario operativo ${esc(month)}">${cells.join('')}</div><p class="hint">Tocca un giorno per aggiungere rapidamente un nuovo impegno. Viaggi, noleggi, attività e scadenze sono visualizzati nello stesso calendario.</p>`;
}

function renderAgenda(){
 const needed=['scadenze_gestionale','attivita_gestionale'];const failed=state.failedTables.filter(x=>needed.some(n=>x.startsWith(n+':')));
 const all=agendaEvents(),month=state.options.agendaMonth,filter=state.options.agendaFilter,query=state.options.agendaSearch.toLowerCase().trim(),status=state.options.agendaStatus;
 const rs=all.filter(e=>String(e.date).startsWith(month)&&(filter==='tutti'||e.kind===filter)&&(status==='tutti'||!e.closed)&&(!query||(e.title+' '+e.detail+' '+e.status).toLowerCase().includes(query)));
 const pending=all.filter(e=>(e.kind==='scadenza'||e.kind==='attivita')&&!e.closed);
 const past=pending.filter(e=>e.date<dateISO());
 const kpi=[['Eventi nel mese',rs.length],['Da completare',pending.length],['In ritardo',past.length],['Viaggi del mese',all.filter(e=>e.kind==='viaggio'&&e.date.startsWith(month)).length]].map(([name,qty])=>`<div class="kpi"><span>${esc(name)}</span><strong>${qty}</strong></div>`).join('');
 const action=e=>e.kind==='scadenza'||e.kind==='attivita'?`<div class="tableactions">${btn('Modifica','agenda-edit','small',`data-kind="${esc(e.kind)}" data-id="${esc(e.id)}"`)}${!e.closed?btn('✓ Completa','agenda-complete','small',`data-kind="${esc(e.kind)}" data-id="${esc(e.id)}"`):btn('Riapri','agenda-reopen','small',`data-kind="${esc(e.kind)}" data-id="${esc(e.id)}"`)}${btn('Elimina','agenda-delete','small',`data-kind="${esc(e.kind)}" data-id="${esc(e.id)}"`)}</div>`:e.kind==='viaggio'?btn('Viaggio','trip-edit','small',`data-id="${esc(e.id)}"`):btn('Noleggio','rental-edit','small',`data-id="${esc(e.id)}"`);
 const html=table(['Data','Impegno','Tipo','Dettagli','Stato',''],rs.map(e=>tr([date(e.date),`<b>${fmt(e.title)}</b>`,tag(e.kind),fmt(e.detail),e.closed?tag('Completata'):tag(e.status||'Aperta'),action(e)])),'Nessun evento corrispondente. Puoi aggiungere un’attività o una scadenza.');
 return section('Agenda operativa completa','Le funzioni attività e scadenze provengono dal gestionale precedente: salvataggio su Supabase',btn('+ Nuova attività','agenda-activity-new','primary')+btn('+ Nuova scadenza','agenda-deadline-new','primary')+btn('Stampa agenda','agenda-print'))+(failed.length?panel('Collegamento agenda',`<p class="error">Impossibile leggere alcune tabelle: ${fmt(failed.join(' | '))}. Non vengono inventati dati.</p>`):'')+`<div class="kpis">${kpi}</div>`+panel('Calendario e impegni',`<div class="filterbar agenda-filters"><label>Mese<input id="agenda-month" type="month" value="${esc(month)}"></label><label>Tipo<select id="agenda-kind">${asOptions([['tutti','Tutti'],['viaggio','Viaggi'],['noleggio','Noleggi'],['attivita','Attività'],['scadenza','Scadenze']],filter)}</select></label><label>Stato<select id="agenda-status">${asOptions([['aperti','Aperti'],['tutti','Tutti, anche completati']],status)}</select></label><label>Cerca<input id="agenda-search" value="${esc(state.options.agendaSearch)}" placeholder="Cerca appuntamento, luogo o nome"></label></div>${renderMonthCalendar(all,month)}${html}<p class="hint">Le partenze e i noleggi si modificano nelle rispettive schede. Le attività e le scadenze vengono salvate in Supabase; non sono note locali.</p>`);
}
function agendaForm(kind,id='',selectedDay=''){
 if(!requireWrite())return;
 const deadline=kind==='scadenza',tab=deadline?'scadenze_gestionale':'attivita_gestionale',items=deadline?state.data.tasks:state.data.activities,old=items.find(x=>x.id===id)||{};
 const kinds=deadline?[['operativa','Operativa'],['acconto','Acconto'],['pagamento','Pagamento'],['documento','Documento'],['promemoria','Promemoria'],['altro','Altro']]:[];
 const extra=deadline?fieldSelect('tipo','Tipo scadenza',kinds,old.tipo||'operativa')+field('importo','Importo € (facoltativo)',old.importo??'','number',false,'min="0" step="0.01"')+fieldSelect('viaggio_id','Viaggio collegato',[['','— Nessuno —'],...state.data.trips.map(t=>[t.id,tripLabel(t)])],old.viaggio_id||''):field('assegnata_a','Assegnata a',old.assegnata_a||currentOperatorName());
 const body=`<div class="formgrid">${field('titolo','Titolo',old.titolo||'','text',true,'maxlength="180"')}${field('data','Data',deadline?old.data_scadenza||selectedDay||dateISO():old.scadenza||selectedDay||dateISO(),'date',true)}${fieldSelect('priorita','Priorità',[['normale','Normale'],['alta','Alta'],['bassa','Bassa']],old.priorita||'normale')}${fieldSelect('stato','Stato',[['aperta','Aperta'],['in corso','In corso'],['completata','Completata']],old.stato||'aperta')}${extra}</div><label>${deadline?'Note':'Descrizione'}<textarea name="descrizione" rows="4" maxlength="2000">${esc(deadline?old.note||old.descrizione||'':old.descrizione||'')}</textarea></label><p class="hint">Le modifiche saranno disponibili a Nicola e Raffaele tramite Supabase. Non serve abilitare la scrittura dalle Impostazioni.</p>`;
 openForm((id?'Modifica ':'Nuova ')+(deadline?'scadenza':'attività'),body,async f=>{
  const title=val(f,'titolo'),theDate=val(f,'data');if(!title||!/^\d{4}-\d{2}-\d{2}$/.test(theDate))throw Error('Titolo e data obbligatori.');
  const finished=/completat/i.test(val(f,'stato')),status=val(f,'stato');
  const row=deadline?{titolo:title,data_scadenza:theDate,descrizione:val(f,'descrizione')||null,note:val(f,'descrizione')||null,tipo:val(f,'tipo')||'operativa',stato:status,priorita:val(f,'priorita'),viaggio_id:val(f,'viaggio_id')||null,importo:val(f,'importo')===''?null:Number(val(f,'importo')),completata_at:finished?(old.completata_at||new Date().toISOString()):null}:{titolo:title,scadenza:theDate,descrizione:val(f,'descrizione')||null,stato:status,priorita:val(f,'priorita'),assegnata_a:val(f,'assegnata_a')||null,completata_at:finished?(old.completata_at||new Date().toISOString()):null};
  if(deadline && row.importo!==null && (!Number.isFinite(row.importo)||row.importo<0))throw Error('Importo non valido');
  if(id)await apiUpdate(tab,id,row);else await apiInsert(tab,row);
 });
}
function currentOperatorName(){const o=state.data.operators.find(x=>x.user_id===state.userId);return o?.nome||o?.username||''}
function agendaToggle(kind,id,complete){if(!requireWrite())return;const tab=kind==='scadenza'?'scadenze_gestionale':'attivita_gestionale';if(!id)return;return confirmAction((complete?'Completare':'Riaprire')+' questo impegno?',async()=>{await apiUpdate(tab,id,{stato:complete?'completata':'aperta',completata_at:complete?new Date().toISOString():null});await sync();notify('Agenda aggiornata su Supabase')})}
function agendaDelete(kind,id){if(!requireWrite())return;const tab=kind==='scadenza'?'scadenze_gestionale':'attivita_gestionale';const row=(kind==='scadenza'?state.data.tasks:state.data.activities).find(x=>x.id===id);if(!row)return notify('Impegno non trovato',true);return confirmAction('Eliminare definitivamente «'+row.titolo+'»? Le attività collegate a viaggi restano nel loro archivio.',async()=>{const deleted=await request(tab+'?id=eq.'+encodeURIComponent(id),{method:'DELETE',prefer:'return=representation'});if(!Array.isArray(deleted)||deleted.length!==1)throw Error('Cancellazione non confermata');await sync();notify('Impegno eliminato')})}
function normalizeBoardingTown(raw){
 const s=String(raw||'').trim();if(!s)return 'DA ASSEGNARE';const n=s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ');
 if(n.includes('SAN MARCO IN LAMIS')&&n.includes('SAN GIOVANNI ROTONDO'))return 'San Marco in Lamis / San Giovanni Rotondo';
 for(const [needle,canonical] of [['SAN NICANDRO','San Nicandro Garganico'],['SAN SEVERO','San Severo'],['APRICENA','Apricena'],['POGGIO IMPERIALE','Poggio Imperiale'],['LESINA','Lesina'],['TERMOLI','Termoli'],['FOGGIA','Foggia'],['SAN MARCO IN LAMIS','San Marco in Lamis'],['SAN GIOVANNI ROTONDO','San Giovanni Rotondo'],['TORREMAGGIORE','Torremaggiore']])if(n.includes(needle))return canonical;
 return s;
}
function groupedBoarding(id){const trips=state.data.trips,ref=tripFor(id),root=ref?.bis_parent_id||id,linked=trips.filter(t=>t.id===root||t.bis_parent_id===root),tripIds=new Set(linked.map(t=>t.id));
 const groups=new Map();for(const b of state.data.bookings){if(!tripIds.has(b.viaggio_id)||isCancelled(b))continue;const town=normalizeBoardingTown(b.fermata_partenza),key=town;let g=groups.get(key);if(!g){g={town,pax:0,bookings:[],busCounts:new Map()};groups.set(key,g)}g.pax+=num(b.posti);g.bookings.push(b);const name=tripFor(b.viaggio_id)?.bis_parent_id?'BUS BIS '+(tripFor(b.viaggio_id)?.bis_numero||2):'BUS 1';g.busCounts.set(name,(g.busCounts.get(name)||0)+num(b.posti))}
 const order=['San Severo','Apricena','San Nicandro Garganico','Lesina','Poggio Imperiale','Foggia','San Marco in Lamis','San Giovanni Rotondo','Torremaggiore','Termoli','DA ASSEGNARE'];const list=[...groups.values()].sort((a,b)=>{const x=order.indexOf(a.town),y=order.indexOf(b.town);return (x<0?90:x)-(y<0?90:y)||a.town.localeCompare(b.town,'it')});return {list,linked,total:list.reduce((a,g)=>a+g.pax,0),missing:list.find(g=>g.town==='DA ASSEGNARE')?.pax||0};
}
function getBoardingTrip(){const available=state.data.trips.filter(t=>!t.archiviato_at&&t.bis_parent_id===null||!t.archiviato_at&&!t.bis_parent_id);const id=state.options.boardingTripId;return tripFor(id)||available[0]||state.data.trips[0]||null}
function renderBoarding(){
 if(state.failedTables.some(x=>/^(prenotazioni|viaggi):/.test(x)))return panel('Impossibile conteggiare','I dati di viaggi o prenotazioni non sono disponibili: aggiornare la sessione prima di fare il report.');
 const trips=state.data.trips.filter(t=>!t.bis_parent_id);const selected=getBoardingTrip();if(!selected)return panel('Conteggio fermate','Nessun viaggio disponibile.');
 const out=groupedBoarding(selected.id),groupStats=out.list.map(g=>`<article class="boarding-card ${g.town==='DA ASSEGNARE'?'boarding-alert':''}"><header><b>🚏 ${fmt(g.town)}</b><span class="tag">${g.pax} passeggeri</span></header><div class="subtle">${g.bookings.length} prenotazion${g.bookings.length===1?'e':'i'} · ${[...g.busCounts].map(([k,n])=>esc(k)+': '+n).join(' · ')}</div><details><summary>Mostra nominativi e posti</summary>${table(['Cliente / referente','Passeggeri','Posti','BUS','Telefono'],g.bookings.map(b=>tr([fmt(b.cliente),num(b.posti),fmt(b.posti_selezionati),fmt(tripFor(b.viaggio_id)?.titolo||'BUS'),fmt(b.telefono)])))}</details></article>`).join('');
 const assigned=out.total-out.missing;
 return section('Passeggeri per paese','Conteggio e lista nominativi recuperati dalla Control Room del vecchio gestionale',btn('Stampa per fermata','boarding-print')+btn('Esporta CSV','boarding-csv'))+`<div class="filterbar"><label>Seleziona il viaggio e gli eventuali BUS BIS<select id="boarding-trip">${asOptions(trips.map(t=>[t.id,tripLabel(t)]),selected.id)}</select></label></div><div class="kpis"><div class="kpi"><span>Totale passeggeri</span><strong>${out.total}</strong></div><div class="kpi"><span>Con fermata assegnata</span><strong>${assigned}</strong></div><div class="kpi"><span>Senza paese/fermata</span><strong>${out.missing}</strong></div><div class="kpi"><span>Paesi di salita</span><strong>${out.list.filter(g=>g.town!=='DA ASSEGNARE').length}</strong></div></div>`+panel('Suddivisione per paese',`<div class="boarding-grid">${groupStats||'<p class="subtle">Nessun passeggero per questa partenza.</p>'}</div><p class="hint">I conteggi includono tutti gli autobus collegati (BUS 1 e BUS BIS), escludendo le prenotazioni annullate. Eventuali fermate senza nome rimangono “Da assegnare”, non sono attribuite arbitrariamente.</p>`);
}
function printableBoarding(){const t=getBoardingTrip(),out=groupedBoarding(t.id);return `<h2>Riepilogo fermate · ${fmt(t.titolo)}</h2><p>Data viaggio: ${date(t.data_partenza)} · Passeggeri totali: <b>${out.total}</b> · Da assegnare: ${out.missing}</p>${out.list.map(g=>`<h2>${fmt(g.town)} — ${g.pax} passeggeri</h2>${table(['Cliente','Pax','Posti','Autobus','Telefono'],g.bookings.map(b=>tr([fmt(b.cliente),num(b.posti),fmt(b.posti_selezionati),fmt(tripFor(b.viaggio_id)?.titolo),fmt(b.telefono)])))}`).join('')}`}
function exportBoarding(){const t=getBoardingTrip(),g=groupedBoarding(t.id);exportCSV([['Viaggio','Data','Paese / Fermata','Cliente','Pax','Posti','Autobus','Telefono'],...g.list.flatMap(x=>x.bookings.map(b=>[t.titolo,t.data_partenza,x.town,b.cliente,b.posti,b.posti_selezionati,tripFor(b.viaggio_id)?.titolo,b.telefono]))],'DELGROSSO_FERMATE_'+(t.data_partenza||''))}
function renderStatistics(){const trps=state.data.trips.filter(t=>!t.archiviato_at),active=state.data.bookings.filter(b=>!isCancelled(b)),booked=active.reduce((a,b)=>a+num(b.posti),0),capacity=trps.reduce((a,b)=>a+num(b.posti_totali),0);
 const summary=[['Viaggi',trps.length],['Prenotazioni attive',active.length],['Passeggeri',booked],['Occupazione',capacity?Math.round(booked/capacity*100)+'%':'—'],['Mezzi',state.data.fleet.length]];
 return section('Statistiche operative','Indicatori dei viaggi e del numero di passeggeri; entrate e spese nella sezione Economia',btn('Esporta CSV','stats-csv'))+`<div class="kpis">${summary.map(([a,b])=>`<div class="kpi"><span>${fmt(a)}</span><strong>${b}</strong></div>`).join('')}</div>`+panel('Occupazione per viaggio',table(['Viaggio','Data','Passeggeri','Capienza','Percentuale','Fermate'],trps.map(t=>{const bs=state.data.bookings.filter(b=>b.viaggio_id===t.id&&!isCancelled(b)),pax=bs.reduce((a,b)=>a+num(b.posti),0);return tr([fmt(t.titolo),date(t.data_partenza),pax,num(t.posti_totali),num(t.posti_totali)?Math.round(pax/num(t.posti_totali)*100)+'%':'—',new Set(bs.map(b=>normalizeBoardingTown(b.fermata_partenza))).size])})));
}
function renderEconomy(){const fail=state.failedTables.some(x=>x.startsWith('economia_movimenti:'));if(fail)return panel('Dati Economia non disponibili','Impossibile accedere ai movimenti economici. Nessun totale parziale è mostrato.');
 const m=state.data.economy||[],incoming=m.filter(x=>x.tipo==='Entrata').reduce((z,x)=>z+num(x.importo),0),outgoing=m.filter(x=>x.tipo==='Uscita').reduce((z,x)=>z+num(x.importo),0);
 return section('Economia','Ripristino della consultazione economica della V1. I pagamenti automatici non vengono duplicati.',btn('+ Movimento manuale','economy-new','primary')+btn('Esporta movimenti CSV','economy-csv'))+`<div class="kpis">${[['Entrate',money(incoming)],['Uscite',money(outgoing)],['Saldo',money(incoming-outgoing)],['Movimenti',m.length]].map(([a,b])=>`<div class="kpi"><span>${fmt(a)}</span><strong>${fmt(b)}</strong></div>`).join('')}</div>`+panel('Movimenti registrati',table(['Data','Tipo','Categoria','Descrizione','Viaggio','Importo','Origine'],m.slice().sort((a,b)=>String(b.data_movimento||'').localeCompare(String(a.data_movimento||''))).map(x=>tr([date(x.data_movimento),tag(x.tipo),fmt(x.categoria),fmt(x.descrizione),fmt(tripFor(x.viaggio_id)?.titolo),money(x.importo),fmt(x.origine)],/^manuale/i.test(String(x.origine||''))&&!x.pagamento_id&&!x.noleggio_pagamento_id?btn('Modifica','economy-edit','small',`data-id="${esc(x.id)}"`):''))))+panel('Attenzione alle duplicazioni','<p class="hint">Gli incassi generati automaticamente dal vecchio gestionale restano collegati ai pagamenti originali. Questa pagina non inserisce movimenti doppi e non modifica chiusure già registrate.</p>');
}
function renderBackup(){return section('Esporta archivi','Download CSV dei dati operativi, senza credenziali o password',btn('Esporta viaggi','trip-csv')+btn('Esporta prenotazioni','booking-csv')+btn('Esporta pagamenti','payments-csv')+btn('Esporta clienti','clients-csv'))+panel('Esportazioni manuali',`<p>È possibile esportare da questo browser gli elenchi di viaggi, prenotazioni, pagamenti e clienti dopo l’autenticazione con Nicola o Raffaele.</p><p class="error"><b>Non è un backup integrale e ripristinabile di Supabase.</b> Per la protezione di database, Storage, utenti e PDF bisogna usare le procedure ufficiali di backup e testare il ripristino.</p><p class="hint">I file CSV contengono dati di clienti e devono essere conservati in un luogo aziendale protetto.</p>`);}
function renderOperations(){
 const rows=state.data.bookings.filter(b=>!isCancelled(b)),checked=rows.filter(b=>b.checkin_effettuato).reduce((n,b)=>n+num(b.posti),0),total=rows.reduce((n,b)=>n+num(b.posti),0),openTasks=(state.data.activities||[]).filter(a=>!/completat/i.test(a.stato)),deadlines=(state.data.tasks||[]).filter(d=>!/completat/i.test(d.stato));
 const trips=state.data.trips.filter(t=>!t.archiviato_at&&t.data_partenza>=dateISO()).sort((a,b)=>String(a.data_partenza).localeCompare(String(b.data_partenza))).slice(0,10);
 return section('Centro operativo','Ripristinata la sintesi di attività, check-in e partenze della V1',btn('+ Nuova attività','agenda-activity-new','primary')+btn('Apri Control Room','go-control')+btn('Agenda completa','go-agenda'))+`<div class="kpis">${[['Passeggeri prenotati',total],['Passeggeri con check-in',checked],['Attività aperte',openTasks.length],['Scadenze aperte',deadlines.length]].map(([a,b])=>`<div class="kpi"><span>${fmt(a)}</span><strong>${b}</strong></div>`).join('')}</div>`+panel('Prossime partenze',table(['Viaggio','Data','Passeggeri',''],trips.map(t=>tr([fmt(t.titolo),date(t.data_partenza),bookingsCount(t.id),btn('Apri','trip-select','small',`data-id="${esc(t.id)}"`)]))))+panel('Attività aperte',table(['Titolo','Scadenza','Priorità',''],openTasks.slice(0,20).map(a=>tr([fmt(a.titolo),date(a.scadenza),tag(a.priorita),btn('Modifica','agenda-edit','small',`data-kind="attivita" data-id="${esc(a.id)}"`)]))))+panel('Scadenze da gestire',table(['Titolo','Data','Stato',''],deadlines.slice(0,20).map(a=>tr([fmt(a.titolo),date(a.data_scadenza),tag(a.stato),btn('Modifica','agenda-edit','small',`data-kind="scadenza" data-id="${esc(a.id)}"`)]))));
}
function renderAssistant(){
 const missing=state.failedTables.filter(x=>x.startsWith('assistente_eventi:'));
 const active=state.data.bookings.filter(b=>!isCancelled(b)),pending=active.filter(b=>num(b.totale)>num(b.pagato)),overdue=pending.filter(b=>b.scadenza_acconto && String(b.scadenza_acconto).slice(0,10)<dateISO()),events=state.data.assistantEvents||[];
 return section('Assistente operativo','Segnalazioni effettive da Supabase e controllo scadenze acconti; non vengono eseguite modifiche automatiche',btn('Aggiorna','refresh'))+`<div class="kpis">${[['Prenotazioni con saldo',pending.length],['Scadenze acconto superate',overdue.length],['Posti con quote residue',pending.reduce((s,b)=>s+num(b.posti),0)],['Eventi registrati',events.length]].map(([a,b])=>`<div class="kpi"><span>${fmt(a)}</span><strong>${b}</strong></div>`).join('')}</div>`+(missing.length?panel('Segnalazioni parziali','<p class="error">Impossibile leggere la tabella assistente_eventi: verificare i permessi.</p>'):'')+panel('Acconti / residui da verificare',table(['Cliente','Viaggio','Pax','Scadenza acconto','Residuo'],pending.slice(0,80).map(b=>tr([fmt(b.cliente),fmt(tripFor(b.viaggio_id)?.titolo),num(b.posti),date(b.scadenza_acconto),money(num(b.totale)-num(b.pagato))]))))+panel('Avvisi registrati',table(['Data','Priorità','Titolo','Stato'],events.slice().sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,80).map(e=>tr([date(e.created_at),tag(e.priorita),fmt(e.titolo),tag(e.stato)]))))+panel('Sicurezza','<p class="hint">L’assistente mostra soltanto dati e avvisi esistenti; per incassi, prenotazioni e modifiche si utilizzano sempre i comandi autorizzati del gestionale.</p>');
}
// Supabase Storage photo sources from flotta.immagine and flotta.foto_gallery.
// Source values are taken from authenticated database rows, never from demo data.
function fleetPhotoValues(f){
 const found=[];
 function walk(value,depth=0){
  if(!value||depth>4||found.length>24)return;
  if(Array.isArray(value)){value.forEach(v=>walk(v,depth+1));return;}
  if(typeof value==='object'){
   for(const key of ['url','public_url','publicUrl','src','image_url','immagine','foto','path','storage_path','file_path','file','filename','images','gallery','galleria','foto_gallery','items','files'])if(value[key])walk(value[key],depth+1);
   return;
  }
  const s=String(value).trim();if(!s)return;
  if((s.startsWith('[')||s.startsWith('{'))&&s.length<100000){try{walk(JSON.parse(s),depth+1);return}catch{}}
  found.push(s);
 }
 walk(f.immagine);walk(f.foto_gallery);return [...new Set(found)];
}
function fleetImageCandidates(f){
 const raw=fleetPhotoValues(f),urls=[];
 const root=URL_BASE+'/storage/v1/object/public/';
 for(let path of raw){
  path=path.replace(/\\/g,'/').trim();
  if(/^https:\/\//i.test(path)){try{const u=new URL(path);if(u.protocol==='https:')urls.push(u.href)}catch{};continue;}
  if(/^http:\/\//i.test(path))continue;
  if(path.startsWith('/storage/v1/object/public/')){urls.push(URL_BASE+path);continue;}
  if(path.startsWith('storage/v1/object/public/')){urls.push(URL_BASE+'/'+path);continue;}
  if(path.startsWith('/object/public/')){urls.push(URL_BASE+'/storage/v1'+path);continue;}
  path=path.replace(/^\/+/, '').replace(/^public\//,'');
  if(path.includes('..')||path.length>1000||/[?#]/.test(path))continue;
  const encode=p=>p.split('/').map(encodeURIComponent).join('/');
  if(path.startsWith('buses/')||path.startsWith('bus-images/')){urls.push(root+encode(path));continue;}
  if(path.startsWith('storage/'))continue;
  // Legacy records sometimes only store the object key, not its bucket.
  urls.push(root+'buses/'+encode(path));
  urls.push(root+'bus-images/'+encode(path));
 }
 return [...new Set(urls)].slice(0,30);
}
function fleetPhotoCard(f){
 return `<div class="fleet-card"><div class="fleet-image" data-fleet-photo-id="${esc(f.id)}"><div class="fleet-image-placeholder">🚌<small>Foto da Supabase Storage</small></div></div><div class="fleet-card-info"><div><strong>${fmt(f.marca)} ${fmt(f.modello)}</strong><p>${fmt(f.titolo||f.categoria||'Autobus')} · ${num(f.posti)} posti</p><p>${fmt(f.targa)} · ${fmt(f.seat_layout)}</p></div><div class="fleet-card-actions">${tag(f.stato)}${btn('Modifica','fleet-edit','small',`data-id="${esc(f.id)}"`)}</div></div></div>`;
}
function mountFleetPhotos(){
 for(const target of document.querySelectorAll('[data-fleet-photo-id]')){
  const f=busFor(target.dataset.fleetPhotoId);if(!f)continue;
  const urls=fleetImageCandidates(f);
  if(!urls.length){target.innerHTML='<div class="fleet-image-placeholder">🚌<small>Foto non configurata nel record Supabase</small></div>';continue;}
  const image=document.createElement('img');image.loading='lazy';image.decoding='async';image.alt='Foto reale del bus '+[f.marca,f.modello].filter(Boolean).join(' ');
  let ix=0;image.onerror=()=>{ix+=1;if(ix<urls.length)image.src=urls[ix];else target.innerHTML='<div class="fleet-image-placeholder">⚠️<small>Foto non raggiungibile in Supabase Storage</small></div>'};
  image.onload=()=>target.classList.add('fleet-image-ready');
  target.innerHTML='';target.append(image);image.src=urls[ix];
 }
}
function renderFleet(){
 const fleet=state.data.fleet,configured=fleet.filter(f=>fleetPhotoValues(f).length>0).length;
 return section('Flotta','Foto originali caricate dai campi immagine e galleria di Supabase Storage',btn('+ Nuovo mezzo','fleet-new','primary')+btn('Aggiorna foto e flotta','refresh'))+
 `<div class="helpbox fleet-status"><b>${fleet.length} mezzi presenti in Supabase</b> · ${configured} con almeno un riferimento fotografico nel database. Le immagini vengono caricate direttamente da Storage, senza copie nel gestionale.</div>`+
 `<div class="fleet-grid">${fleet.map(fleetPhotoCard).join('')||'<div class="panel">Nessun mezzo disponibile per questo operatore.</div>'}</div>`+
 panel('Collegamento delle immagini','<p class="subtle">La V2 legge <b>immagine</b> e <b>foto_gallery</b> dalla tabella <b>flotta</b>. Sono supportati URL HTTPS pubblici di Supabase Storage e percorsi oggetto nei bucket <b>buses</b> e <b>bus-images</b>. Se una foto risulta non raggiungibile, controllare il relativo riferimento e i permessi Storage; non viene caricata una foto artificiale.</p>');
}

function renderRentals(){const rs=state.data.rentals.sort((a,b)=>String(b.data_partenza).localeCompare(String(a.data_partenza))).map(x=>tr([fmt(x.referente||x.azienda),fmt(x.tratta_partenza),fmt(x.tratta_destinazione),date(x.data_partenza),num(x.passeggeri),money(x.prezzo_concordato),tag(x.stato_noleggio)],btn('Apri','rental-edit','small',`data-id="${esc(x.id)}"`)));
 return section('Noleggi autobus','Archivio delle richieste e dei contratti',btn('+ Nuovo noleggio','rental-new','primary')+btn('CSV','rentals-csv'))+panel('Noleggi',table(['Cliente','Da','A','Data','Pax','Importo','Stato',''],rs));
}
function renderQuotes(){const rs=state.data.quotes.sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).map(q=>tr([fmt(q.numero_preventivo||q.codice||q.id.slice(0,7)),fmt((q.nome||'')+' '+(q.cognome||'')),fmt(q.destinazione),date(q.data_partenza||q.data_viaggio),num(q.passeggeri||q.numero_passeggeri),money(q.importo_preventivo||q.importo),tag(q.stato)],btn('Apri / PDF','quote-print','small',`data-id="${esc(q.id)}"`)+btn('Modifica','quote-edit','small',`data-id="${esc(q.id)}"`)));
 return section('Preventivi','Richieste commerciali e documentazione',btn('+ Nuovo preventivo','quote-new','primary')+btn('CSV','quotes-csv'))+panel('Offerte e richieste',table(['N.','Cliente','Destinazione','Data','Pax','Importo','Stato',''],rs));
}
function clientInfo(c){return Ledger.clientHistory(c,{clients:state.data.clients,bookings:state.data.bookings,payments:state.data.payments,trips:state.data.trips,operators:state.data.operators})}
function renderClients(){const required=['clienti','viaggi','prenotazioni','pagamenti','operatori_gestionale'];const missing=state.failedTables.filter(e=>required.some(x=>e.startsWith(x+':')));if(missing.length)return panel('Storico clienti incompleto',`<p class="error">Dati non leggibili. Per evitare quote sbagliate: ${fmt(missing.join(' | '))}</p>`);
 const q=state.options.search.toLowerCase();const people=state.data.clients.filter(c=>((c.nome||'')+' '+(c.cognome||'')+' '+(c.telefono||'')+' '+(c.email||'')).toLowerCase().includes(q));
 const rs=people.map(c=>{const h=clientInfo(c);return tr([`<b>${fmt((c.nome||'')+' '+(c.cognome||''))}</b>`,fmt(c.telefono),String(h.matches.length),String(h.payments.length),`<b>${Ledger.money(h.total)}</b>`,Ledger.money(h.residuo)],btn('Storico viaggi e quote','client-open','small',`data-id="${esc(c.id)}"`)+btn('Modifica','client-edit','small',`data-id="${esc(c.id)}"`))});
 return section('Clienti','Viaggi prenotati, presenza e quote versate · operatore che ha incassato',btn('+ Nuovo cliente','client-new','primary')+btn('Esporta CSV','clients-csv'))+panel('Rubrica e riepilogo quote',`<div class="filterbar"><input data-filter="search" value="${esc(state.options.search)}" placeholder="Cerca cliente, telefono, email"></div><p class="hint">Gli importi derivano dai movimenti registrati. I viaggi sono collegati tramite riferimenti espliciti o anagrafiche non ambigue. Una prenotazione non prova da sola la presenza a bordo.</p>${table(['Cliente','Telefono','Viaggi','Movimenti','Quote registrate','Residuo prenotazioni','Azioni'],rs)}`);
}
function openClientHistory(id){const c=state.data.clients.find(x=>x.id===id);if(!c)return notify('Cliente non trovato',true);const h=clientInfo(c),details=h.matches.map(x=>{const b=x.booking,t=x.trip;return tr([`<b>${fmt(t?.titolo||'Viaggio non trovato')}</b><div class="subtle">${date(t?.data_partenza)}${t?.bis_parent_id?' · BUS BIS':''}</div>`,fmt(b.posti_selezionati||b.posti),tag(b.stato),b.checkin_effettuato?tag('Presente al check-in'):tag('Non verificato'),Ledger.money(Ledger.cents(b.totale)),Ledger.money(Ledger.cents(b.pagato)),Ledger.money(Math.max(0,(Ledger.cents(b.totale)||0)-(Ledger.cents(b.pagato)||0))),fmt(x.basis)],btn('Apri prenotazione','booking-view','small',`data-id="${esc(b.id)}"`))});
 const items=h.payments.map(p=>tr([date(p.date),fmt(h.matches.find(x=>x.booking.id===p.bookingId)?.trip?.titolo||tripFor(p.tripId)?.titolo||'—'),fmt(p.receipt),fmt(p.tipo),fmt(p.method),fmt(p.owner),`<b>${Ledger.money(p.amount)}</b>`]));
 $('edit-dialog').classList.add('wide');$('edit-title').textContent='Storico cliente · '+[c.nome,c.cognome].filter(Boolean).join(' ');
 $('edit-body').innerHTML=`<div class="three-col"><div class="helpbox">Prenotazioni collegate<br><b>${h.matches.length}</b></div><div class="helpbox">Movimenti versati (netto)<br><b>${Ledger.money(h.total)}</b></div><div class="helpbox">Residuo sulle prenotazioni<br><b>${Ledger.money(h.residuo)}</b></div></div><div class="separator"></div><h3>Viaggi prenotati / presenze verificate</h3>${table(['Viaggio','Posti','Prenotazione','Presenza','Quota','Da prenotazione','Residuo','Collegamento',''],details,'Nessuna prenotazione collegabile in modo sicuro')}<h3 style="margin-top:22px">Tutti i versamenti registrati e incassati da</h3>${table(['Data','Viaggio','Ricevuta','Tipo','Metodo','Ricevuto da','Importo'],items,'Nessun pagamento direttamente o indirettamente collegato a questo cliente')}<p class="hint">Versato e residuo sulle prenotazioni sono valori registrati in archivio; il totale dei movimenti è calcolato separatamente, senza sommarli due volte. ${h.warnings?'Alcuni abbinamenti per nome devono essere confermati manualmente.':''} Se i nominativi non corrispondono, controlla anagrafica e prenotazione nel gestionale originale.</p>`;
 $('edit-dialog').showModal();
}
function consented(bookingId,tripId){const c=state.data.groupConsents.find(c=>c.booking_id===bookingId&&c.trip_id===tripId);return Boolean(c?.accepted_at&&!c.revoked_at)}
function renderWhatsapp(){const ds=state.data.trips.slice().sort((a,b)=>String(b.data_partenza).localeCompare(String(a.data_partenza)));const inv=new Map(state.data.groupInvites.map(i=>[i.trip_id,i.invite_url]));
 const rs=ds.map(t=>{const link=inv.get(t.id)||'',bs=tripBookings(t.id);const agreed=bs.filter(b=>consented(b.id,t.id)).length;return tr([`<b>${fmt(t.titolo)}</b><div class="subtle">${date(t.data_partenza)}</div>`,fmt(t.bis_parent_id?'BUS BIS':'BUS 1'),String(bs.length),String(agreed),link?`<span class="tag green">Link presente</span>`:'<span class="tag amber">Da inserire</span>'],btn('Apri','wa-open','small',`data-id="${esc(t.id)}"`))});
 return section('Centro WhatsApp','Gruppi separati, numeri senza rubrica, consensi specifici')+panel('Gruppi dei viaggi',table(['Viaggio','Bus','Prenotazioni','Consensi validi','Link',''],rs))+panel('Regole di invito','<div class="helpbox">Il consenso generico alla prenotazione non sostituisce il consenso specifico a entrare nel gruppo WhatsApp. Per ogni viaggio e BUS BIS viene gestito un link separato. L’app apre WhatsApp con un testo precompilato: non inserisce automaticamente i contatti nel gruppo.</div>');
}
async function pollNewBookings(){
 if(!isConfigured()||document.visibilityState==='hidden'||state.busy)return;
 try{
  const list=await request('prenotazioni?select=id,created_at&order=created_at.desc&limit=1');
  if(!list?.length)return;
  const known=state.data.bookings.some(b=>b.id===list[0].id);
  if(!known){await sync();notify('Nuova prenotazione ricevuta. Apri Notifiche per i dettagli.');}
 }catch(e){console.warn('Controllo nuove prenotazioni non disponibile:',e.message)}
}
function renderNotifications(){
 const bookingEvents=state.data.bookings.filter(b=>b.created_at).map(b=>({time:b.created_at,type:'prenotazione',title:'Prenotazione · '+String(b.cliente||'Cliente'),text:(tripFor(b.viaggio_id)?.titolo||'Viaggio non trovato')+' · '+num(b.posti)+' passeggeri · posti '+(b.posti_selezionati||'non ancora assegnati'),id:b.id}));
 const systemEvents=state.data.notifications.filter(n=>n.created_at).map(n=>({time:n.created_at,type:'sistema',title:n.titolo||n.tipo||'Notifica',text:n.messaggio||n.testo||n.descrizione||'',id:''}));
 const feed=[...bookingEvents,...systemEvents].sort((a,b)=>String(b.time).localeCompare(String(a.time))).slice(0,250);
 const cards=feed.map(n=>`<article class="notification-item"><div class="notification-heading"><b>${fmt(n.title)}</b><span class="subtle">${localTime(n.time)}</span></div><p>${fmt(n.text)}</p>${n.type==='prenotazione'?btn('Apri prenotazione','booking-view','small',`data-id="${esc(n.id)}"`):''}</article>`).join('');
 return section('Notifiche e nuove prenotazioni','Cliente, viaggio e orario italiano · controllo automatico quando la pagina è aperta',btn('Aggiorna notifiche','refresh'))+
 `<div class="kpis"><div class="kpi"><span>Prenotazioni ricevute</span><strong>${bookingEvents.length}</strong><small>Archivio reale</small></div><div class="kpi"><span>Eventi gestionali</span><strong>${systemEvents.length}</strong><small>Registrati su Supabase</small></div></div>`+
 panel('Cronologia · le più recenti in alto',cards||'<p class="subtle">Nessuna prenotazione o notifica disponibile.</p>');
}

function integrityReport(){
 const d=state.data,issues=[];
 const parents=new Set(d.trips.map(t=>t.id));
 const byBooking=new Map(d.bookings.map(b=>[b.id,b]));
 const occupiedByTrip=new Map(),seatsByBooking=new Map();
 for(const seat of d.seats){
  const b=byBooking.get(seat.prenotazione_id);
  if(!b){issues.push(['Alto','Posto senza prenotazione',seat.viaggio_id+' · posto '+seat.posto]);continue}
  const arr=seatsByBooking.get(b.id)||[];arr.push(seat);seatsByBooking.set(b.id,arr);
  if(isCancelled(b))continue;
  if(b.viaggio_id!==seat.viaggio_id)issues.push(['Alto','Posto collegato a bus differente',b.codice||b.id]);
  const key=seat.viaggio_id+':'+seat.posto;
  if(occupiedByTrip.has(key))issues.push(['Critico',occupiedByTrip.get(key)!==b.id?'Posto doppio su prenotazioni attive':'Posto duplicato nella stessa prenotazione',tripFor(seat.viaggio_id)?.titolo+' · '+seat.posto]);
  else occupiedByTrip.set(key,b.id);
 }
 for(const b of d.bookings){
  if(!parents.has(b.viaggio_id)){issues.push(['Alto','Prenotazione senza viaggio',b.codice||b.id]);continue}
  if(!isCancelled(b)){
   const count=(seatsByBooking.get(b.id)||[]).length;
   if(count!==num(b.posti))issues.push(['Alto','Numero posti diverso dai passeggeri',(b.codice||b.id)+': '+count+'/'+b.posti]);
  }
 }
 for(const t of d.trips){
  if(t.bis_parent_id&&!parents.has(t.bis_parent_id))issues.push(['Alto','BUS BIS senza viaggio principale',t.titolo]);
  const occ=tripBookings(t.id).reduce((n,b)=>n+num(b.posti),0);
  if(occ>num(t.posti_totali))issues.push(['Critico','Capienza superata',t.titolo+' · '+occ+'/'+t.posti_totali]);
 }
 for(const pay of d.payments){
  if(pay.prenotazione_id&&!byBooking.has(pay.prenotazione_id))issues.push(['Medio','Pagamento senza prenotazione',pay.receipt_number||pay.id]);
  if(/contanti|cash/i.test(pay.metodo_pagamento||pay.metodo||'')&&!pay.incassato_da_user_id&&!pay.incassato_da)issues.push(['Medio','Contanti senza operatore',pay.receipt_number||pay.id]);
 }
 return issues;
}
function renderIntegrity(){
 const req=['viaggi','prenotazioni','prenotazione_posti','pagamenti','flotta'];
 const failures=state.failedTables.filter(e=>req.some(n=>e.startsWith(n+':')));
 if(failures.length)return section('Controllo integrità','Controllo bloccato per dati incompleti')+panel('Dati parziali',`<p class="error">Impossibile verificare l’integrità: ${fmt(failures.join(' | '))}</p>`);
 const items=integrityReport();
 return section('Integrità dati','Verifica incrociata dei dati correnti, senza modifiche',btn('Aggiorna controlli','refresh')+btn('Esporta segnalazioni CSV','integrity-csv'))+
 `<div class="kpis"><div class="kpi"><span>Segnalazioni</span><strong>${items.length}</strong><small>Confronto locale degli archivi</small></div><div class="kpi"><span>Prenotazioni</span><strong>${state.data.bookings.length}</strong><small>Record controllati</small></div><div class="kpi"><span>Posti collegati</span><strong>${state.data.seats.length}</strong><small>Righe verificate</small></div><div class="kpi"><span>Pagamenti</span><strong>${state.data.payments.length}</strong><small>Movimenti analizzati</small></div></div>`+
 panel('Esiti',items.length?table(['Gravità','Anomalia','Riferimento'],items.map(x=>tr([tag(x[0]),fmt(x[1]),fmt(x[2])]))):'<div class="helpbox"><b>✓ Nessuna incoerenza rilevata dai controlli disponibili.</b><p class="subtle">Questo risultato non sostituisce il collaudo delle transazioni contemporanee e della contabilità.</p></div>');
}
function renderArchive(){
 const d=state.data;
 const issues=state.failedTables.filter(e=>/^(documenti_gestionali|ricevute_versioni):/.test(e));
 return section('Archivio documenti','Gestione documenti aziendali e ricevute',btn('+ Nuovo documento','document-new','primary'))+
 (issues.length?panel('Permessi archivio',`<p class="error">${fmt(issues.join(' | '))}</p>`):'')+
 panel('Documenti gestionali',table(['Categoria','Titolo','Viaggio','Data','Archivio',''],d.documents.slice().sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).map(doc=>tr([fmt(doc.categoria),fmt(doc.titolo),fmt(tripFor(doc.viaggio_id)?.titolo),date(doc.created_at),doc.storage_path?'<span class="tag green">Archiviato</span>':'<span class="tag amber">Non presente</span>'],btn('Modifica','document-edit','small',`data-id="${esc(doc.id)}"`)+(doc.storage_path||doc.url?btn('Apri documento','archive-document','small',`data-id="${esc(doc.id)}"`):''))), 'Nessun documento gestito da questa tabella'))+
 panel('Storico versioni ricevute',table(['Numero','Tipo','Generata','Stato',''],d.receipts.slice().sort((a,b)=>String(b.generated_at).localeCompare(String(a.generated_at))).map(rec=>tr([fmt(rec.receipt_number),fmt(rec.kind),date(rec.generated_at),rec.invalidated_at?tag('Versione annullata'):tag('Registrata')],rec.storage_path?btn('Apri PDF','archive-receipt','small',`data-id="${esc(rec.id)}"`):'')),'Nessuna versione di ricevuta registrata'))+
 panel('Accesso agli allegati','<div class="helpbox">I PDF vengono richiesti a Supabase Storage utilizzando la sessione operatore, con link temporaneo. I permessi RLS restano applicati. L’apertura su iPhone e i permessi delle vecchie ricevute devono essere collaudati con gli utenti reali.</div>');
}
function renderClosures(){
 const entries=state.data.closures.slice().sort((a,b)=>String(b.data_partenza).localeCompare(String(a.data_partenza)));
 return section('Chiusura 360','Consultazione dello storico salvato nel gestionale originale')+
 panel('Chiusure dei viaggi',table(['Viaggio','Partenza','Stato','Passeggeri','Incassato','Residuo','Margine'],entries.map(c=>tr([fmt(c.titolo),date(c.data_partenza),tag(c.stato_chiusura),num(c.passeggeri_clienti),money(c.incassato),money(c.residuo),money(c.margine)])),'Nessun viaggio chiuso'))+
 panel('Protezione delle chiusure','<div class="helpbox">Questa sezione consulta gli snapshot storici senza sovrascriverli. Chiusure, riaperture e riconciliazioni definitive devono continuare a usare il flusso verificato sul backend prima di abilitare nuovi comandi di scrittura.</div>');
}
/* RESTAURO OPERATIVO V1 → V2 (9 novembre 2026).
 * Usa le tabelle Supabase già esistenti; nessuna credenziale sensibile nel frontend.
 * Non integra il blocco schermo o lo sblocco biometrico della vecchia versione. */
function knownTableProblem(name){const x=state.failedTables.find(s=>s.startsWith(name+':'));return x?`<p class="error">Archivio ${esc(name)} non leggibile: ${fmt(x)}</p>`:''}
function renderComms(){
 const me=state.userId,items=(state.data.operatorMessages||[]).filter(m=>m.sender_user_id===me||m.recipient_user_id===me);
 const incoming=items.filter(x=>x.recipient_user_id===me),unread=incoming.filter(x=>!x.read_at);
 const names=new Map(state.data.operators.map(x=>[x.user_id,x.nome||x.username]));
 const rs=items.slice().sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).map(x=>{
  const from=names.get(x.sender_user_id)||'Operatore',to=names.get(x.recipient_user_id)||'Operatore';
  return tr([`<b>${fmt(x.subject)}</b><div class="subtle">${fmt(x.body)}</div>`,fmt(from),fmt(to),localTime(x.created_at),x.read_at?tag('Letto'):tag(x.recipient_user_id===me?'Da leggere':'Inviato')],x.recipient_user_id===me&&!x.read_at?btn('Segna letto','comms-read','small',`data-id="${esc(x.id)}"`):'');
 });
 return section('Comunicazioni operatori','Messaggi privati tra Nicola e Raffaele, salvati su Supabase',btn('+ Nuovo messaggio','comms-new','primary'))+
 `<div class="kpis"><div class="kpi"><span>Ricevuti</span><strong>${incoming.length}</strong></div><div class="kpi"><span>Da leggere</span><strong>${unread.length}</strong></div><div class="kpi"><span>Messaggi totali</span><strong>${items.length}</strong></div></div>`+
 panel('Posta interna',knownTableProblem('dg_operator_communications')+table(['Oggetto e messaggio','Da','A','Data e ora','Stato',''],rs,'Nessun messaggio. Puoi inviare il primo al collega.'));
}
function messageForm(){
 if(!requireWrite())return;
 const destinations=state.data.operators.filter(x=>x.user_id!==state.userId&&x.attivo!==false).map(x=>[x.user_id,x.nome||x.username]);
 if(!destinations.length)return notify('Non risulta un secondo operatore abilitato.',true);
 openForm('Nuova comunicazione interna',`<div class="formgrid">${fieldSelect('recipient_id','Destinatario',destinations,destinations[0][0])}${field('subject','Oggetto','','text',true,'maxlength="180"')}</div><label>Messaggio<textarea name="body" rows="7" maxlength="4000" required></textarea></label><p class="hint">Il messaggio è riservato agli operatori autorizzati. Nessuna comunicazione verrà inviata automaticamente ai clienti.</p>`,async f=>{
  const recipient=val(f,'recipient_id'),subject=val(f,'subject'),body=val(f,'body');
  if(!destinations.some(x=>x[0]===recipient)||!subject||!body)throw Error('Destinatario, oggetto e messaggio obbligatori.');
  const out=await apiInsert('dg_operator_communications',{sender_user_id:state.userId,recipient_user_id:recipient,subject,body});
  if(!Array.isArray(out)||out.length!==1)throw Error('Messaggio non confermato dal database');
 });
}
async function markCommsRead(id){
 if(!requireWrite())return;
 const m=state.data.operatorMessages.find(x=>x.id===id&&x.recipient_user_id===state.userId);
 if(!m)return notify('Messaggio non disponibile',true);
 await apiUpdate('dg_operator_communications',id,{read_at:new Date().toISOString()});await sync();notify('Messaggio segnato come letto');
}
function renderFleetOps(){
 const maintenance=state.data.maintenances||[],fuel=state.data.fuel||[],blocks=state.data.fleetBlocks||[];
 const busName=id=>{const f=busFor(id);return f?.titolo||[f?.marca,f?.modello].filter(Boolean).join(' ')||'—'};
 const ms=maintenance.slice().sort((a,b)=>String(b.data_intervento||b.created_at||'').localeCompare(String(a.data_intervento||a.created_at||''))).map(m=>tr([fmt(busName(m.flotta_id)),date(m.data_intervento),fmt(m.tipo),fmt(m.descrizione),tag(m.stato),money(m.costo),date(m.prossima_data)],btn('Modifica','fleet-maint-edit','small',`data-id="${esc(m.id)}"`)));
 const fs=fuel.slice().sort((a,b)=>String(b.data_rifornimento).localeCompare(String(a.data_rifornimento))).map(f=>tr([fmt(busName(f.flotta_id)),date(f.data_rifornimento),num(f.litri),money(f.importo),fmt(f.distributore),num(f.km)],btn('Modifica','fleet-fuel-edit','small',`data-id="${esc(f.id)}"`)));
 const bs=blocks.map(b=>tr([fmt(busName(b.flotta_id)),date(b.data_inizio),date(b.data_fine),fmt(b.motivo)],btn('Modifica','fleet-block-edit','small',`data-id="${esc(b.id)}"`)));
 return section('Manutenzioni, carburante e indisponibilità','Recuperate dalla Flotta V1; salvataggio reale protetto da Supabase',btn('+ Manutenzione','fleet-maint-new','primary')+btn('+ Rifornimento','fleet-fuel-new')+btn('+ Blocco mezzo','fleet-block-new'))+
 `<div class="kpis">${[['Manutenzioni',maintenance.length],['Rifornimenti',fuel.length],['Blocchi mezzi',blocks.length]].map(([x,y])=>`<div class="kpi"><span>${fmt(x)}</span><strong>${y}</strong></div>`).join('')}</div>`+
 panel('Interventi e prossime scadenze',knownTableProblem('manutenzioni_flotta')+table(['Autobus','Intervento','Tipo','Descrizione','Stato','Costo','Prossima scadenza',''],ms))+
 panel('Carburante',knownTableProblem('carburante_flotta')+table(['Autobus','Data','Litri','Importo','Distributore','Km',''],fs))+
 panel('Mezzi indisponibili',knownTableProblem('dg_blocchi_flotta')+table(['Autobus','Da','A','Motivo',''],bs));
}
function fleetOptions(){return state.data.fleet.map(f=>[f.id,(f.titolo||[f.marca,f.modello].filter(Boolean).join(' '))+' · '+num(f.posti)+' posti'])}
function maintenanceForm(id=''){
 if(!requireWrite())return;
 const m=(state.data.maintenances||[]).find(x=>x.id===id)||{},models=fleetOptions();if(!models.length)return notify('Nessun mezzo in flotta',true);
 openForm(id?'Modifica manutenzione':'Registra manutenzione',`<div class="formgrid">${fieldSelect('flotta_id','Autobus',models,m.flotta_id||models[0][0])}${field('tipo','Tipo intervento',m.tipo||'Tagliando','text',true,'maxlength="120"')}${field('data_intervento','Data intervento',m.data_intervento||dateISO(),'date')}${field('km','Chilometri',m.km??'','number',false,'min="0"')}${field('costo','Costo (€)',m.costo??0,'number',true,'min="0" step="0.01"')}${fieldSelect('stato','Stato',[['Da fare','Da fare'],['Programmato','Programmato'],['Completato','Completato']],m.stato||'Da fare')}${field('prossima_data','Prossimo controllo',m.prossima_data||'','date')}${field('officina','Officina',m.officina||'')}</div><label>Descrizione<textarea name="descrizione" rows="3">${esc(m.descrizione||'')}</textarea></label><label>Note<textarea name="note" rows="2">${esc(m.note||'')}</textarea></label>`,async f=>{
  const cost=Number(val(f,'costo'));if(!Number.isFinite(cost)||cost<0)throw Error('Costo non valido');
  const row={flotta_id:val(f,'flotta_id'),tipo:val(f,'tipo'),data_intervento:val(f,'data_intervento')||null,km:val(f,'km')===''?null:Number(val(f,'km')),costo:cost,stato:val(f,'stato'),prossima_data:val(f,'prossima_data')||null,officina:val(f,'officina')||null,descrizione:val(f,'descrizione')||null,note:val(f,'note')||null};
  if(!models.some(x=>x[0]===row.flotta_id)||!row.tipo||row.km!==null&&(!Number.isInteger(row.km)||row.km<0))throw Error('Dati intervento non validi');
  if(id)await apiUpdate('manutenzioni_flotta',id,row);else await apiInsert('manutenzioni_flotta',{...row,created_by:state.userId});
 });
}
function fuelForm(id=''){
 if(!requireWrite())return;
 const v=(state.data.fuel||[]).find(x=>x.id===id)||{},models=fleetOptions();if(!models.length)return notify('Nessun mezzo registrato',true);
 openForm(id?'Modifica rifornimento':'Nuovo rifornimento',`<div class="formgrid">${fieldSelect('flotta_id','Autobus',models,v.flotta_id||models[0][0])}${field('data_rifornimento','Data',v.data_rifornimento||dateISO(),'date',true)}${field('litri','Litri',v.litri??'','number',false,'min="0" step="0.01"')}${field('prezzo_litro','Prezzo / litro (€)',v.prezzo_litro??'','number',false,'min="0" step="0.001"')}${field('importo','Importo totale (€)',v.importo??0,'number',true,'min="0" step="0.01"')}${field('km','Km veicolo',v.km??'','number',false,'min="0"')}${field('distributore','Distributore',v.distributore||'')}${fieldSelect('metodo','Metodo',[['Contanti','Contanti'],['Carta','Carta'],['Bonifico','Bonifico'],['Altro','Altro']],v.metodo||'Carta')}</div><label>Note<textarea name="note" rows="2">${esc(v.note||'')}</textarea></label>`,async f=>{
  const row={flotta_id:val(f,'flotta_id'),data_rifornimento:val(f,'data_rifornimento'),litri:val(f,'litri')===''?null:Number(val(f,'litri')),prezzo_litro:val(f,'prezzo_litro')===''?null:Number(val(f,'prezzo_litro')),importo:Number(val(f,'importo')),km:val(f,'km')===''?null:Number(val(f,'km')),distributore:val(f,'distributore')||null,metodo:val(f,'metodo'),note:val(f,'note')||null};
  if(!row.data_rifornimento||!Number.isFinite(row.importo)||row.importo<0||[row.litri,row.prezzo_litro,row.km].some(n=>n!==null&&(!Number.isFinite(n)||n<0)))throw Error('Importo, litri o chilometri non validi');
  if(id)await apiUpdate('carburante_flotta',id,row);else await apiInsert('carburante_flotta',{...row,created_by:state.userId});
 });
}
function fleetBlockForm(id=''){
 if(!requireWrite())return;
 const v=(state.data.fleetBlocks||[]).find(x=>x.id===id)||{},models=fleetOptions();if(!models.length)return notify('Nessun bus disponibile',true);
 openForm(id?'Modifica indisponibilità':'Blocca mezzo per indisponibilità',`<div class="formgrid">${fieldSelect('flotta_id','Autobus',models,v.flotta_id||models[0][0])}${field('data_inizio','Dal giorno',v.data_inizio||dateISO(),'date',true)}${field('data_fine','Al giorno',v.data_fine||dateISO(),'date',true)}${field('motivo','Motivo',v.motivo||'Manutenzione','text',true)}</div><p class="hint">Un blocco mezzo può impedire l’assegnazione dell’autobus a nuove partenze. Verifica attentamente le date.</p>`,async f=>{
  const row={flotta_id:val(f,'flotta_id'),data_inizio:val(f,'data_inizio'),data_fine:val(f,'data_fine'),motivo:val(f,'motivo')};
  if(row.data_fine<row.data_inizio||!row.motivo)throw Error('Periodo o motivo non valido');
  if(id)await apiUpdate('dg_blocchi_flotta',id,row);else await apiInsert('dg_blocchi_flotta',row);
 });
}
function manualEconomyEntry(id=''){
 if(!requireWrite())return;
 const v=(state.data.economy||[]).find(x=>x.id===id)||{};
 if(id && (v.pagamento_id||v.noleggio_pagamento_id||!/^manuale/i.test(String(v.origine||''))))return notify('Movimento automatico: modifica il pagamento originario, non la contabilità duplicata.',true);
 const trips=[['','— Nessuno —'],...state.data.trips.map(t=>[t.id,tripLabel(t)])];
 openForm(id?'Modifica movimento manuale':'Nuovo movimento economico',`<div class="formgrid">${fieldSelect('tipo','Tipo',[['Uscita','Uscita'],['Entrata','Entrata']],v.tipo||'Uscita')}${field('data_movimento','Data',v.data_movimento||dateISO(),'date',true)}${fieldSelect('categoria','Categoria',[['Pedaggi','Pedaggi'],['Carburante','Carburante'],['Manutenzione','Manutenzione'],['Parcheggi','Parcheggi'],['Fornitori','Fornitori'],['Altro','Altro'],['Incasso extra','Incasso extra']],v.categoria||'Altro')}${field('importo','Importo (€)',v.importo??0,'number',true,'min="0" step="0.01"')}${fieldSelect('metodo','Metodo',[['Contanti','Contanti'],['POS','POS'],['Bonifico','Bonifico'],['Altro','Altro']],v.metodo||'Contanti')}${fieldSelect('viaggio_id','Viaggio collegato',trips,v.viaggio_id||'')}</div><label>Descrizione<textarea name="descrizione" rows="3" required maxlength="1000">${esc(v.descrizione||'')}</textarea></label><p class="hint">Usa questa funzione per spese o incassi extracontabili non già presenti tra i pagamenti delle prenotazioni. Un incasso duplicato altera i totali.</p>`,async f=>{
  const amount=Number(val(f,'importo'));if(!Number.isFinite(amount)||amount<=0)throw Error('Importo positivo obbligatorio.');
  const row={tipo:val(f,'tipo'),categoria:val(f,'categoria'),descrizione:val(f,'descrizione'),importo:amount,data_movimento:val(f,'data_movimento'),metodo:val(f,'metodo'),viaggio_id:val(f,'viaggio_id')||null};
  if(!row.descrizione||!row.data_movimento)throw Error('Descrizione e data obbligatorie.');
  if(id)await apiUpdate('economia_movimenti',id,row);else await apiInsert('economia_movimenti',{...row,origine:'Manuale V2',created_by:state.userId,operatore_user_id:state.userId,operatore:currentOperatorName()});
 });
}
function renderPro(){
 const crm=state.data.crm||[],issues=state.data.anomalies||[],checks=state.data.checklists||[];
 const crmRows=crm.slice().sort((a,b)=>String(b.scadenza||b.created_at||'').localeCompare(String(a.scadenza||a.created_at||''))).map(x=>tr([fmt(x.nome_cliente||state.data.clients.find(c=>c.id===x.cliente_id)?.nome||'—'),fmt(x.oggetto),date(x.scadenza),tag(x.priorita),tag(x.stato)],btn('Modifica','pro-crm-edit','small',`data-id="${esc(x.id)}"`)));
 const issueRows=issues.map(x=>tr([date(x.data_segnalazione),fmt(x.titolo),fmt(busFor(x.flotta_id)?.titolo||tripFor(x.viaggio_id)?.titolo||'—'),tag(x.priorita),tag(x.stato)],btn('Modifica','pro-anomaly-edit','small',`data-id="${esc(x.id)}"`)));
 const checkRows=checks.slice().sort((a,b)=>String(b.data_check).localeCompare(String(a.data_check))).map(x=>tr([date(x.data_check),fmt(busFor(x.flotta_id)?.titolo||'—'),tag(x.esito),fmt(x.note)],btn('Modifica','pro-check-edit','small',`data-id="${esc(x.id)}"`)));
 return section('Centro Pro · Operativo 360°','CRM, segnalazioni e checklist mezzi recuperati dalla V1',btn('+ Attività CRM','pro-crm-new','primary')+btn('+ Anomalia','pro-anomaly-new')+btn('+ Checklist','pro-check-new'))+
 `<div class="kpis">${[['Attività CRM',crm.length],['Anomalie aperte',issues.filter(x=>!/risolt|chius/i.test(x.stato)).length],['Controlli mezzi',checks.length]].map(([l,n])=>`<div class="kpi"><span>${fmt(l)}</span><strong>${n}</strong></div>`).join('')}</div>`+
 panel('CRM e ricontatti',knownTableProblem('crm_attivita')+table(['Cliente','Oggetto','Scadenza','Priorità','Stato',''],crmRows))+
 panel('Anomalie da gestire',knownTableProblem('anomalie_gestionale')+table(['Data','Anomalia','Riferimento','Priorità','Stato',''],issueRows))+
 panel('Checklist mezzi',knownTableProblem('checklist_mezzi')+table(['Data','Bus','Esito','Note',''],checkRows));
}
function crmForm(id=''){
 if(!requireWrite())return;const x=(state.data.crm||[]).find(a=>a.id===id)||{};
 const customers=[['','— Cliente non presente in rubrica —'],...state.data.clients.map(c=>[c.id,[c.nome,c.cognome].filter(Boolean).join(' ')])];
 openForm(id?'Modifica attività CRM':'Nuova attività CRM',`<div class="formgrid">${fieldSelect('cliente_id','Cliente',customers,x.cliente_id||'')}${field('nome_cliente','Nominativo alternativo',x.nome_cliente||'')}${field('oggetto','Oggetto attività',x.oggetto||'','text',true)}${fieldSelect('tipo','Tipo',[['Contatto','Contatto'],['Preventivo','Preventivo'],['Ricontatto','Ricontatto'],['Reclamo','Reclamo'],['Altro','Altro']],x.tipo||'Contatto')}${fieldSelect('priorita','Priorità',[['normale','Normale'],['alta','Alta'],['bassa','Bassa']],x.priorita||'normale')}${fieldSelect('stato','Stato',[['Aperta','Aperta'],['In corso','In corso'],['Completata','Completata']],x.stato||'Aperta')}${field('scadenza','Da completare il',x.scadenza||'','date')}</div><label>Note<textarea name="note" rows="3">${esc(x.note||'')}</textarea></label>`,async f=>{
 const row={cliente_id:val(f,'cliente_id')||null,nome_cliente:val(f,'nome_cliente')||null,oggetto:val(f,'oggetto'),tipo:val(f,'tipo'),priorita:val(f,'priorita'),stato:val(f,'stato'),scadenza:val(f,'scadenza')||null,note:val(f,'note')||null};
 if(!row.oggetto)throw Error('Oggetto obbligatorio');if(id)await apiUpdate('crm_attivita',id,row);else await apiInsert('crm_attivita',{...row,created_by:state.userId});
 });
}
function anomalyForm(id=''){
 if(!requireWrite())return;const x=(state.data.anomalies||[]).find(a=>a.id===id)||{};
 openForm(id?'Modifica anomalia':'Nuova anomalia operativa',`<div class="formgrid">${field('titolo','Titolo',x.titolo||'','text',true)}${field('data_segnalazione','Data',x.data_segnalazione||dateISO(),'date',true)}${fieldSelect('flotta_id','Mezzo',[['','— Nessuno —'],...fleetOptions()],x.flotta_id||'')}${fieldSelect('viaggio_id','Viaggio',[['','— Nessuno —'],...state.data.trips.map(t=>[t.id,tripLabel(t)])],x.viaggio_id||'')}${fieldSelect('priorita','Priorità',[['normale','Normale'],['alta','Alta'],['urgente','Urgente']],x.priorita||'normale')}${fieldSelect('stato','Stato',[['Aperta','Aperta'],['In lavorazione','In lavorazione'],['Risolta','Risolta']],x.stato||'Aperta')}</div><label>Descrizione<textarea name="descrizione" rows="3">${esc(x.descrizione||'')}</textarea></label>`,async f=>{
 const row={titolo:val(f,'titolo'),data_segnalazione:val(f,'data_segnalazione'),flotta_id:val(f,'flotta_id')||null,viaggio_id:val(f,'viaggio_id')||null,priorita:val(f,'priorita'),stato:val(f,'stato'),descrizione:val(f,'descrizione')||null};
 if(!row.titolo)throw Error('Titolo obbligatorio');if(id)await apiUpdate('anomalie_gestionale',id,row);else await apiInsert('anomalie_gestionale',{...row,created_by:state.userId});
 });
}
function checkForm(id=''){
 if(!requireWrite())return;const x=(state.data.checklists||[]).find(a=>a.id===id)||{},checks=['luci','pneumatici','climatizzazione','porte','bagagliaio','estintore','documentazione','pulizia','carburante'];
 openForm(id?'Modifica checklist':'Nuova checklist mezzo',`<div class="formgrid">${fieldSelect('flotta_id','Bus',fleetOptions(),x.flotta_id||state.data.fleet[0]?.id||'')}${field('data_check','Data del controllo',x.data_check||dateISO(),'date',true)}${fieldSelect('esito','Esito',[['Conforme','Conforme'],['Da verificare','Da verificare'],['Non conforme','Non conforme']],x.esito||'Da verificare')}</div><div class="formgrid">${checks.map(key=>`<label><input type="checkbox" name="${key}" ${x[key]?'checked':''}> ${esc(key.replace('_',' '))}</label>`).join('')}</div><label>Note<textarea name="note" rows="3">${esc(x.note||'')}</textarea></label>`,async f=>{
 const data=new FormData(f),row={flotta_id:val(f,'flotta_id'),data_check:val(f,'data_check'),esito:val(f,'esito'),note:val(f,'note')||null};
 if(!row.flotta_id||!row.data_check)throw Error('Mezzo e data obbligatori');
 for(const key of checks)row[key]=data.has(key);
 if(id)await apiUpdate('checklist_mezzi',id,row);else await apiInsert('checklist_mezzi',{...row,created_by:state.userId});
 });
}

/* Documento gestionale privato: crea una scheda e carica il file in Supabase Storage.
   La scheda è confermata solo quando l'upload e l'inserimento dei metadati hanno successo. */
function documentForm(id=''){
 if(!requireWrite())return;
 const old=state.data.documents.find(d=>d.id===id)||{};
 const trips=[['','— Nessun viaggio —'],...state.data.trips.map(t=>[t.id,tripLabel(t)])];
 const customers=[['','— Nessun cliente —'],...state.data.clients.map(c=>[c.id,[c.nome,c.cognome].filter(Boolean).join(' ')])];
 openForm(id?'Modifica scheda documento':'Archivia nuovo documento',`<div class="formgrid">${field('titolo','Titolo documento',old.titolo||'','text',true,'maxlength="180"')}${fieldSelect('categoria','Categoria',[['contratto','Contratto'],['ricevuta','Ricevuta'],['assicurazione','Assicurazione'],['preventivo','Preventivo'],['altro','Altro']],old.categoria||'altro')}${fieldSelect('viaggio_id','Viaggio',trips,old.viaggio_id||'')}${fieldSelect('cliente_id','Cliente',customers,old.cliente_id||'')}${field('scadenza','Scadenza (facoltativa)',old.scadenza||'','date')}</div><label>Descrizione<textarea name="descrizione" rows="2">${esc(old.descrizione||'')}</textarea></label><label>Allegato PDF / immagine ${id?'(lascia vuoto per conservare quello attuale)':'(obbligatorio)'}<input type="file" name="allegato" accept="application/pdf,image/png,image/jpeg,image/webp" ${id?'':'required'}></label><label>Note<textarea name="note" rows="2">${esc(old.note||'')}</textarea></label><p class="hint">Archivio privato Supabase Storage · massimo 12 MB · Nessun link pubblico permanente. Il file originale non viene cancellato se sostituisci l'allegato.</p>`,async f=>{
   const title=val(f,'titolo');if(!title)throw Error('Inserisci un titolo');
   const file=f.elements.namedItem('allegato')?.files?.[0];
   let path=old.storage_path||null,mime=old.mime_type||null,size=old.dimensione||null;
   if(!id&&!file)throw Error('Seleziona il documento da archiviare');
   if(file){
    const types=['application/pdf','image/png','image/jpeg','image/webp'];
    if(!types.includes(file.type)||file.size<1||file.size>12*1024*1024)throw Error('Allegato non consentito: usa PDF/JPG/PNG/WEBP fino a 12 MB');
    const safe=String(file.name||'allegato').replace(/[^A-Za-z0-9._-]+/g,'_').slice(-100);
    path='v2/documenti/'+uuid()+'/'+safe;
    const objectPath=path.split('/').map(encodeURIComponent).join('/');
    const resp=await withTimeout(URL_BASE+'/storage/v1/object/gestionale-documenti/'+objectPath,{
      method:'POST',headers:{apikey:PUBLIC_KEY,Authorization:'Bearer '+state.token,'Content-Type':file.type,'x-upsert':'false'},body:file,cache:'no-store'
    },30000);
    if(!resp.ok){const details=await resp.json().catch(()=>({}));throw Error(details.message||details.error||'Caricamento documento non autorizzato: HTTP '+resp.status);}
    mime=file.type;size=file.size;
   }
   const row={titolo:title,categoria:val(f,'categoria'),descrizione:val(f,'descrizione')||null,viaggio_id:val(f,'viaggio_id')||null,cliente_id:val(f,'cliente_id')||null,scadenza:val(f,'scadenza')||null,note:val(f,'note')||null,storage_bucket:'gestionale-documenti',storage_path:path,mime_type:mime,dimensione:size};
   try{
    if(id)await apiUpdate('documenti_gestionali',id,row);
    else await apiInsert('documenti_gestionali',{...row,created_by:state.userId});
   }catch(e){throw Error('File caricato ma scheda non confermata: '+e.message+'. Non ripetere l’upload senza verificare l’archivio.');}
 });
}
function openDocumentLink(id){
 const d=state.data.documents.find(x=>x.id===id);if(!d)return notify('Documento non trovato',true);
 if(d.storage_path)return openArchivedPdf(d.storage_bucket||'gestionale-documenti',d.storage_path);
 if(d.url){let url;try{url=new URL(d.url)}catch{}if(url?.protocol==='https:'){window.open(url.href,'_blank','noopener');return;}}
 return notify('Questo documento non ha un allegato accessibile',true);
}

function renderSettings(){
 return section('Impostazioni e sicurezza','Connessione al gestionale originale')+
 panel('Connessione Supabase',`<div class="helpbox"><b>Database:</b> ${esc(URL_BASE)}<br><b>Stato:</b> ${state.write?'Operativo · modifica abilitata':'Connesso · lettura'}<br><b>Operatore:</b> ${fmt(state.userId)}<br><b>Protezione:</b> Supabase Auth + Row Level Security (RLS).</div><p class="hint">Le password non vengono salvate. Le sessioni sono conservate solo nella scheda del browser (sessionStorage), eliminate al logout o alla chiusura della scheda. Viene usata soltanto la chiave publishable di Supabase.</p><div class="actions">${btn('Aggiorna da Supabase','refresh')}${btn('Controllo integrità','integrity-open')}</div>`)+
 panel('Protezione produzione','<p class="subtle">Dopo il login e la verifica del profilo operatore, le scritture sono disponibili automaticamente, senza un secondo interruttore. Le modifiche restano soggette a Supabase RLS, autorizzazioni e verifiche server; le cancellazioni richiedono conferma. Conserva un backup ripristinabile del database e dello Storage.</p>')+
 panel('Integrazioni',table(['Servizio','Gestione'],[
 ['Supabase Auth / RLS','Connesso, secondo permessi operatore'],
 ['Prenotazioni / posti / BUS BIS','RPC del database esistente'],
 ['Incassi e cassa','Movimenti reali e riconciliazione in centesimi'],
 ['WhatsApp gruppi','Messaggi precompilati, nessuna aggiunta automatica'],
 ['PDF','Nuove conferme generate e archiviate nel bucket privato; accesso da verificare con operatori'],
 ['Email automatiche / WhatsApp Cloud','Non abilitate in questo frontend']].map(a=>tr(a.map(fmt)))));
}
function render(){const [title,subtitle]=pageInfo[state.page];$('page-title').textContent=title;$('page-subtitle').textContent=subtitle;
 document.querySelectorAll('.navbtn').forEach(b=>b.classList.toggle('active',b.dataset.page===state.page));
 if(!isConfigured()){$('content').innerHTML='<div class="panel access-gate"><img class="gate-logo" src="./assets/logo-delgrosso-cropped.webp" alt="Logo ufficiale DELGROSSO Viaggi e Limousine Bus"><div class="access-symbol">🔐</div><h2>Accesso riservato agli operatori</h2><p>Accedi con Nicola oppure Raffaele nella schermata di accesso unica. I dati aziendali vengono caricati dopo il login.</p></div>';return}

 const mapping={dashboard:renderDashboard,viaggi:renderTrips,prenotazioni:renderBookings,control:renderControl,piantine:renderEditor,cassa:renderCash,pagamenti:renderPayments,operativo:renderOperations,assistente:renderAssistant,agenda:renderAgenda,fermate:renderBoarding,statistiche:renderStatistics,economia:renderEconomy,backup:renderBackup,flotta:renderFleet,noleggi:renderRentals,preventivi:renderQuotes,clienti:renderClients,whatsapp:renderWhatsapp,comunicazioni:renderComms,flottaoperativa:renderFleetOps,centropro:renderPro,notifiche:renderNotifications,integrita:renderIntegrity,archivio:renderArchive,chiusure:renderClosures,impostazioni:renderSettings};
 try{$('content').innerHTML=mapping[state.page]();if(state.page==='flotta')mountFleetPhotos()}catch(e){$('content').innerHTML=panel('Errore di visualizzazione',`<p class="error">${esc(e.message)}</p>`);console.error(e)}
}
function openForm(title,inner,handler){$('edit-dialog').classList.remove('wide');$('edit-title').textContent=title;$('edit-body').innerHTML=`<form id="edit-form">${inner}<div class="separator"></div><div class="actions"><button type="submit" class="btn primary" id="edit-submit">Salva</button><button type="button" class="btn outline" id="edit-cancel">Annulla</button></div></form>`;state.modalSubmit=handler;state.modalTripId='';$('edit-dialog').showModal()}
function val(form,name){return String(new FormData(form).get(name)||'').trim()}
const field=(name,label,value='',type='text',required=false,extra='')=>`<label>${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${required?'required':''} ${extra}></label>`;
const fieldSelect=(name,label,items,v)=>`<label>${esc(label)}<select name="${name}">${asOptions(items,v)}</select></label>`;
async function doWrite(callback){
 if(!requireWrite()||state.writeBusy)return;state.writeBusy=true;
 const sub=$('edit-submit');if(sub){sub.disabled=true;sub.textContent='Salvataggio in corso…'}
 try{
  const result=await callback();$('edit-dialog').close();await sync();
  if(result?.savedBookingId&&!state.data.bookings.some(b=>b.id===result.savedBookingId)){
   return notify('Prenotazione confermata dal server ma non ancora visibile nell’elenco: controlla i permessi e premi Aggiorna prima di riprovare.',true);
  }
  if(state.failedTables.length)return notify('Salvataggio confermato; alcune sezioni non sono state aggiornate. Verifica connessione e permessi.',true);
  notify(result?.receiptWarning?result.receiptWarning:(result?.receiptCreated?'Pagamento salvato e ricevuta professionale archiviata su Supabase':'Dati salvati e riletti da Supabase'),Boolean(result?.receiptWarning));
 }
 catch(e){notify('Operazione non completata: '+e.message,true);console.error(e)}
 finally{state.writeBusy=false;if(sub){sub.disabled=false;sub.textContent='Salva'}}
}
async function apiUpsert(table,data,pk='id'){const method='POST';return request(table,{method,body:data,prefer:'resolution=merge-duplicates,return=representation'})}
async function apiInsert(table,data){const out=await request(table,{method:'POST',body:data,prefer:'return=representation'});if(!Array.isArray(out)||out.length!==1)throw Error('Inserimento non confermato da Supabase');return out}
async function apiUpdate(table,id,data){const out=await request(table+'?id=eq.'+encodeURIComponent(id),{method:'PATCH',body:data,prefer:'return=representation'});if(!Array.isArray(out)||out.length!==1)throw Error('Modifica non confermata da Supabase (nessuna riga aggiornata)');return out}
function stopsForTrip(t){const stops=state.data.stops.filter(s=>s.viaggio_id===t?.id&&s.attiva!==false).sort((a,b)=>num(a.ordine)-num(b.ordine)).map(x=>String(x.nome||'').trim()).filter(Boolean);return stops.length?stops:String(t?.luogo_partenza||'').split('|').map(x=>x.trim()).filter(Boolean)}
function tripForm(id=''){
 const t=tripFor(id)||{},bs=state.data.fleet.map(b=>[b.id,(b.marca||'')+' '+(b.modello||'')+' · '+b.posti+' posti']);
 const ownStops=stopsForTrip(t).join('\n'),arch=!!t.archiviato_at;
 const statuses=[['Programmato','Programmato'],['Aperto','Aperto'],['Confermato','Confermato'],['SOLD OUT','SOLD OUT'],['Sold out','Sold out'],['Annullato','Annullato']];if(t.stato&&!statuses.some(v=>v[0]===t.stato))statuses.push([t.stato,t.stato]);
 const html=`<div class="formgrid">${field('titolo','Titolo viaggio',t.titolo||'','text',true)}${field('destinazione','Destinazione',t.destinazione||'','text',true)}${field('data_partenza','Data partenza',t.data_partenza||'','date',true)}${field('ora_partenza','Ora partenza',String(t.ora_partenza||'').slice(0,5),'time')}${field('prezzo','Prezzo a persona (€)',t.prezzo??0,'number',true,'min="0" step="0.01"')}${field('posti_totali','Posti totali',t.posti_totali||53,'number',true,'min="1" max="999"')}${field('minimo_partecipanti','Minimo partecipanti',t.minimo_partecipanti||40,'number',true,'min="1"')}${fieldSelect('autobus_id','Autobus',[['','— Non assegnato —'],...bs],t.autobus_id||'')}${fieldSelect('stato','Stato',statuses,t.stato||'Programmato')}${fieldSelect('pubblicato','Visibile sul sito',[['NO','No'],['SI','Sì']],arch?'NO':t.pubblicato||'NO')}</div><label>Fermate di partenza (una per riga, obbligatorie)<textarea name="fermate" rows="4" required>${esc(ownStops)}</textarea></label><label>Descrizione viaggio<textarea name="descrizione" rows="3">${esc(t.descrizione||'')}</textarea></label><p class="hint">I dati già inseriti mantengono i loro ID. Le fermate sono aggiornate dalla procedura atomica di Supabase, che preserva gli orari delle fermate rimaste identiche. Per il cambio autobus di un BUS BIS usa il comando dedicato. ${arch?'Questo viaggio è archiviato: non verrà pubblicato finché non lo ripristini.':''}</p>`;
 openForm(id?'Modifica viaggio':'Nuovo viaggio',html,async f=>{
  const stops=val(f,'fermate').split(/\r?\n/).map(x=>x.trim()).filter(Boolean),cap=Number(val(f,'posti_totali')),amount=Number(val(f,'prezzo'));
  if(!stops.length||new Set(stops.map(x=>x.toLocaleLowerCase('it'))).size!==stops.length)throw Error('Indica fermate valide e senza duplicati');
  if(!Number.isFinite(cap)||cap<1||!Number.isFinite(amount)||amount<0)throw Error('Capienza o prezzo non validi');
  if(id&&cap<bookingsCount(id))throw Error('La capienza è inferiore ai posti prenotati');
  const assigned=val(f,'autobus_id')||null;
  if(t.bis_parent_id&&assigned!==t.autobus_id)throw Error('Per cambiare autobus del BUS BIS usa il comando Cambia BUS BIS');
  const bus=busFor(assigned);
  if(bus&&cap>num(bus.posti))throw Error('Il bus selezionato dispone di soli '+bus.posti+' posti. Riduci la capienza o scegli un autobus più grande.');
  const data={titolo:val(f,'titolo'),destinazione:val(f,'destinazione'),data_partenza:val(f,'data_partenza'),ora_partenza:val(f,'ora_partenza'),prezzo:amount,posti_totali:cap,minimo_partecipanti:Number(val(f,'minimo_partecipanti'))||40,autobus_id:assigned,autobus:bus?.titolo||[bus?.marca,bus?.modello].filter(Boolean).join(' ')||t.autobus||'',stato:val(f,'stato'),pubblicato:arch?'NO':val(f,'pubblicato'),descrizione:val(f,'descrizione')};
  if(!data.titolo||!data.destinazione||!data.data_partenza)throw Error('Titolo, destinazione e data obbligatori');
  await rpc('dg_save_trip_v14',{p_id:id||uuid(),p_data:data,p_stops:stops});
 });
 state.modalTripId=id;
}
function busBisForm(id,change=false){const t=tripFor(id);if(!t)return notify('Viaggio non trovato',true);
 const bs=state.data.fleet.filter(b=>b.attivo!==false).map(b=>[b.id,(b.marca||'')+' '+(b.modello||'')+' · '+b.posti+' posti']);
 const html=`<div class="helpbox">${fmt(t.titolo)} · ${date(t.data_partenza)}<br>La scelta del mezzo e la disponibilità sono verificate sul server Supabase.</div><div class="formgrid">${fieldSelect('bus','Autobus GT',bs,change?t.autobus_id:'')}${fieldSelect('online','Pubblicazione sul sito',[['NO','Non pubblicare'],['SI','Pubblica']],t.pubblicato||'NO')}</div>`;
 openForm(change?'Cambia BUS BIS':'Aggiungi BUS BIS',html,async f=>{const bus=val(f,'bus');if(!bus)throw Error('Seleziona un autobus');if(change)await rpc('dg_update_trip_bis_v1',{p_bis_trip_id:id,p_bus_id:bus,p_publish:val(f,'online')==='SI'});else await rpc('dg_open_trip_bis_v1',{p_source_trip_id:id,p_bus_id:bus,p_publish:val(f,'online')==='SI'})});
}
function tripArchive(id,archive){if(!requireWrite())return;const t=tripFor(id);if(!t)return;
 return confirmAction((archive?'Archiviare':'Ripristinare')+' il viaggio "'+t.titolo+'"? Anche eventuali BUS BIS collegati verranno '+(archive?'archiviati. Le prenotazioni e i pagamenti resteranno intatti.':'ripristinati; la pubblicazione sul sito resterà disattivata.') ,async()=>{
  await rpc('dg_archive_trip_v56',{p_viaggio_id:id,p_archivia:archive});await sync();notify(archive?'Viaggio archiviato senza perdita dei dati':'Viaggio ripristinato (non pubblicato)');
 });
}
async function tripDelete(id){if(!requireWrite())return;const t=tripFor(id);if(!t)return;
 const preview=await rpc('dg_trip_delete_preview_v56',{p_viaggio_id:id});
 const known=state.data.bookings.filter(b=>b.viaggio_id===id).length;
 if(preview?.can_delete!==true||known>0||num(preview?.prenotazioni)>0){
  const reasons=[...((preview?.blocchi||[]).map(String)),known>0?'Sono presenti prenotazioni storiche ('+known+')':'' ].filter(Boolean);
  notify('Impossibile eliminare: '+(reasons.join(' · ')||'dati collegati da conservare')+'. Usa Archivia.',true);return;
 }
 const typed=prompt('Eliminazione PERMANENTE di "'+t.titolo+'". Solo viaggi privi di dati storici. Per continuare scrivi ELIMINA DEFINITIVAMENTE');
 if(typed!=='ELIMINA DEFINITIVAMENTE')return notify('Eliminazione annullata');
 return confirmAction('Confermi la cancellazione IRREVERSIBILE del viaggio '+t.titolo+'? Supabase ricontrollerà i collegamenti prima di eliminare.',async()=>{
  const result=await rpc('dg_delete_trip_v56',{p_viaggio_id:id,p_conferma:typed});if(result?.deleted!==true)throw Error('La cancellazione non è stata confermata dal server');await sync();notify('Viaggio eliminato');
 });
}
function bookingSeatPickerHtml(){
 const d=state.bookingDraft;if(!d)return '';
 const trip=tripFor(d.tripId);if(!trip)return '<p class="error">Seleziona un viaggio prima di scegliere i sedili.</p>';
 const layout=layoutForTrip(trip),taken=occupied(d.tripId,d.editingId);
 const valid=new Set(layout.rows.flat().filter(Number.isInteger).map(String));
 const seatsCount=[...d.selected].filter(s=>valid.has(s)).length;
 return `<div class="booking-seat-layout"><div class="booking-seat-summary"><b>${fmt(trip.titolo)}</b> · ${num(trip.posti_totali)} posti totali · <b>${taken.size} occupati</b> · <b>${Math.max(0,num(trip.posti_totali)-taken.size-(d.editingId?0:0))} disponibili</b><br><b>${seatsCount}/${num(d.people)} selezionati</b></div>
 <div class="booking-seat-legend"><span>◻ Libero</span><span class="taken">■ Occupato</span><span class="selected">■ Selezionato</span><span class="mine">■ Prenotazione in modifica</span></div>
 <div class="bus"><div class="bus-front"><span>${fmt(layout.frontLabel||'FRONTE BUS')}</span><span>◉ AUTISTA</span></div>${layout.rows.map(row=>`<div class="bus-row">${row.map(cell=>{
 if(!Number.isInteger(cell))return `<span class="seat ${esc(cell)}" aria-hidden="true">${cell==='door'?'PORTA':cell==='aisle'?'·':'+'}</span>`;
 const key=String(cell),busy=taken.has(key),selected=d.selected.has(key),own=d.editingId&&bookingSeatNumbers(bookingFor(d.editingId)).includes(key);
 return `<button type="button" class="seat seat-number ${busy?'occupied':''} ${selected?'selected':''} ${own&&!selected?'mine':''}" data-action="booking-seat-toggle" data-seat="${key}" aria-pressed="${selected?'true':'false'}" aria-label="Posto ${key}: ${busy?'occupato':selected?'selezionato':'libero'}" ${busy?'disabled':''}>${key}</button>`;
 }).join('')}</div>`).join('')}</div><p id="booking-seat-status" class="inlineinfo" aria-live="polite">Posti selezionati: ${[...d.selected].sort((a,b)=>num(a)-num(b)).join(', ')||'nessuno'}</p></div>`;
}
function updateBookingSeatPanel(){
 const d=state.bookingDraft;if(!d)return;
 const f=$('edit-form');if(!f)return;
 d.tripId=val(f,'viaggio_id');d.people=Number(val(f,'posti'))||0;
 const t=tripFor(d.tripId),valid=new Set(layoutForTrip(t).rows.flat().filter(Number.isInteger).map(String));
 for(const s of d.selected)if(!valid.has(s))d.selected.delete(s);
 const target=$('booking-seat-panel');if(target)target.innerHTML=bookingSeatPickerHtml();
}
async function refreshBookingTripSeats(tripId){
 if(!isConfigured()||!tripId)return;
 const url='&viaggio_id=eq.'+encodeURIComponent(tripId);
 const [b,s]=await Promise.all([request('prenotazioni?select=*&limit=1000'+url),request('prenotazione_posti?select=*&limit=1000'+url)]);
 if(!Array.isArray(b)||!Array.isArray(s))throw Error('Impossibile leggere i posti prenotati');
 state.data.bookings=[...state.data.bookings.filter(x=>x.viaggio_id!==tripId),...b];
 state.data.seats=[...state.data.seats.filter(x=>x.viaggio_id!==tripId),...s];
}
function bookingForm(id=''){
 const b=bookingFor(id)||{},entries=state.data.trips.filter(t=>!t.archiviato_at || (id && t.id===b.viaggio_id)).sort((a,c)=>String(a.data_partenza).localeCompare(String(c.data_partenza))),t=tripFor(b.viaggio_id)||entries[0];
 if(!t)return notify('Devi creare prima un viaggio per registrare prenotazioni',true);
 state.bookingDraft={editingId:id,tripId:t.id,selected:new Set(bookingSeatNumbers(b)),people:num(b.posti)||1,idempotencyId:id||uuid(),totalEdited:Boolean(id)};
 const statusList=[['In attesa acconto','In attesa acconto'],['Confermata','Confermata'],['Da confermare','Da confermare'],['Da saldare','Da saldare'],['Acconto Ricevuto','Acconto Ricevuto'],['Pagata','Pagata'],['Annullata','Annullata']];
 if(b.stato&&!statusList.some(x=>x[0]===b.stato))statusList.push([b.stato,b.stato]);
 const amount=b.totale??num(t.prezzo)*state.bookingDraft.people;
 const html=`<div class="formgrid">${fieldSelect('viaggio_id','Viaggio',entries.map(t=>[t.id,tripLabel(t)]),t.id)}${field('cliente','Nome e cognome referente',b.cliente||'','text',true)}${field('telefono','Telefono',b.telefono||'','tel')}${field('email','Email',b.email||'','email')}${field('posti','Numero passeggeri',state.bookingDraft.people,'number',true,'min="1" max="99"')}${field('totale','Totale prenotazione (€)',amount,'number',true,'min="0" step="0.01"')}${field('fermata_partenza','Fermata di partenza',b.fermata_partenza||'','text',true)}${fieldSelect('stato','Stato',statusList,b.stato||'In attesa acconto')}${field('giorni_acconto','Giorni per acconto',b.giorni_acconto||2,'number',true,'min="1" max="90"')}</div>
 <h3>Seleziona i posti direttamente sulla piantina</h3><div id="booking-seat-panel">${bookingSeatPickerHtml()}</div>
 <label>Note<textarea name="note" rows="3">${esc(b.note||'')}</textarea></label>
 <p class="hint">Rosa: occupato da un altro cliente. Blu: selezionato. Puoi vedere l’intera piantina prima di salvare; Supabase ricontrolla atomicamente i posti per evitare sovrapposizioni con le prenotazioni online. Nessuna email viene inviata automaticamente.</p>`;
 openForm(id?'Modifica prenotazione e posti':'Nuova prenotazione · piantina completa',html,async f=>{
  const d=state.bookingDraft;if(!d)throw Error('Selezione posti scaduta: riapri il modulo');
  const people=Number(val(f,'posti')),tripId=val(f,'viaggio_id'),trip=tripFor(tripId),total=Number(val(f,'totale')),status=val(f,'stato'),cancelled=isCancelled({stato:status});
  const seats=[...d.selected].sort((a,b)=>num(a)-num(b));
  if(!trip||tripId!==d.tripId)throw Error('Viaggio non valido; riapri la piantina');
  if(!Number.isInteger(people)||people<1||people>99)throw Error('Numero passeggeri non valido');
  if(!cancelled&&seats.length!==people)throw Error('Seleziona esattamente '+people+' posti sulla piantina; selezionati: '+seats.length);
  const valid=new Set(layoutForTrip(trip).rows.flat().filter(Number.isInteger).map(String));
  if(seats.some(x=>!valid.has(x)))throw Error('Un posto non appartiene alla piantina di questo bus');
  if(!cancelled&&seats.some(x=>occupied(tripId,id).has(x)))throw Error('Uno dei posti è stato prenotato da un altro cliente: aggiorna la piantina');
  if(!Number.isFinite(total)||total<0||total<num(b.pagato))throw Error('Totale prenotazione non valido o inferiore al già pagato');
  const data={viaggio_id:tripId,cliente:val(f,'cliente'),telefono:val(f,'telefono'),email:val(f,'email'),posti:people,totale:total,stato:status,fermata_partenza:val(f,'fermata_partenza'),giorni_acconto:Number(val(f,'giorni_acconto'))||2,note:val(f,'note')};
  const result=await rpc('dg2_save_booking_guarded_v1',{p_id:d.idempotencyId,p_data:data,p_seats:cancelled?[]:seats});
  if(result?.id!==d.idempotencyId)throw Error('Supabase non ha restituito la prenotazione salvata');
  let receiptWarning='';
  try{await archiveBookingPdf(result,trip)}catch(e){receiptWarning=e.message;console.warn('Prenotazione salvata; conferma PDF non archiviata:',e.message)}
  state.bookingDraft=null;
  return {receiptWarning,savedBookingId:result.id};
 });
 $('edit-dialog').classList.add('wide');
 // Refresh the selected trip immediately from Supabase while preserving typed fields.
 refreshBookingTripSeats(t.id).then(()=>updateBookingSeatPanel()).catch(e=>{notify('Impossibile aggiornare posti live: '+e.message,true)});
}

async function confirmAction(description,fn){$('confirm-copy').textContent=description;$('confirm-dialog').showModal();return new Promise(resolve=>{const yes=$('confirm-yes'),no=$('confirm-no'),close=$('confirm-close');const cleanup=()=>{yes.removeEventListener('click',onYes);no.removeEventListener('click',onNo);close.removeEventListener('click',onNo);$('confirm-dialog').close()};async function onYes(){cleanup();try{await fn();resolve(true)}catch(err){notify(err.message,true);resolve(false)}}function onNo(){cleanup();resolve(false)}yes.addEventListener('click',onYes);no.addEventListener('click',onNo);close.addEventListener('click',onNo)})}
function showBooking(id){$('edit-dialog').classList.remove('wide');const b=bookingFor(id);if(!b)return notify('Prenotazione non trovata',true);
 const t=tripFor(b.viaggio_id);const remaining=Math.max(0,num(b.totale)-num(b.pagato));
 const lines=state.data.payments.filter(p=>p.prenotazione_id===id);
 const body=`<div class="helpbox"><b>${fmt(b.cliente)}</b><br>${fmt(t?.titolo)} · ${date(t?.data_partenza)}<br>Posti assegnati: <b>${fmt(b.posti_selezionati)}</b><br>Fermata: ${fmt(b.fermata_partenza)}<br>Stato: ${fmt(b.stato)}<br>Telefono: ${fmt(b.telefono)}<br>Email: ${fmt(b.email)}</div><div class="three-col" style="margin-top:12px"><div class="helpbox">Totale<br><b>${money(b.totale)}</b></div><div class="helpbox">Versato<br><b>${money(b.pagato)}</b></div><div class="helpbox">Residuo<br><b>${money(remaining)}</b></div></div><div class="separator"></div><p class="subtle">Movimenti collegati: ${lines.length} · Documento: ${b.confirmation_storage_path?'PDF archiviato':'da archiviare'}</p><div class="actions">${b.confirmation_storage_path?btn('Apri PDF archiviato','booking-archive-open','primary',`data-id="${esc(id)}"`):btn('Genera e archivia PDF','booking-archive-create','primary',`data-id="${esc(id)}"`)}${btn('Stampa riepilogo','booking-print','outline',`data-id="${esc(id)}"`)}${btn('Modifica','booking-edit','outline',`data-id="${esc(id)}"`)}${btn('Elimina (protetto)','booking-delete','outline',`data-id="${esc(id)}"`)}</div>`;
 $('edit-title').textContent='Scheda prenotazione';$('edit-body').innerHTML=body;if(!$('edit-dialog').open)$('edit-dialog').showModal();
}
function clientForm(id=''){
 const c=state.data.clients.find(x=>x.id===id)||{};
 openForm(id?'Modifica cliente':'Nuovo cliente',`<div class="formgrid">${field('nome','Nome',c.nome||'','text',true)}${field('cognome','Cognome',c.cognome||'','text',true)}${field('telefono','Telefono',c.telefono||'','tel')}${field('email','Email',c.email||'','email')}${field('citta','Città',c.citta||'')}${field('indirizzo','Indirizzo',c.indirizzo||'')}</div><label>Note<textarea name="note">${esc(c.note||'')}</textarea></label><p class="hint">Modifica soltanto l’anagrafica. Prenotazioni, posti e movimenti storici non vengono riscritti.</p>`,async f=>{
  const row={nome:val(f,'nome'),cognome:val(f,'cognome'),telefono:val(f,'telefono')||null,email:val(f,'email')||null,citta:val(f,'citta')||null,indirizzo:val(f,'indirizzo')||null,note:val(f,'note')||null};
  if(id)await apiUpdate('clienti',id,row);else await apiInsert('clienti',row);
 });
}
function fleetForm(id=''){
 const b=busFor(id)||{},values=Object.keys(Model.legacy).map(x=>[x,x]);
 openForm(id?'Modifica autobus':'Aggiungi autobus',`<div class="formgrid">${field('marca','Marca',b.marca||'Irizar Scania','text',true)}${field('modello','Modello',b.modello||'','text',true)}${field('targa','Targa',b.targa||'')}${field('posti','Posti',b.posti||53,'number',true,'min="1"')}${fieldSelect('seat_layout','Piantina originale',[['','— Non assegnata —'],...values],b.seat_layout||'GT53')}${fieldSelect('stato','Stato',[['Disponibile','Disponibile'],['Impegnato','Impegnato'],['Manutenzione','Manutenzione']],b.stato||'Disponibile')}${field('immagine','Foto principale (URL o percorso Storage)',b.immagine||'')}</div><p class="hint">Mantiene le foto originali Supabase. L’editor aggiorna il riferimento all’immagine ma non cancella alcun file da Storage.</p>`,async f=>{
  const row={marca:val(f,'marca'),modello:val(f,'modello'),targa:val(f,'targa')||null,posti:Number(val(f,'posti')),seat_layout:val(f,'seat_layout')||null,stato:val(f,'stato'),immagine:val(f,'immagine')||null};
  if(id)await apiUpdate('flotta',id,row);else await apiInsert('flotta',row);
 });
}

function rentalForm(id=''){
 const b=state.data.rentals.find(x=>x.id===id)||{};
 openForm(id?'Modifica noleggio':'Nuovo noleggio',`<div class="formgrid">${field('referente','Referente',b.referente||'','text',true)}${field('azienda','Azienda',b.azienda||'')}${field('telefono','Telefono',b.telefono||'','tel')}${field('tratta_partenza','Partenza',b.tratta_partenza||'','text',true)}${field('tratta_destinazione','Destinazione',b.tratta_destinazione||'','text',true)}${field('data_partenza','Data partenza',b.data_partenza||'','date',true)}${field('ora_partenza','Ora',String(b.ora_partenza||'').slice(0,5),'time')}${field('passeggeri','Passeggeri',b.passeggeri||40,'number',true,'min="1"')}${field('prezzo_concordato','Prezzo (€)',b.prezzo_concordato||0,'number',true,'min="0" step="0.01"')}${fieldSelect('stato_noleggio','Stato',[['Richiesta','Richiesta'],['Confermato','Confermato'],['Concluso','Concluso'],['Annullato','Annullato']],b.stato_noleggio||'Richiesta')}</div>`,async f=>{
 const row={referente:val(f,'referente'),azienda:val(f,'azienda')||null,telefono:val(f,'telefono')||null,tratta_partenza:val(f,'tratta_partenza'),tratta_destinazione:val(f,'tratta_destinazione'),data_partenza:val(f,'data_partenza'),ora_partenza:val(f,'ora_partenza')||null,passeggeri:Number(val(f,'passeggeri')),prezzo_concordato:Number(val(f,'prezzo_concordato')),stato_noleggio:val(f,'stato_noleggio')};
 if(!id){row.id=uuid();row.servizio_tipo='Noleggio autobus';row.acconto=0;row.saldo=row.prezzo_concordato;row.stato_pagamento='Da pagare'}
 if(id)await apiUpdate('noleggi_bus',id,row);else await apiInsert('noleggi_bus',row);
 });
}
function quoteForm(id=''){const old=state.data.quotes.find(q=>q.id===id)||{};openForm(id?'Modifica preventivo':'Nuovo preventivo',`<div class="formgrid">${field('nome','Nome',old.nome||'', 'text',true)}${field('cognome','Cognome',old.cognome||'')}${field('telefono','Telefono',old.telefono||'', 'tel',true)}${field('destinazione','Destinazione',old.destinazione||'', 'text',true)}${field('origine','Origine',old.origine||'Gestionale','text',true)}${field('data_partenza','Data partenza',old.data_partenza||'','date')}${field('passeggeri','Passeggeri',old.passeggeri||40,'number',true,'min="1"')}${field('importo','Importo €',old.importo_preventivo||old.importo||0,'number',true,'min="0" step="0.01"')}</div>`,async f=>{
 const row={nome:val(f,'nome'),cognome:val(f,'cognome')||null,telefono:val(f,'telefono'),destinazione:val(f,'destinazione'),origine:val(f,'origine'),stato:'Bozza',data_partenza:val(f,'data_partenza')||null,passeggeri:Number(val(f,'passeggeri')),numero_passeggeri:Number(val(f,'passeggeri')),importo:Number(val(f,'importo')),importo_preventivo:Number(val(f,'importo'))};if(id){delete row.stato;delete row.origine;await apiUpdate('preventivi',id,row)}else{row.id=uuid();await apiInsert('preventivi',row)}
 });}
// Professional receipt service from the legacy production app. No admin secrets in the browser.
async function createOfficialPaymentReceipt(paymentId,reissue=false){
 if(!requireWrite())throw Error('Accesso operatore richiesto');
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(String(paymentId||'')))throw Error('ID pagamento non valido');
 const response=await withTimeout(URL_BASE+'/functions/v1/professional-receipts',{
  method:'POST',headers:{apikey:PUBLIC_KEY,Authorization:'Bearer '+state.token,'Content-Type':'application/json'},
  body:JSON.stringify({action:'generate',kind:'trip',id:paymentId,reissue:!!reissue}),cache:'no-store'
 },45000);
 const data=await response.json().catch(()=>({}));
 if(!response.ok||data.success!==true||!data.path)throw Error(data.error||'La ricevuta professionale non è stata archiviata');
 return data;
}
async function viewOfficialPaymentReceipt(paymentId,forceReissue=false){
 const payment=state.data.payments.find(p=>p.id===paymentId);if(!payment)throw Error('Pagamento non trovato');
 if(!forceReissue&&payment.receipt_professional_path){return openArchivedPdf('ricevute-prenotazioni',payment.receipt_professional_path)}
 if(!requireWrite())return;
 if(forceReissue){const ok=confirm('Rigenerare la ricevuta ufficiale? La versione precedente rimarrà conservata nello storico.');if(!ok)return}
 // Generate and archive on the existing official Supabase backend.
 try{
  const result=await createOfficialPaymentReceipt(paymentId,forceReissue);
  await sync();notify('Ricevuta professionale creata e archiviata. Premi Apri ricevuta originale per visualizzarla.');
  return result;
 }catch(err){notify('Ricevuta non generata: '+err.message+'. Il pagamento rimane registrato.',true);throw err}
}
const paymentTripOptions=()=>state.data.trips.slice().sort((a,b)=>String(b.data_partenza||'').localeCompare(String(a.data_partenza||''))).map(t=>[t.id,tripLabel(t)+(t.archiviato_at?' · ARCHIVIATO':'')]);
function updatePaymentBookingList(form){
 const tripId=form?.elements?.namedItem('trip')?.value||'';
 const query=String(form?.elements?.namedItem('client_search')?.value||'').toLocaleLowerCase('it-IT').trim();
 const select=form?.elements?.namedItem('booking');if(!select)return;
 const oldValue=select.value;
 const all=state.data.bookings.filter(b=>b.viaggio_id===tripId&&!isCancelled(b))
  .sort((a,b)=>String(a.cliente||'').localeCompare(String(b.cliente||''),'it'));
 const matches=all.filter(b=>!query||[b.cliente,b.cliente_nome,b.telefono,b.codice,b.confirmation_number].some(x=>String(x||'').toLocaleLowerCase('it-IT').includes(query)));
 const selected=matches.some(b=>b.id===oldValue)?oldValue:(matches.length===1?matches[0].id:'');
 select.innerHTML='<option value="">— Seleziona cliente prenotato —</option>'+asOptions(matches.map(b=>[b.id,(b.cliente||'Cliente')+' · '+b.posti+' posti · '+money(Math.max(0,num(b.totale)-num(b.pagato)))+' residuo'] ),selected);
 // In case of ambiguity the operator must pick the exact booking, no default to the first customer.
 if(selected)select.value=selected;
 const info=form.querySelector('#payment-booking-detail');const b=bookingFor(select.value);
 if(info){info.textContent=b?'Prenotazione '+(b.codice||b.confirmation_number||b.id.slice(0,8))+' · '+num(b.posti)+' persone · totale '+money(b.totale)+' · versato '+money(b.pagato)+' · residuo '+money(Math.max(0,num(b.totale)-num(b.pagato))):matches.length?'Seleziona la prenotazione corretta.':'Nessuna prenotazione corrispondente a questa ricerca.';}
}
function paymentForm(id=''){
 if(state.failedTables.some(x=>/^(viaggi|prenotazioni|pagamenti|operatori_gestionale):/.test(x))){return notify('Non è possibile aprire i pagamenti: carica prima gli archivi completi da Supabase.',true)}
 const p=state.data.payments.find(x=>x.id===id)||{},ops=state.data.operators.filter(o=>o.attivo!==false);
 const oldBooking=bookingFor(p.prenotazione_id),tripId=p.viaggio_id||oldBooking?.viaggio_id||'';
 const trips=paymentTripOptions();
 if(id&&tripId&&!trips.some(([tid])=>tid===tripId))trips.push([tripId,tripLabel(tripFor(tripId)||{titolo:'Viaggio archiviato'})]);
 const markup=`<div class="formgrid">${fieldSelect('trip','1 · Scegli il viaggio',[['','— Seleziona un viaggio —'],...trips],tripId)}
 ${field('client_search','2 · Cerca cliente prenotato','', 'search',false,'autocomplete="off" placeholder="Nome, cognome, telefono o codice"')}
 <label>3 · Seleziona prenotazione<select name="booking" required><option value="">— Scegli prima il viaggio —</option></select></label>
 <div id="payment-booking-detail" class="helpbox" aria-live="polite">Seleziona un viaggio per vedere i clienti prenotati.</div></div>
 <div class="formgrid">${fieldSelect('tipo','Tipo pagamento',[['Acconto','Acconto'],['Saldo','Saldo'],['Rimborso','Rimborso'],['Altro','Altro']],p.tipo||'Acconto')}
 ${field('importo','Importo (€)',p.importo??'','number',true,'min="0.01" step="0.01"')}
 ${fieldSelect('metodo','Metodo',[['Contanti','Contanti'],['POS','POS'],['Bonifico','Bonifico']],p.metodo_pagamento||p.metodo||'Contanti')}
 ${fieldSelect('operatore','Incassato da',ops.map(o=>[o.user_id,o.nome||o.username]),p.incassato_da_user_id||ops.find(o=>o.user_id===state.userId)?.user_id||ops[0]?.user_id)}
 ${field('data_pagamento','Data pagamento',p.data_pagamento||dateISO(),'date',true)}</div>
 <p class="hint">Dopo il salvataggio viene richiesta al servizio storico DELGROSSO la <b>ricevuta professionale originale</b>, archiviata su Supabase. In caso di errore il pagamento rimane registrato e puoi usare “Genera ricevuta”.</p>`;
 openForm(id?'Modifica movimento di pagamento':'Registra pagamento',markup,async f=>{
  if(state.failedTables.some(x=>/^(viaggi|prenotazioni|pagamenti|operatori_gestionale):/.test(x)))throw Error('Elenco incompleto: aggiorna gli archivi prima di registrare il pagamento');
  const selectedTrip=id?tripId:val(f,'trip'),bookingId=id?p.prenotazione_id:val(f,'booking'),bk=bookingFor(bookingId),op=state.data.operators.find(o=>o.user_id===val(f,'operatore'));
  if(!selectedTrip)throw Error('Seleziona prima il viaggio');
  if(!bk||bk.viaggio_id!==selectedTrip)throw Error('Seleziona un cliente prenotato al viaggio scelto');
  if(!op||op.attivo===false)throw Error('Seleziona un operatore abilitato');
  if(id&&bk.id!==p.prenotazione_id)throw Error('Non è consentito spostare un pagamento su un’altra prenotazione da questa schermata');
  const amount=Number(val(f,'importo')),type=val(f,'tipo');if(!Number.isFinite(amount)||amount<=0)throw Error('L’importo deve essere maggiore di zero');
  if(type==='Rimborso')throw Error('I rimborsi devono passare dalla procedura ufficiale di cassa, non da questa maschera.');
  const otherPayments=state.data.payments.filter(x=>x.prenotazione_id===bk.id&&x.id!==id&&/^(registrato|confermato|pagato)$/i.test(String(x.stato||'')));
  const alreadyPaid=otherPayments.reduce((sum,x)=>sum+(/rimborso/i.test(x.tipo)?-Math.abs(num(x.importo)):Math.abs(num(x.importo))),0);
  if(alreadyPaid+amount>num(bk.totale)+0.005)throw Error('L’importo complessivo supera il totale della prenotazione');
  const row={prenotazione_id:bk.id,viaggio_id:bk.viaggio_id,cliente:bk.cliente,viaggio:tripFor(bk.viaggio_id)?.titolo||'',persone:num(bk.posti),tipo:type,importo:amount,metodo:val(f,'metodo'),metodo_pagamento:val(f,'metodo'),incassato_da_user_id:op.user_id,incassato_da:op.username,data_pagamento:val(f,'data_pagamento'),stato:'Registrato'};
  let savedPaymentId=id;
  if(id){await apiUpdate('pagamenti',id,row)}else{
   savedPaymentId=uuid();Object.assign(row,{id:savedPaymentId,totale:num(bk.totale),acconto:type==='Acconto'?amount:0,saldo:Math.max(num(bk.totale)-alreadyPaid-amount,0),pagato:Math.max(alreadyPaid+amount,0)});
   const inserted=await apiInsert('pagamenti',row);
   if(!Array.isArray(inserted)||inserted.length!==1||inserted[0].id!==savedPaymentId)throw Error('Pagamento non confermato: verifica il registro prima di riprovare');
  }
  // Payment is already committed. Receipt generation failure must not request another payment.
  try{
   await createOfficialPaymentReceipt(savedPaymentId,Boolean(id));
   return {savedPaymentId,receiptCreated:true};
  }catch(e){return {savedPaymentId,receiptWarning:'Pagamento registrato ma ricevuta professionale da generare: '+e.message};}
 });
 const form=$('edit-form');
 if(id){const trip=form.elements.namedItem('trip');trip.disabled=true;trip.dataset.locked='true';}
 updatePaymentBookingList(form);
 if(id){const sel=form.elements.namedItem('booking');
   // Temporarily fill the search with the exact booking to avoid an ambiguous default.
   const search=form.elements.namedItem('client_search');search.value=oldBooking?.cliente||'';
   updatePaymentBookingList(form);sel.value=p.prenotazione_id||'';updatePaymentBookingList(form);
   sel.disabled=true;
 }
}

function printableBooking(b){const t=tripFor(b.viaggio_id),lines=state.data.payments.filter(p=>p.prenotazione_id===b.id);return `<h2>Conferma prenotazione</h2><p>Codice: <b>${fmt(b.codice||b.confirmation_number||b.id)}</b></p><p>Cliente: <b>${fmt(b.cliente)}</b><br>Viaggio: <b>${fmt(t?.titolo)}</b><br>Data: <b>${date(t?.data_partenza)}</b><br>Fermata: ${fmt(b.fermata_partenza)}<br>Persone: ${num(b.posti)}<br>Posti assegnati: <b>${fmt(b.posti_selezionati)}</b></p><div class="total">Totale: ${money(b.totale)}</div><div class="total">Versato: ${money(b.pagato)}</div><div class="total">Residuo: ${money(num(b.totale)-num(b.pagato))}</div><h2>Pagamenti collegati</h2>${table(['Data','Tipo','Importo','Metodo'],lines.map(p=>tr([date(p.data_pagamento||p.created_at),fmt(p.tipo),money(p.importo),fmt(p.metodo_pagamento||p.metodo)])))}<p class="print-note">Documento per consultazione operativa. Le ricevute fiscali e i documenti già archiviati restano nel gestionale originale.</p>`}
function printableDeparture(id){const t=tripFor(id);if(!t)return '';const bs=state.data.bookings.filter(b=>b.viaggio_id===id&&!isCancelled(b)),count=bs.reduce((s,b)=>s+num(b.posti),0);return `<h2>Riepilogo partenza · ${fmt(t.titolo)}</h2><p>Data: ${date(t.data_partenza)} · Ora: ${fmt(t.ora_partenza)} · Autobus: ${fmt(busFor(t.autobus_id)?.modello||t.autobus||'—')} · Prenotati: ${count}</p>${table(['N.','Cliente','Posti','Fermata','Totale','Pagato','Residuo','Check-in'],bs.map((b,i)=>tr([String(i+1),fmt(b.cliente),fmt(b.posti_selezionati),fmt(b.fermata_partenza),money(b.totale),money(b.pagato),money(num(b.totale)-num(b.pagato)),b.checkin_effettuato?'SI':'NO'])))}<div class="total">Partecipanti: ${count}</div><div class="total">Totale quote prenotate: ${money(bs.reduce((s,b)=>s+num(b.totale),0))}</div><div class="total">Totale da incassare: ${money(bs.reduce((s,b)=>s+Math.max(0,num(b.totale)-num(b.pagato)),0))}</div>`}
function downloadTripPdf(id){if(!isConfigured())return notify('Accedi prima di scaricare il PDF',true);try{const g=reportForTrip(id),name=Pdf.saveTripPdf(g);notify('PDF creato: '+name)}catch(e){notify('Impossibile creare il PDF: '+e.message,true)}}
function printableCash(id=''){
 const report=getCash();const groups=id?report.groups.filter(g=>g.id===id):report.groups;
 return `<h2>${id?'Cassa per singolo viaggio':'Riepilogo generale delle quote'}</h2>${groups.map(g=>`<h2>${fmt(g.trip.titolo)} · ${date(g.trip.data_partenza)}</h2><div class="total">Nicola: ${Cash.euro(g.nicola)}</div><div class="total">Raffaele: ${Cash.euro(g.raffaele)}</div><div class="total">Non attribuiti: ${Cash.euro(g.nonAttribuiti)}</div><div class="total">Totale viaggio: ${Cash.euro(g.netto)}</div>${table(['Data','Partecipante / referente','Prenotazione','Bus','Tipo','Incassato da','Importo'],g.movements.map(m=>tr([date(m.date),fmt(m.cliente),fmt(m.booking),fmt(m.bus),fmt(m.tipo),fmt(m.owner),Cash.euro(m.amount)])))}`).join('')}${!id?`<h2>Totali complessivi</h2><div class="total">Nicola: ${Cash.euro(report.totals.nicola)}</div><div class="total">Raffaele: ${Cash.euro(report.totals.raffaele)}</div><div class="total">Totale: ${Cash.euro(report.totals.netto)}</div>`:''}<p class="print-note">I totali includono soltanto i pagamenti in contanti registrati. Rimborso negativo, POS esclusi, trasferimenti interni non conteggiati come incasso.</p>`;
}
function printablePayment(id){const p=state.data.payments.find(x=>x.id===id);if(!p)return '';return `<h2>Ricevuta movimento registrato</h2><p>Numero: <b>${fmt(p.receipt_number||p.ricevuta||p.id)}</b><br>Cliente: <b>${fmt(p.cliente||bookingFor(p.prenotazione_id)?.cliente)}</b><br>Viaggio: ${fmt(tripFor(p.viaggio_id)?.titolo)}<br>Data: ${date(p.data_pagamento||p.created_at)}<br>Tipo: <b>${fmt(p.tipo)}</b><br>Metodo: ${fmt(p.metodo_pagamento||p.metodo)}<br>Incassato da: ${fmt(p.incassato_da)}</p><div class="total">Importo: ${money(p.importo)}</div><p class="print-note">Stampa riepilogativa non sostitutiva di ricevuta fiscale. Per documenti fiscali usare i documenti ufficiali archiviati.</p>`}
function printableQuote(id){const q=state.data.quotes.find(x=>x.id===id);if(!q)return '';return `<h2>Preventivo trasporto</h2><p>Numero: ${fmt(q.numero_preventivo||q.codice||q.id)}<br>Destinatario: <b>${fmt(q.nome)} ${fmt(q.cognome)}</b><br>Destinazione: ${fmt(q.destinazione)}<br>Partenza: ${fmt(q.luogo_partenza||q.partenza)}<br>Data: ${date(q.data_partenza||q.data_viaggio)}<br>Passeggeri: ${num(q.passeggeri||q.numero_passeggeri)}</p><div class="total">Importo offerta: ${money(q.importo_preventivo||q.importo)}</div><p>Condizioni: ${fmt(q.condizioni_offerta||'Da concordare con il cliente')}</p>`}
async function openArchivedPdf(bucket,untrustedPath){
 if(!isConfigured())throw Error('Accedi prima di aprire i PDF');
 if(!['ricevute-prenotazioni','gestionale-documenti','preventivi-pdf'].includes(bucket))throw Error('Archivio non autorizzato');
 let path=String(untrustedPath||'').trim().replace(/^\/+/, '');
 if(path.startsWith(bucket+'/'))path=path.slice(bucket.length+1);
 if(!path||path.includes('..')||path.includes('\\')||path.startsWith('http')||path.length>1000)throw Error('Percorso allegato non valido');
 // Aprire la scheda subito, prima della richiesta asincrona, per compatibilità iPhone.
 const tab=window.open('about:blank','_blank');
 if(!tab)throw Error('Consenti le finestre pop-up per aprire il PDF');
 try{
  tab.opener=null;
  const storagePath=path.split('/').map(encodeURIComponent).join('/');
  const response=await fetch(URL_BASE+'/storage/v1/object/sign/'+encodeURIComponent(bucket)+'/'+storagePath,{
    method:'POST',headers:{apikey:PUBLIC_KEY,Authorization:'Bearer '+state.token,'Content-Type':'application/json'},
    body:JSON.stringify({expiresIn:120}),cache:'no-store'
  });
  const data=await response.json();
  if(!response.ok||!data.signedURL)throw Error(data.message||data.error||'Accesso al documento negato');
  const link=String(data.signedURL);
  const normalized=link.startsWith('/object/sign/')?URL_BASE+'/storage/v1'+link:
   link.startsWith('object/sign/')?URL_BASE+'/storage/v1/'+link:
   link.startsWith('/storage/v1/object/sign/')?URL_BASE+link:link;
  const url=new URL(normalized);
  if(url.origin!==new URL(URL_BASE).origin||!url.pathname.startsWith('/storage/v1/object/sign/'))throw Error('URL documento non attendibile');
  tab.location.replace(url.href);
 }catch(e){try{tab.close()}catch{}throw e}
}
async function archiveBookingPdf(b,t){
 if(!requireWrite())throw Error('Accedi come operatore per archiviare i documenti');
 if(!b?.id||!t?.id)throw Error('Prenotazione o viaggio non valido');
 if(state.failedTables.some(x=>x.startsWith('prenotazioni:')))throw Error('Elenco prenotazioni non aggiornato');
 const bytes=Pdf.makeBookingPdf(b,t,state.data.payments.filter(x=>x.prenotazione_id===b.id));
 if(!(bytes instanceof Uint8Array)||bytes.length<200)throw Error('Il PDF non è stato generato correttamente');
 const path='v2/conferme/'+b.id+'/'+Date.now()+'-'+uuid()+'.pdf';
 const response=await withTimeout(URL_BASE+'/storage/v1/object/ricevute-prenotazioni/'+path,{
  method:'POST',headers:{apikey:PUBLIC_KEY,Authorization:'Bearer '+state.token,'Content-Type':'application/pdf','x-upsert':'false'},body:bytes,cache:'no-store'
 },30000);
 if(!response.ok){const payload=await response.json().catch(()=>({}));throw Error(payload.message||payload.error||'Upload PDF non autorizzato (HTTP '+response.status+')')}
 await apiUpdate('prenotazioni',b.id,{
  confirmation_storage_path:path,confirmation_generated_at:new Date().toISOString(),
  confirmation_number:b.confirmation_number||b.codice||b.id_prenotazione||('DG-'+b.id.slice(0,8))
 });
 return path;
}
async function recreateBookingReceipt(id){
 if(!requireWrite())return;
 const b=bookingFor(id),t=tripFor(b?.viaggio_id);if(!b||!t)throw Error('Prenotazione non trovata');
 const path=await archiveBookingPdf(b,t);
 await sync();notify('PDF generato e archiviato su Supabase');return path;
}
async function handleAction(action,el){const id=el.dataset.id||'';
 switch(action){
 case 'login-open':return $('auth-dialog').showModal();
 case 'archive-receipt':{const rec=state.data.receipts.find(x=>x.id===id);if(!rec?.storage_path)return notify('PDF non disponibile',true);return openArchivedPdf('ricevute-prenotazioni',rec.storage_path)}
 case 'archive-document':return openDocumentLink(id);
 case 'document-new':return documentForm();
 case 'document-edit':return documentForm(id);
 case 'integrity-open':state.page='integrita';return render();
 case 'integrity-csv':return exportCSV([['Gravità','Anomalia','Riferimento'],...integrityReport()],'DELGROSSO_CONTROLLI_INTEGRITA');
 case 'trip-new':return tripForm();
 case 'trip-edit':return tripForm(id);
 case 'trip-bis':return busBisForm(id);
 case 'trip-bis-bus':return busBisForm(id,true);
 case 'trip-archive':return tripArchive(id,true);
 case 'trip-restore':return tripArchive(id,false);
 case 'trip-delete':return tripDelete(id);
 case 'trip-pdf':return downloadTripPdf(id);
 case 'client-open':return openClientHistory(id);
 case 'trip-select':state.options.tripId=id;state.page='control';state.selectedSeats.clear();state.options.bookingId='';return render();
 case 'booking-seat-toggle':{const d=state.bookingDraft,s=String(el.dataset.seat||'');if(!d||!/^[1-9]\d*$/.test(s))return;const blocked=occupied(d.tripId,d.editingId);if(blocked.has(s))return notify('Posto già occupato',true);if(d.selected.has(s))d.selected.delete(s);else{if(d.selected.size>=d.people)return notify('Hai già selezionato '+d.people+' posti. Deselezionane uno per cambiarlo.',true);d.selected.add(s)}return updateBookingSeatPanel()}
 case 'booking-new':return bookingForm();
 case 'booking-edit':$('edit-dialog').close();return bookingForm(id);
 case 'booking-view':return showBooking(id);
 case 'booking-print':return printHtml('Conferma prenotazione',printableBooking(bookingFor(id)));
 case 'booking-archive-open':{const b=bookingFor(id);if(!b?.confirmation_storage_path)return notify('PDF non ancora archiviato',true);return openArchivedPdf('ricevute-prenotazioni',b.confirmation_storage_path)}
 case 'booking-archive-create':return recreateBookingReceipt(id);
 case 'client-edit':return clientForm(id);
 case 'client-new':return clientForm();
 case 'booking-delete':{if(!requireWrite())return;const b=bookingFor(id);if(!b)return;return confirmAction('Vuoi davvero eliminare la prenotazione di '+b.cliente+'? L’operazione utilizza dg_delete_booking e potrebbe essere irreversibile. I pagamenti storici sono gestiti dalla procedura server.',async()=>{
  const response=await rpc('dg_delete_booking',{p_booking_id:id});if(response?.success===false)throw Error(response?.message||response?.error||'Eliminazione rifiutata');await sync();$('edit-dialog').close();render();notify('Prenotazione eliminata')})}
 case 'control-clear':state.selectedSeats.clear();return render();
 case 'control-seat':{
  const seat=el.dataset.seat;if(!/^\d+$/.test(seat||''))return;
  const tid=state.options.tripId;const book=bookingFor(state.options.bookingId);if(!book)return notify('Seleziona prima una prenotazione',true);
  const busy=occupied(tid,book.id);
  if(busy.has(seat))return notify('Posto occupato. Non è consentito sovrapporre prenotazioni.',true);
  if(state.selectedSeats.has(seat))state.selectedSeats.delete(seat);else state.selectedSeats.add(seat);
  return render();
 }
 case 'control-save':{
  if(!requireWrite())return;const b=bookingFor(state.options.bookingId),t=tripFor(state.options.tripId);
  if(!b||!t)return notify('Seleziona la prenotazione e il bus',true);
  const seats=[...state.selectedSeats].sort((a,b)=>Number(a)-Number(b));
  if(seats.length!==num(b.posti))return notify('Devono essere selezionati esattamente '+b.posti+' posti',true);
  const valid=new Set(layoutForTrip(t).rows.flat().filter(Number.isInteger).map(String));
  if(seats.some(x=>!valid.has(x)||Number(x)>num(t.posti_totali)))return notify('Seleziona soltanto i posti presenti nel bus e nella capienza del viaggio',true);
  if(seats.some(x=>occupied(t.id,b.id).has(x)))return notify('Almeno un posto è già assegnato a un altro cliente',true);
  const oldRoot=tripFor(b.viaggio_id)?.bis_parent_id||b.viaggio_id,newRoot=t.bis_parent_id||t.id;
  if(oldRoot!==newRoot)return notify('Non puoi trasferire una prenotazione a una destinazione diversa con questa funzione',true);
  return confirmAction('Confermare la nuova assegnazione per '+b.cliente+' ai posti '+seats.join(', ')+'? Saranno aggiornati anche il BUS BIS e i riferimenti dei pagamenti mediante RPC.',async()=>{
   await rpc('dg_manage_booking_seats_v1',{p_booking_id:b.id,p_target_trip_id:t.id,p_target_seats:seats});
   state.selectedSeats.clear();await sync();notify('Posti aggiornati')});
 }
 case 'checkin':{if(!requireWrite())return;const b=bookingFor(id);if(!b)return;const now=!b.checkin_effettuato;return confirmAction((now?'Registrare presenza':'Annullare check-in')+' per '+b.cliente+'?',async()=>{
  await apiUpdate('prenotazioni',id,{checkin_effettuato:now,checkin_stato:now?'Presente':'Da effettuare',checked_in_at:now?new Date().toISOString():null});
  await sync();notify('Check-in aggiornato')});}
 case 'departure-print':return printHtml('Elenco passeggeri e quote',printableDeparture(state.options.tripId));
 case 'layout-new':{
  const name=prompt('Nome del nuovo schema autobus','Nuova piantina');if(!name?.trim())return;state.layoutKey='nuovo-'+Date.now();state.layout=Model.fresh(name.trim());return render();}
 case 'edit-seat':{
  const r=Number(el.dataset.row),c=Number(el.dataset.col),old=state.layout.rows[r]?.[c];if(old===undefined)return;
  const value=prompt('Numero sedile oppure empty (vuoto), aisle (corridoio), door (porta):',String(old));if(value===null)return;
  const v=value.trim().toLowerCase(),cell=v===''?'empty':(['empty','aisle','door'].includes(v)?v:/^[1-9]\d{0,3}$/.test(v)?Number(v):null);
  if(cell===null)return notify('Valore non valido',true);
  const clone=Model.clone(state.layout);clone.rows[r][c]=cell;
  const error=Model.validate(clone);if(error&&error.includes('duplicato'))return notify(error,true);
  state.layout=clone;return render();}
 case 'layout-row-add':if(state.layout.rows.length>=100)return notify('Massimo 100 file',true);state.layout.rows.push(['empty','empty','aisle','empty','empty']);return render();
 case 'layout-row-remove':if(state.layout.rows.length<=1)return notify('Deve rimanere almeno una fila',true);if(!confirm('Eliminare l’ultima fila della bozza?'))return;state.layout.rows.pop();return render();
 case 'layout-copy':{state.layout=Model.clone(state.layout);state.layout.name+=' · copia';state.layoutKey='copia-'+Date.now();return saveLayout()}
 case 'layout-reset':{if(!confirm('Scartare le modifiche non salvate?'))return;state.layout=state.drafts[state.layoutKey]?Model.clone(state.drafts[state.layoutKey]):Model.fromLegacy(state.layoutKey);return render()}
 case 'layout-save':return saveLayout();
 case 'layout-export':return exportLayout();
 case 'layout-publish':return publishLayout();
 case 'cash-detail':state.options.cashTrip=id;return openCashDetail(id);
 case 'cash-print':return printHtml('Riepilogo contanti',printableCash());
 case 'cash-transfer':return transferForm();
 case 'cash-csv':{const r=getCash();return exportCSV([['Viaggio','Data','Nicola €','Raffaele €','Da attribuire €','Totale €'],...r.groups.map(g=>[g.trip.titolo,g.trip.data_partenza,(g.nicola/100).toFixed(2),(g.raffaele/100).toFixed(2),(g.nonAttribuiti/100).toFixed(2),(g.netto/100).toFixed(2)])],'DELGROSSO_CASSA');}
 case 'cash-trip-print':return printHtml('Contanti viaggio',printableCash(id||state.options.cashTrip));
 case 'cash-trip-download':return downloadTripPdf(id||state.options.cashTrip);
 case 'payment-new':return paymentForm();case 'payment-edit':return paymentForm(id);
 case 'payment-print':return viewOfficialPaymentReceipt(id);
 case 'payment-reissue':return viewOfficialPaymentReceipt(id,true);
 case 'go-control':state.page='control';return render();
 case 'go-agenda':state.page='agenda';return render();
 case 'comms-new':return messageForm();
 case 'comms-read':return markCommsRead(id);
 case 'fleet-maint-new':return maintenanceForm();
 case 'fleet-maint-edit':return maintenanceForm(id);
 case 'fleet-fuel-new':return fuelForm();
 case 'fleet-fuel-edit':return fuelForm(id);
 case 'fleet-block-new':return fleetBlockForm();
 case 'fleet-block-edit':return fleetBlockForm(id);
 case 'economy-new':return manualEconomyEntry();
 case 'economy-edit':return manualEconomyEntry(id);
 case 'pro-crm-new':return crmForm();
 case 'pro-crm-edit':return crmForm(id);
 case 'pro-anomaly-new':return anomalyForm();
 case 'pro-anomaly-edit':return anomalyForm(id);
 case 'pro-check-new':return checkForm();
 case 'pro-check-edit':return checkForm(id);
 case 'agenda-print':return printHtml('Agenda completa',`<h2>Agenda ${fmt(state.options.agendaMonth)}</h2>`+table(['Data','Impegno','Tipo','Dettagli'],agendaEvents().filter(x=>x.date.startsWith(state.options.agendaMonth)).map(x=>tr([date(x.date),fmt(x.title),fmt(x.kind),fmt(x.detail)]))));
 case 'agenda-day':return agendaForm('attivita','',el.dataset.date||'');
 case 'agenda-activity-new':return agendaForm('attivita');
 case 'agenda-deadline-new':return agendaForm('scadenza');
 case 'agenda-edit':return agendaForm(el.dataset.kind,id);
 case 'agenda-complete':return agendaToggle(el.dataset.kind,id,true);
 case 'agenda-reopen':return agendaToggle(el.dataset.kind,id,false);
 case 'agenda-delete':return agendaDelete(el.dataset.kind,id);
 case 'boarding-print':return printHtml('Passeggeri per paese',printableBoarding());
 case 'boarding-csv':return exportBoarding();
 case 'stats-csv':return exportCSV([['Viaggio','Data','Pax','Capienza'],...state.data.trips.map(t=>[t.titolo,t.data_partenza,bookingsCount(t.id),t.posti_totali])],'DELGROSSO_STATISTICHE');
 case 'economy-csv':return exportCSV([['Data','Tipo','Categoria','Descrizione','Importo','Viaggio','Origine'],...state.data.economy.map(x=>[x.data_movimento,x.tipo,x.categoria,x.descrizione,x.importo,tripFor(x.viaggio_id)?.titolo,x.origine])],'DELGROSSO_ECONOMIA');
 case 'fleet-new':return fleetForm();case 'fleet-edit':return fleetForm(id);
 case 'rental-new':return rentalForm();case 'rental-edit':return rentalForm(id);
 case 'quote-new':return quoteForm();case 'quote-edit':return quoteForm(id);case 'quote-print':return printHtml('Preventivo',printableQuote(id));
 case 'wa-open':return openWA(id);
 case 'wa-save':return saveWA(id);
 case 'wa-invite':return inviteWA(id);
 case 'refresh':return await sync();
 case 'dashboard-print':return printHtml('Riepilogo operativo',`<h2>Viaggi</h2>${table(['Viaggio','Data','Pax','Stato'],state.data.trips.map(t=>tr([fmt(t.titolo),date(t.data_partenza),bookingsCount(t.id),fmt(t.stato)])))}`);
 case 'trip-csv':return exportCSV([['Viaggio','Data','Ora','Pax','Capienza','Stato'],...state.data.trips.map(t=>[t.titolo,t.data_partenza,t.ora_partenza,bookingsCount(t.id),t.posti_totali,t.stato])],'DELGROSSO_VIAGGI');
 case 'booking-csv':return exportCSV([['Codice','Cliente','Viaggio','Posti','Fermata','Totale','Versato','Residuo','Stato'],...state.data.bookings.map(b=>[b.codice,b.cliente,tripFor(b.viaggio_id)?.titolo,b.posti_selezionati,b.fermata_partenza,b.totale,b.pagato,num(b.totale)-num(b.pagato),b.stato])],'DELGROSSO_PRENOTAZIONI');
 case 'payments-csv':return exportCSV([['Cliente','Importo','Metodo','Data','Operatore'],...state.data.payments.map(p=>[p.cliente,p.importo,p.metodo_pagamento||p.metodo,p.data_pagamento,p.incassato_da])],'DELGROSSO_PAGAMENTI');
 case 'rentals-csv':return exportCSV([['Cliente','Partenza','Destinazione','Data','Prezzo'],...state.data.rentals.map(r=>[r.referente||r.azienda,r.tratta_partenza,r.tratta_destinazione,r.data_partenza,r.prezzo_concordato])],'DELGROSSO_NOLEGGI');
 case 'quotes-csv':return exportCSV([['Nome','Destinazione','Importo','Stato'],...state.data.quotes.map(q=>[q.nome,q.destinazione,q.importo_preventivo,q.stato])],'DELGROSSO_PREVENTIVI');
 case 'clients-csv':return exportCSV([['Nome','Cognome','Telefono','Email'],...state.data.clients.map(c=>[c.nome,c.cognome,c.telefono,c.email])],'DELGROSSO_CLIENTI');
 default:notify('Comando non disponibile: '+action,true);
 }
}
function saveLayout(){state.layout.name=$('layout-name')?.value?.trim()||state.layout.name;const err=Model.validate(state.layout);if(err)return notify(err,true);
 state.layout.totalSeats=Model.count(state.layout);
 if(!state.drafts[state.layoutKey])state.layoutKey='bozza-'+Date.now();state.drafts[state.layoutKey]=Model.clone(state.layout);
 try{localStorage.setItem(DRAFT_KEY,JSON.stringify(state.drafts))}catch(e){return notify('Spazio locale esaurito. Esporta il JSON.',true)}render();notify('Piantina salvata come bozza in questo browser. Esportala per sicurezza.')}
function publishLayout(){
 if(!requireWrite())return;
 if(state.mode==='live'&&state.failedTables.some(x=>x.startsWith('dg2_piantine:')))return notify('La tabella dg2_piantine non è installata. Usa prima lo script di migrazione fornito nello ZIP, dopo backup verificato.',true);
 const buses=state.data.fleet.map(b=>[b.id,(b.marca||'')+' '+(b.modello||'')]);
 openForm('Assegna piantina a un autobus (solo V2)',`${fieldSelect('bus','Autobus',[['','— Seleziona autobus —'],...buses],'')}<p class="hint">I modelli originali nel vecchio gestionale e nel sito non vengono cambiati. L’assegnazione è memorizzata in una nuova tabella V2 soltanto dopo avere installato la migrazione facoltativa.</p>`,async f=>{
 const err=Model.validate(state.layout);if(err)throw Error(err);const vehicle=val(f,'bus');if(!vehicle)throw Error('Seleziona un autobus');const row={flotta_id:vehicle,nome:state.layout.name,configurazione:{...state.layout,totalSeats:Model.count(state.layout)},attivo:true};
 await apiUpsert('dg2_piantine',row);
 });
}
function transferForm(){
 const ops=state.data.operators.filter(o=>o.attivo!==false),from=ops.find(o=>o.user_id===state.userId)||ops[0];
 openForm('Trasferimento contanti tra operatori',`<div class="helpbox">Registrazione di uno spostamento di denaro contante: non crea un nuovo incasso per il viaggio.</div><div class="formgrid">${fieldSelect('a','Destinatario',ops.filter(o=>o.user_id!==from?.user_id).map(o=>[o.user_id,o.nome||o.username]),'')}${field('amount','Importo (€)',0,'number',true,'min="0.01" step="0.01"')}</div>${field('note','Note','')}`,async f=>{
 const to=val(f,'a'),amount=Number(val(f,'amount')),note=val(f,'note');if(amount<=0||!to||to===from?.user_id)throw Error('Importo o destinatario non valido');
 await rpc('dg_transfer_cash',{p_to_user_id:to,p_amount:amount,p_note:note});
 });
}
function exportLayout(){const name=$('layout-name')?.value?.trim();if(name)state.layout.name=name;const err=Model.validate(state.layout);if(err)return notify(err,true);const blob=new Blob([JSON.stringify({...state.layout,totalSeats:Model.count(state.layout)},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='DELGROSSO_'+state.layout.name.replace(/[^a-z0-9]+/gi,'-')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),3000);notify('JSON esportato')}
async function importLayout(file){if(!file)return;try{if(file.size>200000)throw Error('File troppo grande');const obj=JSON.parse(await file.text());const err=Model.validate(obj);if(err)throw Error(err);state.layout=Model.clone(obj);state.layoutKey='import-'+Date.now();const name=$('layout-name');if(name)name.value=obj.name;saveLayout();}catch(e){notify('Impossibile importare la piantina: '+e.message,true)}}
function openCashDetail(id){$('edit-dialog').classList.remove('wide');const r=getCash(),g=r.groups.find(x=>x.id===id);if(!g)return notify('Viaggio non trovato',true);
 $('edit-title').textContent='Cassa · '+g.trip.titolo;$('edit-body').innerHTML=`<div class="three-col"><div class="helpbox">Nicola<br><b>${Cash.euro(g.nicola)}</b></div><div class="helpbox">Raffaele<br><b>${Cash.euro(g.raffaele)}</b></div><div class="helpbox">Totale viaggio<br><b>${Cash.euro(g.netto)}</b></div></div><div class="separator"></div>${table(['Data','Cliente','Tipo','Operatore','Importo'],g.movements.map(m=>tr([date(m.date),fmt(m.cliente),fmt(m.tipo),fmt(m.owner),Cash.euro(m.amount)])))}<div class="actions" style="margin-top:15px">${btn('Scarica PDF quote','cash-trip-download','primary',`data-id="${esc(id)}"`)}${btn('Stampa dettaglio','cash-trip-print','outline',`data-id="${esc(id)}"`)}</div>`;$('edit-dialog').showModal();}
function openWA(id){const t=tripFor(id),url=state.data.groupInvites.find(x=>x.trip_id===id)?.invite_url||'';if(!t)return;
 const bs=tripBookings(id);const rows=bs.map(b=>tr([fmt(b.cliente),fmt(b.telefono),consented(b.id,id)?'<span class="tag green">Consenso valido</span>':'<span class="tag red">Manca consenso</span>'],consented(b.id,id)&&url?btn('Prepara invito','wa-invite','small',`data-id="${esc(b.id)}" data-trip="${esc(id)}"`):'<span class="subtle">Non invitabile</span>'));
 $('edit-title').textContent='WhatsApp · '+t.titolo;
 $('edit-body').innerHTML=`<label>Link invito gruppo (specifico per BUS)<input id="wa-link" type="url" value="${esc(url)}" placeholder="https://chat.whatsapp.com/..."></label><div class="actions" style="margin:12px 0">${btn('Salva link gruppo','wa-save','primary',`data-id="${esc(id)}"`)}</div><div class="helpbox">Il sistema non aggiunge automaticamente i numeri ai gruppi. Prepara un messaggio solo per le prenotazioni che dispongono del consenso specifico registrato.</div>${table(['Referente','Telefono','Consenso',''],rows)}`;
 $('edit-dialog').showModal();}
async function saveWA(id){if(!requireWrite())return;const url=$('wa-link').value.trim();if(url&&!/^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{15,}(?:\?.*)?$/.test(url))return notify('Link gruppo WhatsApp non valido',true);
 try{await apiUpsert('dg_whatsapp_trip_invites_v61',{trip_id:id,invite_url:url,updated_by:state.userId});await sync();openWA(id);notify('Link gruppo salvato')}catch(e){notify('Link non salvato: '+e.message,true)}}
function inviteWA(id){const b=bookingFor(id),t=tripFor(b?.viaggio_id);const url=state.data.groupInvites.find(i=>i.trip_id===b?.viaggio_id)?.invite_url;
 if(!b||!t||!consented(b.id,t.id)||!url)return notify('Invito impedito: link e consenso specifico obbligatori',true);
 const phone=String(b.telefono||'').replace(/\D/g,'');if(phone.length<9)return notify('Telefono non valido',true);
 const text=`Buongiorno ${b.cliente}, per il viaggio DELGROSSO VIAGGI ${t.titolo} del ${date(t.data_partenza)}, ecco il link del gruppo WhatsApp: ${url}. L’adesione è volontaria.`;
 window.open('https://wa.me/'+(phone.startsWith('39')?phone:'39'+phone)+'?text='+encodeURIComponent(text),'_blank','noopener');}
async function init(){
 $('auth-form').addEventListener('submit',login);
 $('auth-show-password').addEventListener('click',()=>{
  const x=$('auth-password'),btn=$('auth-show-password');
  const visible=x.type==='text';x.type=visible?'password':'text';
  btn.textContent=visible?'Mostra':'Nascondi';btn.setAttribute('aria-pressed',String(!visible));
  btn.setAttribute('aria-label',visible?'Mostra password':'Nascondi password');
 });
 $('auth-email').addEventListener('input',()=>{$('auth-error').hidden=true});
 $('auth-password').addEventListener('input',()=>{$('auth-error').hidden=true});
 // Remove legacy local email mappings left by previous prototype versions.
 try{localStorage.removeItem('dg2_verified_operator_emails_v1')}catch{}
 $('btn-login').addEventListener('click',()=>$('auth-dialog').showModal());
 $('auth-close').addEventListener('click',()=>$('auth-dialog').close());
 $('edit-close').addEventListener('click',()=>{$('edit-dialog').close();state.bookingDraft=null});
 $('btn-logout').addEventListener('click',logout);
 $('btn-refresh').addEventListener('click',()=>handleAction('refresh',{}).catch(e=>notify(e.message,true)));
 document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>{state.page=b.dataset.page;state.options.search='';if(state.page==='control')state.selectedSeats.clear();$('edit-dialog').close();render();window.scrollTo(0,0)}));
 // Propose actual fleet capacity when changing bus, not the legacy 53-seat default.
 $('edit-dialog').addEventListener('change',e=>{
  if(e.target.form?.id==='edit-form' && ['trip','booking'].includes(e.target.name) && e.target.form.elements.namedItem('client_search')){
    updatePaymentBookingList(e.target.form);return;
  }
  if(e.target.name==='viaggio_id'&&state.bookingDraft){const d=state.bookingDraft;d.selected.clear();d.tripId=e.target.value;updateBookingSeatPanel();refreshBookingTripSeats(e.target.value).then(updateBookingSeatPanel).catch(x=>notify('Piantina non aggiornata: '+x.message,true));return;}
  if(e.target.name==='posti'&&state.bookingDraft){updateBookingSeatPanel();return;}
  if(e.target.name!=='autobus_id')return;
  const f=e.target.form,cap=f?.elements?.namedItem('posti_totali'),bus=busFor(e.target.value);
  if(!cap||!bus||num(bus.posti)<1)return;
  const reserved=state.modalTripId?bookingsCount(state.modalTripId):0;
  if(num(bus.posti)<reserved)return notify('Questo bus ha meno posti dei '+reserved+' passeggeri già prenotati',true);
  cap.value=String(bus.posti);
  notify('Capienza aggiornata automaticamente: '+bus.posti+' posti ('+(bus.seat_layout||'piantina flotta')+')');
 });
 $('edit-dialog').addEventListener('input',e=>{
  if(e.target.name==='client_search'&&e.target.form?.elements.namedItem('trip')){updatePaymentBookingList(e.target.form);return;}
  const d=state.bookingDraft;if(!d)return;if(e.target.name==='posti'){updateBookingSeatPanel();if(!d.totalEdited){const t=tripFor(d.tripId);const form=$('edit-form'),total=form?.elements?.namedItem('totale');if(total&&t)total.value=String(Math.round((num(t.prezzo)*d.people)*100)/100)}}if(e.target.name==='totale')d.totalEdited=true;});
 $('edit-dialog').addEventListener('submit',e=>{if(e.target.id==='edit-form'){e.preventDefault();const fn=state.modalSubmit;if(typeof fn==='function')doWrite(()=>fn(e.target))}});
 $('edit-dialog').addEventListener('click',e=>{if(e.target.closest('#edit-cancel')){$('edit-dialog').close();state.bookingDraft=null}});
 $('content').addEventListener('click',e=>{const el=e.target.closest('[data-action]');if(!el)return;Promise.resolve(handleAction(el.dataset.action,el)).catch(x=>notify(x.message,true))});
 $('edit-body').addEventListener('click',e=>{const el=e.target.closest('[data-action]');if(!el)return;Promise.resolve(handleAction(el.dataset.action,el)).catch(x=>notify(x.message,true))});
 $('content').addEventListener('change',e=>{
  if(e.target.id==='control-trip'||e.target.id==='control-bus'){state.options.tripId=e.target.value;state.options.bookingId='';state.selectedSeats.clear();render()}
  if(e.target.id==='control-booking'){state.options.bookingId=e.target.value;state.selectedSeats.clear();render()}
  if(e.target.id==='layout-select'){state.layoutKey=e.target.value;state.layout=Model.clone(state.drafts[state.layoutKey]||Model.legacy[state.layoutKey]);render()}
  if(e.target.id==='layout-file'){importLayout(e.target.files?.[0]);e.target.value=''}
  if(e.target.id==='agenda-month'){state.options.agendaMonth=e.target.value;render()}
  if(e.target.id==='agenda-kind'){state.options.agendaFilter=e.target.value;render()}
  if(e.target.id==='agenda-status'){state.options.agendaStatus=e.target.value;render()}
  if(e.target.id==='boarding-trip'){state.options.boardingTripId=e.target.value;render()}
  if(e.target.id==='trip-view'){state.options.tripView=e.target.value;render()}
 });
 $('content').addEventListener('input',e=>{
  if(e.target.id==='agenda-search'){
   const cursor=e.target.selectionStart;state.options.agendaSearch=e.target.value;render();const el=$('agenda-search');if(el){el.focus();el.setSelectionRange(cursor,cursor)}return;
  }
  if(e.target.dataset.filter==='search'){
   const p=e.target.selectionStart;state.options.search=e.target.value;render();
   const x=$('content').querySelector('[data-filter="search"]');if(x){x.focus();try{x.setSelectionRange(p,p)}catch{}}
  }
  if(e.target.id==='layout-name')state.layout.name=e.target.value;
 });
 window.addEventListener('beforeunload',()=>{state.token='';state.refreshToken=''});
 updateMode();render();
 const restored=await restoreSession();if(restored){updateMode();await sync()}else if(!$('auth-dialog').open)$('auth-dialog').showModal();
 setInterval(pollNewBookings,90000);
 const startupCheck=document.getElementById('startup-check');
 if(startupCheck)startupCheck.hidden=true;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
