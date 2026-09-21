/* DELGROSSO GESTIONALE V56 — ADMIN ACCESS */
(function(){
  'use strict';
  const ADMINS = new Set(['nicola','raffaele','nicola@delgrossoviaggi.it','raffaele@delgrossoviaggi.it']);
  let user=null;
  try { user=JSON.parse(localStorage.getItem('dg_session')||'null'); } catch {}
  const identity=String(user?.username||user?.email||'').trim().toLowerCase();
  const isAdmin=!!user?.authenticated && (String(user?.ruolo||'').toLowerCase()==='admin' || ADMINS.has(identity));
  window.DG_ADMIN=Object.freeze({isAdmin,canViewAll:isAdmin,canCreate:isAdmin,canEdit:isAdmin,canDelete:isAdmin,canManageSettings:isAdmin,user:user||null});
  document.documentElement.dataset.dgAdmin=isAdmin?'true':'false';
})();
