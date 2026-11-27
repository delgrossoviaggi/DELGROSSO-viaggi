import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import { brandHeader, brandMini, useLogoStorage, NAVY, GOLD, INK, MUTED, LINE } from "./dg-logo.ts";

// Documenti PDF del gestionale con il solo logo ufficiale DELGROSSO Viaggi - limousineBUS:
// - conferma di prenotazione (bookingId)
// - lista passeggeri di un viaggio (action "passengers", tripId)
// - chi deve ancora pagare / riepilogo pagamenti di un viaggio (action "payments", tripId, scope "due" | "all")
const url=Deno.env.get("SUPABASE_URL")||"",key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const sb=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
useLogoStorage(sb);
const H={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8"};
const J=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:H});
const T=(x)=>String(x??"").trim();
const clean=(x)=>T(x).normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^\x20-\x7E]/g," ").replace(/\s+/g," ");
const N=x=>Number(x)||0;
const euro=(x)=>"EUR "+N(x).toLocaleString("it-IT",{minimumFractionDigits:2,maximumFractionDigits:2});
const date=(x)=>{const m=T(x).match(/^(\d{4})-(\d{2})-(\d{2})/);return m?m[3]+"/"+m[2]+"/"+m[1]:"Da definire"};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SOFT=rgb(.96,.975,.99),WHITE=rgb(1,1,1),ORANGE=rgb(.80,.33,.10),GREEN=rgb(.05,.45,.28),AMBER=rgb(.54,.35,0);
function wrap(font,size,x,max){
 let out=[],line="";for(let w of clean(x||"-").split(/\s+/)){
 while(font.widthOfTextAtSize(w,size)>max&&w.length>1){let j=1;while(j<w.length&&font.widthOfTextAtSize(w.slice(0,j+1),size)<=max)j++;if(line){out.push(line);line=""}out.push(w.slice(0,j));w=w.slice(j)}
 const next=line?line+" "+w:w;if(font.widthOfTextAtSize(next,size)>max&&line){out.push(line);line=w}else line=next
 }if(line)out.push(line);return out.length?out:["-"];
}
const seatList=(rows,b)=>{const xs=(rows||[]).map(r=>Number(r.posto)).filter(n=>n>0).sort((a,c)=>a-c);if(xs.length)return xs.join(", ");return T(b.posti_selezionati).split(/[;,\s]+/).filter(s=>/^\d+$/.test(s)).map(Number).sort((a,c)=>a-c).join(", ")};
// Referente per fermata: San Severo, Apricena, Lesina -> Raffaele; San Nicandro Garganico -> Nicola. Altre o miste: entrambi.
const RAFFAELE={nome:"Raffaele DELGROSSO",tel:"320 573 0466"},NICOLA={nome:"Nicola",tel:"366 212 7916"};
export function stopContacts(f){const s=T(f).toLowerCase(),n=/nicandro/.test(s),r=/severo|apricena|lesina/.test(s);return n&&!r?[NICOLA]:r&&!n?[RAFFAELE]:[RAFFAELE,NICOLA]}
const tripName=v=>clean(v.titolo||v.destinazione||"Viaggio DELGROSSO");
function footer(page,reg,bold,text){
 page.drawLine({start:{x:42,y:66},end:{x:page.getWidth()-42,y:66},thickness:.8,color:LINE});
 page.drawText("DELGROSSO VIAGGI & LIMOUSINE BUS",{x:42,y:50,size:8.5,font:bold,color:NAVY});
 page.drawText(text,{x:42,y:36,size:7.4,font:reg,color:MUTED});
}

