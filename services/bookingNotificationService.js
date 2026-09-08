const SUPABASE_URL = 'https://chkuayhbmitdmzmmvona.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_H29K1BV5ZE1rT8xo0PIzVA_wF6zC7je';
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/send-booking-notification`;

function normalizeText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function makeConfirmationToken() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function callFunction(payload) {
  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `Servizio notifiche non disponibile (${response.status}).`);
  }
  return data;
}

export function createConfirmationToken() {
  return makeConfirmationToken();
}

export async function sendBookingNotification(bookingId) {
  const id = normalizeText(bookingId);
  if (!id) throw new Error('ID prenotazione mancante.');
  return callFunction({ action: 'send', bookingId: id });
}

export async function getPublicConfirmation(bookingId, token) {
  return callFunction({
    action: 'get_confirmation',
    bookingId: normalizeText(bookingId),
    token: normalizeText(token)
  });
}

export default {
  createConfirmationToken,
  sendBookingNotification,
  getPublicConfirmation
};
