// DELGROSSO V29 - Cloudflare Worker on a SEPARATE infrastructure.
// Bindings: ORIGIN_URL (direct *.vercel.app URL), RESEND_API_KEY, ALERT_FROM,
// ALERT_TO, MONITOR_KV (KV binding). Optional MONITOR_SECRET.
// Cloudflare route ONLY for public pages; /GESTIONALE/* is excluded in route setup.
const HEALTH='/health.txt';
const MARKER='DELGROSSO_PUBLIC_SITE_OK_V29';
const FAILS=3, RECOVERS=2;
const TIMEOUT=8000;
function maintenance(){return new Response(`<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>DELGROSSO VIAGGI | Manutenzione</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#071d31;color:white;font:18px system-ui;text-align:center;padding:24px}main{max-width:580px}a{color:#ffa451}</style></head><body><main><h1>DELGROSSO VIAGGI</h1><h2>Stiamo tornando online 🚌</h2><p>Il sito è temporaneamente in manutenzione. Per informazioni: <a href="mailto:info@delgrossoviaggi.it">info@delgrossoviaggi.it</a></p><small>©DELGROSSO VIAGGI 2026<br>©CREATED CRISTINO NICOLA PIO</small></main></body></html>`,{status:503,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','retry-after':'60'} })}
async function probe(env){
 const base=env.ORIGIN_URL?.replace(/\/$/,'');
 if(!base)throw Error('ORIGIN_URL non configurato');
 const ctl=new AbortController();const t=setTimeout(()=>ctl.abort(),TIMEOUT);
 try{
  const r=await fetch(base+HEALTH+'?monitor='+Date.now(),{signal:ctl.signal,redirect:'manual',headers:{'cache-control':'no-cache'}});
  const body=await r.text();
  if(r.status!==200||body.trim()!==MARKER)throw Error('health.txt HTTP '+r.status+' o contenuto errato');
  const home=await fetch(base+'/?monitor='+Date.now(),{signal:ctl.signal,redirect:'manual',headers:{'cache-control':'no-cache'}});
  if(home.status!==200)throw Error('Home HTTP '+home.status);
  const html=await home.text();
  if(!html.includes('DELGROSSO'))throw Error('Home non contiene identificativo DELGROSSO');
  return {ok:true,detail:'Health e Home OK'};
 }finally{clearTimeout(t)}
}
async function email(env,subject,detail){
 if(!env.RESEND_API_KEY||!env.ALERT_FROM||!env.ALERT_TO)throw Error('Email secrets mancanti');
 const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{'authorization':'Bearer '+env.RESEND_API_KEY,'content-type':'application/json'},body:JSON.stringify({
 from:env.ALERT_FROM,to:[env.ALERT_TO],subject,
 text:`DELGROSSO VIAGGI - Monitoraggio sito pubblico\n\n${detail}\nOra UTC: ${new Date().toISOString()}\nOrigine: ${env.ORIGIN_URL}\nIl Gestionale non viene modificato da questo monitor.`
 })});
 if(!r.ok)throw Error('Invio email HTTP '+r.status+': '+(await r.text()).slice(0,200));
}
async function check(env){
 const previous=JSON.parse(await env.MONITOR_KV.get('public-site-state')||'{"status":"up","fails":0,"recovers":0}');
 let result;
 try{result=await probe(env)}catch(e){result={ok:false,detail:String(e?.message||e)}}
 const state={...previous,lastCheck:new Date().toISOString(),lastDetail:result.detail};
 let subject=null,detail=null;
 if(result.ok){
  state.fails=0;state.recovers=(previous.recovers||0)+1;
  if(previous.status==='down'&&state.recovers>=RECOVERS){
   state.status='up';subject='✅ DELGROSSO: sito pubblico ripristinato';detail='Servizio nuovamente disponibile dopo due controlli riusciti.';
  }
 }else{
  state.recovers=0;state.fails=(previous.fails||0)+1;
  if(previous.status!=='down'&&state.fails>=FAILS){
   state.status='down';subject='🚨 DELGROSSO: sito pubblico non disponibile';detail='Guasto confermato dopo tre controlli falliti. Dettaglio: '+result.detail;
  }
 }
 // Persist FIRST so the public fallback does not depend on email success.
 await env.MONITOR_KV.put('public-site-state',JSON.stringify(state));
 if(subject){try{await email(env,subject,detail)}catch(e){console.error('EMAIL ALERT FAILED:',e)}}
 return state;
}
export default {
 async scheduled(event,env,ctx){ctx.waitUntil(check(env))},
 async fetch(request,env,ctx){
  const url=new URL(request.url);
  if(url.pathname==='/__dg_monitor_status'){
   if(!env.MONITOR_SECRET||request.headers.get('x-monitor-secret')!==env.MONITOR_SECRET)return new Response('Forbidden',{status:403});
   return new Response(await env.MONITOR_KV.get('public-site-state')||'{}',{headers:{'content-type':'application/json','cache-control':'no-store'}});
  }
  // Exclude /GESTIONALE/ from the Cloudflare Worker route at deployment.
  if(/^\/GESTIONALE(?:\/|$)/i.test(url.pathname))return fetch(request);
  const state=JSON.parse(await env.MONITOR_KV.get('public-site-state')||'{"status":"up"}');
  if(state.status==='down')return maintenance();
  const origin=new URL(env.ORIGIN_URL);
  const target=new URL(request.url);target.protocol=origin.protocol;target.host=origin.host;
  const ctl=new AbortController();const timeout=setTimeout(()=>ctl.abort(),TIMEOUT);
  try{
   const upstream=await fetch(new Request(target.toString(),request),{signal:ctl.signal,redirect:'manual'});
   if(upstream.status>=500){ctx.waitUntil(check(env));return maintenance()}
   return upstream;
  }catch(e){ctx.waitUntil(check(env));return maintenance()}
  finally{clearTimeout(timeout)}
 }
};
