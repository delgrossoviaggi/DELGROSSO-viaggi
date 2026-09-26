
/* DELGROSSO V22 — contrasto automatico testo/sfondo */
(()=>{
 const SELECTOR='[data-auto-contrast],.auto-contrast,.contrast-auto,.card,.service-card,.trip-card,.news-card,.fleet-card,.feature-card,.info-card';
 const rgb=s=>{
   const m=(s||'').match(/rgba?\(([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/i);
   return m?[+m[1],+m[2],+m[3]]:null;
 };
 const lum=([r,g,b])=>{
   const f=v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)};
   return .2126*f(r)+.7152*f(g)+.0722*f(b);
 };
 const effectiveBg=el=>{
   let n=el;
   while(n&&n!==document.documentElement){
     const c=getComputedStyle(n).backgroundColor, a=(c||'').match(/rgba?\([^)]*(?:,\s*([\d.]+))?\)/);
     const v=rgb(c);
     if(v && (!a || a[1]===undefined || +a[1]>.08)) return v;
     n=n.parentElement;
   }
   return [247,244,239];
 };
 const apply=el=>{
   if(el.closest('.limo-overlay')) return;
   const L=lum(effectiveBg(el));
   const dark=L<.43;
   el.style.setProperty('--auto-fg',dark?'#FFFFFF':'#0A1724');
   el.style.setProperty('--auto-muted',dark?'rgba(255,255,255,.78)':'#5E6B78');
   el.style.color='var(--auto-fg)';
   el.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,label,strong,small').forEach(x=>{
     if(!x.closest('button,.btn,.button,[class*="cta"]')) x.style.color =
       x.matches('p,small,label')?'var(--auto-muted)':'var(--auto-fg)';
   });
 };
 const run=()=>document.querySelectorAll(SELECTOR).forEach(apply);
 let queued=false;
 const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;run()})};
 document.addEventListener('DOMContentLoaded',run);
 window.addEventListener('load',run);
 new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});
})();
