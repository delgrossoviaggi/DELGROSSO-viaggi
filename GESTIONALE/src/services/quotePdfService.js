import { jsPDF } from 'jspdf';
import defaultLogoUrl from '../assets/images/logo.JPEG';
import { buildQuoteSummary } from './quoteCommunicationService.js';

const PDF_COLORS = {
  brand: '#0F4C81',
  text: '#1f2937',
  muted: '#6b7280',
  border: '#d7e2ec',
  white: '#ffffff',
  soft: '#f8fafc'
};

function normalizeText(value, fallback = '—') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

async function dataUrlFromUrl(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Impossibile caricare il logo (${response.status}).`);
  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Impossibile leggere il logo.'));
    reader.readAsDataURL(blob);
  });
}

async function resolveLogoDataUrl(company = {}) {
  const source = String(company.logo || defaultLogoUrl || '').trim();
  if (!source) return null;
  if (source.startsWith('data:')) return source;
  try {
    return await dataUrlFromUrl(source);
  } catch (_error) {
    return null;
  }
}

function drawField(doc, { label, value, x, y, width, height = 15 }) {
  doc.setDrawColor(PDF_COLORS.border);
  doc.setFillColor(PDF_COLORS.white);
  doc.roundedRect(x, y, width, height, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(PDF_COLORS.muted);
  doc.text(String(label || '').toUpperCase(), x + 3, y + 4.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(PDF_COLORS.text);
  const content = doc.splitTextToSize(normalizeText(value), width - 6);
  doc.text(content, x + 3, y + 10);
}

export async function generateQuotePdf(quote, company = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'A4' });
  const summary = buildQuoteSummary(quote);
  const logo = await resolveLogoDataUrl(company);
  const companyName = normalizeText(company.name || 'Del Grosso Viaggi & Limousine Bus');
  const companyPhone = normalizeText(company.phone || '+39 320 5730466');
  const companyEmail = normalizeText(company.email || 'info@delgrossoviaggi.it');

  const pageWidth = doc.internal.pageSize.getWidth();
  const left = 15;
  const right = 15;
  const contentWidth = pageWidth - left - right;
  const gutter = 6;
  const half = (contentWidth - gutter) / 2;

  doc.setFillColor(PDF_COLORS.brand);
  doc.rect(0, 0, pageWidth, 28, 'F');

  if (logo) {
    doc.addImage(logo, 'JPEG', left, 5, 24, 18);
  }

  doc.setTextColor(PDF_COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text(companyName, left + 28, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('PREVENTIVO COMMERCIALE', left + 28, 19);

  let y = 36;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(PDF_COLORS.brand);
  doc.text('Riepilogo richiesta', left, y);
  y += 6;

  drawField(doc, { label: 'Codice preventivo', value: summary.code, x: left, y, width: half });
  drawField(doc, { label: 'Stato', value: summary.status, x: left + half + gutter, y, width: half });
  y += 19;
  drawField(doc, { label: 'Cliente', value: summary.customer, x: left, y, width: half });
  drawField(doc, { label: 'Azienda', value: summary.company, x: left + half + gutter, y, width: half });
  y += 19;
  drawField(doc, { label: 'Telefono', value: summary.phone, x: left, y, width: half });
  drawField(doc, { label: 'Email', value: summary.email, x: left + half + gutter, y, width: half });
  y += 19;
  drawField(doc, { label: 'Servizio', value: summary.service, x: left, y, width: half });
  drawField(doc, { label: 'Passeggeri', value: summary.passengers, x: left + half + gutter, y, width: half });
  y += 19;
  drawField(doc, { label: 'Destinazione', value: summary.destination, x: left, y, width: half });
  drawField(doc, { label: 'Partenza da', value: summary.departure, x: left + half + gutter, y, width: half });
  y += 19;
  drawField(doc, { label: 'Data richiesta', value: summary.departureDate, x: left, y, width: half });
  drawField(doc, { label: 'Rientro', value: summary.returnDate, x: left + half + gutter, y, width: half });
  y += 19;
  drawField(doc, { label: 'Proposta economica', value: summary.proposal, x: left, y, width: half });
  drawField(doc, { label: 'Validita offerta', value: summary.validity, x: left + half + gutter, y, width: half });
  y += 19;
  y += 3;

  const sections = [
    { title: 'Dettagli offerta', content: summary.offerDetails },
    { title: 'Note cliente', content: summary.customerNotes },
    { title: 'Note interne', content: summary.internalNotes }
  ];

  sections.forEach((section) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(PDF_COLORS.brand);
    doc.text(section.title, left, y);
    y += 3;
    doc.setDrawColor(PDF_COLORS.border);
    doc.setFillColor(PDF_COLORS.soft);
    const textLines = doc.splitTextToSize(normalizeText(section.content), contentWidth - 8);
    const boxHeight = Math.max(20, 8 + (textLines.length * 5.2));
    doc.roundedRect(left, y + 2, contentWidth, boxHeight, 3, 3, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(PDF_COLORS.text);
    doc.text(textLines, left + 4, y + 9);
    y += boxHeight + 10;
  });

  doc.setDrawColor(PDF_COLORS.border);
  doc.line(left, 275, pageWidth - right, 275);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(PDF_COLORS.muted);
  doc.text(`${companyName} · ${companyPhone} · ${companyEmail}`, left, 282);

  return doc.output('blob');
}

export async function downloadQuotePdf(quote, company = {}) {
  const blob = await generateQuotePdf(quote, company);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const code = normalizeText(quote?.numero_preventivo || quote?.codice, 'preventivo');
  link.download = `${code.replace(/[^\w-]+/g, '_')}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  return blob;
}

export default {
  generateQuotePdf,
  downloadQuotePdf
};
