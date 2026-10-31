import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

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
console.log('Desktop Agenda navigation regression checks passed');
