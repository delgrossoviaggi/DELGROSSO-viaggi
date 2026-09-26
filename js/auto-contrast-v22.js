
/* DELGROSSO V23 — contrasto intelligente globale */
(()=>{
 const CONTENT='h1,h2,h3,h4,h5,h6,p,li,label,strong,small,span,a';
 const BLOCKS='section,article,.card,[class*="card"],[class*="hero"],[class*="banner"],[class*="feature"],[class*="experience"],[class*="overlay"],[style*="background"]';
 const parse=s=>{const m=(s||'').match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);return m?[+m[1],+m[2],+m[3]]:null};
 const luminance=rgb=>{
   const f=v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)};
   return .2126*f(rgb[0])+.7152*f(rgb[1])+.0722*f(rgb[2]);
 };
 const bgInfo=el=>{
   let n=el, hasImage=false, rgb=null;
   while(n&&n!==document.documentElement){
     const cs=getComputedStyle(n);
     if(cs.backgroundImage && cs.backgroundImage!=='none') hasImage=true;
     const x=parse(cs.backgroundColor);
     if(x){
       const a=(cs.backgroundColor.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)/)||[])[1];
       if(a===undefined || +a>.18){rgb=x;break}
     }
     n=n.parentElement;
   }
   return {hasImage,rgb:rgb||[247,244,239]};
 };
 const setText=(el,dark)=>{
   const fg=dark?'#FFFFFF':'#0A1724', muted=dark?'rgba(255,255,255,.88)':'#465666';
   el.style.setProperty('--auto-fg',fg);
   el.style.setProperty('--auto-muted',muted);
   el.querySelectorAll(CONTENT).forEach(x=>{
     if(x.closest('button,.btn,.button,[class*="cta"],nav,header,footer'))return;
     x.style.setProperty('color',x.matches('p,small,label')?muted:fg,'important');
     if(dark) x.style.setProperty('text-shadow','0 2px 10px rgba(0,0,0,.55)','important');
     else x.style.removeProperty('text-shadow');
   });
 };
 const protectImageBlock=el=>{
   if(el.dataset.dgContrastReady)return;
   el.dataset.dgContrastReady='1';
   const cs=getComputedStyle(el);
   if(cs.position==='static')el.style.position='relative';
   // Dedicated scrim behind copy, not over the image itself.
   const text=[...el.children].find(c=>c.matches?.('.content,.copy,.text,[class*="content"],[class*="copy"],[class*="text"],[class*="overlay"]'));
   if(text){
     text.classList.add('dg-readable-copy');
     setText(text,true);
   }else setText(el,true);
 };
 const apply=()=>{
   document.querySelectorAll(BLOCKS).forEach(el=>{
     if(el.closest('header,footer,nav'))return;
     const b=bgInfo(el);
     if(b.hasImage) protectImageBlock(el);
     else setText(el,luminance(b.rgb)<.43);
   });
 };
 let q=false; const schedule=()=>{if(q)return;q=true;requestAnimationFrame(()=>{q=false;apply()})};
 document.addEventListener('DOMContentLoaded',apply);
 window.addEventListener('load',apply);
 window.addEventListener('resize',schedule,{passive:true});
 new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','src']});
})();
