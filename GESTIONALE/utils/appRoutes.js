export const PUBLIC_ROUTES = {
  home: '/index.html',
  viaggi: '/viaggi.html',
  prenota: '/prenota.html',
  richiediPreventivo: '/preventivo.html',
  flotta: '/flotta.html',
  contatti: '/contatti.html'
};

export const ADMIN_ROUTES = {
  entry: './index.html',
  login: './login.html',
  dashboard: './dashboard.html',
  viaggi: './viaggi.html',
  prenotazioni: './prenotazioni.html',
  prenotazione: './prenotazione.html',
  clienti: './clienti.html',
  flotta: './flotta.html',
  pagamenti: './pagamenti.html',
  preventivi: './preventivi.html',
  nuovoPreventivo: './preventivi-nuovo.html',
  notifiche: './notifiche.html',
  checkin: './checkin.html',
  statistiche: './statistiche.html',
  impostazioni: './impostazioni.html',
  centroOperativo: './centro-operativo.html'
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
