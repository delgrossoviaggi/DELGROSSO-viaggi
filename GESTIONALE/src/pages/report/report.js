import { bookingService } from '../../services/bookingService.js';
import { tripService } from '../../services/tripService.js';
import { clientService } from '../../services/clientService.js';
import { getPaymentSignedAmount, paymentService } from '../../services/paymentService.js';
import { fleetService } from '../../services/fleetService.js';
import { jsPDF } from 'jspdf';
import Chart from 'chart.js/auto';
import { extractData } from '../../utils/serviceResult.js';
import { downloadXlsx } from '../../utils/xlsxExport.js';

const PAYMENTS_MODULE_DISABLED = false;

const tbody = document.querySelector('#reportTable tbody');
const periodoSelect = document.getElementById('periodo');
const dateFromInput = document.getElementById('dateFrom');
const dateToInput = document.getElementById('dateTo');
const generateButton = document.getElementById('generateReport');
const chartCanvas = document.getElementById('reportChart');
const exportPdfBtn = document.getElementById('exportPdf');
const exportExcelBtn = document.getElementById('exportExcel');
const exportCsvBtn = document.getElementById('exportCsv');
const exportPrintBtn = document.getElementById('exportPrint');
const AUTO_REFRESH_MS = 30000;

let currentStats = null;
let chartInstance = null;
let refreshInFlight = false;

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getDateValue(item) {
  return item?.created_at || item?.updated_at || item?.data || item?.data_prenotazione || item?.data_servizio || item?.data_pagamento || item?.scadenza || null;
}

function dateInRange(item, range) {
  const date = normalizeDate(getDateValue(item));
  if (!date || !range) return true;
  const from = range.from ? new Date(`${range.from}T00:00:00`) : null;
  const to = range.to ? new Date(`${range.to}T23:59:59`) : null;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function formatDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildRange(period, custom = {}) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  if (period === 'Anno corrente') {
    return { from: `${currentYear}-01-01`, to: `${currentYear}-12-31` };
  }
  if (period === 'Personalizzato') {
    return { from: custom.from || '', to: custom.to || '' };
  }
  const monthStart = new Date(currentYear, currentMonth, 1);
  const monthEnd = new Date(currentYear, currentMonth + 1, 0);
  return { from: formatDateValue(monthStart), to: formatDateValue(monthEnd) };
}

async function getStatisticheReport(options = {}) {
  const period = options.period || 'Mese corrente';
  const custom = options.custom || {};
  const range = buildRange(period, custom);

  const [prenotazioni, viaggi, clienti, pagamenti, flotta] = await Promise.all([
    bookingService.getAll(),
    tripService.getAll(),
    clientService.getAll(),
    PAYMENTS_MODULE_DISABLED ? Promise.resolve({ success: true, data: [], error: null }) : paymentService.getAll(),
    fleetService.getAll()
  ]);

  const filteredPrenotazioni = extractData(prenotazioni, []).filter((item) => dateInRange(item, range));
  const filteredViaggi = extractData(viaggi, []).filter((item) => dateInRange(item, range));
  const filteredClienti = extractData(clienti, []).filter((item) => dateInRange(item, range));
  const filteredPagamenti = extractData(pagamenti, []).filter((item) => dateInRange(item, range));
  const filteredFlotta = extractData(flotta, []).filter((item) => dateInRange(item, range));

  const incassi = filteredPagamenti.reduce((sum, item) => sum + getPaymentSignedAmount(item), 0);
  const passeggeri = filteredPrenotazioni.reduce((sum, item) => sum + Number(item.posti ?? item.numero_persone ?? 0), 0);

  return {
    prenotazioni: filteredPrenotazioni.length,
    viaggi: filteredViaggi.length,
    passeggeri,
    incassi: Number(incassi || 0).toFixed(2),
    clienti: filteredClienti.length,
    flotta: filteredFlotta.length,
    periodo: period,
    range
  };
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR'
  }).format(toNumber(value));
}

function metricRows(stats) {
  const rows = [
    { key: 'Incassi', value: formatCurrency(stats.incassi) },
    { key: 'Prenotazioni', value: String(stats.prenotazioni ?? 0) },
    { key: 'Passeggeri', value: String(stats.passeggeri ?? 0) },
    { key: 'Viaggi', value: String(stats.viaggi ?? 0) },
    { key: 'Clienti', value: String(stats.clienti ?? 0) },
    { key: 'Flotta', value: String(stats.flotta ?? 0) }
  ];
  const scope = String(periodoSelect?.value || 'Tutti i report');
  if (scope === 'Tutti i report') return rows;
  return rows.filter((row) => row.key.toLowerCase() === scope.toLowerCase());
}

