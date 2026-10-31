import nodemailer from "npm:nodemailer";
import { createClient } from "npm:@supabase/supabase-js@2";

type R=Record<string,any>;
const url=Deno.env.get("SUPABASE_URL")||"";
const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const sb=createClient(url,key);
const H={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8"};
const J=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:H});
const T=(v:unknown,f="")=>String(v??f).trim();
const validEmail=(v:unknown):v is string=>typeof v==="string"&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

function pdfBytes(v:string){
  const s=T(v).replace(/^data:application\/pdf;base64,/i,"").replace(/\s/g,"");
  if(!s || s.length>16000000) throw new Error("PDF mancante o troppo grande");
  const b=atob(s),a=new Uint8Array(b.length);
  for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);
  return a;
}
async function operator(req:Request){
  const h=T(req.headers.get("Authorization")),token=h.replace(/^Bearer\s+/i,"");
  if(!token||token.startsWith("sb_publishable_")) return false;
  const u=await sb.auth.getUser(token);
  if(u.error||!u.data.user) return false;
  const op=await sb.from("operatori_gestionale").select("user_id").eq("user_id",u.data.user.id).eq("attivo",true).maybeSingle();
  return !op.error&&!!op.data;
}
async function bookingByRef(ref:string){
  const x=T(ref); if(!x)return null;
  if(/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(x)){
    const q=await sb.from("prenotazioni").select("*").eq("id",x).maybeSingle();
    if(q.error)throw q.error;if(q.data)return q.data;
  }
  for(const col of ["id_prenotazione","confirmation_number","codice"]){
    const q=await sb.from("prenotazioni").select("*").eq(col,x).maybeSingle();
    if(q.error)throw q.error;if(q.data)return q.data;
  }
  return null;
}
async function bookingByPath(path:string){
  const x=T(path);if(!x)return null;
  const q=await sb.from("prenotazioni").select("*").eq("confirmation_storage_path",x).maybeSingle();
  if(q.error)throw q.error;return q.data||null;
}
async function trip(id:string){
  if(!id)return null;
  const q=await sb.from("viaggi").select("*").eq("id",id).maybeSingle();
  if(q.error)throw q.error;return q.data||null;
}
async function smtp(){
  const q=await sb.from("impostazioni").select("smtp_host,smtp_port,smtp_secure,smtp_username,smtp_password,smtp_from_name,smtp_from_email,smtp_reply_to").order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(q.error)throw q.error;const s=q.data||{};
  return {host:T(s.smtp_host,"smtps.aruba.it"),port:Number(s.smtp_port||465),secure:s.smtp_secure!==false,user:T(s.smtp_username,"prenotazioni@delgrossoviaggi.it"),pass:T(s.smtp_password),fromName:T(s.smtp_from_name,"PRENOTAZIONI DELGROSSO VIAGGI"),fromEmail:T(s.smtp_from_email,"prenotazioni@delgrossoviaggi.it"),replyTo:T(s.smtp_reply_to,"prenotazioni@delgrossoviaggi.it")};
}
function fresh(b:R,minutes=20){
  const ms=Date.now()-new Date(b.created_at||0).getTime();
  return Number.isFinite(ms)&&ms>=0&&ms<=minutes*60000;
}
function tokenOK(b:R,p:R){
  const supplied=T(p.token||p.confirmation_token||p.booking?.confirmation_token);
  return !!supplied && !!b.confirmation_token && supplied===T(b.confirmation_token);
}
async function sendMail(b:R,tr:R,path:string,number:string){
  if(!validEmail(b.email))return {sent:false,error:null};
  const s=await smtp();if(!s.pass)throw new Error("Password SMTP non configurata");
  const f=await sb.storage.from("ricevute-prenotazioni").download(path);if(f.error)throw f.error;
  const tx=nodemailer.createTransport({host:s.host,port:s.port,secure:s.secure,auth:{user:s.user,pass:s.pass}});
  const nome=T(b.cliente_nome||b.cliente,"Cliente"),dest=T(tr?.destinazione||tr?.titolo||b.viaggio_codice,"—");
  await tx.sendMail({from:{name:s.fromName,address:s.fromEmail},to:T(b.email),replyTo:s.replyTo,subject:`Conferma prenotazione ${number} - Del Grosso Viaggi`,text:`Buongiorno ${nome},\n\nla tua prenotazione è stata registrata correttamente.\n\nViaggio: ${dest}\nNumero prenotazione: ${number}\n\nIn allegato trovi la conferma di prenotazione da conservare e presentare al check-in.\n\nDel Grosso Viaggi & Limousine Bus`,attachments:[{filename:`Conferma_Prenotazione_${number}.pdf`,content:new Uint8Array(await f.data.arrayBuffer()),contentType:"application/pdf"}]});
  return {sent:true,error:null};
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:H});
  if(req.method!=="POST")return J({success:false,error:"Metodo non consentito"},405);
  try{
    const p=await req.json() as R;
    const ref=T(p.bookingId||p.id_prenotazione||p.booking?.id||p.booking?.id_prenotazione||p.booking?.confirmation_number||p.booking?.codice);
    let b=await bookingByRef(ref);
    if(!b && p.action==="signed_url")b=await bookingByPath(T(p.path));
    if(!b)return J({success:false,error:"Prenotazione non trovata"},404);

    const op=await operator(req),tok=tokenOK(b,p);
    const tr=await trip(T(b.viaggio_id));
    const number=T(b.id_prenotazione||b.confirmation_number||b.codice,`DG-P-${String(b.id).replace(/-/g,"").slice(0,8).toUpperCase()}`);

    if(p.action==="context"){
      if(!(op||tok))return J({success:false,error:"Non autorizzato"},403);
      return J({success:true,booking:b,trip:tr||{}});
    }
    if(p.action==="signed_url"){
      if(!(op||tok))return J({success:false,error:"Non autorizzato"},403);
      const path=T(b.confirmation_storage_path);
      if(!path)return J({success:false,error:"PDF non archiviato"},404);
      const q=await sb.storage.from("ricevute-prenotazioni").createSignedUrl(path,3600);
      if(q.error)throw q.error;return J({success:true,signedUrl:q.data.signedUrl});
    }
    if(p.action==="resend_email"){
      if(!op)return J({success:false,error:"Reinvio riservato agli operatori"},403);
      const path=T(b.confirmation_storage_path);
      if(!path)return J({success:false,error:"PDF non archiviato"},400);
      let emailSent=false,emailError:string|null=null;
      try{
        const m=await sendMail(b,tr||{},path,number);
        emailSent=m.sent;emailError=m.error||null;
      }catch(e){emailError=e instanceof Error?e.message:String(e);}
      const now=new Date().toISOString();
      const u=await sb.from("prenotazioni").update({confirmation_email_sent:emailSent,confirmation_email_sent_at:emailSent?now:null,confirmation_email_error:emailError}).eq("id",b.id);
      if(u.error)throw u.error;
      if(!emailSent)return J({success:false,emailSent:false,error:emailError||"Email non inviata",confirmationNumber:number},503);
      return J({success:true,emailSent:true,confirmationNumber:number,idPrenotazione:number});
    }

    if(!(op||tok))return J({success:false,error:"Non autorizzato"},403);
    if(!p.pdfBase64)return J({success:false,error:"PDF della prenotazione mancante"},400);

    if(b.confirmation_storage_path)return J({success:false,error:"Conferma già archiviata: usare il documento esistente"},409);
    const pdf=pdfBytes(T(p.pdfBase64)),path=`conferme/${number}.pdf`;
    if(pdf.length<100||pdf.length>5000000||pdf[0]!==37||pdf[1]!==80||pdf[2]!==68||pdf[3]!==70||pdf[4]!==45)return J({success:false,error:"Il file non è un PDF valido o supera 5 MB"},400);
    const up=await sb.storage.from("ricevute-prenotazioni").upload(path,pdf,{contentType:"application/pdf",upsert:false});
    if(up.error)throw up.error;
    const now=new Date().toISOString();
    const base={id_prenotazione:number,confirmation_number:number,codice:number,confirmation_storage_path:path,confirmation_generated_at:now,confirmation_email_sent:false,confirmation_email_sent_at:null,confirmation_email_error:null};
    const u=await sb.from("prenotazioni").update(base).eq("id",b.id);if(u.error)throw u.error;

    let emailSent=false,emailError:string|null=null;
    if(validEmail(b.email)){
      try{const m=await sendMail(b,tr||{},path,number);emailSent=m.sent;emailError=m.error||null}catch(e){emailError=e instanceof Error?e.message:String(e)}
    }
    const fin=await sb.from("prenotazioni").update({confirmation_email_sent:emailSent,confirmation_email_sent_at:emailSent?new Date().toISOString():null,confirmation_email_error:emailError}).eq("id",b.id);
    if(fin.error)throw fin.error;
    let signedUrl:string|null=null;
    try{const q=await sb.storage.from("ricevute-prenotazioni").createSignedUrl(path,3600);if(!q.error)signedUrl=q.data.signedUrl}catch{}
    return J({success:true,storedPath:path,confirmationNumber:number,idPrenotazione:number,emailSent,signedUrl,error:emailError});
  }catch(e){
    console.error("send-booking-confirmation",e);
    return J({success:false,error:e instanceof Error?e.message:String(e)},500);
  }
});