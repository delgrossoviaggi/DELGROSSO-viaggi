import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://chkuayhbmitdmzmmvona.supabase.co';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const PUBLIC_SITE_URL = (Deno.env.get('PUBLIC_SITE_URL') || 'https://www.delgrossoviaggi.it').replace(/\/$/, '');
const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID') || '';
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') || '';
const TWILIO_WHATSAPP_FROM = Deno.env.get('TWILIO_WHATSAPP_FROM') || '';
const TWILIO_WHATSAPP_TEMPLATE_SID = Deno.env.get('TWILIO_WHATSAPP_TEMPLATE_SID') || '';
const TWILIO_SMS_FROM = Deno.env.get('TWILIO_SMS_FROM') || '';
const TWILIO_MESSAGING_SERVICE_SID = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID') || '';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function text(value: unknown, fallback = '') {
  const valueText = String(value ?? '').trim();
  return valueText || fallback;
}

function normalizePhone(value: unknown) {
  let digits = String(value ?? '').replace(/[^\d+]/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) digits = `+${digits.slice(2)}`;
  if (!digits.startsWith('+')) {
    const compact = digits.replace(/\D/g, '');
    if (compact.startsWith('39')) digits = `+${compact}`;
    else digits = `+39${compact}`;
  }
  return digits;
}

function splitName(value: unknown) {
  const parts = text(value).split(/\s+/).filter(Boolean);
  return {
    name: parts[0] || 'Cliente',
    surname: parts.slice(1).join(' ') || ''
  };
}

function formatDate(value: unknown) {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return text(value, '—');
  return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(value: unknown) {
  const raw = text(value);
  if (!raw) return '—';
  if (/^\d{2}:\d{2}/.test(raw)) return raw.slice(0, 5);
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

function formatSeats(value: unknown) {
  const raw = Array.isArray(value) ? value.join(',') : text(value);
  if (!raw) return '—';
  return raw.split(/[,;]+/).map((seat) => seat.trim()).filter(Boolean).map((seat) => seat.padStart(2, '0')).join(', ');
}

function bookingNumber(id: unknown) {
  const raw = text(id);
  return raw ? `DG-${raw.slice(0, 8).toUpperCase()}` : 'DG-PRENOTAZIONE';
}

function basicAuthHeader() {
  return `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`;
}

async function twilioMessage(params: Record<string, string>) {
  const body = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => body.set(key, value));

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = text(payload?.message || payload?.error_message, `Twilio HTTP ${response.status}`);
    throw new Error(detail);
  }
  return payload;
}

function assertTwilioCredentials() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error('Configurazione Twilio incompleta: mancano TWILIO_ACCOUNT_SID e/o TWILIO_AUTH_TOKEN.');
  }
}

async function sendWhatsApp(phone: string, variables: Record<string, string>) {
  assertTwilioCredentials();
  if (!TWILIO_WHATSAPP_FROM || !TWILIO_WHATSAPP_TEMPLATE_SID) {
    throw new Error('WhatsApp non configurato: servono TWILIO_WHATSAPP_FROM e TWILIO_WHATSAPP_TEMPLATE_SID.');
  }

  return twilioMessage({
    To: `whatsapp:${phone}`,
    From: `whatsapp:${TWILIO_WHATSAPP_FROM.replace(/^whatsapp:/i, '')}`,
    ContentSid: TWILIO_WHATSAPP_TEMPLATE_SID,
    ContentVariables: JSON.stringify(variables)
  });
}

async function sendSms(phone: string, body: string) {
  assertTwilioCredentials();
  if (!TWILIO_SMS_FROM && !TWILIO_MESSAGING_SERVICE_SID) {
    throw new Error('SMS non configurato: serve TWILIO_SMS_FROM oppure TWILIO_MESSAGING_SERVICE_SID.');
  }

  const params: Record<string, string> = {
    To: phone,
    Body: body
  };

  if (TWILIO_MESSAGING_SERVICE_SID) params.MessagingServiceSid = TWILIO_MESSAGING_SERVICE_SID;
  else params.From = TWILIO_SMS_FROM;

  return twilioMessage(params);
}

async function getBooking(bookingId: string) {
  const { data: booking, error: bookingError } = await supabase
    .from('prenotazioni')
    .select('*')
    .eq('id', bookingId)
    .maybeSingle();
  if (bookingError) throw bookingError;
  if (!booking) throw new Error('Prenotazione non trovata.');

  const { data: trip, error: tripError } = await supabase
    .from('viaggi')
    .select('*')
    .eq('id', booking.viaggio_id)
    .maybeSingle();
  if (tripError) throw tripError;
  if (!trip) throw new Error('Viaggio della prenotazione non trovato.');

  return { booking, trip };
}

function buildContext(booking: any, trip: any) {
  const passenger = splitName(booking.cliente);
  const number = bookingNumber(booking.id);
  const destination = text(trip.destinazione || trip.titolo, 'Viaggio Del Grosso');
  const date = formatDate(trip.data_partenza);
  const time = formatTime(trip.ora_partenza);
  const place = text(trip.luogo_partenza || trip.partenza, '—');
  const seats = formatSeats(booking.posti_selezionati || booking.posti);
  const token = text(booking.confirmation_token);
  const confirmationUrl = token
    ? `${PUBLIC_SITE_URL}/conferma.html?booking=${encodeURIComponent(booking.id)}&token=${encodeURIComponent(token)}`
    : `${PUBLIC_SITE_URL}/conferma.html?booking=${encodeURIComponent(booking.id)}`;

  return {
    number,
    name: passenger.name,
    surname: passenger.surname,
    phone: normalizePhone(booking.telefono),
    destination,
    date,
    time,
    place,
    seats,
    confirmationUrl
  };
}

