import { quoteService } from '../../services/quoteService.js';
import { showMessage } from '../../components/messageSystem.js';
import { ADMIN_ROUTES } from '../../utils/appRoutes.js';

const ALLOWED_SERVICES = ['Gran Turismo', 'Limousine Bus', 'Navetta Eventi', 'Viaggio di Gruppo'];
const QUOTE_FLASH_KEY = 'dg_preventivi_flash';

const els = {
  form: document.getElementById('newQuoteForm'),
  cancel: document.getElementById('cancelNewQuote'),
  fields: {
    nome: document.getElementById('quoteNome'),
    cognome: document.getElementById('quoteCognome'),
    telefono: document.getElementById('quoteTelefono'),
    email: document.getElementById('quoteEmail'),
    azienda: document.getElementById('quoteAzienda'),
    origine: document.getElementById('quoteOrigine'),
    stato: document.getElementById('quoteStato'),
    servizio: document.getElementById('quoteServizio'),
    destinazione: document.getElementById('quoteDestinazione'),
    partenza: document.getElementById('quotePartenza'),
    dataPartenza: document.getElementById('quoteDataPartenza'),
    dataRitorno: document.getElementById('quoteDataRitorno'),
    passeggeri: document.getElementById('quotePasseggeri'),
    importo: document.getElementById('quoteImporto'),
    validita: document.getElementById('quoteValidita'),
    noteCliente: document.getElementById('quoteNoteCliente'),
    dettagli: document.getElementById('quoteDettagli'),
    noteInterne: document.getElementById('quoteNoteInterne')
  }
};

function normalizeRequestedService(value) {
  const service = String(value || '').trim();
  if (ALLOWED_SERVICES.includes(service)) return service;
  return 'Gran Turismo';
}

function readFormPayload() {
  return {
    nome: els.fields.nome.value.trim(),
    cognome: els.fields.cognome.value.trim(),
    telefono: els.fields.telefono.value.trim(),
    email: els.fields.email.value.trim(),
    azienda: els.fields.azienda.value.trim(),
    origine: els.fields.origine.value,
    stato: els.fields.stato.value,
    servizio_richiesto: normalizeRequestedService(els.fields.servizio.value),
    servizio: normalizeRequestedService(els.fields.servizio.value),
    destinazione: els.fields.destinazione.value.trim(),
    luogo_partenza: els.fields.partenza.value.trim(),
    partenza: els.fields.partenza.value.trim(),
    data_partenza: els.fields.dataPartenza.value || null,
    data_viaggio: els.fields.dataPartenza.value || null,
    data_ritorno: els.fields.dataRitorno.value || null,
    numero_passeggeri: Number(els.fields.passeggeri.value || 1),
    passeggeri: Number(els.fields.passeggeri.value || 1),
    importo: Number(els.fields.importo.value || 0),
    importo_preventivo: Number(els.fields.importo.value || 0),
    validita_preventivo: els.fields.validita.value || null,
    messaggio: els.fields.noteCliente.value.trim(),
    note_cliente: els.fields.noteCliente.value.trim(),
    dettagli_offerta: els.fields.dettagli.value.trim(),
    note_interne: els.fields.noteInterne.value.trim()
  };
}

function queueFlashMessage(message, type = 'success') {
  try {
    window.sessionStorage.setItem(QUOTE_FLASH_KEY, JSON.stringify({
      type,
      message,
      createdAt: Date.now()
    }));
  } catch (_error) {
    // Ignore sessionStorage failures and continue with navigation.
  }
}

function goBackToList() {
  window.location.href = ADMIN_ROUTES.preventivi;
}

async function saveQuote(event) {
  event.preventDefault();
  const payload = readFormPayload();
  const result = await quoteService.create(payload);
  if (result.success === false || !result.data?.id) {
    throw result.error || new Error('Salvataggio preventivo non riuscito.');
  }
  queueFlashMessage('Preventivo creato.');
  goBackToList();
}

function bindEvents() {
  els.cancel.addEventListener('click', goBackToList);
  els.form.addEventListener('submit', (event) => {
    saveQuote(event).catch((error) => {
      showMessage({
        type: 'error',
        title: 'Preventivi',
        message: error.message || 'Salvataggio preventivo non riuscito.'
      });
    });
  });
}

bindEvents();
