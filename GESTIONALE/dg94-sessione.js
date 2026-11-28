/* DG94 · Sessione più stabile nella versione web.
   Prima: quando l'accesso scadeva, ogni richiesta in corso (anche 30 insieme) chiedeva un rinnovo
   per conto suo. Il server rispondeva «troppe richieste» (429) e si veniva buttati fuori.
   Ora: un solo rinnovo alla volta, le altre richieste aspettano quello; e il rinnovo parte
   poco prima della scadenza, quando torni sulla pagina o ogni minuto. */
(()=>{
  if(window.__dg94sessione)return;window.__dg94sessione=true;
  const base=window.refreshAuth;
  if(typeof base!=='function')return;
  let inflight=null,lastAt=0,lastOk=false;
  function refreshOnce(){
    if(inflight)return inflight;
    // risposta recente: la riuso invece di chiedere di nuovo (le richieste partite col vecchio accesso riprovano col nuovo)
    if(Date.now()-lastAt<4000)return Promise.resolve(lastOk);
    const args=arguments,self=this;
    inflight=Promise.resolve()
      .then(()=>base.apply(self,args))
      .then(ok=>(lastOk=!!ok),()=>(lastOk=false))
      .finally(()=>{lastAt=Date.now();inflight=null});
    return inflight;
  }
  window.refreshAuth=refreshOnce;

  const sess=()=>{try{return typeof authSession!=='undefined'?authSession:null}catch{return null}};
  function keepAlive(){
    const s=sess();
    if(!s||!s.refresh_token||!s.expires_at)return;
    if(document.visibilityState==='hidden')return;
    if(Number(s.expires_at)*1000-Date.now()<120000)refreshOnce();
  }
  document.addEventListener('visibilitychange',keepAlive);
  window.addEventListener('focus',keepAlive);
  window.addEventListener('online',keepAlive);
  setInterval(keepAlive,60000);
  keepAlive();
})();
