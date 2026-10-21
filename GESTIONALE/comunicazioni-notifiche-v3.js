/* DELGROSSO OPERATIONS 360 — Comunicazioni & Notifiche R33
   Operatori autenticati; gli avvisi legacy restano intatti.
   Letture personali + messaggi privati via Supabase/RLS.
   Il badge e il centro si aggiornano anche quando il gestionale resta aperto.
*/
(function(){
'use strict';
const D=document, $=id=>D.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const datetime=s=>{try{return new Date(s).toLocaleString('it-IT',{dateStyle:'short',timeStyle:'short'})}catch{return String(s||'')}};
const now=()=>Date.now();
const apiCall=(...args)=>{if(typeof api!=='function')throw new Error('Collegamento al gestionale non inizializzato');return api(...args)};
const currentState=()=>{try{return typeof state==='object'&&state?state:null}catch{return null}};
const currentSession=()=>{try{return typeof authSession==='object'?authSession:null}catch{return null}};
const userId=()=>{
 const session=currentSession(); if(!session?.access_token)return '';
 if(session.user?.id)return String(session.user.id);
 try{const part=session.access_token.split('.')[1];const b64=part.replace(/-/g,'+').replace(/_/g,'/');return String(JSON.parse(atob(b64.padEnd(Math.ceil(b64.length/4)*4,'=')))?.sub||'')}catch{return ''}
};
const data={uid:'',notices:[],reads:new Set(),messages:[],operators:[],activeTab:'notifiche',filter:'all',busy:false,lastFetch:0,error:'',initial:true,seen:new Set(),browserAllowed:false};
const css=`
#page-comunicazioni .dgn33-head{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:16px}
#page-comunicazioni .dgn33-head h2{margin:0;color:#11304b;font-size:24px}
#page-comunicazioni .dgn33-head p{color:#687b8d;font-size:12px;margin:5px 0 0}
#page-comunicazioni .dgn33-head-actions{display:flex;gap:8px;flex-wrap:wrap}
#page-comunicazioni .dgn33-tabs{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:14px}
#page-comunicazioni .dgn33-tab{background:#fff;border:1px solid #dae5ec;color:#1b4660;padding:11px 14px;border-radius:10px;font-weight:800;cursor:pointer;font-size:12px}
#page-comunicazioni .dgn33-tab.active{background:#102f48;color:white;border-color:#102f48;box-shadow:0 5px 16px #17395322}
#page-comunicazioni .dgn33-stats{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:13px}
#page-comunicazioni .dgn33-stat{background:#f7fafc;border:1px solid #dce6ee;padding:9px 14px;border-radius:11px;font-size:12px;color:#547084}
#page-comunicazioni .dgn33-stat strong{color:#15384d;font-size:15px}
#page-comunicazioni .dgn33-actions{display:flex;flex-wrap:wrap;gap:9px;align-items:center;margin-bottom:13px}
#page-comunicazioni .dgn33-actions select,#page-comunicazioni .dgn33-compose select,#page-comunicazioni .dgn33-compose input,#page-comunicazioni .dgn33-compose textarea{background:#fff;border:1px solid #cbdbe6;border-radius:9px;color:#163b53;font:inherit;padding:10px 12px;min-width:0}
#page-comunicazioni .dgn33-actions select{min-width:125px;font-size:12px}
#page-comunicazioni .dgn33-btn{padding:10px 13px;border:1px solid #cddce5;border-radius:9px;background:#fff;color:#183b52;font-size:12px;font-weight:800;cursor:pointer}
#page-comunicazioni .dgn33-btn.primary{background:#0d6094;border-color:#0d6094;color:#fff}
#page-comunicazioni .dgn33-btn:disabled{opacity:.5;cursor:wait}
#page-comunicazioni .dgn33-list{display:flex;flex-direction:column;gap:10px}
#page-comunicazioni .dgn33-item{padding:17px;background:#fff;border:1px solid #dde7ee;border-radius:12px;display:flex;gap:13px;justify-content:space-between;align-items:start}
#page-comunicazioni .dgn33-item.unread{border-left:4px solid #1084bf;background:#f5fbff}
#page-comunicazioni .dgn33-content{min-width:0;flex:1}
#page-comunicazioni .dgn33-content h3{font-size:14px;color:#153750;margin:0 0 6px}
#page-comunicazioni .dgn33-content p{white-space:pre-wrap;overflow-wrap:anywhere;color:#4d6373;font-size:12px;line-height:1.65;margin:0 0 8px}
#page-comunicazioni .dgn33-meta{font-size:11px;color:#7d8f9c;display:flex;gap:9px;flex-wrap:wrap}
#page-comunicazioni .dgn33-side{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
#page-comunicazioni .dgn33-pill{padding:5px 8px;border-radius:999px;background:#edf2f5;color:#506d80;font-size:10px;font-weight:800}
#page-comunicazioni .dgn33-pill.new{background:#dceffb;color:#085c89}
#page-comunicazioni .dgn33-empty{border:1px dashed #cddce5;background:#f9fbfd;border-radius:12px;padding:27px 18px;color:#617888;text-align:center;font-size:13px}
#page-comunicazioni .dgn33-error{background:#fff3ee;border:1px solid #f7cabc;color:#8c3125;padding:12px;border-radius:10px;font-size:12px;margin:10px 0}
#page-comunicazioni .dgn33-status{font-size:11px;color:#6c8798;min-height:17px;margin:7px 0 12px}
#page-comunicazioni .dgn33-compose{display:grid;grid-template-columns:1fr 1fr;gap:12px;background:#f5f9fc;border:1px solid #dce5ed;border-radius:12px;padding:18px;margin-bottom:17px}
#page-comunicazioni .dgn33-compose label{display:flex;flex-direction:column;gap:6px;font-size:12px;color:#3c5a70;font-weight:800}
#page-comunicazioni .dgn33-compose .full{grid-column:1/-1}
#page-comunicazioni .dgn33-compose textarea{resize:vertical;min-height:100px}
#page-comunicazioni .dgn33-help{font-size:11px;color:#718799;font-weight:400}
@media(max-width:700px){#page-comunicazioni .dgn33-compose{grid-template-columns:1fr;padding:13px}#page-comunicazioni .dgn33-compose .full{grid-column:auto}#page-comunicazioni .dgn33-item{flex-direction:column}#page-comunicazioni .dgn33-side{justify-content:flex-start}#page-comunicazioni .dgn33-head h2{font-size:20px}}
`;
function install(){
 if(!$('dgn33-style')){const s=D.createElement('style');s.id='dgn33-style';s.textContent=css;D.head.appendChild(s)}
 const p=$('page-comunicazioni');if(!p||$('dgn33-root'))return;
 p.innerHTML=`<div id="dgn33-root">
  <div class="dgn33-head"><div><h2>✉️ Comunicazioni & Notifiche</h2><p>Avvisi del gestionale e messaggi privati tra operatori</p></div>
   <div class="dgn33-head-actions"><button type="button" class="dgn33-btn" data-dgn33-action="refresh">↻ Aggiorna</button><button type="button" class="dgn33-btn" data-dgn33-action="browser">🔔 Avvisi browser</button></div></div>
  <div class="dgn33-tabs"><button class="dgn33-tab active" data-dgn33-tab="notifiche" type="button">🔔 Avvisi automatici <span id="dgn33-count-n">0</span></button>
   <button class="dgn33-tab" data-dgn33-tab="ricevuti" type="button">📥 Messaggi ricevuti <span id="dgn33-count-m">0</span></button>
   <button class="dgn33-tab" data-dgn33-tab="inviati" type="button">📤 Inviati</button>
   <button class="dgn33-tab" data-dgn33-tab="scrivi" type="button">✍️ Scrivi a un operatore</button></div>
  <div id="dgn33-stats" class="dgn33-stats" aria-live="polite"></div>
  <div id="dgn33-actions" class="dgn33-actions"></div>
  <div id="dgn33-error" role="alert"></div><div id="dgn33-status" class="dgn33-status" aria-live="polite"></div>
  <div id="dgn33-list" class="dgn33-list"></div></div>`;
 p.addEventListener('click',onClick);
 p.addEventListener('change',e=>{if(e.target.id==='dgn33-filter'){data.filter=e.target.value;paint()}});
 p.addEventListener('submit',sendMessage);
}
function mineMessage(m){return String(m.recipient_user_id)===data.uid}
function isMyNotice(n){return !n.utente_id||String(n.utente_id)===data.uid}
function isNoticeRead(n){return Boolean(n.letto)||data.reads.has(n.id)}
function badge(){
 const n=data.notices.filter(n=>isMyNotice(n)&&!isNoticeRead(n)).length;
 const m=data.messages.filter(m=>mineMessage(m)&&!m.read_at).length;
 const el=$('notifBadge');if(el){el.textContent=String(n+m);el.hidden=(n+m)===0;el.setAttribute('aria-label',`${n+m} comunicazioni non lette`)}
 const bell=$('notifBtn');if(bell){bell.title=n+m?`${n} notifiche e ${m} messaggi da leggere`:'Nessuna nuova notifica';bell.setAttribute('aria-label',bell.title)}
 const a=$('dgn33-count-n');if(a)a.textContent=String(n);
 const b=$('dgn33-count-m');if(b)b.textContent=String(m);
}
function who(id){const x=data.operators.find(o=>String(o.user_id)===String(id));return x?.nome||x?.username||'Operatore'}
function paint(){
 install();badge();const list=$('dgn33-list');if(!list)return;
 D.querySelectorAll('#page-comunicazioni [data-dgn33-tab]').forEach(el=>{const active=el.dataset.dgn33Tab===data.activeTab;el.classList.toggle('active',active);el.setAttribute('aria-selected',String(active))});
 $('dgn33-error').innerHTML=data.error?`<div class="dgn33-error">⚠ ${esc(data.error)} <button type="button" class="dgn33-btn" data-dgn33-action="refresh">Riprova</button></div>`:'';
 $('dgn33-status').textContent=data.busy?'Sincronizzazione in corso…':data.lastFetch?`Ultimo aggiornamento: ${new Date(data.lastFetch).toLocaleTimeString('it-IT')} · verifica automatica ogni 20 secondi`:'Accedi con Nicola o Raffaele per leggere le comunicazioni.';
 if(!data.uid){list.innerHTML='<div class="dgn33-empty">Accedi al gestionale con il tuo account per leggere notifiche e comunicazioni.</div>';$('dgn33-stats').innerHTML='';$('dgn33-actions').innerHTML='';return}
 const notices=data.notices.filter(isMyNotice),incoming=data.messages.filter(mineMessage),outgoing=data.messages.filter(m=>String(m.sender_user_id)===data.uid);
 const unreadN=notices.filter(n=>!isNoticeRead(n)).length,unreadM=incoming.filter(m=>!m.read_at).length;
 $('dgn33-stats').innerHTML=`<div class="dgn33-stat"><strong>${notices.length}</strong> notifiche automatiche</div><div class="dgn33-stat"><strong>${unreadN}</strong> avvisi da leggere</div><div class="dgn33-stat"><strong>${unreadM}</strong> messaggi ricevuti da leggere</div>`;
 if(data.activeTab==='scrivi'){
   const other=data.operators.filter(o=>o.attivo!==false && String(o.user_id)!==data.uid);
   $('dgn33-actions').innerHTML='';
   list.innerHTML=`<form class="dgn33-compose" id="dgn33-form">
    <label>Destinatario<select id="dgn33-recipient" required>${other.length?other.map(o=>`<option value="${esc(o.user_id)}">${esc(o.nome||o.username)}</option>`).join(''):'<option value="">Nessun operatore disponibile</option>'}</select></label>
    <label>Oggetto<input id="dgn33-subject" maxlength="140" minlength="1" placeholder="Es. Pagamento ricevuto" required></label>
    <label class="full">Messaggio<textarea id="dgn33-body" maxlength="4000" minlength="1" placeholder="Scrivi il messaggio per l'altro operatore…" required></textarea></label>
    <div class="full"><button type="submit" class="dgn33-btn primary" ${!other.length?'disabled':''}>✉ Invia comunicazione</button> <span class="dgn33-help">Visibile solo al mittente e al destinatario.</span></div>
    </form>`;
   return;
 }
 const unreadFilter=`<label for="dgn33-filter" style="font-size:12px;color:#547084">Visualizza:</label><select id="dgn33-filter"><option value="all" ${data.filter==='all'?'selected':''}>Tutte</option><option value="unread" ${data.filter==='unread'?'selected':''}>Solo da leggere</option></select>`;
 $('dgn33-actions').innerHTML=(data.activeTab!=='inviati'?unreadFilter+'<button type="button" class="dgn33-btn primary" data-dgn33-action="mark-all">✓ Segna tutte come lette</button>':'')+'<button type="button" class="dgn33-btn" data-dgn33-action="refresh">↻ Aggiorna</button>';
 if(data.activeTab==='notifiche'){
  const shown=notices.filter(n=>data.filter==='all'||!isNoticeRead(n));
  list.innerHTML=shown.length?shown.map(n=>{
   const read=isNoticeRead(n); const ref=String(n.riferimento||'');
   const action=/prenotaz|acconto|saldo/i.test(`${n.titolo||''} ${n.messaggio||''}`)?'prenotazioni':/preventiv/i.test(n.titolo||'')?'preventivi':'';
   return `<article class="dgn33-item ${read?'':'unread'}"><div class="dgn33-content"><h3>${esc(n.titolo||'Avviso gestionale')}</h3><p>${esc(n.messaggio||'')}</p><div class="dgn33-meta"><span>🕒 ${esc(datetime(n.created_at))}</span>${ref?`<span>Rif. ${esc(ref.slice(0,8))}</span>`:''}</div></div><div class="dgn33-side"><span class="dgn33-pill ${read?'':'new'}">${read?'Letta':'Da leggere'}</span>${!read?`<button type="button" class="dgn33-btn" data-dgn33-read-notice="${esc(n.id)}">✓ Letta</button>`:''}${action?`<button type="button" class="dgn33-btn" data-dgn33-open="${action}">Apri ${action==='prenotazioni'?'prenotazioni':'preventivi'} ↗</button>`:''}</div></article>`;
  }).join(''):'<div class="dgn33-empty">Nessuna notifica in questa selezione.</div>';
  return;
 }
 const records=(data.activeTab==='ricevuti'?incoming:outgoing).filter(m=>data.activeTab==='inviati'||data.filter==='all'||!m.read_at);
 list.innerHTML=records.length?records.map(m=>{
  const received=mineMessage(m),read=Boolean(m.read_at);
  return `<article class="dgn33-item ${received&&!read?'unread':''}"><div class="dgn33-content"><h3>${esc(m.subject||'Messaggio')}</h3><p>${esc(m.body||'')}</p><div class="dgn33-meta"><span>🕒 ${esc(datetime(m.created_at))}</span><span>${received?'Da':'A'}: ${esc(who(received?m.sender_user_id:m.recipient_user_id))}</span></div></div><div class="dgn33-side"><span class="dgn33-pill ${received&&!read?'new':''}">${received?(read?'Letto':'Da leggere'):(read?'Letto dal destinatario':'Inviato')}</span>${received&&!read?`<button type="button" class="dgn33-btn" data-dgn33-read-message="${esc(m.id)}">✓ Segna letto</button>`:''}</div></article>`;
 }).join(''):'<div class="dgn33-empty">Nessun messaggio in questa selezione. Puoi scrivere direttamente a Nicola o Raffaele.</div>';
}
function onClick(e){
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.dgn33Tab){data.activeTab=b.dataset.dgn33Tab;data.filter='all';paint();if(now()-data.lastFetch>10000)refresh();return}
 if(b.dataset.dgn33ReadNotice)return void markNotice(b.dataset.dgn33ReadNotice);
 if(b.dataset.dgn33ReadMessage)return void markMessage(b.dataset.dgn33ReadMessage);
 if(b.dataset.dgn33Open){if(typeof go==='function')go(b.dataset.dgn33Open);return}
 const action=b.dataset.dgn33Action;
 if(action==='refresh')refresh();if(action==='mark-all')markAll();if(action==='browser')enableBrowser();
}
async function sendMessage(e){
 if(e.target.id!=='dgn33-form')return;e.preventDefault();
 const uid=userId();if(!uid)return;
 const recipient=$('dgn33-recipient')?.value,subject=$('dgn33-subject')?.value.trim(),body=$('dgn33-body')?.value.trim();
 if(!recipient||recipient===uid||!subject||!body){data.error='Controlla destinatario, oggetto e messaggio';paint();return}
 const btn=e.target.querySelector('button[type=submit]');if(btn)btn.disabled=true;
 try{
  await apiCall('dg_operator_communications','',{method:'POST',body:{sender_user_id:uid,recipient_user_id:recipient,subject,body}});
  data.activeTab='inviati';data.error='';
  await refresh(true);
  if(typeof toast==='function')toast('Comunicazione inviata correttamente');
 }catch(err){data.error='Invio non riuscito: '+String(err?.message||err); if(btn)btn.disabled=false;const area=$('dgn33-error');if(area)area.innerHTML=`<div class="dgn33-error">${esc(data.error)}</div>`;}
}
async function markNotice(id){
 const n=data.notices.find(n=>String(n.id)===String(id));if(!n||isNoticeRead(n))return;
 try{
  await apiCall('dg_notification_reads','',{method:'POST',body:{notification_id:id,operator_user_id:data.uid}});
  data.reads.add(id);data.error='';paint();
 }catch(err){if(/23505|duplicate key/i.test(String(err?.message||err))){data.reads.add(id);paint();return}data.error='Non è stato possibile segnare la notifica: '+String(err?.message||err);paint()}
}
async function markMessage(id){
 const m=data.messages.find(m=>String(m.id)===String(id));if(!m||!mineMessage(m)||m.read_at)return;
 const readAt=new Date().toISOString();
 try{
  const updated=await apiCall('dg_operator_communications',`id=eq.${encodeURIComponent(id)}&recipient_user_id=eq.${encodeURIComponent(data.uid)}`,{method:'PATCH',body:{read_at:readAt}});
  if(Array.isArray(updated)&&!updated.length)throw new Error('Messaggio non aggiornato');
  m.read_at=readAt;data.error='';paint();
 }catch(err){data.error='Errore durante la lettura del messaggio: '+String(err?.message||err);paint()}
}
async function markAll(){
 try{
  if(data.activeTab==='notifiche'){
   const pending=data.notices.filter(n=>isMyNotice(n)&&!isNoticeRead(n));
   if(!pending.length){if(typeof toast==='function')toast('Tutte le notifiche sono già lette');return}
   // POST per batch; lo storico della vecchia colonna globale "letto" non viene modificato.
   await apiCall('dg_notification_reads','',{method:'POST',body:pending.map(n=>({notification_id:n.id,operator_user_id:data.uid})),headers:{'Prefer':'resolution=ignore-duplicates,return=representation'}});
   pending.forEach(n=>data.reads.add(n.id));
  }else if(data.activeTab==='ricevuti'){
   const pending=data.messages.filter(m=>mineMessage(m)&&!m.read_at);
   if(!pending.length){if(typeof toast==='function')toast('Tutti i messaggi sono già letti');return}
   const readAt=new Date().toISOString();
   await apiCall('dg_operator_communications',`recipient_user_id=eq.${encodeURIComponent(data.uid)}&read_at=is.null`,{method:'PATCH',body:{read_at:readAt}});
   pending.forEach(m=>m.read_at=readAt);
  }
  data.error='';paint();if(typeof toast==='function')toast('Stato di lettura aggiornato');
 }catch(err){data.error='Aggiornamento non riuscito: '+String(err?.message||err);paint()}
}
async function enableBrowser(){
 if(!('Notification' in window)||!window.isSecureContext){data.error='Gli avvisi del browser richiedono HTTPS e un browser compatibile.';paint();return}
 try{const result=await Notification.requestPermission();data.browserAllowed=result==='granted';if(result!=='granted')data.error='Permesso non concesso. Le notifiche interne restano attive.';else data.error='';paint();}
 catch(err){data.error=String(err?.message||err);paint()}
}
function foregroundNotify(title,body){if(!('Notification' in window)||Notification.permission!=='granted'||!window.isSecureContext)return;
 try{const n=new Notification(title,{body:String(body||'').slice(0,160),tag:'dg-comms-v3'});n.onclick=()=>{window.focus();if(typeof go==='function')go('comunicazioni');n.close()}}catch{}
}
async function refresh(force=false){
 const uid=userId();if(!uid){if(data.uid){data.uid='';data.notices=[];data.reads.clear();data.messages=[];data.operators=[];data.seen.clear();data.initial=true;data.lastFetch=0;data.error='';}paint();return}
 if(uid!==data.uid){data.uid=uid;data.notices=[];data.reads.clear();data.messages=[];data.operators=[];data.seen.clear();data.initial=true;data.lastFetch=0;data.error='';}
 if(data.busy)return;if(!force&&now()-data.lastFetch<9000)return;
 data.busy=true;paint();
 const specs=[['notifiche',`select=id,titolo,messaggio,tipo,letto,utente_id,riferimento,created_at&order=created_at.desc&limit=200`],
 ['dg_notification_reads',`select=notification_id,operator_user_id,read_at&operator_user_id=eq.${encodeURIComponent(uid)}&limit=400`],
 ['dg_operator_communications',`select=id,sender_user_id,recipient_user_id,subject,body,created_at,read_at&or=(sender_user_id.eq.${encodeURIComponent(uid)},recipient_user_id.eq.${encodeURIComponent(uid)})&order=created_at.desc&limit=200`],
 ['operatori_gestionale','select=user_id,nome,username,attivo&attivo=eq.true&order=nome.asc']];
 try{
  const results=await Promise.allSettled(specs.map(([t,q])=>apiCall(t,q,{noCache:true})));
  const failures=[];
  for(let i=0;i<results.length;i++){
   const r=results[i];if(r.status==='rejected'){failures.push(specs[i][0]+': '+String(r.reason?.message||r.reason));continue}
   const arr=Array.isArray(r.value)?r.value:[];
   if(i===0)data.notices=arr;
   if(i===1)data.reads=new Set(arr.filter(r=>r.operator_user_id===uid).map(r=>r.notification_id));
   if(i===2)data.messages=arr;
   if(i===3)data.operators=arr;
  }
  if(!failures.length){data.error='';data.lastFetch=now()}else data.error='Sincronizzazione parziale: '+failures.join('; ');
  // On the first load do not reopen old items as new browser alerts.
  const items=[...data.notices.filter(isMyNotice).map(n=>({key:'n:'+n.id,title:n.titolo||'Nuovo avviso',body:n.messaggio,unread:!isNoticeRead(n)})),
               ...data.messages.filter(mineMessage).map(m=>({key:'m:'+m.id,title:'Messaggio da '+who(m.sender_user_id),body:m.subject,unread:!m.read_at}))];
  if(!data.initial){for(const x of items){if(!data.seen.has(x.key)&&x.unread)foregroundNotify(x.title,x.body)}}
  items.forEach(x=>data.seen.add(x.key));data.initial=false;
  // Keep legacy consumers in sync, but do not replace a failed remote read with [] on error.
  if(results[0].status==='fulfilled'){const s=currentState();if(s)s.notifiche=data.notices.slice()}
 }finally{data.busy=false;paint()}
}
function legacyMarker(id,read=true){if(read)markNotice(id)}
function boot(){
 install();
 window.renderNotifications=function(){paint();const id=userId();if(id&&(data.uid!==id||now()-data.lastFetch>15000))setTimeout(()=>refresh(),0)};
 window.markNotificationsRead=function(){data.activeTab='notifiche';markAll()};
 window.markAllNotificationsRead=function(){data.activeTab='notifiche';markAll()};
 window.markNotificationRead=legacyMarker;
 window.updateBadge=function(){badge()};
 window.dgCommsV3={refresh,render:paint,markAll,getUnreadCount:()=>data.notices.filter(n=>isMyNotice(n)&&!isNoticeRead(n)).length+data.messages.filter(m=>mineMessage(m)&&!m.read_at).length};
 D.addEventListener('click',e=>{if(e.target.closest?.('#notifBtn,[data-page="comunicazioni"]'))setTimeout(()=>refresh(),100)});
 setInterval(()=>{if(D.visibilityState!=='hidden')refresh()},20000);
 D.addEventListener('visibilitychange',()=>{if(D.visibilityState==='visible')refresh()});
 setTimeout(()=>refresh(),400);
}
if(D.readyState==='loading')D.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
