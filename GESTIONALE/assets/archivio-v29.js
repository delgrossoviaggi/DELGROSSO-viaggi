import { openStoredReceipt, downloadStoredReceipt } from './paymentReceiptService-v24.js';
import { openBookingConfirmation, resendBookingEmail, resendPaymentEmail } from './bookingDocumentsService-v25.js';

const SUPABASE_URL='https://chkuayhbmitdmzmmvona.supabase.co';
const SUPABASE_KEY='sb_publishable_H29K1BV5ZE1rT8xo0PIzVA_wF6zC7je';
const BOOKING_FN=`${SUPABASE_URL}/functions/v1/send-booking-confirmation`;
const headers={apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`};
let rows=[]; let activeFilter='all'; let refreshTimer=null; let lastSyncAt=null;
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const fmtDate=v=>{if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?String(v).slice(0,10):d.toLocaleDateString('it-IT')};
const money=v=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(v||0));
const customer=o=>String(o.cliente||o.cliente_nome||[o.nome,o.cognome].filter(Boolean).join(' ')||'Cliente').trim();
const trip=o=>String(o.viaggio||o.viaggio_codice||o.destinazione||o.titolo||'—').trim();

async function restArchive(){
  const viewUrl=`${SUPABASE_URL}/rest/v1/archivio_documenti?select=*&order=data_documento.desc.nullslast&limit=2000`;
  const r=await fetch(viewUrl,{headers}); const d=await r.json().catch(()=>[]);
  if(r.ok) return Array.isArray(d)?d:[];
  console.warn('[Archivio] Vista archivio_documenti non disponibile:',r.status,d);
  // Fallback: same Supabase data source, no duplicate DB/table.
  const [pRes,gRes]=await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/prenotazioni?select=*&confirmation_storage_path=not.is.null&order=confirmation_generated_at.desc&limit=2000`,{headers}),
    fetch(`${SUPABASE_URL}/rest/v1/pagamenti?select=*&receipt_storage_path=not.is.null&order=receipt_generated_at.desc&limit=2000`,{headers})
  ]);
  const p=await pRes.json().catch(()=>[]), g=await gRes.json().catch(()=>[]);
  if(!pRes.ok||!gRes.ok) throw new Error(d?.message||`Errore lettura Archivio Supabase (${r.status})`);
  const trips=await fetch(`${SUPABASE_URL}/rest/v1/viaggi?select=id,titolo,destinazione&limit=2000`,{headers}).then(x=>x.ok?x.json():[]).catch(()=>[]);
  const tripMap=new Map((Array.isArray(trips)?trips:[]).map(x=>[String(x.id),x]));
  const bookingDocs=(Array.isArray(p)?p:[]).map(x=>({tipo_documento:'prenotazione',documento_id:x.id,numero_documento:x.confirmation_number,prenotazione_id:x.id,pagamento_id:null,viaggio_id:x.viaggio_id,cliente:x.cliente_nome||x.cliente,viaggio:tripMap.get(String(x.viaggio_id))?.titolo||x.viaggio_codice||'—',email:x.email,telefono:x.telefono,data_documento:x.confirmation_generated_at,importo:x.totale,storage_path:x.confirmation_storage_path,email_inviata:x.confirmation_email_sent,email_inviata_at:x.confirmation_email_sent_at,email_errore:x.confirmation_email_error,updated_at:x.updated_at}));
  const paymentDocs=(Array.isArray(g)?g:[]).map(x=>({tipo_documento:String(x.tipo||'').toLowerCase()==='saldo'?'saldo':'acconto',documento_id:x.id,numero_documento:x.receipt_number,prenotazione_id:x.prenotazione_id,pagamento_id:x.id,cliente:x.cliente,viaggio:tripMap.get(String(x.viaggio_id))?.titolo||x.viaggio||'—',email:null,telefono:null,data_documento:x.receipt_generated_at,importo:x.importo,storage_path:x.receipt_storage_path,email_inviata:x.receipt_email_sent,email_inviata_at:x.receipt_email_sent_at,email_errore:x.receipt_email_error,updated_at:x.updated_at}));
  return [...bookingDocs,...paymentDocs].sort((a,b)=>new Date(b.data_documento||0)-new Date(a.data_documento||0));
}
async function signedBooking(path){
  const r=await fetch(BOOKING_FN,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({action:'signed_url',path})});
  const d=await r.json().catch(()=>({})); if(!r.ok||!d.signedUrl)throw new Error(d.error||'Conferma PDF non disponibile.'); return d.signedUrl;
}
async function downloadBooking(path,number){
  const url=await signedBooking(path); const r=await fetch(url); if(!r.ok)throw new Error('Download conferma non riuscito.');
  const blob=await r.blob(); const object=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=object; a.download=`Conferma_Prenotazione_${number||'viaggio'}.pdf`; document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(object),1000);
}
function normalize(documents){
  return (documents||[]).map(d=>{
    const type=String(d.tipo_documento||'').toLowerCase();
    const kind=type==='prenotazione'?'booking':type==='saldo'?'saldo':'acconto';
    return {
      kind,
      id:d.documento_id,
      number:d.numero_documento||'—',
      customer:customer(d),
      trip:trip(d),
      date:d.data_documento,
      amount:d.importo,
      path:d.storage_path,
      emailSent:!!d.email_inviata,
      raw:d
    };
  }).sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
}
function stats(){
  $('#stat-total').textContent=rows.length; $('#stat-booking').textContent=rows.filter(x=>x.kind==='booking').length; $('#stat-acconto').textContent=rows.filter(x=>x.kind==='acconto').length; $('#stat-saldo').textContent=rows.filter(x=>x.kind==='saldo').length;
}
function label(k){return k==='booking'?'Conferma prenotazione':k==='saldo'?'Ricevuta saldo':'Ricevuta acconto'}
function render(){
  const q=($('#archive-search')?.value||'').trim().toLowerCase();
  const filtered=rows.filter(r=>(activeFilter==='all'||r.kind===activeFilter)&&(!q||[r.number,r.customer,r.trip,label(r.kind)].join(' ').toLowerCase().includes(q)));
  const body=$('#archive-body'); if(!body)return;
  if(!filtered.length){body.innerHTML=`<tr><td colspan="8"><div class="archive-empty">Nessun documento trovato.</div></td></tr>`;return;}
  body.innerHTML=filtered.map(r=>`<tr>
    <td><span class="archive-type ${r.kind}">${r.kind==='booking'?'📄':r.kind==='saldo'?'✅':'💶'} ${esc(label(r.kind))}</span></td>
    <td><strong>${esc(r.number)}</strong><div class="archive-related">${r.kind==='booking'?`<a href="./prenotazione.html?id=${encodeURIComponent(r.id)}">Prenotazione</a>`:`<a href="./pagamenti.html?id=${encodeURIComponent(r.id)}">Pagamento</a>`}</div></td><td>${esc(r.customer)}</td><td>${esc(r.trip)}</td><td>${esc(fmtDate(r.date))}</td>
    <td>${r.amount==null?'—':`<strong>${esc(money(r.amount))}</strong>`}</td>
    <td>${r.emailSent?'<span class="archive-email-ok">✓ Inviata</span>':'<span class="archive-email-no">—</span>'}</td>
    <td><div class="archive-actions">
      <button class="archive-btn primary" data-action="open" data-id="${esc(r.id)}">Apri PDF</button>
      <button class="archive-btn" data-action="download" data-id="${esc(r.id)}">Scarica</button>
      <button class="archive-btn" data-action="email" data-id="${esc(r.id)}">Reinvia email</button>
    </div></td></tr>`).join('');
}
function syncState(ok=true){
  const box=$('#archive-sync-status')?.parentElement;
  const label=$('#archive-sync-status');
  lastSyncAt=new Date();
  if(label) label.textContent=ok?`Supabase sincronizzato · ${lastSyncAt.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`:'Connessione Supabase da verificare';
  box?.classList.toggle('is-warning',!ok);
}