function buildSmsBody(ctx: ReturnType<typeof buildContext>) {
  return [
    'DELGROSSO VIAGGI - Prenotazione confermata',
    `Ciao ${ctx.name}, la tua prenotazione ${ctx.number} è stata registrata.`,
    `Viaggio: ${ctx.destination}`,
    `Data: ${ctx.date} - Ore: ${ctx.time}`,
    `Posto: ${ctx.seats}`,
    `Conferma: ${ctx.confirmationUrl}`
  ].join('\n');
}

async function updateNotification(bookingId: string, patch: Record<string, unknown>) {
  const { error } = await supabase.from('prenotazioni').update(patch).eq('id', bookingId);
  if (error) console.error('Aggiornamento stato notifica non riuscito:', error);
}

async function sendNotification(bookingId: string) {
  const { booking, trip } = await getBooking(bookingId);
  const ctx = buildContext(booking, trip);

  if (!ctx.phone) {
    await updateNotification(bookingId, {
      notification_status: 'no_phone',
      notification_error: 'Numero di telefono mancante.',
      notification_attempted_at: new Date().toISOString()
    });
    return { success: false, channel: 'none', error: 'Numero di telefono mancante.', confirmationUrl: ctx.confirmationUrl };
  }

  await updateNotification(bookingId, {
    notification_status: 'sending',
    notification_error: null,
    notification_attempted_at: new Date().toISOString()
  });

  let whatsappError = '';
  try {
    const wa = await sendWhatsApp(ctx.phone, {
      '1': ctx.name,
      '2': ctx.number,
      '3': ctx.destination,
      '4': ctx.date,
      '5': ctx.time,
      '6': ctx.seats,
      '7': ctx.confirmationUrl
    });

    await updateNotification(bookingId, {
      notification_channel: 'whatsapp',
      notification_status: 'sent',
      notification_message_sid: text(wa?.sid),
      notification_sent_at: new Date().toISOString(),
      notification_error: null
    });

    return { success: true, channel: 'whatsapp', sid: wa?.sid || null, confirmationUrl: ctx.confirmationUrl };
  } catch (error) {
    whatsappError = text(error?.message, 'Invio WhatsApp non riuscito.');
    console.error('WhatsApp non riuscito, provo SMS:', whatsappError);
  }

  try {
    const sms = await sendSms(ctx.phone, buildSmsBody(ctx));
    await updateNotification(bookingId, {
      notification_channel: 'sms',
      notification_status: 'sent',
      notification_message_sid: text(sms?.sid),
      notification_sent_at: new Date().toISOString(),
      notification_error: `WhatsApp non riuscito: ${whatsappError}`
    });

    return {
      success: true,
      channel: 'sms',
      sid: sms?.sid || null,
      confirmationUrl: ctx.confirmationUrl,
      fallbackFrom: 'whatsapp',
      whatsappError
    };
  } catch (error) {
    const smsError = text(error?.message, 'Invio SMS non riuscito.');
    const combined = `WhatsApp: ${whatsappError} | SMS: ${smsError}`;
    await updateNotification(bookingId, {
      notification_channel: 'whatsapp,sms',
      notification_status: 'failed',
      notification_message_sid: null,
      notification_sent_at: null,
      notification_error: combined
    });

    return { success: false, channel: 'none', error: combined, confirmationUrl: ctx.confirmationUrl };
  }
}

async function getConfirmation(bookingId: string, token: string) {
  if (!bookingId || !token) throw new Error('Link di conferma non valido.');
  const { booking, trip } = await getBooking(bookingId);
  if (!booking.confirmation_token || booking.confirmation_token !== token) {
    throw new Error('Link di conferma non valido o scaduto.');
  }

  const ctx = buildContext(booking, trip);
  return {
    id: booking.id,
    numero: ctx.number,
    cliente: ctx.name + (ctx.surname ? ` ${ctx.surname}` : ''),
    telefono: ctx.phone,
    destinazione: ctx.destination,
    data: ctx.date,
    ora: ctx.time,
    partenza: ctx.place,
    posti: ctx.seats,
    totale: Number(booking.totale ?? 0) || 0,
    stato: text(booking.stato, 'In Attesa'),
    created_at: booking.created_at || null,
    notification_channel: booking.notification_channel || null,
    notification_status: booking.notification_status || null
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = text(body?.action, 'send');

    if (action === 'get_confirmation') {
      const data = await getConfirmation(text(body?.bookingId), text(body?.token));
      return json({ success: true, data });
    }

    const bookingId = text(body?.bookingId);
    if (!bookingId) return json({ success: false, error: 'bookingId mancante.' }, 400);

    if (action === 'send') {
      const result = await sendNotification(bookingId);
      return json(result, result.success ? 200 : 200);
    }

    return json({ success: false, error: `Azione non supportata: ${action}` }, 400);
  } catch (error) {
    console.error('send-booking-notification error:', error);
    return json({ success: false, error: text(error?.message, 'Errore interno.') }, 500);
  }
});
