/**
 * DELGROSSO VIAGGI 4.0 — report PDF e bridge iOS/PC.
 * Report da snapshot già autorizzati nel browser; nessuna API di scrittura.
 */
import {bookingActive,bookingName,num,occupancy,seatsOf,tripName} from './core.js';

export const buildPdfGroups=(trips,bookings,seatRows,layouts,{tripId='',includeArchived=false}={})=>{
 const ts=(trips||[]).filter(t=>(includeArchived || !t.archiviato_at) && (!tripId || t.id===tripId));
 const byId=new Map((trips||[]).map(t=>[t.id,t]));
 const grouped=new Map();
 for(const t of ts){
  const rootId=tripId?t.id:(t.bis_parent_id||t.id);
  if(!grouped.has(rootId))grouped.set(rootId,[]);
  grouped.get(rootId).push(t);
 }
 const groups=[];
 for(const [rootId,buses] of grouped){
  const root=byId.get(rootId)||buses[0];
  const sorted=buses.slice().sort((a,b)=>num(a.bis_numero)-num(b.bis_numero));
  const data=[];
  for(const t of sorted){
   const list=(bookings||[]).filter(b=>b.viaggio_id===t.id && bookingActive(b) && !b.riserva_aziendale);
   const seatMap=new Map();
   for(const seat of seatRows||[]){
    if(seat.viaggio_id!==t.id)continue;
    const ids=seatMap.get(seat.prenotazione_id)||[];
    ids.push(String(seat.posto));seatMap.set(seat.prenotazione_id,ids);
   }
   const assigned=list.map(b=>{
     const ids=[...new Set([...seatsOf(b),...(seatMap.get(b.id)||[])])];
     ids.sort((a,b)=>num(a)-num(b));
     return {...b,sedili:ids};
   });
   const official=(layouts||[]).find(l=>l.viaggio_id===t.id);
   const oc=occupancy(t,list,seatRows||[]);
   data.push({
      trip:t,name:tripName(t)+(num(t.bis_numero)>1?' - BUS BIS '+t.bis_numero:' - BUS principale'),
      bookings:assigned,
      layout:official?.configurazione||null,official:!!official,
      warnings:oc.warnings
   });
  }
  groups.push({trip:root,title:tripName(root),buses:data});
 }
 return groups.sort((a,b)=>String(a.trip.data_partenza||'').localeCompare(String(b.trip.data_partenza||'')));
};
export function safePdfFilename(prefix,source=''){
 const base=String(source||'DELGROSSO').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9_-]/g,'_').replace(/_{2,}/g,'_').replace(/^_+|_+$/g,'').slice(0,55)||'DELGROSSO';
 return ('DELGROSSO_'+prefix+'_'+base+'.pdf').slice(0,110);
}
export function assertValidPdf(bytes) {
 if(!(bytes instanceof Uint8Array) || bytes.byteLength < 256)throw new Error('Il documento non contiene un PDF valido.');
 const magic=Array.from(bytes.slice(0,5)).map(x=>String.fromCharCode(x)).join('');
 if(magic!=='%PDF-')throw new Error('Firma PDF non corretta.');
 const tail=Array.from(bytes.slice(-40)).map(x=>String.fromCharCode(x)).join('');
 if(!tail.includes('%%EOF'))throw new Error('PDF incompleto.');
 return bytes;
}
/** Download via Blob non apre finestre popup: lavora anche nel browser iPhone Safari.
 * Il menu File/Download di iOS salva in File; l'utente può poi condividere.
 * Blob URL tenuto vivo 90 secondi per iOS prima di revocarlo. */
