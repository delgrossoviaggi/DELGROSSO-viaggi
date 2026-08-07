/**
 * Generazione Ricevute Prenotazione in PDF con QR Code
 */

import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import defaultLogoUrl from '../assets/images/logo.JPEG';
import { buildBookingQrPayload } from '../utils/qrBookingUtils.js';
import { parseSeatSelection } from './seatAssignmentService.js';

const PDF_CONFIG = {
  orientation: 'portrait',
  unit: 'mm',
  format: 'A4',
  margins: { top: 15, left: 15, right: 15, bottom: 15 },
  colors: {
    brand: '#0F4C81',
    text: '#333333',
    lightGray: '#f5f5f5',
    border: '#d7e2ec',
    muted: '#6b7280',
    white: '#ffffff'
  },
  fonts: {
    title: 'helvetica',
    body: 'helvetica'
  }
};

function normalizeText(value, fallback = '—') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function formatBookingNumber(value) {
  const text = String(value ?? '').trim();
  return text || 'N/A';
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
  const seats = parseSeatSelection(value)
    .map((seat) => seat.padStart(2, '0'));
  return seats.length ? seats.join(', ') : '—';
}

function toAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(toAmount(value));
}

function normalizePaymentStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  if (status.includes('rimbors')) return 'Rimborsato';
  if (status.includes('pagat') || status.includes('saldat')) return 'Pagato';
  if (status.includes('acconto') || status.includes('parzial')) return 'Acconto Ricevuto';
  return 'Da Pagare';
}

function buildPaymentSnapshot(booking = {}) {
  const totalDue = Math.max(toAmount(booking.totale ?? booking.importo), 0);
  const paid = Math.max(toAmount(booking.pagato ?? booking.acconto), 0);
  const residualRaw = booking.saldo !== undefined ? toAmount(booking.saldo) : totalDue - paid;
  const residual = Math.max(residualRaw, 0);
  const status = normalizePaymentStatus(booking.stato_pagamento || booking.payment_status || booking.stato_pagamento_label);
  return { totalDue, paid, residual, status };
}

