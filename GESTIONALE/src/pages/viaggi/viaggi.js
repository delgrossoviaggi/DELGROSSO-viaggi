import { tripService } from '../../services/tripService.js';
import { fleetService } from '../../services/fleetService.js';
import { showConfirm, showMessage as showGlobalMessage } from '../../components/messageSystem.js';
import { ADMIN_ROUTES } from '../../utils/appRoutes.js';

const state = {
  viaggi: [],
  flotta: [],
  filters: { query: '' },
  editingId: null,
  sort: { key: 'data_partenza', dir: 'asc' }
};

let unsubscribeTrips = null;
let selectedLocandinaFile = null;
let retryUploadAction = null;

const els = {
  search: document.getElementById('searchTrip'),
  newButton: document.getElementById('btnNewTrip'),
  tbody: document.querySelector('#tripTable tbody'),
  modal: document.getElementById('modal'),
  modalTitle: document.getElementById('modalTitle'),
  save: document.getElementById('saveTrip'),
  close: document.getElementById('closeTrip'),
  busSelect: document.getElementById('bus_select'),
  locandinaFile: document.getElementById('locandina_file'),
  uploadLocandina: document.getElementById('uploadLocandina'),
  replaceLocandina: document.getElementById('replaceLocandina'),
  removeLocandina: document.getElementById('removeLocandina'),
  locandinaPreview: document.getElementById('locandina_preview'),
  uploadProgressBox: document.getElementById('uploadProgressBox'),
  uploadProgressText: document.getElementById('uploadProgressText'),
  uploadProgressBar: document.getElementById('uploadProgressBar'),
  retryUpload: document.getElementById('retryUpload'),
  stats: {
    total: document.getElementById('totTrips'),
    active: document.getElementById('plannedTrips'),
    complete: document.getElementById('runningTrips'),
    cancelled: document.getElementById('completedTrips')
  },
  form: {
    id: document.getElementById('viaggio_id'),
    titolo: document.getElementById('titolo'),
    destinazione: document.getElementById('destinazione'),
    data_partenza: document.getElementById('data_partenza'),
    ora_partenza: document.getElementById('ora_partenza'),
    prezzo: document.getElementById('prezzo'),
    descrizione: document.getElementById('descrizione'),
    locandina: document.getElementById('locandina'),
    posti_totali: document.getElementById('posti_totali'),
    stato: document.getElementById('stato'),
    luogo_partenza: document.getElementById('luogo_partenza'),
    pubblicato: document.getElementById('pubblicato')
  }
};

function extractData(result) {
  if (Array.isArray(result)) return result;
  if (result?.success === false) {
    const message = result?.error?.message || result?.error || 'Operazione non riuscita';
    throw new Error(message);
  }
  if (Array.isArray(result?.data)) return result.data;
  if (result?.data && typeof result.data === 'object') return result.data;
  return result || [];
}

function normalizeViaggio(viaggio) {
  return {
    ...viaggio,
    posti_totali: Number(viaggio?.posti_totali ?? 0)
  };
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('it-IT');
}

function formatTime(value) {
  const raw = String(value || '').trim();
  if (!raw) return '-';
  return raw.slice(0, 5);
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function showMessage(message, type = 'info') {
  showGlobalMessage({
    type: type === 'error' ? 'error' : 'info',
    title: type === 'error' ? 'Errore' : 'Viaggi',
    message: String(message || '')
  });
}

function setLocandinaPreview(src) {
  if (!els.locandinaPreview) return;
  if (!src) {
    els.locandinaPreview.removeAttribute('src');
    els.locandinaPreview.style.display = 'none';
    return;
  }
  els.locandinaPreview.src = src;
  els.locandinaPreview.style.display = 'block';
}

function setUploadProgress(percent, label, secondsLeft = null, isError = false, done = false) {
  const value = Math.max(0, Math.min(100, Number(percent) || 0));
  if (!els.uploadProgressBox || !els.uploadProgressBar || !els.uploadProgressText) return;
  els.uploadProgressBox.style.display = 'block';
  els.uploadProgressBox.classList.remove('error', 'success');
  if (isError) els.uploadProgressBox.classList.add('error');
  if (done) els.uploadProgressBox.classList.add('success');
  els.uploadProgressBar.style.width = `${value}%`;
  let text = `${label} ${value.toFixed(0)}%`;
  if (secondsLeft !== null && Number.isFinite(secondsLeft) && secondsLeft > 0 && value < 100) {
    text = `${text} circa ${Math.max(1, Math.round(secondsLeft))} secondi`;
  }
  if (done) text = 'Locandina caricata con successo';
  els.uploadProgressText.textContent = text;
}

function setUploadError(message) {
  if (!els.uploadProgressBox || !els.uploadProgressBar || !els.uploadProgressText) return;
  els.uploadProgressBox.style.display = 'block';
  els.uploadProgressBox.classList.remove('success');
  els.uploadProgressBox.classList.add('error');
  els.uploadProgressBar.style.width = '0%';
  els.uploadProgressText.textContent = String(message || 'Upload locandina non riuscito');
}

function hideUploadProgress() {
  if (!els.uploadProgressBox || !els.uploadProgressBar || !els.uploadProgressText) return;
  els.uploadProgressBox.style.display = 'none';
  els.uploadProgressBox.classList.remove('error', 'success');
  els.uploadProgressBar.style.width = '0%';
  els.uploadProgressText.textContent = '';
}

function setRetryUploadVisible(visible) {
  if (!els.retryUpload) return;
  els.retryUpload.style.display = visible ? 'inline-flex' : 'none';
}

function resetLocandinaState(clearValue = false) {
  selectedLocandinaFile = null;
  if (els.locandinaFile) els.locandinaFile.value = '';
  if (clearValue) els.form.locandina.value = '';
  setLocandinaPreview(clearValue ? '' : els.form.locandina.value.trim());
  setRetryUploadVisible(false);
  hideUploadProgress();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Errore durante la lettura del file selezionato.'));
    reader.readAsDataURL(file);
  });
}

