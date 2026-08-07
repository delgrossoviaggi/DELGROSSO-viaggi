import '../src/components/brandShell.js';

const PRIMARY_SUPPORT = {
  label: 'Supporto clienti',
  value: '3205730466',
  href: 'https://wa.me/393205730466'
};

const NICOLA_SUPPORT = {
  label: 'Assistenza clienti (Nicola)',
  value: '3662127916',
  href: 'https://wa.me/393662127916'
};

function buildSupportMarkup() {
  return `
    <div class="dg-brand-shell__footer-support" data-dg-support-contacts>
      <div class="dg-brand-shell__support-item">
        <span class="dg-brand-shell__support-label">${PRIMARY_SUPPORT.label}</span>
        <div class="dg-brand-shell__support-meta">
          <strong>${PRIMARY_SUPPORT.value}</strong>
          <a class="dg-brand-shell__support-link" href="${PRIMARY_SUPPORT.href}" target="_blank" rel="noopener noreferrer">WhatsApp</a>
        </div>
      </div>
      <div class="dg-brand-shell__support-item">
        <span class="dg-brand-shell__support-label">${NICOLA_SUPPORT.label}</span>
        <div class="dg-brand-shell__support-meta">
          <strong>${NICOLA_SUPPORT.value}</strong>
          <a class="dg-brand-shell__support-link" href="${NICOLA_SUPPORT.href}" target="_blank" rel="noopener noreferrer">WhatsApp</a>
        </div>
      </div>
    </div>
  `;
}

function decorateBrandShellFooter() {
  const footer = document.querySelector('.dg-brand-shell__footer');
  if (!footer) return;
  const existing = footer.querySelector('[data-dg-support-contacts]');
  if (existing) existing.remove();
  footer.insertAdjacentHTML('beforeend', buildSupportMarkup());
}

const observer = new MutationObserver(() => {
  decorateBrandShellFooter();
});

function initBrandShellContacts() {
  decorateBrandShellFooter();
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initBrandShellContacts, { once: true });
} else {
  initBrandShellContacts();
}

window.addEventListener('beforeunload', () => {
  observer.disconnect();
});
