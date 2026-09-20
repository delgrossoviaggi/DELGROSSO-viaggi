/* DELGROSSO V159 — mobile-safe form guard. No automatic financial writes while offline. */
(function(){
  'use strict';
  const D=window;
  const KEY='dg_v159_payment_draft_v1';
  const page=location.pathname.toLowerCase();
  const paymentPage=page.endsWith('/pagamenti.html')||page.endsWith('pagamenti.html');
  function q(s){return document.querySelector(s)}
  function state(text,kind){
    let el=q('.dg-v156-save-state');
    if(!el){el=document.createElement('div');el.className='dg-v156-save-state';const host=q('.payment-form-card')||document.body;host.appendChild(el)}
    el.textContent=text;el.className='dg-v156-save-state'+(kind?' is-'+kind:'');
    if(kind==='ok') setTimeout(()=>{if(el.textContent===text)el.remove()},1800);
  }
  function markDirty(){D.DG_UNSAVED_CHANGES=true}
  function clearDirty(){D.DG_UNSAVED_CHANGES=false}
  function saveDraft(){
    if(!paymentPage)return;
    const booking=q('#bookingIdInput')?.value||'';
    if(!booking)return;
    const draft={bookingId:booking,movementId:q('#movementIdInput')?.value||'',importo:q('#importoInput')?.value||'',tipo:q('#tipoSelect')?.value||'Acconto',metodo:q('#metodoSelect')?.value||'Contanti',data:q('#dataInput')?.value||'',note:q('#noteInput')?.value||'',at:new Date().toISOString()};
    try{localStorage.setItem(KEY,JSON.stringify(draft));state('Bozza locale salvata — non ancora registrata',null)}catch{}
  }
  function clearDraft(){try{localStorage.removeItem(KEY)}catch{};clearDirty()}
  function restoreDraft(){
    if(!paymentPage)return;
    try{
      const d=JSON.parse(localStorage.getItem(KEY)||'null'); if(!d)return;
      const booking=q('#bookingIdInput')?.value||''; if(!booking||String(d.bookingId)!==String(booking))return;
      if(q('#importoInput')&&d.importo)q('#importoInput').value=d.importo;
      if(q('#tipoSelect')&&d.tipo)q('#tipoSelect').value=d.tipo;
      if(q('#metodoSelect')&&d.metodo)q('#metodoSelect').value=d.metodo;
      if(q('#dataInput')&&d.data)q('#dataInput').value=d.data;
      if(q('#noteInput'))q('#noteInput').value=d.note||'';
      state('Bozza locale ripristinata',null);markDirty();
    }catch{}
  }
  function bind(){
    if(!paymentPage)return;
    ['#importoInput','#tipoSelect','#metodoSelect','#dataInput','#noteInput'].forEach(sel=>{const el=q(sel);if(!el)return;el.addEventListener('input',markDirty,{passive:true});el.addEventListener('change',markDirty,{passive:true})});
    q('#importoInput')?.setAttribute('inputmode','decimal');
    q('#noteInput')?.setAttribute('enterkeyhint','done');
    q('#savePayment')?.addEventListener('click',function(event){
      if(!navigator.onLine){saveDraft();state('OFFLINE: pagamento NON registrato. Bozza salvata sul dispositivo.','error');event.preventDefault();event.stopImmediatePropagation();return}
      const amount=Number(String(q('#importoInput')?.value||'').replace(',','.'));
      if(!Number.isFinite(amount)||amount<=0){state('Inserisci un importo valido.','error');return}
      state('Salvataggio sicuro in corso…',null);
    },true);
    q('#cancelPaymentEdit')?.addEventListener('click',clearDraft);
    window.addEventListener('online',()=>state('Connessione ripristinata — puoi salvare','ok'));
    window.addEventListener('offline',()=>state('OFFLINE — nessun pagamento verrà inviato automaticamente','error'));
    setTimeout(restoreDraft,700);
    D.addEventListener('dg:v156:payment-saved',()=>{clearDraft();state('Pagamento registrato correttamente ✓','ok')});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
