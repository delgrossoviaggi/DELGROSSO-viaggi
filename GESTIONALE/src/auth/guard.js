import { getCurrentUser, isAuthenticated } from "../services/localAuthService.js";
import { ADMIN_ROUTES, isLoginRoute } from '../utils/appRoutes.js';

(async () => {
 try {
   const href = window.location.pathname || window.location.href;
   if (!isAuthenticated()) {
     if (!isLoginRoute(href)) {
       window.location.replace(ADMIN_ROUTES.login);
     }
     return;
   }

   const user = getCurrentUser();
   if (!user) {
     if (!isLoginRoute(href)) {
       window.location.replace(ADMIN_ROUTES.login);
     }
     return;
   }

   try { window.__currentUser = user; window.__userRole = user.ruolo; } catch (error) {}

   if (isLoginRoute(href)) {
     window.location.replace(ADMIN_ROUTES.dashboard);
     return;
   }
 } catch (error) {
   console.error('Guard error', error);
   if (!isLoginRoute(window.location.pathname || window.location.href)) {
     window.location.replace(ADMIN_ROUTES.login);
   }
 }
})();