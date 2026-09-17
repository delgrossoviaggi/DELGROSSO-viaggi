(function(){
  'use strict';
  const labels=['ID Prenotazione','Cliente','Viaggio','Data','Posti','Importo','Pagato','Residuo','Stato pagamento','Presente','Azioni'];
  function enhance(){
    const table=document.getElementById('bookingTable'); if(!table) return;
    table.classList.add('dg-booking-table');
    table.querySelectorAll('tbody tr').forEach(row=>{
      const cells=row.querySelectorAll('td');
      cells.forEach((c,i)=>{ if(labels[i]) c.dataset.label=labels[i]; });
      const actions=row.querySelector('.booking-actions');
      if(actions && !actions.querySelector('.dg-mobile-confirm')){
        const open=actions.querySelector('.openBtn');
        const seat=actions.querySelector('.changeSeatBtn');
        if(open) open.textContent='Modifica dati';
        if(open){
          const confirm=document.createElement('button');
          confirm.type='button'; confirm.className='btn-secondary dg-mobile-confirm'; confirm.textContent='✓ Conferma';
          confirm.setAttribute('aria-label','Conferma cliente');
          confirm.addEventListener('click', async function(){
            if(!open) return;
            open.click();
            setTimeout(()=>{
              const modal=document.getElementById('modal');
              const state=document.getElementById('stato_select');
              const save=document.getElementById('save');
              if(modal && state && save){
                state.value='Confermata';
                save.click();
              }
            },120);
          });
          actions.insertBefore(confirm, open);
        }
        if(seat) seat.textContent='🪑 Posto';
      }
    });
  }
  document.addEventListener('DOMContentLoaded',()=>{
    enhance();
    const target=document.querySelector('#bookingTable tbody');
    if(target) new MutationObserver(enhance).observe(target,{childList:true});
  });
})();
