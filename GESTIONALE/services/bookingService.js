import {
  createPrenotazione,
  deletePrenotazione,
  getPrenotazione,
  getPrenotazioni,
  subscribeTable,
  updatePrenotazione
} from '../js/delgrosso-api.js';

export class BookingService {
  async all() {
    return getPrenotazioni();
  }

  async find(id) {
    return getPrenotazione(id);
  }

  async create(payload) {
    return createPrenotazione(payload);
  }

  async update(id, payload) {
    return updatePrenotazione(id, payload);
  }

  async remove(id) {
    return deletePrenotazione(id);
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
    return subscribeTable('prenotazioni', listener);
  }
}

export const bookingService = new BookingService();
export default bookingService;
