import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:info@delgrossoviaggi.it'
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!
const webhookSecret = Deno.env.get('PUSH_WEBHOOK_SECRET') || ''

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
const supabase = createClient(supabaseUrl, serviceRoleKey)

function getClientName(record: Record<string, unknown>) {
  const direct = record.cliente_nome || record.cliente || record.nome_cliente
  if (direct) return String(direct)
  const name = `${record.nome || ''} ${record.cognome || ''}`.trim()
  return name || 'Nuovo cliente'
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  if (webhookSecret && req.headers.get('x-push-webhook-secret') !== webhookSecret) {
    return new Response('Unauthorized', { status: 401 })
  }

  let payload: any
  try { payload = await req.json() } catch { return new Response('Invalid JSON', { status: 400 }) }
  const record = payload?.record || {}
  const name = getClientName(record)
  const destination = String(record.destinazione || record.viaggio_codice || record.viaggio_id || 'Prenotazione')
  const bookingId = String(record.id || '')

  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, active')
    .eq('active', true)

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 })

  const body = JSON.stringify({
    title: '🔔 Nuova prenotazione',
    body: `${name} · ${destination}`,
    url: '/GESTIONALE/prenotazioni.html',
    tag: bookingId ? `booking-${bookingId}` : 'dg-booking'
  })

  let sent = 0
  let removed = 0
  const results = await Promise.allSettled((subscriptions || []).map(async (sub) => {
    try {
      await webpush.sendNotification({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth }
      }, body, { TTL: 3600 })
      sent++
    } catch (err: any) {
      const status = err?.statusCode
      if (status === 404 || status === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        removed++
      } else {
        console.error('push failed', status, err?.message || err)
      }
    }
  }))

  return Response.json({ ok: true, sent, removed, attempted: results.length })
})
