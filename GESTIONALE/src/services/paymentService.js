import { getPrenotazione, listTableRows, updatePrenotazione } from '../../js/delgrosso-api.js';
import { BaseService, createServiceResult, createServiceError } from './baseService.js';
import { notify } from './notificationService.js';
import { extractData } from '../utils/serviceResult.js';

export const PAYMENT_TYPES = ['Acconto', 'Saldo', 'Rimborso', 'Altro'];
export const PAYMENT_METHODS = ['Contanti', 'POS', 'Bonifico', 'Carta', 'PayPal', 'Altro'];
export const PAYMENT_STATUS = {
  pending: 'Da Pagare',
  partial: 'Acconto Ricevuto',
  paid: 'Pagato',
  refunded: 'Rimborsato'
};

const PAYMENT_COLUMNS = new Set([
  'id', 'viaggio_id', 'prenotazione_id', 'cliente', 'viaggio', 'persone',
  'ricevuta', 'importo', 'totale', 'acconto', 'saldo', 'pagato', 'tipo', 'stato', 'metodo',
  'metodo_pagamento', 'data_pagamento', 'scadenza', 'note', 'created_at', 'updated_at'
]);

function pickColumns(record = {}, { includeId = false } = {}) {
  const next = {};
  for (const [key, value] of Object.entries(record || {})) {
    if (!PAYMENT_COLUMNS.has(key)) continue;
    if (!includeId && key === 'id') continue;
    if (value === undefined) continue;
    next[key] = value;
  }
  return next;
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function roundCurrency(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function hasIdentifier(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized !== '' && normalized !== 'undefined' && normalized !== 'null';
}

function normalizePaymentType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'saldo') return 'Saldo';
  if (normalized === 'rimborso') return 'Rimborso';
  if (normalized === 'altro' || normalized === 'pagamento') return 'Altro';
  return 'Acconto';
}

function normalizePaymentMethod(value) {
  const normalized = String(value || '').trim();
  return PAYMENT_METHODS.includes(normalized) ? normalized : 'Contanti';
}

export function getPaymentAbsoluteAmount(payment) {
  return roundCurrency(Math.abs(toNumber(payment?.importo ?? payment?.pagato ?? payment?.acconto ?? payment?.totale, 0)));
}

export function getPaymentSignedAmount(payment) {
  const type = normalizePaymentType(payment?.tipo);
  const rawAmount = toNumber(payment?.importo, Number.NaN);
  if (Number.isFinite(rawAmount)) {
    if (type === 'Rimborso' && rawAmount > 0) return roundCurrency(-rawAmount);
    if (type !== 'Rimborso' && rawAmount < 0) return roundCurrency(Math.abs(rawAmount));
    return roundCurrency(rawAmount);
  }
  const absoluteAmount = getPaymentAbsoluteAmount(payment);
  return type === 'Rimborso' ? roundCurrency(-absoluteAmount) : absoluteAmount;
}

export function getPaymentDate(payment) {
  return payment?.data_pagamento || payment?.created_at || payment?.updated_at || null;
}

function comparePayments(left, right) {
  const primaryDiff = new Date(getPaymentDate(right) || 0).getTime() - new Date(getPaymentDate(left) || 0).getTime();
  if (primaryDiff !== 0) return primaryDiff;
  return new Date(right?.created_at || right?.updated_at || 0).getTime()
    - new Date(left?.created_at || left?.updated_at || 0).getTime();
}

function isPaymentsTableMissing(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes("could not find the table 'public.pagamenti'")
    || message.includes('relation "public.pagamenti" does not exist');
}

function isPaymentColumnMissing(error, column) {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes(String(column || '').toLowerCase())
    && (message.includes('does not exist') || message.includes('schema cache') || message.includes('could not find'));
}

function mapPaymentsTableError(error) {
  if (isPaymentsTableMissing(error)) {
    return new Error('Modulo pagamenti non disponibile nello schema Supabase live. Eseguire la migration della tabella "pagamenti".');
  }
  return error instanceof Error ? error : new Error(String(error || 'Operazione pagamenti non riuscita.'));
}

