import { login, isAuthenticated, getCurrentUser } from '../../services/localAuthService.js';
import { applyRuntimeSettings, loadImpostazioni } from '../../services/settingsService.js';
import { ADMIN_ROUTES } from '../../utils/appRoutes.js';

const form = document.getElementById('loginForm');
const msg = document.getElementById('msg');
const usernameEl = document.getElementById('username');
const passwordEl = document.getElementById('password');
const passwordToggle = document.getElementById('togglePassword');

async function checkAlreadyLogged(){
  try{
    if (isAuthenticated()) {
      const user = getCurrentUser();
      if (user) {
        window.location.replace(ADMIN_ROUTES.dashboard);
      }
    }
  }catch(e){  }
}

checkAlreadyLogged();
loadImpostazioni().then((response) => {
  if (response.success === false) return;
  applyRuntimeSettings(response.data, { applyThemePreference: true });
}).catch(() => {});

passwordToggle?.addEventListener('click', () => {
  const visible = passwordEl.type === 'text';
  passwordEl.type = visible ? 'password' : 'text';
  passwordToggle.textContent = visible ? 'Mostra' : 'Nascondi';
  passwordToggle.setAttribute('aria-label', visible ? 'Mostra password' : 'Nascondi password');
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.textContent = '';
  const username = usernameEl.value.trim();
  const password = passwordEl.value;
  if (!username || !password) {
    msg.textContent = 'Inserisci username e password.';
    return;
  }

  // basic validation
  if(username.length < 2){ msg.textContent = 'Username troppo corto'; return; }
  if(password.length < 3){ msg.textContent = 'Password troppo corta'; return; }

  // loading state
  const submitBtn = form.querySelector('button[type=submit]');
  submitBtn.disabled = true;
  const label = submitBtn.querySelector('.button-label');
  const loader = submitBtn.querySelector('.button-loader');
  const prevText = label ? label.textContent : submitBtn.textContent;
  if (label) label.textContent = 'Accesso in corso...';
  else submitBtn.textContent = 'Accesso in corso...';
  if (loader) loader.hidden = false;

  try {
    login(username, password);
    window.location.replace(ADMIN_ROUTES.dashboard);
  } catch (err) {
    console.error(err);
    msg.textContent = err?.message || 'Errore autenticazione';
  } finally {
    submitBtn.disabled = false;
    if (label) label.textContent = prevText;
    else submitBtn.textContent = prevText;
    if (loader) loader.hidden = true;
  }
});
