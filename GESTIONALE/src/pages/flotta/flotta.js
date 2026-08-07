import { showMessage, showConfirm } from '../../components/messageSystem.js';
import { fleetService } from '../../services/fleetService.js';
import {
  FLEET_CATEGORIES,
  FLEET_STATES,
  normalizeFleetCategory,
  normalizeFleetState,
  validateFleetInput
} from '../../services/flottaValidation.js';
import { extractData } from '../../utils/serviceResult.js';

const tableBody = document.querySelector('#fleetTable tbody');
const searchInput = document.getElementById('fleetSearch');
const reloadButton = document.getElementById('fleetReloadButton');
const newButton = document.getElementById('fleetNewButton');
const totalCount = document.getElementById('fleetTotal');
const activeCount = document.getElementById('fleetActive');
const outOfServiceCount = document.getElementById('fleetOutOfService');

const modal = document.getElementById('flottaModal');
const modalTitle = document.getElementById('fleetModalTitle');
const form = document.getElementById('fleetForm');
const cancelButton = document.getElementById('fleetCancelButton');
const removeImageButton = document.getElementById('fleetRemoveImageButton');
const imageInput = document.getElementById('fleetImageInput');
const imagePreview = document.getElementById('fleetImagePreview');

const fieldId = document.getElementById('fleetId');
const fieldTarga = document.getElementById('fleetTarga');
const fieldMarca = document.getElementById('fleetMarca');
const fieldModello = document.getElementById('fleetModello');
const fieldCategoria = document.getElementById('fleetCategoria');
const fieldAnno = document.getElementById('fleetAnno');
const fieldPosti = document.getElementById('fleetPosti');
const fieldStato = document.getElementById('fleetStato');
const fieldDescrizione = document.getElementById('fleetDescrizione');
const fieldAttivo = document.getElementById('fleetAttivo');

let allVehicles = [];
let currentImage = '';
let realtimeUnsubscribe = null;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function badge(text) {
  return `<span class="badge">${escapeHtml(text || '')}</span>`;
}