export function buildBookingPaymentSummary(booking = {}, payments = []) {
  const bookingTotal = roundCurrency(toNumber(booking?.totale ?? booking?.importo, 0));
  const movements = (Array.isArray(payments) ? payments : []).map((payment) => mapPaymentResponse(payment));
  const legacyPaid = roundCurrency(toNumber(booking?.pagato ?? booking?.acconto, 0));
  const legacyDeposit = roundCurrency(toNumber(booking?.acconto, legacyPaid));
  const paidNet = movements.length
    ? roundCurrency(movements.reduce((sum, payment) => sum + getPaymentSignedAmount(payment), 0))
    : legacyPaid;
  const paidGross = movements.length
    ? roundCurrency(movements
      .filter((payment) => getPaymentSignedAmount(payment) > 0)
      .reduce((sum, payment) => sum + getPaymentSignedAmount(payment), 0))
    : legacyPaid;
  const depositTotal = movements.length
    ? roundCurrency(movements
      .filter((payment) => normalizePaymentType(payment.tipo) === 'Acconto')
      .reduce((sum, payment) => sum + Math.max(getPaymentSignedAmount(payment), 0), 0))
    : legacyDeposit;
  const balanceTotal = movements.length
    ? roundCurrency(movements
      .filter((payment) => normalizePaymentType(payment.tipo) === 'Saldo')
      .reduce((sum, payment) => sum + Math.max(getPaymentSignedAmount(payment), 0), 0))
    : roundCurrency(Math.max(legacyPaid - legacyDeposit, 0));
  const refundTotal = movements.length
    ? roundCurrency(movements
      .filter((payment) => normalizePaymentType(payment.tipo) === 'Rimborso')
      .reduce((sum, payment) => sum + Math.abs(getPaymentSignedAmount(payment)), 0))
    : 0;
  const expectedResidual = roundCurrency(Math.max(bookingTotal - legacyPaid, 0));
  const legacyResidual = roundCurrency(Math.max(toNumber(booking?.saldo, expectedResidual), 0));
  const residual = movements.length
    ? roundCurrency(Math.max(bookingTotal - paidNet, 0))
    : roundCurrency(Math.max(expectedResidual, legacyResidual));
  const latestMovement = movements.slice().sort(comparePayments)[0] || null;

  let status = PAYMENT_STATUS.pending;
  if (movements.length > 0 && paidNet <= 0 && refundTotal > 0) status = PAYMENT_STATUS.refunded;
  else if (bookingTotal > 0 && paidNet >= bookingTotal) status = PAYMENT_STATUS.paid;
  else if (paidNet > 0) status = PAYMENT_STATUS.partial;

  return {
    totalDue: bookingTotal,
    paidNet,
    paidGross,
    residual,
    depositTotal,
    balanceTotal,
    refundTotal,
    paymentCount: movements.length,
    hasPayments: movements.length > 0,
    status,
    latestMethod: latestMovement?.metodo_pagamento || latestMovement?.metodo || booking?.metodo_pagamento || '',
    latestMovement,
    lastPaymentAt: getPaymentDate(latestMovement)
  };
}

function deriveBookingOperationalStatus(currentStatus, paymentStatus) {
  const current = String(currentStatus || '').trim();
  if (current.toLowerCase() === 'annullata') return 'Annullata';
  if (paymentStatus === PAYMENT_STATUS.paid) return 'Saldata';
  if (paymentStatus === PAYMENT_STATUS.partial) return current === 'Confermata' ? 'Confermata' : 'Acconto Ricevuto';
  if (paymentStatus === PAYMENT_STATUS.pending) return current === 'Confermata' ? 'Confermata' : 'In Attesa';
  return current || 'In Attesa';
}

