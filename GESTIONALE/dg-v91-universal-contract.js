/* DEL GROSSO GESTIONALE V91 — UNIVERSAL RESPONSIVE CONTRACT
   Presentation-only. Marks the real page content so legacy selectors cannot
   accidentally leave readable content under old theme/layout rules. */
(()=>{
  const SHELL = new Set([
    'dg-v75-sidebar','dg-v75-topbar','dg-v75-bottom','dg-v75-overlay',
    'dg-v75-context','dg-v75-palette'
  ]);
  const mark=()=>{
    const body=document.body;
    if(!body?.classList.contains('dg-v75-app')) return;
    for(const el of body.children){
      if(!(el instanceof HTMLElement)) continue;
      if(SHELL.has(el.className)) continue;
      if(el.matches('.dg-v75-sidebar,.dg-v75-topbar,.dg-v75-bottom,.dg-v75-overlay,.dg-v75-context,.dg-v75-palette')) continue;
      el.classList.add('dg-v91-content-root');
    }
    document.documentElement.dataset.dgV91='1';
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mark,{once:true});
  else mark();
})();
