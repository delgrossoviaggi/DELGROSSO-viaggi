// DG4 audit — offline-only V4 smoke tests. Zero network, zero real user data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const dir=new URL('../GESTIONALE/v4/',import.meta.url);
const core=readFileSync(new URL('core.js',dir),'utf8').replace(/^export /gm,'');
const app=readFileSync(new URL('app.js',dir),'utf8')
  .replace(/^import \{[\s\S]*?\} from '\.\/core\.js';/,'')
  .replace(/bootstrap\(\)\.catch\([\s\S]*?;\s*$/,'');
const context=vm.createContext({
 console,Intl,Date,Map,Set,Number,String,JSON,Math,Object,Array,RegExp,
 URL,URLSearchParams,Error,Promise,encodeURIComponent,decodeURIComponent,
 setTimeout,clearTimeout,
 sessionStorage:{getItem(){return null},setItem(){throw Error('no store')},removeItem(){}},
 fetch(){throw Error('Offline test forbids network')}
});
const getTests=';globalThis.v4tests={state,occupancy,breakdown,esc,WRITES_ENABLED,mutate,writeRpc,drawDashboard,drawTrips,drawBookings,drawControl,drawLayouts,drawCash,drawEconomy,drawCustomers,drawRentals,drawAgenda,drawFleet,drawDocuments,drawNotifications,drawDiagnostics};';
vm.runInContext(core+'\n'+app+'\n'+getTests,context,{timeout:3000});
const appTest=context.v4tests;
const trip={id:'T1',titolo:'Napoli & Spaccanapoli',data_partenza:'2026-12-20',destinazione:'Napoli',posti_totali:53,prezzo:20,stato:'Aperto'};
const booking={id:'B1',viaggio_id:'T1',cliente:'Nome prova',telefono:'3330000000',posti:2,totale:40,pagato:20,stato:'Acconto Ricevuto',posti_selezionati:'1,2',fermata_partenza:'San Severo'};
appTest.state.all={trips:[trip],bookings:[booking],payments:[],agenda:[],notifications:[],seats:[{viaggio_id:'T1',prenotazione_id:'B1',posto:'1'}],tripLayouts:[{viaggio_id:'T1',versione:1,configurazione:{rows:[{cells:[{type:'seat',label:'1'},{type:'aisle'},{type:'seat',label:'2'}]}]}}],stops:[],layoutLibrary:[],busLayouts:[],cash:[],operators:[],transfers:[],economy:[],profit:[],customers:[],rentals:[],fleet:[],documents:[],system:[],alerts:[]};
test('All fourteen V4 pages render with original-schema fixtures',()=>{
 const views=['drawDashboard','drawTrips','drawBookings','drawControl','drawLayouts','drawCash','drawEconomy','drawCustomers','drawRentals','drawAgenda','drawFleet','drawDocuments','drawNotifications','drawDiagnostics'];
 for(const name of views){const html=appTest[name]();assert.ok(typeof html==='string'&&html.length>75, name);}
});
test('Seat occupancy excludes cancelled and merges seat rows with booking details',()=>{
 const cancelled={...booking,id:'B2',stato:'Annullata',posti_selezionati:'3'};
 const occupied=appTest.occupancy(trip,[booking,cancelled],[{viaggio_id:'T1',prenotazione_id:'B1',posto:'1'}]);
 assert.equal(occupied.map.size,2);
 assert.equal(occupied.map.has('3'),false);
 assert.equal(appTest.breakdown([trip],[booking,cancelled],[]).passengers,2);
});
test('All sensitive output escapes HTML',()=>{
 assert.equal(appTest.esc('<img src=x onerror=alert(1)>'),'&lt;img src=x onerror=alert(1)&gt;');
});
test('All mutation routes refuse writes until a verified backup is ready',async()=>{
 assert.equal(appTest.WRITES_ENABLED,false);
 await assert.rejects(appTest.mutate('trips','POST',{titolo:'X'}),/Scritture bloccate/);
 await assert.rejects(appTest.writeRpc('dg_register_payment',{}),/Scritture bloccate/);
});
