import { n as JsPDF } from './jspdf.es.min-DT2zzJUL.js';

const SUPABASE_URL = 'https://chkuayhbmitdmzmmvona.supabase.co';
const SUPABASE_KEY = 'sb_publishable_H29K1BV5ZE1rT8xo0PIzVA_wF6zC7je';
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/send-payment-receipt`;

const money = v => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(v || 0));
const dateIt = v => {
  const d = new Date(`${String(v || '').slice(0,10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? String(v || '—') : d.toLocaleDateString('it-IT');
};
const safe = v => String(v ?? '').trim() || '—';
const esc = v => String(v ?? '').trim();

function receiptNumber(payment) {
  const y = String(payment?.data_pagamento || payment?.created_at || new Date().toISOString()).slice(0,4);
  const id = String(payment?.id || crypto.randomUUID()).replace(/[^a-zA-Z0-9]/g, '').slice(0,8).toUpperCase();
  return `DG-${y}-${id}`;
}

function addField(doc, label, value, x, y, w = 80) {
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(100,116,139); doc.text(label.toUpperCase(), x, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(31,41,55);
  const lines = doc.splitTextToSize(safe(value), w - 4); doc.text(lines, x, y + 5);
}

export async function buildPaymentReceipt(payment = {}, booking = {}, trip = {}, totals = {}) {
  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'A4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const margin = 15;
  const width = W - margin * 2;
  const type = payment.tipo === 'Saldo' ? 'SALDO' : 'ACCONTO';
  const number = payment.receipt_number || receiptNumber(payment);
  const customer = safe(booking.cliente_nome || booking.cliente || payment.cliente);
  const email = safe(booking.email || booking.cliente_email || payment.email);
  const tripName = safe(trip.titolo || trip.destinazione || booking.viaggio_codice || payment.viaggio);
  const total = Number(totals.totalDue ?? booking.totale ?? payment.totale ?? payment.importo ?? 0);
  const paid = Number(totals.paidAfter ?? payment.paid_after ?? payment.pagato ?? payment.importo ?? 0);
  const residual = Math.max(Number(totals.residualAfter ?? total - paid), 0);

  doc.setFillColor(15,76,129); doc.rect(0,0,W,30,'F');
  doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(18); doc.text('DELGROSSO VIAGGI', margin, 13);
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.text('& LIMOUSINE BUS', margin, 19);
  doc.setFontSize(10); doc.text('RICEVUTA DI PAGAMENTO', W - margin, 12, { align: 'right' });
  doc.setFontSize(8); doc.text(number, W - margin, 18, { align: 'right' });

  let y = 42;
  doc.setTextColor(15,76,129); doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.text(`RICEVUTA ${type}`, margin, y); y += 9;
  doc.setDrawColor(215,226,236); doc.line(margin,y,W-margin,y); y += 9;

  addField(doc,'Partecipante',customer,margin,y,85); addField(doc,'Data pagamento',dateIt(payment.data_pagamento),105,y,90); y += 18;
  addField(doc,'Email',email,margin,y,85); addField(doc,'Metodo',payment.metodo_pagamento || payment.metodo,105,y,90); y += 20;

  doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(15,76,129); doc.text('DETTAGLI DEL VIAGGIO',margin,y); y += 7;
  doc.setFillColor(247,249,252); doc.roundedRect(margin,y,width,30,3,3,'F');
  addField(doc,'Viaggio',tripName,margin+5,y+7,width-10); y += 38;

  doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(15,76,129); doc.text('RIEPILOGO ECONOMICO',margin,y); y += 8;
  const rows = [['Quota totale', money(total)],['Somma ricevuta', money(payment.importo)],['Totale già pagato dopo il movimento', money(paid)],['Residuo', money(residual)]];
  rows.forEach(([label,value], idx) => {
    doc.setFillColor(idx % 2 ? 252 : 247, idx % 2 ? 253 : 249, idx % 2 ? 255 : 252);
    doc.roundedRect(margin,y,width,12,2,2,'F');
    doc.setTextColor(55,65,81); doc.setFont('helvetica', idx === 1 ? 'bold' : 'normal'); doc.setFontSize(9); doc.text(label,margin+5,y+7);
    doc.setTextColor(15,76,129); doc.setFont('helvetica','bold'); doc.text(value,W-margin-5,y+7,{align:'right'}); y += 14;
  });

  y += 8; doc.setFillColor(15,76,129); doc.roundedRect(margin,y,width,25,3,3,'F');
  doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(10);
  doc.text('SOMMA RICEVUTA',margin+6,y+9); doc.setFontSize(16); doc.text(money(payment.importo),W-margin-6,y+16,{align:'right'});
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.text('Somma ricevuta da DELGROSSO VIAGGI & LIMOUSINE BUS',margin+6,y+18);

  y += 37; doc.setTextColor(75,85,99); doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
  const note = 'Il presente documento attesta la ricezione della somma indicata in relazione alla quota del viaggio sopra specificato.';
  doc.text(doc.splitTextToSize(note,width),margin,y);
  doc.setDrawColor(215,226,236); doc.line(margin,H-25,W-margin,H-25);
  doc.setFontSize(8); doc.setTextColor(100,116,139); doc.text('DELGROSSO VIAGGI & LIMOUSINE BUS',margin,H-18); doc.text('info@delgrossoviaggi.it  •  +39 320 573 0466',margin,H-13); doc.text('Ricevuta generata dal Gestionale Del Grosso',W-margin,H-13,{align:'right'});

  return { blob: doc.output('blob'), receiptNumber: number };
}

async function blobToBase64(blob) {
  const buf = await blob.arrayBuffer();
  let binary = ''; const bytes = new Uint8Array(buf); const chunk = 0x8000;
  for (let i=0;i<bytes.length;i+=chunk) binary += String.fromCharCode(...bytes.subarray(i,Math.min(i+chunk,bytes.length)));
  return btoa(binary);
}

export async function issuePaymentReceipt(payment, booking, trip, totals = {}) {
  const built = await buildPaymentReceipt(payment, booking, trip, totals);
  const pdfBase64 = await blobToBase64(built.blob);
  const response = await fetch(FUNCTION_URL, {
    method:'POST', headers:{ apikey:SUPABASE_KEY, Authorization:`Bearer ${SUPABASE_KEY}`, 'Content-Type':'application/json' },
    body: JSON.stringify({
      payment: { ...payment, receipt_number: built.receiptNumber },
      booking: { ...booking }, trip: { ...trip }, totals, pdfBase64
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.error || `Invio ricevuta non riuscito (${response.status}).`);
  return { ...built, ...data, emailSent: data.emailSent !== false };
}

export function downloadPaymentReceipt(blob, number = 'ricevuta') {
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=`Ricevuta_Pagamento_${number}.pdf`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export async function openStoredReceipt(path) {
  const response = await fetch(FUNCTION_URL, { method:'POST', headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json'}, body:JSON.stringify({action:'signed_url',path}) });
  const data = await response.json().catch(()=>({}));
  if (!response.ok || !data.signedUrl) throw new Error(data.error || 'Ricevuta non disponibile.');
  window.open(data.signedUrl,'_blank','noopener');
  return data.signedUrl;
}

export function getReceiptNumber(payment){ return payment?.receipt_number || receiptNumber(payment); }

window.DGPaymentReceipt = { buildPaymentReceipt, issuePaymentReceipt, downloadPaymentReceipt, openStoredReceipt, getReceiptNumber };