function sanitizeImageSource(value) {
  const source = String(value || '').trim();
  if (!source) return '';
  if (source.startsWith('data:image/')) return source;
  if (/^https?:\/\//i.test(source)) return source;
  return '';
}

function setImagePreview(value) {
  currentImage = sanitizeImageSource(value);
  if (!currentImage) {
    imagePreview.src = '';
    imagePreview.style.display = 'none';
    removeImageButton.style.display = 'none';
    return;
  }
  imagePreview.src = currentImage;
  imagePreview.style.display = 'block';
  removeImageButton.style.display = 'inline-block';
}

function populateSelect(select, options, placeholder) {
  select.innerHTML = [
    `<option value="">${placeholder}</option>`,
    ...options.map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`)
  ].join('');
}

function resetForm() {
  form.reset();
  fieldId.value = '';
  fieldCategoria.value = '';
  fieldStato.value = FLEET_STATES[0];
  fieldAttivo.checked = true;
  imageInput.value = '';
  setImagePreview('');
}

function openModal(vehicle = null) {
  resetForm();
  if (vehicle) {
    modalTitle.textContent = 'Modifica Mezzo';
    fieldId.value = vehicle.id ?? '';
    fieldTarga.value = vehicle.targa || '';
    fieldMarca.value = vehicle.marca || '';
    fieldModello.value = vehicle.modello || '';
    fieldCategoria.value = vehicle.categoria || '';
    fieldAnno.value = vehicle.anno ?? '';
    fieldPosti.value = vehicle.posti ?? '';
    fieldStato.value = vehicle.stato || FLEET_STATES[0];
    fieldDescrizione.value = vehicle.descrizione || '';
    fieldAttivo.checked = vehicle.attivo !== false;
    setImagePreview(vehicle.immagine || '');
  } else {
    modalTitle.textContent = 'Nuovo Mezzo';
  }
  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');
  fieldTarga.focus();
}

function closeModal() {
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden', 'true');
}

function buildSearchText(vehicle) {
  return [
    vehicle.targa,
    vehicle.marca,
    vehicle.modello,
    vehicle.categoria,
    vehicle.anno,
    vehicle.posti,
    vehicle.stato,
    vehicle.descrizione
  ].join(' ').toLowerCase();
}

function toDisplayInteger(value) {
  if (value === null || value === undefined || value === '') return '';
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return Number.isInteger(number) ? number : '';
}

function normalizeVehicleForView(vehicle = {}) {
  const normalized = { ...(vehicle || {}) };
  normalized.categoria = normalizeFleetCategory(normalized.categoria);
  normalized.stato = normalizeFleetState(normalized.stato);
  if (normalized.anno === null || normalized.anno === undefined || normalized.anno === '') {
    normalized.anno = toDisplayInteger(normalized.anno_immatricolazione ?? normalized.year);
  }
  return normalized;
}

function getFilteredVehicles() {
  const term = String(searchInput.value || '').trim().toLowerCase();
  if (!term) return allVehicles;
  return allVehicles.filter((vehicle) => buildSearchText(vehicle).includes(term));
}

function renderStats(vehicles) {
  totalCount.textContent = String(vehicles.length);
  activeCount.textContent = String(vehicles.filter((vehicle) => vehicle.attivo !== false).length);
  outOfServiceCount.textContent = String(vehicles.filter((vehicle) => vehicle.stato === 'Fuori servizio').length);
}

function renderTable() {
  const vehicles = getFilteredVehicles();
  if (!vehicles.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="10">Nessun mezzo trovato.</td>
      </tr>
    `;
    renderStats(allVehicles);
    return;
  }

  tableBody.innerHTML = vehicles.map((vehicle) => {
    const image = sanitizeImageSource(vehicle.immagine);
    const imageCell = image
      ? `<img src="${image}" alt="Immagine mezzo ${escapeHtml(vehicle.targa || '')}">`
      : '<span>-</span>';

    return `
      <tr data-id="${escapeHtml(vehicle.id)}">
        <td>${imageCell}</td>
        <td>${escapeHtml(vehicle.targa || '')}</td>
        <td>${escapeHtml(vehicle.marca || '')}</td>
        <td>${escapeHtml(vehicle.modello || '')}</td>
        <td>${escapeHtml(vehicle.categoria || '')}</td>
        <td>${escapeHtml(vehicle.anno ?? '')}</td>
        <td>${escapeHtml(vehicle.posti ?? '')}</td>
        <td>${badge(vehicle.stato || '')}</td>
        <td>${badge(vehicle.attivo !== false ? 'Si' : 'No')}</td>
        <td>
          <button class="fleet-edit-button" type="button">Modifica</button>
          <button class="fleet-delete-button" type="button">Elimina</button>
        </td>
      </tr>
    `;
  }).join('');

  renderStats(allVehicles);
}

async function loadVehicles() {
  const vehicles = extractData(await fleetService.getAll(), []);
  allVehicles = vehicles.map((vehicle) => normalizeVehicleForView(vehicle));
  renderTable();
}

function collectFormData() {
  return {
    targa: fieldTarga.value,
    marca: fieldMarca.value,
    modello: fieldModello.value,
    categoria: fieldCategoria.value,
    anno: fieldAnno.value,
    posti: fieldPosti.value,
    stato: fieldStato.value,
    immagine: currentImage,
    descrizione: fieldDescrizione.value,
    attivo: fieldAttivo.checked
  };
}

function showValidationErrors(errors) {
  const messages = Object.values(errors || {}).filter(Boolean);
  if (!messages.length) return;
  showMessage({
    type: 'error',
    title: 'Validazione non riuscita',
    message: messages.join('\n')
  });
}

async function handleSubmit(event) {
  event.preventDefault();
  const payload = collectFormData();
  const errors = validateFleetInput(payload);
  if (Object.keys(errors).length) {
    showValidationErrors(errors);
    return;
  }

  try {
    if (fieldId.value) {
      extractData(await fleetService.update(fieldId.value, payload), null);
      showMessage({ type: 'success', title: 'Flotta', message: 'Mezzo aggiornato con successo.' });
    } else {
      extractData(await fleetService.create(payload), null);
      showMessage({ type: 'success', title: 'Flotta', message: 'Mezzo creato con successo.' });
    }
    closeModal();
    await loadVehicles();
  } catch (error) {
    showMessage({ type: 'error', title: 'Errore', message: error?.message || 'Operazione non riuscita.' });
  }
}

async function handleTableClick(event) {
  const row = event.target.closest('tr[data-id]');
  if (!row) return;
  const id = row.dataset.id;
  const vehicle = allVehicles.find((item) => String(item.id) === String(id));
  if (!vehicle) return;

  if (event.target.closest('.fleet-edit-button')) {
    openModal(vehicle);
    return;
  }

  if (!event.target.closest('.fleet-delete-button')) return;

  const confirmed = await showConfirm({
    title: 'Elimina mezzo',
    message: `Confermi l'eliminazione del mezzo con targa ${vehicle.targa || ''}?`,
    confirmText: 'Elimina',
    cancelText: 'Annulla'
  });

  if (!confirmed) return;

  try {
    extractData(await fleetService.delete(id), true);
    showMessage({ type: 'success', title: 'Flotta', message: 'Mezzo eliminato con successo.' });
    await loadVehicles();
  } catch (error) {
    showMessage({ type: 'error', title: 'Errore', message: error?.message || 'Eliminazione non riuscita.' });
  }
}

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Impossibile leggere il file selezionato.'));
    reader.readAsDataURL(file);
  });
}

