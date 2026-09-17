/* DEL GROSSO GESTIONALE V84 — BLACK TEXT BRIDGE
 * CSS-first, O(1) theme synchronization. No full-DOM scans and no MutationObserver on body.
 */
(()=>{
 'use strict';
 if(window.__DG_V84_BLACK_TEXT__) return;
 window.__DG_V84_BLACK_TEXT__=true;
 const root=document.documentElement;
 const sync=()=>{
   const dark=root.dataset.theme==='dark'||root.classList.contains('dark')||document.body?.dataset.theme==='dark'||document.body?.classList.contains('dark');
   root.dataset.dgTextMode='black-both-themes';
   if(document.body) document.body.dataset.dgTextMode='black-both-themes';
   root.style.setProperty('--dg-v84-text','#000');
   root.style.setProperty('--dg-v84-surface',dark?'#f7f9fc':'#fff');
   root.style.setProperty('--dg-v84-surface-soft',dark?'#eef3f7':'#f7f9fc');
 };
 sync();
 document.addEventListener('DOMContentLoaded',sync,{once:true});
 // Observe only theme attributes; never observe body subtree.
 new MutationObserver(sync).observe(root,{attributes:true,attributeFilter:['data-theme','class']});
 window.DG_BLACK_TEXT={version:'V84',refresh:sync};
})();
