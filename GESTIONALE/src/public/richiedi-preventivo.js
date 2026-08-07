import { creaPreventivoPubblico } from './bridge.js';
import { applyRuntimeSettings, loadImpostazioni } from '../services/settingsService.js';

const ui = {
  form: document.getElementById('publicQuoteForm'),
  submit: document.getElementById('quoteSubmit'),
  message: document.getElementById('formMessage'),
  mobileToggle: document.getElementById('mobileToggle'),
  mobileStrip: document.getElementById('mobileStrip'),
  fields: {
    nome: document.getElementById('quoteNome'),
    cognome: document.getElementById('quoteCognome'),
    telefono: document.getElementById('quoteTelefono'),
    email: document.getElementById('quoteEmail'),
    servizio: document.getElementById('quoteServizio'),
    passeggeri: document.getElementById('quotePasseggeri'),
    destinazione: document.getElementById('quoteDestinazione'),
    partenza: document.getElementById('quotePartenza'),
    dataPartenza: document.getElementById('quoteDataPartenza'),
    noteCliente: document.getElementById('quoteNoteCliente')
  }
};

function showMessage(text, isError = false) {
  ui.message.textContent = text;
  ui.message.classList.remove('hidden');
  ui.message.style.borderColor = isError ? 'rgba(239, 68, 68, 0.3)' : 'rgba(186, 230, 253, 0.9)';
  ui.message.style.background = isError ? 'rgba(254, 242, 242, 0.96)' : 'rgba(240, 249, 255, 0.92)';
  ui.message.style.color = isError ? '#b91c1c' : '#075985';
}

function readPayload() {
  return {
    nome: ui.fields.nome.value.trim(),
    cognome: ui.fields.cognome.value.trim(),
    telefono: ui.fields.telefono.value.trim(),
    email: ui.fields.email.value.trim(),
    servizio_richiesto: ui.fields.servizio.value,
    passeggeri: Number(ui.fields.passeggeri.value || 1),
    destinazione: ui.fields.destinazione.value.trim(),
    partenza: ui.fields.partenza.value.trim(),
    data_partenza: ui.fields.dataPartenza.value || null,
    note_cliente: ui.fields.noteCliente.value.trim()
  };
}

function applyQueryPrefill() {
  const params = new URLSearchParams(window.location.search);
  const destination = params.get('destinazione');
  if (destination) ui.fields.destinazione.value = destination;
}

function bindMobileMenu() {
  if (!ui.mobileToggle || !ui.mobileStrip) return;
  ui.mobileToggle.addEventListener('click', () => {
    ui.mobileStrip.classList.toggle('hidden');
  });
}

async function handleSubmit(event) {
  event.preventDefault();
  ui.submit.disabled = true;
  ui.submit.textContent = 'Invio in corso...';
  ui.message.classList.add('hidden');

  try {
    const result = await creaPreventivoPubblico(readPayload());
    const quote = result?.data;
    if (result?.success === false) throw result.error;
    ui.form.reset();
    ui.fields.passeggeri.value = '1';
    showMessage(`Richiesta inviata correttamente. Codice preventivo: ${quote?.codice || 'in elaborazione'}. Ti contatteremo al piu presto.`);
  } catch (error) {
    showMessage(error.message || 'Invio preventivo non riuscito.', true);
  } finally {
    ui.submit.disabled = false;
    ui.submit.innerHTML = '<i class="fas fa-paper-plane"></i> Invia richiesta';
  }
}

function init() {
  loadImpostazioni().then((response) => {
    if (response.success === false) return;
    applyRuntimeSettings(response.data);
  }).catch(() => {});
  applyQueryPrefill();
  bindMobileMenu();
  ui.form.addEventListener('submit', handleSubmit);
}

init();
