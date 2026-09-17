(function(){
  'use strict';

  let busyIds = new Set();
  const LABELS=['ID Prenotazione','Cliente','Viaggio','Data','Posti','Importo','Pagato','Residuo','Stato pagamento','Presente','Azioni'];

  function notify(message, type='info'){
    try {
      if (typeof window.showToast === 'function') { window.showToast(message, type); return; }
      if (typeof window.DGMessage === 'function') { window.DGMessage(message, type); return; }
    } catch(_) {}
    let toast=document.getElementById('dg-mobile-booking-toast');
    if(!toast){
      toast=document.createElement('div');
      toast.id='dg-mobile-booking-toast';
      toast.setAttribute('role','status');
      toast.style.cssText='position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(20px);z-index:999999;max-width:calc(100vw - 32px);padding:12px 16px;border-radius:12px;background:#102a43;color:#fff;font:700 15px/1.3 system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.25);opacity:0;pointer-events:none;transition:.2s ease;text-align:center;';
      document.body.appendChild(toast);
    }
    toast.textContent=message;
    toast.style.opacity='1'; toast.style.transform='translateX(-50%) translateY(0)';
    clearTimeout(toast._timer); toast._timer=setTimeout(()=>{toast.style.opacity='0';toast.style.transform='translateX(-50%) translateY(20px)'},2200);
  }

  async function service(){
    const mod=await import('./bookingService-CitenMQF.js');
    return mod.t;
  }

  function getRow(button){
    return button.closest('#bookingTable tbody tr');
  }

  function getId(row){
    return row?.dataset?.id || row?.getAttribute('data-id') || row?.querySelector('[data-booking-id]')?.getAttribute('data-booking-id') || null;
  }

  async function directConfirm(button){
    const row=getRow(button), id=getId(row);
    if(!row || !id) { notify('Prenotazione non trovata.','error'); return; }
    if(busyIds.has(id)) return;
    busyIds.add(id);
    const old=button.textContent;
    button.disabled=true;
    button.textContent='⏳ Conferma...';
    try{
      const svc=await service();
      const booking=await svc.getById(id);
      if(!booking) throw new Error('Prenotazione non trovata.');
      if(booking.stato==='Annullata') throw new Error('Una prenotazione annullata non può essere confermata.');
      const next=booking.stato==='Saldata'?'Saldata':'Confermata';
      await svc.update(id,{stato:next,updated_at:new Date().toISOString()});
      const cells=row.querySelectorAll('td');
      if(cells[8]) cells[8].textContent=next;
      button.textContent=next==='Saldata'?'✓ Saldata':'✓ Confermata';
      button.classList.add('dg-confirmed');
      notify(next==='Saldata'?'Prenotazione già saldata.':'Cliente confermato.','success');
    }catch(e){
      console.error('[DG V69] conferma diretta',e);
      button.disabled=false;
      button.textContent=old;
      notify(e?.message||'Errore durante la conferma.','error');
    }finally{ busyIds.delete(id); }
  }

  function isConfirmButton(btn){
    if(!(btn instanceof HTMLElement)) return false;
    if(!btn.closest('#bookingTable .booking-actions')) return false;
    if(btn.classList.contains('changeSeatBtn') || btn.classList.contains('openBtn') || btn.classList.contains('delBtn')) return false;
    const txt=(btn.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
    return /^(?:✓\s*)?conferma(?:\s+cliente)?$/.test(txt) || btn.classList.contains('dg-mobile-confirm') || btn.classList.contains('dg-mobile-confirm-v2');
  }

  // HARD INTERCEPT: runs before the legacy click handlers in prenotazioni.js.
  // This is the key fix: any old/mobile "Conferma" button inside the booking actions
  // is converted into a direct state update and is NEVER allowed to open #modal.
  document.addEventListener('click', function(ev){
    const btn=ev.target instanceof Element ? ev.target.closest('button,a') : null;
    if(!btn || !isConfirmButton(btn)) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    directConfirm(btn);
  }, true);

  function enhance(){
    const table=document.getElementById('bookingTable');
    if(!table) return;
    table.classList.add('dg-booking-table');
    table.querySelectorAll('tbody tr').forEach(row=>{
      const cells=row.querySelectorAll('td');
      cells.forEach((c,i)=>{if(LABELS[i]) c.dataset.label=LABELS[i];});
      const actions=row.querySelector('.booking-actions');
      if(!actions) return;
      const open=actions.querySelector('.openBtn');
      const seat=actions.querySelector('.changeSeatBtn');
      if(open && open.textContent.trim()!=='✏️ Modifica dati') open.textContent='✏️ Modifica dati';
      if(seat && seat.textContent.trim()!=='🪑 Cambia posto') seat.textContent='🪑 Cambia posto';

      // Remove duplicate legacy V1/V2 buttons and create one stable direct-confirm button.
      actions.querySelectorAll('.dg-mobile-confirm').forEach(el=>el.remove());
      let confirm=actions.querySelector('.dg-mobile-confirm-v4');
      if(!confirm && open){
        confirm=document.createElement('button');
        confirm.type='button';
        confirm.className='btn-secondary dg-mobile-confirm-v4';
        confirm.textContent='✓ Conferma';
        confirm.setAttribute('aria-label','Conferma cliente senza aprire modifica');
        actions.insertBefore(confirm,open);
      }
    });
  }

  document.addEventListener('DOMContentLoaded',()=>{
    let scheduled=false;
    const scheduleEnhance=()=>{
      if(scheduled) return;
      scheduled=true;
      queueMicrotask(()=>{scheduled=false; enhance();});
    };
    enhance();
    const root=document.getElementById('bookingTable') || document.body;
    new MutationObserver((records)=>{
      // React only to row/button creation/removal. Attribute changes are intentionally ignored.
      if(records.some(r=>r.type==='childList' && r.addedNodes.length+ r.removedNodes.length>0)) scheduleEnhance();
    }).observe(root,{childList:true,subtree:true});
  });
})();
