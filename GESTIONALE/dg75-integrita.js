/* DELGROSSO V75 — read-only integrity dashboard for authenticated operators.
 * Never assigns passenger seats, deletes bookings, or issues PDFs.
 */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const active=b=>!/annull|cancel|storn|rimbors/i.test(String(b?.stato||''))&&!b?.riserva_aziendale;
function audit(current){
 const trips=new Map((current.viaggi||[]).map(v=>[String(v.id),v]));
 const byBooking=new Map();
 (current.prenotazionePosti||[]).forEach(x=>{
  const key=String(x.prenotazione_id||'');
  byBooking.set(key,(byBooking.get(key)||0)+1);
 });
 const missingSeats=(current.prenotazioni||[]).filter(b=>
  active(b)&&Number(b.posti||0)>0&&(byBooking.get(String(b.id))||0)!==Number(b.posti)
 ).map(b=>{
  const documented=String(b.posti_selezionati||'').split(',')
   .map(x=>x.trim()).filter(Boolean);
  const indexed=byBooking.get(String(b.id))||0;
  return {
   id:String(b.id),code:String(b.codice||b.confirmation_number||b.id_prenotazione||String(b.id).slice(0,8)),
   trip:trips.get(String(b.viaggio_id))?.titolo||trips.get(String(b.viaggio_id))?.destinazione||'Viaggio da verificare',
   pax:Number(b.posti),indexed,documented:documented.length,
   needsChoice:documented.length!==Number(b.posti)
  };
 });
 const normalBookings=(current.prenotazioni||[]).filter(b=>!b.riserva_aziendale);
 const noArchivedConfirmation=normalBookings.filter(b=>!b.confirmation_storage_path).length;
 const generatedNoArchive=normalBookings.filter(b=>!b.confirmation_storage_path&&!!b.confirmation_generated_at).length;
 const noGenerationNoArchive=normalBookings.filter(b=>!b.confirmation_storage_path&&!b.confirmation_generated_at).length;
 const paymentRecords=current.pagamenti||[];
 const noProfessionalReceipt=paymentRecords.filter(p=>!p.receipt_professional_path).length;
 const noPdfPayments=paymentRecords.filter(p=>!(p.receipt_professional_path||p.receipt_storage_path));
 const missingAccontiSaldi=noPdfPayments.filter(p=>/^(acconto|saldo)$/i.test(String(p.tipo||''))).length;
 const missingRimborsi=noPdfPayments.filter(p=>/^rimborso$/i.test(String(p.tipo||''))).length;
 return {missingSeats,noArchivedConfirmation,generatedNoArchive,noGenerationNoArchive,noProfessionalReceipt,
   missingAccontiSaldi,missingRimborsi,noPdfPayments:noPdfPayments.length};
}
function mount(){
 const root=$('page-prenotazioni');
 if(!root)return null;
 let panel=$('dg75IntegrityPanel');
 if(panel)return panel;
 panel=document.createElement('section');
 panel.id='dg75IntegrityPanel';
 panel.className='card';
 panel.setAttribute('aria-label','Controllo integrità prenotazioni DELGROSSO');
 panel.style.cssText='padding:14px 16px;margin:12px 0;border:1px solid #dce5ee;border-radius:14px';
 const toolbar=root.querySelector('.toolbar');
 if(toolbar)root.insertBefore(panel,toolbar);else root.appendChild(panel);
 panel.addEventListener('click',event=>{
  const bookingButton=event.target.closest?.('[data-dg75-open]');
  if(bookingButton){
   const id=bookingButton.getAttribute('data-dg75-open')||'';
   if(!(typeof state!=='undefined'&&(state.prenotazioni||[]).some(b=>String(b.id)===id)))return;
   if(typeof window.openBookingModal==='function')window.openBookingModal(id);
   return;
  }
  const docsButton=event.target.closest?.('[data-dg75-pdf],[data-dg75-payments]');
  if(docsButton){
   if(typeof go==='function')go('whatsapp');
   const kind=docsButton.hasAttribute('data-dg75-payments')?'payment':'booking';
   if(window.dg66OpenMissing?.(kind)!==true){
    const type=$('dg66Kind');if(type)type.value=kind;
    const missing=$('dg66MissingOnly');if(missing)missing.checked=true;
    window.dg66RefreshEmail?.();
    $('dg66EmailPanel')?.scrollIntoView?.({behavior:'smooth',block:'start'});
   }
   return;
  }
 });
 return panel;
}
function render(){
 const panel=mount();if(!panel)return;
 if(typeof state==='undefined'||!(state.prenotazioni||[]).length){
  panel.textContent='Controllo integrità: dati in caricamento…';
  return;
 }
 const data=audit(state);
 const n=data.missingSeats.length;
 const detail=n
  ?'<div style="display:grid;gap:7px;margin:9px 0">'+data.missingSeats.map(b=>
    '<div style="display:flex;gap:9px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:9px;border:1px solid #f1d8a9;border-radius:10px;background:#fffbeb">'+
    '<div><b>'+escapeHTML(b.code)+'</b> · '+escapeHTML(b.trip)+
    '<div style="font-size:12px;color:#6b7280">'+b.pax+' persone, '+b.indexed+' posti collegati · '+
    (b.needsChoice?'numeri da assegnare manualmente':'numeri già indicati da verificare')+'</div></div>'+
    '<button type="button" class="btn btn-secondary btn-sm" data-dg75-open="'+escapeHTML(b.id)+'">Apri prenotazione</button></div>'
   ).join('')+'</div>'
  :'<p style="font-size:13px;color:#166534;margin:10px 0 4px">✓ Tutte le prenotazioni attive hanno il numero previsto di posti collegati alla piantina.</p>';
 panel.innerHTML=
  '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">'+
   '<div><h3 style="margin:0;font-size:17px">🛡️ Centro integrità · Prenotazioni</h3>'+
    '<p style="margin:4px 0 0;color:#64748b;font-size:12px">Controllo senza modifiche automatiche a posti, pagamenti o documenti.</p></div>'+
   '<span style="font-size:12px;font-weight:800;color:'+(n?'#92400e':'#166534')+'">'+
    (n?n+' prenotazione/i da verificare':'Posti collegati correttamente')+'</span></div>'+
   detail+
   '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding-top:9px;border-top:1px solid #e2e8f0;font-size:12px;color:#475569">'+
    '<b>Archivio PDF:</b> '+data.noArchivedConfirmation+' conferme senza percorso ('+data.generatedNoArchive+
    ' già segnate come generate, '+data.noGenerationNoArchive+' senza generazione registrata) · '+
    data.noPdfPayments+' pagamenti senza percorso PDF ('+data.missingAccontiSaldi+' acconti/saldi, '+data.missingRimborsi+' rimborsi). '+
    '<button type="button" class="btn btn-secondary btn-sm" data-dg75-pdf="1">Verifica conferme</button>'+
    '<button type="button" class="btn btn-secondary btn-sm" data-dg75-payments="1">Verifica pagamenti</button></div>'+
   '<p style="font-size:11px;color:#64748b;margin:7px 0 0">La data di generazione non prova che il PDF sia stato archiviato o consegnato. Per le conferme già segnate come generate, la nuova emissione è bloccata finché non viene verificato lo storico.</p>';
 window.dg78RenderArchive?.();
}
window.dg75AuditIntegrity=audit;
window.dg75RenderIntegrity=render;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render,{once:true});
else render();
})();
