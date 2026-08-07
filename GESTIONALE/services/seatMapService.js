/**
 * Gestione piantine autobus e assegnazione posti
 * Supporta modelli: GT53, GT63, GT63B
 *
 * Il layout non viene più generato in modo automatico:
 * ogni modello legge un template fisico esplicito e lo renderizza così com'è.
 */

const SEAT_LAYOUTS = {
  GT53: {
    name: 'GT53 Standard',
    totalSeats: 53,
    frontLabel: 'FRONTE BUS GT53',
    driverLabel: 'AUTISTA',
    seatLayoutKey: 'GT53',
    rows: [
      [1, 2, 'aisle', 3, 4],
      [5, 6, 'aisle', 7, 8],
      [9, 10, 'aisle', 11, 12],
      [13, 14, 'aisle', 15, 16],
      [17, 18, 'aisle', 19, 20],
      [21, 22, 'aisle', 23, 24],
      [25, 26, 'aisle', 27, 28],
      [29, 30, 'empty', 'empty', 'door'],
      [31, 32, 'empty', 'empty', 'empty'],
      [33, 34, 'aisle', 35, 36],
      [37, 38, 'aisle', 39, 40],
      [41, 42, 'aisle', 43, 44],
      [45, 46, 'aisle', 47, 48],
      [49, 50, 51, 52, 53]
    ]
  },
  GT63: {
    name: 'GT63 Premium',
    totalSeats: 63,
    frontLabel: 'FRONTE BUS GT63',
    driverLabel: 'AUTISTA',
    seatLayoutKey: 'GT63',
    rows: [
      [1, 2, 'aisle', 3, 4],
      [5, 6, 'aisle', 7, 8],
      [9, 10, 'aisle', 11, 12],
      [13, 14, 'aisle', 15, 16],
      [17, 18, 'aisle', 19, 20],
      [21, 22, 'aisle', 23, 24],
      [25, 26, 'aisle', 27, 28],
      [29, 30, 'empty', 'empty', 'door'],
      [31, 32, 'aisle', 33, 34],
      [35, 36, 'aisle', 37, 38],
      [39, 40, 'aisle', 41, 42],
      [43, 44, 'aisle', 45, 46],
      [47, 48, 'aisle', 49, 50],
      [51, 52, 'aisle', 53, 54],
      [55, 56, 'aisle', 57, 58],
      [59, 60, 61, 62, 63]
    ]
  },
  GT63B: {
    name: 'GT63B Business',
    totalSeats: 63,
    frontLabel: 'FRONTE BUS GT63',
    driverLabel: 'AUTISTA',
    seatLayoutKey: 'GT63',
    rows: [
      [1, 2, 'aisle', 3, 4],
      [5, 6, 'aisle', 7, 8],
      [9, 10, 'aisle', 11, 12],
      [13, 14, 'aisle', 15, 16],
      [17, 18, 'aisle', 19, 20],
      [21, 22, 'aisle', 23, 24],
      [25, 26, 'aisle', 27, 28],
      [29, 30, 'empty', 'empty', 'door'],
      [31, 32, 'aisle', 33, 34],
      [35, 36, 'aisle', 37, 38],
      [39, 40, 'aisle', 41, 42],
      [43, 44, 'aisle', 45, 46],
      [47, 48, 'aisle', 49, 50],
      [51, 52, 'aisle', 53, 54],
      [55, 56, 'aisle', 57, 58],
      [59, 60, 61, 62, 63]
    ]
  }
};

function normalizeSeatId(value) {
  const text = String(value ?? '').trim();
  return text;
}

function seatLabel(value) {
  const number = Number(value);
  return Number.isFinite(number) ? String(number).padStart(2, '0') : String(value ?? '');
}