export async function bookingPdf(b,v,seats,pays){
 const confirmed=/conferm/i.test(T(b.stato));
 const num=clean(b.confirmation_number||b.codice||b.id_prenotazione||T(b.id).slice(0,8).toUpperCase());
 const doc=await PDFDocument.create();const page=doc.addPage([595.28,841.89]);
 const reg=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
 doc.setTitle("DELGROSSO - Prenotazione "+num);doc.setAuthor("DELGROSSO VIAGGI & LIMOUSINE BUS");doc.setCreator("DELGROSSO Gestionale");
 const W=page.getWidth();
 let y=await brandHeader(doc,page,reg,bold,{title:confirmed?"CONFERMA PRENOTAZIONE":"RIEPILOGO PRENOTAZIONE",lines:[{text:"Codice "+num,bold:true,size:11},{text:"Emessa il "+date(new Date().toISOString()),color:MUTED}],note:"DOCUMENTO RIEPILOGATIVO - NON FISCALE"});
 const field=(label,value,x=42,w=W-84)=>{let yy=y;page.drawText(clean(label).toUpperCase(),{x,y:yy,size:7.5,font:bold,color:MUTED});yy-=16;for(const l of wrap(bold,11,value,w)){page.drawText(l,{x,y:yy,size:11,font:bold,color:INK});yy-=14}return yy};
 const two=(a,b2)=>{const y1=field(a[0],a[1],42,(W-84)/2-12),y2=field(b2[0],b2[1],42+(W-84)/2,(W-84)/2);y=Math.min(y1,y2)-10;page.drawLine({start:{x:42,y:y+2},end:{x:W-42,y:y+2},thickness:.6,color:LINE});y-=14};
 two(["Cliente",b.cliente_nome||b.cliente||"Cliente"],["Telefono",b.telefono||"-"]);
 two(["Viaggio",tripName(v)],["Partenza",date(v.data_partenza)+(v.ora_partenza?" ore "+T(v.ora_partenza).slice(0,5):"")]);
 two(["Fermata di salita",b.fermata_partenza||v.luogo_partenza||"Da definire"],["Stato",b.stato||(confirmed?"Confermata":"Da confermare")]);
 two(["Partecipanti",String(b.posti||0)],["Posti assegnati",seatList(seats,b)||"Da assegnare"]);
 // riepilogo economico
 const tot=N(b.totale),paid=N(b.pagato),res=Math.max(0,Math.round((tot-paid)*100)/100);
 y-=4;page.drawRectangle({x:42,y:y-74,width:W-84,height:74,color:SOFT,borderColor:LINE,borderWidth:1});
 const cw=(W-84)/3;[["TOTALE",euro(tot),INK],["VERSATO",euro(paid),GREEN],["DA SALDARE",euro(res),res>0?ORANGE:GREEN]].forEach((c,i)=>{const x=56+i*cw;page.drawText(c[0],{x,y:y-24,size:7.5,font:bold,color:MUTED});page.drawText(c[1],{x,y:y-50,size:17,font:bold,color:c[2]})});
 y-=98;
 const list=(pays||[]).filter(p=>N(p.importo)!==0);
 if(list.length){
  page.drawText("PAGAMENTI REGISTRATI",{x:42,y,size:9,font:bold,color:NAVY});y-=18;
  for(const p of list.slice(0,10)){page.drawText(date(p.data_pagamento),{x:42,y,size:9,font:reg,color:INK});page.drawText(clean(p.tipo||"Pagamento")+(p.metodo||p.metodo_pagamento?" - "+clean(p.metodo||p.metodo_pagamento):""),{x:120,y,size:9,font:reg,color:INK});const t=(/rimbors/i.test(T(p.tipo))?"- ":"")+euro(Math.abs(N(p.importo)));page.drawText(t,{x:W-42-bold.widthOfTextAtSize(t,9),y,size:9,font:bold,color:INK});y-=15}
  y-=10;
 }
 page.drawRectangle({x:42,y:y-4,width:4,height:16,color:confirmed?GOLD:ORANGE});
 page.drawText(confirmed?"Prenotazione confermata. Presentarsi alla fermata indicata 10 minuti prima della partenza.":"Richiesta registrata: la prenotazione non e ancora confermata.",{x:54,y,size:9.5,font:bold,color:confirmed?NAVY:ORANGE});
 y-=30;
 // Senza acconto: avviso dei 2 giorni.
 if(paid<=0){
  page.drawRectangle({x:42,y:y-46,width:W-84,height:54,color:rgb(1,.97,.92)});page.drawRectangle({x:42,y:y-46,width:4,height:54,color:GOLD});
  page.drawText("IMPORTANTE - ACCONTO ENTRO 2 GIORNI",{x:56,y:y-8,size:9.5,font:bold,color:NAVY});
  page.drawText("Trascorsi 2 giorni dalla prenotazione, se i posti non sono stati bloccati con un acconto,",{x:56,y:y-24,size:8.6,font:reg,color:INK});
  page.drawText("verranno svincolati immediatamente.",{x:56,y:y-36,size:8.6,font:reg,color:INK});
 }
 // Referente della fermata, in basso a sinistra.
 const cs=stopContacts(b.fermata_partenza);
 page.drawText(paid>0?"Per informazioni contatta:":"Per l'acconto e per informazioni contatta:",{x:42,y:86+cs.length*16,size:8.4,font:reg,color:MUTED});
 cs.forEach((c,i)=>page.drawText(c.nome+"  -  Tel. e WhatsApp "+c.tel,{x:42,y:86+(cs.length-1-i)*16,size:11,font:bold,color:NAVY}));
 footer(page,reg,bold,"Documento riepilogativo non fiscale");
 return {bytes:await doc.save(),num,confirmed};
}