function canEncodeWebp() {
  const canvas = document.createElement('canvas');
  return canvas.toDataURL('image/webp').startsWith('data:image/webp');
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Formato immagine non valido.'));
    };
    image.src = url;
  });
}

async function optimizeLocandinaForUpload(file) {
  const image = await loadImage(file);
  const maxSide = 1920;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Impossibile ottimizzare la locandina.');
  ctx.drawImage(image, 0, 0, width, height);
  const outputType = canEncodeWebp() ? 'image/webp' : 'image/jpeg';
  const extension = outputType === 'image/webp' ? 'webp' : 'jpg';
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((out) => {
      if (!out) {
        reject(new Error('Impossibile generare il file ottimizzato.'));
        return;
      }
      resolve(out);
    }, outputType, 0.8);
  });
  const baseName = String(file.name || 'locandina').replace(/\.[^.]+$/, '');
  return new window.File([blob], `${baseName}.${extension}`, { type: outputType, lastModified: Date.now() });
}

async function uploadLocandinaFile(file) {
  setRetryUploadVisible(false);
  setUploadProgress(0, 'Caricamento locandina...');
  const optimizedFile = await optimizeLocandinaForUpload(file);
  const uploadResult = await tripService.uploadLocandina(optimizedFile, {
    onProgress(percent) {
      setUploadProgress(percent, 'Caricamento locandina...');
    }
  });
  if (uploadResult?.success === false) {
    const message = String(uploadResult?.error?.message || uploadResult?.error || 'Upload locandina non riuscito');
    console.error('[uploadLocandinaFile] Upload fallito:', uploadResult?.error);
    setUploadError(message);
    setRetryUploadVisible(true);
    throw new Error(message);
  }
  const uploadData = extractData(uploadResult);
  const url = String(uploadData?.url || '');
  if (!url) {
    setUploadError('Public URL locandina non disponibile dopo upload.');
    setRetryUploadVisible(true);
    throw new Error('Public URL locandina non disponibile dopo upload.');
  }
  els.form.locandina.value = url;
  setLocandinaPreview(url);
  setUploadProgress(100, 'Caricamento locandina...', null, false, true);
  setTimeout(() => {
    hideUploadProgress();
  }, 2000);
  selectedLocandinaFile = null;
  return url;
}

async function handleLocandinaSelection(file) {
  if (!file) {
    resetLocandinaState(false);
    return;
  }
  selectedLocandinaFile = file;
  retryUploadAction = () => handleLocandinaSelection(file);
  const previewDataUrl = await readFileAsDataUrl(file);
  setLocandinaPreview(previewDataUrl);
  const uploadedUrl = await uploadLocandinaFile(file);
  showMessage('Locandina caricata con successo');
  return uploadedUrl;
}

