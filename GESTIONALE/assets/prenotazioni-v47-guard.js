/* V47 guard: stabilizza la conferma cliente/prenotazione senza sostituire il flusso esistente. */
(() => {
  'use strict';
  const wait = (fn, n=0) => {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn, {once:true});
  };
  wait(() => {
    const btn=document.getElementById('save');
    const modal=document.getElementById('modal');
    if (!btn) return;
    const protect=()=>{
      if (btn.dataset.dgV47Wrapped==='1') return true;
      if (typeof btn.onclick!=='function') return false;
      const original=btn.onclick;
      btn.dataset.dgV47Wrapped='1';
      btn.onclick=async ev=>{
        ev?.preventDefault?.();
        try {
          const select=document.getElementById('selectCliente');
          const name=document.getElementById('cliente_nome');
          const phone=document.getElementById('cliente_telefono');
          const trip=document.getElementById('selectViaggio');
          const people=document.getElementById('num_persone');
          const total=document.getElementById('importo');
          if (!trip?.value) { name?.focus(); return; }
          if (!select?.value && !String(name?.value||'').trim()) { name?.focus(); return; }
          if (!select?.value && !String(phone?.value||'').trim()) { phone?.focus(); return; }
          if (!(Number(people?.value)>0)) { people?.focus(); return; }
          if (!(Number(total?.value)>0)) { total?.focus(); return; }
          btn.disabled=true;
          await original.call(btn, ev);
        } catch (err) {
          console.error('[DG V47 prenotazioni guard]', err);
          const msg=String(err?.message||err||'Errore durante il salvataggio');
          let toast=document.getElementById('dg-v47-save-error');
          if(!toast){toast=document.createElement('div');toast.id='dg-v47-save-error';toast.style.cssText='position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:2147483647;max-width:min(92vw,680px);padding:13px 16px;border-radius:12px;background:#7f1d1d;color:#fff;font:700 14px system-ui;box-shadow:0 14px 40px rgba(0,0,0,.35)';document.body.appendChild(toast)}
          toast.textContent=msg;setTimeout(()=>toast.remove(),5000);
        } finally { btn.disabled=false; }
      };
      return true;
    };
    const timer=setInterval(()=>{if(protect())clearInterval(timer)},150);
    setTimeout(()=>clearInterval(timer),15000);
  });
})();