function mapPaymentResponse(row) {
  if (!row || typeof row !== 'object') return row;
  const mapped = { ...row };
  mapped.tipo = normalizePaymentType(mapped.tipo);
  mapped.metodo_pagamento = normalizePaymentMethod(mapped.metodo_pagamento || mapped.metodo);
  mapped.metodo = mapped.metodo || mapped.metodo_pagamento;
  mapped.totale = roundCurrency(toNumber(mapped.totale ?? mapped.importo, 0));
  mapped.importo = getPaymentSignedAmount(mapped);
  mapped.acconto = mapped.tipo === 'Acconto' ? Math.abs(mapped.importo) : roundCurrency(toNumber(mapped.acconto, 0));
  mapped.pagato = roundCurrency(toNumber(mapped.pagato, mapped.importo));
  mapped.saldo = roundCurrency(toNumber(mapped.saldo, 0));
  mapped.stato = mapped.stato || (mapped.tipo === 'Rimborso' ? 'Rimborso registrato' : 'Registrato');
  return mapped;
}

function buildMovementPayload(payload = {}, existing = null) {
  const source = { ...(existing || {}), ...(payload || {}) };
  const now = new Date().toISOString();
  const tipo = normalizePaymentType(source.tipo);
  const absoluteAmount = roundCurrency(Math.abs(toNumber(source.importo ?? source.totale, 0)));
  const signedAmount = tipo === 'Rimborso' ? -absoluteAmount : absoluteAmount;

  return pickColumns({
    ...source,
    tipo,
    importo: signedAmount,
    totale: absoluteAmount,
    acconto: tipo === 'Acconto' ? absoluteAmount : 0,
    saldo: tipo === 'Saldo' ? absoluteAmount : 0,
    pagato: signedAmount,
    stato: tipo === 'Rimborso' ? 'Rimborso registrato' : 'Registrato',
    metodo_pagamento: normalizePaymentMethod(source.metodo_pagamento || source.metodo),
    metodo: normalizePaymentMethod(source.metodo || source.metodo_pagamento),
    data_pagamento: source.data_pagamento || now.slice(0, 10),
    created_at: source.created_at || now,
    updated_at: now
  }, { includeId: Boolean(existing?.id) });
}