export async function passengersPdf(v,bookings,seats,bus){
 const doc=await PDFDocument.create();
 const reg=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
 doc.setTitle("Lista passeggeri "+tripName(v)+" "+date(v.data_partenza));doc.setAuthor("DELGROSSO VIAGGI & LIMOUSINE BUS");
 const byB={};for(const s of seats||[])(byB[s.prenotazione_id]=byB[s.prenotazione_id]||[]).push(s);
 const groups={};for(const b of bookings.slice().sort((a,c)=>clean(a.cliente_nome||a.cliente).localeCompare(clean(c.cliente_nome||c.cliente),"it"))){const f=clean(b.fermata_partenza)||"Fermata non indicata";(groups[f]=groups[f]||[]).push(b)}
 const pax=bookings.reduce((a,b)=>a+N(b.posti),0),due=bookings.reduce((a,b)=>a+Math.max(0,N(b.totale)-N(b.pagato)),0);
 const cols=[["Nome",42,165],["Telefono",210,92],["Pers.",305,34],["Posti",342,120],["Da incassare",0,0],["Salito",0,0]];
 let page=doc.addPage([595.28,841.89]),W=page.getWidth();
 let y=await brandHeader(doc,page,reg,bold,{title:"LISTA PASSEGGERI",lines:[{text:tripName(v),bold:true,size:10.5},{text:date(v.data_partenza)+(v.ora_partenza?" ore "+T(v.ora_partenza).slice(0,5):""),color:MUTED},{text:pax+" passeggeri"+(bus?" - "+clean(bus):""),color:MUTED}]});
 const head=()=>{page.drawRectangle({x:42,y:y-6,width:W-84,height:20,color:NAVY});for(const c of cols.slice(0,4))page.drawText(c[0].toUpperCase(),{x:c[1]+4,y,size:7.2,font:bold,color:WHITE});page.drawText("DA INCASSARE",{x:W-128-bold.widthOfTextAtSize("DA INCASSARE",7.2),y,size:7.2,font:bold,color:WHITE});page.drawText("SALITO",{x:W-84,y,size:7.2,font:bold,color:WHITE});y-=24};
 const newPage=async()=>{page=doc.addPage([595.28,841.89]);y=await brandMini(doc,page,reg,"Lista passeggeri - "+tripName(v)+" - "+date(v.data_partenza)+" - Pagina "+doc.getPageCount());head()};
 head();
 for(const [stop,list] of Object.entries(groups)){
  if(y<130)await newPage();
  const n=list.reduce((a,b)=>a+N(b.posti),0);
  page.drawText(stop.toUpperCase()+"  ("+n+")",{x:42,y,size:9,font:bold,color:NAVY});y-=6;page.drawRectangle({x:42,y,width:40,height:2,color:GOLD});y-=14;
  for(const b of list){
   const s=seatList(byB[b.id],b),sl=wrap(reg,8.6,s||"-",116),nl=wrap(bold,8.8,b.cliente_nome||b.cliente||"Cliente",160),h=Math.max(sl.length,nl.length)*11+8;
   if(y-h<80)await newPage();
   nl.forEach((l,i)=>page.drawText(l,{x:46,y:y-i*11,size:8.8,font:bold,color:INK}));
   page.drawText(clean(b.telefono)||"-",{x:214,y,size:8.6,font:reg,color:INK});
   page.drawText(String(N(b.posti)),{x:309,y,size:8.6,font:reg,color:INK});
   sl.forEach((l,i)=>page.drawText(l,{x:346,y:y-i*11,size:8.6,font:reg,color:INK}));
   const r=Math.max(0,N(b.totale)-N(b.pagato)),t=r>0?euro(r):"Saldato";page.drawText(t,{x:W-128-bold.widthOfTextAtSize(t,8.6),y,size:8.6,font:bold,color:r>0?ORANGE:GREEN});
   page.drawRectangle({x:W-74,y:y-3,width:11,height:11,borderColor:MUTED,borderWidth:.8});
   y-=h;page.drawLine({start:{x:42,y:y+10},end:{x:W-42,y:y+10},thickness:.4,color:LINE});
  }
  y-=10;
 }
 if(y<110)await newPage();
 page.drawText("Totale passeggeri: "+pax,{x:42,y,size:10,font:bold,color:NAVY});
 const t="Ancora da incassare: "+euro(due);page.drawText(t,{x:W-42-bold.widthOfTextAtSize(t,10),y,size:10,font:bold,color:due>0?ORANGE:GREEN});
 doc.getPages().forEach(p=>footer(p,reg,bold,"Uso interno - documento di bordo"));
 return await doc.save();
}

