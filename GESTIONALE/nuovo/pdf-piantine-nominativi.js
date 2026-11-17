/* DELGROSSO VIAGGI — stampa vettoriale A3 delle piantine ufficiali, sola lettura.
 * Richiede GESTIONALE/seatmap-groups.js caricato prima di questo file.
 * Il nome riportato e' il referente della prenotazione, non un passeggero individuale.
 */
(function (root) {'use strict';
 const W=841.89,H=1190.55,M=38;
 const fix=n=>Number(n).toFixed(2), safe=x=>String(x??'').replace(/[\r\n\t]/g,' ').replace(/\s+/g,' ').trim();
 const euroChars={'€':128,'‘':145,'’':146,'“':147,'”':148,'–':150,'—':151,'…':133};
 function hex(s){return [...safe(s)].map(ch=>{const v=ch.codePointAt(0);const n=v<=255?v:(euroChars[ch]||63);return n.toString(16).padStart(2,'0')}).join('')}
 function linesText(str,max){
  const chunks=[],words=safe(str).split(/\s+/);let line='';
  for(const word of words){if(!word)continue;if((line+' '+word).trim().length>max&&line){chunks.push(line);line=word}else line=(line+' '+word).trim()}
  if(line)chunks.push(line);return chunks;
 }
 function makePdf(pages){
  const chunks=[],ofs=[0];let offset=0;
  const enc=s=>Uint8Array.from(String(s),c=>c.charCodeAt(0)&255);
  const push=b=>{const a=typeof b==='string'?enc(b):b;chunks.push(a);offset+=a.length};
  const obj=(i,b)=>{ofs[i]=offset;push(i+' 0 obj\n'+b+'\nendobj\n')};
  push('%PDF-1.4\n%DELGROSSO\n');
  obj(1,'<< /Type /Catalog /Pages 2 0 R >>');
  obj(2,'<< /Type /Pages /Kids ['+pages.map((_,i)=>(5+i*2)+' 0 R').join(' ')+'] /Count '+pages.length+' >>');
  obj(3,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  obj(4,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  pages.forEach((p,i)=>{
   const page=5+i*2,content=page+1,s=p.join('\n')+'\n';
   obj(page,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+fix(W)+' '+fix(H)+'] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents '+content+' 0 R >>');
   obj(content,'<< /Length '+s.length+' >>\nstream\n'+s+'endstream');
  });
  const xref=offset,size=5+pages.length*2;
  push('xref\n0 '+size+'\n0000000000 65535 f \n');
  for(let i=1;i<size;i++)push(String(ofs[i]).padStart(10,'0')+' 00000 n \n');
  push('trailer\n<< /Size '+size+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF');
  const result=new Uint8Array(offset);let p=0;for(const b of chunks){result.set(b,p);p+=b.length}return result;
 }
 function Canvas(){this.cmd=[]}
 Canvas.prototype.rect=function(x,y,w,h,rgb,stroke=null){const c=rgb.map(fix).join(' ');this.cmd.push(c+' rg '+fix(x)+' '+fix(H-y-h)+' '+fix(w)+' '+fix(h)+' re f');if(stroke){this.cmd.push(stroke.map(fix).join(' ')+' RG 0.55 w '+fix(x)+' '+fix(H-y-h)+' '+fix(w)+' '+fix(h)+' re S')}};
 Canvas.prototype.text=function(v,x,y,size=10,bold=false,color=[.10,.17,.27]){this.cmd.push(color.map(fix).join(' ')+' rg BT /F'+(bold?'2':'1')+' '+fix(size)+' Tf 1 0 0 1 '+fix(x)+' '+fix(H-y)+' Tm <'+hex(v)+'> Tj ET')};
 Canvas.prototype.line=function(x,y,x2,y2,c=[.73,.79,.84]){this.cmd.push(c.map(fix).join(' ')+' RG 0.8 w '+fix(x)+' '+fix(H-y)+' m '+fix(x2)+' '+fix(H-y2)+' l S')};
 function header(c,title,sub,page){c.rect(0,0,W,10,[.06,.35,.47]);c.text('DELGROSSO',M,48,27,true,[.06,.25,.35]);c.text('VIAGGI & LIMOUSINE BUS',M,66,10,true,[.30,.43,.53]);c.text(title,M,104,20,true);c.text(sub,M,126,10,false);c.line(M,137,W-M,137);c.text('DOCUMENTO OPERATIVO RISERVATO  |  PAGINA '+page,M,H-29,8,false,[.36,.43,.52])}
 function statusColor(cell,g){if(g)return g.pdf;if(cell.status==='blocked'||cell.status==='out_of_service')return [.96,.82,.76];return [.85,.95,.91]}
 function validated(group){
  const res=root.DGSeatGroups;
  if(!res?.buildPlan)throw Error('Modulo ufficiale DGSeatGroups assente.');
  const rows=[];
  for(const departure of group||[]){
   for(const bus of departure.buses||[]){
    if(!bus.official||!bus.layout?.rows?.length)throw Error('Piantina ufficiale mancante: '+safe(bus.name));
    const plan=res.buildPlan({layout:bus.layout,bookings:bus.bookings||[],seatRows:bus.seatRows||[],capacity:bus.trip?.posti_totali,strict:true});
    const cap=Number(bus.trip?.posti_totali);
    if(plan.geometry.capacity!==cap)throw Error('Capienza differente sulla piantina di '+safe(bus.name)+': '+plan.geometry.capacity+' invece di '+cap);
    // Per la stampa deve corrispondere non solo il numero dei sedili, ma ogni numero da 1 a N.
    const ids=plan.geometry.rows.flatMap(r=>r.cells.filter(c=>c.type==='seat').map(c=>Number(c.id)));
    if(ids.length!==cap||Array.from({length:cap},(_,i)=>i+1).some(n=>!ids.includes(n)))throw Error('Numerazione sedili incompleta su '+safe(bus.name));
    if((bus.warnings||[]).length)throw Error('Dati viaggio da verificare prima della stampa: '+bus.warnings.join('; '));
    rows.push({departure,bus,plan});
   }
  }
  if(!rows.length)throw Error('Nessun autobus disponibile per la stampa');return rows;
 }
 function renderBus({departure,bus,plan},page){
  const c=new Canvas(),geom=plan.geometry;
  const name=safe(departure.title||bus.trip?.titolo||'Viaggio');
  header(c,'PIANTINA POSTI CON PRENOTATI',name+'  |  '+safe(bus.trip?.data_partenza||'')+'  |  '+safe(bus.name||'BUS')+'  |  '+geom.capacity+' posti',page);
  c.rect(M,151,W-2*M,36,[.89,.94,.96]);c.text('FRONTE AUTOBUS  -  AUTISTA',M+230,174,12,true,[.07,.29,.40]);
  const nrows=geom.rows.length,cols=Math.max(...geom.rows.map(r=>r.cells.length));
  const top=199,pitch=(W-2*M-25)/cols,step=Math.min(54,(H-top-105)/nrows),cellH=step-4,cellW=pitch-4;
  // Non creare o ricostruire sedili: posizione ricavata ESCLUSIVAMENTE dalle righe ufficiali.
  geom.rows.forEach((row,ri)=>{
   const y=top+ri*step;
   c.text(String(ri+1),M+2,y+cellH/2+3,8,false,[.33,.42,.52]);
   row.cells.forEach((cell,ci)=>{
    const x=M+25+ci*pitch;
    if(cell.type!=='seat'){
     const names={aisle:'CORRIDOIO',door:'PORTA',wc:'WC',driver:'AUTISTA',table:'TAVOLO'};
     c.rect(x,y,cellW,cellH,cell.type==='door'?[.99,.88,.69]:[.94,.96,.97],[.81,.85,.88]);
     if(names[cell.type])c.text(names[cell.type],x+7,y+cellH/2+2,cellW<110?7:9,true,[.39,.46,.52]);return;
    }
    const occ=plan.bySeat.get(String(cell.id));
    c.rect(x,y,cellW,cellH,statusColor(cell,occ),[.60,.72,.77]);
    c.text('POSTO '+cell.id,x+7,y+14,10,true,[.07,.22,.32]);
    if(occ){
     const label=linesText(occ.name,Math.max(12,Math.floor(cellW/6.3))).slice(0,2);
     label.forEach((line,li)=>c.text(line.slice(0,Math.floor(cellW/5.5)),x+7,y+27+li*10,8.3,true,[.10,.17,.24]));
     c.text(occ.number,x+cellW-31,y+14,8,true,[.15,.23,.34]);
    }else c.text(cell.status==='available'?'LIBERO':'NON DISPONIBILE',x+7,y+29,8,false,[.29,.43,.44]);
   });
  });
  const below=top+nrows*step+15;
  c.line(M,below,W-M,below);
  c.text('PRENOTATI: '+plan.bySeat.size+'  |  LIBERI: '+(geom.capacity-plan.bySeat.size)+'  |  GRUPPI: '+plan.groups.length,M,below+23,11,true);
  c.text('I nomi riportati sono i referenti delle prenotazioni; ogni gruppo mantiene lo stesso colore.',M,below+44,9);
  return c.cmd;
 }
 function renderLegend({departure,bus,plan},page){
  const c=new Canvas();header(c,'LEGENDA COLORI E PRENOTAZIONI',safe(departure.title)+'  |  '+safe(bus.name||'BUS'),page);
  let y=165;const entries=plan.groups;
  c.rect(M,y-18,W-2*M,27,[.90,.94,.96]);c.text('GRUPPO',M+8,y,10,true);c.text('REFERENTE',M+110,y,10,true);c.text('POSTI',M+380,y,10,true);c.text('FERMATA',M+585,y,10,true);y+=31;
  for(const g of entries){
   if(y+23>H-60)throw Error('Troppi gruppi per una sola legenda: esportazione bloccata, occorre impaginazione aggiuntiva.');
   c.rect(M,y-16,W-2*M,26,entries.indexOf(g)%2?[.99,.99,.99]:[.96,.98,.99]);
   c.rect(M+5,y-12,75,20,g.pdf);c.text(g.number,M+17,y+2,9,true);
   c.text(safe(g.name).slice(0,43),M+110,y+2,9,true);
   c.text(g.seats.join(', ').slice(0,32),M+380,y+2,9);
   c.text(safe(g.stop).slice(0,30),M+585,y+2,9);
   y+=29;
  }
  c.text('Per la verifica delle assegnazioni consultare anche il registro delle prenotazioni in Supabase.',M,y+29,9);
  return c.cmd;
 }
 function makeSeatMapPdf(groups){const valid=validated(groups),pages=[];for(const item of valid){pages.push(renderBus(item,pages.length+1));pages.push(renderLegend(item,pages.length+1))}return makePdf(pages)}
 root.DGSeatPdf=Object.freeze({makeSeatMapPdf,validate:validated});
 if(typeof module!=='undefined'&&module.exports)module.exports=root.DGSeatPdf;
})(typeof window!=='undefined'?window:globalThis);