async function handleImageChange(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) {
    setImagePreview('');
    return;
  }

  try {
    const dataUrl = await readImageFile(file);
    setImagePreview(dataUrl);
  } catch (error) {
    imageInput.value = '';
    setImagePreview('');
    showMessage({ type: 'error', title: 'Errore immagine', message: error?.message || 'Caricamento immagine non riuscito.' });
  }
}

function bindRealtime() {
  realtimeUnsubscribe = fleetService.subscribe(() => {
    loadVehicles().catch((error) => {
      showMessage({ type: 'error', title: 'Errore', message: error?.message || 'Aggiornamento realtime non riuscito.' });
    });
  });
}

function bindEvents() {
  populateSelect(fieldCategoria, FLEET_CATEGORIES, '-- Seleziona categoria --');
  populateSelect(fieldStato, FLEET_STATES, '-- Seleziona stato --');
  fieldStato.value = FLEET_STATES[0];

  searchInput.addEventListener('input', () => renderTable());
  reloadButton.addEventListener('click', () => {
    loadVehicles().catch((error) => {
      showMessage({ type: 'error', title: 'Errore', message: error?.message || 'Aggiornamento elenco non riuscito.' });
    });
  });
  newButton.addEventListener('click', () => openModal());
  cancelButton.addEventListener('click', closeModal);
  removeImageButton.addEventListener('click', () => {
    imageInput.value = '';
    setImagePreview('');
  });
  imageInput.addEventListener('change', handleImageChange);
  form.addEventListener('submit', handleSubmit);
  tableBody.addEventListener('click', handleTableClick);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.style.display === 'flex') {
      closeModal();
    }
  });
  window.addEventListener('beforeunload', () => {
    if (typeof realtimeUnsubscribe === 'function') realtimeUnsubscribe();
  });
}

async function init() {
  bindEvents();
  await loadVehicles();
  bindRealtime();
}

init().catch((error) => {
  showMessage({
    type: 'error',
    title: 'Errore inizializzazione',
    message: error?.message || 'Impossibile caricare la flotta.'
  });
});