function normalizeSeatLayoutKey(value) {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (!normalized) return 'GT53';
  if (normalized.includes('FW125XE')) return 'GT63';
  if (normalized.includes('GS028BB')) return 'GT63';
  if (normalized.includes('FA013AN')) return 'GT53';
  if (normalized.includes('IRIZAR SCANIA PB A')) return 'GT63';
  if (normalized.includes('IRIZAR SCANIA PB B')) return 'GT63';
  if (normalized.includes('IRIZAR SCANIA CENTURY')) return 'GT53';
  if (normalized.includes('PB A')) return 'GT63';
  if (normalized.includes('PB B')) return 'GT63';
  if (normalized.includes('CENTURY')) return 'GT53';
  if (normalized.includes('GT63B')) return 'GT63';
  if (normalized.includes('GT63')) return 'GT63';
  if (normalized.includes('GT53')) return 'GT53';
  return 'GT53';
}

function resolveLayoutTemplate(modelOrLayout) {
  if (typeof modelOrLayout === 'string') {
    const trimmed = modelOrLayout.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed) || (parsed && typeof parsed === 'object' && Array.isArray(parsed.rows))) {
          return resolveLayoutTemplate(parsed);
        }
      } catch (error) {
        // Fallback to model normalization below.
      }
    }
  }

  if (Array.isArray(modelOrLayout) || (modelOrLayout && typeof modelOrLayout === 'object')) {
    const payload = modelOrLayout || {};
    if (Array.isArray(payload.rows)) {
      return {
        key: normalizeSeatLayoutKey(
          payload.seat_layout ||
          payload.seatLayout ||
          payload.seatLayoutKey ||
          payload.layout ||
          payload.model ||
          payload.key ||
          payload.targa ||
          payload.modello ||
          payload.marca
        ),
        template: modelOrLayout
      };
    }
    return {
      key: normalizeSeatLayoutKey(
        payload.seat_layout ||
        payload.seatLayout ||
        payload.seatLayoutKey ||
        payload.layout ||
        payload.model ||
        payload.key ||
        payload.targa ||
        payload.modello ||
        payload.marca
      ),
      template: SEAT_LAYOUTS[normalizeSeatLayoutKey(
        payload.seat_layout ||
        payload.seatLayout ||
        payload.seatLayoutKey ||
        payload.layout ||
        payload.model ||
        payload.key ||
        payload.targa ||
        payload.modello ||
        payload.marca
      )] || SEAT_LAYOUTS.GT53
    };
  }

  const key = normalizeSeatLayoutKey(modelOrLayout);
  return {
    key,
    template: SEAT_LAYOUTS[key] || SEAT_LAYOUTS.GT53
  };
}

function buildRowCells(rowDefinition, occupiedSeats) {
  return rowDefinition.map((cell) => {
    if (cell === 'aisle' || cell === 'door' || cell === 'empty') {
      return {
        type: cell,
        value: cell,
        label: cell === 'door' ? 'Porta' : '',
        status: cell
      };
    }

    const seatId = normalizeSeatId(cell);
    const status = occupiedSeats.has(seatId) ? 'occupied' : 'available';
    return {
      type: 'seat',
      id: seatId,
      number: Number(seatId),
      label: seatLabel(seatId),
      status
    };
  });
}

function buildCustomRows(templateRows, occupiedSeats) {
  return templateRows.map((row, index) => {
    const cells = Array.isArray(row) ? row : Array.isArray(row?.cells) ? row.cells : [];
    return {
      rowNumber: index + 1,
      label: row?.label || `Fila ${index + 1}`,
      cells: buildRowCells(cells, occupiedSeats)
    };
  });
}

/**
 * Genera layout fisico della pianta
 * @param {string|Object|Array} modelOrLayout - Modello autobus o layout custom
 * @param {string[]} occupiedSeats - Array di posti occupati
 * @returns {Object} Layout della pianta con metadata
 */
export function generateSeatLayout(modelOrLayout = 'GT53', occupiedSeats = []) {
  const { key, template } = resolveLayoutTemplate(modelOrLayout);
  const occupied = new Set((occupiedSeats || []).map(normalizeSeatId).filter(Boolean));

  const rows = Array.isArray(template.rows) ? buildCustomRows(template.rows, occupied) : [];
  const seats = rows
    .flatMap((row) => row.cells)
    .filter((cell) => cell.type === 'seat');
  const occupiedCount = seats.filter((cell) => cell.status === 'occupied').length;
  const availableCount = seats.length - occupiedCount;

  return {
    model: key,
    config: {
      key,
      name: template.name || SEAT_LAYOUTS[key]?.name || key,
      totalSeats: template.totalSeats || seats.length,
      rows: rows.length,
      seatLayoutKey: template.seatLayoutKey || key,
      frontLabel: template.frontLabel || `FRONTE BUS ${key}`,
      driverLabel: template.driverLabel || 'AUTISTA'
    },
    layout: rows,
    totalSeats: template.totalSeats || seats.length,
    occupiedCount,
    availableCount
  };
}

