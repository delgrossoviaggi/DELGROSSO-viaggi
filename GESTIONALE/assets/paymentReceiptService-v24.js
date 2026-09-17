import { t as JsPDF } from './jspdf.es.min-DT2zzJUL.js';

const SUPABASE_URL = 'https://chkuayhbmitdmzmmvona.supabase.co';
const SUPABASE_KEY = 'sb_publishable_H29K1BV5ZE1rT8xo0PIzVA_wF6zC7je';
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/send-payment-receipt`;

const money = v => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v || 0));
const dateIt = v => {
  const d = new Date(`${String(v || '').slice(0,10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? String(v || '—') : d.toLocaleDateString('it-IT');
};
const safe = v => String(v ?? '').trim() || '—';
const esc = v => String(v ?? '').trim();
const numberValue = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const seatCount = booking => {
  const declared = numberValue(booking?.posti);
  if (declared > 0) return Math.round(declared);
  const selected = booking?.posti_selezionati;
  if (Array.isArray(selected)) return selected.length;
  if (typeof selected === 'string' && selected.trim()) {
    try { const parsed = JSON.parse(selected); if (Array.isArray(parsed)) return parsed.length; } catch {}
    return selected.split(/[,;|\s]+/).filter(Boolean).length;
  }
  return 1;
};

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

async function loadLogo() {
  const candidates = ['./assets/logo-delgrosso-v54.png', './assets/logo-sidebar.png'];
  for (const src of candidates) {
    try {
      const response = await fetch(src);
      if (!response.ok) continue;
      const blob = await response.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {}
  }
  return null;
}

export async function buildPaymentReceipt(payment = {}, booking = {}, trip = {}, totals = {}) {
  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'A4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const margin = 15;
  const width = W - margin * 2;
  const type = payment.tipo === 'Saldo' ? 'SALDO' : 'ACCONTO';
  const number = payment.receipt_number || receiptNumber(payment);

  const customer = safe(booking.cliente_nome || booking.cliente || payment.cliente || `${booking.nome || ''} ${booking.cognome || ''}`);
  const email = safe(booking.email || booking.cliente_email || payment.email);
  const tripName = safe(trip.titolo || trip.destinazione || booking.viaggio || booking.viaggio_codice || payment.viaggio);
  const persons = seatCount(booking);
  const unitPrice = numberValue(trip.prezzo ?? trip.prezzo_persona ?? booking.prezzo ?? payment.prezzo);
  const bookingTotal = numberValue(booking.totale);
  const total = bookingTotal > 0 ? bookingTotal : (unitPrice > 0 ? persons * unitPrice : numberValue(totals.totalDue ?? payment.totale));
  const paymentAmount = numberValue(payment.importo);
  const paidBefore = numberValue(totals.paidBefore ?? Math.max(numberValue(totals.paidAfter) - paymentAmount, 0));
  const paidAfter = numberValue(totals.paidAfter ?? (paidBefore + paymentAmount));
  const residual = Math.max(numberValue(totals.residualAfter ?? (total - paidAfter)), 0);
  const tripDate = dateIt(trip.data_partenza || trip.data_viaggio);
  const departure = safe(trip.luogo_partenza || trip.partenza);
  const logo = await loadLogo();

  // Intestazione aziendale con il logo reale già presente nel Gestionale.
  doc.setFillColor(15,76,129); doc.rect(0,0,W,34,'F');
  if (logo) {
    try { doc.addImage(logo, 'PNG', margin, 5, 34, 24, undefined, 'FAST'); } catch {}
  }
  const brandX = logo ? margin + 40 : margin;
  doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(18); doc.text('DELGROSSO VIAGGI', brandX, 14);
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.text('& LIMOUSINE BUS', brandX, 20);
  doc.setFontSize(10); doc.text('RICEVUTA DI PAGAMENTO', W - margin, 13, { align: 'right' });
  doc.setFontSize(8); doc.text(number, W - margin, 20, { align: 'right' });

  let y = 45;
  doc.setTextColor(15,76,129); doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.text(`RICEVUTA ${type}`, margin, y); y += 9;
  doc.setDrawColor(215,226,236); doc.line(margin,y,W-margin,y); y += 9;

  addField(doc,'Cliente',customer,margin,y,85);
  addField(doc,'Data pagamento',dateIt(payment.data_pagamento),105,y,90); y += 18;
  addField(doc,'Email',email,margin,y,85);
  addField(doc,'Metodo',payment.metodo_pagamento || payment.metodo,105,y,90); y += 20;

  doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(15,76,129); doc.text('DETTAGLI DEL VIAGGIO',margin,y); y += 7;
  doc.setFillColor(247,249,252); doc.roundedRect(margin,y,width,44,3,3,'F');
  addField(doc,'Viaggio',tripName,margin+5,y+7,width-10);
  addField(doc,'Data viaggio',tripDate,margin+5,y+25,55);
  addField(doc,'Partenza',departure,75,y+25,55);
  addField(doc,'Posti prenotati',persons,140,y+25,40);
  y += 52;

  doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(15,76,129); doc.text('RIEPILOGO PRENOTAZIONE ED ECONOMICO',margin,y); y += 8;
  const rows = [
    ['Posti prenotati', String(persons)],
    ['Quota totale della prenotazione', money(total)],
    ['Somme già versate prima di questo movimento', money(paidBefore)],
    ['Somma ricevuta con questa ricevuta', money(paymentAmount)],
    ['Totale versato dopo questo movimento', money(paidAfter)],
    ['Quota residua da versare', money(residual)]
  ];
  rows.forEach(([label,value], idx) => {
    doc.setFillColor(idx % 2 ? 252 : 247, idx % 2 ? 253 : 249, idx % 2 ? 255 : 252);
    doc.roundedRect(margin,y,width,11,2,2,'F');
    doc.setTextColor(55,65,81); doc.setFont('helvetica', idx === 1 || idx === 3 || idx === 5 ? 'bold' : 'normal'); doc.setFontSize(9); doc.text(label,margin+5,y+7);
    doc.setTextColor(15,76,129); doc.setFont('helvetica','bold'); doc.text(value,W-margin-5,y+7,{align:'right'}); y += 13;
  });

  y += 7; doc.setFillColor(15,76,129); doc.roundedRect(margin,y,width,27,3,3,'F');
  doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(10);
  doc.text('SOMMA RICEVUTA',margin+6,y+10); doc.setFontSize(16); doc.text(money(paymentAmount),W-margin-6,y+16,{align:'right'});
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.text(`Pagamento registrato per ${persons} posto${persons === 1 ? '' : 'i'} prenotato/i`,margin+6,y+20);

  y += 39; doc.setTextColor(75,85,99); doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
  const note = residual > 0
    ? `Il presente documento attesta la ricezione della somma indicata. Per la prenotazione sopra riportata resta da versare ${money(residual)}.`
    : 'Il presente documento attesta la ricezione della somma indicata. La prenotazione risulta integralmente pagata.';
  doc.text(doc.splitTextToSize(note,width),margin,y);

  doc.setDrawColor(215,226,236); doc.line(margin,H-25,W-margin,H-25);
  doc.setFontSize(8); doc.setTextColor(100,116,139);
  doc.text('DELGROSSO VIAGGI & LIMOUSINE BUS',margin,H-18);
  doc.text('info@delgrossoviaggi.it  •  +39 320 573 0466',margin,H-13);
  doc.text('Ricevuta generata dal Gestionale Del Grosso',W-margin,H-13,{align:'right'});

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
  const emailPresent = String(booking?.email || booking?.cliente_email || payment?.email || '').trim().length > 0;
  const emailSent = data.emailSent !== false;
  if (!emailPresent) downloadPaymentReceipt(built.blob, built.receiptNumber);
  return { ...built, ...data, emailSent, localDownloaded: !emailPresent };
}

export function downloadPaymentReceipt(blob, number = 'ricevuta') {
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=`Ricevuta_Pagamento_${number}.pdf`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export async function downloadStoredReceipt(path, number = 'ricevuta') {
  const response = await fetch(FUNCTION_URL, { method:'POST', headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json'}, body:JSON.stringify({action:'signed_url',path}) });
  const data = await response.json().catch(()=>({}));
  if (!response.ok || !data.signedUrl) throw new Error(data.error || 'Ricevuta non disponibile.');
  const pdfResponse = await fetch(data.signedUrl);
  if (!pdfResponse.ok) throw new Error(`Download ricevuta non riuscito (${pdfResponse.status}).`);
  const blob = await pdfResponse.blob();
  downloadPaymentReceipt(blob, number);
  return true;
}

export async function openStoredReceipt(path) {
  const response = await fetch(FUNCTION_URL, { method:'POST', headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json'}, body:JSON.stringify({action:'signed_url',path}) });
  const data = await response.json().catch(()=>({}));
  if (!response.ok || !data.signedUrl) throw new Error(data.error || 'Ricevuta non disponibile.');
  window.open(data.signedUrl,'_blank','noopener');
  return data.signedUrl;
}

export function getReceiptNumber(payment){ return payment?.receipt_number || receiptNumber(payment); }

window.DGPaymentReceipt = { buildPaymentReceipt, issuePaymentReceipt, downloadPaymentReceipt, downloadStoredReceipt, openStoredReceipt, getReceiptNumber };
