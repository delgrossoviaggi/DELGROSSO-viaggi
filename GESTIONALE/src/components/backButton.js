import { ADMIN_ROUTES, isRouteActive } from '../utils/appRoutes.js';

const BACK_BUTTON_ID = 'dg-back-button';
const PAGE_HEADER_ID = 'dg-page-header';
const PAGE_HEADER_STYLE_ID = 'dg-page-header-style';

function getDashboardHref() {
  return ADMIN_ROUTES.dashboard;
}

function getPageMeta() {
  const path = window.location.pathname;

  if (isRouteActive('dashboard', path)) return null;
  if (isRouteActive('viaggi', path)) return { title: 'Viaggi', breadcrumb: ['Dashboard', 'Viaggi'] };
  if (isRouteActive('clienti', path)) return { title: 'Clienti', breadcrumb: ['Dashboard', 'Clienti'] };
  if (isRouteActive('prenotazioni', path) || isRouteActive('prenotazione', path)) return { title: 'Prenotazioni', breadcrumb: ['Dashboard', 'Prenotazioni'] };
  if (isRouteActive('flotta', path)) return { title: 'Flotta', breadcrumb: ['Dashboard', 'Flotta'] };
  if (isRouteActive('pagamenti', path)) return { title: 'Pagamenti', breadcrumb: ['Dashboard', 'Pagamenti'] };
  if (isRouteActive('preventivi', path) || isRouteActive('nuovoPreventivo', path)) return { title: 'Preventivi', breadcrumb: ['Dashboard', 'Preventivi'] };
  if (isRouteActive('notifiche', path)) return { title: 'Notifiche', breadcrumb: ['Dashboard', 'Notifiche'] };
  if (isRouteActive('checkin', path)) return { title: 'Check-In', breadcrumb: ['Dashboard', 'Check-In'] };
  if (isRouteActive('centroOperativo', path)) return { title: 'Centro Operativo', breadcrumb: ['Dashboard', 'Centro Operativo'] };
  if (isRouteActive('statistiche', path)) return { title: 'Statistiche', breadcrumb: ['Dashboard', 'Statistiche'] };
  if (isRouteActive('impostazioni', path)) return { title: 'Impostazioni', breadcrumb: ['Dashboard', 'Impostazioni'] };
  if (isRouteActive('login', path)) return { title: 'Login', breadcrumb: ['Accesso'] };

  return { title: document.title.split(' - ')[0] || 'Del Grosso Gestionale', breadcrumb: ['Dashboard'] };
}

function getDisplayTitle(meta) {
  const fromTitle = (document.title || '').split(' - ')[0].trim();
  if (fromTitle && fromTitle.toLowerCase() !== 'del grosso gestionale') {
    return fromTitle;
  }

  const heading = document.querySelector('h1');
  if (heading && heading.textContent.trim()) {
    return heading.textContent.trim();
  }

  return meta?.title || 'Del Grosso Gestionale';
}

function injectStyles() {
  if (document.getElementById(PAGE_HEADER_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = PAGE_HEADER_STYLE_ID;
  style.textContent = `
    .dg-page-header {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin: 0 0 16px;
      padding: 16px 18px;
      border: 1px solid #e3e8ef;
      border-radius: 14px;
      background: #ffffff;
      box-shadow: 0 10px 30px rgba(15, 76, 129, 0.06);
    }
    .dg-page-header__back {
      flex-shrink: 0;
      padding: 10px 14px;
      border: 0;
      border-radius: 999px;
      background: linear-gradient(135deg, #0F4C81, #F57C00);
      color: #fff;
      font-size: 0.95rem;
      cursor: pointer;
      box-shadow: 0 8px 24px rgba(15, 76, 129, 0.16);
    }
    .dg-page-header__back:focus-visible {
      outline: 3px solid #F57C00;
      outline-offset: 2px;
      box-shadow: 0 0 0 3px rgba(245, 124, 0, 0.25);
    }
    .dg-page-header__content {
      flex: 1;
      min-width: 0;
    }
    .dg-page-breadcrumb {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 6px;
      font-size: 0.85rem;
      color: #5b6b7a;
    }
    .dg-page-breadcrumb a {
      color: #0F4C81;
      text-decoration: none;
    }
    .dg-page-breadcrumb span {
      color: #5b6b7a;
    }
    .dg-page-header__content h1 {
      margin: 0;
      font-size: 1.25rem;
      color: #0F4C81;
    }
  `;
  document.head.appendChild(style);
}

function createPageHeader() {
  if (document.getElementById(PAGE_HEADER_ID)) return;

  const meta = getPageMeta();
  if (!meta) return;

  const existingHeading = document.querySelector('h1');
  const header = document.createElement('div');
  header.id = PAGE_HEADER_ID;
  header.className = 'dg-page-header';

  const backButton = document.createElement('button');
  backButton.id = BACK_BUTTON_ID;
  backButton.type = 'button';
  backButton.className = 'dg-page-header__back';
  backButton.setAttribute('aria-label', 'Torna alla dashboard');
  backButton.textContent = '← Indietro';
  backButton.onclick = () => {
    window.location.href = getDashboardHref();
  };

  const content = document.createElement('div');
  content.className = 'dg-page-header__content';

  const breadcrumb = document.createElement('nav');
  breadcrumb.className = 'dg-page-breadcrumb';
  breadcrumb.setAttribute('aria-label', 'Breadcrumb');

  if (Array.isArray(meta.breadcrumb)) {
    meta.breadcrumb.forEach((item, index) => {
      if (index > 0) {
        const separator = document.createElement('span');
        separator.textContent = ' / ';
        breadcrumb.appendChild(separator);
      }

      if (item === 'Dashboard') {
        const link = document.createElement('a');
        link.href = getDashboardHref();
        link.textContent = item;
        breadcrumb.appendChild(link);
      } else {
        const label = document.createElement('span');
        label.textContent = item;
        breadcrumb.appendChild(label);
      }
    });
  }

  const titleWrap = document.createElement('div');
  titleWrap.className = 'dg-page-header__title';

  let titleNode = null;
  if (existingHeading && !existingHeading.closest('.dg-page-header')) {
    titleNode = existingHeading;
    titleNode.remove();
  }

  if (titleNode) {
    titleWrap.appendChild(titleNode);
  } else {
    const heading = document.createElement('h1');
    heading.textContent = getDisplayTitle(meta);
    titleWrap.appendChild(heading);
  }

  content.appendChild(breadcrumb);
  content.appendChild(titleWrap);
  header.appendChild(backButton);
  header.appendChild(content);

  document.body.insertBefore(header, document.body.firstChild);
}

function init() {
  if (document.body.dataset.pageHeaderLoaded === 'true') return;
  document.body.dataset.pageHeaderLoaded = 'true';
  injectStyles();
  createPageHeader();
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
