/* DEL GROSSO GESTIONALE V93 — lightweight table labeling / touch guard. */
(()=>{
  const shellSelector='.dg-v75-sidebar,.dg-v75-topbar,.dg-v75-bottom,.dg-v75-overlay,.dg-v75-context,.dg-v75-palette';
  const labelTables=()=>{
    document.querySelectorAll('table:not(.dg-v93-labeled)').forEach(table=>{
      if(table.matches('.seat-map-table,[data-no-responsive="true"]')) return;
      const heads=[...table.querySelectorAll('thead th')].map(th=>th.textContent.replace(/\s+/g,' ').trim());
      if(!heads.length) return;
      table.classList.add('dg-v93-labeled');
      table.querySelectorAll('tbody tr').forEach(tr=>{
        [...tr.children].forEach((cell,i)=>{
          if(cell instanceof HTMLElement && heads[i] && !cell.dataset.label) cell.dataset.label=heads[i];
        });
      });
    });
  };
  const init=()=>{
    labelTables();
    document.documentElement.dataset.dgV93='1';
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
