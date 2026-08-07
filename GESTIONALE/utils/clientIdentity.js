export function normalizeClientIdentity(value) {
  return String(value || '').trim().toLowerCase();
}

export function getClientFullName(client = {}) {
  return `${client.nome || ''} ${client.cognome || ''}`.trim();
}

export function getBookingClientName(booking = {}) {
  return String(booking.cliente_nome || booking.nome_cliente || booking.cliente || '').trim();
}

export function bookingMatchesClient(booking = {}, client = {}) {
  const bookingPhone = String(booking.cliente_telefono || booking.telefono || '').trim();
  const clientPhone = String(client.telefono || '').trim();
  if (bookingPhone && clientPhone && bookingPhone === clientPhone) return true;

  const bookingEmail = normalizeClientIdentity(booking.cliente_email || booking.email);
  const clientEmail = normalizeClientIdentity(client.email);
  if (bookingEmail && clientEmail && bookingEmail === clientEmail) return true;

  const bookingName = normalizeClientIdentity(getBookingClientName(booking));
  const clientName = normalizeClientIdentity(getClientFullName(client));
  if (bookingName && clientName && bookingName === clientName) return true;

  return false;
}

export function findMatchingClientForBooking(booking = {}, clients = []) {
  return (clients || []).find((client) => bookingMatchesClient(booking, client)) || null;
}
