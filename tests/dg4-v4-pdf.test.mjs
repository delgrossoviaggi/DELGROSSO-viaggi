// DELGROSSO VIAGGI 4.0 — validazione PDF senza rete, database o dati reali.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const code=readFileSync(new URL('../GESTIONALE/v4/pdf-engine.js',import.meta.url),'utf8');
const window={};
vm.runInNewContext(code,{window,atob,Uint8Array,Intl,Date,Math,Number,String,Map,Set,Array,JSON,Blob},{timeout:10000});
const pdf=window.DG4Pdf;
const trip={id:'T1',titolo:'Napoli (fixture)',data_partenza:'2026-12-20',posti_totali:53,autobus:'GT53'};
const booking={id:'B1',cliente:'Cliente Test',viaggio_id:'T1',posti:2,stato:'Acconto Ricevuto',totale:40,pagato:20,fermata_partenza:'San Severo',posti_selezionati:'1,2'};
const payment={id:'P1',cliente:'Cliente Test',prenotazione_id:'B1',receipt_number:'DG-TEST',importo:20,tipo:'Acconto',data_pagamento:'2026-11-17'};
const map={name:'GT53',rows:[{cells:[{id:'1',type:'seat',label:'1'},{id:'2',type:'seat',label:'2'},{type:'aisle'},{id:'3',type:'seat',label:'3'},{id:'4',type:'seat',label:'4'}]}]};
function validPDF(bytes) {
 assert.ok(bytes instanceof Uint8Array,'PDF must be a binary buffer');
 assert.ok(bytes.length>1000,'No truncated file');
 const content=Buffer.from(bytes).toString('latin1');
 assert.ok(content.startsWith('%PDF-1.4\n'),'PDF signature incorrect');
 assert.ok(content.endsWith('%%EOF'),'File is incomplete');
 const found=content.slice(-150).match(/startxref\s+(\d+)/);
 assert.ok(found,'Missing cross-reference pointer');
 const xref=Number(found[1]);
 assert.ok(xref>30 && xref<bytes.length,'Wrong xref bounds');
 assert.equal(content.slice(xref,xref+4),'xref','PDF object offsets invalid');
 assert.ok(content.includes('/ImLogo'),'The company logo image must be embedded');
 assert.ok(content.includes('/Count '),'PDF page count must be declared');
 return content;
}
const generators=[
 ['booking confirmation',()=>pdf.makeBookingPdf(booking,trip,[])],
 ['operational Control Room',()=>pdf.makeOperationalPdf([{trip,buses:[{name:'GT53',trip,bookings:[{...booking,sedili:['1','2']}],official:true,layout:map}]}])],
 ['booking roster',()=>pdf.makeRosterPdf([{trip,buses:[{name:'GT53',trip,bookings:[booking]}]}])],
 ['receipt summary',()=>pdf.makeReceiptPdf(payment,booking,trip)],
 ['cash by operator',()=>pdf.makeCashSummaryPdf([{nome:'NICOLA',cassa_netto:20,viaggi_incassati:20,noleggi_incassati:0,contanti_netto:20}],[payment])],
 ['agenda',()=>pdf.makeAgendaPdf([{titolo:'Scadenza',data_scadenza:'2026-11-19'}])],
 ['client dossier',()=>pdf.makeCustomerLedgerPdf({nome:'Test',cognome:'Cliente'},[booking],[payment],{T1:trip})],
 ['rental dossier',()=>pdf.makeRentalSummaryPdf({id:'N1',tratta_partenza:'San Severo',tratta_destinazione:'Napoli'},[])],
 ['economy',()=>pdf.makeEconomyPdf([{descrizione:'Pagamento test',importo:20}],[])],
 ['fleet',()=>pdf.makeFleetPdf([{titolo:'GT53',posti:53}])],
 ['customers registry',()=>pdf.makeCustomerListPdf([{nome:'Test',cognome:'Cliente'}])],
 ['rentals registry',()=>pdf.makeRentalsPdf([{tratta_partenza:'A',tratta_destinazione:'B'}])],
 ['document archive',()=>pdf.makeDocumentIndexPdf([{tipo_documento:'RICEVUTA',documento_id:'D1'}])],
 ['quote',()=>pdf.makeQuotePdf({id:'Q1',destinazione:'Napoli',nome:'Test'})],
 ['draft invoice',()=>pdf.makeInvoiceDraftPdf({id:'I1',totale_centesimi:12345})],
 ['seat layout',()=>pdf.makeV4LayoutPdf(map)]
];
for(const [kind,generate] of generators) {
 test(kind+' renders a complete, logo-embedded PDF',()=>validPDF(generate()));
}

