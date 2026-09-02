import nodemailer from 'npm:nodemailer'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}})
const text=(v:unknown,f='')=>String(v??f).trim()
const supabaseUrl=Deno.env.get('SUPABASE_URL')||''
const serviceRole=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
const supabase=createClient(supabaseUrl,serviceRole)
const bytesFromBase64=(pdf:string)=>{const b=pdf.replace(/^data:application\/pdf;base64,/i,'').replace(/\s/g,'');const bin=atob(b);const out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out}
const customerName=(b:any)=>text(b?.cliente_nome||b?.cliente||`${b?.nome||''} ${b?.cognome||''}`,'Cliente')
const code=(b:any)=>text(b?.codice||b?.id,'prenotazione')
const receiptNumber=(b:any)=>text(b?.confirmation_number,`DG-CONF-${String(b?.created_at||new Date().toISOString()).slice(0,4)}-${String(b?.id||crypto.randomUUID()).replace(/[^a-zA-Z0-9]/g,'').slice(0,8).toUpperCase()}`)
const smtp=async()=>{const rr=await fetch(`${supabaseUrl}/rest/v1/impostazioni?select=*&order=created_at.desc&limit=1`,{headers:{apikey:serviceRole,Authorization:`Bearer ${serviceRole}`}});if(!rr.ok)throw Error(`Impossibile leggere le impostazioni SMTP (${rr.status}).`);const st=(await rr.json())?.[0]||{},c=st.comunicazione||{};return{host:text(c.smtpHost,'smtps.aruba.it'),port:Number(c.smtpPort||465),secure:c.smtpSecure!==false,user:text(c.smtpUsername,'prenotazioni@delgrossoviaggi.it'),pass:text(c.smtpPassword),from:text(c.smtpFromEmail,c.smtpUsername||'prenotazioni@delgrossoviaggi.it'),fromName:text(c.smtpFromName,'Del Grosso Viaggi'),replyTo:text(c.smtpReplyTo,c.smtpFromEmail||c.smtpUsername||'prenotazioni@delgrossoviaggi.it')}}
const signed=async(path:string)=>{const r=await supabase.storage.from('ricevute-prenotazioni').createSignedUrl(path,60*60*24*30);if(r.error)throw r.error;return r.data?.signedUrl||null}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  if(req.method!=='POST')return json({success:false,error:'Method not allowed'},405)
  try{
    const p=await req.json(), action=text(p?.action,'issue'), b=p?.booking||{}, trip=p?.trip||{}
    if(!supabaseUrl||!serviceRole)throw Error('Supabase function non configurata.')
    if(action==='signed_url'){
      const path=text(p?.path); if(!path) return json({success:false,error:'Percorso conferma mancante.'},400)
      return json({success:true,signedUrl:await signed(path)})
    }
    if(action==='context'){
      const bookingId=text(p?.bookingId); if(!bookingId)return json({success:false,error:'ID prenotazione mancante.'},400)
      const br=await supabase.from('prenotazioni').select('*').eq('id',bookingId).maybeSingle(); if(br.error)throw br.error; if(!br.data)return json({success:false,error:'Prenotazione non trovata.'},404)
      let trip=null; if(br.data.viaggio_id){const tr=await supabase.from('viaggi').select('*').eq('id',br.data.viaggio_id).maybeSingle(); if(tr.error)throw tr.error; trip=tr.data}
      return json({success:true,booking:br.data,trip})
    }
    if(action==='resend_email'){
      if(!b?.id)return json({success:false,error:'ID prenotazione mancante.'},400)
      const path=text(b.confirmation_storage_path); if(!path)return json({success:false,error:'Conferma PDF non archiviata.'},400)
      const to=text(b.email); if(!to)return json({success:false,error:'Email partecipante mancante.'},400)
      const file=await supabase.storage.from('ricevute-prenotazioni').download(path); if(file.error)throw file.error
      const cfg=await smtp(); if(!cfg.pass)return json({success:false,error:'Password SMTP non configurata in Gestionale > Impostazioni > Comunicazione.'},400)
      const transporter=nodemailer.createTransport({host:cfg.host,port:cfg.port,secure:cfg.secure,auth:{user:cfg.user,pass:cfg.pass}})
      const numero=code(b), name=customerName(b), destination=text(trip?.destinazione||trip?.titolo,'Viaggio Del Grosso')
      const info=await transporter.sendMail({from:{name:cfg.fromName,address:cfg.from},to,replyTo:cfg.replyTo,subject:`Conferma prenotazione ${numero} - Del Grosso Viaggi`,text:`Gentile ${name},\n\nin allegato trovi la conferma della prenotazione ${numero} per ${destination}.\n\nDel Grosso Viaggi`,attachments:[{filename:`Conferma_Prenotazione_${numero}.pdf`,content:new Uint8Array(await file.data.arrayBuffer()),contentType:'application/pdf'}]})
      const now=new Date().toISOString(); await supabase.from('prenotazioni').update({confirmation_email_sent:true,confirmation_email_sent_at:now,confirmation_email_error:null}).eq('id',b.id)
      return json({success:true,emailSent:true,recipient:to,messageId:info.messageId})
    }
    const pdf=text(p?.pdfBase64); if(!b?.id)return json({success:false,error:'ID prenotazione mancante.'},400); if(!pdf)return json({success:false,error:'PDF conferma mancante.'},400)
    const number=receiptNumber(b), path=`conferme/${number}.pdf`, bytes=bytesFromBase64(pdf)
    const up=await supabase.storage.from('ricevute-prenotazioni').upload(path,bytes,{contentType:'application/pdf',upsert:false})
    if(up.error && !String(up.error.message||'').toLowerCase().includes('already exists'))throw up.error
    const now=new Date().toISOString()
    await supabase.from('prenotazioni').update({confirmation_number:number,confirmation_storage_path:path,confirmation_generated_at:now,confirmation_email_sent:false,confirmation_email_error:null}).eq('id',b.id)
    const to=text(b.email), cfg=await smtp()
    let emailSent=false,emailError=''
    if(to && cfg.pass){
      try{
        const transporter=nodemailer.createTransport({host:cfg.host,port:cfg.port,secure:cfg.secure,auth:{user:cfg.user,pass:cfg.pass}})
        const name=customerName(b), destination=text(trip?.destinazione||trip?.titolo,'Viaggio Del Grosso'), numero=code(b)
        await transporter.sendMail({from:{name:cfg.fromName,address:cfg.from},to,replyTo:cfg.replyTo,subject:`Conferma prenotazione ${numero} - Del Grosso Viaggi`,text:`Gentile ${name},\n\nla tua prenotazione è stata registrata correttamente. In allegato trovi la conferma della prenotazione con QR Code.\n\nNumero prenotazione: ${numero}\nViaggio: ${destination}\nData: ${text(trip?.data_partenza,'')}\n\nDel Grosso Viaggi`,html:`<p>Gentile <strong>${name}</strong>,</p><p>la tua prenotazione è stata registrata correttamente.</p><p>In allegato trovi la <strong>conferma della prenotazione con QR Code</strong>.</p><p><strong>Numero:</strong> ${numero}<br><strong>Viaggio:</strong> ${destination}<br><strong>Data:</strong> ${text(trip?.data_partenza,'')}</p><p>Del Grosso Viaggi</p>`,attachments:[{filename:`Conferma_Prenotazione_${numero}.pdf`,content:bytes,contentType:'application/pdf'}]})
        emailSent=true
      }catch(e){emailError=e instanceof Error?e.message:String(e)}
    }else emailError=!to?'Email partecipante mancante.':'Password SMTP non configurata in Gestionale > Impostazioni > Comunicazione.'
    const internalTo=['info@delgrossoviaggi.it','prenotazioni@delgrossoviaggi.it']
    let internalSent=false,internalError=''
    if(cfg.pass){
      try{
        const transporter=nodemailer.createTransport({host:cfg.host,port:cfg.port,secure:cfg.secure,auth:{user:cfg.user,pass:cfg.pass}})
        const name=customerName(b),numero=code(b),destination=text(trip?.destinazione||trip?.titolo,'Viaggio Del Grosso')
        await transporter.sendMail({from:{name:cfg.fromName,address:cfg.from},to:internalTo,replyTo:cfg.replyTo,subject:`🔔 NUOVA PRENOTAZIONE ${numero} - Del Grosso Viaggi`,text:`Nuova prenotazione registrata nel Gestionale.\n\nCliente: ${name}\nTelefono: ${text(b.telefono,'—')}\nEmail: ${text(b.email,'—')}\nViaggio: ${destination}\nData viaggio: ${text(trip?.data_partenza,'—')}\nPosti: ${text(b.posti,'—')}\nTotale: € ${Number(b.totale||0).toFixed(2)}\nAcconto: € ${Number(b.acconto||0).toFixed(2)}\nNumero prenotazione: ${numero}\n\nLa conferma PDF è archiviata nel Gestionale.`,attachments:[{filename:`Conferma_Prenotazione_${numero}.pdf`,content:bytes,contentType:'application/pdf'}]})
        internalSent=true
      }catch(e){internalError=e instanceof Error?e.message:String(e)}
    }else internalError='Password SMTP non configurata in Gestionale > Impostazioni > Comunicazione.'
    await supabase.from('prenotazioni').update({confirmation_email_sent:emailSent,confirmation_email_sent_at:emailSent?now:null,confirmation_email_error:[emailError,internalError&&`Avviso interno: ${internalError}`].filter(Boolean).join(' ')||null}).eq('id',b.id)
    return json({success:true,storedPath:path,confirmationNumber:number,emailSent,internalSent,emailError:emailError||null,internalError:internalError||null,signedUrl:await signed(path)})
  }catch(error){console.error(error);return json({success:false,error:error instanceof Error?error.message:'Errore comunicazioni prenotazione.'},500)}
})
