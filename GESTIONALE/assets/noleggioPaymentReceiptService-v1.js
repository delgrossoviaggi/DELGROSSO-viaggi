import { buildPaymentReceipt } from './paymentReceiptService-v24.js';

const SUPABASE_URL='https://chkuayhbmitdmzmmvona.supabase.co';
const SUPABASE_KEY='sb_publishable_H29K1BV5ZE1rT8xo0PIzVA_wF6zC7je';
const FN=`${SUPABASE_URL}/functions/v1/send-noleggio-payment-receipt`;
const headers={apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json'};
const clean=v=>String(v??'').trim();
async function blob64(blob){const buf=await blob.arrayBuffer();let out='',bytes=new Uint8Array(buf);for(let i=0;i<bytes.length;i+=0x8000)out+=String.fromCharCode(...bytes.subarray(i,Math.min(i+0x8000,bytes.length)));return btoa(out)}
async function call(body){const r=await fetch(FN,{method:'POST',headers,body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok||d.success===false)throw new Error(d.error||`Operazione ricevuta non riuscita (${r.status}).`);return d}
export async function issueNoleggioPaymentReceipt(payment,rental,totals={}){
  const trip={titolo:`Noleggio bus ${clean(rental.id_noleggio)}`,destinazione:`${clean(rental.tratta_partenza)} → ${clean(rental.tratta_destinazione)}`};
  const booking={cliente_nome:clean(rental.referente||rental.azienda||'Cliente'),email:clean(rental.email)};
  const built=await buildPaymentReceipt(payment,booking,trip,{totalDue:Number(rental.prezzo_concordato||0),paidAfter:Number(totals.paidAfter||0),residualAfter:Number(totals.residualAfter||0)});
  return call({payment:{...payment,receipt_number:built.receiptNumber},rental,totals,pdfBase64:await blob64(built.blob)}).then(d=>({...built,...d}));
}
export async function openNoleggioStoredReceipt(path){const d=await call({action:'signed_url',path});window.open(d.signedUrl,'_blank','noopener');return d.signedUrl}
export async function downloadNoleggioStoredReceipt(path,number='ricevuta'){const d=await call({action:'signed_url',path});const r=await fetch(d.signedUrl);if(!r.ok)throw new Error('Download ricevuta non riuscito.');const blob=await r.blob();const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=`Ricevuta_Noleggio_${number}.pdf`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);return true}
export async function resendNoleggioPaymentEmail(paymentId){return call({action:'resend_email',paymentId})}
