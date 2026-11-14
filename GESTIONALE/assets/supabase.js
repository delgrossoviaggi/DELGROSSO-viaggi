/* DELGROSSO Premium WEB - Browser-only, no Python/server, no service-role.
 * Secret credentials and session tokens are never written to persistent storage.
 * All access is subject to Supabase Auth and existing database RLS rules.
 */
(function(global){
'use strict';
const PROJECT='chkuayhbmitdmzmmvona';
const URL=`https://${PROJECT}.supabase.co`;
const KEY='sb_publishable_H29K1BV5ZE1rT8xo0PIzVA_wF6zC7je'; // PUBLIC key, not a secret
const FIELDS={
 trips:['viaggi','id,titolo,destinazione,descrizione,luogo_partenza,data_partenza,ora_partenza,prezzo,stato,posti_totali,posti_occupati,posti_liberi,autobus,autobus_id,minimo_partecipanti,bis_numero,bis_parent_id,archiviato_at,pubblicato,sold_out_manual'],
 bookings:['prenotazioni','id,viaggio_id,cliente,cliente_nome,posti,posti_selezionati,stato,totale,pagato,acconto,saldo,fermata_partenza,checkin_effettuato,created_at,telefono,email,note,giorni_acconto,confirmation_storage_path'],
 seatrows:['prenotazione_posti','viaggio_id,prenotazione_id,posto'],
 fleet:['flotta','id,titolo,marca,modello,categoria,posti,stato,foto_gallery,attivo,seat_layout,targa'],
 customers:['clienti','id,nome,cognome,telefono,email,created_at,codice_cliente,stato_cliente'],
 payments:['pagamenti','id,viaggio_id,prenotazione_id,importo,tipo,stato,incassato_da,incassato_da_user_id,metodo,metodo_pagamento,created_at,data_pagamento,receipt_number,receipt_storage_path'],
 notifications:['notifiche','id,titolo,messaggio,tipo,letto,created_at'],
 rentals:['noleggi_bus','id,id_noleggio,referente,azienda,telefono,email,tratta_partenza,tratta_destinazione,fermate,data_partenza,ora_partenza,data_ritorno,ora_ritorno,passeggeri,servizio_tipo,prezzo_concordato,acconto,saldo,stato_pagamento,stato_noleggio,flotta_id,note,archiviato_at'],
 deadlines:['scadenze_gestionale','id,titolo,descrizione,tipo,stato,priorita,data_scadenza,importo,note,completata_at'],
 quotes:['preventivi','id,numero_preventivo,nome,cognome,telefono,email,azienda,servizio,servizio_richiesto,data_viaggio,data_partenza,data_ritorno,luogo_partenza,destinazione,numero_passeggeri,importo,importo_preventivo,stato,validita_preventivo,note_interne,condizioni_offerta,created_at'],
 receiptarchive:['dg_receipt_archive','kind,id,reference_id,receipt_number,tipo,importo,data_pagamento,cliente,servizio,metodo,operatore,legacy_path,professional_path,created_at'],
 documents:['documenti_gestionali','id,categoria,titolo,descrizione,storage_bucket,storage_path,mime_type,dimensione,created_at,viaggio_id,cliente_id,noleggio_id,scadenza,note'],
 transfers:['cassa_trasferimenti','id,da_operatore_user_id,a_operatore_user_id,importo,data_trasferimento,stato,note'],
 cashoperators:['dg_cassa_operatori','user_id,username,nome,cassa_netto,contanti_netto,viaggi_incassati,noleggi_incassati,trasferimenti_uscita,trasferimenti_entrata'],
 layouts:['dg2_layout_library','id,nome,configurazione,attivo,created_at,updated_at,updated_by'],
 invoices:['dg3_fatture_bozze','id,tipo_documento,stato,data_bozza,prenotazione_id,noleggio_id,emittente,destinatario,righe,aliquota_iva,natura_iva,imponibile_centesimi,iva_centesimi,totale_centesimi,note_interne,created_by,created_at'],
 waInbox:['dg_whatsapp_inbox_v61','id,sender_phone,sender_name,message_text,intent,status,booking_id,trip_id,received_at'],
 waOptins:['dg_whatsapp_optins_v61','phone,customer_name,consent_source,consent_at,revoked_at'],
 waInvites:['dg_whatsapp_trip_invites_v61','trip_id,invite_url,updated_at'],
 waOutbound:['dg_whatsapp_outbound_v62','id,booking_id,recipient_phone,status,template_kind,created_at,last_error'],
 notificationReads:['dg_notification_reads','notification_id,operator_user_id,read_at'],
 rentalPayments:['noleggi_bus_pagamenti','id,noleggio_id,tipo,importo,data_pagamento,metodo,incassato_da,receipt_number'],
 drivers:['dg3_autisti','id,nome,cognome,telefono,email,stato,patente_scadenza,cqc_scadenza,note,created_at,archiviato_at'],
 waManual:['dg3_wa_manual_logs','id,cliente_id,telefono,oggetto,messaggio,stato,operatore_id,created_at,updated_at'],
 anomalyCases:['dg3_anomalie_verifiche','id,chiave,tipo,riferimento_id,note,stato,created_by,updated_at'],
 appSettings:['dg3_impostazioni','chiave,valore,updated_at'],
 rentalVehicles:['noleggi_bus_mezzi','id,noleggio_id,flotta_id'],
 cashCorrections:['dg3_richieste_rettifica_cassa','id,trasferimento_id,motivo,stato,created_by,created_at'],
 cashClosures:['cassa_chiusure','id,data_chiusura,operatore_user_id,operatore,saldo_teorico,contanti_contati,differenza,note,created_at'],
 suppliers:['fornitori','id,ragione_sociale,categoria,referente,telefono,email,partita_iva,codice_fiscale,indirizzo,citta,note,attivo,created_at'],
 economy:['economia_movimenti','id,tipo,categoria,descrizione,importo,data_movimento,metodo,viaggio_id,fornitore_id,origine,riferimento,operatore_user_id,operatore,created_at'],
 tripCosts:['dg11_costi_viaggio','id,viaggio_id,fornitore_id,categoria,descrizione,importo_previsto,stato,metodo,data_costo,numero_documento,note,movimento_id,created_at'],
 operators:['operatori_gestionale','user_id,username,nome,attivo']
};
let token='',refreshToken='',expiresAt=0,actor=null, pendingRefresh=null;
let sessionEpoch=0,lastDataOk=0,lastDataError=0,lastErrorSummary='',lastRowReads={};
let realtimeSocket=null,realtimeHeartbeat=null,realtimeReconnect=null,realtimeEnabled=false,realtimeRetries=0,realtimeRef=0,realtimeStatus='disconnesso';
const REALTIME_TOPIC='realtime:delgrosso_operator_updates';
function headers(auth=true){const h={'apikey':KEY,'Accept':'application/json'};if(auth&&token)h.Authorization=`Bearer ${token}`;return h;}
function recordOk(key){lastDataOk=Date.now();if(key)lastRowReads[key]=lastDataOk;lastErrorSummary='';}
function recordError(message){lastDataError=Date.now();lastErrorSummary=String(message||'Errore').slice(0,240);}
function parseError(code,body){const message=(typeof body?.message==='string'&&body.message)||(typeof body?.error_description==='string'&&body.error_description)||(typeof body?.error==='string'&&body.error)||(typeof body?.hint==='string'&&body.hint)||'Operazione non riuscita'; const e=new Error(message);e.status=code;return e;}
async function req(path,{method='GET',data,auth=true,skipRefresh=false}={}){
 if(auth&&!token)throw new Error('Accedi con un operatore Supabase autorizzato');
 if(auth&&!skipRefresh)await ensureSession();
 const init={method,headers:headers(auth),cache:'no-store',mode:'cors',referrerPolicy:'no-referrer'};
 if(data!==undefined){init.headers['Content-Type']='application/json';init.body=JSON.stringify(data);}
 let r;try{r=await fetch(URL+path,init)}catch(e){recordError(e.message);throw new Error('La connessione a Supabase è stata bloccata o non è raggiungibile. Verifica che il gestionale sia aperto tramite AVVIA_GESTIONALE_WINDOWS.bat, poi riprova senza estensioni che filtrano le richieste.');}
 const raw=await r.text();let body;try{body=raw?JSON.parse(raw):null}catch{body=raw;}
 if(!r.ok){const err=parseError(r.status,body);recordError(err.message);throw err;}
 if(auth)recordOk();
 return body;
}
async function ensureSession(){if(Date.now()<expiresAt-100000)return;if(!refreshToken)throw new Error('Sessione scaduta. Accedi nuovamente.');
 if(pendingRefresh)return pendingRefresh;
 pendingRefresh=(async()=>{const result=await req('/auth/v1/token?grant_type=refresh_token',{method:'POST',data:{refresh_token:refreshToken},auth:false,skipRefresh:true});
  if(!result?.access_token)throw new Error('Aggiornamento della sessione non riuscito');
  token=result.access_token;refreshToken=result.refresh_token||refreshToken;expiresAt=Date.now()+1000*(result.expires_in||3600);
  realtimeSend('access_token',REALTIME_TOPIC,{access_token:token});
  // Re-verify privilege after refresh: operator can be revoked at any time.
  const allowed=await req('/rest/v1/rpc/is_gestionale_admin',{skipRefresh:true});
  if(allowed!==true){clear();throw new Error('Permessi operatore revocati o sessione non attiva');}
 })().finally(()=>{pendingRefresh=null});return pendingRefresh;
}
function clear(){sessionEpoch++;stopRealtime();token='';refreshToken='';expiresAt=0;actor=null;lastRowReads={};}
function realtimeSend(event,topic,payload){
 if(realtimeSocket?.readyState!==1)return false;
 realtimeSocket.send(JSON.stringify({topic,event,payload,ref:String(++realtimeRef),join_ref:topic===REALTIME_TOPIC?'1':null}));
 return true;
}
function realtimeBroadcastStatus(state){
 realtimeStatus=state;
 global.dispatchEvent?.(new CustomEvent('dg24:realtime-status',{detail:{state}}));
}
function stopRealtime(){
 realtimeEnabled=false;
 if(realtimeReconnect){clearTimeout(realtimeReconnect);realtimeReconnect=null;}
 if(realtimeHeartbeat){clearInterval(realtimeHeartbeat);realtimeHeartbeat=null;}
 if(realtimeSocket){const old=realtimeSocket;realtimeSocket=null;try{old.onclose=old.onerror=old.onmessage=old.onopen=null;old.close(1000,'Logout');}catch{}}
 realtimeBroadcastStatus('disconnesso');
}
function startRealtime(){
 if(!token||!actor||typeof WebSocket==='undefined')return false;
 if(realtimeEnabled&&realtimeSocket&&[0,1].includes(realtimeSocket.readyState))return true;
 realtimeEnabled=true;
 const connect=()=>{
  if(!realtimeEnabled||!token)return;
  let ws;
  try{ws=new WebSocket(`wss://${PROJECT}.supabase.co/realtime/v1/websocket?apikey=${encodeURIComponent(KEY)}&vsn=1.0.0`)}
  catch{realtimeBroadcastStatus('riconnessione');return scheduleReconnect();}
  realtimeSocket=ws;
  realtimeBroadcastStatus('connessione');
  ws.onopen=()=>{
   if(ws!==realtimeSocket)return;
   // Il JWT individuale resta nel payload autorizzato, non nel link pubblico.
   realtimeSend('phx_join',REALTIME_TOPIC,{config:{private:false,broadcast:{ack:false,self:false},presence:{enabled:false},postgres_changes:[
    {event:'INSERT',schema:'public',table:'prenotazioni'},
    {event:'UPDATE',schema:'public',table:'prenotazioni'},
    {event:'INSERT',schema:'public',table:'notifiche'},
    {event:'UPDATE',schema:'public',table:'notifiche'}
   ]},access_token:token});
   if(realtimeHeartbeat)clearInterval(realtimeHeartbeat);
   realtimeHeartbeat=setInterval(()=>{if(ws===realtimeSocket&&ws.readyState===1){
     realtimeSend('heartbeat','phoenix',{});
     // Refresh via Supabase Auth on normal cadence, then notify Realtime of new JWT.
     ensureSession().catch(()=>{realtimeBroadcastStatus('sessione_scaduta');});
   }},20000);
  };
  ws.onmessage=event=>{
   let data;try{data=JSON.parse(event.data)}catch{return;}
   if(ws!==realtimeSocket)return;
   if(data.event==='phx_reply'&&data.topic===REALTIME_TOPIC){
    if(data.payload?.status==='ok'){realtimeRetries=0;realtimeBroadcastStatus('connesso');}
    else {realtimeBroadcastStatus('riconnessione');try{ws.close()}catch{}}
   }
   if(data.event==='postgres_changes'){
    const table=data.payload?.data?.table;
    const action=data.payload?.data?.type;
    if(['prenotazioni','notifiche'].includes(table)&&['INSERT','UPDATE','DELETE'].includes(action)){
      // Nessun record personale viene esportato: il client rilegge da REST con RLS.
      global.dispatchEvent?.(new CustomEvent('dg24:realtime-change',{detail:{table,action}}));
    }
   }
   if(['phx_error','phx_close'].includes(data.event)){realtimeBroadcastStatus('riconnessione');try{ws.close()}catch{}}
  };
  ws.onerror=()=>{if(ws===realtimeSocket)realtimeBroadcastStatus('riconnessione');};
  ws.onclose=()=>{
   if(ws!==realtimeSocket)return;
   realtimeSocket=null;
   if(realtimeHeartbeat){clearInterval(realtimeHeartbeat);realtimeHeartbeat=null;}
   realtimeBroadcastStatus('riconnessione');
   if(realtimeEnabled)scheduleReconnect();
  };
 };
 const scheduleReconnect=()=>{
  if(!realtimeEnabled||realtimeReconnect)return;
  const delays=[1200,2500,5000,10000,15000];
  const delay=delays[Math.min(realtimeRetries++,delays.length-1)];
  realtimeReconnect=setTimeout(()=>{realtimeReconnect=null;connect()},delay);
 };
 connect();return true;
}

function signalMutation(){if(global.dispatchEvent)global.dispatchEvent(new Event('dg3:mutazione-confermata'));}
/** Accesso con username: funzione Edge già presente sul Supabase gestionale.
 * Nessuna email privata e nessuna password hardcoded nel frontend.
 * Il backend verifica l'operatore, autentica su Supabase Auth e restituisce JWT individuale.
 * Disponibile da HTTPS aziendale o localhost; file:// è rifiutato dalla protezione CORS.
 */
async function signInOperator(username,password){
 clear();const operator=String(username||'').trim().toLowerCase();
 if(!['nicola','raffaele'].includes(operator))throw new Error('Seleziona Nicola oppure Raffaele');
 if(typeof password!=='string'||!password)throw new Error('Inserisci la password del profilo');
 if(global.location?.protocol==='file:')throw new Error('Per accedere a Supabase avvia AVVIA_GESTIONALE_WINDOWS.bat. Il file HTML aperto direttamente permette solo la demo.');
 const response=await req('/functions/v1/dg2-operator-login',{
  method:'POST',auth:false,skipRefresh:true,data:{username:operator,password}
 });
 token=response?.access_token||'';
 refreshToken=response?.refresh_token||'';
 expiresAt=Date.now()+1000*(response?.expires_in||3600);
 if(!token||!refreshToken){clear();throw new Error('Sessione Supabase non disponibile');}
 try{
  const user=await req('/auth/v1/user',{skipRefresh:true});
  if(!user?.id||response?.user?.id!==user.id)throw new Error('Identità Supabase non verificabile');
  const allowed=await req('/rest/v1/rpc/is_gestionale_admin',{skipRefresh:true});
  if(allowed!==true)throw new Error('Operatore non attivo o non autorizzato in Supabase');
  const resolved=String(response?.operator||'').trim().toLowerCase();
  if(resolved!==operator)throw new Error('Profilo operatore non corrispondente');
  actor={id:user.id,name:operator==='nicola'?'Nicola':'Raffaele',username:operator};
  return {display_name:actor.name,authorized:true};
 }catch(e){clear();throw e;}
}
async function changeOwnPassword(newPassword){
 if(!actor?.id || !token)throw new Error('Accedi come operatore prima di cambiare password');
 if(typeof newPassword!=='string'||newPassword.length<12)throw new Error('Usa almeno 12 caratteri per la nuova password');
 const account=await req('/auth/v1/user',{method:'PUT',data:{password:newPassword}});
 if(!account?.id || account.id!==actor.id)throw new Error('Supabase non ha confermato la modifica della password');
 return true;
}
async function signOut(){
 // Disconnessione locale IMMEDIATA. Evita la corsa fra un vecchio logout
 // asincrono e il login di un altro operatore nella stessa finestra.
 const oldToken=token;clear();
 if(oldToken){try{await fetch(URL+'/auth/v1/logout',{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+oldToken},cache:'no-store',referrerPolicy:'no-referrer'});}catch{}}
}
async function rows(key,params={}){
 const entry=FIELDS[key];if(!entry)throw new Error('Tabella non autorizzata dal client');
 const [table,select]=entry;const size=500,max=20000;const all=[];const epoch=sessionEpoch;
 for(let offset=0;offset<max;offset+=size){const query=new URLSearchParams({select,limit:String(size),offset:String(offset),...params});
  const batch=await req(`/rest/v1/${table}?${query}`);if(epoch!==sessionEpoch)throw new Error('Sessione cambiata durante la lettura: ripeti l’accesso');
  if(!Array.isArray(batch))throw new Error('Formato record Supabase inatteso');
  all.push(...batch);if(batch.length<size){recordOk(key);return all;}
 }
 throw new Error('Troppe righe per una consultazione completa: usare filtri/paginazione');
}
/** Diagnostica in lettura reale: una SELECT autenticata, senza esportare dati personali.
 * Importante: lettura riuscita NON implica scrittura collaudata o visibilità completa (RLS).
 */
async function probe(key){
 const entry=FIELDS[key];if(!entry)throw Error('Modulo diagnostico non previsto');
 const field=entry[1].split(',')[0];
 const qp=new URLSearchParams({select:field,limit:'1'});
 const result=await req('/rest/v1/'+entry[0]+'?'+qp);
 if(!Array.isArray(result))throw Error('Risposta del servizio non valida');
 recordOk(key);
 return {key,table:entry[0],accessible:true,realSelectVerified:true,hasVisibleRow:result.length>0};
}
async function verifyCurrentOperator(){
 if(!actor?.id||!token)throw Error('Nessun operatore autenticato');
 const [user,allowed]=await Promise.all([
  req('/auth/v1/user'),req('/rest/v1/rpc/is_gestionale_admin',{method:'POST',data:{}})
 ]);
 if(!user?.id||user.id!==actor.id||allowed!==true){clear();throw Error('Identità o autorizzazioni Supabase non valide');}
 return {ok:true,operator:actor.username};
}
function health(){return Object.freeze({configured:true,authenticated:!!token&&!!actor,operator:actor?.username||null,
 realtimeStatus,lastDataOk,lastDataError,lastErrorSummary,readChecks:{...lastRowReads},
 warning:'Lettura e connessione non equivalgono a verifica delle scritture o dei pagamenti.'});}
async function rpc(name,params){const allowed=['dg2_save_booking_guarded_v1','dg_register_payment','dg_manage_booking_seats_v1','dg3_preview_spostamento_data_v1','dg3_sposta_prenotazione_data_v1','dg_save_rental_v15','dg_archive_rental_v57','dg_archive_trip_v56','dg_register_rental_payment','dg_transfer_cash','dg11_anteprima_cassa_v1','dg11_chiudi_cassa_v1','dg11_incasso_extra_v1','dg11_salva_costo_viaggio_v1','dg3_diagnostica_backend_v1','dg3_archived_trip_check_v1','dg3_delete_archived_trip_v1','dg3_disponibilita_autobus_viaggio_v1','dg3_aggiorna_viaggio_autobus_stato_v1'];
 if(!allowed.includes(name))throw new Error('Operazione RPC non prevista');
 const result=await req(`/rest/v1/rpc/${name}`,{method:'POST',data:params});
 if(!['dg3_preview_spostamento_data_v1','dg11_anteprima_cassa_v1','dg3_archived_trip_check_v1','dg3_disponibilita_autobus_viaggio_v1','dg3_diagnostica_backend_v1'].includes(name) && result?.success!==false)signalMutation();
 return result;}
async function insert(table,fields){const allowed=['clienti','viaggi','dg2_layout_library','noleggi_bus','scadenze_gestionale','preventivi','dg3_fatture_bozze','documenti_gestionali','notifiche','dg3_autisti','dg3_wa_manual_logs','dg3_anomalie_verifiche','dg3_impostazioni','dg3_richieste_rettifica_cassa','dg_notification_reads','fornitori','flotta'];
 if(!allowed.includes(table))throw new Error('Scrittura non autorizzata dal client');
 await ensureSession();const h=headers();h.Prefer='return=representation';h['Content-Type']='application/json';
 let r;try{r=await fetch(`${URL}/rest/v1/${table}`,{method:'POST',headers:h,body:JSON.stringify(fields),referrerPolicy:'no-referrer'})}catch{throw new Error('Connessione non riuscita');}
 const raw=await r.text();let body;try{body=JSON.parse(raw)}catch{body=null};if(!r.ok)throw parseError(r.status,body);
 if(!Array.isArray(body)||!body.length)throw new Error('Salvataggio non confermato dal database');signalMutation();return body[0];
}
async function update(table,id,fields){const allowed=['clienti','viaggi','dg2_layout_library','noleggi_bus','scadenze_gestionale','preventivi','prenotazioni','dg3_fatture_bozze','documenti_gestionali','notifiche','dg_whatsapp_inbox_v61','dg3_autisti','dg3_wa_manual_logs','dg3_anomalie_verifiche','fornitori'];
 if(!allowed.includes(table))throw new Error('Modifica non autorizzata dal client');
 await ensureSession();const h=headers();h.Prefer='return=representation';h['Content-Type']='application/json';
 const url=`${URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`;
 let r;try{r=await fetch(url,{method:'PATCH',headers:h,body:JSON.stringify(fields),referrerPolicy:'no-referrer'})}catch{throw new Error('Connessione non riuscita');}
 const raw=await r.text();let body;try{body=JSON.parse(raw)}catch{body=null};if(!r.ok)throw parseError(r.status,body);
 if(!Array.isArray(body)||!body.length)throw new Error('La modifica non risulta confermata (permessi insufficienti?)');signalMutation();return body[0];
}

/** Metodi riservati all'operatore, con tabella e filtri hardcoded. */
const UPSERT_ALLOW={
 dg_whatsapp_optins_v61:'phone',
 dg_whatsapp_trip_invites_v61:'trip_id',
 dg3_impostazioni:'chiave',
 dg3_anomalie_verifiche:'chiave'
};
async function upsertKnown(table,record){
 if(!Object.prototype.hasOwnProperty.call(UPSERT_ALLOW,table))throw Error('Tabella upsert non autorizzata');
 await ensureSession();const query=new URLSearchParams({on_conflict:UPSERT_ALLOW[table]});
 const h={...headers(),'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=representation'};
 const response=await fetch(`${URL}/rest/v1/${table}?${query}`,{method:'POST',headers:h,body:JSON.stringify(record),cache:'no-store',referrerPolicy:'no-referrer'});
 let body=null;try{body=await response.json()}catch{}
 if(!response.ok)throw parseError(response.status,body);
 if(!Array.isArray(body)||!body.length)throw Error('Scrittura non confermata: verificare permessi Supabase');
 signalMutation();return body[0];
}
async function uploadPrivateFile(file,category='Altro'){
 if(!file||!['application/pdf','image/jpeg','image/png'].includes(file.type))throw Error('Carica PDF, JPG o PNG');
 if(file.size<=0||file.size>12*1024*1024)throw Error('Limite 12 MB per allegato');
 await ensureSession();
 const safeName=String(file.name||'documento').normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g,'_').slice(-85);
 const path=`gestionale-ultimate-0.8/${crypto.randomUUID()}/${safeName}`;
 const dest=`${URL}/storage/v1/object/gestionale-documenti/${path.split('/').map(encodeURIComponent).join('/')}`;
 let response;try{response=await fetch(dest,{method:'POST',headers:{...headers(),'Content-Type':file.type,'x-upsert':'false'},body:file,referrerPolicy:'no-referrer'});}catch{throw Error('Upload Storage non raggiungibile')}
 let body=null;try{body=await response.json()}catch{}
 if(!response.ok)throw parseError(response.status,body);
 signalMutation();return {bucket:'gestionale-documenti',path,mime:file.type,size:file.size,category};
}
async function removePendingUpload(path){
 if(!path||!/^gestionale-ultimate-0\.8\/[a-f0-9-]{36}\/[a-zA-Z0-9._-]{1,85}$/.test(path))throw Error('Percorso non valido');
 await ensureSession();const res=await fetch(`${URL}/storage/v1/object/gestionale-documenti`,{method:'DELETE',headers:{...headers(),'Content-Type':'application/json'},body:JSON.stringify({prefixes:[path]})});
 if(!res.ok)throw Error('La pulizia automatica del file non è riuscita; segnalarlo all’amministratore');
}

