import {
  createTableRow,
  deleteTableRows,
  getTableRow,
  listTableRows,
  updateTableRows
} from '../../js/delgrosso-api.js';

function hasIdentifier(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized !== '' && normalized !== 'undefined' && normalized !== 'null';
}

export function createServiceResult(data, success = true, error = null) {
  if (data && typeof data === 'object' && 'success' in data && 'data' in data && 'error' in data) {
    return data;
  }
  return { success, data, error };
}

export function createServiceError(error) {
  return createServiceResult([], false, error || new Error('Errore'));
}

export class BaseService {
  constructor(table) {
    this.table = table;
    this.listeners = new Set();
  }

  async all() {
    try {
      const response = await listTableRows(this.table, { select: '*' });
      if (response.success === false) return createServiceResult(null, false, response.error);
      return createServiceResult(response.data, true, null);
    } catch (error) {
      return createServiceError(error);
    }
  }

  async find(id) {
    if (!hasIdentifier(id)) return createServiceError(new Error('Identificativo non valido: query Supabase non eseguita'));
    try {
      const response = await getTableRow(this.table, id, { select: '*' });
      if (response.success === false) return createServiceResult(null, false, response.error);
      return createServiceResult(response.data, true, null);
    } catch (error) {
      return createServiceError(error);
    }
  }

  async create(payload) {
    try {
      const source = Array.isArray(payload) ? payload : { ...(payload || {}) };
      if (!Array.isArray(source)) delete source.id;
      const response = await createTableRow(this.table, source, { select: '*' });
      if (response.success === false) return createServiceResult(null, false, response.error);
      await this.refresh();
      return createServiceResult(response.data, true, null);
    } catch (error) {
      return createServiceError(error);
    }
  }

  async update(id, payload) {
    if (!hasIdentifier(id)) return createServiceError(new Error('Identificativo non valido: query Supabase non eseguita'));
    try {
      const source = { ...(payload || {}) };
      delete source.id;
      const response = await updateTableRows(this.table, source, {
        filters: [{ column: 'id', operator: 'eq', value: id }],
        select: '*',
        single: true
      });
      if (response.success === false) {
        console.error(`Supabase UPDATE ${this.table}`, { id, error: response.error });
        return createServiceResult(null, false, response.error);
      }
      await this.refresh();
      return createServiceResult(response.data, true, null);
    } catch (error) {
      return createServiceError(error);
    }
  }

  async remove(id) {
    if (!hasIdentifier(id)) return createServiceError(new Error('Identificativo non valido: query Supabase non eseguita'));
    try {
      const response = await deleteTableRows(this.table, {
        filters: [{ column: 'id', operator: 'eq', value: id }]
      });
      if (response.success === false) {
        console.error(`Supabase DELETE ${this.table}`, { id, error: response.error });
        return createServiceResult(null, false, response.error);
      }
      await this.refresh();
      return createServiceResult(true, true, null);
    } catch (error) {
      return createServiceError(error);
    }
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

  async refresh() {
    const result = await this.all();
    if (result?.success !== false) {
      for (const listener of this.listeners) listener(result?.data ?? []);
    }
    return result;
  }

  subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
