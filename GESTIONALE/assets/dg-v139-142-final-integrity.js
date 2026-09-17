/* DELGROSSO V139-V142 — Final Integrity Layer
   Non modifica Supabase schema/RLS. No polling/MutationObserver.
   Adds client-side guardrails only; existing save services remain authoritative.
*/
(function(){
  'use strict';
  const money=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
  const fmt=v=>money(v).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2});
  function setMaxAmount(){
    const amount=document.getElementById('payImporto');
    const residual=document.getElementById('payResiduo');
    const type=document.getElementById('payTipo');
    if(!amount||!residual)return;
    const r=money(String(residual.textContent||'').replace(/[^0-9,.-]/g,'').replace(/\./g,'').replace(',','.'));
    if((type?.value||'Acconto')==='Rimborso') amount.removeAttribute('max');
    else if(r>=0) amount.max=r.toFixed(2);
  }
  function addCassaHint(){
    const panel=document.getElementById('paymentPanel');
    if(!panel||panel.querySelector('.dg-v139-integrity-hint'))return;
    const el=document.createElement('div');
    el.className='dg-v139-integrity-hint';
    el.setAttribute('role','status');
    el.textContent='🔒 Controllo automatico: il movimento viene verificato contro il residuo reale prima del salvataggio.';
    panel.prepend(el);
  }
  function wire(){
    addCassaHint(); setMaxAmount();
    ['payResiduo','payTipo'].forEach(id=>document.getElementById(id)?.addEventListener('input',setMaxAmount));
    document.getElementById('payTipo')?.addEventListener('change',setMaxAmount);
    document.getElementById('payImporto')?.addEventListener('input',function(){
      const max=this.getAttribute('max');
      if(max && money(this.value)>money(max)) this.setCustomValidity(`Importo massimo disponibile: € ${fmt(max)}`);
      else this.setCustomValidity('');
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',wire,{once:true}); else wire();
})();
