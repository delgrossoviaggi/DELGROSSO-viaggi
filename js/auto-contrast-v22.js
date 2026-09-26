
/* DELGROSSO V25 — contrasto automatico globale */
(()=>{
 const TEXT='h1,h2,h3,h4,h5,h6,p,span,small,strong,em,label,li,dt,dd,a';
 const SKIP='header,nav,footer,button,.btn,.button,input,select,textarea,[class*="cta"]';
 const rgb=s=>{let m=(s||'').match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);return m?[+m[1],+m[2],+m[3]]:null};
 const lum=v=>{const f=x=>{x/=255;return x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4)};return .2126*f(v[0])+.7152*f(v[1])+.0722*f(v[2])};
 const context=el=>{
   let n=el,img=false,col=null;
   while(n&&n!==document.documentElement){
     const cs=getComputedStyle(n);
     if(cs.backgroundImage&&cs.backgroundImage!=='none')img=true;
     const x=rgb(cs.backgroundColor);
     const am=(cs.backgroundColor||'').match(/rgba\([^)]*,\s*([\d.]+)\s*\)$/);
     if(x&&(!am||+am[1]>.18)){col=x;break}
     n=n.parentElement;
   }
   return {img,col:col||[244,247,250]};
 };
 const readable=t=>{
   if(t.closest(SKIP))return;
   const x=context(t), dark=x.img || lum(x.col)<.42;
   t.style.setProperty('color',dark?'#FFFFFF':'#102333','important');
   if(x.img){
     t.style.setProperty('text-shadow','0 2px 9px rgba(0,0,0,.78),0 0 2px rgba(0,0,0,.7)','important');
   }else t.style.removeProperty('text-shadow');
 };
 const photoBlocks=()=>{
   document.querySelectorAll('section,article,div').forEach(b=>{
     const cs=getComputedStyle(b);
     if(!cs.backgroundImage||cs.backgroundImage==='none')return;
     const copy=b.querySelector(':scope > h1,:scope > h2,:scope > h3,:scope > p,:scope > [class*="content"],:scope > [class*="copy"],:scope > [class*="text"]');
     if(copy) copy.classList.add('dg-photo-copy');
   });
 };
 const run=()=>{photoBlocks();document.querySelectorAll(TEXT).forEach(readable)};
 let pending=false; const queue=()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;run()})};
 document.addEventListener('DOMContentLoaded',run); window.addEventListener('load',run);
 window.addEventListener('resize',queue,{passive:true});
 new MutationObserver(queue).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','src']});
})();
