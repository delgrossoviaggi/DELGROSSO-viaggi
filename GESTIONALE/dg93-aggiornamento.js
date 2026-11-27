/* DELGROSSO DG93 — Avviso «C'è una versione nuova» (27/11/2026)
 * Le app aggiunte alla schermata Home (iPhone, Android, Chrome) riprendono la pagina già aperta e non la ricaricano:
 * dopo una pubblicazione si continuerebbe a vedere la versione vecchia. Quando il gestionale torna in primo piano
 * (e ogni 5 minuti) chiede al sito se la pagina è cambiata, con una richiesta leggerissima (HEAD, nessun dato).
 * Se è cambiata mostra una barra con «Aggiorna ora». Nessun ricaricamento automatico: non si perde niente di scritto.
 * Usato sia dalla versione web sia dal gestionale semplice.
 */
(function(){
'use strict';
if(window.__dg93)return;window.__dg93=true;
const page=location.origin+location.pathname;
let base=null,shown=false,last=0,busy=false;
async function stamp(){
  const r=await fetch(page,{method:'HEAD',cache:'no-store',credentials:'same-origin'});
  if(!r.ok)return null;
  return r.headers.get('etag')||r.headers.get('last-modified')||r.headers.get('content-length');
}
async function check(force){
  if(shown||busy||!navigator.onLine)return;
  if(!force&&Date.now()-last<60000)return;
  busy=true;last=Date.now();
  try{const k=await stamp();if(!k)return;if(base===null){base=k;return}if(k!==base)banner()}
  catch{}finally{busy=false}
}
function banner(){
  if(shown)return;shown=true;
  const css=document.createElement('style');css.textContent=`
#dg93Bar{position:fixed;left:12px;right:12px;top:calc(env(safe-area-inset-top) + 10px);z-index:100000;display:flex;align-items:center;gap:12px;flex-wrap:wrap;
 background:#0B2545;color:#fff;border-radius:16px;padding:12px 14px;box-shadow:0 14px 40px rgba(4,20,40,.35);font-family:inherit;font-size:15.5px;line-height:1.35;max-width:640px;margin:0 auto}
#dg93Bar b{flex:1 1 200px}
#dg93Bar button{border:0;border-radius:12px;min-height:44px;padding:0 16px;font:inherit;font-weight:700;cursor:pointer}
#dg93Go{background:#E2A32B;color:#2A1B00}
#dg93No{background:transparent;color:#C9D6E6}
#dg93Bar button:focus-visible{outline:3px solid #E2A32B;outline-offset:2px}`;
  document.head.appendChild(css);
  const bar=document.createElement('div');bar.id='dg93Bar';bar.setAttribute('role','status');
  bar.innerHTML='<b>C’è una versione nuova del gestionale.</b><button type="button" id="dg93Go">Aggiorna ora</button><button type="button" id="dg93No">Più tardi</button>';
  document.body.appendChild(bar);
  document.getElementById('dg93Go').onclick=()=>location.reload();
  document.getElementById('dg93No').onclick=()=>{bar.remove();setTimeout(()=>{shown=false;check(true)},30*60*1000)};
}
window.dg93Check=()=>check(true);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check(false)});
window.addEventListener('pageshow',e=>{if(e.persisted)check(true)});
window.addEventListener('online',()=>check(true));
setInterval(()=>check(false),5*60*1000);
check(true);
})();
