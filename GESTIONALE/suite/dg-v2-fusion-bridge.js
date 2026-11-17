/* DG33 - optional bridge from existing 2.0 suite to the original V2 parent. */
(function(){'use strict';
 if(window.parent===window)return; // Standalone V2 stays unmodified.
 const content=document.getElementById('content');if(!content)return;
 function activePage(){return document.querySelector('#main-nav .navbtn.active')?.dataset.page||''}
 function inject(){
  const page=activePage();if(!['piantine','control','fermate'].includes(page)||content.querySelector('#dg33-suite-extra'))return;
  const box=document.createElement('div');box.id='dg33-suite-extra';box.className='helpbox';box.style.cssText='margin:12px 0;display:flex;align-items:center;gap:8px;flex-wrap:wrap;';
  box.innerHTML=`<b>V2 Fusion DG33:</b> <span style="font-size:12px">La grafica e le funzioni originali restano attive.</span> <button class="btn primary" type="button" data-dg33-suite="editor">Pubblica piantine ufficiali</button> <button class="btn outline" type="button" data-dg33-suite="reports">PDF posti e fermate</button>`;
  content.prepend(box);
 }
 content.addEventListener('click',e=>{
  const el=e.target.closest('[data-dg33-suite]');if(!el)return;e.preventDefault();
  if(!location.origin||location.origin==='null')return;
  window.parent.postMessage({kind:el.dataset.dg33Suite==='editor'?'dg33-open-editor':'dg33-open-reports'},location.origin);
 });
 const observer=new MutationObserver(()=>{if(!content.querySelector('#dg33-suite-extra'))queueMicrotask(inject)});
 observer.observe(content,{childList:true});
 inject();
})();
