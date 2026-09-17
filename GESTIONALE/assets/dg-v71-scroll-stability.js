/* DELGROSSO GESTIONALE V71 — scroll/focus stability
   Keeps the current viewport stable when legacy modules rerender or focus controls.
   It does not touch Supabase/data services.
*/
(()=>{'use strict';
  const KEY='__dgV71ScrollStability';
  if(window[KEY]) return; window[KEY]=true;

  const snapshots=new WeakMap();
  let restoreTimer=0;
  let armedUntil=0;

  function scrollable(el){
    if(!el || el===document.body || el===document.documentElement) return false;
    const s=getComputedStyle(el);
    const oy=s.overflowY;
    return (oy==='auto'||oy==='scroll'||oy==='overlay') && el.scrollHeight>el.clientHeight+2;
  }
  function capture(target){
    const snap={x:window.scrollX||0,y:window.scrollY||0, els:[]};
    let el=target instanceof Element?target:null;
    while(el){
      if(scrollable(el)) snap.els.push([el,el.scrollLeft,el.scrollTop]);
      el=el.parentElement;
    }
    snapshots.set(document, snap);
    armedUntil=performance.now()+900;
  }
  function restore(){
    const snap=snapshots.get(document); if(!snap) return;
    if(performance.now()>armedUntil) return;
    const restoreNow=()=>{
      if(Math.abs((window.scrollY||0)-snap.y)>1 || Math.abs((window.scrollX||0)-snap.x)>1){
        window.scrollTo({left:snap.x,top:snap.y,behavior:'auto'});
      }
      for(const [el,x,y] of snap.els){
        if(Math.abs(el.scrollTop-y)>1) el.scrollTop=y;
        if(Math.abs(el.scrollLeft-x)>1) el.scrollLeft=x;
      }
    };
    cancelAnimationFrame(restoreTimer);
    restoreTimer=requestAnimationFrame(()=>{
      restoreNow();
      requestAnimationFrame(restoreNow);
    });
  }

  // Capture before focus/click so native focus and legacy handlers cannot move the viewport.
  document.addEventListener('pointerdown',e=>{ if(e.target instanceof Element) capture(e.target); },true);
  document.addEventListener('mousedown',e=>{ if(e.target instanceof Element) capture(e.target); },true);
  document.addEventListener('touchstart',e=>{ if(e.target instanceof Element) capture(e.target); },{capture:true,passive:true});
  document.addEventListener('focusin',e=>{ if(e.target instanceof Element){ capture(e.target); restore(); } },true);
  document.addEventListener('click',e=>{ if(e.target instanceof Element){ restore(); } },true);
  document.addEventListener('change',e=>{ if(e.target instanceof Element){ restore(); } },true);

  // Prevent CSS smooth scrolling from turning corrective restoration into visible jumps.
  const style=document.createElement('style');
  style.id='dg-v71-scroll-stability-css';
  style.textContent='html{scroll-behavior:auto!important} body{overflow-anchor:none} .modal,.dialog,.popup{overscroll-behavior:contain}';
  document.head.appendChild(style);
})();
