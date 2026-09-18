/* V24: archivio ricevute nel fascicolo / storico pagamenti */
(() => {
  const attach = () => {
    document.addEventListener('click', async (event) => {
      const btn = event.target.closest('[data-dg-receipt-path]');
      if (!btn || !window.DGPaymentReceipt) return;
      event.preventDefault();
      btn.disabled = true;
      const old = btn.textContent;
      btn.textContent = 'Apertura…';
      try { await window.DGPaymentReceipt.openStoredReceipt(btn.dataset.dgReceiptPath); }
      catch (e) { alert(e?.message || 'Ricevuta non disponibile.'); }
      finally { btn.disabled = false; btn.textContent = old; }
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach, { once: true }); else attach();
})();