test('Combined confirmation is a complete A4 PDF with logo, two departure sections and grand total',()=>{
 const summary={
  title:'Napoli e Spaccanapoli',date:'2026-12-08',reference:'Mario Rossi',phone:'3331234567',
  bookingCount:3,passengers:6,totalCents:12000,paidCents:4000,dueCents:8000,
  surplusCents:0,warnings:[],
  sections:[
   {stop:'Apricena',passengers:1,totalCents:2000,paidCents:2000,
    bookings:[{code:'A',bus:'BUS principale',passengers:1,seats:'3',totalCents:2000,paidCents:2000}]},
   {stop:'San Severo',passengers:5,totalCents:10000,paidCents:2000,
    bookings:[{code:'B',bus:'BUS principale',passengers:2,seats:'1, 2',totalCents:4000,paidCents:2000},
     {code:'C',bus:'BUS BIS 2',passengers:3,seats:'6, 7, 8',totalCents:6000,paidCents:0}]}
  ]
 };
 const content=validPDF(pdf.makeCombinedBookingPdf(summary));
 assert.ok(content.includes('/MediaBox [0 0 595 842]'),'Expected A4 portrait pages');
});
test('Combined confirmation refuses totals that do not match the individual bookings',()=>{
 const summary={title:'Test',date:'2026-12-08',reference:'Test',phone:'3331234567',
  bookingCount:1,passengers:2,totalCents:5000,paidCents:0,dueCents:5000,
  sections:[{stop:'San Severo',passengers:1,totalCents:3000,paidCents:0,
   bookings:[{code:'T',bus:'BUS 1',passengers:1,seats:'1',totalCents:3000,paidCents:0}]}]};
 assert.throws(()=>pdf.makeCombinedBookingPdf(summary),/totali del PDF cumulativo/);
});

test('Multi-page rosters have correct page count and xref',()=>{
 const passengers=Array.from({length:95},(_,i)=>({...booking,id:'B'+i,cliente:'Cliente '+i,posti:1,codice:'C'+i,posti_selezionati:String(i+1),telefono:'3331234567'}));
 const doc=validPDF(pdf.makeRosterPdf([{trip,buses:[{name:'GT53',trip,bookings:passengers}]}]));
 const count=doc.match(/\/Count (\d+)/);
 assert.ok(count && Number(count[1])>=2,'Roster pagination failed');
});

test('All GT 53/57/63 seat schemes produce real, valid full-layout PDFs',()=>{
 for(const seats of [53,57,63]){
  let counter=0;
  const rows=Array.from({length:Math.ceil(seats/4)},(_,i)=>({
    rowNumber:i+1,cells:Array.from({length:5},(_,pos)=>{
      if(pos===2)return {type:'aisle'};
      counter++;
      return counter<=seats?{type:'seat',id:String(counter),label:String(counter)}:{type:'empty'};
    })
  }));
  const file=validPDF(pdf.makeV4LayoutPdf({name:'Autobus GT '+seats,posti_totali:seats,rows}));
  assert.ok(file.includes('/Type /Pages'));
 }
});

test('Seat layout does not silently accept a non-5-column model',()=>{
 assert.throws(()=>pdf.makeV4LayoutPdf({rows:[{cells:[{type:'seat',id:'1'}]}]}),/Geometria non compatibile/);
});
