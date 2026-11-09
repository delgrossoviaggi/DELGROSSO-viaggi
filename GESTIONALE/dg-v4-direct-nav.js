/* DELGROSSO Business Suite V4 — Primary menu recovery.
 * Previous builds appended new buttons to the static HTML, but the original V1 injectNav()
 * overwrote them on startup. This module installs permanent direct access links and keeps
 * them visible even if V1 dynamically rebuilds the menu. It does not change authentication,
 * Supabase permissions, bookings, payments, or historical layouts. */
(()=>{'use strict';
const actions=[
  {key:'piantine',label:'Crea e modifica piantine',brief:'GT53, GT63 e libreria condivisa',icon:'🪑'},
  {key:'cassa-nicola',label:'Contabilità Nicola',brief:'Incassi, saldo e PDF per viaggio',icon:'💶'},
  {key:'cassa-raffaele',label:'Contabilità Raffaele',brief:'Incassi, saldo e PDF per viaggio',icon:'💶'},
  {key:'agenda',label:'Agenda completa',brief:'Appuntamenti, attività e storico',icon:'📅'},
  {key:'prenotazioni',label:'Prenotazioni con piantina',brief:'Posti liberi, occupati e conferme',icon:'🚌'},
  {key:'pagamenti',label:'Registra pagamento',brief:'Viaggio, cliente, incasso e ricevuta',icon:'💳'},
  {key:'archivio',label:'Ricevute e documenti',brief:'Archivio documentale riservato',icon:'📄'},
  {key:'notifiche',label:'Notifiche prenotazioni',brief:'Chi ha prenotato e quando',icon:'🔔'}
];
let selected='';
function navigate(key){
 if(typeof window.dgSuiteOpen!=='function'){
  const note=document.getElementById('dg-suite-status');if(note)note.textContent='Modulo V2 non caricato: verifica i file nella cartella suite.';
  return;
 }
 selected=key;
 window.dgSuiteOpen(key);
 document.querySelectorAll('[data-dg-v4-key]').forEach(x=>x.classList.toggle('active',x.dataset.dgV4Key===selected));
 const title=document.querySelector('#page-suitev2 .section-title h2');
 const a=actions.find(x=>x.key===key);
 if(title&&a)title.textContent=a.icon+' '+a.label;
}
function directButton(a){
 const b=document.createElement('button');b.type='button';b.className='dg-v4-direct';
 b.dataset.dgV4Key=a.key;b.title=a.brief;
 const ico=document.createElement('span');ico.className='ico';ico.textContent=a.icon;
 const label=document.createElement('span');label.textContent=a.label;
 b.append(ico,label);b.addEventListener('click',()=>navigate(a.key));return b;
}
function ensureDesktopNav(){
 const nav=document.getElementById('sideNav');if(!nav)return;
 let anchor=nav.querySelector('[data-dg-v4-group]');
 if(!anchor){
  anchor=document.createElement('div');anchor.dataset.dgV4Group='1';
  anchor.className='dg-v4-navhead';anchor.textContent='MODULI OPERATIVI COMPLETI';
  // Put buttons at the end of the nav; V1 dynamically reorders other groups.
  nav.appendChild(anchor);
 }
 for(const a of actions){
  if(!nav.querySelector('[data-dg-v4-key="'+a.key+'"]')){
   const b=directButton(a);b.classList.toggle('active',a.key===selected);
   nav.appendChild(b);
  }
 }
}
function ensureMobileNav(){
 const grid=document.querySelector('.mobile-menu-grid');if(!grid)return;
 for(const a of actions.slice(0,4)){
  if(grid.querySelector('[data-dg-v4-key="'+a.key+'"]'))continue;
  const b=document.createElement('button');b.type='button';b.dataset.dgV4Key=a.key;
  b.textContent=a.icon;const s=document.createElement('span');s.textContent=a.label;b.append(s);
  b.addEventListener('click',()=>{navigate(a.key);if(typeof window.toggleMobileMenu==='function')window.toggleMobileMenu(false)});
  grid.appendChild(b);
 }
}
function ensureDashboard(){
 const page=document.getElementById('page-dashboard');if(!page||page.querySelector('.dg-v4-shortcuts'))return;
 const block=document.createElement('section');block.className='dg-v4-shortcuts';
 const version=document.createElement('div');version.className='dg-v4-version';version.textContent='DELGROSSO BUSINESS SUITE · V4 · FUNZIONI RECUPERATE';
 const title=document.createElement('h3');title.textContent='Accesso rapido alle funzioni del gestionale';
 const hint=document.createElement('p');hint.textContent='Le sezioni che avevi richiesto sono qui, direttamente nella dashboard, con la sessione operatore già attiva.';
 const grid=document.createElement('div');grid.className='dg-v4-grid';
 for(const a of actions){const b=document.createElement('button');b.type='button';b.className='dg-v4-card';b.dataset.dgV4Key=a.key;
 const ico=document.createElement('span');ico.className='dg-v4-card-icon';ico.textContent=a.icon;
 const text=document.createElement('span');const strong=document.createElement('b');strong.textContent=a.label;
 const small=document.createElement('small');small.textContent=a.brief;text.append(strong,small);
 b.append(ico,text);b.addEventListener('click',()=>navigate(a.key));grid.appendChild(b)}
 block.append(version,title,hint,grid);
 const head=page.querySelector('.dg-r35-head')||page.firstElementChild;
 if(head?.parentNode)head.insertAdjacentElement('afterend',block);else page.prepend(block);
}
let running=false;
function repair(){if(running)return;running=true;try{ensureDesktopNav();ensureMobileNav();ensureDashboard()}finally{running=false}}
function init(){
 repair();
 const nav=document.getElementById('sideNav'),mobile=document.querySelector('.mobile-menu-grid'),dash=document.getElementById('page-dashboard');
 // React to V1 startup replacing innerHTML or navigation groups; no perpetual timer needed.
 const observer=new MutationObserver(entries=>{
  if(entries.some(e=>e.type==='childList'))queueMicrotask(repair);
 });
 if(nav)observer.observe(nav,{childList:true,subtree:true});
 if(mobile)observer.observe(mobile,{childList:true,subtree:true});
 if(dash)observer.observe(dash,{childList:true,subtree:false});
 window.dgV4DirectOpen=navigate;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
