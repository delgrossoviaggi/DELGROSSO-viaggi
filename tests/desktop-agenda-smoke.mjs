import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../GESTIONALE/index.html',import.meta.url),'utf8');
const main=html.match(/const MAIN=\[(.*?)\];/s)?.[1]||'';
const more=html.match(/const EXTRA=\[(.*?)\];/s)?.[1]||'';
assert.ok(main,"Desktop navigation definition is missing");
assert.match(main,/\['agenda','Agenda operativa','calendar'\]/,"Agenda is missing from primary PC menu");
assert.ok(main.indexOf("['agenda',")>main.indexOf("['viaggi',"),"Agenda should follow Departures in PC menu");
assert.ok(main.indexOf("['agenda',")<main.indexOf("['prenotazioni',"),"Agenda must be in the visible upper menu");
assert.ok(!more.includes("['agenda',"),"Agenda must not be hidden under 'Tutte le funzioni'");
assert.match(html,/<section class="page" id="page-agenda">/,"Agenda page is missing");
assert.match(html,/function renderAgenda\(\)/,"Agenda renderer is missing");
assert.match(html,/onclick="dg44Go\('agenda'\)" aria-label="Apri l'Agenda operativa"/,"Desktop header shortcut missing");
assert.match(html,/window\.dg44Go=function\(target\)/,"Desktop navigation handler missing");
assert.match(html,/function go\(page\)/,"Actual page navigation handler missing");

const requiredPages=['dashboard','viaggi','prenotazioni','controlroom','posti','pagamenti','cassa','agenda','noleggi','flotta','economia','documenti'];
for(const key of requiredPages) {
 assert.ok(html.includes('id="page-'+key+'"'), 'Missing core business page: '+key);
}
let inspected=0;
for(const block of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)){
 if(!block[1].trim())continue;
 new vm.Script(block[1],{filename:'GESTIONALE/index.html script '+inspected});
 inspected++;
}
assert.ok(inspected>=40, 'Unexpectedly low number of application script blocks');
console.log('Core pages verified: '+requiredPages.length+'; inline scripts parsed: '+inspected);
console.log('Desktop Agenda navigation regression checks passed');
