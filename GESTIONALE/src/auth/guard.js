import { isAuthenticated } from './session.js';

function getPageName() {
  const path = window.location.pathname || '';
  const parts = path.split('/');
  return (parts[parts.length - 1] || '').toLowerCase();
}

function redirectToLogin() {
  window.location.replace('login.html');
}

const pageName = getPageName();
const isPublicPage = pageName === 'login.html' || pageName === 'index.html' || pageName === '';

if (!isPublicPage && !isAuthenticated()) {
  redirectToLogin();
}
