/* DEL GROSSO GESTIONALE V90 — table labeling only; no data writes. */
(()=>{
  const run=()=>{
    document.querySelectorAll('main table').forEach(table=>{
      if(table.classList.contains('dg86-table')) return;
      table.classList.add('dg90-responsive-table');
      const heads=[...table.querySelectorAll('thead th')].map(th=>th.textContent.trim().replace(/\s+/g,' '));
      if(!heads.length)return;
      table.querySelectorAll('tbody tr').forEach(tr=>[...tr.children].forEach((td,i)=>{
        if(heads[i]&&!td.dataset.label) td.dataset.label=heads[i];
      }));
    });
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
})();
