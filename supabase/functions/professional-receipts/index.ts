import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

const H={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8"};
const J=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:H});
const T=(v,f="")=>String(v??f).trim(), N=v=>Number(v||0)||0;
const sign=p=>T(p.tipo).toLowerCase()==="rimborso"?-Math.abs(N(p.importo)):Math.abs(N(p.importo));
const EUR=v=>"EUR "+Math.abs(N(v)).toLocaleString("it-IT",{minimumFractionDigits:2,maximumFractionDigits:2});
const D=v=>{if(!v)return "-";try{return new Intl.DateTimeFormat("it-IT",{timeZone:"Europe/Rome",day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date(String(v).slice(0,10)+"T12:00:00Z"))}catch{return String(v)}};
const F=v=>T(v,"ricevuta").replace(/[^A-Za-z0-9._-]+/g,"_");
function secret(){try{const r=Deno.env.get("SUPABASE_SECRET_KEYS");if(r){const x=JSON.parse(r);if(x?.default)return x.default}}catch{}return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||""}
const sb=createClient(Deno.env.get("SUPABASE_URL")||"",secret(),{auth:{persistSession:false,autoRefreshToken:false}});

async function operator(req){
  const token=T(req.headers.get("Authorization")).replace(/^Bearer\s+/i,"");
  if(!token)throw new Error("Sessione mancante");
  const u=await sb.auth.getUser(token); if(u.error||!u.data.user)throw new Error("Sessione non valida");
  const q=await sb.from("operatori_gestionale").select("user_id,nome,ruolo").eq("user_id",u.data.user.id).eq("attivo",true).maybeSingle();
  if(q.error)throw q.error;if(!q.data)throw new Error("Operatore non autorizzato");return q.data;
}
function wrap(font,size,value,max){
  const words=T(value,"-").replace(/\s+/g," ").split(" "),out=[];let line="";
  for(const w of words){const n=line?line+" "+w:w;if(font.widthOfTextAtSize(n,size)<=max)line=n;else{if(line)out.push(line);line=w}}
  if(line)out.push(line);return out.length?out:["-"];
}
async function pdf(c){
  const doc=await PDFDocument.create(),page=doc.addPage([595.28,841.89]),W=page.getWidth(),Hh=page.getHeight();
  doc.setTitle(c.title+" "+c.number);doc.setAuthor("DELGROSSO VIAGGI & LIMOUSINE BUS");doc.setSubject("Documento gestionale di pagamento - non fiscale");doc.setCreator("DELGROSSO Gestionale 7.4");
  const reg=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
  const navy=rgb(.035,.153,.267),blue=rgb(.055,.36,.68),gold=rgb(.90,.64,.15),ink=rgb(.09,.15,.22),muted=rgb(.36,.43,.50),line=rgb(.86,.89,.92),soft=rgb(.96,.975,.99),white=rgb(1,1,1);
  page.drawRectangle({x:0,y:Hh-132,width:W,height:132,color:navy});page.drawRectangle({x:0,y:Hh-137,width:W,height:5,color:gold});
  page.drawText("DELGROSSO",{x:42,y:Hh-63,size:26,font:bold,color:white});page.drawText("VIAGGI & LIMOUSINE BUS",{x:42,y:Hh-84,size:10,font:bold,color:rgb(.84,.91,.97)});
  page.drawText(c.title,{x:42,y:Hh-116,size:15,font:bold,color:white});page.drawText(c.number,{x:W-205,y:Hh-62,size:11,font:bold,color:white});
  page.drawText("Data operazione: "+D(c.date),{x:W-205,y:Hh-82,size:9,font:reg,color:rgb(.84,.91,.97)});
  page.drawText("DOCUMENTO GESTIONALE DI PAGAMENTO - NON FISCALE",{x:W-300,y:Hh-108,size:7.6,font:bold,color:rgb(.96,.83,.48)});
  let y=Hh-178;
  const row=(lab,val)=>{page.drawText(lab.toUpperCase(),{x:42,y,size:7.5,font:bold,color:muted});for(const s of wrap(bold,10.5,val,460)){y-=15;page.drawText(s,{x:42,y,size:10.5,font:bold,color:ink})}y-=13;page.drawLine({start:{x:42,y},end:{x:W-42,y},thickness:.7,color:line});y-=17};
  row("Cliente / intestatario",c.client);row(c.kind==="rental"?"Noleggio / servizio":"Viaggio / servizio",c.service);row("Riferimento pratica",c.reference);
  page.drawRectangle({x:42,y:y-92,width:W-84,height:92,color:soft,borderColor:line,borderWidth:1});
  page.drawText(c.refund?"IMPORTO RIMBORSATO":"IMPORTO RICEVUTO",{x:62,y:y-28,size:8,font:bold,color:muted});page.drawText(EUR(c.amount),{x:62,y:y-58,size:25,font:bold,color:blue});
  page.drawText("Metodo: "+c.method,{x:W-240,y:y-29,size:9,font:bold,color:ink});page.drawText("Operatore: "+c.operator,{x:W-240,y:y-49,size:9,font:reg,color:ink});page.drawText("Movimento: "+c.type,{x:W-240,y:y-69,size:9,font:reg,color:ink});y-=120;
  page.drawText("SITUAZIONE DELLA PRATICA DOPO QUESTO MOVIMENTO",{x:42,y,size:9,font:bold,color:navy});y-=20;
  const cols=[["Totale pratica",EUR(c.total)],[c.refund?"Pagato prima rimborso":"Gia pagato prima",EUR(c.before)],[c.refund?"Rimborso":"Questo pagamento",EUR(c.amount)],["Pagato dopo",EUR(c.after)],["Residuo dopo",EUR(c.balance)]],cw=(W-84)/5;
  cols.forEach((a,i)=>{const x=42+i*cw;page.drawRectangle({x,y:y-56,width:cw-5,height:56,borderColor:line,borderWidth:1,color:white});page.drawText(a[0],{x:x+7,y:y-18,size:6.7,font:bold,color:muted});page.drawText(a[1],{x:x+7,y:y-40,size:9.1,font:bold,color:ink})});y-=82;
  page.drawText("DETTAGLI",{x:42,y,size:9,font:bold,color:navy});y-=18;
  for(const a of c.details){page.drawText(a[0]+":",{x:42,y,size:8,font:bold,color:muted});for(const s of wrap(reg,8.5,a[1],390)){page.drawText(s,{x:155,y,size:8.5,font:reg,color:ink});y-=12}y-=3}
  if(c.notes){y-=4;page.drawText("NOTE",{x:42,y,size:8,font:bold,color:navy});y-=15;for(const s of wrap(reg,8.3,c.notes,500)){page.drawText(s,{x:42,y,size:8.3,font:reg,color:ink});y-=12}}
  page.drawLine({start:{x:42,y:86},end:{x:W-42,y:86},thickness:.8,color:line});page.drawText("DELGROSSO VIAGGI & LIMOUSINE BUS",{x:42,y:68,size:8.5,font:bold,color:navy});
  page.drawText("www.delgrossoviaggi.it | info@delgrossoviaggi.it | Tel./WhatsApp 366 212 7916",{x:42,y:51,size:7.4,font:reg,color:muted});
  page.drawText("ID movimento: "+String(c.id).slice(0,8).toUpperCase()+" | Template DELGROSSO 7.4",{x:42,y:35,size:6.8,font:reg,color:muted});
  page.drawText("Conservare il documento come attestazione gestionale del movimento registrato.",{x:42,y:20,size:6.8,font:reg,color:muted});
  return doc.save();
}
async function trip(id){
  const q=await sb.from("pagamenti").select("*").eq("id",id).maybeSingle();if(q.error)throw q.error;if(!q.data)throw new Error("Pagamento non trovato");const p=q.data;
  let b=null,v=null,op=p.incassato_da||"";
  if(p.prenotazione_id){const x=await sb.from("prenotazioni").select("*").eq("id",p.prenotazione_id).maybeSingle();if(x.error)throw x.error;b=x.data}
  const vid=p.viaggio_id||b?.viaggio_id;if(vid){const x=await sb.from("viaggi").select("*").eq("id",vid).maybeSingle();if(x.error)throw x.error;v=x.data}
  if(!op&&p.incassato_da_user_id){const x=await sb.from("operatori_gestionale").select("nome").eq("user_id",p.incassato_da_user_id).maybeSingle();op=x.data?.nome||""}
  // DG-26/11/2026: un pagamento senza prenotazione collegata (es. prenotazione cancellata
  // con incassi conservati) non deve interrogare prenotazione_id="null" (errore 22P02).
  const l=p.prenotazione_id
    ?await sb.from("pagamenti").select("id,tipo,importo,data_pagamento,created_at").eq("prenotazione_id",p.prenotazione_id).order("data_pagamento",{ascending:true}).order("created_at",{ascending:true}).order("id",{ascending:true})
    :{data:[{id:p.id,tipo:p.tipo,importo:p.importo,data_pagamento:p.data_pagamento,created_at:p.created_at}],error:null};
  if(l.error)throw l.error;
  let before=0,after=0;for(const x of l.data||[]){if(x.id===p.id){before=after;after+=sign(x);break}after+=sign(x)}
  const total=Math.max(N(b?.totale||p.totale),0),refund=T(p.tipo).toLowerCase()==="rimborso";
  return {kind:"trip",id:p.id,row:p,title:refund?"RICEVUTA DI RIMBORSO":"RICEVUTA DI PAGAMENTO",number:T(p.receipt_number||p.ricevuta,"DG-"+String(p.id).slice(0,8).toUpperCase()),date:p.data_pagamento,type:T(p.tipo,"Pagamento"),amount:Math.abs(N(p.importo)),refund,client:T(p.cliente||b?.cliente||b?.cliente_nome,"Cliente"),service:T(v?.titolo||v?.destinazione||p.viaggio,"Viaggio"),reference:T(b?.id_prenotazione||b?.confirmation_number||b?.codice,p.prenotazione_id||"-"),method:T(p.metodo_pagamento||p.metodo,"-"),operator:T(op,"-"),total,before:Math.max(before,0),after:Math.max(after,0),balance:Math.max(total-after,0),notes:T(p.note),details:[["Data viaggio",D(v?.data_partenza)],["Partenza",T(b?.fermata_partenza||v?.luogo_partenza,"-")],["Persone",String(b?.posti||p.persone||"-")],["Posti",T(b?.posti_selezionati,"-")]]};
}
async function rental(id){
  const q=await sb.from("noleggi_bus_pagamenti").select("*").eq("id",id).maybeSingle();if(q.error)throw q.error;if(!q.data)throw new Error("Pagamento noleggio non trovato");const p=q.data;
  const r=await sb.from("noleggi_bus").select("*").eq("id",p.noleggio_id).maybeSingle();if(r.error)throw r.error;if(!r.data)throw new Error("Noleggio non trovato");let op=p.incassato_da||"";
  if(!op&&p.incassato_da_user_id){const x=await sb.from("operatori_gestionale").select("nome").eq("user_id",p.incassato_da_user_id).maybeSingle();op=x.data?.nome||""}
  const l=await sb.from("noleggi_bus_pagamenti").select("id,tipo,importo,data_pagamento,created_at").eq("noleggio_id",p.noleggio_id).order("data_pagamento",{ascending:true}).order("created_at",{ascending:true}).order("id",{ascending:true});if(l.error)throw l.error;
  let before=0,after=0;for(const x of l.data||[]){if(x.id===p.id){before=after;after+=sign(x);break}after+=sign(x)}
  const total=Math.max(N(r.data.prezzo_concordato),0),refund=T(p.tipo).toLowerCase()==="rimborso";
  return {kind:"rental",id:p.id,row:p,title:refund?"RICEVUTA DI RIMBORSO NOLEGGIO":"RICEVUTA PAGAMENTO NOLEGGIO",number:T(p.receipt_number,"DG-NB-"+String(p.id).slice(0,8).toUpperCase()),date:p.data_pagamento,type:T(p.tipo,"Pagamento"),amount:Math.abs(N(p.importo)),refund,client:T(r.data.referente||r.data.azienda,"Cliente noleggio"),service:T(r.data.tratta_partenza,"-")+" - "+T(r.data.tratta_destinazione,"-"),reference:T(r.data.id_noleggio,p.noleggio_id),method:T(p.metodo,"-"),operator:T(op,"-"),total,before:Math.max(before,0),after:Math.max(after,0),balance:Math.max(total-after,0),notes:T(p.note),details:[["Data servizio",D(r.data.data_partenza)],["Passeggeri",String(r.data.passeggeri||"-")],["Tipo servizio",T(r.data.servizio_tipo,"-")]]};
}
async function generate(kind,id,reissue=false,operatorId=null){
  const c=kind==="rental"?await rental(id):await trip(id);
  const vr=await sb.from("ricevute_versioni").select("id",{count:"exact",head:true}).eq("kind",kind).eq("payment_id",id);
  if(vr.error)throw vr.error;
  const versionNo=(vr.count||0)+1, suffix=versionNo>1?"-V"+versionNo:"";
  const bytes=await pdf(c),year=String(c.date||new Date().getFullYear()).slice(0,4),path="professionali/"+(kind==="rental"?"noleggi":"viaggi")+"/"+year+"/"+F(c.number)+suffix+".pdf";
  const up=await sb.storage.from("ricevute-prenotazioni").upload(path,bytes,{contentType:"application/pdf",cacheControl:"0",upsert:false});if(up.error)throw up.error;
  const now=new Date().toISOString(),patch={receipt_professional_path:path,receipt_professional_generated_at:now,receipt_template_version:"7.4",receipt_reissue_count:Math.max(versionNo-1,0)};
  if(versionNo>1)patch.receipt_last_reissued_at=now;
  if(kind==="rental"){
    if(!c.row.receipt_path){patch.receipt_path=path;patch.receipt_generated_at=now;}
    const u=await sb.from("noleggi_bus_pagamenti").update(patch).eq("id",id);if(u.error)throw u.error;
  }else{
    if(!c.row.receipt_storage_path){patch.receipt_storage_path=path;patch.receipt_generated_at=now;}
    const u=await sb.from("pagamenti").update(patch).eq("id",id);if(u.error)throw u.error;
  }
  const h=await sb.from("ricevute_versioni").insert({kind,payment_id:id,receipt_number:c.number,template_version:"7.4",storage_path:path,source:"professional",generated_at:now,created_by:operatorId});
  if(h.error)throw h.error;
  const s=await sb.storage.from("ricevute-prenotazioni").createSignedUrl(path,1800);if(s.error)throw s.error;
  return {success:true,kind,id,path,signedUrl:s.data.signedUrl,receiptNumber:c.number,template:"7.4",version:versionNo};
}
Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:H});if(req.method!=="POST")return J({success:false,error:"Metodo non consentito"},405);
  try{
    const op=await operator(req),p=await req.json(),action=T(p.action,"generate"),kind=p.kind==="rental"?"rental":"trip",id=T(p.id);
    if(action==="status"){const a=await sb.from("pagamenti").select("id,receipt_professional_path,receipt_template_version"),b=await sb.from("noleggi_bus_pagamenti").select("id,receipt_professional_path,receipt_template_version");if(a.error)throw a.error;if(b.error)throw b.error;const all=[...(a.data||[]),...(b.data||[])];return J({success:true,total:all.length,professional:all.filter(x=>x.receipt_professional_path&&x.receipt_template_version==="7.4").length})}
    if(action==="generate"){if(!id)return J({success:false,error:"ID ricevuta mancante"},400);return J(await generate(kind,id,Boolean(p.reissue),op.user_id))}
    if(action==="batch"){if(op.ruolo!=="admin")return J({success:false,error:"Operazione riservata all amministratore"},403);const a=await sb.from("pagamenti").select("id,receipt_professional_path,receipt_template_version").order("data_pagamento"),b=await sb.from("noleggi_bus_pagamenti").select("id,receipt_professional_path,receipt_template_version").order("data_pagamento");if(a.error)throw a.error;if(b.error)throw b.error;const jobs=[...(a.data||[]).map(x=>({kind:"trip",...x})),...(b.data||[]).map(x=>({kind:"rental",...x}))].filter(x=>p.force||!x.receipt_professional_path||x.receipt_template_version!=="7.4");const results=[];for(const x of jobs){try{results.push(await generate(x.kind,x.id,Boolean(p.force),op.user_id))}catch(e){results.push({success:false,kind:x.kind,id:x.id,error:e instanceof Error?e.message:String(e)})}}return J({success:true,processed:results.length,ok:results.filter(x=>x.success).length,failed:results.filter(x=>!x.success).length,results})}
    return J({success:false,error:"Azione non supportata"},400);
  }catch(e){console.error("professional-receipts",e);return J({success:false,error:e instanceof Error?e.message:String(e)},500)}
});
