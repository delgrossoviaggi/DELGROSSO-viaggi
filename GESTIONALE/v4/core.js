/* DELGROSSO VIAGGI 4.0 — API, sessione e modelli di calcolo.
 * Client pubblicabile; nessuna service role; RLS e RPC lato server.
 * Il blocco scritture rimane intenzionalmente attivo fino alla certificazione del backup.
 */
export const API_URL = 'https://chkuayhbmitdmzmmvona.supabase.co';
export const PUBLISHABLE_KEY = 'sb_publishable_H29K1BV5ZE1rT8xo0PIzVA_wF6zC7je';
export const WRITES_ENABLED = false; // NON ABILITARE SENZA BACKUP, RESTORE SU STAGING E TEST
export const CHANNEL = 'dg4-session';
export const SELECTS = Object.freeze({
  trips: ['viaggi','id,id_viaggio,titolo,destinazione,luogo_partenza,data_partenza,ora_partenza,prezzo,stato,pubblicato,posti_totali,posti_occupati,posti_liberi,autobus,autobus_id,bis_parent_id,bis_numero,sold_out_manual,archiviato_at,minimo_partecipanti,locandina'],
  bookings: ['prenotazioni','id,viaggio_id,cliente,cliente_nome,telefono,email,posti,totale,acconto,saldo,pagato,stato,note,posti_selezionati,fermata_partenza,checkin_effettuato,checkin_fermata,checked_in_at,codice,created_at,riserva_aziendale,confirmation_storage_path'],
  seats: ['prenotazione_posti','id,viaggio_id,prenotazione_id,posto'],
  payments: ['pagamenti','id,prenotazione_id,viaggio_id,cliente,importo,tipo,stato,metodo,metodo_pagamento,incassato_da,incassato_da_user_id,receipt_number,data_pagamento,created_at,receipt_professional_path,receipt_storage_path'],
  operators:['operatori_gestionale','user_id,username,nome,ruolo,attivo'],
  cash:['dg_cassa_operatori','user_id,username,nome,cassa_netto,viaggi_incassati,noleggi_incassati,viaggi_rimborsi,noleggi_rimborsi,trasferimenti_uscita,trasferimenti_entrata,contanti_netto'],
  transfers:['cassa_trasferimenti','id,da_operatore_user_id,a_operatore_user_id,importo,data_trasferimento,stato,note,created_at'],
  economy:['economia_movimenti','id,tipo,categoria,descrizione,importo,data_movimento,viaggio_id,noleggio_id,operatore,metodo,origine'],
  profit:['dg_viaggi_redditivita','viaggio_id,titolo,destinazione,data_partenza,posti_totali,posti_occupati,entrate,uscite,margine,minimo_partecipanti'],
  fleet:['flotta','id,titolo,marca,modello,posti,categoria,stato,attivo,targa,immagine,foto_gallery'],
  rentals:['noleggi_bus','id,referente,azienda,telefono,email,tratta_partenza,tratta_destinazione,data_partenza,ora_partenza,data_ritorno,passeggeri,prezzo_concordato,acconto,saldo,stato_pagamento,stato_noleggio,archiviato_at'],
  rentalPayments:['noleggi_bus_pagamenti','id,noleggio_id,importo,tipo,metodo,data_pagamento,incassato_da,receipt_number,receipt_path,receipt_professional_path'],
  quotes:['preventivi','id,numero_preventivo,nome,cognome,azienda,telefono,email,servizio,servizio_richiesto,origine,stato,data_partenza,data_viaggio,destinazione,luogo_partenza,numero_passeggeri,importo_preventivo,importo,pdf_professional_path,created_at'],
  invoices:['dg3_fatture_bozze','id,tipo_documento,stato,data_bozza,prenotazione_id,noleggio_id,imponibile_centesimi,iva_centesimi,totale_centesimi,created_at'],
  waitlist:['lista_attesa','id,viaggio_id,nome,cognome,telefono,email,fermata_partenza,posti,stato,priorita,created_at'],
  receipts:['dg_receipt_archive','kind,id,reference_id,receipt_number,tipo,importo,data_pagamento,cliente,servizio,metodo,operatore,legacy_path,professional_path,created_at'],
  docsMetadata:['documenti_gestionali','id,categoria,titolo,descrizione,viaggio_id,cliente_id,storage_bucket,storage_path,mime_type,created_at'],
  whatsAppInbox:['dg_whatsapp_inbox_v61','id,sender_phone,sender_name,message_text,intent,status,booking_id,trip_id,received_at'],
  whatsAppOutbound:['dg_whatsapp_outbound_v62','id,booking_id,template_kind,recipient_phone,status,created_at'],
  whatsAppOptins:['dg_whatsapp_optins_v61','phone,customer_name,consent_source,consent_at,revoked_at'],

  customers:['clienti','id,nome,cognome,telefono,email,citta,codice_cliente,stato_cliente'],
  agenda:['scadenze_gestionale','id,titolo,descrizione,tipo,stato,priorita,data_scadenza,note,importo,viaggio_id,prenotazione_id,created_at'],
  layoutLibrary:['dg2_layout_library','id,nome,configurazione,attivo,updated_at'],
  busLayouts:['dg28_bus_layouts','autobus_id,layout_id,configurazione,versione,pubblicata_il'],
  tripLayouts:['dg28_trip_layouts','viaggio_id,autobus_id,layout_id,configurazione,versione,pubblicata_il'],
  stops:['viaggi_fermate','id,viaggio_id,nome,orario,punto_incontro,ordine,attiva'],
  notifications:['notifiche','id,titolo,messaggio,tipo,letto,created_at'],
  documents:['archivio_documenti','tipo_documento,documento_id,numero_documento,prenotazione_id,pagamento_id,viaggio_id,cliente,viaggio,data_documento,importo,storage_path'],
  alerts:['dg_data_quality_issues','id,categoria,priorita,titolo,dettaglio,riferimento_id,data_riferimento'],
  system:['dg_system_health','checked_at,viaggi,prenotazioni,clienti,pagamenti,flotta,audit_24h,attesa,crm_scaduti']
});
let session = null;
let refreshPending = null;
let signingOut = false;
const cache = new Map();
const clean = x => String(x == null ? '' : x);
export const esc = value => clean(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const eur = n => new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(n)||0);
export const num = n => Number(n)||0;
export const dateIT = s => /^\d{4}-\d{2}-\d{2}$/.test(clean(s).slice(0,10)) ? clean(s).slice(8,10)+'/'+clean(s).slice(5,7)+'/'+clean(s).slice(0,4) : '—';
export const dateTimeIT = s => {if(!s)return '—';const d=new Date(s);return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('it-IT',{timeZone:'Europe/Rome',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});};
export const todayItaly = () => {const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day;};
export const bookingActive = b => !/annull|cancel|cancell|eliminat/i.test(String(b?.stato||''));
export const bookingName = b => b?.cliente_nome || b?.cliente || 'Cliente non specificato';
export const tripName = t => t?.titolo || t?.destinazione || 'Viaggio';
export const seatsOf = x => String(x?.posti_selezionati||'').split(/[,;\s]+/).map(s=>s.trim()).filter(s=>/^[1-9]\d{0,3}$/.test(s));
export const uniquePhones = rows => [...new Set(rows.map(b=>String(b.telefono||'').replace(/[^\d+]/g,'')).filter(x=>x.length>=8))];
export const occupancy = (trip,bookings,seatRecords) => {
  const map=new Map(), warnings=[];
  for(const row of (seatRecords||[])){
    if(row.viaggio_id!==trip?.id)continue;
    const b=(bookings||[]).find(x=>x.id===row.prenotazione_id);
    if(!b || !bookingActive(b))continue;
    if(map.has(String(row.posto)) && map.get(String(row.posto)).id!==b.id)warnings.push('Posto duplicato '+row.posto);
    map.set(String(row.posto),b);
  }
  for(const b of (bookings||[])){
    if(b.viaggio_id!==trip?.id || !bookingActive(b))continue;
    for(const seat of seatsOf(b)){
      if(map.has(seat) && map.get(seat).id!==b.id) warnings.push('Conflitto posto '+seat);
      if(!map.has(seat))map.set(seat,b);
    }
  }
  return {map,warnings:[...new Set(warnings)]};
};
export const breakdown = (trips,bookings,payments) => {
  const active=bookings.filter(bookingActive);
  const sums=payments.filter(p=>!(/annull|storn|eliminat/i.test(String(p.stato||'')))).reduce((a,p)=>a+num(p.importo),0);
  return {
    trips:(trips||[]).filter(t=>!t.archiviato_at).length,
    passengers:active.reduce((a,b)=>a+num(b.posti),0),
    bookings:active.length,
    collected:sums,
    outstanding:active.reduce((a,b)=>a+Math.max(0,num(b.totale)-num(b.pagato)),0),
    upcoming:trips.filter(t=>!t.archiviato_at && t.data_partenza>=todayItaly()).length
  };
};
export function activeSession(){return !!session?.access_token && !!session?.refresh_token && !!session?.user?.id;}
export function currentUser(){return session?.user?.id||null;}
export function wipe(){signingOut=true;session=null;cache.clear();refreshPending=null;try{sessionStorage.removeItem(CHANNEL)}catch{}}
function storeSession(data){
 if(!data?.access_token||!data?.refresh_token||!data?.user?.id)throw new Error('Sessione Supabase non valida');
 session={...data,expires_at:data.expires_at||Math.floor(Date.now()/1000)+num(data.expires_in||3600)};
 signingOut=false;
 try{sessionStorage.setItem(CHANNEL,JSON.stringify(session))}catch{}
 return session;
}
async function jsonFetch(path, options={},authorized=true,retries=0) {
  if(authorized){if(!activeSession())throw new Error('Sessione scaduta. Accedi di nuovo.');await ensureToken();}
  const headers={apikey:PUBLISHABLE_KEY,Accept:'application/json',...(options.headers||{})};
  if(authorized)headers.Authorization='Bearer '+session.access_token;
  let result;
  for(let attempt=0;attempt<=retries;attempt++){
    const ctl=new AbortController();
    const timeout=setTimeout(()=>ctl.abort(),13000);
    try {
      const response=await fetch(API_URL+path,{...options,headers,signal:ctl.signal,cache:'no-store',referrerPolicy:'no-referrer'});
      let payload=null;const text=await response.text();
      if(text){try{payload=JSON.parse(text)}catch{payload={message:'Risposta API non valida'}}}
      if(!response.ok){
        if(attempt<retries && [502,503,504,429].includes(response.status)){await new Promise(r=>setTimeout(r,450*(attempt+1)));continue;}
        const err=clean(payload?.message||payload?.error_description||payload?.error||('HTTP '+response.status));
        if(response.status===401)throw new Error('Accesso scaduto o non autorizzato.');
        throw new Error(err.slice(0,350));
      }
      result=payload;
      break;
    } catch(error){
      if(error.name==='AbortError')throw new Error('Supabase non risponde. Riprova dopo aver controllato la connessione.');
      throw error;
    } finally {clearTimeout(timeout)}
  }
  return result;
}
async function ensureToken(){
 if(!session?.refresh_token)throw new Error('Sessione non disponibile.');
 if(num(session.expires_at)*1000>Date.now()+90000)return;
 if(refreshPending)return refreshPending;
 const previous=session.user.id;
 refreshPending=(async()=>{
  const next=await jsonFetch('/auth/v1/token?grant_type=refresh_token',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({refresh_token:session.refresh_token})
  },false,0);
  if(signingOut||next?.user?.id!==previous)throw new Error('Identità della sessione cambiata.');
  storeSession(next);
 })();
 try{await refreshPending}finally{refreshPending=null}
}
export async function authorize(){
 const user=await jsonFetch('/auth/v1/user',{},true,1);
 if(user?.id!==session?.user?.id)throw new Error('Identità non verificata.');
 const admin=await jsonFetch('/rest/v1/rpc/is_gestionale_admin',{
  method:'POST',headers:{'Content-Type':'application/json'},body:'{}'
 },true,0);
 if(admin!==true)throw new Error('Questo account non è autorizzato come operatore.');
 const rows=await jsonFetch('/rest/v1/operatori_gestionale?select=user_id,username,nome,attivo&user_id=eq.'+encodeURIComponent(user.id),{},true,1);
 const operator=Array.isArray(rows)?rows.find(x=>x.user_id===user.id && x.attivo===true):null;
 if(!operator)throw new Error('Operatore non attivo.');
 return operator;
}
export async function login(username,password){
 const user=String(username||'').toLowerCase();
 if(!['nicola','raffaele'].includes(user) || !password)throw new Error('Credenziali non valide.');
 const data=await jsonFetch('/functions/v1/dg2-operator-login',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({username:user,password})
 },false,0);
 storeSession(data);
 try{return await authorize()}catch(err){wipe();throw err}
}
export async function resume(){
 try{
  const data=JSON.parse(sessionStorage.getItem(CHANNEL)||'null');
  if(!data?.access_token)return null;
  storeSession(data);
  return await authorize();
 }catch{wipe();return null}
}
export async function logout(){
 const token=session?.access_token;
 wipe();
 if(token){fetch(API_URL+'/auth/v1/logout',{method:'POST',headers:{apikey:PUBLISHABLE_KEY,Authorization:'Bearer '+token},cache:'no-store'}).catch(()=>{});}
}
export function clearCache(){cache.clear()}
export async function records(resource,{filters={},order=null,limit=1000,force=false}={}){
 if(!SELECTS[resource])throw new Error('Archivio non consentito: '+resource);
 if(!activeSession())throw new Error('Accesso non autorizzato.');
 const [table,columns]=SELECTS[resource];
 const params=new URLSearchParams({select:columns});
 if(order)params.set('order',order);
 for(const [k,value] of Object.entries(filters)){
   if(!/^[a-z_]+$/i.test(k))throw new Error('Filtro non valido');
   if(value!==null&&value!==undefined)params.set(k,String(value));
 }
 const key=resource+'?'+params.toString()+'#'+limit;
 const cached=cache.get(key);
 if(!force&&cached&&Date.now()-cached.at<25000)return cached.rows;
 const all=[],pageSize=Math.min(500,Math.max(1,limit));
 for(let offset=0;offset<Math.min(limit,20000);offset+=pageSize){
   const query=new URLSearchParams(params);
   query.set('limit',String(Math.min(pageSize,limit-offset)));query.set('offset',String(offset));
   const res=await jsonFetch('/rest/v1/'+table+'?'+query.toString(),{},true,1);
   if(!Array.isArray(res))throw new Error('La risposta di '+table+' non è una lista.');
   all.push(...res);
   if(res.length<pageSize)break;
 }
 cache.set(key,{rows:all,at:Date.now()});
 return all;
}
export async function rpcRead(name,args={}){
 if(!['is_gestionale_admin','dg_cash_preview_v2','dg28_validate_layout_v1'].includes(name))throw new Error('RPC non autorizzata per la lettura.');
 return jsonFetch('/rest/v1/rpc/'+name,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args)},true,0);
}
export async function writeRpc(name,payload){
 if(!WRITES_ENABLED)throw new Error('Scritture bloccate: backup completo e collaudo non ancora certificati.');
 const whitelist=new Set(['dg2_save_booking_guarded_v1','dg_register_payment','dg_register_rental_payment','dg_move_bookings_auto_seats_v1','dg_transfer_cash','dg_manage_booking_seats_v1','dg28_publish_trip_layout_v1','dg28_publish_bus_layout_v1','dg_delete_booking']);
 if(!whitelist.has(name))throw new Error('Operazione non autorizzata.');
 const result=await jsonFetch('/rest/v1/rpc/'+name,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)},true,0);
 clearCache();return result;
}
export async function mutate(resource,method,payload,id=null){
 if(!WRITES_ENABLED)throw new Error('Scritture bloccate: backup completo e collaudo non ancora certificati.');
 const permitted={
  agenda:{POST:['titolo','descrizione','data_scadenza','priorita','tipo','stato'],PATCH:['stato','priorita','data_scadenza','titolo','descrizione']},
  trips:{POST:['titolo','destinazione','data_partenza','prezzo','posti_totali','minimo_partecipanti','pubblicato','stato','autobus_id'],PATCH:['titolo','destinazione','data_partenza','prezzo','posti_totali','minimo_partecipanti','pubblicato','stato','archiviato_at','sold_out_manual']},
  rentals:{POST:['referente','azienda','telefono','email','tratta_partenza','tratta_destinazione','data_partenza','ora_partenza','passeggeri','prezzo_concordato','acconto','saldo'],PATCH:['stato_noleggio','data_ritorno','ora_ritorno','archiviato_at']},
  customers:{POST:['nome','cognome','telefono','email','citta'],PATCH:['telefono','email','citta']},
  bookings:{PATCH:['checkin_effettuato','checkin_stato','checked_in_at','checkin_operatore']},
  quotes:{POST:['nome','cognome','telefono','email','origine','stato','destinazione','data_partenza','numero_passeggeri','passeggeri','importo','importo_preventivo','servizio','luogo_partenza'],PATCH:['stato','importo_preventivo','note_interne']},
  waitlist:{POST:['viaggio_id','nome','cognome','telefono','email','posti','stato','fermata_partenza','priorita','note'],PATCH:['stato','note']},
  layoutLibrary:{POST:['nome','configurazione','attivo','created_by'],PATCH:['nome','configurazione','attivo','updated_by']}
 };
 const ok=permitted[resource]?.[method];
 if(!Array.isArray(ok)||!payload||typeof payload!=='object'||
 Object.keys(payload).some(k=>!ok.includes(k))||(method==='PATCH'&&!id)||(method==='POST'&&id))
   throw new Error('Operazione o campi non autorizzati per la tabella '+resource);
 const [table]=SELECTS[resource];
 const target=id?('?id=eq.'+encodeURIComponent(id)):'';
 const result=await jsonFetch('/rest/v1/'+table+target,{
  method,headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(payload)
 },true,0);
 clearCache();return result;
}

