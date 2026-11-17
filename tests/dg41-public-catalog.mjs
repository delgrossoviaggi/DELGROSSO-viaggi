import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const js=fs.readFileSync('js/future-v4.js','utf8');
const data=JSON.parse(fs.readFileSync('assets/viaggi-fallback-20261117.json','utf8')).trips;
for(const p of ['index.html','viaggi.html','viaggio.html'])assert(/js\/future-v4\.js\?v=20261117-dg4[2-9]/.test(fs.readFileSync(p,'utf8')),'public trip script cache version expected in '+p);
const suffix="if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();";
assert(js.includes(suffix));
const script=js.replace(suffix,"globalThis.test={S,SNAPSHOT,isVisible,loadTrips,renderTripDetail,renderCatalog};");
class FixedDate extends Date{constructor(...a){super(...(a.length?a:['2026-11-17T08:22:00+01:00']));}static now(){return new Date('2026-11-17T08:22:00+01:00').valueOf()}}
for(const online of [false,true]){
 const make=()=>({innerHTML:'',textContent:'',value:'',disabled:false,querySelectorAll:()=>[]});
 const elements=Object.fromEntries(['#allTripGrid','#tripCounter','#tripStatus','#tripAvailability','#tripMonth','#tripDetail'].map(k=>[k,make()]));
 const sandbox={document:{querySelector:k=>elements[k]||null},location:{search:'?id='+data.find(t=>!t.sold_out).id},Date:FixedDate,Intl,URLSearchParams,AbortController,setTimeout,clearTimeout,console,fetch:async()=>online?{ok:true,json:async()=>data.map(t=>({...t,offline_catalog:false,pubblicato:'SI'}))}:{ok:false,status:502,json:async()=>({error:'PGRST003'})}};
 vm.createContext(sandbox);vm.runInContext(script,sandbox);
 const {test}=sandbox;assert.equal(test.SNAPSHOT.length,data.length);assert(test.SNAPSHOT.every(t=>!('posti_liberi' in t)&&!('cliente' in t)&&!('telefono' in t)));
 await test.loadTrips();
 assert.equal(test.S.live,online);assert.equal(test.S.trips.length,11);
 assert.match(elements['#allTripGrid'].innerHTML,/Mercatini di Larino/);
 assert.match(elements['#allTripGrid'].innerHTML,/SOLD OUT/);
 assert.equal(elements['#tripAvailability'].disabled,!online);
 if(online){assert.match(elements['#tripDetail'].innerHTML,/prenota\.html/)}else{assert.match(elements['#tripDetail'].innerHTML,/wa\.me/);assert(!elements['#tripDetail'].innerHTML.includes('prenota.html'));assert.match(elements['#tripStatus'].textContent,/17\/11\/2026/)}
}
console.log('DG41: actual public script renders 11 verified grouped departures with failed API, restores live mode when API works; no offline booking.');