async function dataUrlFromUrl(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Impossibile caricare il logo (${response.status}).`);
  }

  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Impossibile leggere il logo aziendale.'));
    reader.readAsDataURL(blob);
  });
}

async function resolveLogoDataUrl(company = {}) {
  const source = String(company.logo || defaultLogoUrl || '').trim();
  if (!source) return null;
  if (source.startsWith('data:')) return source;

  try {
    return await dataUrlFromUrl(source);
  } catch (error) {
    console.error('Caricamento logo ricevuta non riuscito:', error);
    return null;
  }
}

async function generateQRCode(data) {
  try {
    return await QRCode.toDataURL(data, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 200,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
  } catch (error) {
    console.error('Errore generazione QR:', error);
    throw new Error('Impossibile generare QR Code');
  }
}

function drawField(doc, options) {
  const {
    label,
    value,
    x,
    y,
    width,
    height = 14
  } = options;
  const { colors } = PDF_CONFIG;

  doc.setDrawColor(colors.border);
  doc.setFillColor(colors.white);
  doc.roundedRect(x, y, width, height, 2, 2, 'FD');

  doc.setFont(PDF_CONFIG.fonts.body, 'bold');
  doc.setFontSize(8);
  doc.setTextColor(colors.muted);
  doc.text(label.toUpperCase(), x + 3, y + 4.5);

  doc.setFont(PDF_CONFIG.fonts.body, 'normal');
  doc.setFontSize(10);
  doc.setTextColor(colors.text);
  const content = doc.splitTextToSize(normalizeText(value), width - 6);
  doc.text(content, x + 3, y + 9.5);
}

export async function generateBookingReceipt(booking, trip, company = {}) {
  const doc = new jsPDF(PDF_CONFIG);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const { margins, colors } = PDF_CONFIG;
  const contentWidth = pageWidth - margins.left - margins.right;
  const gutter = 6;
  const columnWidth = (contentWidth - gutter) / 2;
  const fieldHeight = 14;
  const rowGap = 4;
  const bookingId = formatBookingNumber(booking.id || booking.codice);
  const [qrNameLine = '', qrSurnameLine = ''] = buildBookingQrPayload(booking, trip, company)
    .split('\n')
    .filter((line) => line.startsWith('Nome:') || line.startsWith('Cognome:'));
  const passenger = {
    name: qrNameLine.replace('Nome:', '').trim() || '—',
    surname: qrSurnameLine.replace('Cognome:', '').trim() || '—'
  };
  const departurePlace = normalizeText(trip?.luogo_partenza || trip?.partenza);
  const destination = normalizeText(trip?.destinazione || trip?.titolo);
  const departureDate = formatDateOnly(trip?.data_partenza);
  const departureTime = formatTimeOnly(trip?.ora_partenza);
  const selectedSeat = formatSeats(booking.posti_selezionati || booking.posti);
  const payment = buildPaymentSnapshot(booking);
  const companyName = normalizeText(company.name || 'Del Grosso Viaggi & Limousine Bus');
  const companyPhone = normalizeText(company.phone || '+39 320 5730466');
  const companyEmail = normalizeText(company.email || 'info@delgrossoviaggi.it');
  const receiptTitle = normalizeText(company.receiptTitle || 'RICEVUTA PRENOTAZIONE');
  const receiptFooter = normalizeText(company.receiptFooter || 'Documento generato automaticamente dal sistema Del Grosso Booking Pro.');
  const qrNote = normalizeText(company.qrNote || 'Scansiona il QR Code per consultare rapidamente i dettagli della ricevuta prenotazione.');
  const bookingDate = formatDateOnly(booking.created_at || new Date().toISOString());
  const qrData = buildBookingQrPayload(booking, trip, company);
  const qrCodeDataUrl = await generateQRCode(qrData);
  const logoDataUrl = await resolveLogoDataUrl(company);

  doc.setFillColor(colors.brand);
  doc.rect(0, 0, pageWidth, 26, 'F');

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'JPEG', margins.left, 6, 24, 24);
  }

  doc.setFont(PDF_CONFIG.fonts.title, 'bold');
  doc.setFontSize(17);
  doc.setTextColor(colors.white);
  doc.text(companyName, margins.left + 30, 14);

  doc.setFont(PDF_CONFIG.fonts.body, 'normal');
  doc.setFontSize(9);
  doc.text(receiptTitle, margins.left + 30, 20);

  let yPos = 34;
  doc.setFontSize(11);
  doc.setFont(PDF_CONFIG.fonts.title, 'bold');
  doc.setTextColor(colors.brand);
  doc.text('Dettagli prenotazione', margins.left, yPos);
  yPos += 6;

  drawField(doc, { label: 'Numero prenotazione', value: bookingId, x: margins.left, y: yPos, width: columnWidth, height: fieldHeight });
  drawField(doc, { label: 'Data emissione', value: bookingDate, x: margins.left + columnWidth + gutter, y: yPos, width: columnWidth, height: fieldHeight });
  yPos += fieldHeight + rowGap;

  drawField(doc, { label: 'Nome', value: passenger.name, x: margins.left, y: yPos, width: columnWidth, height: fieldHeight });
  drawField(doc, { label: 'Cognome', value: passenger.surname, x: margins.left + columnWidth + gutter, y: yPos, width: columnWidth, height: fieldHeight });
  yPos += fieldHeight + rowGap;

  drawField(doc, { label: 'Telefono', value: booking.telefono, x: margins.left, y: yPos, width: columnWidth, height: fieldHeight });
  drawField(doc, { label: 'Email', value: booking.email, x: margins.left + columnWidth + gutter, y: yPos, width: columnWidth, height: fieldHeight });
  yPos += fieldHeight + rowGap + 3;

  doc.setFontSize(11);
  doc.setFont(PDF_CONFIG.fonts.title, 'bold');
  doc.setTextColor(colors.brand);
  doc.text('Dettagli viaggio', margins.left, yPos);
  yPos += 6;

  drawField(doc, { label: 'Destinazione', value: destination, x: margins.left, y: yPos, width: contentWidth, height: fieldHeight });
  yPos += fieldHeight + rowGap;

  drawField(doc, { label: 'Data', value: departureDate, x: margins.left, y: yPos, width: columnWidth, height: fieldHeight });
  drawField(doc, { label: 'Ora', value: departureTime, x: margins.left + columnWidth + gutter, y: yPos, width: columnWidth, height: fieldHeight });
  yPos += fieldHeight + rowGap;

  drawField(doc, { label: 'Luogo partenza', value: departurePlace, x: margins.left, y: yPos, width: columnWidth, height: fieldHeight });
  drawField(doc, { label: 'Posto', value: selectedSeat, x: margins.left + columnWidth + gutter, y: yPos, width: columnWidth, height: fieldHeight });
  yPos += fieldHeight + rowGap;

  drawField(doc, {
    label: 'Situazione pagamento',
    value: `${payment.status} • ${formatCurrency(payment.paid)} / ${formatCurrency(payment.totalDue)} • Residuo ${formatCurrency(payment.residual)}`,
    x: margins.left,
    y: yPos,
    width: contentWidth,
    height: fieldHeight
  });
  yPos += fieldHeight + 6;

  const qrSize = 42;
  doc.setDrawColor(colors.border);
  doc.setFillColor(colors.lightGray);
  doc.roundedRect(margins.left, yPos, contentWidth, 56, 3, 3, 'FD');
  doc.addImage(qrCodeDataUrl, 'PNG', margins.left + 5, yPos + 7, qrSize, qrSize);

  doc.setFont(PDF_CONFIG.fonts.title, 'bold');
  doc.setFontSize(11);
  doc.setTextColor(colors.brand);
  doc.text('QR Code prenotazione', margins.left + qrSize + 12, yPos + 14);
  doc.setFont(PDF_CONFIG.fonts.body, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(colors.text);
  const qrDescription = doc.splitTextToSize(
    qrNote,
    contentWidth - qrSize - 20
  );
  doc.text(qrDescription, margins.left + qrSize + 12, yPos + 22);
  doc.setFont(PDF_CONFIG.fonts.body, 'bold');
  doc.text(`POSTO: ${selectedSeat}`, margins.left + qrSize + 12, yPos + 40);
  doc.text(`NUMERO PRENOTAZIONE: ${bookingId}`, margins.left + qrSize + 12, yPos + 47);

  const footerY = pageHeight - 20;
  doc.setDrawColor(colors.border);
  doc.line(margins.left, footerY - 5, pageWidth - margins.right, footerY - 5);
  doc.setFont(PDF_CONFIG.fonts.body, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(colors.muted);
  doc.text(companyName, margins.left, footerY);
  doc.text(`Tel. ${companyPhone}  •  ${companyEmail}`, margins.left, footerY + 4.5);
  doc.text(receiptFooter, margins.left, footerY + 9);
  doc.text(`Documento generato il ${new Date().toLocaleString('it-IT')}`, margins.left, footerY + 13.5);

  return doc.output('blob');
}

export function downloadReceipt(pdfBlob, bookingId) {
  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Ricevuta_Prenotazione_${bookingId}_${Date.now()}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function openReceiptInNewWindow(pdfBlob) {
  const url = URL.createObjectURL(pdfBlob);
  window.open(url, '_blank');
}

export default {
  generateBookingReceipt,
  downloadReceipt,
  openReceiptInNewWindow
};
