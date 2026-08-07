import { applyRuntimeSettings, loadImpostazioni } from '../services/settingsService.js';

function bindMobileMenu() {
  const mobileToggle = document.getElementById('mobileToggle');
  const mobileStrip = document.getElementById('mobileStrip');
  if (!mobileToggle || !mobileStrip) return;

  mobileToggle.addEventListener('click', () => {
    mobileStrip.classList.toggle('hidden');
  });
}

async function init() {
  try {
    const response = await loadImpostazioni();
    if (response.success !== false) {
      applyRuntimeSettings(response.data);
    }
  } catch (error) {
    console.error('Public site runtime settings error', error);
  }

  bindMobileMenu();
}

init();