function positiveNumber(x){const n=Number(x);if(!Number.isFinite(n)||n<=0)throw new Error('Importo non valido');return n;}
async function saveBooking({id,trip_id,client,phone,email,stop,notes,seats,price,status='In attesa acconto',days=2}){
 if(!id||!trip_id||!String(client).trim()||!String(stop).trim())throw new Error('Cliente, viaggio e fermata obbligatori');
 if(!Array.isArray(seats)||!seats.length||new Set(seats.map(String)).size!==seats.length)throw new Error('Seleziona posti numerati e distinti');
 const total=Number(price);if(!Number.isFinite(total)||total<0)throw new Error('Totale della prenotazione non valido');
 return rpc('dg2_save_booking_guarded_v1',{p_id:id,p_data:{viaggio_id:trip_id,cliente:String(client).trim(),cliente_nome:String(client).trim(),telefono:String(phone||''),email:String(email||''),fermata_partenza:String(stop).trim(),note:String(notes||''),giorni_acconto:Math.max(1,Math.min(90,Number(days)||2)),posti:seats.length,stato:status,totale:total},p_seats:seats.map(String)});
}
async function archiveBookingConfirmation(bookingId,pdfBase64){
 if(!/^[0-9a-f-]{36}$/i.test(String(bookingId||''))||typeof pdfBase64!=='string'||!pdfBase64)throw Error('Parametri conferma non validi');
 const result=await req('/functions/v1/dg2-booking-pdf',{method:'POST',data:{bookingId,action:'generate',pdfBase64}});
 if(result?.success===true)signalMutation();
 return result;
}
async function registerPayment({booking_id,type,amount,method,date,note}){
 return rpc('dg_register_payment',{p_booking_id:booking_id,p_tipo:type,p_importo:positiveNumber(amount),p_metodo:method,p_data:date,p_note:String(note||'')});
}
function isActive(b){return !/annull|cancel|cancell/i.test(String(b.stato||''));}
function seatNumbers(value){return String(value||'').split(',').map(x=>x.trim()).filter(x=>/^[1-9][0-9]*$/.test(x)).map(Number);}
function seatOverview(trip,bookings,seats){const cap=Number(trip.posti_totali)||0;
 const legacy=new Set(bookings.filter(b=>b.viaggio_id===trip.id&&isActive(b)).flatMap(b=>seatNumbers(b.posti_selezionati)));
 const activeIds=new Set(bookings.filter(isActive).map(b=>b.id));
 const assigned=new Set(seats.filter(s=>s.viaggio_id===trip.id&&activeIds.has(s.prenotazione_id)).map(s=>Number(s.posto)).filter(Number.isInteger));
 const all=new Set([...legacy,...assigned]), occupied=[...all].filter(n=>n>=1&&n<=cap).sort((a,b)=>a-b);
 return {trip,trip_id:trip.id,capacity:cap,occupied,occupied_count:occupied.length,free_count:Math.max(0,cap-occupied.length),
  legacy_only:[...legacy].filter(n=>!assigned.has(n)).sort((a,b)=>a-b),relational_only:[...assigned].filter(n=>!legacy.has(n)).sort((a,b)=>a-b),
  over_capacity:[...all].filter(n=>n>cap).sort((a,b)=>a-b),counter_claim:Number(trip.posti_occupati)||0,
  counter_mismatch:(Number(trip.posti_occupati)||0)!==occupied.length,
  bookings_count:bookings.filter(b=>b.viaggio_id===trip.id&&isActive(b)).length,
  checked_in_count:bookings.filter(b=>b.viaggio_id===trip.id&&isActive(b)&&b.checkin_effettuato).length};
}
function calculateDashboard(trips,bookings,payments,fleet,customers,notifications){const date=new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Europe/Rome'}).format(new Date());
 const upcoming=trips.filter(x=>String(x.data_partenza||'')>=date&&!x.archiviato_at).sort((a,b)=>String(a.data_partenza).localeCompare(String(b.data_partenza)));
 const active=bookings.filter(isActive),num=(n)=>Number(n)||0;
 return {source:'SUPABASE_LIVE_AUTHENTICATED',trips_total:trips.length,trips_upcoming:upcoming.length,bookings_total:bookings.length,bookings_active:active.length,
  booked_passengers:active.reduce((a,b)=>a+num(b.posti),0),reported_paid_on_active_bookings:Math.round(active.reduce((a,b)=>a+num(b.pagato),0)*100)/100,
  reported_remaining_on_active_bookings:Math.round(active.reduce((a,b)=>a+Math.max(0,num(b.totale)-num(b.pagato)),0)*100)/100,
  payments_records:payments.length,fleet_active:fleet.filter(x=>x.attivo&&x.titolo!=='MERCEDES V250D').length,customers_total:customers.length,
  notifications_unread:notifications.filter(x=>!x.letto).length,upcoming:upcoming.slice(0,12),
  notes:['Importi ricavati dalle prenotazioni: non sostituiscono la riconciliazione contabile completa.']};
}
function csvLine(values){return values.map(value=>{let s=String(value??'');if(/^[\s\u0000-\u001f]*[=+@\-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}).join(',');}
function csv(content){return '\ufeff'+content.map(csvLine).join('\r\n')+'\r\n';}
function downloadBlob(blob,name){const anchor=document.createElement('a');const url=global.URL.createObjectURL(blob);anchor.href=url;anchor.download=name;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>global.URL.revokeObjectURL(url),12000);}
function downloadCSV(rows,name){downloadBlob(new Blob([csv(rows)],{type:'text/csv;charset=utf-8'}),name);}
async function downloadPrivate(bucket,path,filename){
  if(!['ricevute-prenotazioni','gestionale-documenti','preventivi-pdf'].includes(bucket))throw Error('Archivio privato non previsto');
  if(!path||typeof path!=='string'||path.startsWith('/')||path.includes('..')||path.length>700)throw Error('Percorso documento non valido');
  await ensureSession();
  const segments=path.split('/').map(x=>encodeURIComponent(x)).join('/');
  const endpoint=URL+'/storage/v1/object/authenticated/'+encodeURIComponent(bucket)+'/'+segments;
  let r;try{r=await fetch(endpoint,{headers:headers(),cache:'no-store',referrerPolicy:'no-referrer'})}catch{throw Error('Documento non raggiungibile');}
  if(!r.ok)throw Error('Documento privato non disponibile oppure accesso Storage non autorizzato ('+r.status+')');
  const blob=await r.blob();if(blob.size>40*1024*1024)throw Error('Documento troppo grande per il download diretto');
  downloadBlob(blob,filename||('DELGROSSO_DOCUMENTO.'+(path.toLowerCase().endsWith('.pdf')?'pdf':'bin')));
}
function printAllTrips(trips,bookings){
 const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const sections=trips.map(trip=>{const list=bookings.filter(b=>b.viaggio_id===trip.id&&isActive(b));
  return `<section class="print-group"><h2>${safe(trip.titolo||trip.destinazione)} · ${safe(trip.data_partenza)} · ${safe(trip.autobus)}</h2>
  <p>Persone registrate: ${list.reduce((s,b)=>s+(Number(b.posti)||0),0)} · capienza: ${safe(trip.posti_totali)}</p>
  <table><thead><tr><th>N.</th><th>Referente</th><th>Persone</th><th>Posti</th><th>Fermata</th><th>Stato</th></tr></thead><tbody>
  ${list.map((b,i)=>`<tr><td>${i+1}</td><td>${safe(b.cliente_nome||b.cliente)}</td><td>${safe(b.posti)}</td><td>${safe(b.posti_selezionati)}</td><td>${safe(b.fermata_partenza)}</td><td>${safe(b.stato)}</td></tr>`).join('')}</tbody></table></section>`}).join('');
 const overlay=document.createElement('div');overlay.id='dg-print-only';overlay.innerHTML=`<section class="print-sheet"><div class="dg-print-brand"><img src="assets/logo-delgrosso.png" alt="Logo DELGROSSO"><div class="dg-print-brand-text"><h1>DELGROSSO VIAGGI &amp; LIMOUSINE BUS</h1><h2>Elenco prenotati · TUTTI I VIAGGI · documento interno</h2><p>Riservato agli operatori autorizzati · ${new Date().toLocaleString('it-IT')}</p></div></div>${sections}</section>`;
 document.body.append(overlay);const cleanup=()=>overlay.remove();global.addEventListener('afterprint',cleanup,{once:true});global.print();setTimeout(cleanup,120000);
}
function printBookings(trip,bookings){const list=bookings.filter(b=>b.viaggio_id===trip.id&&isActive(b));
 const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const documentHTML=`<section class="print-sheet"><div class="dg-print-brand"><img src="assets/logo-delgrosso.png" alt="Logo DELGROSSO"><div class="dg-print-brand-text"><h1>DELGROSSO VIAGGI &amp; LIMOUSINE BUS</h1><h2>Elenco prenotati · ${safe(trip.titolo||trip.destinazione)}</h2><p>Data: ${safe(trip.data_partenza)} · Autobus: ${safe(trip.autobus)} · Posti: ${safe(trip.posti_totali)}</p></div></div>
 <table><thead><tr><th>N.</th><th>Referente</th><th>Persone</th><th>Posti</th><th>Fermata</th><th>Stato</th></tr></thead><tbody>
 ${list.map((b,i)=>`<tr><td>${i+1}</td><td>${safe(b.cliente_nome||b.cliente)}</td><td>${safe(b.posti)}</td><td>${safe(b.posti_selezionati)}</td><td>${safe(b.fermata_partenza)}</td><td>${safe(b.stato)}</td></tr>`).join('')}</tbody></table>
 <p class="print-note">Documento interno · dati personali riservati · Generato dal browser in ${new Date().toLocaleString('it-IT')}.</p></section>`;
 const overlay=document.createElement('div');overlay.id='dg-print-only';overlay.innerHTML=documentHTML;document.body.append(overlay);
 let done=false;const cleanup=()=>{if(done)return;done=true;overlay.remove();global.removeEventListener('afterprint',cleanup)};
 global.addEventListener('afterprint',cleanup,{once:true});global.print();setTimeout(cleanup,120000);
}
async function getOverview(trip,load){const [bookings,seats]=await Promise.all([load('bookings'),load('seatrows')]);return seatOverview(trip,bookings,seats);}
// Status conveys configuration only; actual access requires successful Supabase login.
const adapter={probe,verifyCurrentOperator,health,status:()=>({configured:true,project_ref:PROJECT,mode:'WEB_OPERATOR_USERNAME'}),signInOperator,signOut,changeOwnPassword,rows,rpc,insert,update,
 startRealtime,stopRealtime,saveBooking,registerPayment,archiveBookingConfirmation,seatOverview,getOverview,calculateDashboard,downloadCSV,printBookings,printAllTrips,downloadPrivate,clear,get actor(){return actor;},get sessionActive(){return!!token;},
 csv,positiveNumber,upsertKnown,uploadPrivateFile,removePendingUpload};
Object.freeze(adapter);
global.DGData=adapter;
})(window);