function getBusLabel(viaggio) {
  const mezzo = state.flotta.find((item) => String(item.id) === String(viaggio.autobus_id));
  const busText = String(viaggio?.autobus || '').trim();
  if (!mezzo) return busText || (viaggio?.autobus_id || '-');
  const seats = Number(mezzo.posti || 0);
  const gtCode = seats > 0 ? `GT${seats}` : '';
  if (busText && gtCode && busText.toUpperCase().includes(gtCode)) return busText;
  if (busText && gtCode) return `${busText} (${gtCode})`;
  if (busText) return busText;
  const suffix = gtCode ? ` (${gtCode})` : '';
  return `${mezzo.targa || '-'} - ${mezzo.modello || mezzo.marca || 'Bus'}${suffix}`;
}

function filteredTrips() {
  const query = state.filters.query.trim().toLowerCase();
  const rows = state.viaggi.filter((viaggio) => {
    if (!query) return true;
    const values = [viaggio.titolo, viaggio.destinazione, viaggio.data_partenza]
      .map((value) => String(value || '').toLowerCase());
    return values.some((value) => value.includes(query));
  });
  const direction = state.sort.dir === 'asc' ? 1 : -1;
  rows.sort((a, b) => {
    const key = state.sort.key;
    const aValue = a?.[key];
    const bValue = b?.[key];
    if (typeof aValue === 'number' || typeof bValue === 'number') {
      return ((Number(aValue) || 0) - (Number(bValue) || 0)) * direction;
    }
    return String(aValue || '').localeCompare(String(bValue || ''), 'it') * direction;
  });
  return rows;
}

function isTripId(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized !== '' && normalized !== 'undefined' && normalized !== 'null';
}

function updateStats() {
  els.stats.total.textContent = state.viaggi.length;
  els.stats.active.textContent = state.viaggi.filter((viaggio) => {
    const status = normalizeStatus(viaggio.stato);
    return status === 'programmato' || status === 'confermato' || status === '';
  }).length;
  els.stats.complete.textContent = state.viaggi.filter((viaggio) => {
    const status = normalizeStatus(viaggio.stato);
    return status === 'completato' || status === 'chiuso' || status === 'archiviato';
  }).length;
  els.stats.cancelled.textContent = state.viaggi.filter((viaggio) => normalizeStatus(viaggio.stato) === 'annullato').length;
}

function renderTable() {
  const rows = filteredTrips();
  if (!rows.length) {
    els.tbody.innerHTML = '<tr><td colspan="8">Nessun viaggio trovato</td></tr>';
    return;
  }
  els.tbody.innerHTML = rows.map((viaggio) => {
    const tripId = String(viaggio.id || '').trim();
    const totalSeats = Number(viaggio.posti_totali || 0);
    const occupiedSeats = Number(viaggio.posti_occupati || 0);
    const availableSeats = Number.isFinite(Number(viaggio.posti_liberi))
      ? Number(viaggio.posti_liberi || 0)
      : Math.max(totalSeats - occupiedSeats, 0);
    const actions = isTripId(tripId)
      ? `<button type="button" data-action="open-operational" data-id="${tripId}">Apri Viaggio</button>
         <button type="button" data-action="edit" data-id="${tripId}">Modifica</button>
         <button type="button" data-action="delete" data-id="${tripId}">Elimina</button>`
      : '<span>UUID viaggio non disponibile</span>';
    return `
    <tr>
      <td>${viaggio.titolo || '-'}</td>
      <td>${viaggio.destinazione || '-'}</td>
      <td>${formatDate(viaggio.data_partenza)}</td>
      <td>${formatTime(viaggio.ora_partenza)}</td>
      <td>${formatCurrency(viaggio.prezzo)}</td>
      <td>${getBusLabel(viaggio)}</td>
      <td>${availableSeats}/${totalSeats}</td>
      <td>${actions}</td>
    </tr>
  `;
  }).join('');
}

function resetForm() {
  state.editingId = null;
  els.form.id.value = '';
  Object.values(els.form).forEach((input) => {
    if (input && input !== els.form.id) input.value = '';
  });
  els.form.stato.value = 'Programmato';
  els.form.pubblicato.value = 'NO';
  resetLocandinaState(true);
}

function openModal(viaggio = null) {
  resetForm();
  if (viaggio) {
    state.editingId = viaggio.id;
    els.modalTitle.textContent = 'Modifica Viaggio';
    els.form.id.value = viaggio.id || '';
    els.form.titolo.value = viaggio.titolo || '';
    els.form.destinazione.value = viaggio.destinazione || '';
    els.form.data_partenza.value = viaggio.data_partenza || '';
    els.form.ora_partenza.value = viaggio.ora_partenza || '';
    els.form.prezzo.value = viaggio.prezzo ?? '';
    els.form.descrizione.value = viaggio.descrizione || '';
    els.form.locandina.value = viaggio.locandina || '';
    els.form.posti_totali.value = viaggio.posti_totali ?? '';
    els.form.stato.value = viaggio.stato || 'Programmato';
    els.form.luogo_partenza.value = viaggio.luogo_partenza || '';
    els.form.pubblicato.value = viaggio.pubblicato || 'NO';
    els.busSelect.value = viaggio.autobus_id || '';
    setLocandinaPreview(viaggio.locandina || '');
  } else {
    els.modalTitle.textContent = 'Nuovo Viaggio';
    els.busSelect.value = '';
    els.form.stato.value = 'Programmato';
  }
  els.modal.classList.add('open');
  els.modal.setAttribute('aria-hidden', 'false');
}

