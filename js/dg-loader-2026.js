/* Bus loading leggero: nessuna GIF esterna o dipendenza */
(()=>{'use strict';
const boot=()=>{
 const overlay=document.querySelector('.page-loader');
 if(!overlay)return;
 overlay.classList.add('dg-bus-loader');
 overlay.setAttribute('role','status');overlay.setAttribute('aria-label','Caricamento della pagina');overlay.setAttribute('aria-hidden','false');
 overlay.innerHTML=`<div class="dg-loader-content"><img src="assets/logo.JPEG" alt="" aria-hidden="true"><div class="dg-loader-road" aria-hidden="true"><svg class="dg-loader-bus" viewBox="0 0 160 76" xmlns="http://www.w3.org/2000/svg"><path d="M10 14Q10 6 24 6H132Q147 6 149 20V54H8V24Q8 17 10 14" fill="#eff7fc"/><path d="M18 15H132Q139 15 139 23V36H18Z" fill="#2b79ab"/><path d="M56 15V37M92 15V37M122 15V37" stroke="#d5efff" stroke-width="3"/><path d="M8 41H149V55H8" fill="#1595da"/><path d="M10 53H147" stroke="#f7bf55" stroke-width="3"/><rect x="15" y="47" width="13" height="5" rx="2" fill="#fff0ad"/><rect x="136" y="46" width="8" height="6" rx="2" fill="#e85c52"/><circle cx="39" cy="56" r="12" fill="#172331"/><circle cx="39" cy="56" r="5" fill="#b6c4d0"/><circle cx="119" cy="56" r="12" fill="#172331"/><circle cx="119" cy="56" r="5" fill="#b6c4d0"/></svg></div><div class="dg-loader-label">DELGROSSO VIAGGI</div><div class="dg-loader-sub">Stiamo preparando il tuo viaggio…</div></div>`;
 const t0=performance.now(); let finished=false;
 const hide=()=>{if(finished)return;finished=true;const time=Math.max(0,460-(performance.now()-t0));setTimeout(()=>{overlay.classList.add('hide');overlay.setAttribute('aria-hidden','true')},time)};
 if(document.readyState==='complete')hide();else window.addEventListener('load',hide,{once:true});
 setTimeout(hide,2200); // rete lenta: non bloccare mai la navigazione
 window.addEventListener('pageshow',e=>{if(e.persisted)hide()});
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
