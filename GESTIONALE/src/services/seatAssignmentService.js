function normalizeText(value) {
  return String(value ?? '').trim();
}

export function isCancelledBookingStatus(status) {
  return normalizeText(status).toLowerCase().startsWith('annullat');
}

export function parseSeatSelection(value) {
  if (Array.isArray(value)) {
    return value.map((seat) => normalizeText(seat)).filter(Boolean);
  }

  const text = normalizeText(value);
  if (!text) return [];

  if (text.startsWith('[') && text.endsWith(']')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed.map((seat) => normalizeText(seat)).filter(Boolean);
      }
    } catch (_error) {
      // fallback to plain parsing below
    }
  }

  if (text.includes(',')) {
    return text.split(',').map((seat) => normalizeText(seat)).filter(Boolean);
  }

  if (text.includes(';')) {
    return text.split(';').map((seat) => normalizeText(seat)).filter(Boolean);
  }

  return /^\d+$/.test(text) ? [text] : [];
}

export function serializeSeatSelection(seats) {
  return [...new Set(parseSeatSelection(seats))]
    .sort((left, right) => Number(left) - Number(right))
    .join(',');
}

export function getSeatCountForBooking(booking = {}) {
  const explicitSeats = parseSeatSelection(booking.posti_selezionati);
  if (explicitSeats.length > 0) return explicitSeats.length;

  const count = Number(booking.posti || 0);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

export function extractOccupiedSeats(bookings = [], options = {}) {
  const { tripId = null, excludeBookingId = null } = options;
  const occupied = new Set();

  (Array.isArray(bookings) ? bookings : []).forEach((booking) => {
    if (!booking || isCancelledBookingStatus(booking.stato)) return;
    if (excludeBookingId && String(booking.id) === String(excludeBookingId)) return;

    const bookingTripId = normalizeText(booking.viaggio_id || booking.tratta_id);
    if (tripId && bookingTripId !== String(tripId)) return;

    parseSeatSelection(booking.posti_selezionati).forEach((seat) => occupied.add(seat));
  });

  return Array.from(occupied).sort((left, right) => Number(left) - Number(right));
}