function closeModal() {
  els.modal.classList.remove('open');
  els.modal.setAttribute('aria-hidden', 'true');
}

function fillBusSelect() {
  const options = ['<option value="">-- Seleziona Bus --</option>'];
  state.flotta.filter((mezzo) => mezzo?.id).forEach((mezzo) => {
    const seats = Number(mezzo.posti || 0);
    const gtCode = seats > 0 ? `GT${seats}` : '';
    const suffix = gtCode ? ` (${gtCode})` : '';
    const label = `${mezzo.targa || '-'} - ${mezzo.modello || mezzo.marca || 'Bus'}${suffix}`;
    options.push(`<option value="${mezzo.id}">${label}</option>`);
  });
  els.busSelect.innerHTML = options.join('');
}

function payloadFromForm() {
  const selectedBus = state.flotta.find((item) => String(item.id) === String(els.busSelect.value || ''));
  const existingTrip = state.viaggi.find((item) => String(item.id) === String(state.editingId || ''));
  const totalSeats = Number(els.form.posti_totali.value || 0);
  const occupiedSeats = Math.max(Number(existingTrip?.posti_occupati || 0), 0);
  const normalizedOccupiedSeats = Math.min(occupiedSeats, Math.max(totalSeats, 0));
  const payload = {
    titolo: els.form.titolo.value.trim(),
    destinazione: els.form.destinazione.value.trim(),
    data_partenza: els.form.data_partenza.value,
    ora_partenza: els.form.ora_partenza.value,
    prezzo: Number(els.form.prezzo.value || 0),
    descrizione: els.form.descrizione.value.trim(),
    locandina: els.form.locandina.value.trim(),
    luogo_partenza: els.form.luogo_partenza.value.trim(),
    autobus: selectedBus ? getBusLabel({ autobus_id: selectedBus.id }) : '',
    posti_totali: totalSeats,
    posti_occupati: normalizedOccupiedSeats,
    posti_liberi: Math.max(totalSeats - normalizedOccupiedSeats, 0),
    stato: els.form.stato.value || 'Programmato',
    autobus_id: els.busSelect.value || null,
    pubblicato: els.form.pubblicato.value || 'NO'
  };
  return payload;
}

function validatePayload(payload) {
  const existingTrip = state.viaggi.find((item) => String(item.id) === String(state.editingId || ''));
  const occupiedSeats = Math.max(Number(existingTrip?.posti_occupati || 0), 0);
  if (!payload.titolo) return 'Titolo obbligatorio';
  if (!payload.destinazione) return 'Destinazione obbligatoria';
  if (!payload.data_partenza) return 'Data obbligatoria';
  if (!payload.ora_partenza) return 'Ora obbligatoria';
  if (!payload.autobus_id) return 'Bus assegnato obbligatorio';
  if (!Number.isFinite(payload.posti_totali) || payload.posti_totali <= 0) return 'Posti non validi';
  if (payload.posti_totali < occupiedSeats) return 'Posti totali inferiori ai posti gia occupati';
  if (!Number.isFinite(payload.prezzo) || payload.prezzo < 0) return 'Prezzo non valido';
  return '';
}

async function uploadLocandinaIfNeeded(payload) {
  if (payload.locandina) return payload;
  if (!selectedLocandinaFile) return payload;
  try {
    const uploadedUrl = await uploadLocandinaFile(selectedLocandinaFile);
    payload.locandina = uploadedUrl;
    els.form.locandina.value = uploadedUrl;
  } catch (uploadError) {
    console.error('[uploadLocandinaIfNeeded] Upload locandina fallito, viaggio salvato senza immagine:', uploadError);
    selectedLocandinaFile = null;
    setRetryUploadVisible(false);
    hideUploadProgress();
    showMessage(`${uploadError.message || 'Upload locandina fallito'} — viaggio salvato senza locandina`, 'error');
  }
  return payload;
}

