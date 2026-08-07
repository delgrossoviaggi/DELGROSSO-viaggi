import {
  createTableRow,
  deleteTableRows,
  listTableRows,
  subscribeTable,
  updateTableRows
} from '../js/delgrosso-api.js';

const TABLE = 'notifiche';
let notificationsUnavailable = false;

function result(data, success = true, error = null) {
  return { data, success, error };
}

function isMissingNotificationsTable(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes("could not find the table 'public.notifiche'") || message.includes('relation "public.notifiche" does not exist');
}

function handleNotificationTableError(error, fallbackData) {
  if (isMissingNotificationsTable(error)) {
    notificationsUnavailable = true;
    return result(fallbackData, true, null);
  }
  return result(fallbackData, false, error);
}

function normalize(notification = {}) {
  return {
    id: notification.id,
    titolo: String(notification.titolo || 'Notifica'),
    messaggio: String(notification.messaggio || ''),
    tipo: ['INFO', 'SUCCESS', 'WARNING', 'ERROR'].includes(notification.tipo) ? notification.tipo : 'INFO',
    letto: Boolean(notification.letto),
    created_at: notification.created_at || new Date().toISOString(),
    utente_id: notification.utente_id || null,
    riferimento: notification.riferimento || null
  };
}

export class NotificationService {
  async all() {
    if (notificationsUnavailable) return result([], true, null);
    try {
      const response = await listTableRows(TABLE, {
        select: '*',
        orderBy: [{ column: 'created_at', ascending: false }]
      });
      return response.success === false
        ? handleNotificationTableError(response.error, [])
        : result((response.data || []).map(normalize));
    } catch (error) {
      return handleNotificationTableError(error, []);
    }
  }

  async create(notification) {
    if (notificationsUnavailable) return result(null, true, null);
    try {
      const response = await createTableRow(TABLE, normalize(notification), { select: '*' });
      return response.success === false
        ? handleNotificationTableError(response.error, null)
        : result(normalize(response.data));
    } catch (error) {
      return handleNotificationTableError(error, null);
    }
  }

  async markRead(id) {
    if (notificationsUnavailable) return result(null, true, null);
    try {
      const response = await updateTableRows(TABLE, { letto: true }, {
        filters: [{ column: 'id', operator: 'eq', value: id }],
        select: '*',
        single: true
      });
      return response.success === false
        ? handleNotificationTableError(response.error, null)
        : result(normalize(response.data));
    } catch (error) {
      return handleNotificationTableError(error, null);
    }
  }

  async markAllRead() {
    if (notificationsUnavailable) return result(true, true, null);
    try {
      const response = await updateTableRows(TABLE, { letto: true }, {
        filters: [{ column: 'letto', operator: 'eq', value: false }]
      });
      return response.success === false
        ? handleNotificationTableError(response.error, true)
        : result(true);
    } catch (error) {
      return handleNotificationTableError(error, true);
    }
  }

  async remove(id) {
    if (notificationsUnavailable) return result(true, true, null);
    try {
      const response = await deleteTableRows(TABLE, {
        filters: [{ column: 'id', operator: 'eq', value: id }]
      });
      return response.success === false
        ? handleNotificationTableError(response.error, true)
        : result(true);
    } catch (error) {
      return handleNotificationTableError(error, true);
    }
  }

  async clear() {
    if (notificationsUnavailable) return result(true, true, null);
    try {
      const response = await deleteTableRows(TABLE, {
        filters: [{ column: 'id', operator: 'neq', value: '' }]
      });
      return response.success === false
        ? handleNotificationTableError(response.error, true)
        : result(true);
    } catch (error) {
      return handleNotificationTableError(error, true);
    }
  }

  subscribe(callback) {
    if (notificationsUnavailable) return () => {};
    return subscribeTable(TABLE, callback);
  }
}

export const notificationService = new NotificationService();

export async function notify(notification) {
  const created = await notificationService.create(notification);
  if (created.success === false) console.error('Persistenza notifica non riuscita', created.error);
  return created;
}
