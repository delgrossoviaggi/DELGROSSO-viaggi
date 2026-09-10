/* DELGROSSO GESTIONALE V58 — theme bridge */
(() => {
  const root = document.documentElement;
  const sync = () => {
    const theme = root.dataset.theme === 'dark' || root.classList.contains('dark') ? 'dark' : 'light';
    if (document.body) {
      document.body.dataset.theme = theme;
      document.body.classList.toggle('dark', theme === 'dark');
      document.body.classList.toggle('light', theme !== 'dark');
    }
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme !== 'dark');
    root.style.colorScheme = theme;
  };
  sync();
  new MutationObserver(sync).observe(root, {attributes:true, attributeFilter:['data-theme','class']});
  document.addEventListener('DOMContentLoaded', sync, {once:true});
})();
