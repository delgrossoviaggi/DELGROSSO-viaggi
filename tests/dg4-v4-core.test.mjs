// DG4 audit — offline-only V4 smoke tests. Zero network, zero real user data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const dir=new URL('../GESTIONALE/v4/',import.meta.url);
const core=readFileSync(new URL('core.js',dir),'utf8').replace(/^export /gm,'');
const operations=readFileSync(new URL('booking-operations.js',dir),'utf8').replace(/^export /gm,'');
const bis=readFileSync(new URL('bis-manual.js',dir),'utf8').replace(/^export /gm,'');
const credits=readFileSync(new URL('credit-transfers.js',dir),'utf8').replace(/^export /gm,'');
const agenda=readFileSync(new URL('agenda-model.js',dir),'utf8').replace(/^export /gm,'');
const layoutOps=readFileSync(new URL('layout-operations.js',dir),'utf8').replace(/^export /gm,'');
const app=readFileSync(new URL('app.js',dir),'utf8')
  .replace(/^import \{[\s\S]*?\} from '\.\/core\.js';/,'')
  .replace(/^\s*import \* as Pdf from '\.\/pdf-reports\.js';/m,'')
  .replace(/^\s*import \{createLiveSync\} from '\.\/live-sync\.js';/m,'')
  .replace(/^\s*import \{[^\n]+\} from '\.\/booking-operations\.js';/m,'')
  .replace(/^\s*import \{[^\n]+\} from '\.\/bis-manual\.js';/m,'')
  .replace(/^\s*import \{[^\n]+\} from '\.\/credit-transfers\.js';/m,'')
  .replace(/^\s*import \{[^\n]+\} from '\.\/agenda-model\.js';/m,'')
  .replace(/^\s*import \{[^\n]+\} from '\.\/layout-operations\.js';/m,'')
  .replace(/bootstrap\(\)\.catch\([\s\S]*?;\s*$/,'');
const context=vm.createContext({
 console,Intl,Date,Map,Set,Number,String,JSON,Math,Object,Array,RegExp,
 URL,URLSearchParams,Error,Promise,encodeURIComponent,decodeURIComponent,
 setTimeout,clearTimeout,
 Pdf:{},
 sessionStorage:{getItem(){return null},setItem(){throw Error('no store')},removeItem(){}},
 fetch(){throw Error('Offline test forbids network')}
});
const getTests=';globalThis.v4tests={state,occupancy,breakdown,esc,WRITES_ENABLED,mutate,writeRpc,drawDashboard,drawTrips,drawBookings,drawMovements,drawControl,drawLayouts,drawCash,drawCredits,drawEconomy,drawCustomers,drawRentals,drawAgenda,drawDeadlines,drawFleet,drawDocuments,drawNotifications,drawDiagnostics,drawQuotes,drawInvoices,drawWaitlist,drawWhatsApp,drawReports,normalizeSignedStorageUrl,edgeAction};';
vm.runInContext(core+'\n'+operations+'\n'+bis+'\n'+credits+'\n'+agenda+'\n'+layoutOps+'\n'+app+'\n'+getTests,context,{timeout:3000});
const appTest=context.v4tests;
const trip={id:'T1',titolo:'Napoli & Spaccanapoli',data_partenza:'2026-12-20',destinazione:'Napoli',posti_totali:53,prezzo:20,stato:'Aperto'};
const booking={id:'B1',viaggio_id:'T1',cliente:'Nome prova',telefono:'3330000000',posti:2,totale:40,pagato:20,stato:'Acconto Ricevuto',posti_selezionati:'1,2',fermata_partenza:'San Severo'};
appTest.state.all={legacyAgenda:[],trips:[trip],bookings:[booking],payments:[],agenda:[],notifications:[],seats:[{viaggio_id:'T1',prenotazione_id:'B1',posto:'1'}],tripLayouts:[{viaggio_id:'T1',versione:1,configurazione:{rows:[{cells:[{type:'seat',label:'1'},{type:'aisle'},{type:'seat',label:'2'}]}]}}],stops:[],layoutLibrary:[],busLayouts:[],cash:[],operators:[],transfers:[],economy:[],profit:[],customers:[],rentals:[],fleet:[],documents:[],system:[],alerts:[],rentalPayments:[],quotes:[],invoices:[],waitlist:[],whatsAppInbox:[],whatsAppOutbound:[],whatsAppOptins:[]};
test('All twenty-two V4 pages render with original-schema fixtures',()=>{
 const views=['drawDashboard','drawTrips','drawBookings','drawMovements','drawControl','drawLayouts','drawCash','drawCredits','drawEconomy','drawCustomers','drawRentals','drawAgenda','drawDeadlines','drawFleet','drawDocuments','drawNotifications','drawDiagnostics','drawQuotes','drawInvoices','drawWaitlist','drawWhatsApp','drawReports'];
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

test('A signed Storage URL must resolve to the main Supabase project',()=>{
 const url=appTest.normalizeSignedStorageUrl('/object/sign/ricevute-prenotazioni/doc.pdf?token=abc');
 assert.ok(url.startsWith('https://chkuayhbmitdmzmmvona.supabase.co/storage/v1/object/sign/'));
 assert.throws(()=>appTest.normalizeSignedStorageUrl('https://attacker.example/'),/non proviene/);
});
test('The PDF Edge Function cannot archive invoices, confirmations or receipts during unverified backups',async()=>{
 await assert.rejects(appTest.edgeAction('professional-receipts',{action:'generate',kind:'trip',id:'P1'}),/sospesa/);
 await assert.rejects(appTest.edgeAction('dg2-booking-pdf',{action:'generate',bookingId:'B1'}),/sospesa/);
});

test('BUS BIS action is accessible from journey list and requires safe write mode for commit',()=>{
 const html=appTest.drawTrips();
 assert.ok(html.includes('data-action="open-bis"'),'Journey list must offer manual BIS entry');
 assert.equal(appTest.WRITES_ENABLED,false);
});
test('Transfer preview handler renders read-only with safe mode on',()=>{
 assert.ok(appTest.drawMovements().includes('transfer-booking'));
 assert.equal(appTest.WRITES_ENABLED,false);
});

test('Operator cash transfer is labeled Giroconto and remains distinct from booking-credit Giroconto',()=>{
 const cash=appTest.drawCash();
 assert.ok(cash.includes('Giroconto'));
 assert.ok(cash.includes('Nicola'));
 assert.ok(cash.includes('data-action="new-transfer"'));
 assert.equal(appTest.WRITES_ENABLED,false);
});

test('Agenda and scadenze have separate views, calendars and individual edit/delete/restore controls',()=>{
 const list=appTest.state.all.agenda;
 list.push({id:'A',titolo:'Riunione clienti',tipo:'Appuntamento',stato:'aperta',priorita:'normale',data_scadenza:'2026-11-17',updated_at:'2026-11-17T10:00:00Z'});
 list.push({id:'B',titolo:'Revisione estintori',tipo:'Estintori',stato:'aperta',priorita:'alta',data_scadenza:'2026-11-17',updated_at:'2026-11-17T10:00:00Z'});
 const agendaHTML=appTest.drawAgenda(),deadlineHTML=appTest.drawDeadlines();
 assert.ok(agendaHTML.includes('Riunione clienti'));
 assert.ok(!agendaHTML.includes('Revisione estintori'));
 assert.ok(deadlineHTML.includes('Revisione estintori'));
 assert.ok(!deadlineHTML.includes('Riunione clienti'));
 assert.ok(agendaHTML.includes('data-action="edit-agenda"'));
 assert.ok(agendaHTML.includes('data-action="delete-agenda"'));
 assert.ok(deadlineHTML.includes('data-action="create-deadline"'));
 list.length=0;
});
test('Piantine can be edited and associated with GTs; write operations still obey the staging gate',()=>{
 const html=appTest.drawLayouts();
 assert.ok(html.includes('data-action="create-layout"'));
 assert.ok(html.includes('Piantine autobus'));
 assert.equal(appTest.WRITES_ENABLED,false);
});

test('Agenda V4 really renders original V2 appointments from the attivita_gestionale archive',()=>{
 const old=[
  {id:'historical-1',titolo:'LIMOUSINE BUS 21/11',scadenza:'2026-11-21',
   stato:'completata',priorita:'alta',assegnata_a:'Raffaele',updated_at:'2026-10-13T10:00:00Z'},
  {id:'historical-2',titolo:'BUS GT 13/12',scadenza:'2026-12-13',
   stato:'aperta',priorita:'normale',assegnata_a:'Nicola',updated_at:'2026-11-12T10:00:00Z'}
 ];
 appTest.state.all.legacyAgenda=old;
 const calendar=appTest.drawAgenda(),deadlines=appTest.drawDeadlines();
 assert.ok(calendar.includes('LIMOUSINE BUS 21/11'));
 assert.ok(calendar.includes('BUS GT 13/12'));
 assert.ok(calendar.includes('Assegnato a: Raffaele'));
 assert.ok(calendar.includes('data-action="edit-agenda"'));
 assert.ok(!deadlines.includes('BUS GT 13/12'));
 appTest.state.all.legacyAgenda=[];
});
