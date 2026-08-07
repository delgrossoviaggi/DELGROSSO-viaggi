export const PUBLIC_ROUTES = {
  home: '/index.html',
  viaggi: '/viaggi.html',
  prenota: '/prenota.html',
  richiediPreventivo: '/richiedi-preventivo.html',
  flotta: '/flotta.html',
  contatti: '/contatti.html',
  servizi: '/servizi.html',
  chiSiamo: '/chi-siamo.html'
};

export const ADMIN_ROUTES = {
  entry: '/gestionale/index.html',
  login: '/gestionale/login.html',
  dashboard: '/gestionale/dashboard.html',
  viaggi: '/gestionale/viaggi.html',
  prenotazioni: '/gestionale/prenotazioni.html',
  prenotazione: '/gestionale/prenotazione.html',
  clienti: '/gestionale/clienti.html',
  flotta: '/gestionale/flotta.html',
  pagamenti: '/gestionale/pagamenti.html',
  preventivi: '/gestionale/preventivi.html',
  nuovoPreventivo: '/gestionale/preventivi-nuovo.html',
  notifiche: '/gestionale/notifiche.html',
  checkin: '/gestionale/checkin.html',
  statistiche: '/gestionale/statistiche.html',
  impostazioni: '/gestionale/impostazioni.html',
  centroOperativo: '/gestionale/centro-operativo.html'
};

const LEGACY_ADMIN_PATHS = {
  login: '/src/pages/login/login.html',
  dashboard: '/src/pages/dashboard/dashboard.html',
  viaggi: '/src/pages/viaggi/index.html',
  prenotazioni: '/src/pages/prenotazioni/index.html',
  prenotazione: '/src/pages/prenotazioni/prenota.html',
  clienti: '/src/pages/clienti/index.html',
  flotta: '/src/pages/flotta/index.html',
  pagamenti: '/src/pages/pagamenti/index.html',
  preventivi: '/src/pages/preventivi/index.html',
  nuovoPreventivo: '/src/pages/preventivi/nuovo.html',
  notifiche: '/src/pages/notifiche/index.html',
  checkin: '/src/pages/checkin/index.html',
  statistiche: '/src/pages/report/index.html',
  impostazioni: '/src/pages/impostazioni/index.html',
  centroOperativo: '/src/pages/centro-operativo/index.html'
};

function normalizePath(value = '') {
  return String(value || '').trim().toLowerCase();
}

export function getRoutePath(routeGroup, routeKey) {
  return routeGroup?.[routeKey] || '';
}

export function isRouteActive(routeKey, pathname = window.location.pathname) {
  const currentPath = normalizePath(pathname);
  const currentAdminRoute = normalizePath(ADMIN_ROUTES[routeKey]);
  const legacyAdminRoute = normalizePath(LEGACY_ADMIN_PATHS[routeKey]);

  return Boolean(
    (currentAdminRoute && currentPath.includes(currentAdminRoute))
    || (legacyAdminRoute && currentPath.includes(legacyAdminRoute))
  );
}

export function isLoginRoute(pathname = window.location.pathname) {
  return isRouteActive('login', pathname);
}

export function buildPublicBookingUrl({ viaggioId, codice } = {}) {
  const params = new URLSearchParams();
  if (viaggioId) params.set('viaggio', String(viaggioId).trim());
  else if (codice) params.set('codice', String(codice).trim());
  const query = params.toString();
  return `${PUBLIC_ROUTES.prenota}${query ? `?${query}` : ''}`;
}
