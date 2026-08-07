function normalizeText(value, fallback = '—') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function formatBookingNumber(value) {
  const text = String(value ?? '').trim();
  return text || 'N/A';
}

function splitPassengerName(booking = {}) {
  const explicitName = String(booking.nome ?? '').trim();
  const explicitSurname = String(booking.cognome ?? '').trim();

  if (explicitName || explicitSurname) {
    return {
      name: explicitName || '—',
      surname: explicitSurname || '—'
    };
  }

  const fullName = String(booking.cliente ?? booking.cliente_nome ?? '').trim();
  if (!fullName) {
    return { name: '—', surname: '—' };
  }

  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { name: parts[0], surname: '—' };
  }

  return {
    name: parts[0],
    surname: parts.slice(1).join(' ')
  };
}

function formatDateOnly(date) {
  if (!date) return '—';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return normalizeText(date);
  return parsed.toLocaleDateString('it-IT', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

function formatTimeOnly(value) {
  const text = String(value ?? '').trim();
  if (!text) return '—';
  if (/^\d{2}:\d{2}/.test(text)) return text.slice(0, 5);

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return parsed.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatSeats(value) {
  if (Array.isArray(value)) {
    const normalized = value
      .map((seat) => String(seat ?? '').trim())
      .filter(Boolean)
      .map((seat) => seat.padStart(2, '0'));
    return normalized.length ? normalized.join(', ') : '—';
  }

  const text = String(value ?? '').trim();
  if (!text) return '—';
  if (!text.includes(',')) return text.padStart(2, '0');

  const seats = text
    .split(',')
    .map((seat) => seat.trim())
    .filter(Boolean)
    .map((seat) => seat.padStart(2, '0'));

  return seats.length ? seats.join(', ') : '—';
}

export function buildBookingQrPayload(booking = {}, trip = {}, company = {}) {
  const bookingId = formatBookingNumber(booking.id || booking.codice);
  const passenger = splitPassengerName(booking);
  const departurePlace = normalizeText(trip?.luogo_partenza || trip?.partenza);
  const destination = normalizeText(trip?.destinazione || trip?.titolo);
  const departureDate = formatDateOnly(trip?.data_partenza || trip?.data_servizio);
  const departureTime = formatTimeOnly(trip?.ora_partenza);
  const selectedSeat = formatSeats(booking.posti_selezionati || booking.posti);
  const qrPrefix = normalizeText(company.qrPrefix || 'DG-BOOKING');

  return [
    `Prefix: ${qrPrefix}`,
    `Prenotazione: ${bookingId}`,
    `Nome: ${passenger.name}`,
    `Cognome: ${passenger.surname}`,
    `Telefono: ${normalizeText(booking.telefono || booking.cliente_telefono)}`,
    `Email: ${normalizeText(booking.email || booking.cliente_email)}`,
    `Destinazione: ${destination}`,
    `Data: ${departureDate}`,
    `Ora: ${departureTime}`,
    `Partenza: ${departurePlace}`,
    `Posto: ${selectedSeat}`
  ].join('\n');
}

export function parseBookingQrPayload(rawValue = '') {
  const text = String(rawValue || '').trim();
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const fields = {};
  lines.forEach((line) => {
    const index = line.indexOf(':');
    if (index <= 0) return;
    const key = line.slice(0, index).trim().toLowerCase();
    const value = line.slice(index + 1).trim();
    fields[key] = value;
  });

  return {
    raw: text,
    prefix: fields.prefix || '',
    bookingId: fields.prenotazione || fields.booking || '',
    name: fields.nome || '',
    surname: fields.cognome || '',
    phone: fields.telefono || '',
    email: fields.email || '',
    destination: fields.destinazione || '',
    departureDate: fields.data || '',
    departureTime: fields.ora || '',
    departurePlace: fields.partenza || '',
    seat: fields.posto || '',
    isValid: Boolean(fields.prenotazione || fields.telefono || fields.email)
  };
}
