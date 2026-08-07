import { clearSession } from './session.js';

function redirectToLogin() {
  window.location.replace('login.html');
}

function handleLogout(event) {
  if (event) event.preventDefault();
  clearSession();
  redirectToLogin();
}

function bindLogoutButton(selector) {
  const button = document.querySelector(selector);
  if (!button) return;
  button.addEventListener('click', handleLogout);
}

bindLogoutButton('#logout');
bindLogoutButton('#logoutBtn');
bindLogoutButton('[data-action="logout"]');
