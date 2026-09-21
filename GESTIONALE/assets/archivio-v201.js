import { openStoredReceipt, downloadStoredReceipt, issuePaymentReceipt } from './paymentReceiptService-v24.js';
import { openBookingConfirmation, resendBookingEmail, resendPaymentEmail, issueBookingDocuments, getBookingContext } from './bookingDocumentsService-v25.js';
import { openNoleggioStoredReceipt, downloadNoleggioStoredReceipt, resendNoleggioPaymentEmail } from './noleggioPaymentReceiptService-v1.js';

const SUPABASE_URL='https://chkuayhbmitdmzmmvona.supabase.co';
const SUPABASE_KEY='sb_publishable_H29K1BV5ZE1rT8xo0PIzVA_wF6zC7je';
const BOOKING_FN=`${SUPABASE_URL}/functions/v1/send-booking-confirmation`;
const headers={apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`};
const RECOVERY_FN='https://chkuayhbmitdmzmmvona.supabase.co/functions/v1/recover-archive-missing';
let rows=[]; let activeFilter='all'; let refreshTimer=null; let lastSyncAt=null;
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const fmtDate=v=>{if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?String(v).slice(0,10):d.toLocaleDateString('it-IT')};
const money=v=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(v||0));
const customer=o=>String(o.cliente||o.cliente_nome||[o.nome,o.cognome].filter(Boolean).join(' ')||'Cliente').trim();
const trip=o=>String(o.viaggio||o.viaggio_codice||o.destinazione||o.titolo||'—').trim();

async function restArchive(){
  // V130: l'archivio legge direttamente le sorgenti ufficiali.
  // La view archivio_documenti resta compatibile, ma non è più il punto singolo di errore:
  // se la view è vuota/stale, le prenotazioni e i pagamenti presenti nelle tabelle vengono comunque mostrati.
  const get=(path)=>fetch(`${SUPABASE_URL}/rest/v1/${path}`,{headers}).then(async r=>({ok:r.ok,data:await r.json().catch(()=>[])}));
  const [pRes,gRes,nbRes,tRes]=await Promise.all([
    get(`prenotazioni?select=*&order=created_at.desc&limit=2000`),
    get(`pagamenti?select=*&order=created_at.desc&limit=2000`),
    get(`noleggi_bus_pagamenti?select=*,noleggi_bus(id_noleggio,referente,azienda,email,tratta_partenza,tratta_destinazione)&order=created_at.desc&limit=2000`),
    get(`viaggi?select=id,id_viaggio,titolo,destinazione,data_partenza,ora_partenza&limit=2000`)
  ]);
  if(!pRes.ok||!gRes.ok) throw new Error('Impossibile leggere prenotazioni/pagamenti da Supabase.');
  const p=Array.isArray(pRes.data)?pRes.data:[];
  const g=Array.isArray(gRes.data)?gRes.data:[];
  const nb=Array.isArray(nbRes.data)?nbRes.data:[];
  const trips=Array.isArray(tRes.data)?tRes.data:[];
  const tripMap=new Map(trips.map(x=>[String(x.id),x]));

  // Non filtriamo più solo i record con storage_path: anche un documento generato
  // ma non ancora archiviato deve comparire nell'Archivio con stato "da archiviare".
  const bookingDocs=p.filter(x=>x.confirmation_number||x.id_prenotazione||x.confirmation_storage_path).map(x=>({
    tipo_documento:'prenotazione', documento_id:x.id,
    numero_documento:x.confirmation_number||x.id_prenotazione,
    id_prenotazione:x.id_prenotazione||x.confirmation_number,
    prenotazione_id:x.id, pagamento_id:null, viaggio_id:x.viaggio_id,
    cliente:x.cliente_nome||x.cliente, telefono:x.telefono, email:x.email,
    viaggio:tripMap.get(String(x.viaggio_id))?.titolo||tripMap.get(String(x.viaggio_id))?.destinazione||x.viaggio_codice||'—',
    data_documento:x.confirmation_generated_at||x.created_at,
    importo:x.totale, storage_path:x.confirmation_storage_path,
    email_inviata:x.confirmation_email_sent, email_inviata_at:x.confirmation_email_sent_at,
    email_errore:x.confirmation_email_error, updated_at:x.updated_at
  }));
  const paymentDocs=g.filter(x=>x.receipt_number||x.ricevuta||x.receipt_storage_path).map(x=>({
    tipo_documento:String(x.tipo||'').toLowerCase()==='saldo'?'saldo':'acconto',
    documento_id:x.id, numero_documento:x.receipt_number||x.ricevuta,
    prenotazione_id:x.prenotazione_id, pagamento_id:x.id, viaggio_id:x.viaggio_id,
    cliente:x.cliente, viaggio:tripMap.get(String(x.viaggio_id))?.titolo||tripMap.get(String(x.viaggio_id))?.destinazione||x.viaggio||'—',
    data_documento:x.receipt_generated_at||x.data_pagamento||x.created_at, importo:x.importo,
    storage_path:x.receipt_storage_path, email_inviata:x.receipt_email_sent,
    email_inviata_at:x.receipt_email_sent_at, email_errore:x.receipt_email_error, updated_at:x.updated_at
  }));
  const noleggioDocs=(nbRes.ok?nb:[]).filter(x=>x.receipt_number||x.receipt_path).map(x=>({
    tipo_documento:String(x.tipo||'').toLowerCase()==='saldo'?'saldo':'acconto', documento_id:x.id,
    numero_documento:x.receipt_number, pagamento_id:x.id, prenotazione_id:null,
    cliente:x.noleggi_bus?.referente||x.noleggi_bus?.azienda||'Cliente',
    viaggio:`${x.noleggi_bus?.tratta_partenza||'—'} → ${x.noleggi_bus?.tratta_destinazione||'—'}`,
    email:x.noleggi_bus?.email||null, data_documento:x.receipt_generated_at||x.data_pagamento||x.created_at,
    importo:x.importo, storage_path:x.receipt_path, email_inviata:x.receipt_email_sent,
    email_inviata_at:x.receipt_email_sent_at, email_errore:x.receipt_email_error,
    id_noleggio:x.noleggi_bus?.id_noleggio||null, noleggio_pagamento:true
  }));
  return [...bookingDocs,...paymentDocs,...noleggioDocs].sort((a,b)=>new Date(b.data_documento||0)-new Date(a.data_documento||0));
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
    const bookingId=d.prenotazione_id||d.booking_id||((kind==='booking')?d.documento_id:null)||null;
    const paymentId=d.pagamento_id||((kind!=='booking')?d.documento_id:null)||d.payment_id||null;
    return {
      kind,
      source:d.noleggio_pagamento?'noleggio':'viaggio',
      id:kind==='booking'?bookingId:paymentId,
      bookingId,
      paymentId,
      documentId:d.documento_id||null,
      number:d.id_prenotazione||d.numero_documento||((kind==='booking')?d.confirmation_number:d.receipt_number)||'—',
      customer:customer(d),
      trip:trip(d),
      date:d.data_documento,
      amount:d.importo,
      path:d.storage_path,
      emailSent:!!d.email_inviata,
      raw:d
    };
  }).filter(r=>r.id).sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
}
function stats(){
  $('#stat-total').textContent=rows.length; $('#stat-booking').textContent=rows.filter(x=>x.kind==='booking').length; $('#stat-acconto').textContent=rows.filter(x=>x.kind==='acconto').length; $('#stat-saldo').textContent=rows.filter(x=>x.kind==='saldo').length;
  const missing=rows.filter(x=>!x.path).length; const box=$('#archive-missing-count');
  if(box) box.textContent=missing?`⚠ ${missing} da archiviare`:'✓ Tutti i PDF archiviati';
}
function label(k,r){if(r?.source==='noleggio')return k==='saldo'?'Ricevuta saldo noleggio':'Ricevuta acconto noleggio';return k==='booking'?'Conferma prenotazione':k==='saldo'?'Ricevuta saldo':'Ricevuta acconto'}
function render(){
  const q=($('#archive-search')?.value||'').trim().toLowerCase();
  const filtered=rows.filter(r=>(activeFilter==='all'||r.kind===activeFilter)&&(!q||[r.number,r.customer,r.trip,label(r.kind,r)].join(' ').toLowerCase().includes(q)));
  const body=$('#archive-body'); if(!body)return;
  if(!filtered.length){body.innerHTML=`<tr><td colspan="8"><div class="archive-empty">Nessun documento trovato.</div></td></tr>`;return;}
  body.innerHTML=filtered.map(r=>`<tr>
    <td><span class="archive-type ${r.kind}">${r.kind==='booking'?'📄':r.kind==='saldo'?'✅':'💶'} ${esc(label(r.kind,r))}</span></td>
    <td><strong>${esc(r.number)}</strong><div class="archive-related">${r.kind==='booking'?`<a href="./prenotazione.html?id=${encodeURIComponent(r.id)}">Prenotazione</a>`:r.source==='noleggio'?`<span>Noleggio ${esc(r.raw?.id_noleggio||'')}</span>`:`<a href="./pagamenti.html?id=${encodeURIComponent(r.id)}">Pagamento</a>`}</div></td><td>${esc(r.customer)}</td><td>${esc(r.trip)}</td><td>${esc(fmtDate(r.date))}</td>
    <td>${r.amount==null?'—':`<strong>${esc(money(r.amount))}</strong>`}</td>
    <td>${r.emailSent?'<span class="archive-email-ok">✓ Inviata</span>':'<span class="archive-email-no">—</span>'}</td>
    <td>${r.path?'<span class="archive-email-ok">✓ Archiviato</span>':'<span class="archive-email-no">⚠ PDF non archiviato</span>'}</td>
    <td><div class="archive-actions">
      ${r.path?'':'<button class="archive-btn archive-missing-action" data-action="archive" data-id="'+esc(r.id)+'">Archivia ora</button>'}<button class="archive-btn primary" data-action="open" data-id="${esc(r.id)}" ${r.path?'':'disabled'}>Apri PDF</button>
      <button class="archive-btn" data-action="download" data-id="${esc(r.id)}" ${r.path?'':'disabled'}>Scarica</button>
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
async function recoverAndVerify(row, button, runner){
  const old=button.textContent;
  button.textContent='Archiviazione…';
  await runner();
  button.textContent='Verifica…';
  await load();
  const fresh=rows.find(x=>String(x.id)===String(row.id) && x.kind===row.kind);
  if(!fresh?.path) throw new Error("Operazione completata dal servizio, ma il PDF non risulta ancora presente nell'archivio Supabase. Nessun falso ‘completato’.");
  button.textContent='Archiviato ✓';
  setTimeout(()=>{button.textContent=old;button.disabled=false},1400);
  return fresh;
}
async function recoverAllMissing(){
  const missing=rows.filter(r=>!r.path);
  if(!missing.length){ alert('Non ci sono documenti mancanti da recuperare.'); return; }
  if(!confirm(`Verranno recuperati ${missing.length} documenti mancanti direttamente da Supabase. Nessuna email e nessun download automatico. Procedere?`)) return;
  const btn=$('#archive-recover-all'); const progress=$('#archive-recovery-progress');
  btn.disabled=true; const original=btn.textContent; btn.textContent='Recupero server…';
  try{
    const mod=window.DG_SUPABASE_SYNC;
    const sb=mod?.getClient?await mod.getClient():null;
    const session=sb?await sb.auth.getSession():null;
    const token=session?.data?.session?.access_token;
    if(!token) throw new Error('Sessione gestionale non autenticata o scaduta. Effettua nuovamente il login.');
    if(progress) progress.textContent=`Invio richiesta per ${missing.length} documenti…`;
    const r=await fetch(RECOVERY_FN,{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({action:'missing'})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||!d.success) throw new Error(d.error||`Recovery server non riuscito (${r.status})`);
    const s=d.summary||{};
    btn.textContent=s.errors?`⚠ Recuperati ${s.archived}, errori ${s.errors}`:`✓ Recuperati ${s.archived}`;
    if(progress) progress.textContent=`Risultato: ${s.archived||0} recuperati · ${s.errors||0} errori · ${s.already||0} già archiviati`;
    await load();
  }catch(e){
    console.error('Recovery server failed',e);
    btn.textContent='⚠ Recupero non riuscito';
    if(progress) progress.textContent=e?.message||String(e);
    alert(e?.message||String(e));
  }finally{
    setTimeout(()=>{btn.textContent=original;btn.disabled=false;},3500);
  }
}

async function act(action,id,button){
  const row=rows.find(x=>String(x.id)===String(id)); if(!row)return;
  button.disabled=true; const old=button.textContent; button.textContent='Attendi…';
  try{
    if(row.kind==='booking'){
      if(action==='archive'){
        await recoverAndVerify(row,button,async()=>{
          const ctx=await getBookingContext(row.bookingId||row.id);
          const archived=await issueBookingDocuments(ctx.booking||{},ctx.trip||{},{autoDownload:false,sendEmail:false});
          if(!archived?.archived) throw new Error('La conferma non risulta archiviata su Supabase Storage.');
        });
        return;
      }
      if((action==='open'||action==='download')&&!row.path) throw new Error('PDF della conferma non ancora archiviato.');
      if(action==='open') await openBookingConfirmation(row.path);
      if(action==='download') await downloadBooking(row.path,row.number);
      if(action==='email'){
        const booking={...(row.raw||{}),id:row.bookingId,id_prenotazione:row.raw?.id_prenotazione||row.number};
        await resendBookingEmail(booking,{titolo:row.trip});
      }
    }else if(row.source==='noleggio'){
      if((action==='open'||action==='download')&&!row.path) throw new Error('PDF della ricevuta noleggio non ancora archiviato.');
      if(action==='open') await openNoleggioStoredReceipt(row.path);
      if(action==='download') await downloadNoleggioStoredReceipt(row.path,row.number);
      if(action==='email') await resendNoleggioPaymentEmail(row.paymentId);
    }else{
      if(action==='archive'){
        if(row.source==='noleggio') throw new Error('Nessuna ricevuta noleggio da recuperare: il database non presenta PDF mancanti.');
        await recoverAndVerify(row,button,async()=>{
          const payment=row.raw||{};
          if(!row.bookingId) throw new Error('Pagamento senza prenotazione collegata: recupero bloccato per sicurezza.');
          const ctx=await getBookingContext(row.bookingId);
          const archived=await issuePaymentReceipt(
            payment,
            ctx.booking||{},
            ctx.trip||{},
            { totalDue: payment.totale, paidAfter: payment.pagato },
            { sendEmail:false, autoDownload:false }
          );
          if(!archived?.archived) throw new Error('La ricevuta non risulta archiviata su Supabase Storage.');
        });
        return;
      }
      if((action==='open'||action==='download')&&!row.path) throw new Error('PDF della ricevuta non ancora archiviato.');
      if(action==='open') await openStoredReceipt(row.path);
      if(action==='download') await downloadStoredReceipt(row.path,row.number);
      if(action==='email') await resendPaymentEmail(row.paymentId);
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
  $('#archive-recover-all')?.addEventListener('click',recoverAllMissing);
  load();
  refreshTimer=window.setInterval(()=>{ if(document.visibilityState==='visible') load(); },10000);
  document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') load(); });
  window.addEventListener('focus',()=>load());
  window.addEventListener('beforeunload',()=>{ if(refreshTimer) window.clearInterval(refreshTimer); });
});
