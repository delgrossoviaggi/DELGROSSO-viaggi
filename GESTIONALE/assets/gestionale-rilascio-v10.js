/* DELGROSSO 3.0 Ultimate Premium 1.0 RC: PDF conferme via Edge Function
   senza Python, verifica del booking sul DB; nessun invio automatico email. */
'use strict';
(function(){
 if(!window.DGConfirmCore||!window.DGData)throw Error('Modulo conferme PDF mancante');
 document.addEventListener('click',async ev=>{
  const btn=ev.target.closest('[data-dg10-confirmation]');if(!btn)return;
  if(isDemo()){toast('Le conferme reali richiedono il login Nicola/Raffaele');return;}
  btn.disabled=true;
  try{
   const id=btn.dataset.dg10Confirmation;
   const [books,trips]=await Promise.all([DGData.rows('bookings'),DGData.rows('trips')]);
   const book=books.find(b=>b.id===id),trip=trips.find(t=>t.id===book?.viaggio_id);
   if(!book||!trip)throw Error('Prenotazione o viaggio non trovato: aggiorna la pagina');
   if(/annull|cancel/i.test(book.stato||''))throw Error('Impossibile generare la conferma di una prenotazione annullata');
   if(book.confirmation_storage_path){
    // PDF già archiviato: non sostituire l'originale, non duplicare il documento.
    await DGData.downloadPrivate('ricevute-prenotazioni',book.confirmation_storage_path,'DELGROSSO_CONFERMA_'+id.slice(0,8)+'.pdf');
    toast('Conferma prenotazione scaricata dall’archivio');return;
   }
   const pdf=DGConfirmCore.makePdf(book,trip);
   if(!confirm('Generare e archiviare una conferma PDF per '+(book.cliente_nome||book.cliente)+'? Controlla prima posti, data e pagamenti.'))return;
   const result=await DGData.archiveBookingConfirmation(id,pdf.base64);
   if(!result?.success||!result.path)throw Error('Supabase non ha confermato l’archiviazione del documento');
   delete cache.bookings;
   if(result.alreadyArchived){
    // Altro operatore ha già archiviato la conferma: scarichiamo il documento vero,
    // non una copia locale potenzialmente diversa.
    await DGData.downloadPrivate('ricevute-prenotazioni',result.path,'DELGROSSO_CONFERMA_'+id.slice(0,8)+'.pdf');
    toast('Conferma già archiviata: è stato scaricato il documento originale');go('bookings');return;
   }
   // Scarica direttamente il file appena generato, senza esporre URL Storage privati.
   const bytes=Uint8Array.from(pdf.ascii,c=>c.charCodeAt(0));
   const blob=new Blob([bytes],{type:'application/pdf'}),url=URL.createObjectURL(blob);
   const a=document.createElement('a');a.href=url;a.download='DELGROSSO_CONFERMA_'+id.slice(0,8)+'.pdf';
   document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);
   toast('Conferma PDF generata, archiviata e pronta al download');go('bookings');
  }catch(e){toast('Conferma PDF non generata: '+e.message)}finally{btn.disabled=false;}
 });
})();
