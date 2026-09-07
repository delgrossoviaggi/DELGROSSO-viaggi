import nodemailer from 'npm:nodemailer'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type' }
const json = (body:unknown,status=200) => new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}})
const text = (v:unknown,f='') => String(v ?? f).trim()
const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const supabase = createClient(supabaseUrl,serviceRole)

async function smtpConfig() {
  const rr = await fetch(`${supabaseUrl}/rest/v1/impostazioni?select=*&order=created_at.desc&limit=1`,{headers:{apikey:serviceRole,Authorization:`Bearer ${serviceRole}`}})
  if (!rr.ok) throw Error(`Impossibile leggere le impostazioni SMTP (${rr.status}).`)
  const st=(await rr.json())?.[0]||{}, c=st.comunicazione||{}
  return {
    host:text(c.smtpHost,'smtps.aruba.it'), port:Number(c.smtpPort||465), secure:c.smtpSecure!==false,
    user:text(c.smtpUsername,'prenotazioni@delgrossoviaggi.it'), pass:text(c.smtpPassword),
    from:text(c.smtpFromEmail,text(c.smtpUsername,'prenotazioni@delgrossoviaggi.it')),
    fromName:text(c.smtpFromName,'Del Grosso Viaggi'), replyTo:text(c.smtpReplyTo,text(c.smtpFromEmail,text(c.smtpUsername,'prenotazioni@delgrossoviaggi.it')))
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok',{headers:corsHeaders})
  if (req.method !== 'POST') return json({success:false,error:'Method not allowed'},405)
  try {
    const p = await req.json()

    if (p?.action === 'signed_url') {
      const path=text(p.path); if(!path) return json({success:false,error:'Percorso ricevuta mancante.'},400)
      const {data,error}=await supabase.storage.from('ricevute-prenotazioni').createSignedUrl(path,60*60*24*30)
      if(error) throw error
      return json({success:true,signedUrl:data.signedUrl})
    }

    if (p?.action === 'context') {
      const paymentId=text(p?.paymentId); if(!paymentId) return json({success:false,error:'ID pagamento mancante.'},400)
      const pr=await supabase.from('pagamenti').select('*').eq('id',paymentId).maybeSingle()
      if(pr.error) throw pr.error
      if(!pr.data) return json({success:false,error:'Pagamento non trovato.'},404)
      let booking=null,trip=null
      if(pr.data.prenotazione_id){const br=await supabase.from('prenotazioni').select('*').eq('id',pr.data.prenotazione_id).maybeSingle();if(br.error)throw br.error;booking=br.data}
      if(pr.data.viaggio_id){const tr=await supabase.from('viaggi').select('*').eq('id',pr.data.viaggio_id).maybeSingle();if(tr.error)throw tr.error;trip=tr.data}
      return json({success:true,payment:pr.data,booking,trip})
    }

    if (p?.action === 'resend_email') {
      const paymentId=text(p?.paymentId); if(!paymentId) return json({success:false,error:'ID pagamento mancante.'},400)
      const pr=await supabase.from('pagamenti').select('*').eq('id',paymentId).maybeSingle(); if(pr.error)throw pr.error
      const payment=pr.data
      if(!payment?.receipt_storage_path) return json({success:false,error:'Ricevuta PDF non archiviata.'},400)
      const br=payment.prenotazione_id?await supabase.from('prenotazioni').select('*').eq('id',payment.prenotazione_id).maybeSingle():{data:null,error:null}; if(br.error)throw br.error
      const booking=br.data||{}, to=text(booking.email||payment.email); if(!to)return json({success:false,error:'Email partecipante mancante.'},400)
      const file=await supabase.storage.from('ricevute-prenotazioni').download(payment.receipt_storage_path); if(file.error)throw file.error
      const cfg=await smtpConfig(); if(!cfg.pass)return json({success:false,error:'Password SMTP non configurata in Gestionale > Impostazioni > Comunicazione.'},400)
      const transporter=nodemailer.createTransport({host:cfg.host,port:cfg.port,secure:cfg.secure,auth:{user:cfg.user,pass:cfg.pass}})
      const type=payment.tipo==='Saldo'?'Saldo':'Acconto', customer=text(booking.cliente_nome||booking.cliente||payment.cliente,'Cliente'), number=text(payment.receipt_number,'ricevuta')
      await transporter.sendMail({from:{name:cfg.fromName,address:cfg.from},to,replyTo:cfg.replyTo,subject:`Ricevuta ${type} ${number} - Del Grosso Viaggi`,text:`Gentile ${customer},\n\nin allegato trovi nuovamente la ricevuta ${type} relativa al pagamento effettuato.\n\nDel Grosso Viaggi`,attachments:[{filename:`Ricevuta_Pagamento_${number}.pdf`,content:new Uint8Array(await file.data.arrayBuffer()),contentType:'application/pdf'}]})
      const now=new Date().toISOString(); await supabase.from('pagamenti').update({receipt_email_sent:true,receipt_email_sent_at:now,receipt_email_error:null}).eq('id',paymentId)
      return json({success:true,emailSent:true,recipient:to})
    }

    const payment=p?.payment||{}, booking=p?.booking||{}, trip=p?.trip||{}, totals=p?.totals||{}
    const pdfBase64=text(p?.pdfBase64), to=text(booking.email||booking.cliente_email||payment.email)
    if(!pdfBase64)return json({success:false,error:'PDF ricevuta mancante.'},400)
    if(!payment.id)return json({success:false,error:'ID pagamento mancante.'},400)

    const receiptNumber=text(payment.receipt_number,`DG-${String(payment.data_pagamento||new Date().toISOString()).slice(0,4)}-${String(payment.id).replace(/[^a-zA-Z0-9]/g,'').slice(0,8).toUpperCase()}`)
    const path=`pagamenti/${receiptNumber}.pdf`
    const bytes=Uint8Array.from(atob(pdfBase64),c=>c.charCodeAt(0))

    // FASE 1: archivio sempre prima dell'email.
    const upload=await supabase.storage.from('ricevute-prenotazioni').upload(path,bytes,{contentType:'application/pdf',upsert:false})
    if(upload.error && !String(upload.error.message||'').toLowerCase().includes('already exists'))throw upload.error
    const now=new Date().toISOString()
    const stored=await supabase.from('pagamenti').update({receipt_number:receiptNumber,receipt_generated_at:now,receipt_storage_path:path,receipt_email_sent:false,receipt_email_sent_at:null,receipt_email_error:to?'': 'Email partecipante mancante.'}).eq('id',payment.id)
    if(stored.error)throw stored.error

    // Se manca l'email, la ricevuta resta comunque archiviata.
    if(!to){
      let signedUrl=null; try{const s=await supabase.storage.from('ricevute-prenotazioni').createSignedUrl(path,60*60*24*30);signedUrl=s.data?.signedUrl||null}catch(e){console.error('Signed URL non disponibile:',e)}
      return json({success:true,emailSent:false,storedPath:path,receiptNumber,signedUrl,error:'Email del partecipante mancante: la ricevuta è stata archiviata ma non inviata.'})
    }

    // FASE 2: email. Un errore SMTP NON cancella né invalida l'archivio.
    let emailSent=false,emailError=''
    try{
      const cfg=await smtpConfig()
      if(!cfg.pass)throw Error('Password SMTP non configurata in Gestionale > Impostazioni > Comunicazione.')
      const transporter=nodemailer.createTransport({host:cfg.host,port:cfg.port,secure:cfg.secure,auth:{user:cfg.user,pass:cfg.pass}})
      const customer=text(booking.cliente_nome||booking.cliente||payment.cliente,'Cliente')
      const tripName=text(trip.titolo||trip.destinazione||booking.viaggio_codice||payment.viaggio,'Viaggio Del Grosso')
      const type=payment.tipo==='Saldo'?'Saldo':'Acconto'
      await transporter.sendMail({from:{name:cfg.fromName,address:cfg.from},to,replyTo:cfg.replyTo,subject:`Ricevuta ${type} ${receiptNumber} - Del Grosso Viaggi`,text:`Gentile ${customer},\n\nin allegato trovi la ricevuta relativa al pagamento effettuato per ${tripName}.\n\nTipo pagamento: ${type}\nImporto ricevuto: € ${Number(payment.importo||0).toFixed(2)}\nQuota totale: € ${Number(totals.totalDue||booking.totale||0).toFixed(2)}\nTotale pagato: € ${Number(totals.paidAfter||0).toFixed(2)}\nResiduo: € ${Number(totals.residualAfter||0).toFixed(2)}\n\nDel Grosso Viaggi`,html:`<p>Gentile <strong>${customer}</strong>,</p><p>in allegato trovi la ricevuta relativa al pagamento effettuato per <strong>${tripName}</strong>.</p><p><strong>Tipo:</strong> ${type}<br><strong>Importo ricevuto:</strong> € ${Number(payment.importo||0).toFixed(2)}<br><strong>Quota totale:</strong> € ${Number(totals.totalDue||booking.totale||0).toFixed(2)}<br><strong>Totale pagato:</strong> € ${Number(totals.paidAfter||0).toFixed(2)}<br><strong>Residuo:</strong> € ${Number(totals.residualAfter||0).toFixed(2)}</p><p>Del Grosso Viaggi</p>`,attachments:[{filename:`Ricevuta_Pagamento_${receiptNumber}.pdf`,content:bytes,contentType:'application/pdf'}]})
      emailSent=true
    }catch(error){emailError=error instanceof Error?error.message:String(error)}

    const finalUpdate=await supabase.from('pagamenti').update({receipt_email_sent:emailSent,receipt_email_sent_at:emailSent?now:null,receipt_email_error:emailSent?null:(emailError||'Invio email non riuscito.')}).eq('id',payment.id)
    if(finalUpdate.error)console.error('Aggiornamento stato email ricevuta non riuscito:',finalUpdate.error)

    let signedUrl=null; try{const s=await supabase.storage.from('ricevute-prenotazioni').createSignedUrl(path,60*60*24*30);signedUrl=s.data?.signedUrl||null}catch(e){console.error('Signed URL ricevuta non disponibile:',e)}
    return json({success:true,recipient:to,receiptNumber,storedPath:path,emailSent,emailError:emailError||null,signedUrl,error:emailSent?null:emailError||null})
  }catch(error){console.error(error);return json({success:false,error:error instanceof Error?error.message:'Errore invio ricevuta.'},500)}
})
