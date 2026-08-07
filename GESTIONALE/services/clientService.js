import {
  createCliente,
  deleteCliente,
  getCliente,
  getClienti,
  listTableRows,
  getPrenotazioni,
  getViaggi,
  subscribeTable,
  updateCliente
} from '../js/delgrosso-api.js';
import { bookingMatchesClient } from '../utils/clientIdentity.js';

function result(data, success = true, error = null) {
  return { success, data, error };
}

function hasId(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized !== '' && normalized !== 'undefined' && normalized !== 'null';
}

function normalizeIdentity(value) {
  return String(value || '').trim().toLowerCase();
}

function isPaymentsTableMissing(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes("could not find the table 'public.pagamenti'")
    || message.includes('relation "public.pagamenti" does not exist');
}

export class ClientService {
  async all() {
    return getClienti();
  }

  async find(id) {
    return getCliente(id);
  }

  async create(payload) {
    return createCliente(payload);
  }

  async update(id, payload) {
    return updateCliente(id, payload);
  }

  async remove(id) {
    return deleteCliente(id);
  }

  async getStorico(id) {
    if (!hasId(id)) return result(null, false, new Error('Identificativo cliente non valido.'));
    const [cliente, prenotazioni, viaggi] = await Promise.all([
      getCliente(id),
      getPrenotazioni(),
      getViaggi()
    ]);
    if (cliente.success === false) return cliente;
    if (prenotazioni.success === false) return prenotazioni;
    if (viaggi.success === false) return viaggi;
    if (!cliente.data) return result(null, false, new Error('Cliente non trovato.'));
    const filteredBookings = (prenotazioni.data || []).filter((item) => bookingMatchesClient(item, cliente.data));
    const viaggioIds = new Set(filteredBookings.map((item) => String(item.viaggio_id || '')).filter(Boolean));
    const bookingIds = new Set(filteredBookings.map((item) => String(item.id || '')).filter(Boolean));
    const paymentRows = await listTableRows('pagamenti', {
      orderBy: [{ column: 'created_at', ascending: false }]
    });
    if (paymentRows.success === false && !isPaymentsTableMissing(paymentRows.error)) {
      return result(null, false, paymentRows.error);
    }
    const payments = (paymentRows.success === false ? [] : (paymentRows.data || [])).filter((payment) => {
      const paymentBookingId = String(payment?.prenotazione_id || '');
      if (paymentBookingId && bookingIds.has(paymentBookingId)) return true;
      const paymentClient = normalizeIdentity(payment?.cliente);
      const clientName = normalizeIdentity(`${cliente.data.nome || ''} ${cliente.data.cognome || ''}`.trim());
      const clientEmail = normalizeIdentity(cliente.data.email);
      const clientPhone = String(cliente.data.telefono || '').trim();
      if (paymentClient && clientName && paymentClient === clientName) return true;
      if (clientEmail && normalizeIdentity(payment?.email) === clientEmail) return true;
      if (clientPhone && String(payment?.telefono || '').trim() === clientPhone) return true;
      return false;
    });
    return result({
      prenotazioni: filteredBookings,
      viaggi: (viaggi.data || []).filter((item) => viaggioIds.has(String(item.id || ''))),
      pagamenti: payments
    }, true, null);
  }

  async getAll() {
    return this.all();
  }

  async getById(id) {
    return this.find(id);
  }

  async delete(id) {
    return this.remove(id);
  }

  subscribe(listener) {
    return subscribeTable('clienti', listener);
  }
}

export const clientService = new ClientService();
export default clientService;