async function saveTrip() {
  let payload = payloadFromForm();
  const error = validatePayload(payload);
  if (error) {
    showMessage(error, 'error');
    return;
  }
  try {
    retryUploadAction = () => saveTrip();
    setRetryUploadVisible(false);
    payload = await uploadLocandinaIfNeeded(payload);
    if (state.editingId) {
      extractData(await tripService.update(state.editingId, payload));
      showMessage('Viaggio aggiornato');
    } else {
      extractData(await tripService.create(payload));
      showMessage('Viaggio creato');
    }
    closeModal();
    await refreshData();
  } catch (saveError) {
    console.error(saveError);
    showMessage(saveError.message || 'Errore durante il salvataggio', 'error');
  }
}

async function deleteTrip(id) {
  const confirmed = await showConfirm({
    title: 'Conferma eliminazione',
    message: 'Eliminare definitivamente questo viaggio?',
    confirmText: 'Elimina',
    cancelText: 'Annulla'
  });
  if (!confirmed) return;
  try {
    const result = await tripService.delete(id);
    if (result?.success === false) {
      const message = result?.error?.message || result?.error || 'Eliminazione non riuscita';
      throw new Error(message);
    }
    showMessage('Viaggio eliminato');
    await refreshData();
  } catch (error) {
    console.error(error);
    showMessage(error.message || 'Errore durante eliminazione', 'error');
  }
}

async function refreshData() {
  const [viaggiResult, flottaResult] = await Promise.all([tripService.getAll(), fleetService.getAll()]);
  const viaggiRows = extractData(viaggiResult);
  const flottaRows = extractData(flottaResult);
  state.viaggi = (Array.isArray(viaggiRows) ? viaggiRows : []).map(normalizeViaggio);
  state.flotta = Array.isArray(flottaRows) ? flottaRows : [];
  fillBusSelect();
  updateStats();
  renderTable();
}

function bindEvents() {
  els.search.addEventListener('input', (event) => {
    state.filters.query = event.target.value || '';
    renderTable();
  });
  els.newButton.addEventListener('click', () => openModal());
  els.close.addEventListener('click', closeModal);
  els.save.addEventListener('click', saveTrip);
  els.retryUpload?.addEventListener('click', () => {
    if (typeof retryUploadAction === 'function') {
      retryUploadAction().catch((error) => {
        console.error(error);
      });
    }
  });

  els.uploadLocandina?.addEventListener('click', () => { els.locandinaFile?.click(); });
  els.replaceLocandina?.addEventListener('click', () => {
    resetLocandinaState(true);
    els.locandinaFile?.click();
  });
  els.removeLocandina?.addEventListener('click', () => {
    resetLocandinaState(true);
    showMessage('Locandina rimossa');
  });
  els.locandinaFile?.addEventListener('change', async () => {
    const file = els.locandinaFile?.files?.[0] || null;
    if (!file) {
      resetLocandinaState(false);
      return;
    }
    try {
      await handleLocandinaSelection(file);
    } catch (error) {
      console.error(error);
      showMessage(error.message || 'Errore upload locandina', 'error');
    }
  });

  els.modal.addEventListener('click', (event) => {
    if (event.target === els.modal) closeModal();
  });
  els.tbody.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const id = button.getAttribute('data-id');
    if (!isTripId(id)) {
      showMessage('UUID viaggio non valido', 'error');
      return;
    }
    const viaggio = state.viaggi.find((row) => String(row.id) === String(id));
    if (button.dataset.action === 'edit') {
      if (!viaggio) return;
      openModal(viaggio);
      return;
    }
    if (button.dataset.action === 'open-operational') {
      window.location.href = `${ADMIN_ROUTES.centroOperativo}?trip=${encodeURIComponent(id)}`;
      return;
    }
    if (button.dataset.action === 'delete') await deleteTrip(id);
  });
  document.querySelectorAll('#tripTable thead th[data-sort]').forEach((th) => {
    th.addEventListener('click', () => {
      const key = th.getAttribute('data-sort');
      if (!key) return;
      state.sort.dir = state.sort.key === key && state.sort.dir === 'asc' ? 'desc' : 'asc';
      state.sort.key = key;
      renderTable();
    });
  });

}

async function init() {
  bindEvents();
  unsubscribeTrips = tripService.subscribe(() => {
    refreshData().catch((error) => {
      showMessage(error.message || 'Errore sincronizzazione viaggi', 'error');
    });
  });
  window.addEventListener('beforeunload', () => {
    if (typeof unsubscribeTrips === 'function') unsubscribeTrips();
  });
  await refreshData();
}

init().catch((error) => {
  showMessage(error.message || 'Errore caricamento viaggi', 'error');
});
