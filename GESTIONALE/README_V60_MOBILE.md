# DELGROSSO Gestionale V60 — correzione della schermata iPhone

## Correzione
- Elimina la doppia barra su iPhone: rimane soltanto l’intestazione DELGROSSO blu con menu, notifiche e profilo.
- Il vecchio header HTML viene conservato come struttura tecnica per compatibilità, ma non è visibile nell’app autenticata su smartphone/tablet.
- La Scrivania riprende subito sotto la barra superiore, senza una seconda toolbar.
- Se una vecchia URL `#...` non corrisponde a una pagina reale, apre la Scrivania anziché lasciare il contenuto bianco.
- Protezione all’avvio della sessione e dopo il ritorno a Safari, senza cicli continui e senza richiamare Supabase.
- Nuova versione cache del service worker; aggiornata la URL del launcher iPhone.

## Installazione GitHub
1. Crea un backup o branch del repository e carica **tutti i file** dello ZIP mantenendo la struttura delle cartelle `assets`.
2. Non eliminare i file GitHub non presenti nello ZIP se appartengono al sito o al gestionale.
3. Attendi il deployment Preview Vercel, prova login, Scrivania, menu, Control Room, prenotazioni e gestione posti su iPhone.
4. Soltanto dopo il test pubblica in produzione.
5. In Safari chiudi la scheda e apri di nuovo la pagina; se usi l'icona Home, riapri anche la web app.

## Limiti
Test visivo e funzionale simulato su browser Chromium con viewport iPhone. Le chiamate Supabase dei due account vanno collaudate nell’ambiente reale. Nessun dato sul database è stato modificato.
