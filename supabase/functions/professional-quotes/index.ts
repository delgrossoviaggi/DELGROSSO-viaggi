import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import { brandHeader, brandMini, useLogoStorage } from "./dg-logo.ts";

const CORS={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
  "Content-Type":"application/json; charset=utf-8"
};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:CORS});
const text=(v,f="")=>String(v??f).trim();
const num=v=>Number(v||0)||0;
const eur=v=>"EUR "+num(v).toLocaleString("it-IT",{minimumFractionDigits:2,maximumFractionDigits:2});
const safeFile=v=>text(v,"preventivo").replace(/[^A-Za-z0-9._-]+/g,"_");
const dateIT=v=>{
  if(!v)return "-";
  try{return new Intl.DateTimeFormat("it-IT",{timeZone:"Europe/Rome",day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date(String(v).slice(0,10)+"T12:00:00Z"))}
  catch{return String(v)}
};
function secretKey(){
  try{
    const raw=Deno.env.get("SUPABASE_SECRET_KEYS");
    if(raw){const obj=JSON.parse(raw);if(obj?.default)return obj.default}
  }catch{}
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
}
const admin=createClient(Deno.env.get("SUPABASE_URL")||"",secretKey(),{auth:{persistSession:false,autoRefreshToken:false}});
useLogoStorage(admin);

async function requireOperator(req){
  const token=text(req.headers.get("Authorization")).replace(/^Bearer\s+/i,"");
  if(!token)throw new Error("Sessione mancante");
  const u=await admin.auth.getUser(token);
  if(u.error||!u.data.user)throw new Error("Sessione non valida");
  const op=await admin.from("operatori_gestionale").select("user_id,nome,ruolo").eq("user_id",u.data.user.id).eq("attivo",true).maybeSingle();
  if(op.error)throw op.error;
  if(!op.data)throw new Error("Operatore non autorizzato");
  return op.data;
}

function wrap(font,size,value,maxWidth){
  const paragraphs=text(value,"-").replace(/\r/g,"").split("\n");
  const out=[];
  for(const para of paragraphs){
    const words=(para||" ").trim().split(/\s+/);
    let line="";
    for(const w of words){
      const next=line?line+" "+w:w;
      if(font.widthOfTextAtSize(next,size)<=maxWidth)line=next;
      else{
        if(line)out.push(line);
        if(font.widthOfTextAtSize(w,size)<=maxWidth)line=w;
        else{
          let part="";
          for(const ch of w){
            const cand=part+ch;
            if(font.widthOfTextAtSize(cand,size)<=maxWidth)part=cand;
            else{if(part)out.push(part);part=ch}
          }
          line=part;
        }
      }
    }
    if(line)out.push(line);
    if(paragraphs.length>1)out.push("");
  }
  while(out.length&&out[out.length-1]==="")out.pop();
  return out.length?out:["-"];
}

export async function buildPdf(q,number,version){
  const doc=await PDFDocument.create();
  doc.setTitle("Preventivo "+number);
  doc.setAuthor("DELGROSSO VIAGGI & LIMOUSINE BUS");
  doc.setSubject("Preventivo commerciale - documento non fiscale");
  doc.setCreator("DELGROSSO Gestionale 7.5");
  const reg=await doc.embedFont(StandardFonts.Helvetica);
  const bold=await doc.embedFont(StandardFonts.HelveticaBold);
  const navy=rgb(.03,.12,.21),blue=rgb(.04,.34,.64),gold=rgb(.91,.65,.16),ink=rgb(.08,.14,.21),muted=rgb(.38,.44,.51),line=rgb(.86,.89,.92),soft=rgb(.96,.98,1),white=rgb(1,1,1),green=rgb(.04,.48,.30);

  let page,y;
  const W=595.28,H=841.89,LM=42,RM=42,CW=W-LM-RM;
  // Intestazioni con il solo logo ufficiale DELGROSSO Viaggi - limousineBUS.
  const newPage=async(continuation=false)=>{
    page=doc.addPage([W,H]);
    if(!continuation){
      y=await brandHeader(doc,page,reg,bold,{title:"PREVENTIVO",lines:[
        {text:number,bold:true,size:11},
        {text:"Emissione: "+dateIT(q.data_redazione||q.issued_at||new Date().toISOString()),color:muted},
        {text:"Validita: "+dateIT(q.validita_preventivo),color:muted}
      ],note:"DOCUMENTO COMMERCIALE - NON FISCALE"});
    }else{
      y=await brandMini(doc,page,reg,"Preventivo "+number+" - Pagina "+doc.getPageCount());
    }
  };
  const need=async h=>{if(y-h<82)await newPage(true)};
  const rule=()=>{page.drawLine({start:{x:LM,y},end:{x:W-RM,y},thickness:.7,color:line});y-=15};
  const labelValue=async(label,value)=>{
    const lines=wrap(bold,10.2,value,CW);
    await need(22+lines.length*14);
    page.drawText(label.toUpperCase(),{x:LM,y,size:7.4,font:bold,color:muted});y-=16;
    for(const s of lines){page.drawText(s,{x:LM,y,size:10.2,font:bold,color:ink});y-=14}
    y-=6;rule();
  };
  const section=async(title,value)=>{
    if(!text(value))return;
    let lines=wrap(reg,9.2,value,CW-24),first=true;
    while(lines.length){
      await need(42+Math.min(lines.length,3)*13);
      const fit=Math.max(1,Math.min(lines.length,Math.floor((y-82-(first?15:0)-31)/13)));
      const part=lines.slice(0,fit);lines=lines.slice(fit);
      if(first){page.drawText(title.toUpperCase(),{x:LM,y,size:9,font:bold,color:navy});y-=15;first=false}
      page.drawRectangle({x:LM,y:y-(part.length*13+18),width:CW,height:part.length*13+18,color:soft,borderColor:line,borderWidth:.8});
      let yy=y-16;
      for(const s of part){page.drawText(s,{x:LM+12,y:yy,size:9.2,font:reg,color:ink});yy-=13}
      y-=part.length*13+31;
      if(lines.length)await newPage(true);
    }
  };

  await newPage(false);
  const client=[q.nome,q.cognome].filter(Boolean).join(" ")||q.azienda||"Cliente";
  await labelValue("Cliente / intestatario",q.azienda?client+" - "+q.azienda:client);
  await labelValue("Servizio richiesto",q.servizio||q.servizio_richiesto||"Servizio di trasporto");
  await labelValue("Tratta",text(q.luogo_partenza||q.partenza,"-")+" -> "+text(q.destinazione,"-"));

  await need(102);
  page.drawRectangle({x:LM,y:y-84,width:CW,height:84,color:soft,borderColor:line,borderWidth:1});
  const cols=[
    ["Data servizio",dateIT(q.data_viaggio||q.data_partenza)],
    ["Ritorno",dateIT(q.data_ritorno)],
    ["Passeggeri",String(q.numero_passeggeri||q.passeggeri||"-")]
  ];
  const colW=CW/3;
  cols.forEach((a,i)=>{
    const x=LM+i*colW+12;
    page.drawText(a[0].toUpperCase(),{x,y:y-24,size:7,font:bold,color:muted});
    page.drawText(a[1],{x,y:y-48,size:10,font:bold,color:ink});
  });
  y-=106;

  await need(128);
  page.drawText("PROPOSTA ECONOMICA",{x:LM,y,size:9,font:bold,color:navy});y-=16;
  page.drawRectangle({x:LM,y:y-84,width:CW,height:84,color:navy});
  page.drawText("IMPORTO COMPLESSIVO PROPOSTO",{x:LM+18,y:y-26,size:8,font:bold,color:rgb(.80,.89,.96)});
  page.drawText(eur(q.importo_preventivo??q.importo),{x:LM+18,y:y-60,size:27,font:bold,color:white});
  if(num(q.acconto_richiesto)>0){
    page.drawText("Acconto richiesto: "+eur(q.acconto_richiesto),{x:W-238,y:y-50,size:9.2,font:bold,color:rgb(.96,.83,.48)});
  }
  y-=106;

  await section("Dettagli dell'offerta",q.dettagli_offerta||q.note_cliente);
  await section("Incluso nell'offerta",q.inclusioni_offerta);
  await section("Non incluso",q.esclusioni_offerta);
  await section("Condizioni commerciali",q.condizioni_offerta||"Offerta soggetta a disponibilita al momento della conferma. Eventuali variazioni di data, tratta, orari, numero passeggeri o servizi richiesti possono comportare un ricalcolo del preventivo. La prenotazione si intende confermata solo secondo le condizioni concordate con DELGROSSO VIAGGI.");

  await need(116);
  page.drawRectangle({x:LM,y:y-82,width:CW,height:82,borderColor:line,borderWidth:1,color:white});
  page.drawText("PER ACCETTAZIONE",{x:LM+14,y:y-20,size:8.5,font:bold,color:navy});
  page.drawText("Data ____________________",{x:LM+14,y:y-51,size:8.5,font:reg,color:ink});
  page.drawText("Firma / timbro __________________________________________",{x:LM+205,y:y-51,size:8.5,font:reg,color:ink});
  y-=104;

  await need(72);
  page.drawLine({start:{x:LM,y:73},end:{x:W-RM,y:73},thickness:.8,color:line});
  page.drawText("DELGROSSO VIAGGI & LIMOUSINE BUS",{x:LM,y:57,size:8.5,font:bold,color:navy});
  page.drawText("www.delgrossoviaggi.it | info@delgrossoviaggi.it | Tel./WhatsApp 366 212 7916",{x:LM,y:41,size:7.3,font:reg,color:muted});
  page.drawText("Preventivo "+number+" | Template DELGROSSO 7.5 | Versione "+version,{x:LM,y:27,size:6.9,font:reg,color:muted});
  page.drawText("Documento commerciale non fiscale. Conservare come riferimento dell'offerta emessa.",{x:LM,y:14,size:6.7,font:reg,color:muted});

  return doc.save();
}

async function getQuote(id){
  const q=await admin.from("preventivi").select("*").eq("id",id).maybeSingle();
  if(q.error)throw q.error;
  if(!q.data)throw new Error("Preventivo non trovato");
  return q.data;
}

async function issueNumber(q){
  if(/^DG-PV-\d{4}-\d{6}$/i.test(text(q.numero_preventivo)))return q.numero_preventivo;
  const n=await admin.rpc("dg_next_quote_number",{p_date:q.data_creazione||q.created_at||new Date().toISOString().slice(0,10)});
  if(n.error)throw n.error;
  const number=n.data;
  const up=await admin.from("preventivi").update({numero_preventivo:number,codice:number,issued_at:q.issued_at||new Date().toISOString()}).eq("id",q.id);
  if(up.error)throw up.error;
  return number;
}

async function generate(id,operatorId){
  let q=await getQuote(id);
  if(num(q.importo_preventivo??q.importo)<=0)throw new Error("Inserisci un importo maggiore di zero prima di emettere il PDF");
  if(!text(q.destinazione))throw new Error("Inserisci la destinazione prima di emettere il PDF");
  if(!text(q.nome)&&!text(q.azienda))throw new Error("Inserisci il cliente prima di emettere il PDF");

  const number=await issueNumber(q);
  q=await getQuote(id);

  const versions=await admin.from("preventivi_versioni").select("id",{head:true,count:"exact"}).eq("preventivo_id",id);
  if(versions.error)throw versions.error;
  const version=(versions.count||0)+1;
  const year=(q.data_creazione||q.created_at||new Date().toISOString()).slice(0,4);
  const suffix=version>1?"-V"+version:"";
  const path="preventivi/"+year+"/"+safeFile(number)+suffix+".pdf";
  const bytes=await buildPdf(q,number,version);

  const up=await admin.storage.from("preventivi-pdf").upload(path,bytes,{contentType:"application/pdf",cacheControl:"0",upsert:false});
  if(up.error)throw up.error;

  const now=new Date().toISOString();
  const patch={
    pdf_professional_path:path,
    pdf_generated_at:now,
    pdf_template_version:"7.5",
    pdf_reissue_count:Math.max(version-1,0),
    pdf_last_reissued_at:version>1?now:q.pdf_last_reissued_at,
    issued_at:q.issued_at||now
  };
  const u=await admin.from("preventivi").update(patch).eq("id",id);
  if(u.error)throw u.error;

  const h=await admin.from("preventivi_versioni").insert({
    preventivo_id:id,numero_preventivo:number,template_version:"7.5",
    storage_path:path,generated_at:now,created_by:operatorId
  });
  if(h.error)throw h.error;

  const signed=await admin.storage.from("preventivi-pdf").createSignedUrl(path,1800);
  if(signed.error)throw signed.error;
  return {success:true,id,number,version,path,signedUrl:signed.data.signedUrl,template:"7.5"};
}

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
  if(req.method!=="POST")return json({success:false,error:"Metodo non consentito"},405);
  try{
    const op=await requireOperator(req);
    const body=await req.json();
    const action=text(body.action,"generate");
    if(action==="generate"){
      const id=text(body.id);
      if(!id)return json({success:false,error:"ID preventivo mancante"},400);
      return json(await generate(id,op.user_id));
    }
    if(action==="status"){
      const q=await admin.from("preventivi").select("id,pdf_professional_path,pdf_template_version");
      if(q.error)throw q.error;
      const rows=q.data||[];
      return json({success:true,total:rows.length,professional:rows.filter(x=>x.pdf_professional_path&&x.pdf_template_version==="7.5").length});
    }
    return json({success:false,error:"Azione non supportata"},400);
  }catch(e){
    console.error("professional-quotes",e);
    return json({success:false,error:e instanceof Error?e.message:String(e)},500);
  }
});
