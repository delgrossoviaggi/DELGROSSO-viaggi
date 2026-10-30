/* Letture pubbliche PostgREST, senza dipendenze da CDN o sessioni amministrative. */
window.DGPublicData={createClient(base,key){return {from(table){
 if(!/^[a-z_]+$/.test(table))throw new Error('Tabella non valida');
 const params=new URLSearchParams(),orders=[];let single=false,request;
 const query={select(columns='*'){params.set('select',columns);return query;},eq(column,value){params.set(column,'eq.'+String(value));return query;},order(column,options={}){orders.push(column+(options.ascending===false?'.desc':'.asc'));return query;},limit(n){params.set('limit',String(n));return query;},maybeSingle(){single=true;return query;},then(resolve,reject){if(!request)request=run();return request.then(resolve,reject);}};
 async function run(){const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);try{if(orders.length)params.set('order',orders.join(','));const response=await fetch(base+'/rest/v1/'+table+'?'+params.toString(),{headers:{apikey:key,Accept:'application/json'},signal:controller.signal});const data=await response.json();if(!response.ok)return {data:null,error:{message:data?.message||'Contenuti non disponibili',status:response.status}};if(!Array.isArray(data))return {data:null,error:{message:'Risposta non valida'}};if(single&&data.length>1)return {data:null,error:{message:'Risposta non univoca'}};return {data:single?(data[0]||null):data,error:null};}catch(e){return {data:null,error:{message:e.name==='AbortError'?'Tempo di attesa scaduto':e.message}};}finally{clearTimeout(timeout);}}
 return query;
}};}};
