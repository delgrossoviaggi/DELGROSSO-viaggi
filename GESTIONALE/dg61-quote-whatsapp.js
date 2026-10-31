/* DELGROSSO V61 — trasferimento quote e centro WhatsApp.
 * I movimenti delle quote sono RPC atomiche; invio WhatsApp non automatico senza Meta.
 */
(function(){
'use strict';
const WA_BUSINESS='393208815899';
const $=id=>document.getElementById(id);
// Recover the authenticated Supabase user in this module's own scope.
// The identically named helper in another IIFE is not visible here.
const uid=()=>typeof authSession!=='undefined'?(authSession?.user?.id||null):null;
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const euro=n=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(n)||0);
const canManage=()=>typeof can==='function'&&can('cassa','write');
const activeOperators=()=> (state.operatori||[]).filter(o=>o.attivo!==false && ['nicola','raffaele'].includes(String(o.username||'').toLowerCase()));
const ownerId=p=>p.incassato_da_user_id||activeOperators().find(o=>[o.nome,o.username].some(v=>String(v||'').toLowerCase()===String(p.incassato_da||'').toLowerCase()))?.user_id||null;
const opName=id=>activeOperators().find(o=>o.user_id===id)?.nome||'Da attribuire';
function eligiblePayments(){
 const rejected=p=>/annull|storn|rimbors|rifiutat|failed/i.test(String(p.tipo||'')+' '+String(p.stato||''))||!(Number(p.importo)>0);
 const tripMap=new Map((state.viaggi||[]).map(v=>[v.id,v]));
 const bookMap=new Map((state.prenotazioni||[]).map(b=>[b.id,b]));
 const rentalMap=new Map((state.noleggi||[]).map(v=>[v.id,v]));
 const travel=(state.pagamenti||[]).filter(p=>!rejected(p)).map(p=>{
   let id=p.viaggio_id||bookMap.get(p.prenotazione_id)?.viaggio_id;
   return {id:p.id,tipo:'viaggio',amount:Number(p.importo),owner:ownerId(p),label:'🚌 '+(tripMap.get(id)?.titolo||tripMap.get(id)?.destinazione||p.viaggio||'Gita')+' · '+(p.cliente||bookMap.get(p.prenotazione_id)?.cliente||'Cliente')+' · '+euro(p.importo)};
 });
 const rentals=(state.noleggiPagamenti||[]).filter(p=>!rejected(p)).map(p=>{
   const n=rentalMap.get(p.noleggio_id);return {id:p.id,tipo:'noleggio',amount:Number(p.importo),owner:ownerId(p),label:'🚐 '+(n?.tratta_partenza||'Noleggio')+' → '+(n?.tratta_destinazione||'')+' · '+(n?.referente||n?.azienda||'Cliente')+' · '+euro(p.importo)};
 });
 return [...travel,...rentals];
}
function portions(p){const values={};if(p.owner)values[p.owner]=Number(p.amount);
 for(const t of state.quoteTransfers||[]){if(t.tipo_origine!==p.tipo||t.pagamento_id!==p.id)continue;
  values[t.da_operatore_user_id]=(values[t.da_operatore_user_id]||0)-Number(t.importo||0);
  values[t.a_operatore_user_id]=(values[t.a_operatore_user_id]||0)+Number(t.importo||0);
 }return values;}
function renderTransfers(){
 const panel=$('dg61QuoteTransfersPanel');if(!panel)return;
 const ops=activeOperators();const history=(state.quoteTransfers||[]).slice(0,12);
 const totals=Object.fromEntries(ops.map(o=>[o.user_id,0]));
 for(const p of eligiblePayments())for(const [id,amt] of Object.entries(portions(p)))if(totals[id]!=null)totals[id]+=amt;
 panel.innerHTML='<div class="dg61-kpis">'+ops.map(o=>'<div><small>Quote attribuite a '+escapeHtml(o.nome)+'</small><strong>'+euro(totals[o.user_id]||0)+'</strong></div>').join('')+'</div>'+
 '<p style="margin:10px 0;color:#53647b">I trasferimenti ripartiscono le quote tra operatori: <b>non registrano un nuovo pagamento e non spostano fisicamente contanti</b>. Per passaggi di denaro usare “Trasferisci cassa”.</p>'+
 (history.length?history.map(t=>'<div class="dg61-history"><span><b>'+escapeHtml(opName(t.da_operatore_user_id))+' → '+escapeHtml(opName(t.a_operatore_user_id))+'</b><small>'+escapeHtml(t.tipo_origine)+' · '+escapeHtml((t.created_at||'').slice(0,10))+' · '+escapeHtml(t.nota||'')+'</small></span><b>'+euro(t.importo)+'</b></div>').join(''):'<div class="empty">Nessun trasferimento quote registrato.</div>');
}
window.dg61OpenQuoteTransfer=function(){
 if(!canManage())return toast('Servono i permessi di scrittura Cassa.',false);
 const ops=activeOperators(),payments=eligiblePayments().filter(p=>p.owner);
 if(ops.length<2)return toast('Nicola e Raffaele non risultano entrambi attivi.',false);
 if(!payments.length)return toast('Nessun pagamento attribuito disponibile da trasferire.',false);
 const selector=payments.map((p,i)=>'<option value="'+i+'">'+escapeHtml(p.label)+'</option>').join('');
 const opt=ops.map(o=>'<option value="'+o.user_id+'">'+escapeHtml(o.nome)+'</option>').join('');
 openModal('⇄ Trasferimento quote gite / noleggi',
 '<div class="statusline info">Seleziona un pagamento realmente incassato, una quota disponibile e l’operatore destinatario. Il totale incassato non cambia.</div><div class="form-grid">'+
 '<div class="field full"><label>Pagamento da ripartire</label><select id="dg61TxPayment" onchange="dg61UpdateMax()">'+selector+'</select></div>'+
 '<div class="field"><label>Da</label><select id="dg61TxFrom" onchange="dg61UpdateMax()">'+opt+'</select></div>'+
 '<div class="field"><label>A</label><select id="dg61TxTo">'+opt+'</select></div>'+
 '<div class="field"><label>Quota da trasferire €</label><input id="dg61TxAmount" type="number" min="0.01" step="0.01" inputmode="decimal"></div>'+
 '<div class="field"><label>Quota disponibile</label><div class="dg61-amount" id="dg61MaxAmount">—</div></div>'+
 '<div class="field full"><label>Motivo / nota</label><textarea id="dg61TxNote" maxlength="500" placeholder="Es. ripartizione quota noleggio"></textarea></div></div>',
 '<button class="btn btn-secondary" onclick="closeModal()">Annulla</button><button class="btn btn-primary" id="dg61TxSave" onclick="dg61SaveQuoteTransfer()">Registra trasferimento</button>');
 window.__dg61Payments=payments;
 $('dg61TxFrom').value=payments[0].owner;
 $('dg61TxTo').value=ops.find(o=>o.user_id!==payments[0].owner)?.user_id||ops[1].user_id;
 dg61UpdateMax();
};
window.dg61UpdateMax=function(){const p=window.__dg61Payments?.[Number($('dg61TxPayment')?.value)];if(!p)return;
 const current=$('dg61TxFrom')?.value||p.owner;
 $('dg61MaxAmount').textContent=euro(Math.max(0,portions(p)[current]||0));
 if(!$('dg61TxFrom')?.value)$('dg61TxFrom').value=p.owner;
 if($('dg61TxFrom').value===$('dg61TxTo').value)$('dg61TxTo').value=activeOperators().find(o=>o.user_id!==$('dg61TxFrom').value)?.user_id||'';
};
window.dg61SaveQuoteTransfer=async function(){
 if(!canManage())return toast('Operazione non autorizzata.',false);
 const p=window.__dg61Payments?.[Number($('dg61TxPayment')?.value)];
 const from=$('dg61TxFrom')?.value,to=$('dg61TxTo')?.value,amount=Math.round(Number($('dg61TxAmount')?.value||0)*100)/100;
 const max=portions(p||{})[from]||0;
 if(!p||!from||!to||from===to||!Number.isFinite(amount)||amount<=0||amount>max+0.001)return toast('Verifica operatori, importo e quota disponibile.',false);
 if(!confirm('Trasferire '+euro(amount)+' da '+opName(from)+' a '+opName(to)+'? Il pagamento originale rimane invariato.'))return;
 const btn=$('dg61TxSave');btn.disabled=true;btn.textContent='Registrazione…';
 // A single request ID is retained during a retry to avoid duplicate transfers.
 const requestId=window.__dg61RequestId||(window.__dg61RequestId=crypto.randomUUID());
 try{
   await rpc('dg_transfer_quote_v61',{p_tipo_origine:p.tipo,p_pagamento_id:p.id,p_da_operatore_user_id:from,p_a_operatore_user_id:to,p_importo:amount,p_nota:($('dg61TxNote')?.value||'').trim(),p_request_id:requestId});
   window.__dg61RequestId=null;closeModal();toast('Quota trasferita e registrata.');await loadAll(true);
   if(state.page==='contabilitaquote')dgQuoteRender();else renderTransfers();
 }catch(e){toast('Trasferimento non eseguito: '+(e.message||e),false)}finally{btn.disabled=false;btn.textContent='Registra trasferimento'}
};
const priorCash=window.renderCash7;
window.renderCash7=function(){if(typeof priorCash==='function')priorCash();renderTransfers()};

function normalizedPhone(value){let p=String(value||'').replace(/[^\d+]/g,'');p=p.replace(/^00/,'+');let digits=p.replace(/\D/g,'');if(!digits)return '';if(digits.length===10)digits='39'+digits;return digits.length>=10&&digits.length<=15?digits:''}
function safeWhatsAppChat(number,text){const digits=normalizedPhone(number);if(!digits)return toast('Numero cliente non valido.',false);window.open('https://wa.me/'+digits+'?text='+encodeURIComponent(text),'_blank','noopener,noreferrer')}
function activeBookings(){return (state.prenotazioni||[]).filter(b=>!b.riserva_aziendale&&!/annull|cancel/i.test(String(b.stato||''))&&normalizedPhone(b.telefono))}
function getBooking(){return activeBookings().find(b=>b.id===$('dg61WaBooking')?.value)}
function getTrip(b){return (state.viaggi||[]).find(v=>v.id===b?.viaggio_id)}
function getInvite(id){return (state.whatsappInvites||[]).find(g=>g.trip_id===id)?.invite_url||''}
function preparedMessage(b,kind){if(!b)return '';
 const v=getTrip(b),nom=String(b.cliente||b.cliente_nome||'Cliente').trim(),trip=v?.titolo||v?.destinazione||'il viaggio',date=v?.data_partenza||'data da definire',seats=b.posti_selezionati||'da confermare';
 const header='DELGROSSO VIAGGI & LIMOUSINE BUS\nWhatsApp ufficiale: +39 320 881 5899\n\nGentile '+nom+',\n';
 if(kind==='confirmation')return header+'la tua prenotazione per '+trip+' ('+date+') risulta registrata.\nPartecipanti: '+(b.posti||0)+'; posti: '+seats+'; fermata: '+(b.fermata_partenza||'da definire')+'.\nTotale: '+euro(b.totale)+'; già versato: '+euro(b.pagato||0)+'; residuo: '+euro(b.saldo||0)+'.\nCodice: '+(b.codice||b.id_prenotazione||'da verificare')+'.\nPer chiarimenti rispondi a questo messaggio.';
 if(kind==='deposit')return header+'ti ricordiamo l’acconto previsto per '+trip+' ('+date+'). '+(b.scadenza_acconto?'Scadenza: '+b.scadenza_acconto+'. ':'')+'Ti chiediamo di contattarci per concordare o confermare il versamento. Eventuali modifiche dei posti avverranno solo dopo una verifica da parte del nostro personale.';
 if(kind==='balance')return header+'per '+trip+' ('+date+') risulta un saldo di '+euro(b.saldo||0)+'. Se hai già pagato, inviaci gentilmente la conferma così aggiorniamo la tua prenotazione.';
 if(kind==='receipt')return header+'abbiamo registrato un pagamento per '+trip+'. Conserva questo messaggio; la ricevuta PDF ufficiale deve essere allegata separatamente da un nostro operatore.';
 const invite=getInvite(b.viaggio_id);return invite?header+'per gli aggiornamenti del viaggio '+trip+' puoi scegliere liberamente di entrare nel gruppo WhatsApp tramite questo link: '+invite+'\nLa partecipazione al gruppo è facoltativa e gli altri partecipanti possono vedere il tuo numero.':header+'il gruppo del viaggio '+trip+' non è ancora stato predisposto. Riceverai l’invito quando sarà disponibile.';
}
window.dg61RenderWhatsApp=function(){
 const target=$('dg61WaInbox');if(!target)return;
 const rows=(state.whatsappInbox||[]).filter(x=>x.status!=='ignorata').slice(0,60);
 target.innerHTML=rows.length?rows.map(m=>'<div class="dg61-wa-entry"><strong>'+escapeHtml(m.sender_name||m.sender_phone)+'</strong><small>'+escapeHtml((m.received_at||'').replace('T',' ').slice(0,16))+' · '+escapeHtml(m.status)+'</small><p>'+escapeHtml(m.message_text||'Messaggio multimediale')+'</p><div class="quick-actions"><button class="btn btn-secondary btn-sm" onclick="dg61WorkInbox(\''+m.id+'\')">Segna in lavorazione</button><button class="btn btn-secondary btn-sm" onclick="dg61CompleteInbox(\''+m.id+'\')">Gestita</button><button class="btn btn-primary btn-sm" onclick="dg61OpenClient(\''+m.sender_phone+'\')">Rispondi</button></div></div>').join(''):'<div class="empty">Nessuna richiesta sincronizzata. La ricezione automatica richiede la configurazione Meta.</div>';
 const sel=$('dg61WaBooking'),last=sel?.value||'';const bookings=activeBookings().slice(0,400);
 if(sel){sel.innerHTML=bookings.map(b=>'<option value="'+b.id+'">'+escapeHtml(b.cliente||b.cliente_nome||'Cliente')+' · '+escapeHtml(getTrip(b)?.titolo||'Viaggio')+'</option>').join('');if(bookings.some(b=>b.id===last))sel.value=last;}
 const b=getBooking(),kind=$('dg61WaKind')?.value||'confirmation';if($('dg61WaPreview'))$('dg61WaPreview').value=preparedMessage(b,kind);
 const trips=(state.viaggi||[]).filter(v=>!v.archiviato_at),g=$('dg61GroupTrip'),old=g?.value||'';
 if(g){g.innerHTML=trips.map(v=>'<option value="'+v.id+'">'+escapeHtml(v.titolo||v.destinazione||'Viaggio')+' · '+escapeHtml(v.data_partenza||'')+'</option>').join('');if(trips.some(v=>v.id===old))g.value=old;}dg61RenderGroupLink();
};
window.dg61OpenClient=phone=>safeWhatsAppChat(phone,'Buongiorno, siamo DELGROSSO VIAGGI. In merito alla tua richiesta, possiamo aiutarti?');
window.dg61WorkInbox=async id=>{try{await api('dg_whatsapp_inbox_v61','id=eq.'+id,{method:'PATCH',body:{status:'in_lavorazione'}});await loadAll(true)}catch(e){toast(e.message,false)}};
window.dg61CompleteInbox=async id=>{try{await api('dg_whatsapp_inbox_v61','id=eq.'+id,{method:'PATCH',body:{status:'completata'}});await loadAll(true)}catch(e){toast(e.message,false)}};
window.dg61SendManualMessage=function(){const b=getBooking();if(!b)return toast('Scegli una prenotazione.',false);const kind=$('dg61WaKind').value;
 if(['deposit','balance','invitation'].includes(kind)){
   const phone=normalizedPhone(b.telefono);
   const opt=(state.whatsappOptins||[]).find(x=>normalizedPhone(x.phone)===phone&&!x.revoked_at);
   if(!opt)return toast('Prima registra il consenso WhatsApp verificato del cliente.',false);
 }
 if(kind==='receipt')alert('ATTENZIONE: il testo non contiene il PDF. Allega la ricevuta autentica dal gestionale prima di inviare.');
 safeWhatsAppChat(b.telefono,$('dg61WaPreview')?.value||preparedMessage(b,kind));
};
window.dg61CopyMessage=async()=>{const text=$('dg61WaPreview')?.value||'';try{await navigator.clipboard.writeText(text);toast('Messaggio copiato')}catch{toast('Copia non disponibile: seleziona il testo.',false)}};
// WhatsApp Business on iPhone may paste a full shared message or an invite
// with query parameters. Store only the canonical invitation, not the shared text.
function dg61NormalizeGroupInvite(raw){
 const text=String(raw||'').normalize('NFKC').replace(/[\u200B-\u200D\u2060\uFEFF]/g,'').trim();
 const pattern=/(?:^|[\s*("'<>])((?:https?:\/\/)?(?:www\.)?chat\.whatsapp\.com\/(?:invite\/)?[A-Za-z0-9_-]{8,64})(?=$|[\s)"'<>/?#.,!?])/gi;
 for(const match of text.matchAll(pattern)){
  try{
   const rawUrl=match[1];
   const u=new URL(/^https?:\/\//i.test(rawUrl)?rawUrl:'https://'+rawUrl);
   if(u.hostname.toLowerCase()!=='chat.whatsapp.com'&&u.hostname.toLowerCase()!=='www.chat.whatsapp.com')continue;
   const p=u.pathname.match(/^\/(?:invite\/)?([A-Za-z0-9_-]{8,64})\/?$/);
   if(p)return 'https://chat.whatsapp.com/'+p[1];
  }catch{}
 }
 return '';
}
window.dg61NormalizeGroupInvite=dg61NormalizeGroupInvite;
window.dg61RenderGroupLink=()=>{if($('dg61GroupUrl'))$('dg61GroupUrl').value=getInvite($('dg61GroupTrip')?.value)};
let dg61SavingGroupLink=false;
window.dg61SaveGroupLink=async()=>{
 if(dg61SavingGroupLink)return;
 const trip_id=$('dg61GroupTrip')?.value,input=$('dg61GroupUrl');
 if(!trip_id)return toast('Seleziona prima il viaggio o il BUS BIS.',false);
 if(!uid())return toast('Sessione scaduta: accedi nuovamente al gestionale e riprova.',false);
 const url=dg61NormalizeGroupInvite(input?.value);
 if(!url){
  input?.focus();
  return toast('Link WhatsApp non riconosciuto. Copia tutto il link d’invito dal gruppo WhatsApp Business, non il nome del gruppo.',false);
 }
 if(input)input.value=url;
 const saveButton=document.querySelector('button[onclick="dg61SaveGroupLink()"]');
 dg61SavingGroupLink=true;
 if(saveButton)saveButton.disabled=true;
 try{
  const saved=await api('dg_whatsapp_trip_invites_v61','on_conflict=trip_id',{
   method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},
   body:{trip_id,invite_url:url,updated_at:new Date().toISOString(),updated_by:uid()}
  });
  // The previous implementation declared success even if no row was returned.
  const confirmed=Array.isArray(saved)?saved.find(x=>x.trip_id===trip_id&&x.invite_url===url):null;
  if(!confirmed)throw new Error('Il server non ha confermato il link. Verifica i permessi del tuo accesso.');
  const invites=state.whatsappInvites||[];
  const idx=invites.findIndex(x=>x.trip_id===trip_id);
  if(idx>=0)invites[idx]=confirmed;else invites.push(confirmed);
  state.whatsappInvites=invites;
  if(typeof window.dg68RenderGroups==='function')window.dg68RenderGroups();
  toast('Link del gruppo WhatsApp salvato correttamente.');
  try{await loadAll(true)}catch(refreshError){console.warn('Aggiornamento elenco gruppi non riuscito',refreshError)}
 }catch(e){
  toast('Non riesco a salvare il link: '+(e?.message||'controlla la connessione e riprova.'),false);
 }finally{
  dg61SavingGroupLink=false;
  if(saveButton)saveButton.disabled=false;
 }
};
window.dg61CopyGroupLink=async()=>{const link=$('dg61GroupUrl')?.value||'';if(!link)return toast('Nessun invito salvato.',false);try{await navigator.clipboard.writeText(link);toast('Link copiato')}catch{toast('Copia link non disponibile',false)}};
window.dg61SaveOptin=async()=>{const phone=normalizedPhone($('dg61OptPhone')?.value),source=$('dg61OptSource')?.value;if(!phone)return toast('Numero non valido.',false);if(!confirm('Confermi di aver verificato il consenso esplicito del cliente a essere contattato su WhatsApp?'))return;
 try{await api('dg_whatsapp_optins_v61','on_conflict=phone',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:{phone,customer_name:($('dg61OptName')?.value||'').trim(),consent_source:source,consent_at:new Date().toISOString(),revoked_at:null,updated_at:new Date().toISOString(),updated_by:uid()}});toast('Consenso registrato');await loadAll(true)}catch(e){toast(e.message,false)}};
window.dg61RevokeOptin=async()=>{const phone=normalizedPhone($('dg61OptPhone')?.value);if(!phone)return toast('Numero non valido.',false);
 try{await api('dg_whatsapp_optins_v61','phone=eq.'+encodeURIComponent(phone),{method:'PATCH',body:{revoked_at:new Date().toISOString(),updated_at:new Date().toISOString(),updated_by:uid()}});toast('Consenso revocato');await loadAll(true)}catch(e){toast(e.message,false)}};
// Sidebar in newer DELGROSSO skin: add the link there as well if needed.
function ensureModernSidebar(){const sidebar=document.getElementById('dg44-sidebar-menu');if(!sidebar||sidebar.querySelector('[data-dg44-target="whatsapp"]'))return;
 const copy=sidebar.querySelector('[data-dg44-target="comunicazioni"]')||sidebar.querySelector('.dg44-nav-button');if(!copy)return;
 const btn=copy.cloneNode(true);btn.dataset.dg44Target='whatsapp';btn.querySelector('span')?.replaceChildren(document.createTextNode('WhatsApp Business'));
 btn.addEventListener('click',()=>window.go?.('whatsapp'));copy.insertAdjacentElement('afterend',btn);
}
document.addEventListener('DOMContentLoaded',()=>{ensureModernSidebar();setTimeout(ensureModernSidebar,500)});
})();
