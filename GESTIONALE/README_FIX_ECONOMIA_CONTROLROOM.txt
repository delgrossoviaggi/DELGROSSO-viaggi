FIX V3.1 - ECONOMIA + CONTROL ROOM

Correzioni:
- rimossa la chiamata a archivio_documenti, tabella non presente nel progetto Supabase attuale, che bloccava l'intera Promise di sincronizzazione;
- Economia ora calcola direttamente dai pagamenti e dalle prenotazioni Supabase già caricati;
- Control Room ora calcola direttamente da viaggi, prenotazioni, prenotazione_posti e accessi_checkin;
- selezione viaggio della Control Room aggiorna immediatamente KPI, piantina e presenze;
- mantenuta sincronizzazione automatica e manuale Supabase;
- sintassi JavaScript verificata con Node.js.
