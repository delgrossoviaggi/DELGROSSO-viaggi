/* DELGROSSO V112 — universal device behavior. Lightweight, no polling, no global MutationObserver. */
(()=>{
  'use strict';
  const root=document.documentElement;
  const ua=navigator.userAgent||'';
  const touch=('ontouchstart' in window)||navigator.maxTouchPoints>0;
  const coarse=window.matchMedia?.('(pointer:coarse)').matches||false;
  const mobile=/Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const tablet=/iPad|Android(?!.*Mobile)/i.test(ua)||(/Macintosh/i.test(ua)&&touch);
  root.dataset.dgDevice=tablet?'tablet':mobile?'mobile':'desktop';
  root.dataset.dgTouch=(touch||coarse)?'1':'0';
  if(window.visualViewport){
    const sync=()=>root.style.setProperty('--dg-vv-height',`${Math.round(window.visualViewport.height)}px`);
    window.visualViewport.addEventListener('resize',sync,{passive:true}); sync();
  }
  // Keep focus visible above the on-screen keyboard on touch devices.
  if(touch){
    document.addEventListener('focusin',e=>{
      const el=e.target;
      if(!(el instanceof HTMLElement))return;
      if(!/INPUT|SELECT|TEXTAREA/.test(el.tagName))return;
      setTimeout(()=>{try{el.scrollIntoView({block:'center',inline:'nearest',behavior:'smooth'})}catch(_){ }},120);
    },{passive:true});
  }
  // Add data labels once after initial render; the existing shell handles later table rows.
  const tables=['tripTable','bookingTable','clientiTable','fleetTable','nbTable','nbPaymentsTable','passengerTable','paymentsTable','quoteTable','reportTable'];
  const label=()=>tables.forEach(id=>{
    const t=document.getElementById(id); if(!t||!t.tHead)return;
    const heads=[...t.tHead.rows[0].cells].map(x=>x.textContent.trim().replace(/\s+/g,' '));
    [...t.tBodies].forEach(tb=>[...tb.rows].forEach(tr=>[...tr.cells].forEach((td,i)=>{if(heads[i]&&!td.dataset.label)td.dataset.label=heads[i]})));
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',label,{once:true});else label();
  // Safe-area aware body class for targeted components.
  if(touch)document.body.classList.add('dg112-touch');
})();

/* V114 polish: expose stable device classes and keep viewport changes cheap. */
(()=>{
  'use strict';
  const root=document.documentElement;
  const update=()=>{
    const w=window.innerWidth||root.clientWidth||0;
    const h=window.innerHeight||0;
    root.dataset.dgCompact=w<600?'phone':w<1100?'tablet':'desktop';
    root.dataset.dgLandscape=(w>h&&w<1100)?'1':'0';
  };
  window.addEventListener('resize',update,{passive:true});
  window.addEventListener('orientationchange',update,{passive:true});
  update();
})();
