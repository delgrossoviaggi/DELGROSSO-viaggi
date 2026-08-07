const DEFAULT_SUPPORT_NUMBER = '393205730466';

function normalizeText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizePhoneNumber(value, fallback = '') {
  const digits = String(value ?? '').replace(/[^\d+]/g, '');
  if (!digits) return fallback;
  if (digits.startsWith('+')) return digits.slice(1);
  if (digits.startsWith('00')) return digits.slice(2);
  return digits;
}

function formatDateOnly(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return normalizeText(value, '—');
  return parsed.toLocaleDateString('it-IT', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

function formatTimeOnly(value) {
  const text = normalizeText(value);
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
  const text = normalizeText(value);
  if (!text) return '—';

  return text
    .split(',')
    .map((seat) => seat.trim())
    .filter(Boolean)
    .map((seat) => seat.padStart(2, '0'))
    .join(', ');
}

function splitPassengerName(booking = {}) {
  const explicitName = normalizeText(booking.nome);
  const explicitSurname = normalizeText(booking.cognome);
  if (explicitName || explicitSurname) {
    return {
      name: explicitName || '—',
      surname: explicitSurname || '—'
    };
  }

  const fullName = normalizeText(booking.cliente);
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

function buildReceiptSummary(booking = {}, trip = {}) {
  const passenger = splitPassengerName(booking);
  return {
    bookingNumber: normalizeText(booking.id || booking.codice, 'N/A'),
    name: passenger.name,
    surname: passenger.surname,
    phone: normalizeText(booking.telefono, '—'),
    email: normalizeText(booking.email, '—'),
    destination: normalizeText(trip.destinazione || trip.titolo, '—'),
    departureDate: formatDateOnly(trip.data_partenza),
    departureTime: formatTimeOnly(trip.ora_partenza),
    departurePlace: normalizeText(trip.luogo_partenza || trip.partenza, '—'),
    seats: formatSeats(booking.posti_selezionati || booking.posti)
  };
}

function buildPublicSupportMessage(summary) {
  return [
    'Buongiorno Del Grosso Viaggi,',
    'ho completato una prenotazione online.',
    '',
    `Numero prenotazione: ${summary.bookingNumber}`,
    `Nome: ${summary.name}`,
    `Cognome: ${summary.surname}`,
    `Telefono: ${summary.phone}`,
    `Email: ${summary.email}`,
    `Destinazione: ${summary.destination}`,
    `Data: ${summary.departureDate}`,
    `Ora: ${summary.departureTime}`,
    `Luogo partenza: ${summary.departurePlace}`,
    `Posto: ${summary.seats}`,
    '',
    'La ricevuta prenotazione con QR Code e stata generata automaticamente.'
  ].join('\n');
}

function buildCustomerConfirmationMessage(summary) {
  return [
    'Del Grosso Viaggi - Conferma Prenotazione',
    '',
    `Numero prenotazione: ${summary.bookingNumber}`,
    `Destinazione: ${summary.destination}`,
    `Data: ${summary.departureDate}`,
    `Ora: ${summary.departureTime}`,
    `Luogo partenza: ${summary.departurePlace}`,
    `Posto: ${summary.seats}`,
    '',
    'La tua ricevuta prenotazione con QR Code e pronta.'
  ].join('\n');
}

function buildTemplateMessage(template, summary) {
  const source = String(template || '').trim();
  if (!source) return '';
  return source.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_full, key) => {
    const value = summary?.[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

export function prepareWhatsAppDispatch(options = {}) {
  const {
    booking = {},
    trip = {},
    recipientPhone,
    template = 'booking-confirmation',
    mode = 'wa.me',
    messageTemplate = ''
  } = options;

  const summary = buildReceiptSummary(booking, trip);
  const recipient = normalizePhoneNumber(recipientPhone, DEFAULT_SUPPORT_NUMBER);
  const message = buildTemplateMessage(messageTemplate, summary)
    || (template === 'support-booking-notification'
      ? buildPublicSupportMessage(summary)
      : buildCustomerConfirmationMessage(summary));
  const waMeUrl = `https://wa.me/${recipient}?text=${encodeURIComponent(message)}`;

  return {
    channel: mode,
    recipient,
    template,
    message,
    waMeUrl,
    businessPayload: {
      recipient,
      template,
      message,
      metadata: {
        bookingNumber: summary.bookingNumber,
        destination: summary.destination,
        departureDate: summary.departureDate,
        departureTime: summary.departureTime,
        departurePlace: summary.departurePlace,
        seats: summary.seats
      }
    }
  };
}

export function openWhatsAppDispatch(dispatch) {
  if (!dispatch?.waMeUrl) {
    throw new Error('Link WhatsApp non disponibile.');
  }

  const popup = window.open(dispatch.waMeUrl, '_blank', 'noopener,noreferrer');
  return {
    opened: Boolean(popup),
    url: dispatch.waMeUrl
  };
}

export default {
  prepareWhatsAppDispatch,
  openWhatsAppDispatch
};
