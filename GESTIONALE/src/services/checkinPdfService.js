import { jsPDF } from 'jspdf';
import { getSeatLayoutDefinition } from './seatMapService.js';

const PDF_COLORS = {
  brand: '#0F4C81',
  text: '#1F2A37',
  muted: '#5B6472',
  border: '#CDD8E6',
  seat: '#FFFFFF',
  seatOccupied: '#F5F8FC',
  door: '#FFEFD5',
  aisle: '#EDF2F8',
  white: '#FFFFFF'
};

function normalizeText(value, fallback = '—') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function splitPassengerName(booking = {}) {
  const full = normalizeText(
    booking.cliente || booking.cliente_nome || booking.nome_cliente || `${booking.nome || ''} ${booking.cognome || ''}`.trim(),
    ''
  );
  if (!full) return { nome: '', cognome: '' };
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { nome: parts[0] || '', cognome: '' };
  return {
    nome: parts.slice(0, -1).join(' '),
    cognome: parts.slice(-1).join('')
  };
}

function parseSeats(value) {
  if (Array.isArray(value)) {
    return value.map((seat) => String(seat ?? '').trim()).filter(Boolean);
  }
  const raw = String(value ?? '').trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((seat) => String(seat ?? '').trim()).filter(Boolean);
    }
  } catch (_error) {
    // fallback csv
  }
  return raw.split(',').map((seat) => seat.trim()).filter(Boolean);
}

function toSeatNumber(seat) {
  return Number(String(seat ?? '').replace(/[^\d]/g, ''));
}

function formatSeatNumber(seat) {
  const value = toSeatNumber(seat);
  if (!Number.isFinite(value) || value <= 0) return String(seat ?? '');
  return String(value).padStart(2, '0');
}

function normalizePresenceLabel(booking = {}) {
  const status = String(booking.checkin_stato || '').trim().toUpperCase();
  if (status === 'PRESENTE') return 'Presente';
  if (status === 'ASSENTE') return 'Assente';
  if (status === 'RITARDO') return 'Ritardo';
  if (status === 'ALTRA_FERMATA') return 'Salito ad altra fermata';
  return booking.checkin_effettuato ? 'Presente' : 'Non presente';
}

function buildPassengerEntries(bookings = []) {
  const entries = [];
  const surnameCount = new Map();
  const drafts = [];

  (bookings || []).forEach((booking) => {
    const seats = parseSeats(booking.__seats || booking.posti_selezionati || booking.posti);
    if (!seats.length) return;
    const person = splitPassengerName(booking);
    const surname = normalizeText(person.cognome || person.nome, '').toUpperCase();
    const firstName = normalizeText(person.nome, '');
    const phone = normalizeText(booking.telefono || booking.cliente_telefono, '');
    const statusLabel = normalizePresenceLabel(booking);
    seats.forEach((seat) => {
      drafts.push({
        seat: formatSeatNumber(seat),
        seatNumber: toSeatNumber(seat),
        cognome: surname,
        nome: firstName,
        telefono: phone,
        statusLabel
      });
    });
    if (surname) surnameCount.set(surname, (surnameCount.get(surname) || 0) + 1);
  });

  drafts.forEach((entry) => {
    const duplicateSurname = (surnameCount.get(entry.cognome) || 0) > 1;
    const initial = entry.nome ? `${entry.nome.slice(0, 1).toUpperCase()}.` : '';
    const seatLabel = duplicateSurname && initial ? `${entry.cognome} ${initial}` : entry.cognome;
    entries.push({
      ...entry,
      seatLabel: normalizeText(seatLabel || entry.cognome || entry.nome, '—')
    });
  });

  return entries.sort((a, b) => {
    if (Number.isFinite(a.seatNumber) && Number.isFinite(b.seatNumber)) return a.seatNumber - b.seatNumber;
    return String(a.seat).localeCompare(String(b.seat), 'it');
  });
}

