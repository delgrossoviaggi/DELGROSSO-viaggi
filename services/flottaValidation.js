export const FLEET_CATEGORIES = ['Bus GT', 'Minibus', 'Van', 'Limousine Bus'];
export const FLEET_STATES = ['Disponibile', 'In viaggio', 'Fuori servizio'];

const FLEET_CATEGORY_ALIASES = new Map([
  ['BUS GT', 'Bus GT'],
  ['MINIBUS', 'Minibus'],
  ['VAN', 'Van'],
  ['LIMOUSINE BUS', 'Limousine Bus']
]);

const FLEET_STATE_ALIASES = new Map([
  ['DISPONIBILE', 'Disponibile'],
  ['IN VIAGGIO', 'In viaggio'],
  ['FUORI SERVIZIO', 'Fuori servizio']
]);

const FLEET_LAYOUT_RULES = [
  { test: (payload) => /FW125XE/i.test(String(payload?.targa || '')) || /PB A/i.test(String(payload?.modello || '')), layout: 'GT63' },
  { test: (payload) => /GS028BB/i.test(String(payload?.targa || '')) || /PB B/i.test(String(payload?.modello || '')), layout: 'GT63' },
  { test: (payload) => /FA013AN/i.test(String(payload?.targa || '')) || /CENTURY/i.test(String(payload?.modello || '')), layout: 'GT53' }
];

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

function normalizeWithAliases(value, aliases, allowedValues) {
  if (isBlank(value)) return '';
  const raw = String(value).trim();
  const key = raw.toUpperCase();
  if (aliases.has(key)) return aliases.get(key);
  const allowedMatch = allowedValues.find((item) => item.toUpperCase() === key);
  return allowedMatch || raw;
}

export function normalizeFleetCategory(value) {
  return normalizeWithAliases(value, FLEET_CATEGORY_ALIASES, FLEET_CATEGORIES);
}

export function normalizeFleetState(value) {
  return normalizeWithAliases(value, FLEET_STATE_ALIASES, FLEET_STATES);
}

function toOptionalInteger(value) {
  if (isBlank(value)) return null;
  const number = Number(value);
  if (!Number.isInteger(number)) return null;
  return number;
}

function isValidImageSource(value) {
  if (isBlank(value)) return true;
  const source = String(value).trim();
  return source.startsWith('data:image/') || /^https?:\/\//i.test(source);
}

export function resolveFleetSeatLayout(input = {}) {
  const payload = { ...(input || {}) };
  if (payload.seat_layout) return String(payload.seat_layout).trim().toUpperCase();

  for (const rule of FLEET_LAYOUT_RULES) {
    if (rule.test(payload)) return rule.layout;
  }

  return 'GT53';
}

export function normalizeFleetInput(input = {}, { partial = false } = {}) {
  const source = { ...(input || {}) };
  const normalized = {};

  const assign = (key, value) => {
    if (value !== undefined) normalized[key] = value;
  };

  const text = (key) => String(source[key] ?? '').trim();
  const integer = (key) => toOptionalInteger(source[key]);

  if (!partial || Object.hasOwn(source, 'targa')) assign('targa', text('targa').toUpperCase());
  if (!partial || Object.hasOwn(source, 'marca')) assign('marca', text('marca'));
  if (!partial || Object.hasOwn(source, 'modello')) assign('modello', text('modello'));
  if (!partial || Object.hasOwn(source, 'categoria')) assign('categoria', normalizeFleetCategory(source.categoria));
  if (!partial || Object.hasOwn(source, 'anno')) assign('anno', integer('anno'));
  if (!partial || Object.hasOwn(source, 'posti')) assign('posti', integer('posti'));
  if (!partial || Object.hasOwn(source, 'stato')) assign('stato', normalizeFleetState(source.stato));
  if (!partial || Object.hasOwn(source, 'immagine')) assign('immagine', text('immagine'));
  if (!partial || Object.hasOwn(source, 'descrizione')) assign('descrizione', text('descrizione'));
  if (!partial || Object.hasOwn(source, 'attivo')) assign('attivo', Boolean(source.attivo));
  if (
    !partial
    || Object.hasOwn(source, 'seat_layout')
    || Object.hasOwn(source, 'targa')
    || Object.hasOwn(source, 'marca')
    || Object.hasOwn(source, 'modello')
  ) {
    assign('seat_layout', resolveFleetSeatLayout({ ...source, ...normalized }));
  }

  return normalized;
}

export function validateFleetInput(input = {}, options = {}) {
  const payload = normalizeFleetInput(input, options);
  const errors = {};

  if (isBlank(payload.targa)) errors.targa = 'La targa e obbligatoria.';
  if (isBlank(payload.marca)) errors.marca = 'La marca e obbligatoria.';
  if (isBlank(payload.modello)) errors.modello = 'Il modello e obbligatorio.';
  if (isBlank(payload.categoria)) errors.categoria = 'La categoria e obbligatoria.';
  if (isBlank(payload.stato)) errors.stato = 'Lo stato e obbligatorio.';

  if (!isBlank(payload.categoria) && !FLEET_CATEGORIES.includes(payload.categoria)) {
    errors.categoria = 'La categoria selezionata non e valida.';
  }

  if (!isBlank(payload.stato) && !FLEET_STATES.includes(payload.stato)) {
    errors.stato = 'Lo stato selezionato non e valido.';
  }

  if (payload.anno !== null && payload.anno !== undefined) {
    if (!Number.isInteger(payload.anno) || payload.anno < 1900 || payload.anno > 2100) {
      errors.anno = 'L anno deve essere compreso tra 1900 e 2100.';
    }
  }

  if (payload.posti === null || payload.posti === undefined || payload.posti < 1) {
    errors.posti = 'I posti devono essere maggiori di zero.';
  }

  if (!isValidImageSource(payload.immagine)) {
    errors.immagine = 'L immagine deve essere un URL valido oppure un file caricato.';
  }

  return errors;
}
