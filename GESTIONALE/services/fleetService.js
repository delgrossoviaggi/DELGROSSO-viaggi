import {
  createAutobus,
  deleteAutobus,
  getAutobus,
  getFlotta,
  subscribeTable,
  updateAutobus
} from '../js/delgrosso-api.js';
import { normalizeFleetInput, validateFleetInput } from './flottaValidation.js';

function result(data, success = true, error = null) {
  return { success, data, error };
}

function validatePayload(payload, options) {
  const errors = validateFleetInput(payload, options);
  if (!Object.keys(errors).length) return null;
  const error = new Error('Dati non validi');
  error.errors = errors;
  return error;
}

export class FleetService {
  async getAll() {
    return getFlotta();
  }

  async all() {
    return this.getAll();
  }

  async getById(id) {
    return getAutobus(id);
  }

  async find(id) {
    return this.getById(id);
  }

  async create(input) {
    const normalized = normalizeFleetInput(input);
    const validationError = validatePayload(normalized);
    if (validationError) return result(null, false, validationError);
    return createAutobus(normalized);
  }

  async update(id, input) {
    const normalized = normalizeFleetInput(input, { partial: true });
    const current = await this.getById(id);
    if (current.success === false) return current;
    const validationError = validatePayload({ ...(current.data || {}), ...normalized });
    if (validationError) return result(null, false, validationError);
    return updateAutobus(id, normalized);
  }

  async delete(id) {
    return deleteAutobus(id);
  }

  subscribe(listener) {
    return subscribeTable('flotta', listener);
  }
}

export const fleetService = new FleetService();
export default fleetService;
