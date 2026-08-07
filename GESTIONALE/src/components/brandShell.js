import { initializeTheme, toggleTheme } from '../utils/themeManager.js';
import logoUrl from '../assets/images/logo.JPEG';
import { getCurrentUser as getSessionUser, getDisplayRole, logout } from '../services/localAuthService.js';
import { applyRuntimeSettings, buildCompanyInfo, getCachedSettingsSync, loadImpostazioni } from '../services/settingsService.js';
import { getNotificationCenterSummary, subscribeNotificationCenterSummary } from '../services/notificationCenterService.js';
import { ADMIN_ROUTES, isRouteActive } from '../utils/appRoutes.js';

initializeTheme();
applyRuntimeSettings(getCachedSettingsSync());

const menuItems = [
  {
    label: 'Dashboard',
    href: ADMIN_ROUTES.dashboard,
    match: 'dashboard',
    icon: '<svg viewBox="0 0 24 24" class="dg-brand-shell__icon" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12H9v8.25H4.125A1.125 1.125 0 0 1 3 19.125v-6Zm12 7.125V4.875c0-.621.504-1.125 1.125-1.125h3.75C20.496 3.75 21 4.254 21 4.875v14.25c0 .621-.504 1.125-1.125 1.125h-3.75A1.125 1.125 0 0 1 15 19.125Zm-6 0v-12A1.125 1.125 0 0 1 10.125 7.125h3.75C14.496 7.125 15 7.629 15 8.25v12"/></svg>'
  },
  {
    label: 'Viaggi',
    href: ADMIN_ROUTES.viaggi,
    match: 'viaggi',
    icon: '<svg viewBox="0 0 24 24" class="dg-brand-shell__icon" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="m6 20 6-16 6 16M8.25 14h7.5"/></svg>'
  },
  {
    label: 'Prenotazioni',
    href: ADMIN_ROUTES.prenotazioni,
    match: ['prenotazioni', 'prenotazione'],
    icon: '<svg viewBox="0 0 24 24" class="dg-brand-shell__icon" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h7.5m-9 3h10.5m-12 3h12m-13.5 7.5h15A1.5 1.5 0 0 0 20.25 18V6A1.5 1.5 0 0 0 18.75 4.5h-15A1.5 1.5 0 0 0 2.25 6v12A1.5 1.5 0 0 0 3.75 19.5Z"/></svg>'
  },
  {
    label: 'Clienti',
    href: ADMIN_ROUTES.clienti,
    match: 'clienti',
    icon: '<svg viewBox="0 0 24 24" class="dg-brand-shell__icon" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a8.966 8.966 0 0 1-12 0M9.75 9.75a2.25 2.25 0 1 1 4.5 0 2.25 2.25 0 0 1-4.5 0ZM3 20.25a9 9 0 1 1 18 0"/></svg>'
  },
  {
    label: 'Flotta',
    href: ADMIN_ROUTES.flotta,
    match: 'flotta',
    icon: '<svg viewBox="0 0 24 24" class="dg-brand-shell__icon" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm10.5 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM3 13.5h18M4.5 13.5l1.5-6h12l1.5 6M4.5 13.5V18h1.5m12-4.5V18H19.5"/></svg>'
  },
  {
    label: 'Pagamenti',
    href: ADMIN_ROUTES.pagamenti,
    match: 'pagamenti',
    icon: '<svg viewBox="0 0 24 24" class="dg-brand-shell__icon" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M3.75 5.25h16.5A1.5 1.5 0 0 1 21.75 6.75v10.5a1.5 1.5 0 0 1-1.5 1.5H3.75a1.5 1.5 0 0 1-1.5-1.5V6.75a1.5 1.5 0 0 1 1.5-1.5Zm12 9h3"/></svg>'
  },
  {
    label: 'Preventivi',
    href: ADMIN_ROUTES.preventivi,
    match: ['preventivi', 'nuovoPreventivo'],
    icon: '<svg viewBox="0 0 24 24" class="dg-brand-shell__icon" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 3h6m2.25 4.5h-10.5A2.25 2.25 0 0 1 4.5 17.25V6.75A2.25 2.25 0 0 1 6.75 4.5h6.879a2.25 2.25 0 0 1 1.591.659l2.121 2.121a2.25 2.25 0 0 1 .659 1.591v8.379A2.25 2.25 0 0 1 17.25 19.5Z"/></svg>'
  },
  {
    label: 'Notifiche',
    href: ADMIN_ROUTES.notifiche,
    match: 'notifiche',
    icon: '<svg viewBox="0 0 24 24" class="dg-brand-shell__icon" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.082 5.454 1.31m5.715 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"/></svg>'
  },
  {
    label: 'CHECK-IN',
    href: ADMIN_ROUTES.checkin,
    match: 'checkin',
    icon: '<svg viewBox="0 0 24 24" class="dg-brand-shell__icon" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 3.75H6A2.25 2.25 0 0 0 3.75 6v1.5m16.5 0V6A2.25 2.25 0 0 0 18 3.75h-1.5m-9 16.5H6A2.25 2.25 0 0 1 3.75 18v-1.5m16.5 0V18A2.25 2.25 0 0 1 18 20.25h-1.5M8.25 12h7.5"/></svg>'
  },
  {
    label: 'Statistiche',
    href: ADMIN_ROUTES.statistiche,
    match: 'statistiche',
    icon: '<svg viewBox="0 0 24 24" class="dg-brand-shell__icon" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 14.25v3.75m4.5-7.5v7.5m4.5-12v12m-12 3h15.75"/></svg>'
  },
  {
    label: 'Impostazioni',
    href: ADMIN_ROUTES.impostazioni,
    match: 'impostazioni',
    icon: '<svg viewBox="0 0 24 24" class="dg-brand-shell__icon" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.592c.55 0 1.02.398 1.11.94l.213 1.277c.066.395.34.726.707.87.37.145.79.085 1.104-.142l1.022-.739a1.125 1.125 0 0 1 1.478.1l1.832 1.833a1.125 1.125 0 0 1 .1 1.478l-.738 1.021a1.125 1.125 0 0 0-.144 1.105c.145.368.476.642.872.708l1.275.212c.543.09.941.56.941 1.11v2.593c0 .55-.398 1.02-.94 1.11l-1.277.213a1.125 1.125 0 0 0-.87.707c-.145.37-.085.79.142 1.104l.739 1.022a1.125 1.125 0 0 1-.1 1.478l-1.833 1.832a1.125 1.125 0 0 1-1.478.1l-1.021-.738a1.125 1.125 0 0 0-1.105-.144 1.125 1.125 0 0 0-.708.872l-.212 1.275c-.09.543-.56.941-1.11.941h-2.593c-.55 0-1.02-.398-1.11-.94l-.213-1.277a1.125 1.125 0 0 0-.707-.87 1.125 1.125 0 0 0-1.104.142l-1.022.739a1.125 1.125 0 0 1-1.478-.1L3.206 18.66a1.125 1.125 0 0 1-.1-1.478l.738-1.021c.229-.315.289-.735.144-1.105a1.125 1.125 0 0 0-.872-.708l-1.275-.212A1.125 1.125 0 0 1 1 13.126v-2.592c0-.55.398-1.02.94-1.11l1.277-.213c.395-.066.726-.34.87-.707.145-.37.085-.79-.142-1.104l-.739-1.022a1.125 1.125 0 0 1 .1-1.478L5.14 3.206a1.125 1.125 0 0 1 1.478-.1l1.021.738c.315.229.735.289 1.105.144.368-.145.642-.476.708-.872l.212-1.275Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>'
  }
];

