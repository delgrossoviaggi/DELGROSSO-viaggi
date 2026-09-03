import nodemailer from 'npm:nodemailer'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type' }
const json = (body:unknown,status=200) => new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}})
const text = (v:unknown,f='') => String(v ?? f).trim()
const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const supabase = createClient(supabaseUrl,serviceRole)

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok',{headers:corsHeaders})
  if (req.method !== 'POST') return json({error:'Method not allowed'},405)
  try {
    const p = await req.json()
    if (p?.action === 'signed_url') {
      const path = text(p.path)
      if (!path) return json({error:'Percorso ricevuta mancante.'},400)
      const { data, error } = await supabase.storage.from('ricevute-prenotazioni').createSignedUrl(path,60*60*24*30)
      if (error) throw error
      return json({success:true,signedUrl:data.signedUrl})
    }
    if (p?.action === 'context') {
      const paymentId = text(p?.paymentId)
      if (!paymentId) return json({success:false,error:'ID pagamento mancante.'},400)
      const pr = await supabase.from('pagamenti').select('*').eq('id',paymentId).maybeSingle()
      if (pr.error) throw pr.error
      if (!pr.data) return json({success:false,error:'Pagamento non trovato.'},404)
      let booking=null, trip=null
      if (pr.data.prenotazione_id) { const br=await supabase.from('prenotazioni').select('*').eq('id',pr.data.prenotazione_id).maybeSingle(); if(br.error)throw br.error; booking=br.data }
      if (pr.data.viaggio_id) { const tr=await supabase.from('viaggi').select('*').eq('id',pr.data.viaggio_id).maybeSingle(); if(tr.error)throw tr.error; trip=tr.data }
      return json({success:true,payment:pr.data,booking,trip})
    }
    if (p?.action === 'resend_email') {
      const paymentId = text(p?.paymentId)
      if (!paymentId) return json({success:false,error:'ID pagamento mancante.'},400)
      const pr = await supabase.from('pagamenti').select('*').eq('id',paymentId).maybeSingle()
      if (pr.error) throw pr.error
      const paymentRow = pr.data
      if (!paymentRow?.receipt_storage_path) return json({success:false,error:'Ricevuta PDF non archiviata.'},400)
      const br = paymentRow.prenotazione_id ? await supabase.from('prenotazioni').select('*').eq('id',paymentRow.prenotazione_id).maybeSingle() : {data:null,error:null}
      if (br.error) throw br.error
      const bookingRow = br.data || {}
      const to = text(bookingRow.email || paymentRow.email)
      if (!to) return json({success:false,error:'Email partecipante mancante.'},400)
      const file = await supabase.storage.from('ricevute-prenotazioni').download(paymentRow.receipt_storage_path)
      if (file.error) throw file.error
      // Archiviazione e metadati devono essere completati PRIMA dell'invio email.
    // Un errore SMTP non deve trasformare una ricevuta correttamente archiviata
    // in un falso "invio fallito".
    const now = new Date().toISOString()
    const initialUpdate = await supabase.from('pagamenti').update({
      receipt_number:receiptNumber,
      receipt_generated_at:now,
      receipt_storage_path:path,
      receipt_email_sent:false,
      receipt_email_sent_at:null,
      receipt_email_error:to ? null : 'Email del partecipante mancante.'
    }).eq('id',payment.id)
    if (initialUpdate.error) throw initialUpdate.error

    if (!to) {
      return json({success:true,emailSent:false,storedPath:path,receiptNumber,error:'Email del partecipante mancante: la ricevuta è stata archiviata ma non inviata.'})
    }

    let emailSent = false
    let emailError = ''
    try {
      const rr = await fetch(`${supabaseUrl}/rest/v1/impostazioni?select=*&order=created_at.desc&limit=1`,{headers:{apikey:serviceRole,Authorization:`Bearer ${serviceRole}`}})
      if (!rr.ok) throw Error(`Impossibile leggere le impostazioni SMTP (${rr.status}).`)
      const st = (await rr.json())?.[0] || {}, c = st.comunicazione || {}
      const host=text(c.smtpHost,'smtps.aruba.it'), port=Number(c.smtpPort||465), secure=c.smtpSecure!==false, user=text(c.smtpUsername,'prenotazioni@delgrossoviaggi.it'), pass=text(c.smtpPassword), from=text(c.smtpFromEmail,user), fromName=text(c.smtpFromName,'Del Grosso Viaggi'), replyTo=text(c.smtpReplyTo,from)
      if (!pass) throw Error('Password SMTP non configurata in Gestionale > Impostazioni > Comunicazione.')

      const transporter = nodemailer.createTransport({host,port,secure,auth:{user,pass}})
      const customer=text(booking.cliente_nome || booking.cliente || payment.cliente,'Cliente')
      const tripName=text(trip.titolo || trip.destinazione || booking.viaggio_codice || payment.viaggio,'Viaggio Del Grosso')
      const type=payment.tipo==='Saldo'?'Saldo':'Acconto'
      await transporter.sendMail({
        from:{name:fromName,address:from},to,replyTo,
        subject:`Ricevuta ${type} ${receiptNumber} - Del Grosso Viaggi`,
        text:`Gentile ${customer},\n\nin allegato trovi la ricevuta relativa al pagamento effettuato per ${tripName}.\n\nTipo pagamento: ${type}\nImporto ricevuto: € ${Number(payment.importo||0).toFixed(2)}\nQuota totale: € ${Number(totals.totalDue||booking.totale||0).toFixed(2)}\nTotale pagato: € ${Number(totals.paidAfter||0).toFixed(2)}\nResiduo: € ${Number(totals.residualAfter||0).toFixed(2)}\n\nLa somma è stata ricevuta da DELGROSSO VIAGGI & LIMOUSINE BUS.\n\nDel Grosso Viaggi`,
        html:`<p>Gentile <strong>${customer}</strong>,</p><p>in allegato trovi la ricevuta relativa al pagamento effettuato per <strong>${tripName}</strong>.</p><p><strong>Tipo:</strong> ${type}<br><strong>Importo ricevuto:</strong> € ${Number(payment.importo||0).toFixed(2)}<br><strong>Quota totale:</strong> € ${Number(totals.totalDue||booking.totale||0).toFixed(2)}<br><strong>Totale pagato:</strong> € ${Number(totals.paidAfter||0).toFixed(2)}<br><strong>Residuo:</strong> € ${Number(totals.residualAfter||0).toFixed(2)}</p><p>La somma è stata ricevuta da <strong>DELGROSSO VIAGGI &amp; LIMOUSINE BUS</strong>.</p>`,
        attachments:[{filename:`Ricevuta_Pagamento_${receiptNumber}.pdf`,content:bytes,contentType:'application/pdf'}]
      })
      emailSent = true
    } catch(error) {
      emailError = error instanceof Error ? error.message : String(error)
    }

    const finalUpdate = await supabase.from('pagamenti').update({
      receipt_email_sent:emailSent,
      receipt_email_sent_at:emailSent ? now : null,
      receipt_email_error:emailSent ? null : (emailError || 'Invio email non riuscito.')
    }).eq('id',payment.id)
    if (finalUpdate.error) console.error('Aggiornamento stato email ricevuta non riuscito:', finalUpdate.error)

    let signedUrl = null
    try {
      const signed = await supabase.storage.from('ricevute-prenotazioni').createSignedUrl(path,60*60*24*30)
      signedUrl = signed.data?.signedUrl || null
      if (signed.error) console.error('Signed URL ricevuta non disponibile:', signed.error)
    } catch(error) {
      console.error('Creazione signed URL ricevuta non riuscita:', error)
    }

    return json({
      success:true,
      recipient:to,
      receiptNumber,
      storedPath:path,
      emailSent,
      emailError:emailError || null,
      signedUrl,
      error:emailSent ? null : emailError || null
    })
  } catch(error) {
    console.error(error)
    return json({error:error instanceof Error?error.message:'Errore invio ricevuta.'},500)
  }
})
