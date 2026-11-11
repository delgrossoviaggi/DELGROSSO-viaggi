/* DELGROSSO V6 — the same 8 primary features on desktop/iOS/Android.
   Works only inside an authenticated V1 session; does not manage credentials or Supabase permissions. */
(function(){'use strict';
  const items=[
   ['suite:piantine','Crea / Modifica piantine'],
   ['suite:cassa-nicola','Contabilità Nicola'],
   ['suite:cassa-raffaele','Contabilità Raffaele'],
   ['suite:agenda','Agenda completa'],
   ['suite:prenotazioni','Prenotazioni con piantina'],
   ['suite:pagamenti','Registra pagamento'],
   ['suite:archivio','Ricevute e documenti'],
   ['suite:notifiche','Notifiche prenotazioni'],
   ['rubrica-wa','📱 Numeri WhatsApp per viaggio']
  ];
  const $=id=>document.getElementById(id);
  const authenticated=()=>document.body.classList.contains('dg44-authenticated') && $('app')?.classList.contains('on');
  let lastFocused=null;
  function close(){
    const sheet=$('dg-v6-mobile-sheet'),bg=$('dg-v6-mobile-backdrop'),button=$('dg-v6-functions');
    if(!sheet)return;
    sheet.dataset.open='false';bg.dataset.open='false';button?.setAttribute('aria-expanded','false');
    if(lastFocused&&document.contains(lastFocused))lastFocused.focus({preventScroll:true});lastFocused=null;
  }
  function open(){
    if(!authenticated())return;
    const sheet=$('dg-v6-mobile-sheet'),bg=$('dg-v6-mobile-backdrop');
    if(!sheet)return;
    lastFocused=document.activeElement;sheet.dataset.open='true';bg.dataset.open='true';
    $('dg-v6-functions').setAttribute('aria-expanded','true');
    sheet.querySelector('button')?.focus({preventScroll:true});
  }
  function navigate(target){
    close();
    if(!authenticated()||typeof window.dg44Go!=='function')return;
    window.dg44Go(target);
    // On iOS and Android return to the top of the content panel after a route change.
    requestAnimationFrame(()=>{try{window.scrollTo({top:0,behavior:'instant'})}catch{window.scrollTo(0,0)}});
  }
  function init(){
    if($('dg-v6-mobile-dock'))return;
    const dock=document.createElement('nav');dock.id='dg-v6-mobile-dock';dock.setAttribute('aria-label','Navigazione rapida DELGROSSO su mobile');
    dock.innerHTML='<button type="button" id="dg-v6-home">⌂ Scrivania</button><button type="button" id="dg-v6-functions" aria-expanded="false" aria-controls="dg-v6-mobile-sheet">☷ Funzioni</button>';
    const bg=document.createElement('div');bg.id='dg-v6-mobile-backdrop';bg.dataset.open='false';
    const sheet=document.createElement('section');sheet.id='dg-v6-mobile-sheet';sheet.dataset.open='false';sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');sheet.setAttribute('aria-label','Funzioni disponibili su tutti i dispositivi');
    sheet.innerHTML='<div class="dg-v6-sheet-header"><strong>Funzioni principali DELGROSSO</strong><button type="button" id="dg-v6-close" aria-label="Chiudi menu">×</button></div><div class="dg-v6-sheet-items"></div><div class="dg-v6-sheet-footer"><button type="button" id="dg-v6-all-sections">☰ Apri menu aziendale completo</button></div>';
    const container=sheet.querySelector('.dg-v6-sheet-items');
    items.forEach(([target,label])=>{
      const b=document.createElement('button');b.type='button';b.dataset.dgV6Target=target;
      b.textContent=label;b.addEventListener('click',()=>navigate(target));container.appendChild(b);
    });
    document.body.append(bg,sheet,dock);
    $('dg-v6-home').addEventListener('click',()=>navigate('dashboard'));
    $('dg-v6-functions').addEventListener('click',()=>sheet.dataset.open==='true'?close():open());
    $('dg-v6-close').addEventListener('click',close);bg.addEventListener('click',close);
    $('dg-v6-all-sections').addEventListener('click',()=>{close();if(!authenticated())return;
      if(typeof window.dg44ToggleMenu==='function')window.dg44ToggleMenu();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&sheet.dataset.open==='true')close()});
    document.addEventListener('click',e=>{if(e.target?.closest?.('#dg44-sidebar-menu [data-dg44-target]'))close()});
    // Avoid a left-open mobile menu after a desktop/tablet breakpoint transition.
    window.addEventListener('resize',()=>{if(innerWidth>850)close()},{passive:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
