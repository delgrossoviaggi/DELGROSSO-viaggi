import { logout } from "../services/localAuthService.js";
import { showMessage } from "../components/messageSystem.js";
import { ADMIN_ROUTES } from '../utils/appRoutes.js';

const btn = document.getElementById("logout");

if (btn) {
    btn.addEventListener("click", async () => {
        btn.disabled = true;
        try {
            logout();
            window.location.replace(ADMIN_ROUTES.login);
        } catch (err) {
            btn.disabled = false;
            showMessage({ type: "error", title: "Errore logout", message: err?.message || "Errore durante il logout" });
        }
    });
}