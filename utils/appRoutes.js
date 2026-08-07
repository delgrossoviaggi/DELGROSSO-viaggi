export const PUBLIC_ROUTES = {
  home: '/index.html',
  viaggi: '/viaggi.html',
  prenota: '/prenota.html',
  richiediPreventivo: '/preventivo.html',
  flotta: '/flotta.html',
  contatti: '/contatti.html'
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
  login: ADMIN_ROUTES.login,
  dashboard: ADMIN_ROUTES.dashboard,
  viaggi: ADMIN_ROUTES.viaggi,
  prenotazioni: ADMIN_ROUTES.prenotazioni,
  prenotazione: ADMIN_ROUTES.prenotazione,
  clienti: ADMIN_ROUTES.clienti,
  flotta: ADMIN_ROUTES.flotta,
  pagamenti: ADMIN_ROUTES.pagamenti,
  preventivi: ADMIN_ROUTES.preventivi,
  nuovoPreventivo: ADMIN_ROUTES.nuovoPreventivo,
  notifiche: ADMIN_ROUTES.notifiche,
  checkin: ADMIN_ROUTES.checkin,
  statistiche: ADMIN_ROUTES.statistiche,
  impostazioni: ADMIN_ROUTES.impostazioni,
  centroOperativo: ADMIN_ROUTES.centroOperativo
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