// Situazione pagamenti di un viaggio: chi non ha versato nulla, chi ha l'acconto, (con scope "all") chi ha saldato.
const due=b=>Math.max(0,Math.round((N(b.totale)-N(b.pagato))*100)/100);
const cifra=x=>N(x).toLocaleString("it-IT",{minimumFractionDigits:2,maximumFractionDigits:2});
const ora=()=>{const p=Object.fromEntries(new Intl.DateTimeFormat("it-IT",{timeZone:"Europe/Rome",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date()).map(x=>[x.type,x.value]));return p.day+"/"+p.month+"/"+p.year+" ore "+p.hour+":"+p.minute};
export async function paymentsPdf(v,bookings,seats,bus,scope){
 const all=scope==="all";
 const doc=await PDFDocument.create();
 const reg=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
 doc.setTitle((all?"Riepilogo pagamenti ":"Da incassare ")+tripName(v)+" "+date(v.data_partenza));doc.setAuthor("DELGROSSO VIAGGI & LIMOUSINE BUS");doc.setCreator("DELGROSSO Gestionale");
 const byB={};for(const s of seats||[])(byB[s.prenotazione_id]=byB[s.prenotazione_id]||[]).push(s);
 const name=b=>clean(b.cliente_nome||b.cliente||"Cliente");
 const sorted=bookings.slice().sort((a,c)=>name(a).localeCompare(name(c),"it"));
 const none=sorted.filter(b=>due(b)>0&&N(b.pagato)<=0),acc=sorted.filter(b=>due(b)>0&&N(b.pagato)>0),ok=sorted.filter(b=>due(b)<=0);
 const sum=(xs,f)=>Math.round(xs.reduce((a,b)=>a+f(b),0)*100)/100;
 const tot=sum(sorted,b=>N(b.totale)),paid=sum(sorted,b=>N(b.pagato)),rest=sum(sorted,due),pax=sorted.reduce((a,b)=>a+N(b.posti),0);
 let page=doc.addPage([595.28,841.89]);const W=page.getWidth(),R=W-42;
 let y=await brandHeader(doc,page,reg,bold,{title:all?"RIEPILOGO PAGAMENTI":"CHI DEVE ANCORA PAGARE",lines:[{text:tripName(v),bold:true,size:10.5},{text:date(v.data_partenza)+(v.ora_partenza?" ore "+T(v.ora_partenza).slice(0,5):""),color:MUTED},bus?{text:clean(bus),color:MUTED}:null],note:"SITUAZIONE AL "+ora().toUpperCase()});
 // riquadro con i totali
 page.drawRectangle({x:42,y:y-70,width:W-84,height:70,color:SOFT,borderColor:LINE,borderWidth:1});
 const cw=(W-84)/3;[["TOTALE VIAGGIO",euro(tot),INK],["INCASSATO",euro(paid),GREEN],["DA INCASSARE",euro(rest),rest>0?ORANGE:GREEN]].forEach((c,i)=>{const x=56+i*cw;page.drawText(c[0],{x,y:y-22,size:7.5,font:bold,color:MUTED});page.drawText(c[1],{x,y:y-46,size:16,font:bold,color:c[2]})});
 page.drawText(sorted.length+" prenotazioni, "+pax+" persone: "+ok.length+" saldate, "+acc.length+" con acconto, "+none.length+" senza acconto",{x:56,y:y-62,size:8,font:reg,color:MUTED});
 y-=94;
 const head=()=>{page.drawRectangle({x:42,y:y-6,width:W-84,height:20,color:NAVY});
  for(const [t,x] of [["NOME",46],["TELEFONO",178],["FERMATA",254],["PERS.",346]])page.drawText(t,{x,y,size:7.2,font:bold,color:WHITE});
  for(const [t,r] of [["TOTALE",425],["VERSATO",487],["DA SALDARE",R-4]])page.drawText(t,{x:r-bold.widthOfTextAtSize(t,7.2),y,size:7.2,font:bold,color:WHITE});
  y-=24};
 const newPage=async()=>{page=doc.addPage([595.28,841.89]);y=await brandMini(doc,page,reg,(all?"Riepilogo pagamenti":"Chi deve ancora pagare")+" - "+tripName(v)+" - "+date(v.data_partenza)+" - Pagina "+doc.getPageCount());head()};
 const money=(t,r,yy,font,color)=>page.drawText(t,{x:r-font.widthOfTextAtSize(t,8.6),y:yy,size:8.6,font,color});
 const section=async(title,sub,list,color,tc=color)=>{
  if(y<150)await newPage();
  page.drawRectangle({x:42,y:y-3,width:4,height:14,color});
  page.drawText(title+"  ("+list.length+")",{x:52,y,size:9.5,font:bold,color:NAVY});
  const s=list.length?sub+" "+euro(sum(list,all&&color===GREEN?b=>N(b.pagato):due)):"";if(s)page.drawText(s,{x:R-bold.widthOfTextAtSize(s,8.6),y,size:8.6,font:bold,color:tc});
  y-=20;
  if(!list.length){page.drawText("Nessuno.",{x:52,y,size:8.6,font:reg,color:MUTED});y-=22;return}
  for(const b of list){
   const nl=wrap(bold,8.8,name(b),124).slice(0,2),created=T(b.created_at).slice(0,10),st=seatList(byB[b.id],b);
   const sub2=wrap(reg,7.2,(created?"Prenotato il "+date(created):"")+(st?(created?" - ":"")+"posti "+st:""),200).slice(0,2),fl=wrap(reg,8.6,b.fermata_partenza||"-",88).slice(0,2);
   const h=Math.max(nl.length*11+(sub2[0]&&sub2[0]!=="-"?sub2.length*9.5:0),fl.length*11)+8;
   if(y-h<84)await newPage();
   nl.forEach((l,i)=>page.drawText(l,{x:46,y:y-i*11,size:8.8,font:bold,color:INK}));
   if(sub2[0]&&sub2[0]!=="-")sub2.forEach((l,i)=>page.drawText(l,{x:46,y:y-nl.length*11-i*9.5+1,size:7.2,font:reg,color:MUTED}));
   page.drawText(clean(b.telefono)||"-",{x:178,y,size:8.6,font:reg,color:INK});
   fl.forEach((l,i)=>page.drawText(l,{x:254,y:y-i*11,size:8.6,font:reg,color:INK}));
   page.drawText(String(N(b.posti)),{x:352,y,size:8.6,font:reg,color:INK});
   money(cifra(b.totale),425,y,reg,INK);money(cifra(b.pagato),487,y,reg,N(b.pagato)>0?GREEN:MUTED);
   const r=due(b);money(r>0?cifra(r):"Saldato",R-4,y,bold,r>0?ORANGE:GREEN);
   y-=h;page.drawLine({start:{x:42,y:y+10},end:{x:R,y:y+10},thickness:.4,color:LINE});
  }
  y-=12;
 };
 if(!all&&!none.length&&!acc.length){page.drawText("Tutti hanno saldato: nessuno deve ancora pagare.",{x:46,y,size:10,font:bold,color:GREEN});y-=24}
 else{
  head();
  await section("SENZA ACCONTO - DEVONO PAGARE TUTTO","Da incassare",none,ORANGE);
  await section("CON ACCONTO - DEVONO SALDARE","Da incassare",acc,GOLD,AMBER);
 }
 if(all){if(!none.length&&!acc.length)head();await section("SALDATI","Incassato",ok,GREEN)}
 if(y<100)await newPage();
 page.drawText("Totale da incassare: "+euro(rest),{x:42,y:y-4,size:11,font:bold,color:rest>0?ORANGE:GREEN});
 page.drawText("Importi in euro",{x:R-reg.widthOfTextAtSize("Importi in euro",8),y:y-4,size:8,font:reg,color:MUTED});
 doc.getPages().forEach(p=>footer(p,reg,bold,"Uso interno - situazione pagamenti al "+ora()));
 return await doc.save();
}

async function operator(req){
 const token=T(req.headers.get("authorization")).replace(/^Bearer\s+/i,"");
 if(!token)return null;
 const user=await sb.auth.getUser(token);
 if(user.error||!user.data.user)return null;
 const op=await sb.from("operatori_gestionale").select("user_id").eq("user_id",user.data.user.id).eq("attivo",true).maybeSingle();
 return op.error||!op.data?null:op.data;
}
async function store(path,bytes,filename,extra={}){
 const upload=await sb.storage.from("ricevute-prenotazioni").upload(path,bytes,{upsert:true,contentType:"application/pdf",cacheControl:"0"});
 if(upload.error)throw upload.error;
 const signed=await sb.storage.from("ricevute-prenotazioni").createSignedUrl(path,600);
 if(signed.error)throw signed.error;
 return J({success:true,signedUrl:signed.data.signedUrl,filename,...extra});
}

Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:H});
 if(req.method!=="POST")return J({success:false,error:"Metodo non consentito"},405);
 try{
  const op=await operator(req);
  if(!op)return J({success:false,error:"Sessione operatore non valida"},401);
  const body=await req.json();
  if(T(body.action)==="passengers"){
   const tid=T(body.tripId);if(!UUID.test(tid))return J({success:false,error:"ID viaggio non valido"},400);
   const tr=await sb.from("viaggi").select("*").eq("id",tid).maybeSingle();if(tr.error)throw tr.error;if(!tr.data)return J({success:false,error:"Viaggio non trovato"},404);
   const bs=await sb.from("prenotazioni").select("id,cliente,cliente_nome,telefono,posti,totale,pagato,stato,fermata_partenza,posti_selezionati,riserva_aziendale").eq("viaggio_id",tid).limit(2000);if(bs.error)throw bs.error;
   const list=(bs.data||[]).filter(b=>!/annull|cancel|eliminat/i.test(T(b.stato)));
   const ps=await sb.from("prenotazione_posti").select("prenotazione_id,posto").eq("viaggio_id",tid).limit(6000);if(ps.error)throw ps.error;
   let bus="";const bid=tr.data.autobus_id;if(bid){const f=await sb.from("flotta").select("titolo,marca,modello,targa").eq("id",bid).maybeSingle();if(f.data)bus=(f.data.titolo||[f.data.marca,f.data.modello].filter(Boolean).join(" "))+(f.data.targa?" "+f.data.targa:"")}
   const bytes=await passengersPdf(tr.data,list,ps.data||[],bus);
   return await store("liste-passeggeri/"+tid+".pdf",bytes,"DELGROSSO_Passeggeri_"+tripName(tr.data).replace(/[^a-zA-Z0-9_-]+/g,"_")+"_"+T(tr.data.data_partenza)+".pdf");
  }
  if(T(body.action)==="payments"){
   const tid=T(body.tripId),scope=T(body.scope)==="all"?"all":"due";if(!UUID.test(tid))return J({success:false,error:"ID viaggio non valido"},400);
   const tr=await sb.from("viaggi").select("*").eq("id",tid).maybeSingle();if(tr.error)throw tr.error;if(!tr.data)return J({success:false,error:"Viaggio non trovato"},404);
   const bs=await sb.from("prenotazioni").select("id,cliente,cliente_nome,telefono,posti,totale,pagato,stato,fermata_partenza,posti_selezionati,riserva_aziendale,created_at").eq("viaggio_id",tid).limit(2000);if(bs.error)throw bs.error;
   const list=(bs.data||[]).filter(b=>!b.riserva_aziendale&&!/annull|cancel|eliminat/i.test(T(b.stato)));
   const ps=await sb.from("prenotazione_posti").select("prenotazione_id,posto").eq("viaggio_id",tid).limit(6000);if(ps.error)throw ps.error;
   let bus="";const bid=tr.data.autobus_id;if(bid){const f=await sb.from("flotta").select("titolo,marca,modello,targa").eq("id",bid).maybeSingle();if(f.data)bus=(f.data.titolo||[f.data.marca,f.data.modello].filter(Boolean).join(" "))+(f.data.targa?" "+f.data.targa:"")}
   const bytes=await paymentsPdf(tr.data,list,ps.data||[],bus,scope);
   const slug=tripName(tr.data).replace(/[^a-zA-Z0-9_-]+/g,"_");
   return await store("riepiloghi-pagamenti/"+tid+"-"+scope+".pdf",bytes,"DELGROSSO_"+(scope==="all"?"Riepilogo_pagamenti_":"Da_incassare_")+slug+"_"+T(tr.data.data_partenza)+".pdf");
  }
  const id=T(body.bookingId);
  if(!UUID.test(id))return J({success:false,error:"ID non valido"},400);
  const br=await sb.from("prenotazioni").select("*").eq("id",id).maybeSingle();
  if(br.error)throw br.error;if(!br.data)return J({success:false,error:"Prenotazione non trovata"},404);
  const b=br.data;
  if(b.riserva_aziendale||/annull|cancel|storn|rimbors/i.test(T(b.stato)))return J({success:false,error:"Prenotazione annullata: nessuna conferma da emettere"},400);
  const tr=await sb.from("viaggi").select("*").eq("id",b.viaggio_id).maybeSingle();
  if(tr.error)throw tr.error;
  const ps=await sb.from("prenotazione_posti").select("posto").eq("prenotazione_id",id);
  const pg=await sb.from("pagamenti").select("tipo,importo,metodo,metodo_pagamento,data_pagamento").eq("prenotazione_id",id).order("data_pagamento",{ascending:true});
  const r=await bookingPdf(b,tr.data||{},ps.data||[],pg.data||[]);
  return await store("whatsapp-conferme/"+id+".pdf",r.bytes,"DELGROSSO_Prenotazione_"+r.num.replace(/[^a-zA-Z0-9_-]/g,"_")+".pdf",{status:r.confirmed?"confirmed":"pending"});
 }catch(e){console.error("dg67-booking-pdf",e);return J({success:false,error:e instanceof Error?e.message:String(e)},500)}
});
