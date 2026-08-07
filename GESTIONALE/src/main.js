// Entry point for Del Grosso Gestionale
// This script checks for an active session and redirects the browser to the appropriate page.

import { getCurrentUser } from './services/localAuthService.js';
import { applyRuntimeSettings, loadImpostazioni } from './services/settingsService.js';
import { ADMIN_ROUTES } from './utils/appRoutes.js';

function renderLoadingState() {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = `
    <div style="min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;color:#0f4c81;">
      <div style="text-align:center;">
        <h1>Del Grosso Gestionale</h1>
        <p>Caricamento in corso…</p>
      </div>
    </div>
  `;
}

function resolveEntryUrl(path) {
  const base = import.meta.env.BASE_URL || '/';
  return new URL(String(path || '').replace(/^\//, ''), `${window.location.origin}${base}`).toString();
}

async function routeOnSession() {
  renderLoadingState();

  try {
    const settingsResponse = await loadImpostazioni();
    if (settingsResponse.success !== false) {
      applyRuntimeSettings(settingsResponse.data, { applyThemePreference: true });
    }
    const user = getCurrentUser();
    const target = user ? ADMIN_ROUTES.dashboard : ADMIN_ROUTES.login;
    window.location.replace(resolveEntryUrl(target));
  } catch (err) {
    console.error('Entry routing error', err);
    window.location.replace(resolveEntryUrl(ADMIN_ROUTES.login));
  }
}

routeOnSession();