/** Signed Storage URL returned by Supabase JavaScript/REST. Reject other hosts. */
export function normalizeSignedStorageUrl(value) {
 const raw=String(value||'');
 const full=raw.startsWith('/storage/v1/object/sign/')?API_URL+raw:
   raw.startsWith('/object/sign/')?API_URL+'/storage/v1'+raw:
   raw.startsWith('https://')?raw:'';
 if(!full)throw new Error('URL documento non riconosciuto.');
 const url=new URL(full);
 if(url.origin!==API_URL || !url.pathname.startsWith('/storage/v1/object/sign/'))
   throw new Error('Il documento non proviene dallo Storage aziendale.');
 return url.href;
}
/** Edge Functions ufficiali esistenti; nessuna nuova chiave di servizio nel client.
 * Solo signed_url/status in read-only; generate e regenerate proibiti senza backup.
 */
export async function edgeAction(slug,payload){
 const action=String(payload?.action||'');
 const permissions={
  'dg2-booking-pdf':{read:['signed_url'],write:['generate','regenerate']},
  'professional-receipts':{read:['status'],write:['generate']},
  'professional-quotes':{read:['status'],write:['generate']}
 };
 const rule=permissions[slug];
 if(!rule)throw new Error('Servizio PDF non autorizzato.');
 const willWrite=rule.write.includes(action);
 if(!willWrite&&!rule.read.includes(action))throw new Error('Azione PDF non consentita.');
 if(willWrite&&!WRITES_ENABLED)throw new Error('Archiviazione PDF sospesa fino a backup verificato.');
 const result=await jsonFetch('/functions/v1/'+slug,{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify(payload)
 },true,0);
 if(!result?.success)throw new Error(String(result?.error||'Operazione PDF non confermata dal server.'));
 return result;
}
export async function signedReceiptPath(bucket,pathValue){
 if(!['ricevute-prenotazioni','preventivi-pdf','gestionale-documenti'].includes(bucket))throw new Error('Archivio non autorizzato');
 if(!pathValue||String(pathValue).includes('..')||String(pathValue).startsWith('/'))throw new Error('Percorso non valido');
 // User-JWT auth, private bucket policy server side; no service_role access.
 const encoded=String(pathValue).split('/').map(encodeURIComponent).join('/');
 const res=await jsonFetch('/storage/v1/object/sign/'+bucket+'/'+encoded,{
  method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expiresIn:60})
 },true,0);
 if(!res?.signedURL)throw new Error('Documento non disponibile per questo operatore.');
 return normalizeSignedStorageUrl(res.signedURL);
}
