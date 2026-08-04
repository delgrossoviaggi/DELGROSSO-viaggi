import { getViaggiPubblicati } from "./api-gestionale.js";

const PLACEHOLDER_IMAGE = "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1200&q=80";

const state = {
  trips: [],
  search: "",
  filter: "all"
};

const ui = {
  loading: document.getElementById("loading-state"),
  error: document.getElementById("error-state"),
  empty: document.getElementById("empty-state"),
  grid: document.getElementById("viaggi-grid"),
  search: document.getElementById("search-input"),
  retry: document.getElementById("retry-btn"),
  filters: Array.from(document.querySelectorAll(".filter-btn"))
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toDate(value) {
  const date = new Date(`${String(value || "").slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = toDate(value);
  if (!date) return "Data da definire";
  return date.toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
}

function formatCurrency(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "Prezzo su richiesta";
  return amount.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

function getFreeSeats(item) {
  if (item.posti_liberi !== null && item.posti_liberi !== undefined) return Math.max(Number(item.posti_liberi) || 0, 0);
  const total = Math.max(Number(item.posti_totali) || 0, 0);
  const occupied = Math.max(Number(item.posti_occupati) || 0, 0);
  return Math.max(total - occupied, 0);
}

function normalizeFilterValue(value) {
  return String(value || "").trim().toLowerCase();
}

function showLoading() {
  ui.loading.classList.remove("hidden");
  ui.error.classList.add("hidden");
  ui.empty.classList.add("hidden");
  ui.grid.innerHTML = "";
}

function showError() {
  ui.loading.classList.add("hidden");
  ui.error.classList.remove("hidden");
  ui.empty.classList.add("hidden");
  ui.grid.innerHTML = "";
}

function getFilteredTrips() {
  const term = normalizeFilterValue(state.search);
  return state.trips.filter((trip) => {
    const freeSeats = getFreeSeats(trip);
    const text = `${trip.titolo || ""} ${trip.destinazione || ""}`.toLowerCase();
    const matchesSearch = !term || text.includes(term);
    const matchesFilter =
      state.filter === "all" ||
      (state.filter === "disponibili" && freeSeats > 0) ||
      (state.filter === "soldout" && freeSeats <= 0);
    return matchesSearch && matchesFilter;
  });
}

function buildCard(trip) {
  const title = escapeHtml(trip.titolo || "Viaggio Del Grosso");
  const destination = escapeHtml(trip.destinazione || "Destinazione da definire");
  const description = escapeHtml(trip.descrizione || "Descrizione non disponibile.");
  const date = escapeHtml(formatDate(trip.data_partenza));
  const image = escapeHtml(String(trip.locandina || trip.immagine || PLACEHOLDER_IMAGE).trim() || PLACEHOLDER_IMAGE);
  const status = escapeHtml(trip.stato || "Programmato");
  const totalSeats = Math.max(Number(trip.posti_totali) || 0, 0);
  const freeSeats = getFreeSeats(trip);
  const soldOut = freeSeats <= 0;
  const price = escapeHtml(formatCurrency(trip.prezzo));

  return `
    <article class="bg-brand-card rounded-2xl overflow-hidden border border-white/10 shadow-xl flex flex-col justify-between hover:border-brand-gold/50 transition-all duration-300 transform hover:-translate-y-1">
      <div>
        <div class="relative h-56 overflow-hidden">
          <img src="${image}" alt="${title}" class="w-full h-full object-cover object-center">
          <div class="absolute top-4 right-4 bg-black/70 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold text-brand-gold border border-brand-gold/30">${soldOut ? "SOLD OUT" : status}</div>
        </div>
        <div class="p-6 space-y-3">
          <div class="flex items-center text-xs text-gray-400 gap-2">
            <i class="fa-solid fa-calendar-days text-brand-gold"></i>
            <span>${date}</span>
          </div>
          <h2 class="font-serif text-xl font-bold text-white">${title}</h2>
          <p class="text-xs text-gray-400 line-clamp-3">${description}</p>
          <div class="flex items-center gap-2 text-xs text-gray-400">
            <i class="fa-solid fa-location-dot text-brand-gold"></i>
            <span>${destination}</span>
          </div>
          <div class="flex items-center gap-2 text-xs text-gray-400">
            <i class="fa-solid fa-chair text-brand-gold"></i>
            <span>${freeSeats} / ${totalSeats} posti disponibili</span>
          </div>
        </div>
      </div>
      <div class="p-6 pt-0 flex items-center justify-between border-t border-white/5 mt-2 pt-4">
        <div>
          <span class="text-xs text-gray-400 block">A partire da</span>
          <span class="text-lg font-bold text-brand-gold">${price}</span>
        </div>
        ${
          soldOut
            ? '<button type="button" disabled class="bg-red-600 text-white font-semibold px-5 py-2.5 rounded-xl text-xs cursor-not-allowed">SOLD OUT</button>'
            : `<a href="prenota.html?id=${encodeURIComponent(trip.id)}" class="bg-gradient-to-r from-brand-gold to-brand-darkGold text-black font-semibold px-5 py-2.5 rounded-xl text-xs hover:opacity-95 transition-all shadow-lg">Prenota Ora</a>`
        }
      </div>
    </article>
  `;
}

function renderTrips() {
  ui.loading.classList.add("hidden");
  ui.error.classList.add("hidden");
  const items = getFilteredTrips();
  if (!items.length) {
    ui.empty.classList.remove("hidden");
    ui.grid.innerHTML = "";
    return;
  }
  ui.empty.classList.add("hidden");
  ui.grid.innerHTML = items.map(buildCard).join("");
}

function updateFilterButtons(active) {
  ui.filters.forEach((button) => {
    const isActive = button.dataset.filter === active;
    button.classList.toggle("bg-brand-gold", isActive);
    button.classList.toggle("text-black", isActive);
    button.classList.toggle("shadow-md", isActive);
    button.classList.toggle("bg-[#121212]", !isActive);
    button.classList.toggle("text-gray-300", !isActive);
    button.classList.toggle("hover:bg-white/5", !isActive);
    button.classList.toggle("border", !isActive);
    button.classList.toggle("border-white/10", !isActive);
  });
}

async function loadTrips() {
  showLoading();
  const response = await getViaggiPubblicati();
  if (!response.success) {
    showError();
    return;
  }

  const rows = Array.isArray(response.data) ? response.data : [];
  state.trips = rows.sort((a, b) => {
    const left = toDate(a.data_partenza)?.getTime() || Number.MAX_SAFE_INTEGER;
    const right = toDate(b.data_partenza)?.getTime() || Number.MAX_SAFE_INTEGER;
    return left - right;
  });
  renderTrips();
}

function bindEvents() {
  if (ui.search) {
    ui.search.addEventListener("input", (event) => {
      state.search = event.target.value || "";
      renderTrips();
    });
  }

  if (ui.retry) {
    ui.retry.addEventListener("click", () => {
      loadTrips();
    });
  }

  ui.filters.forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter || "all";
      updateFilterButtons(state.filter);
      renderTrips();
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  updateFilterButtons(state.filter);
  loadTrips();
});