/**
 * Valida selezione di posti
 * @param {string|Object|Array} modelOrLayout - Modello autobus o layout custom
 * @param {string[]} selectedSeats - Posti selezionati
 * @param {string[]} occupiedSeats - Posti già occupati
 * @returns {Object} Risultato validazione
 */
export function validateSeatSelection(modelOrLayout, selectedSeats, occupiedSeats = []) {
  const { template, key } = resolveLayoutTemplate(modelOrLayout);
  const selected = new Set((selectedSeats || []).map(normalizeSeatId).filter(Boolean));
  const occupied = new Set((occupiedSeats || []).map(normalizeSeatId).filter(Boolean));
  const allowedSeats = new Set(
    (Array.isArray(template.rows) ? template.rows : [])
      .flat()
      .filter((cell) => typeof cell === 'number' || /^\d+$/.test(String(cell)))
      .map(normalizeSeatId)
  );

  const errors = [];

  if (selected.size === 0) {
    errors.push('Seleziona almeno un posto');
    return { valid: false, errors };
  }

  for (const seat of selected) {
    if (!allowedSeats.has(seat)) {
      errors.push(`Posto ${seat} non valido per il modello ${key}`);
    }
    if (occupied.has(seat)) {
      errors.push(`Posto ${seat} non disponibile`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    selectedCount: selected.size,
    availableCount: Math.max(allowedSeats.size - occupied.size, 0)
  };
}

function getSeatCellClass(status) {
  if (status === 'occupied') return 'occupied';
  return 'available';
}

function renderCell(cell) {
  if (cell.type === 'seat') {
    const statusClass = getSeatCellClass(cell.status);
    return `
      <button
        type="button"
        class="seat ${statusClass}"
        data-seat="${cell.id}"
        data-label="${cell.label}"
        ${cell.status === 'occupied' ? 'disabled' : ''}
        aria-label="Posto ${cell.label}"
        title="Posto ${cell.label}"
      >
        <span class="seat__number">${cell.label}</span>
      </button>
    `;
  }

  if (cell.type === 'door') {
    return `
      <span class="seat-void seat-void--door" aria-hidden="true">
        <span class="seat-void__icon">🚪</span>
      </span>
    `;
  }

  if (cell.type === 'aisle') {
    return '<span class="seat-void seat-void--aisle" aria-hidden="true"></span>';
  }

  return '<span class="seat-void seat-void--empty" aria-hidden="true"></span>';
}

/**
 * Genera HTML della pianta per visualizzazione usando Flexbox puro
 * @param {Object} seatLayout - Risultato di generateSeatLayout
 * @returns {string} HTML della pianta
 */
export function renderSeatMapHTML(seatLayout) {
  const config = seatLayout?.config || {};
  const layout = Array.isArray(seatLayout?.layout) ? seatLayout.layout : [];
  const frontLabel = config.frontLabel || `FRONTE BUS ${config.key || 'GT53'}`;
  const driverLabel = config.driverLabel || 'AUTISTA';

  let html = `
    <div class="seat-map-container seat-map-container--real-layout">
      <div class="seat-map-header">
        <div class="seat-map-front" aria-label="${frontLabel}">
          <div class="seat-map-front__title">${frontLabel}</div>
          <div class="seat-map-front__driver">${driverLabel}</div>
        </div>
        <p class="seat-map-stats">
          Disponibili: <strong>${seatLayout.availableCount}</strong> /
          Occupati: <strong>${seatLayout.occupiedCount}</strong>
        </p>
      </div>

      <div class="seat-map-grid">
        <div class="seat-map-legend">
          <div class="legend-item">
            <span class="seat available available-sample"></span>
            <span>Disponibile</span>
          </div>
          <div class="legend-item">
            <span class="seat occupied occupied-sample"></span>
            <span>Occupato</span>
          </div>
          <div class="legend-item">
            <span class="seat selected selected-sample"></span>
            <span>Selezionato</span>
          </div>
          <div class="legend-item">
            <span class="seat-void seat-void--door"></span>
            <span>Porta</span>
          </div>
        </div>

        <div class="seat-map-rows">
  `;

  for (const row of layout) {
    html += `
      <div class="seat-map-row" data-row="${row.rowNumber}">
        <span class="row-label">${row.label}</span>
        <div class="seat-map-row__cells">
    `;

    for (const cell of row.cells) {
      html += renderCell(cell);
    }

    html += `
        </div>
      </div>
    `;
  }

  html += `
        </div>
      </div>
    </div>
  `;

  return html;
}

/**
 * Estrae le informazioni selezionate dalla pianta
 * @param {HTMLElement} container - Container che contiene la pianta
 * @returns {string[]} Array di posti selezionati
 */
export function getSelectedSeats(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll('.seat.selected')).map((el) => el.dataset.seat);
}

/**
 * Aggiorna lo stato di visualizzazione di un posto
 * @param {HTMLElement} container - Container della pianta
 * @param {string} seatId - ID del posto
 * @param {string} newStatus - Nuovo status (available, occupied, selected)
 */
export function setSeatStatus(container, seatId, newStatus) {
  if (!container) return;
  const seat = container.querySelector(`[data-seat="${seatId}"]`);
  if (!seat) return;

  seat.classList.remove('available', 'occupied', 'selected');
  seat.classList.add(newStatus);

  if (newStatus === 'occupied') {
    seat.disabled = true;
  } else {
    seat.disabled = false;
  }
}

/**
 * Resetta la selezione nella pianta
 * @param {HTMLElement} container - Container della pianta
 */
export function clearSelection(container) {
  if (!container) return;
  const selected = container.querySelectorAll('.seat.selected');
  selected.forEach((seat) => {
    seat.classList.remove('selected');
  });
}

/**
 * Ottiene il modello di un autobus da una stringa o da un layout
 * Fallback a GT53 se non trovato
 * @param {string|Object|Array} seatLayout - Modello autobus o layout
 * @returns {string} Modello normalizzato
 */
export function normalizeBusModel(seatLayout) {
  return resolveLayoutTemplate(seatLayout).key;
}

/**
 * Restituisce lista di modelli disponibili
 * @returns {Array} Modelli disponibili
 */
export function getAvailableModels() {
  return Object.entries(SEAT_LAYOUTS).map(([key, config]) => ({
    id: key,
    name: config.name,
    totalSeats: config.totalSeats,
    description: `${config.totalSeats} posti - Layout fisico approvato`
  }));
}

export function getSeatLayoutDefinition(modelOrLayout = 'GT53') {
  const { key, template } = resolveLayoutTemplate(modelOrLayout);
  return {
    key,
    name: template.name || SEAT_LAYOUTS[key]?.name || key,
    totalSeats: template.totalSeats || 0,
    frontLabel: template.frontLabel || `FRONTE BUS ${key}`,
    driverLabel: template.driverLabel || 'AUTISTA',
    rows: Array.isArray(template.rows) ? template.rows : []
  };
}

export const SEAT_MODELS = Object.freeze(
  Object.fromEntries(
    Object.entries(SEAT_LAYOUTS).map(([key, value]) => [key, {
      name: value.name,
      totalSeats: value.totalSeats,
      frontLabel: value.frontLabel,
      driverLabel: value.driverLabel,
      seatLayoutKey: value.seatLayoutKey
    }])
  )
);

export default {
  SEAT_MODELS,
  SEAT_LAYOUTS,
  generateSeatLayout,
  validateSeatSelection,
  renderSeatMapHTML,
  getSelectedSeats,
  setSeatStatus,
  clearSelection,
  normalizeBusModel,
  getAvailableModels,
  getSeatLayoutDefinition
};
