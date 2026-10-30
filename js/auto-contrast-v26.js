
/* DELGROSSO V26 — contrasto automatico globale */
(()=>{
 const TEXT='h1,h2,h3,h4,h5,h6,p,span,small,strong,em,label,li,dt,dd,a';
 const EXCLUDE='header,nav,footer,button,.btn,.button,input,select,textarea,[class*="cta"],.dg-footer-credits';
 const parse=s=>{const m=(s||'').match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);return m?[+m[1],+m[2],+m[3]]:null};
 const alpha=s=>{const m=(s||'').match(/rgba\([^)]*,\s*([\d.]+)\s*\)$/);return m?+m[1]:1};
 const lum=([r,g,b])=>{
   const f=v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)};
   return .2126*f(r)+.7152*f(g)+.0722*f(b);
 };
 const context=el=>{
   let n=el, image=false, color=null;
   while(n&&n!==document.documentElement){
     const cs=getComputedStyle(n);
     if(cs.backgroundImage&&cs.backgroundImage!=='none') image=true;
     const c=parse(cs.backgroundColor);
     if(c&&alpha(cs.backgroundColor)>.16){color=c;break}
     n=n.parentElement;
   }
   return {image,color:color||[248,250,252]};
 };
 const markPhotoCopy=()=>{
   document.querySelectorAll('section,article,div').forEach(b=>{
     const cs=getComputedStyle(b);
     if(!cs.backgroundImage||cs.backgroundImage==='none')return;
     const direct=b.querySelector(':scope > h1,:scope > h2,:scope > h3,:scope > p,:scope > [class*="content"],:scope > [class*="copy"],:scope > [class*="text"],:scope > [class*="overlay"]');
     if(direct) direct.classList.add('dg-photo-copy');
   });
 };
 const apply=t=>{
   if(t.closest(EXCLUDE))return;
   const c=context(t), dark=c.image||lum(c.color)<.43;
   const fg=dark?'#FFFFFF':'#0B1F33';
   t.style.setProperty('color',fg,'important');
   if(c.image){
     t.style.setProperty('text-shadow','0 2px 10px rgba(0,0,0,.78),0 0 2px rgba(0,0,0,.65)','important');
   }else{
     t.style.removeProperty('text-shadow');
   }
 };
 const run=()=>{markPhotoCopy();document.querySelectorAll(TEXT).forEach(apply)};
 let pending=false;
 const queue=()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;run()})};
 document.addEventListener('DOMContentLoaded',run);
 window.addEventListener('load',run);
 window.addEventListener('resize',queue,{passive:true});
 new MutationObserver(queue).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','src']});
})();
