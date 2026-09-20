DELGROSSO V158 — BATCH 1 — PRENOTAZIONI SITO -> GESTIONALE

OBIETTIVO
Rendere il flusso prenotazione dal sito più affidabile, evitando che un timeout/retry possa creare duplicati e facendo arrivare la prenotazione al database operativo del Gestionale.

COMPONENTI
1) Supabase gestionale: migration SQL con create_public_booking_v2 + request_id/idempotenza.
2) Supabase sito: Edge Function gestionale-bridge v6, con timeout/retry e health check.
3) Sito: js/gestionale.js + prenota.html + viaggi.html da aggiornare con il patch descritto nel file PATCH_SITE.txt.
4) GESTIONALE_V157.../ è la base completa del Gestionale, invariata in questo batch per non introdurre modifiche non necessarie.

IMPORTANTE
Il repository GitHub non è stato modificato dal connettore GitHub: la scrittura GitHub ha restituito 403. Quindi NON bisogna considerare il sito già aggiornato su GitHub/Vercel. La parte Supabase è stata applicata direttamente.