export function savePdf(bytes,filename){
 assertValidPdf(bytes);
 const blob=new Blob([bytes],{type:'application/pdf'});
 const href=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=href;
 a.download=safePdfFilename('REPORT',filename).replace(/^DELGROSSO_REPORT_/,'');
 a.rel='noopener noreferrer';a.style.display='none';
 document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(href),90_000);
 return {filename:a.download,bytes:blob.size};
}
export function pdfEngine(){
 const engine=window.DG4Pdf;
 if(!engine?.makeRosterPdf || !engine.makeReceiptPdf || !engine.makeV4LayoutPdf)
  throw new Error('Motore PDF aziendale non caricato. Aggiorna la pagina e riprova.');
 return engine;
}
export function pdfRoster(trips,bookings,seatRows,layouts,tripId=''){
 const groups=buildPdfGroups(trips,bookings,seatRows,layouts,{tripId});
 if(!groups.length)throw new Error('Non esistono viaggi consultabili per il report.');
 const bytes=pdfEngine().makeRosterPdf(groups,{includeArchived:false});
 return savePdf(bytes,safePdfFilename('PRENOTATI',tripId?tripId.slice(0,8):'TUTTI_I_VIAGGI'));
}
export function pdfOperational(trips,bookings,seatRows,layouts,tripId=''){
 const groups=buildPdfGroups(trips,bookings,seatRows,layouts,{tripId});
 if(!groups.length)throw new Error('Seleziona un viaggio per la Control Room.');
 const bytes=pdfEngine().makeOperationalPdf(groups,{});
 return savePdf(bytes,safePdfFilename('CONTROL_ROOM',tripId?tripId.slice(0,8):'TUTTI_I_VIAGGI'));
}
export function pdfBooking(b,t,movements=[]){
 if(!b?.id||!t?.id)throw new Error('Prenotazione o viaggio non disponibile.');
 return savePdf(pdfEngine().makeBookingPdf(b,t,movements),safePdfFilename('CONFERMA',b.codice||b.id.slice(0,8)));
}
export function pdfReceipt(p,b,t){
 if(!p?.id||!b?.id||!t?.id)throw new Error('Pagamento non associato a una prenotazione valida.');
 return savePdf(pdfEngine().makeReceiptPdf(p,b,t),safePdfFilename('RIEPILOGO_PAGAMENTO',p.receipt_number||p.id.slice(0,8)));
}
export function pdfSeatMap(layout,label='PIANTINA'){
 if(!layout?.rows)throw new Error('Nessuna piantina ufficiale presente.');
 return savePdf(pdfEngine().makeV4LayoutPdf(layout),safePdfFilename('PIANTINA',label));
}
export function pdfCash(cash,payments=[]){
 return savePdf(pdfEngine().makeCashSummaryPdf(cash,payments),safePdfFilename('CONTABILITA',new Date().toISOString().slice(0,10)));
}
export function pdfAgenda(agenda){
 return savePdf(pdfEngine().makeAgendaPdf(agenda),safePdfFilename('AGENDA',new Date().toISOString().slice(0,10)));
}
export function pdfCustomer(c,bookings,payments,trips){
 const related=(bookings||[]).filter(b=>{
  const name=bookingName(b).toLocaleLowerCase('it');
  const full=[c.nome,c.cognome].filter(Boolean).join(' ').toLocaleLowerCase('it');
  const phone=String(b.telefono||'').replace(/\D/g,'');
  const customerPhone=String(c.telefono||'').replace(/\D/g,'');
  // Match verified full name + phone to avoid attaching unrelated customer records.
  return name===full && phone.length>=8 && phone===customerPhone;
 });
 const ids=new Set(related.map(x=>x.id));
 const linked=(payments||[]).filter(p=>ids.has(p.prenotazione_id));
 const byId=Object.fromEntries((trips||[]).map(t=>[t.id,t]));
 return savePdf(pdfEngine().makeCustomerLedgerPdf(c,related,linked,byId),safePdfFilename('CLIENTE',c.codice_cliente||c.id.slice(0,8)));
}
export function pdfRental(r,payments=[]){
 const related=payments.filter(p=>p.noleggio_id===r.id);
 return savePdf(pdfEngine().makeRentalSummaryPdf(r,related),safePdfFilename('NOLEGGIO',r.id.slice(0,8)));
}