function drawHeader(doc, title, trip = {}, company = {}) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const destination = normalizeText(trip.destinazione || trip.titolo || trip.codice);
  const departureDate = normalizeText(trip.data_partenza || trip.data_servizio, '—');
  const departureTime = String(trip.ora_partenza || '').slice(0, 5) || '—';
  const bus = normalizeText(trip.autobus || trip.autobus_id || trip.mezzo_id, 'GT53/GT63');
  const companyName = normalizeText(company.name || 'Del Grosso Viaggi & Limousine Bus');

  doc.setFillColor(PDF_COLORS.brand);
  doc.rect(0, 0, pageWidth, 22, 'F');
  doc.setTextColor(PDF_COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(companyName, 10, 9);
  doc.setFontSize(12);
  doc.text(title, 10, 17);

  doc.setTextColor(PDF_COLORS.text);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Destinazione: ${destination}`, 10, 28);
  doc.text(`Data/Ora: ${departureDate} ${departureTime}`, 80, 28);
  doc.text(`Autobus: ${bus}`, 150, 28);
}

export async function generateSeatMapPdf({ trip, bookings, company } = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'A4' });
  drawHeader(doc, 'PIANTINA AUTOBUS - CHECK-IN', trip, company);

  const layout = getSeatLayoutDefinition(trip?.seat_layout || trip?.autobus || trip?.autobus_id || trip?.mezzo_id || 'GT53');
  const entries = buildPassengerEntries(bookings);
  const bySeat = new Map(entries.map((entry) => [entry.seat, entry]));
  const pageWidth = doc.internal.pageSize.getWidth();
  const leftMargin = 18;
  const topStart = 40;
  const seatW = 24;
  const seatH = 14;
  const gap = 3;
  const aisleW = 14;
  const rowGap = 3.5;

  doc.setTextColor(PDF_COLORS.muted);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(layout.frontLabel || `FRONTE BUS ${layout.key}`, pageWidth / 2, topStart - 7, { align: 'center' });
  doc.text(layout.driverLabel || 'AUTISTA', leftMargin, topStart - 1);

  let y = topStart;
  (layout.rows || []).forEach((row) => {
    const isRearRow = row.every((cell) => typeof cell === 'number' || /^\d+$/.test(String(cell)));
    let rowWidth = 0;
    row.forEach((cell, index) => {
      const isStringSeat = typeof cell === 'number' || /^\d+$/.test(String(cell));
      const width = isStringSeat ? seatW : (cell === 'aisle' ? aisleW : seatW);
      rowWidth += width;
      if (index < row.length - 1) rowWidth += gap;
    });
    let x = isRearRow ? (pageWidth - rowWidth) / 2 : leftMargin;

    row.forEach((cell) => {
      const isSeat = typeof cell === 'number' || /^\d+$/.test(String(cell));
      if (isSeat) {
        const seat = formatSeatNumber(cell);
        const passenger = bySeat.get(seat);
        doc.setDrawColor(PDF_COLORS.border);
        doc.setFillColor(passenger ? PDF_COLORS.seatOccupied : PDF_COLORS.seat);
        doc.roundedRect(x, y, seatW, seatH, 2, 2, 'FD');
        doc.setTextColor(PDF_COLORS.brand);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.text(seat, x + 2, y + 4.2);
        doc.setTextColor(PDF_COLORS.text);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6);
        const label = normalizeText(passenger?.seatLabel, '').slice(0, 12);
        if (label) doc.text(label, x + seatW / 2, y + 10, { align: 'center' });
        x += seatW + gap;
        return;
      }

      if (cell === 'door') {
        doc.setDrawColor(PDF_COLORS.border);
        doc.setFillColor(PDF_COLORS.door);
        doc.roundedRect(x, y, seatW, seatH, 2, 2, 'FD');
        doc.setTextColor(PDF_COLORS.text);
        doc.setFontSize(6);
        doc.text('PORTA', x + seatW / 2, y + 8.2, { align: 'center' });
        x += seatW + gap;
        return;
      }

      if (cell === 'aisle') {
        doc.setFillColor(PDF_COLORS.aisle);
        doc.roundedRect(x, y + 1, aisleW, seatH - 2, 2, 2, 'F');
        x += aisleW + gap;
        return;
      }

      x += seatW + gap;
    });

    y += seatH + rowGap;
  });

  doc.setTextColor(PDF_COLORS.muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Generato il ${new Date().toLocaleString('it-IT')}`, 10, 287);

  return doc.output('blob');
}

function drawPassengerListTableHeader(doc, y) {
  const columns = [
    { key: 'seat', label: 'Posto', width: 20 },
    { key: 'cognome', label: 'Cognome', width: 45 },
    { key: 'nome', label: 'Nome', width: 40 },
    { key: 'telefono', label: 'Telefono', width: 38 },
    { key: 'statusLabel', label: 'Stato presenza', width: 48 },
    { key: 'firma', label: 'Firma', width: 86 }
  ];
  let x = 10;
  doc.setFillColor(PDF_COLORS.brand);
  doc.setTextColor(PDF_COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  columns.forEach((column) => {
    doc.rect(x, y, column.width, 8, 'F');
    doc.text(column.label, x + 2, y + 5.4);
    x += column.width;
  });
  return columns;
}

export async function generatePassengerListPdf({ trip, bookings, company } = {}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'A4' });
  drawHeader(doc, 'ELENCO PASSEGGERI - CHECK-IN', trip, company);

  const rows = buildPassengerEntries(bookings);
  let y = 34;
  let columns = drawPassengerListTableHeader(doc, y);
  y += 8;

  doc.setTextColor(PDF_COLORS.text);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);

  const rowHeight = 7.8;
  rows.forEach((row) => {
    if (y > 198) {
      doc.addPage();
      drawHeader(doc, 'ELENCO PASSEGGERI - CHECK-IN', trip, company);
      y = 34;
      columns = drawPassengerListTableHeader(doc, y);
      y += 8;
      doc.setTextColor(PDF_COLORS.text);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.8);
    }

    let x = 10;
    columns.forEach((column) => {
      doc.setDrawColor(PDF_COLORS.border);
      doc.rect(x, y, column.width, rowHeight, 'S');
      const value = column.key === 'firma' ? '' : normalizeText(row[column.key], '');
      doc.text(String(value).slice(0, 42), x + 2, y + 5.1);
      x += column.width;
    });
    y += rowHeight;
  });

  if (!rows.length) {
    doc.setTextColor(PDF_COLORS.muted);
    doc.text('Nessun passeggero con posto assegnato per questo viaggio.', 10, y + 12);
  }

  doc.setTextColor(PDF_COLORS.muted);
  doc.setFontSize(8);
  doc.text(`Generato il ${new Date().toLocaleString('it-IT')}`, 10, 205);
  return doc.output('blob');
}

export function openPdfBlob(pdfBlob) {
  const url = URL.createObjectURL(pdfBlob);
  window.open(url, '_blank');
}

export function downloadPdfBlob(pdfBlob, fileName) {
  const link = document.createElement('a');
  const url = URL.createObjectURL(pdfBlob);
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