let shellClockTimer = null;
let notificationSummaryUnsubscribe = null;

function injectFontAwesome() {
  if (document.querySelector('link[href*="font-awesome"], link[href*="fontawesome"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css';
  link.crossOrigin = 'anonymous';
  document.head.appendChild(link);
}

function injectFavicon() {
  if (document.querySelector('link[rel="icon"]')) return;
  const link = document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/png';
  link.href = '/favicon.png';
  document.head.appendChild(link);
}

function getCurrentUser() {
  const user = getSessionUser();
  if (!user) return null;
  return {
    name: user.nome,
    role: getDisplayRole(user.ruolo)
  };
}

function getPageTitle() {
  const heading = document.querySelector('body > h1');
  if (heading?.textContent?.trim()) return heading.textContent.trim();
  const fromDocument = (document.title || '')
    .replace(' - Del Grosso Gestionale v1.0', '')
    .replace(' - Del Grosso Gestionale', '')
    .trim();
  return fromDocument || 'Del Grosso Gestionale v1.0';
}

function ensurePageWrapper() {
  if (document.querySelector('.dg-page-view')) return;
  const wrapper = document.createElement('main');
  wrapper.className = 'dg-page-view';
  const bodyChildren = Array.from(document.body.children);
  const contentNodes = bodyChildren.filter((node) => node.tagName !== 'SCRIPT');
  const firstScript = bodyChildren.find((node) => node.tagName === 'SCRIPT') || null;
  contentNodes.forEach((node) => wrapper.appendChild(node));
  document.body.insertBefore(wrapper, firstScript || null);
}

function updateThemeToggleLabel(button) {
  if (!button) return;
  const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  button.innerHTML = current === 'dark'
    ? '<span>Light Mode</span>'
    : '<span>Dark Mode</span>';
}

function updateNotificationBadge(root, summary = getNotificationCenterSummary()) {
  const badge = root?.querySelector('[data-dg-notification-badge]');
  if (!badge) return;
  const count = Number(summary?.totalAlerts || 0);
  badge.textContent = count > 99 ? '99+' : String(count);
  badge.hidden = count === 0;
}

function buildShell() {
  if (document.getElementById('dg-brand-shell')) return;

  const user = getCurrentUser();
  if (!user) {
    window.location.replace(ADMIN_ROUTES.login);
    return;
  }

  const company = buildCompanyInfo(getCachedSettingsSync());

  const shell = document.createElement('div');
  shell.id = 'dg-brand-shell';
  shell.className = 'dg-brand-shell';
  shell.innerHTML = `
    <div class="dg-brand-shell__backdrop"></div>
    <aside class="dg-brand-shell__sidebar">
      <div class="dg-brand-shell__sidebar-top">
        <div class="dg-brand-shell__brand">
          <img src="${company.logo || logoUrl}" alt="${company.name}" />
          <div>
            <p class="dg-brand-shell__eyebrow">Travel CRM</p>
            <strong>${company.name}</strong>
            <span>Gestionale professionale</span>
          </div>
        </div>
        <nav class="dg-brand-shell__nav"></nav>
      </div>
      <div class="dg-brand-shell__sidebar-footer">
        <button class="dg-brand-shell__theme-button" type="button"></button>
        <button class="dg-brand-shell__logout" type="button">Esci</button>
      </div>
    </aside>
    <header class="dg-brand-shell__header">
      <div class="dg-brand-shell__header-title">
        <p class="dg-brand-shell__eyebrow">CRM SaaS Interface</p>
        <strong>${getPageTitle()}</strong>
        <span>Esperienza uniforme, responsive e ottimizzata</span>
      </div>
      <div class="dg-brand-shell__header-actions">
        <div class="dg-brand-shell__clock">
          <span>Ora locale</span>
          <strong id="dgShellClock">--:--</strong>
        </div>
        <div class="dg-brand-shell__meta">
          <div class="avatar">${String(user.name || 'U').trim().charAt(0).toUpperCase()}</div>
          <div>
            <div><strong>${user.name}</strong></div>
            <div>${user.role}</div>
          </div>
        </div>
        <button class="dg-brand-shell__menu-toggle" type="button" aria-label="Apri menu">
          <svg viewBox="0 0 24 24" class="dg-brand-shell__icon" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5m-16.5 5.25h16.5m-16.5 5.25h16.5"/></svg>
        </button>
      </div>
    </header>
  `;

  const nav = shell.querySelector('.dg-brand-shell__nav');
  menuItems.forEach((item) => {
    const link = document.createElement('a');
    link.href = item.href;
    link.innerHTML = item.label === 'Notifiche'
      ? `${item.icon}<span>${item.label}</span><span class="dg-brand-shell__nav-badge" data-dg-notification-badge hidden>0</span>`
      : `${item.icon}<span>${item.label}</span>`;
    const isActive = Array.isArray(item.match)
      ? item.match.some((routeKey) => isRouteActive(routeKey))
      : isRouteActive(item.match);
    if (isActive) {
      link.classList.add('is-active');
    }
    nav.appendChild(link);
  });

  document.body.appendChild(shell);
  document.body.classList.add('dg-has-brand-shell');

  const footer = document.createElement('footer');
  footer.className = 'dg-brand-shell__footer';
  footer.innerHTML = `
    <div>
      <strong>© 2026 ${company.name}</strong>
      <span>Design system CRM • Dark/Light ready</span>
    </div>
    <div>${company.email || 'info@delgrossoviaggi.it'}</div>
  `;
  document.body.appendChild(footer);

  const themeButtons = [
    shell.querySelector('.dg-brand-shell__theme-button')
  ];
  themeButtons.forEach((button) => {
    if (!button) return;
    updateThemeToggleLabel(button);
    button.addEventListener('click', () => {
      toggleTheme();
      updateThemeToggleLabel(button);
      document.dispatchEvent(new window.CustomEvent('dg-theme-changed'));
    });
  });

  shell.querySelector('.dg-brand-shell__logout')?.addEventListener('click', () => {
    logout();
    window.location.href = ADMIN_ROUTES.login;
  });

  const menuToggle = shell.querySelector('.dg-brand-shell__menu-toggle');
  const backdrop = shell.querySelector('.dg-brand-shell__backdrop');
  const setSidebarOpen = (open) => {
    document.body.classList.toggle('dg-shell-open', Boolean(open));
  };

  menuToggle?.addEventListener('click', () => {
    setSidebarOpen(!document.body.classList.contains('dg-shell-open'));
  });
  backdrop?.addEventListener('click', () => setSidebarOpen(false));
  shell.querySelectorAll('.dg-brand-shell__nav a').forEach((link) => {
    link.addEventListener('click', () => setSidebarOpen(false));
  });

  const clock = shell.querySelector('#dgShellClock');
  const updateClock = () => {
    if (!clock) return;
    clock.textContent = new Date().toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  updateClock();
  shellClockTimer = window.setInterval(updateClock, 1000 * 30);
  updateNotificationBadge(shell);

  if (notificationSummaryUnsubscribe) notificationSummaryUnsubscribe();
  notificationSummaryUnsubscribe = subscribeNotificationCenterSummary((summary) => {
    updateNotificationBadge(shell, summary);
  });

  loadImpostazioni().then((response) => {
    if (response.success === false) return;
    const liveCompany = buildCompanyInfo(response.data);
    applyRuntimeSettings(response.data);
    const brandImage = shell.querySelector('.dg-brand-shell__brand img');
    const brandName = shell.querySelector('.dg-brand-shell__brand strong');
    if (brandImage) {
      brandImage.src = liveCompany.logo || logoUrl;
      brandImage.alt = liveCompany.name;
    }
    if (brandName) brandName.textContent = liveCompany.name;
    footer.innerHTML = `
      <div>
        <strong>© 2026 ${liveCompany.name}</strong>
        <span>Design system CRM • Dark/Light ready</span>
      </div>
      <div>${liveCompany.email || ''}</div>
    `;
  }).catch(() => {});
}

function init() {
  if (document.body.dataset.brandShellLoaded === 'true') return;
  document.body.dataset.brandShellLoaded = 'true';
  injectFontAwesome();
  injectFavicon();
  ensurePageWrapper();
  buildShell();
}

window.addEventListener('beforeunload', () => {
  if (shellClockTimer) {
    window.clearInterval(shellClockTimer);
    shellClockTimer = null;
  }
  if (notificationSummaryUnsubscribe) {
    notificationSummaryUnsubscribe();
    notificationSummaryUnsubscribe = null;
  }
});

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
