/* DELGROSSO DG86 — Menu laterale semplice (26/11/2026)
 * Riordina le voci ESISTENTI del menu in pochi gruppi richiudibili, con ricerca.
 * Agisce sul menu visibile #dg44-sidebar-menu. Non crea né toglie pagine: sposta soltanto i
 * pulsanti già presenti, che mantengono il loro onclick originale (dg44Go).
 */
(function(){
'use strict';
const DAILY=['dashboard','controlroom','viaggi','riepilogo-viaggio','prenotazioni','pagamenti','cassa','clienti'];
const GROUPS=[
  {id:'viaggi',label:'Viaggi e posti',pages:['suite:piantine','sposta-clienti','posti','caricamento','suite:prenotazioni','liste-pdf','operativo','partenze','radar'],words:['piantin','posti','partenz','viaggi']},
  {id:'vendite',label:'Clienti e vendite',pages:['scheda-cliente','crm','preventivi','noleggi','acconti'],words:['cliente','preventiv','noleggi','acconti']},
  {id:'soldi',label:'Soldi e contabilità',pages:['dg34-nicola','dg34-raffaele','compenso-nicola','contabilitaquote','suite:pagamenti','economia','incassioperatori','amministrazione','fornitori'],words:['contabil','quote','econom','compenso','fornitor','cassa','incass','pagament']},
  {id:'messaggi',label:'Messaggi e notifiche',pages:['whatsapp','rubrica-wa','comunicazioni','suite:notifiche','assistente'],words:['whatsapp','comunicaz','assistent','notific']},
  {id:'documenti',label:'Documenti, agenda e report',pages:['suite:archivio','documenti','suite:agenda','agenda','statistiche','backup'],words:['document','agenda','statist','backup','pdf','ricevut','report']},
  {id:'mezzi',label:'Mezzi',pages:['flotta'],words:['flotta']},
  {id:'sistema',label:'Sistema',pages:['impostazioni','pro','sentinella','suitev2'],words:['impostaz','sentinel','avanzat']}
];
const NAV='dg44-sidebar-menu';
const pageOf=b=>b.dataset.dg44Target||b.dataset.page||'';
const KEY='dg86-open-groups';
const $=id=>document.getElementById(id);
const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
let openSet;try{openSet=new Set(JSON.parse(localStorage.getItem(KEY)||'[]'))}catch{openSet=new Set()}
const saveOpen=()=>{try{localStorage.setItem(KEY,JSON.stringify([...openSet]))}catch{}};

function labelOf(b){return (b.querySelector('span:last-child')||b).textContent.trim()}
function groupFor(b){
  const p=pageOf(b);
  if(DAILY.includes(p))return 'daily';
  for(const g of GROUPS)if(g.pages.includes(p))return g.id;
  const t=norm(labelOf(b)+' '+(b.getAttribute('onclick')||''));
  for(const g of GROUPS)if(g.words.some(w=>t.includes(w)))return g.id;
  return 'altro';
}
function build(){
  const nav=$(NAV);if(!nav)return;
  if(!nav.querySelector('.dg86-wrap')){
    nav.classList.add('dg86');
    const wrap=document.createElement('div');wrap.className='dg86-wrap';
    wrap.innerHTML='<input type="search" class="dg86-search" placeholder="Cerca nel menu…" aria-label="Cerca una voce del menu">'+
      '<div class="dg86-title">Uso quotidiano</div><div class="dg86-daily" data-g="daily"></div>'+
      GROUPS.concat([{id:'altro',label:'Altro'}]).map(g=>`<details class="dg86-group" data-gid="${g.id}"${openSet.has(g.id)?' open':''}><summary>${g.label}<span class="dg86-count"></span></summary><div class="dg86-items" data-g="${g.id}"></div></details>`).join('')+
      '<a class="dg86-phone" href="/GESTIONALE/semplice/">📱 Versione telefono</a>';
    nav.prepend(wrap);
    wrap.querySelector('.dg86-search').addEventListener('input',e=>filter(e.target.value));
    wrap.querySelectorAll('details').forEach(d=>d.addEventListener('toggle',()=>{if(d.dataset.searching)return;d.open?openSet.add(d.dataset.gid):openSet.delete(d.dataset.gid);saveOpen()}));
  }
  const wrap=nav.querySelector('.dg86-wrap');
  // Tutti i pulsanti del menu non ancora sistemati (anche quelli aggiunti dopo da altri moduli)
  const loose=[...nav.querySelectorAll('button[data-dg44-target]')].filter(b=>!b.dataset.dg86);
  for(const b of loose){
    const g=groupFor(b);
    const box=wrap.querySelector(`[data-g="${g}"]`);
    if(!box)continue;
    b.dataset.dg86=g;
    if(g==='daily'){ // ordine fisso per le voci quotidiane
      const idx=DAILY.indexOf(pageOf(b));
      const after=[...box.children].find(x=>DAILY.indexOf(pageOf(x))>idx);
      box.insertBefore(b,after||null);
    }else box.appendChild(b);
  }
  // il vecchio pulsante "Tutte le funzioni" non serve più: le voci sono nei gruppi
  nav.querySelectorAll('.dg44-more-toggle,.dg44-more-panel,.dg44-menu-title').forEach(x=>x.style.display='none');
  wrap.querySelectorAll('details').forEach(d=>{const n=d.querySelectorAll('.dg86-items button').length;d.hidden=!n;d.querySelector('.dg86-count').textContent=n?' '+n:''});
  revealActive();
}
function revealActive(){
  const nav=$(NAV);const a=nav&&nav.querySelector('.dg86-wrap button.active');
  const d=a&&a.closest('details');if(d&&!d.open){d.dataset.searching='';d.open=true}
}
function filter(q){
  const nav=$(NAV),wrap=nav.querySelector('.dg86-wrap'),n=norm(q).trim();
  wrap.querySelectorAll('button').forEach(b=>{b.hidden=!!n&&!norm(labelOf(b)).includes(n)});
  wrap.querySelectorAll('details').forEach(d=>{
    const any=[...d.querySelectorAll('.dg86-items button')].some(b=>!b.hidden),total=d.querySelectorAll('.dg86-items button').length;
    if(n){d.dataset.searching='1';d.open=any;d.hidden=!any}
    else{d.open=openSet.has(d.dataset.gid);d.hidden=!total;delete d.dataset.searching}
  });
  wrap.querySelector('.dg86-title').hidden=!!n&&![...wrap.querySelectorAll('[data-g="daily"] button')].some(b=>!b.hidden);
}
let t=null;const schedule=()=>{clearTimeout(t);t=setTimeout(build,120)};
function boot(){
  build();
  const nav=$(NAV);if(!nav){setTimeout(boot,800);return}
  if(nav.dataset.dg86obs)return;nav.dataset.dg86obs='1';
  new MutationObserver(muts=>{if(muts.some(m=>[...m.addedNodes].some(n=>n.nodeType===1&&(n.tagName==='BUTTON'||n.querySelector?.('button'))&&!(n.dataset&&n.dataset.dg86))))schedule()}).observe(nav,{childList:true,subtree:true});
  nav.addEventListener('click',e=>{if(e.target.closest('button[data-dg44-target]'))setTimeout(revealActive,60)});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,600),{once:true});else setTimeout(boot,600);
window.addEventListener('load',()=>setTimeout(build,1200),{once:true});
})();
