import {
  applySessionToPage,
  authenticateAdmin,
  createSession,
  getRememberedIdentifier,
  isAuthenticated,
  rememberIdentifier
} from '../../auth/session.js';

const form = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const rememberMeInput = document.getElementById('rememberMe');
const messageEl = document.getElementById('msg');
const togglePasswordButton = document.getElementById('togglePassword');

function setMessage(message, type = 'error') {
  if (!messageEl) return;
  messageEl.textContent = message;
  messageEl.className = type === 'success' ? 'msg-success' : 'msg-error';
}

function redirectToDashboard() {
  window.location.replace('dashboard.html');
}

function bootstrapRememberedIdentifier() {
  if (!usernameInput || !rememberMeInput) return;
  const remembered = getRememberedIdentifier();
  if (!remembered) return;
  usernameInput.value = remembered;
  rememberMeInput.checked = true;
}

function bindPasswordToggle() {
  if (!togglePasswordButton || !passwordInput) return;
  togglePasswordButton.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    togglePasswordButton.textContent = isPassword ? 'Nascondi' : 'Mostra';
    togglePasswordButton.setAttribute('aria-label', isPassword ? 'Nascondi password' : 'Mostra password');
  });
}

function handleSubmit(event) {
  event.preventDefault();
  const identifier = usernameInput?.value || '';
  const password = passwordInput?.value || '';

  if (!identifier.trim() || !password.trim()) {
    setMessage('Inserisci username/email e password.');
    return;
  }

  if (!authenticateAdmin(identifier, password)) {
    setMessage('Credenziali non valide.');
    return;
  }

  if (rememberMeInput?.checked) {
    rememberIdentifier(identifier);
  } else {
    rememberIdentifier('');
  }

  createSession();
  setMessage('Accesso effettuato con successo.', 'success');
  redirectToDashboard();
}

if (isAuthenticated()) {
  redirectToDashboard();
} else {
  applySessionToPage();
  bootstrapRememberedIdentifier();
  bindPasswordToggle();
  if (form) {
    form.addEventListener('submit', handleSubmit);
  } else {
    console.error('Form login non trovato.');
  }
}
