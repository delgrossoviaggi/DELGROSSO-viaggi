function normalizeText(value, fallback = '—') {
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
  if (Number.isNaN(parsed.getTime())) return normalizeText(value);
  return parsed.toLocaleDateString('it-IT', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

function formatCurrency(value) {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

export function buildQuoteSummary(quote = {}) {
  const customer = `${quote.nome || ''} ${quote.cognome || ''}`.trim() || 'Cliente';
  const proposalAmount = Number(quote.importo ?? quote.importo_preventivo ?? 0);
  const proposta = proposalAmount > 0
    ? formatCurrency(proposalAmount)
    : 'Da definire';

  return {
    code: normalizeText(quote.numero_preventivo || quote.codice, 'N/D'),
    customer,
    phone: normalizeText(quote.telefono),
    email: normalizeText(quote.email),
    company: normalizeText(quote.azienda, 'Privato'),
    destination: normalizeText(quote.destinazione),
    departure: normalizeText(quote.luogo_partenza || quote.partenza),
    departureDate: formatDateOnly(quote.data_viaggio || quote.data_partenza),
    returnDate: formatDateOnly(quote.data_ritorno),
    passengers: Math.max(Number(quote.numero_passeggeri || quote.passeggeri || 0), 1),
    proposal: proposta,
    validity: quote.validita_preventivo ? formatDateOnly(quote.validita_preventivo) : 'Da definire',
    service: normalizeText(quote.servizio || quote.servizio_richiesto),
    status: normalizeText(quote.stato, 'Nuovo'),
    offerDetails: normalizeText(quote.dettagli_offerta),
    customerNotes: normalizeText(quote.note_cliente),
    internalNotes: normalizeText(quote.note_interne)
  };
}

function buildTemplateMessage(template, summary) {
  const source = String(template || '').trim();
  if (!source) return '';
  return source.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_full, key) => {
    const value = summary?.[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

function buildQuoteWhatsAppMessage(summary) {
  const lines = [
    'Del Grosso Viaggi - Preventivo personalizzato',
    '',
    `Codice preventivo: ${summary.code}`,
    `Cliente: ${summary.customer}`,
    `Servizio: ${summary.service}`,
    `Destinazione: ${summary.destination}`,
    `Partenza da: ${summary.departure}`,
    `Data richiesta: ${summary.departureDate}`,
    `Rientro: ${summary.returnDate}`,
    `Passeggeri: ${summary.passengers}`,
    `Proposta economica: ${summary.proposal}`,
    `Validita: ${summary.validity}`,
    ''
  ];

  if (summary.offerDetails !== '—') {
    lines.push(`Dettagli offerta: ${summary.offerDetails}`, '');
  }

  lines.push('Per confermare o richiedere modifiche rispondi a questo messaggio.');
  return lines.join('\n');
}

function buildQuoteEmailBody(summary) {
  return [
    'Gentile cliente,',
    '',
    'di seguito il riepilogo del preventivo richiesto:',
    '',
    `Codice preventivo: ${summary.code}`,
    `Cliente: ${summary.customer}`,
    `Servizio: ${summary.service}`,
    `Destinazione: ${summary.destination}`,
    `Partenza da: ${summary.departure}`,
    `Data richiesta: ${summary.departureDate}`,
    `Rientro: ${summary.returnDate}`,
    `Passeggeri: ${summary.passengers}`,
    `Proposta economica: ${summary.proposal}`,
    `Validita: ${summary.validity}`,
    '',
    summary.offerDetails !== '—' ? `Dettagli offerta: ${summary.offerDetails}` : '',
    '',
    'Rimaniamo a disposizione per conferma o aggiornamenti.',
    'Del Grosso Viaggi & Limousine Bus'
  ].filter(Boolean).join('\n');
}

export function prepareQuoteWhatsAppDispatch({ quote = {}, recipientPhone, messageTemplate = '' } = {}) {
  const summary = buildQuoteSummary(quote);
  const recipient = normalizePhoneNumber(recipientPhone || quote.telefono);
  if (!recipient) {
    throw new Error('Numero WhatsApp del cliente non disponibile.');
  }

  const message = buildTemplateMessage(messageTemplate, summary) || buildQuoteWhatsAppMessage(summary);
  return {
    recipient,
    message,
    waMeUrl: `https://wa.me/${recipient}?text=${encodeURIComponent(message)}`
  };
}

export function prepareQuoteMailtoLink({ quote = {}, recipientEmail } = {}) {
  const summary = buildQuoteSummary(quote);
  const recipient = normalizeText(recipientEmail || quote.email, '');
  if (!recipient) {
    throw new Error('Email del cliente non disponibile.');
  }

  const subject = encodeURIComponent(`Preventivo ${summary.code} - Del Grosso Viaggi`);
  const body = encodeURIComponent(buildQuoteEmailBody(summary));
  return `mailto:${recipient}?subject=${subject}&body=${body}`;
}

export default {
  buildQuoteSummary,
  prepareQuoteWhatsAppDispatch,
  prepareQuoteMailtoLink
};
