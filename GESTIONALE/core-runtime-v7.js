
/* DELGROSSO V7 URGENT FIX — runtime/login/navigation hardened.
   Critical rule: optional UI handlers can fail without blocking login/core. */
(function(){
'use strict';
const $id=id=>document.getElementById(id);
let loginBusy=false, bootDone=false;

function operatorFromEmail(email){
  const e=String(email||'').toLowerCase();
  return e==='info@delgrossoviaggi.it'
    ? {username:'raffaele',name:'Raffaele',role:'Amministratore'}
    : {username:'nicola',name:'Nicola',role:'Amministratore'};
}
function updateOperatorUI(){
  try{
    const n=currentOperator?.name||'Operatore';
    const a=$id('currentOperatorName'); if(a)a.textContent=n;
    const r=$id('currentOperatorRole'); if(r)r.textContent='Ruolo: '+(currentOperator?.role||'Amministratore');
    const m=$id('mobileOperatorName'); if(m)m.textContent=n;
  }catch(e){console.warn('operator ui',e)}
}
function showLogin(msg=''){
  try{$id('app')?.classList.remove('on')}catch{}
  const l=$id('login'); if(l)l.style.display='grid';
  const e=$id('loginMsg'); if(e)e.textContent=msg;
}
function showApp(){
  const l=$id('login'); if(l)l.style.display='none';
  $id('app')?.classList.add('on');
  updateOperatorUI();
  try{go(location.hash.slice(1)||'dashboard')}catch(e){console.warn('go dashboard',e)}
}
async function syncAfterOpen(){
  try{restoreCacheFast()}catch(e){console.warn('cache',e)}
  try{await loadAll()}catch(e){
    console.error('loadAll',e);
    try{toast('Gestionale aperto. Sincronizzazione dati da riprovare: '+(e?.message||e),false)}catch{}
  }
  try{await health()}catch(e){console.warn('health',e)}
  try{startAutoSync()}catch(e){console.warn('autosync',e)}
  try{window.dgRenderOperatorCash?.()}catch(e){console.warn('cassa',e)}
}
async function login(){
  if(loginBusy)return;
  const user=String($id('loginUser')?.value||'').trim();
  const pass=String($id('loginPass')?.value||'');
  if(!user||!pass){showLogin('Inserisci operatore e password.');return}
  loginBusy=true;
  const btn=$id('loginBtn');
  if(btn){btn.disabled=true;btn.textContent='Accesso in corso…'}
  const msg=$id('loginMsg'); if(msg)msg.textContent='Autenticazione in corso…';
  try{
    await Promise.race([
      signIn(user,pass),
      new Promise((_,rej)=>setTimeout(()=>rej(new Error('Tempo di connessione scaduto. Riprova.')),20000))
    ]);
    currentOperator=operatorFromEmail(authSession?.user?.email);
    sessionStorage.setItem('dg_operator',JSON.stringify(currentOperator));
    showApp();
    if(msg)msg.textContent='';
    // Do not block UI while full sync runs.
    setTimeout(()=>syncAfterOpen(),40);
  }catch(e){
    showLogin(e?.message||'Credenziali non valide');
  }finally{
    loginBusy=false;
    if(btn){btn.disabled=false;btn.textContent='Accedi al gestionale'}
  }
}
function safeBind(el,event,fn,key){
  if(!el)return;
  const k='dgV7'+(key||event);
  if(el.dataset[k])return;
  el.dataset[k]='1';
  el.addEventListener(event,(ev)=>{try{fn(ev)}catch(e){console.error('UI '+event,e)}});
}
function bindUI(){
  safeBind($id('loginBtn'),'click',e=>{e.preventDefault();login()},'login');
  safeBind($id('loginPass'),'keydown',e=>{if(e.key==='Enter'){e.preventDefault();login()}},'pass');
  safeBind($id('loginUser'),'keydown',e=>{if(e.key==='Enter'){e.preventDefault();login()}},'user');

  safeBind($id('sideNav'),'click',e=>{
    const b=e.target.closest('button[data-page]');
    if(b)go(b.dataset.page);
  },'nav');
  safeBind($id('notifBtn'),'click',()=>go('comunicazioni'),'notif');

  const inputs=['tripSearch','tripStatus','bookSearch','bookFilter','quoteSearch','quoteFilter','quoteOrigin','clientSearch','rentalSearch','rentalStatus','agendaSearch','agendaFilter','agendaPeriod'];
  for(const id of inputs)safeBind($id(id),'input',()=>renderPage(state.page),'f'+id);
  for(const id of ['agendaFilter','agendaPeriod'])safeBind($id(id),'change',()=>renderAgenda(),'c'+id);
  for(const id of ['quoteFilter','quoteOrigin'])safeBind($id(id),'change',()=>renderQuotes(),'c'+id);

  safeBind($id('globalSearch'),'input',e=>{
    clearTimeout(globalSearchTimer);
    const q=String(e.target.value||'').trim().toLowerCase(); if(!q)return;
    globalSearchTimer=setTimeout(()=>{
      const hit=a=>(a||[]).find(x=>Object.values(x||{}).some(v=>String(v??'').toLowerCase().includes(q)));
      const found=hit(state.prenotazioni)||hit(state.clienti)||hit(state.viaggi)||hit(state.noleggi)||hit(state.preventivi);
      if(found){
        if(found.viaggio_id)go('prenotazioni');
        else if(found.destinazione||found.data_partenza)go('viaggi');
        else if(found.stato_noleggio)go('noleggi');
        else if(found.data_viaggio)go('preventivi');
        else go('clienti');
      }
    },140);
  },'search');

  if(!window.__dgV7ControlChange){
    window.__dgV7ControlChange=true;
    document.addEventListener('change',e=>{try{if(e.target?.id==='controlTripSelect')renderControlRoom()}catch(err){console.warn(err)}});
  }
}
async function bootSession(){
  if(bootDone)return; bootDone=true;
  try{
    const raw=sessionStorage.getItem('dg_auth');
    if(!raw){showLogin();return}
    authSession=JSON.parse(raw);
    if(!authSession?.access_token){showLogin();return}
    currentOperator=operatorFromEmail(authSession?.user?.email);
    sessionStorage.setItem('dg_operator',JSON.stringify(currentOperator));
    showApp();
    setTimeout(()=>syncAfterOpen(),30);

    // Refresh expired token separately; don't blank the app while attempting.
    const exp=Number(authSession?.expires_at||0)*1000;
    if(exp && exp<Date.now()+60000){
      try{
        const ok=await refreshAuth();
        if(!ok)throw new Error('Sessione scaduta');
        currentOperator=operatorFromEmail(authSession?.user?.email);
        updateOperatorUI();
      }catch(e){
        authSession=null;
        sessionStorage.removeItem('dg_auth');
        sessionStorage.removeItem('dg_login');
        showLogin('Sessione scaduta. Accedi di nuovo.');
      }
    }
  }catch(e){
    console.error('boot session',e);
    showLogin('Accedi al gestionale.');
  }
}
function globalErrorShield(){
  if(window.__dgV7ErrorShield)return; window.__dgV7ErrorShield=true;
  window.addEventListener('error',ev=>console.error('Modulo isolato:',ev.error||ev.message));
  window.addEventListener('unhandledrejection',ev=>console.error('Promise isolata:',ev.reason));
}
function init(){
  bindUI(); globalErrorShield(); bootSession();
  // Re-bind once after all optional scripts settle.
  setTimeout(bindUI,500);
  setTimeout(bindUI,1800);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
