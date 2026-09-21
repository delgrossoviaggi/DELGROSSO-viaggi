/* DELGROSSO GESTIONALE V193 — Focus controller */
(function(){'use strict';if(window.__DG_V193__)return;window.__DG_V193__=true;
const file=(location.pathname.split('/').pop()||'dashboard.html').toLowerCase();
function addBar(){
 if(file==='login.html'||document.querySelector('.dg193-focusbar'))return;
 const host=document.querySelector('.main-content')||document.querySelector('main')||document.body;
 if(!host)return;
 const bar=document.createElement('div');bar.className='dg193-focusbar';bar.innerHTML='<div class="left"><i class="dot"></i><div><strong>Modalità controllo</strong><span>Visualizzazione semplificata · i dati restano invariati</span></div></div><button type="button" aria-pressed="false">Mostra dettagli</button>';
 host.insertBefore(bar,host.firstChild);
 if(file==='dashboard.html'){
  document.body.classList.add('dg193-dashboard-focus');
  const btn=bar.querySelector('button');
  btn.addEventListener('click',()=>{const open=document.body.classList.toggle('dg193-dashboard-details');document.body.classList.toggle('dg193-dashboard-focus',!open);btn.setAttribute('aria-pressed',String(open));btn.textContent=open?'Nascondi dettagli':'Mostra dettagli';});
 }
}
function init(){document.body.classList.add('dg193-page');addBar();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
