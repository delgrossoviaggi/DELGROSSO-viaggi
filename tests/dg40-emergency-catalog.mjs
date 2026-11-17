import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const bridge=fs.readFileSync('js/gestionale.js','utf8');
const site=fs.readFileSync('js/site.js','utf8');
const html=fs.readFileSync('GESTIONALE/index.html','utf8');
const backup=JSON.parse(fs.readFileSync('assets/viaggi-fallback-20261117.json','utf8'));
const config=JSON.parse(fs.readFileSync('vercel.json','utf8'));
new vm.Script(bridge,{filename:'js/gestionale.js'});
new vm.Script(site,{filename:'js/site.js'});
assert(backup.source==='supabase-gestionale-public-trips-readonly');
assert(backup.trips.length>=5 && backup.trips.every(t=>t.offline_catalog===true));
assert(backup.trips.every(t=>t.data_partenza>='2026-11-17'&&t.id&&t.titolo));
assert(backup.trips.every(t=>!('cliente' in t)&&!('telefono' in t)&&!('receipt_number' in t)),'Never expose private booking data');
assert(html.includes('data-src="/GESTIONALE/suite/index.html"'));
assert(html.includes('src="/GESTIONALE/delgrosso-logo-originale-bianco.png"'));
assert(!html.includes('<base href="/GESTIONALE/">'),'Global base override is removed');
assert(!config.redirects || config.redirects.length===0,'Risky DG38 redirects removed');
for(const path of ['GESTIONALE/suite/index.html','GESTIONALE/delgrosso-logo-originale-bianco.png'])assert(fs.existsSync(path));

const requests=[];
const sandbox={
  window:{},
  Intl,Date,Error,URLSearchParams,AbortController,setTimeout,clearTimeout,console,
  fetch:async (url,options)=>{
    requests.push(url);
    if(url.includes('/functions/v1/gestionale-bridge')){
      return {ok:false,status:502,text:async()=>JSON.stringify({error:'Simulated backend outage'})};
    }
    if(url.includes('viaggi-fallback-20261117.json')){
      return {ok:true,json:async()=>backup};
    }
    throw Error('Unexpected network call: '+url);
  }
};
vm.createContext(sandbox);
vm.runInContext(bridge,sandbox);
const trips=await vm.runInContext('getGestionaleTrips()',sandbox);
assert.equal(trips.length,backup.trips.length);
assert(trips.every(x=>x.offline_catalog===true));
assert.equal(sandbox.window.__dgOfflineCatalog,true);
assert(requests.length===2);
const avail=vm.runInContext('gestTripAvailability',sandbox)(trips.find(t=>!t.sold_out)||trips[0]);
assert.equal(avail.known,false,'Never claim live free seats while backend down');
console.log('DG40 PASS: read-only fallback, no hidden bookings, valid JS, safe V2 routing.');
