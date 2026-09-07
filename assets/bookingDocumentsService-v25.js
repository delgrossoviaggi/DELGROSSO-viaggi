import { n as buildBookingConfirmation } from './pdfReceiptService-M28dXixt.js';
import { issuePaymentReceipt } from './paymentReceiptService-v24.js';

const SUPABASE_URL='https://chkuayhbmitdmzmmvona.supabase.co';
const SUPABASE_KEY='sb_publishable_H29K1BV5ZE1rT8xo0PIzVA_wF6zC7je';
const BOOKING_FN=`${SUPABASE_URL}/functions/v1/send-booking-confirmation`;
const PAYMENT_FN=`${SUPABASE_URL}/functions/v1/send-payment-receipt`;

const clean=v=>String(v??'').trim();
const money=v=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(v||0));
const name=b=>clean(b?.cliente_nome||b?.cliente||`${b?.nome||''} ${b?.cognome||''}`)||'Cliente';
const code=b=>clean(b?.codice||b?.id)||'prenotazione';
const date=v=>{const d=new Date(`${clean(v).slice(0,10)}T00:00:00`);return Number.isNaN(d.getTime())?clean(v)||'—':d.toLocaleDateString('it-IT')};
async function blob64(blob){const buf=await blob.arrayBuffer();let out='',bytes=new Uint8Array(buf);for(let i=0;i<bytes.length;i+=0x8000)out+=String.fromCharCode(...bytes.subarray(i,Math.min(i+0x8000,bytes.length)));return btoa(out)}
async function call(url,body){const r=await fetch(url,{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok||!d.success)throw new Error(d.error||`Operazione non riuscita (${r.status})`);return d}

function downloadBookingPdf(blob,booking,number='prenotazione'){
  try{
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`Conferma_Prenotazione_${code(booking)||number}.pdf`;
    a.rel='noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
    return true;
  }catch(err){
    console.error('Download conferma PDF non riuscito:',err);
    return false;
  }
}

export async function issueBookingDocuments(booking,trip={},options={}){
  if(!booking?.id) throw new Error('ID prenotazione mancante.');

  // 1) Generiamo sempre il PDF localmente.
  // 2) Lo rendiamo immediatamente disponibile all'operatore.
  // 3) Solo dopo lo archiviamo su Supabase e proviamo l'invio email.
  // In questo modo un eventuale problema SMTP/Edge Function non fa sparire il PDF.
  const built=await buildBookingConfirmation(booking,trip,{});
  const pdfBase64=await blob64(built);
  const autoDownload=options.autoDownload!==false;
  const downloaded=autoDownload?downloadBookingPdf(built,booking):false;

  const result=await call(BOOKING_FN,{
    action:'issue',
    booking:{...booking},
    trip:{...trip},
    pdfBase64,
    pdfFilename:`Conferma_Prenotazione_${code(booking)}.pdf`
  });

  return {
    ...result,
    blob:built,
    downloaded,
    confirmationNumber:result.confirmationNumber
  };
}

export async function getBookingContext(bookingId){return call(BOOKING_FN,{action:'context',bookingId})}
export async function resendBookingEmail(booking,trip={}){if(typeof booking==='string'){const ctx=await getBookingContext(booking);booking=ctx.booking||{};trip=ctx.trip||{}}return call(BOOKING_FN,{action:'resend_email',booking:{...booking},trip:{...trip}})}
export async function openBookingConfirmation(path){const d=await call(BOOKING_FN,{action:'signed_url',path});window.open(d.signedUrl,'_blank','noopener');return d.signedUrl}
export async function bookingWhatsApp(booking,trip={},path=''){
  if(typeof booking==='string'){const ctx=await getBookingContext(booking);booking=ctx.booking||{};trip=ctx.trip||{};path=booking.confirmation_storage_path||''}
  const signed=path?await call(BOOKING_FN,{action:'signed_url',path}):null;
  const msg=[`Del Grosso Viaggi - Conferma Prenotazione`,``,`Numero prenotazione: ${code(booking)}`,`Cliente: ${name(booking)}`,`Viaggio: ${clean(trip?.destinazione||trip?.titolo)||'—'}`,`Data: ${date(trip?.data_partenza)}`,``,`La tua conferma di prenotazione PDF è disponibile qui:`,signed?.signedUrl||''].filter(Boolean).join('\n');
  const phone=clean(booking?.telefono).replace(/[^\d]/g,'');
  if(!phone) throw new Error('Numero WhatsApp del partecipante mancante.');
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,'_blank','noopener,noreferrer');
  return msg;
}

export async function resendPaymentEmail(paymentId){return call(PAYMENT_FN,{action:'resend_email',paymentId})}
export async function paymentWhatsApp(payment,booking,trip={}){
  if(typeof payment==='string'){
    const ctx=await call(PAYMENT_FN,{action:'context',paymentId:payment}); payment=ctx.payment||{}; booking=ctx.booking||{}; trip=ctx.trip||{};
  }
  const path=clean(payment?.receipt_storage_path); if(!path)throw new Error('Ricevuta PDF non archiviata.');
  const d=await call(PAYMENT_FN,{action:'signed_url',path});
  const type=payment?.tipo==='Saldo'?'Saldo':'Acconto';
  const msg=[`Del Grosso Viaggi - Ricevuta ${type}`,``,`Gentile ${name(booking)},`,`in allegato/link trovi la ricevuta relativa al pagamento di ${money(payment?.importo)}.`,``,`Viaggio: ${clean(trip?.destinazione||trip?.titolo)||clean(booking?.viaggio)||'—'}`,`Numero ricevuta: ${clean(payment?.receipt_number)||'—'}`,``,`PDF ricevuta:`,d.signedUrl].join('\n');
  const phone=clean(booking?.telefono).replace(/[^\d]/g,''); if(!phone)throw new Error('Numero WhatsApp del partecipante mancante.');
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,'_blank','noopener,noreferrer'); return msg;
}

export function wireDocumentActions(){
  document.addEventListener('click',async ev=>{
    const el=ev.target.closest('[data-dg-doc-action]'); if(!el)return;
    const action=el.dataset.dgDocAction;
    try{
      if(action==='booking-email') await resendBookingEmail(JSON.parse(el.dataset.booking||'{}'),JSON.parse(el.dataset.trip||'{}'));
      else if(action==='booking-wa') await bookingWhatsApp(el.dataset.bookingId||'');
      else if(action==='booking-pdf') await openBookingConfirmation(el.dataset.path||'');
      else if(action==='payment-email') await resendPaymentEmail(el.dataset.paymentId||'');
      else if(action==='payment-wa') await paymentWhatsApp(el.dataset.paymentId||'');
      el.classList.add('is-sent'); setTimeout(()=>el.classList.remove('is-sent'),900);
    }catch(e){console.error(e);alert(e.message||'Invio non riuscito.');}
  });
}
window.DGBookingDocuments={issueBookingDocuments,resendBookingEmail,openBookingConfirmation,bookingWhatsApp,resendPaymentEmail,paymentWhatsApp,wireDocumentActions};
wireDocumentActions();
