/* DELGROSSO V79 - PDF A4 orizzontale, multipagina, generato offline.
 * Il report e' gestionale interno: non una ricevuta fiscale.
 */
(function(){
'use strict';
const enc=new TextEncoder();
const W=842,H=595,L=29,R=813;
const widths=[57,170,100,75,75,75,65,80,87];
const headers=['BUS / POSTO','INTESTATARIO','FERMATA','QUOTA','NICOLA','RAFFAELE','ALTRO','INCASSATO','RESIDUO'];
const amount=v=>(Number(v||0)/100).toFixed(2).replace('.',',')+' EUR';
const plain=s=>String(s??'')
 .normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
 .replace(/€/g,' EUR ').replace(/[\u2010-\u2015]/g,'-')
 .replace(/[\u2018-\u2019]/g,"'").replace(/[\u201C-\u201D]/g,'"')
 .replace(/[^\x20-\x7E]/g,' ').replace(/\s+/g,' ').trim();
const pdfEsc=s=>plain(s).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
function titleLen(text,size,w){
 const s=plain(text),count=Math.max(2,Math.floor((w-7)/(size*.51)));
 return s.length>count?s.slice(0,count-3)+'...':s;
}
function showAmount(v){return amount(v)}
function romanDate(date){
 const p=String(date||'').slice(0,10).split('-');return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:'-';
}
function page(){
 return {parts:[],drawn:0};
}
function fill(pg,r,g,b){pg.parts.push(r+' '+g+' '+b+' rg');}
function box(pg,x,y,w,h,r,g,b){
 fill(pg,r,g,b);pg.parts.push(x+' '+y+' '+w+' '+h+' re f');
}
function rule(pg,x1,y1,x2,y2){
 pg.parts.push('0.83 0.86 0.89 RG 0.6 w '+x1+' '+y1+' m '+x2+' '+y2+' l S');
}
function text(pg,x,y,s,sz=9,bold=false,color=[0.13,0.2,0.29],max=0){
 const value=max?titleLen(s,sz,max):plain(s);
 fill(pg,...color);
 pg.parts.push('BT /F'+(bold?'2':'1')+' '+sz+' Tf 1 0 0 1 '+x+' '+y+' Tm ('+pdfEsc(value)+') Tj ET');
}
function brand(pg,continued=false){
 box(pg,0,continued?553:529,W,continued?42:66,.065,.16,.27);
 text(pg,30,continued?568:561,'DELGROSSO VIAGGI & LIMOUSINE BUS',continued?14:18,true,[1,1,1],740);
 if(!continued)text(pg,31,542,'RIEPILOGO ECONOMICO DI PARTENZA  |  USO INTERNO',9.1,false,[.74,.86,.96],760);
}
function cells(pg,base,values,sz=7.4,bold=false){
 let x=L;
 for(let i=0;i<widths.length;i++){
  const w=widths[i];
  text(pg,x+4,base,values[i],sz,bold,[.15,.24,.34],w-4);
  x+=w;
 }
}
function tableHeader(pg,y){
 box(pg,L,y-8,R-L,25,.09,.24,.37);
 let x=L;
 for(let i=0;i<headers.length;i++){
  text(pg,x+4,y+3,headers[i],7.25,true,[1,1,1],widths[i]-4);x+=widths[i];
 }
}
function row(pg,r,y,i){
 if(i%2===0)box(pg,L,y-22,R-L,26,.965,.976,.988);
 const bus=r.bus.replace('BUS ','B')+'/'+r.seat;
 const label=r.holder+(r.persons>1?' ('+r.person+'/'+r.persons+')':'');
 const col=[
  bus,label,r.stop,showAmount(r.quota),
  showAmount(r.nicola),showAmount(r.raffaele),showAmount(r.altro),
  showAmount(r.incassato),showAmount(r.residuo)
 ];
 cells(pg,y-8,col,7.45,false);
 const sub='ACCONTO '+showAmount(r.acconto)+'  |  SALDO '+showAmount(r.saldo)+
  (r.rimborso?'  |  RIMB. '+showAmount(r.rimborso):'');
 text(pg,L+60,y-17,sub,6.65,false,[.38,.45,.53],430);
 rule(pg,L,y-23,R,y-23);
}
function summaryBox(pg,x,y,w,label,value){
 box(pg,x,y,w,45,.938,.957,.978);
 text(pg,x+9,y+29,label,8.5,false,[.33,.43,.54],w-15);
 text(pg,x+9,y+8,value,13.5,true,[.06,.2,.35],w-15);
}
function make(report){
 if(!report||!report.trip||!report.totals||!Array.isArray(report.rows))
  throw Error('Dati del riepilogo non validi.');
 const pages=[];
 let pg=page();pages.push(pg);brand(pg);
 const t=report.totals,trip=report.trip;
 const title=plain(trip.titolo||trip.destinazione||'Viaggio');
 const day=romanDate(trip.data_partenza),today=String(report.today||'').slice(0,10);
 const status=today===String(trip.data_partenza).slice(0,10)?'GIORNO DELLA PARTENZA':
  (today<String(trip.data_partenza).slice(0,10)?'ANTEPRIMA PRE-PARTENZA':'SITUAZIONE AGGIORNATA');
 text(pg,30,511,title+' - '+day,13.5,true,[.07,.2,.34],700);
 text(pg,30,493,'DATA '+day+'    ORA '+String(trip.ora_partenza||'').slice(0,5)+
  '    AUTOBUS '+report.trips.length+'    EMISSIONE '+status,8.5,false,[.39,.48,.57],780);
 const cw=185;for(const [i,label,value] of [
   ['PARTECIPANTI',String(t.pax)],
   ['VALORE QUOTE',showAmount(t.quota)],
   ['INCASSI NETTI',showAmount(t.cashNet)],
   ['RESIDUO ATTIVO',showAmount(t.activeResidual)]
 ].map((x,i)=>[i,x[0],x[1]])){
  summaryBox(pg,L+i*199,428,cw,label,value);
 }
 text(pg,30,409,'Dettaglio per singolo posto / partecipante; gli incassi di una prenotazione plurima sono ripartiti per posto.',7.8,false,[.35,.42,.5],785);
 tableHeader(pg,382);
 let y=358,rowNo=0;
 for(const person of report.rows){
  if(y<83){
   pg=page();pages.push(pg);brand(pg,true);
   text(pg,L,539,'DETTAGLIO PARTECIPANTI (segue) - '+title,10,true,[.15,.3,.44],780);
   tableHeader(pg,515);y=491;
  }
  row(pg,person,y,rowNo++);y-=28;
 }
 // Totals occupy a dedicated final page to keep the financial close together.
 pg=page();pages.push(pg);brand(pg,true);
 text(pg,L,525,'RIEPILOGO ECONOMICO FINALE',17,true,[.08,.2,.34],780);
 text(pg,L,505,title+'  |  '+day+'  |  '+status,9,false,[.35,.43,.51],780);
 rule(pg,L,496,R,496);
 const metrics=[
  ['VALORE PRENOTAZIONI ATTIVE',t.quota],
  ['INCASSI SU PRENOTAZIONI ATTIVE',t.activePaid],
  ['RESIDUO ANCORA DA RISCUOTERE',t.activeResidual],
  ['ECCEDENZE SU PRENOTAZIONI',t.activeExcess],
  ['ACCONTI REGISTRATI',t.acconti],
  ['SALDI REGISTRATI',t.saldi],
  ['RIMBORSI REGISTRATI',t.refunds]
 ];
 let yy=478;
 for(const [label,val] of metrics){
  text(pg,L+6,yy,label,9,false,[.28,.35,.43],430);
  text(pg,447,yy,showAmount(val),10,true,[.09,.23,.36],170);
  rule(pg,L,yy-6,622,yy-6);yy-=24;
 }
 box(pg,630,307,184,174,.932,.965,.988);
 text(pg,640,459,'QUOTE ATTRIBUITE',10,true,[.1,.24,.38],164);
 text(pg,640,434,'NICOLA',8.5,false,[.28,.38,.5],160);
 text(pg,640,416,showAmount(t.nicola),13,true,[.03,.28,.48],162);
 text(pg,640,389,'RAFFAELE',8.5,false,[.28,.38,.5],160);
 text(pg,640,371,showAmount(t.raffaele),13,true,[.03,.28,.48],162);
 text(pg,640,345,'ALTRI / DA ATTRIBUIRE',8,false,[.28,.38,.5],162);
 text(pg,640,328,showAmount(t.altro),12,true,[.03,.28,.48],162);
 box(pg,L,261,R-L,38,.08,.2,.33);
 text(pg,L+10,274,'TOTALE INCASSATO NETTO DEL VIAGGIO',10.4,true,[1,1,1],470);
 text(pg,554,273,showAmount(t.cashNet),15,true,[1,1,1],246);
 text(pg,L,245,'Riconciliazione: Nicola + Raffaele + altri = incassato netto. Il valore prenotazioni e il residuo sono separati.',8,false,[.35,.42,.51],775);
 text(pg,L,225,'Movimenti su prenotazioni annullate: '+showAmount(t.cancelledCash)+
  '  |  Riserve: '+showAmount(t.reservedCash)+
  '  |  Non collegati: '+showAmount(t.unlinkedCash),7.65,false,[.39,.44,.51],775);
 text(pg,L,201,'DETTAGLIO PER AUTOBUS',9.5,true,[.1,.25,.38],775);
 let sy=183;
 for(const s of report.busSummaries.slice(0,4)){
  text(pg,L+5,sy,s.bus+'  -  '+s.people+' partecipanti',8.5,false,[.25,.35,.44],250);
  text(pg,304,sy,'Quote: '+showAmount(s.quota),8.3,false,[.25,.35,.44],215);
  text(pg,540,sy,'Incassato: '+showAmount(s.paid),8.3,false,[.25,.35,.44],255);
  sy-=17;
 }
 const notices=[...report.warnings];
 if(report.busSummaries.length>4)notices.push('Altri autobus: '+(report.busSummaries.length-4)+' (inclusi nei totali).');
 let wy=sy-6;
 for(const message of notices.slice(0,2)){
  text(pg,L+5,wy,'ATTENZIONE: '+message,7.5,false,[.5,.28,.14],770);wy-=15;
 }
 if(notices.length>2)text(pg,L+5,wy,'Ulteriori anomalie: '+(notices.length-2),7.5,false,[.5,.28,.14],770);
 for(let i=0;i<pages.length;i++){
  const item=pages[i];
  rule(item,L,45,R,45);
  text(item,L,33,'DELGROSSO VIAGGI  -  REPORT INTERNO  -  NON E UNA RICEVUTA FISCALE',7,false,[.4,.46,.53],675);
  text(item,750,33,'Pag. '+(i+1)+' / '+pages.length,7,false,[.4,.46,.53],73);
 }
 const objs=[],add=str=>{objs.push(str);return objs.length};
 const catalog=add('<< /Type /Catalog /Pages 2 0 R >>');
 const pagesId=add('PAGES_PLACEHOLDER');
 const regular=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
 const bold=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
 const pageIds=[];
 for(const p of pages){
  const stream=p.parts.join('\n')+'\n';
  const bytes=enc.encode(stream);
  const content=add({header:'<< /Length '+bytes.length+' >>',stream:bytes});
  const id=add('<< /Type /Page /Parent '+pagesId+' 0 R /MediaBox [0 0 '+W+' '+H+
   '] /Resources << /Font << /F1 '+regular+' 0 R /F2 '+bold+
   ' 0 R >> >> /Contents '+content+' 0 R >>');
  pageIds.push(id);
 }
 objs[pagesId-1]='<< /Type /Pages /Kids ['+pageIds.map(id=>id+' 0 R').join(' ')+'] /Count '+pages.length+' >>';
 const chunks=[],offsets=[0];let count=0;
 const push=a=>{const b=typeof a==='string'?enc.encode(a):a;chunks.push(b);count+=b.length;};
 push('%PDF-1.4\n%DELGROSSO\n');
 for(let i=0;i<objs.length;i++){
  offsets.push(count);
  push((i+1)+' 0 obj\n');
  const o=objs[i];
  if(o&&typeof o==='object'&&o.stream){
   push(o.header+'\nstream\n');push(o.stream);push('\nendstream\nendobj\n');
  }else push(String(o)+'\nendobj\n');
 }
 const xref=count;
 push('xref\n0 '+(objs.length+1)+'\n0000000000 65535 f \n');
 for(const v of offsets.slice(1))push(String(v).padStart(10,'0')+' 00000 n \n');
 push('trailer\n<< /Size '+(objs.length+1)+' /Root '+catalog+' 0 R >>\nstartxref\n'+xref+'\n%%EOF\n');
 const output=new Uint8Array(count);let off=0;
 for(const c of chunks){output.set(c,off);off+=c.length;}
 if(output.length<750||String.fromCharCode(...output.slice(0,5))!=='%PDF-')
  throw Error('Generazione PDF non valida.');
 return output;
}
window.DG79PDF={make,formatCents:showAmount};
})();
