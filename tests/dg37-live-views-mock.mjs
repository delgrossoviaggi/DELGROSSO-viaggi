import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const js=fs.readFileSync('GESTIONALE/nuovo/piantine-v37.js','utf8');
const listeners={};
const doc={getElementById(){return null},addEventListener(type,fn){listeners[type]=fn}};
const sandbox={window:{},document:doc,console,confirm:()=>true,Blob,URL,setTimeout};
vm.createContext(sandbox);vm.runInContext(js,sandbox);
const d=sandbox.window.DG37Layouts;
const trip={id:'trip-sunday',titolo:'Napoli 22 novembre 2026',data_partenza:'2026-11-22',posti_totali:63,autobus_id:'bus63',stato:'SOLD OUT'};
const bus={id:'bus63',titolo:'Irizar Scania PB 63',categoria:'GT',posti:63,attivo:true};
const db={layoutDrafts:[],trips:[trip],fleet:[bus],busOfficial:[],tripOfficial:[]};
const events=[];let cache=db;
const api={
 currentDrafts:[],
 load:async (k)=>{assert(k in cache,'unknown table '+k);return cache[k]},
 authorize:async()=>({id:'user-a'}),
 raw:async()=>{throw new Error('Unexpected network in render test')},
 invalidate(...keys){events.push(['invalidate',keys])},
 notice(s,level){events.push(['message',s,level])},
};
d.init(api);
assert.equal(typeof listeners.click,'function');
assert.equal(typeof listeners.change,'function');
const page=await d.render();
assert(page.includes('id="dg37-editor-container"'));
assert(page.includes('id="dg37-assignment"'));
assert(page.includes('data-dl="publish-trip"'));
assert(page.includes('data-dl="pdf-sunday"'));
assert(page.includes('Napoli'));
const unpub=await d.renderControlMap(trip,[],new Map());
assert(unpub.includes('Nessuna piantina fisica ufficiale pubblicata'));
cache={...cache,tripOfficial:[{viaggio_id:'trip-sunday',autobus_id:'bus63',versione:1,configurazione:d.makeConfig(63)}]};
const pub=await d.renderControlMap(trip,[{id:'booking',cliente:'Referente prova'}],new Map([['1',{cliente:'Referente prova'}]]));
assert(pub.includes('Piantina ufficiale'));
assert(pub.includes('Referente prova'));
console.log('DG37 rendering with stubbed Supabase, trip and bus: PASS');
