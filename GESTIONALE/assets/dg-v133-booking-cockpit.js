/* V133 - booking context & cashier cockpit
 * Keeps the selected booking context stable while editing and makes the daily collection workflow explicit.
 */
(function(){
  'use strict';
  const KEY='dg.v133.bookingContext';
  function qs(s){return document.querySelector(s)}
  function text(el){return (el?.textContent||'').replace(/\s+/g,' ').trim()}
  function saveContext(row){
    if(!row) return;
    const cells=[...row.querySelectorAll('td')].map(text);
    const ctx={id:cells[0]||'',cliente:cells[1]||'',viaggio:cells[2]||'',data:cells[3]||'',posti:cells[4]||'',totale:cells[5]||'',pagato:cells[6]||'',residuo:cells[7]||'',stato:cells[8]||'',ts:Date.now()};
    try{sessionStorage.setItem(KEY,JSON.stringify(ctx))}catch(e){}
    render(ctx);
  }
  function get(){try{return JSON.parse(sessionStorage.getItem(KEY)||'null')}catch(e){return null}}
  function render(ctx){
    if(!ctx) return;
    let box=qs('#dgV133Context');
    if(!box){
      box=document.createElement('section'); box.id='dgV133Context'; box.className='dg-v133-context';
      const host=qs('#modal .content')||document.body; host.insertBefore(box,host.firstChild);
    }
    box.innerHTML='<div class="dg-v133-title">📋 Prenotazione selezionata</div><div class="dg-v133-grid">'+
      '<div><span>Cliente</span><strong>'+esc(ctx.cliente||'—')+'</strong></div>'+
      '<div><span>Viaggio</span><strong>'+esc(ctx.viaggio||'—')+'</strong></div>'+ 
      '<div><span>Posti</span><strong>'+esc(ctx.posti||'—')+'</strong></div>'+ 
      '<div><span>Totale</span><strong>'+esc(ctx.totale||'—')+'</strong></div>'+ 
      '<div><span>Incassato</span><strong>'+esc(ctx.pagato||'—')+'</strong></div>'+ 
      '<div><span>Residuo</span><strong class="residuo">'+esc(ctx.residuo||'—')+'</strong></div></div>';
  }
  function esc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function restore(){
    const c=get(); if(!c) return;
    render(c);
    const map={cliente_nome:c.cliente,cliente_telefono:'',cliente_email:''};
    // Only restore a field if the existing application left it blank; never overwrite user input.
    Object.entries(map).forEach(([id,val])=>{const el=qs('#'+id); if(el && !el.value && val) el.value=val});
    const id=qs('#prenotazione_id'); if(id&&!id.value&&c.id) id.value=c.id;
  }
  document.addEventListener('click',function(e){
    const table=qs('#bookingTable'); if(!table) return;
    const row=e.target.closest('#bookingTable tbody tr'); if(row) saveContext(row);
  },true);
  document.addEventListener('DOMContentLoaded',function(){
    restore();
    const modal=qs('#modal');
    if(modal){
      const obs=new MutationObserver(()=>{if(!modal.classList.contains('hidden')) restore()});
      obs.observe(modal,{attributes:true,attributeFilter:['class']});
    }
    if(location.pathname.endsWith('pagamenti.html')){
      const m=qs('#modal'); if(m){
        const obs=new MutationObserver(()=>{const c=get(); if(c) render(c)}); obs.observe(m,{childList:true,subtree:true});
      }
    }
  });
})();
