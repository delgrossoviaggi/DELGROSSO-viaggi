/*
DELGROSSO ADMIN — FIX UPLOAD CLOUDINARY
Sostituire ESCLUSIVAMENTE la funzione uploadCloudinary() esistente in admin.html.
Non modificare Supabase Gestionale.
*/

async function uploadCloudinary(file) {
    if (!file) throw new Error("Nessun file selezionato.");

    const maxMB = 20;
    if (file.size > maxMB * 1024 * 1024) {
        throw new Error(`File troppo grande. Massimo ${maxMB} MB.`);
    }

    if (!file.type || !file.type.startsWith("image/")) {
        throw new Error(`Formato non supportato: ${file.type || "sconosciuto"}`);
    }

    const endpoint =
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);

    let response;

    try {
        response = await fetch(endpoint, {
            method: "POST",
            body: formData
        });
    } catch (networkError) {
        throw new Error(
            "Impossibile raggiungere Cloudinary. Controlla la connessione, " +
            "eventuali estensioni/ad-blocker e che il sito sia in HTTPS."
        );
    }

    let data = null;

    try {
        data = await response.json();
    } catch (_) {
        throw new Error(
            `Cloudinary ha restituito una risposta non valida (HTTP ${response.status}).`
        );
    }

    if (!response.ok || !data?.secure_url) {
        const message =
            data?.error?.message ||
            data?.error?.http_code ||
            `HTTP ${response.status}`;

        throw new Error(`Upload Cloudinary fallito: ${message}`);
    }

    return data.secure_url;
}
