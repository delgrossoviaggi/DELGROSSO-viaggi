import { isAuthenticated } from './auth/session.js';

if (isAuthenticated()) {
  window.location.replace('dashboard.html');
} else {
  window.location.replace('login.html');
}