function updateCards(stats) {
  const incassiEl = document.getElementById('incassi');
  const prenEl = document.getElementById('pren');
  const passEl = document.getElementById('pass');
  const cliEl = document.getElementById('cli');
  const viaEl = document.getElementById('via');
  if (incassiEl) incassiEl.textContent = formatCurrency(stats.incassi);
  if (prenEl) prenEl.textContent = String(stats.prenotazioni ?? 0);
  if (passEl) passEl.textContent = String(stats.passeggeri ?? 0);
  if (cliEl) cliEl.textContent = String(stats.clienti ?? 0);
  if (viaEl) viaEl.textContent = String(stats.viaggi ?? 0);
}

function renderTable(stats) {
  const rows = metricRows(stats);
  tbody.innerHTML = rows.map((row) => `<tr><td>${row.key}</td><td>${row.value}</td></tr>`).join('');
}

function renderChart(stats) {
  if (!chartCanvas) return;
  const data = {
    labels: ['Prenotazioni', 'Passeggeri', 'Viaggi', 'Clienti'],
    datasets: [
      {
        type: 'bar',
        label: 'Volumi',
        data: [
          toNumber(stats.prenotazioni),
          toNumber(stats.passeggeri),
          toNumber(stats.viaggi),
          toNumber(stats.clienti)
        ],
        backgroundColor: ['#0f4c81', '#2b7bba', '#7ec8e3', '#7bc96f'],
        borderRadius: 8
      },
      {
        type: 'line',
        label: 'Incassi',
        data: [toNumber(stats.incassi), toNumber(stats.incassi), toNumber(stats.incassi), toNumber(stats.incassi)],
        borderColor: '#f57c00',
        backgroundColor: 'rgba(245,124,0,0.15)',
        tension: 0.3,
        fill: true
      }
    ]
  };
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(chartCanvas, { type: 'bar', data, options: { responsive: true } });
}

async function load() {
  const from = dateFromInput?.value || '';
  const to = dateToInput?.value || '';
  const options = from || to
    ? { period: 'Personalizzato', custom: { from, to } }
    : { period: 'Mese corrente' };
  currentStats = (await getStatisticheReport(options)) || {};
  updateCards(currentStats);
  renderTable(currentStats);
  renderChart(currentStats);
}

async function refreshReport() {
  if (refreshInFlight) return;
  refreshInFlight = true;
  try {
    await load();
  } finally {
    refreshInFlight = false;
  }
}

function exportPdf() {
  if (!currentStats) return;
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text('Report Del Grosso Gestionale', 14, 18);
  doc.setFontSize(11);
  doc.text(`Tipo: ${periodoSelect?.value || 'Tutti i report'}`, 14, 28);
  doc.text(`Data: ${new Date().toLocaleString('it-IT')}`, 14, 36);
  metricRows(currentStats).forEach((row, index) => {
    doc.text(`${row.key}: ${row.value}`, 14, 52 + (index * 8));
  });
  doc.save('report-del-grosso.pdf');
}

function exportExcel() {
  if (!currentStats) return;
  downloadXlsx(
    metricRows(currentStats).map((row) => ({ Metrica: row.key, Valore: row.value })),
    'Report',
    'report-del-grosso.xlsx'
  );
}

function exportCsv() {
  if (!currentStats) return;
  const rows = metricRows(currentStats);
  const lines = ['Metrica,Valore', ...rows.map((row) => `"${row.key}","${String(row.value).replace(/"/g, '""')}"`)];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'report-del-grosso.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

generateButton?.addEventListener('click', () => refreshReport().catch((error) => console.error(error)));
periodoSelect?.addEventListener('change', () => refreshReport().catch((error) => console.error(error)));
dateFromInput?.addEventListener('change', () => refreshReport().catch((error) => console.error(error)));
dateToInput?.addEventListener('change', () => refreshReport().catch((error) => console.error(error)));
exportPdfBtn?.addEventListener('click', exportPdf);
exportExcelBtn?.addEventListener('click', exportExcel);
exportCsvBtn?.addEventListener('click', exportCsv);
exportPrintBtn?.addEventListener('click', () => window.print());

const autoRefreshTimer = window.setInterval(() => {
  refreshReport().catch((error) => console.error(error));
}, AUTO_REFRESH_MS);

const refreshOnFocus = () => {
  refreshReport().catch((error) => console.error(error));
};

window.addEventListener('focus', refreshOnFocus);
const onVisibilityChange = () => {
  if (document.visibilityState === 'visible') {
    refreshReport().catch((error) => console.error(error));
  }
};
document.addEventListener('visibilitychange', onVisibilityChange);

window.addEventListener('beforeunload', () => {
  window.clearInterval(autoRefreshTimer);
  window.removeEventListener('focus', refreshOnFocus);
  document.removeEventListener('visibilitychange', onVisibilityChange);
});

refreshReport().catch((error) => console.error(error));
