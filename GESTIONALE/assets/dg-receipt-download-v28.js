import { downloadStoredReceipt } from './paymentReceiptService-v24.js';

document.addEventListener('click', async (event) => {
  const btn = event.target.closest('[data-dg-receipt-download]');
  if (!btn) return;
  const path = btn.getAttribute('data-dg-receipt-download');
  const number = btn.getAttribute('data-dg-receipt-number') || 'ricevuta';
  if (!path) return;
  btn.disabled = true;
  const old = btn.textContent;
  btn.textContent = 'Download…';
  try {
    await downloadStoredReceipt(path, number);
  } catch (err) {
    console.error(err);
    alert(err?.message || 'Impossibile scaricare la ricevuta PDF.');
  } finally {
    btn.disabled = false;
    btn.textContent = old;
  }
});