async function generateReceiptCode(service) {
  const result = await service.all();
  const rows = Array.isArray(result?.data) ? result.data : [];
  const year = new Date().getFullYear();
  const prefix = `PAG-${year}-`;
  let max = 0;
  rows.forEach((row) => {
    const code = String(row?.ricevuta || '');
    if (!code.startsWith(prefix)) return;
    const current = Number(code.slice(prefix.length));
    if (Number.isFinite(current) && current > max) max = current;
  });
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

async function listByBookingId(service, bookingId) {
  const response = await listTableRows(service.table, {
    select: '*',
    filters: [{ column: 'prenotazione_id', operator: 'eq', value: String(bookingId) }],
    orderBy: [{ column: 'data_pagamento', ascending: false }, { column: 'created_at', ascending: false }]
  });
  if (response.success === false) {
    return createServiceResult(null, false, mapPaymentsTableError(response.error));
  }
  return createServiceResult((response.data || []).map(mapPaymentResponse), true, null);
}

export class PaymentService extends BaseService {
  constructor() {
    super('pagamenti');
  }

  async all() {
    try {
      const result = await super.all();
      if (result?.success === false) return createServiceResult([], false, mapPaymentsTableError(result.error));
      return createServiceResult((result?.data || []).map(mapPaymentResponse).sort(comparePayments), true, null);
    } catch (error) {
      return createServiceError(mapPaymentsTableError(error));
    }
  }

  async find(id) {
    try {
      const result = await super.find(id);
      if (result?.success === false) return createServiceResult(null, false, mapPaymentsTableError(result.error));
      return createServiceResult(mapPaymentResponse(result?.data), true, null);
    } catch (error) {
      return createServiceError(mapPaymentsTableError(error));
    }
  }

  async create(payload) {
    try {
      const movementPayload = buildMovementPayload({
        ...payload,
        ricevuta: payload?.ricevuta || await generateReceiptCode(this)
      });
      const result = await super.create(movementPayload);
      if (result?.success === false) return createServiceResult(null, false, mapPaymentsTableError(result.error));
      const created = mapPaymentResponse(result?.data);
      const syncResult = await this.syncBookingSummary(created.prenotazione_id);
      if (syncResult?.success === false) return syncResult;
      await this.notifyMovementChange('create', created);
      return createServiceResult(created, true, null);
    } catch (error) {
      return createServiceError(mapPaymentsTableError(error));
    }
  }

  async update(id, payload) {
    try {
      const current = extractData(await this.find(id), null);
      if (!current?.id) return createServiceResult(null, false, new Error('Movimento pagamento non trovato.'));
      const result = await super.update(id, buildMovementPayload(payload, current));
      if (result?.success === false) return createServiceResult(null, false, mapPaymentsTableError(result.error));
      const updated = mapPaymentResponse(result?.data);
      const syncResult = await this.syncBookingSummary(updated.prenotazione_id);
      if (syncResult?.success === false) return syncResult;
      await this.notifyMovementChange('update', updated);
      return createServiceResult(updated, true, null);
    } catch (error) {
      return createServiceError(mapPaymentsTableError(error));
    }
  }

  async registraAcconto(id, importo) {
    const movement = await this.find(id);
    if (movement?.success === false || !movement?.data) return movement;
    return this.update(id, { ...movement.data, tipo: 'Acconto', importo });
  }

  async registraSaldo(id) {
    const movement = await this.find(id);
    if (movement?.success === false || !movement?.data) return movement;
    return this.update(id, { ...movement.data, tipo: 'Saldo', importo: Math.abs(getPaymentSignedAmount(movement.data)) });
  }

  async pagamentiScaduti() {
    try {
      const rows = (await this.all())?.data || [];
      const today = new Date().toISOString().slice(0, 10);
      return createServiceResult(rows.filter((item) => item.scadenza && item.tipo !== 'Rimborso' && String(item.scadenza) < today), true, null);
    } catch (error) {
      return createServiceError(mapPaymentsTableError(error));
    }
  }

  async totaleIncassato() {
    try {
      const rows = (await this.all())?.data || [];
      const total = rows.reduce((sum, item) => sum + getPaymentSignedAmount(item), 0);
      return createServiceResult(roundCurrency(total), true, null);
    } catch (error) {
      return createServiceError(mapPaymentsTableError(error));
    }
  }

  async search(term = '') {
    try {
      const rows = (await this.all())?.data || [];
      const query = String(term || '').trim().toLowerCase();
      if (!query) return createServiceResult(rows, true, null);
      return createServiceResult(rows.filter((item) => {
        const text = `${item.cliente || ''} ${item.viaggio || ''} ${item.metodo || ''} ${item.stato || ''} ${item.ricevuta || ''} ${item.tipo || ''}`.toLowerCase();
        return text.includes(query);
      }), true, null);
    } catch (error) {
      return createServiceError(mapPaymentsTableError(error));
    }
  }

  async getByPrenotazione(prenotazione) {
    try {
      if (typeof prenotazione !== 'object' && !hasIdentifier(prenotazione)) {
        return createServiceResult([], true, null);
      }
      const booking = typeof prenotazione === 'object'
        ? prenotazione
        : (await getPrenotazione(prenotazione)).data;
      if (!booking?.id) return createServiceResult([], true, null);
      const byBookingId = await listByBookingId(this, booking.id);
      if (byBookingId.success !== false && Array.isArray(byBookingId.data) && byBookingId.data.length > 0) {
        return byBookingId;
      }

      const tripId = booking?.viaggio_id || booking?.tratta_id || null;
      const bookingClient = String(booking?.cliente_nome || booking?.cliente || '').trim().toLowerCase();
      if (!hasIdentifier(bookingClient) || !hasIdentifier(tripId)) return createServiceResult([], true, null);
      const payments = await listTableRows(this.table, {
        select: '*',
        filters: [{ column: 'viaggio_id', operator: 'eq', value: String(tripId) }],
        orderBy: [{ column: 'data_pagamento', ascending: false }, { column: 'created_at', ascending: false }]
      });
      if (payments.success === false) return createServiceResult(null, false, mapPaymentsTableError(payments.error));
      const filteredPayments = (payments.data || [])
        .map(mapPaymentResponse)
        .filter((payment) => String(payment.cliente || '').trim().toLowerCase() === bookingClient);
      return createServiceResult(filteredPayments.sort(comparePayments), true, null);
    } catch (error) {
      return createServiceError(mapPaymentsTableError(error));
    }
  }

  async getBookingSummary(prenotazione) {
    try {
      const booking = typeof prenotazione === 'object'
        ? prenotazione
        : extractData(await getPrenotazione(prenotazione), null);
      if (!booking?.id) return createServiceResult(null, false, new Error('Prenotazione non trovata.'));
      const paymentResult = await this.getByPrenotazione(booking);
      if (paymentResult.success === false) return paymentResult;
      return createServiceResult({
        booking,
        payments: paymentResult.data,
        summary: buildBookingPaymentSummary(booking, paymentResult.data)
      }, true, null);
    } catch (error) {
      return createServiceError(mapPaymentsTableError(error));
    }
  }

  async syncBookingSummary(prenotazioneId) {
    if (!hasIdentifier(prenotazioneId)) return createServiceResult(null, true, null);
    try {
      const bookingResponse = await getPrenotazione(prenotazioneId);
      if (bookingResponse.success === false) return createServiceResult(null, false, bookingResponse.error);
      const booking = bookingResponse.data;
      if (!booking?.id) return createServiceResult(null, true, null);
      const paymentResult = await this.getByPrenotazione(booking);
      if (paymentResult.success === false) return paymentResult;
      const summary = buildBookingPaymentSummary(booking, paymentResult.data);
      const latestPayment = summary.latestMovement || null;
      const customerName = String(
        booking.cliente
        || booking.cliente_nome
        || latestPayment?.cliente
        || ''
      ).trim();
      const customerPhone = String(
        booking.telefono
        || booking.cliente_telefono
        || ''
      ).trim();
      const customerEmail = String(
        booking.email
        || booking.cliente_email
        || ''
      ).trim();
      const bookingTotal = roundCurrency(toNumber(booking.totale ?? booking.importo, 0));
      const basePayload = {
        acconto: summary.depositTotal,
        pagato: summary.paidNet,
        saldo: summary.residual,
        metodo_pagamento: summary.latestMethod || booking.metodo_pagamento || '',
        updated_at: new Date().toISOString()
      };
      if (customerName) {
        basePayload.cliente = customerName;
        basePayload.cliente_nome = customerName;
      }
      if (customerPhone) {
        basePayload.telefono = customerPhone;
        basePayload.cliente_telefono = customerPhone;
      }
      if (customerEmail) {
        basePayload.email = customerEmail;
        basePayload.cliente_email = customerEmail;
      }
      if (bookingTotal > 0) {
        basePayload.totale = bookingTotal;
        basePayload.importo = bookingTotal;
      }

      const syncPayload = {
        ...basePayload,
        stato: deriveBookingOperationalStatus(booking.stato, summary.status)
      };

      let updateResult = await updatePrenotazione(prenotazioneId, syncPayload);
      if (updateResult.success === false && isPaymentColumnMissing(updateResult.error, 'pagato')) {
        return createServiceResult(null, false, new Error('Schema prenotazioni incompleto per il modulo pagamenti. Eseguire la migration delle colonne pagato/saldo/acconto.'));
      }
      if (updateResult.success === false && isPaymentColumnMissing(updateResult.error, 'stato')) {
        updateResult = await updatePrenotazione(prenotazioneId, basePayload);
      }
      if (updateResult.success === false) return createServiceResult(null, false, updateResult.error);

      return createServiceResult({
        booking: updateResult.data,
        payments: paymentResult.data,
        summary
      }, true, null);
    } catch (error) {
      return createServiceError(mapPaymentsTableError(error));
    }
  }

  async aggiungiPagamento(prenotazioneId, { importo, tipo, metodo_pagamento, data_pagamento, note, cliente, viaggio, viaggio_id, ricevuta }) {
    try {
      const bookingResponse = await getPrenotazione(prenotazioneId);
      if (bookingResponse.success === false) return createServiceResult(null, false, bookingResponse.error);
      const booking = bookingResponse.data;
      if (!booking?.id) return createServiceResult(null, false, new Error('Prenotazione non trovata.'));
      const payload = {
        prenotazione_id: booking.id,
        viaggio_id: viaggio_id || booking.viaggio_id || booking.tratta_id || null,
        cliente: cliente || booking.cliente_nome || booking.cliente || '',
        viaggio: viaggio || booking.viaggio_codice || booking.destinazione || booking.viaggio_id || '',
        ricevuta,
        importo,
        tipo,
        metodo_pagamento,
        data_pagamento,
        note
      };
      return this.create(payload);
    } catch (error) {
      return createServiceError(mapPaymentsTableError(error));
    }
  }

  async eliminaPagamento(pagamentoId) {
    return this.delete(pagamentoId);
  }

  async getAll() { return this.all(); }
  async getById(id) { return this.find(id); }
  async delete(id) {
    try {
      const current = extractData(await this.find(id), null);
      if (!current?.id) return createServiceResult(null, false, new Error('Movimento pagamento non trovato.'));
      const result = await super.delete(id);
      if (result?.success === false) return createServiceResult(null, false, mapPaymentsTableError(result.error));
      const syncResult = await this.syncBookingSummary(current.prenotazione_id);
      if (syncResult?.success === false) return syncResult;
      await this.notifyMovementChange('delete', current);
      return result;
    } catch (error) {
      return createServiceError(mapPaymentsTableError(error));
    }
  }

  subscribe(onChange) {
    return super.subscribe(onChange);
  }

  async notifyMovementChange(mode, movement) {
    const amount = Math.abs(getPaymentSignedAmount(movement)).toFixed(2);
    const paymentLabel = movement?.cliente || 'Cliente';
    const type = normalizePaymentType(movement?.tipo);
    const bookingSummaryResult = await this.getBookingSummary(movement?.prenotazione_id);
    const summary = bookingSummaryResult?.data?.summary || null;

    if (mode === 'delete') {
      await notify({
        titolo: 'Pagamento eliminato',
        messaggio: `Movimento ${type.toLowerCase()} da € ${amount} eliminato per ${paymentLabel}.`,
        tipo: 'WARNING',
        riferimento: movement?.prenotazione_id || movement?.id
      });
      return;
    }

    const baseTitle = type === 'Rimborso'
      ? 'Rimborso registrato'
      : type === 'Saldo'
        ? 'Saldo registrato'
        : 'Pagamento registrato';
    const verb = mode === 'update' ? 'aggiornato' : 'registrato';

    await notify({
      titolo: baseTitle,
      messaggio: `${verb.charAt(0).toUpperCase()}${verb.slice(1)} ${type.toLowerCase()} da € ${amount} per ${paymentLabel}.`,
      tipo: type === 'Rimborso' ? 'WARNING' : 'SUCCESS',
      riferimento: movement?.prenotazione_id || movement?.id
    });

    if (summary?.status === PAYMENT_STATUS.paid) {
      await notify({
        titolo: 'Prenotazione saldata',
        messaggio: `${paymentLabel} ha completato il pagamento della prenotazione.`,
        tipo: 'SUCCESS',
        riferimento: movement?.prenotazione_id || movement?.id
      });
    } else if (summary?.residual > 0) {
      await notify({
        titolo: 'Saldo da incassare',
        messaggio: `Residuo ${summary.residual.toFixed(2)} € ancora da incassare per ${paymentLabel}.`,
        tipo: 'WARNING',
        riferimento: movement?.prenotazione_id || movement?.id
      });
    }
  }
}

export const paymentService = new PaymentService();
export default paymentService;