async function load(){
  const error=$('#archive-error'); error?.classList.remove('is-visible');
  try{
    const documents=await restArchive();
    rows=normalize(documents); stats(); render(); syncState(true);
  }catch(e){console.error(e); syncState(false); if(error){error.textContent=`Impossibile caricare l'archivio: ${e.message||e}`;error.classList.add('is-visible');} $('#archive-body').innerHTML=`<tr><td colspan="8"><div class="archive-empty">Archivio non disponibile.</div></td></tr>`;}
}
async function act(action,id,button){
  const row=rows.find(x=>String(x.id)===String(id)); if(!row)return;
  button.disabled=true; const old=button.textContent; button.textContent='Attendi…';
  try{
    if(row.kind==='booking'){
      if(action==='open')await openBookingConfirmation(row.path);
      if(action==='download')await downloadBooking(row.path,row.number);
      if(action==='email')await resendBookingEmail(row.id);
    }else{
      if(action==='open')await openStoredReceipt(row.path);
      if(action==='download')await downloadStoredReceipt(row.path,row.number);
      if(action==='email')await resendPaymentEmail(row.id);
    }
    if(action==='email'){button.textContent='Inviata ✓';setTimeout(()=>{button.textContent=old;button.disabled=false},1400);return;}
  }catch(e){console.error(e);alert(e.message||'Operazione non riuscita.');}
  button.textContent=old;button.disabled=false;
}

document.addEventListener('DOMContentLoaded',()=>{
  $('#archive-search')?.addEventListener('input',render);
  document.querySelectorAll('.archive-filter').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.archive-filter').forEach(b=>b.classList.remove('is-active'));btn.classList.add('is-active');activeFilter=btn.dataset.filter||'all';render()}));
  $('#archive-body')?.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b)act(b.dataset.action,b.dataset.id,b)});
  $('#archive-refresh')?.addEventListener('click',load);
  load();
  refreshTimer=window.setInterval(()=>{ if(document.visibilityState==='visible') load(); },10000);
  document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') load(); });
  window.addEventListener('focus',()=>load());
  window.addEventListener('beforeunload',()=>{ if(refreshTimer) window.clearInterval(refreshTimer); });
});
