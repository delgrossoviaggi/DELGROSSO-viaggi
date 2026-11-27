/* DELGROSSO DG92 — Pulsante «Semplice» nella versione web (27/11/2026)
 * Nell'intestazione (computer, iPhone, Android) e nel menu: passa al gestionale semplice senza rifare l'accesso.
 * L'accesso viene passato al semplice (localStorage 'dg-semplice-session', stesso sito e stessa finestra).
 * Quando la versione web rinnova l'accesso aggiorna anche quello del semplice, così il rinnovo non lo fa scadere.
 */
(function(){
'use strict';
const STORE='dg-semplice-session';
const ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h15l-4-4M20 16H5l4 4"/></svg>';
const sess=()=>typeof authSession!=='undefined'&&authSession?authSession:null;
function handoff(){
  const s=sess();
  try{if(s&&s.access_token&&s.refresh_token&&s.user&&s.user.id){
    localStorage.setItem(STORE,JSON.stringify({...s,expires_at:s.expires_at||Math.floor(Date.now()/1000)+Number(s.expires_in||3600)}));
  }}catch{}
}
function toSemplice(){handoff();location.href=new URL('semplice/index.html',location.href).href}
window.dg92ToSemplice=toSemplice;

/* il rinnovo dell'accesso aggiorna anche il semplice, se è lo stesso utente */
function mirror(){
  const s=sess();if(!s||!s.user)return;
  try{const t=JSON.parse(localStorage.getItem(STORE)||'null');if(t&&t.user&&t.user.id===s.user.id)localStorage.setItem(STORE,JSON.stringify(s))}catch{}
}
const oldRefresh=window.refreshAuth;
if(typeof oldRefresh==='function')window.refreshAuth=async function(){const ok=await oldRefresh.apply(this,arguments);if(ok)mirror();return ok};

function button(cls){
  const b=document.createElement('button');b.type='button';b.className=cls;b.setAttribute('aria-label','Passa al gestionale semplice');
  b.title='Passa al gestionale semplice';b.innerHTML=ICON+'<span class="l-lg">Versione semplice</span><span class="l-sm">Semplice</span>';
  b.addEventListener('click',toSemplice);return b;
}
function place(){
  let done=true;
  if(!document.getElementById('dg92Switch')){
    const bell=document.querySelector('.dg44-icon-btn');
    if(bell&&bell.parentNode){const b=button('dg92-switch');b.id='dg92Switch';bell.parentNode.insertBefore(b,bell)}else done=false;
  }
  const nav=document.getElementById('dg44-sidebar-menu');
  if(nav){
    let m=document.getElementById('dg92Menu');
    if(!m){m=document.createElement('button');m.type='button';m.id='dg92Menu';m.className='dg44-nav-button dg92-menu';
      m.innerHTML='<span class="dg44-nav-icon">'+ICON+'</span><span>Passa al gestionale semplice</span>';
      m.addEventListener('click',toSemplice)}
    /* sempre in cima al menu: sotto la ricerca, prima di «Uso quotidiano» (mai in fondo, dove la barra in basso la copre) */
    const [parent,ref]=spot(nav,m);
    if(m.parentNode!==parent||m.nextSibling!==ref)parent.insertBefore(m,ref);
  }else done=false;
  return done;
}
/* posto giusto della voce: sotto la ricerca e prima di «Uso quotidiano»; ref non è mai la voce stessa */
function spot(nav,m){const wrap=nav.querySelector('.dg86-wrap'),parent=wrap||nav;let ref=wrap?wrap.querySelector('.dg86-title'):null;if(!ref){ref=parent.firstChild;if(ref===m)ref=m.nextSibling}return [parent,ref]}
function menuPlaced(){
  const nav=document.getElementById('dg44-sidebar-menu'),m=document.getElementById('dg92Menu');if(!nav||!m)return false;
  const [parent,ref]=spot(nav,m);return m.parentNode===parent&&m.nextSibling===ref;
}
function init(){
  const css=document.createElement('style');css.textContent=`
.dg92-switch{display:inline-flex;align-items:center;gap:8px;height:44px;padding:0 16px;margin-right:10px;border:0;border-radius:999px;background:#E2A32B;color:#2A1B00;font-family:inherit;font-weight:700;font-size:15px;line-height:1;cursor:pointer;white-space:nowrap;flex:0 0 auto}
.dg92-switch svg{width:18px;height:18px}
.dg92-switch .l-sm{display:none}
.dg92-switch:hover{filter:brightness(1.06)}
.dg92-switch:focus-visible,.dg92-menu:focus-visible{outline:3px solid #E2A32B;outline-offset:2px}
.dg92-menu{font-weight:700;background:#FBEFD5!important;color:#5A3B00!important;border-radius:14px!important;margin:4px 0 10px!important}
.dg92-menu .dg44-nav-icon{color:#8A5A00!important}
/* le ultime voci del menu non devono finire sotto la barra in basso «Scrivania / Funzioni» */
body #dg44-sidebar-menu::after{content:"";display:block!important;flex:0 0 auto;height:calc(110px + env(safe-area-inset-bottom));pointer-events:none}
.dg92-menu svg{width:20px;height:20px}
@media (max-width:820px){.dg92-switch{height:40px;padding:0 12px;margin-right:6px;font-size:14px}.dg92-switch .l-lg{display:none}.dg92-switch .l-sm{display:inline}}
@media (max-width:440px){.dg92-switch{height:38px;padding:0 10px;gap:6px;margin-right:4px;font-size:13.5px}.dg92-switch svg{width:16px;height:16px}#dg44-logo-btn{flex:0 1 auto!important;min-width:0!important}#dg44-logo-btn img,#dg44-logo{max-width:108px!important;width:108px!important;height:auto!important}}
@media (max-width:350px){.dg92-switch .l-sm{display:none}}`;
  document.head.appendChild(css);
  /* la barra in alto e il menu possono essere ridisegnati: rimetto il pulsante ogni volta che sparisce */
  place();let queued=false;
  new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;if(!document.getElementById('dg92Switch')||!menuPlaced())place()})}).observe(document.body,{childList:true,subtree:true});
  /* il vecchio link «Versione telefono» in fondo al menu passa anche l'accesso */
  document.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('a.dg86-phone');if(a){e.preventDefault();toSemplice()}},true);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')place()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
