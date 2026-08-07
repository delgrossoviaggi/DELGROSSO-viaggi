import { getCurrentUser, getDisplayRole } from "../services/localAuthService.js";
import { ADMIN_ROUTES } from '../utils/appRoutes.js';

export async function loadLoggedUser() {
    const user = getCurrentUser();
    if (!user) {
        try {
            window.location.replace(ADMIN_ROUTES.login);
        } catch (error) {
        }
        return null;
    }

    const displayRole = getDisplayRole(user.ruolo);
    const email = document.getElementById("loggedEmail");
    if (email) {
        email.textContent = user.nome;
    }
    const roleEl = document.getElementById('loggedRole');
    if(roleEl) roleEl.textContent = displayRole;
    try { document.body.dataset.userRole = displayRole; } catch (error) {}
    return user;
}

// Auto-run on module import so pages including this script get the user populated
loadLoggedUser().catch(err=>console.error('loadLoggedUser error', err));