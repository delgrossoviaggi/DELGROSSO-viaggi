# DELGROSSO VIAGGI 2.0 · fase iniziale — 06/11/2026

## Stato del lavoro
Questa cartella contiene **un primo prototipo navigabile e un editor funzionante di piantine**, NON il gestionale completo e NON una migrazione completata. Tutto risiede nel branch separato feature/gestionale-v2-isolato-20261106. Il branch main, il gestionale operativo e Supabase non vengono modificati.

## Implementato e verificabile
- Nuova interfaccia responsive per iPhone, Android e desktop, con navigazione Dashboard, Piantine, Viaggi, Prenotazioni, Cassa, Flotta.
- Piantine originali GT53, GT63 e GT63B prelevate dalla costante REAL_LAYOUTS di prenota.html del vecchio sito: stesso ordine dei numeri, corridoi, porta e fondo autobus. Le piantine originali restano modelli immutati; ogni modifica viene salvata come copia bozza.
- Editor: cambia numero sedile, sostituisce celle con corridoio, porta o vuoto; aggiunge/rimuove file; valida i duplicati; crea un nuovo schema; importa/esporta JSON.
- Bozze conservate SOLO nel localStorage del browser utilizzato. Vanno esportate come JSON per evitare perdite. Il vecchio campo flotta.seat_layout resta GT53/GT63: non viene sovrascritto.
- Accesso Supabase Auth solo con URL ufficiale del progetto gestionale e chiave publishable/anon, più email/password di un operatore. Il codice legge esclusivamente tramite GET i record autorizzati di viaggi, prenotazioni (senza nomi/telefoni), prenotazione_posti e flotta; nessuna scrittura nei dati di produzione.
- Mostra panoramica viaggi e BUS BIS, flotta e disponibilità dei posti occupati nella mappa. Le metriche finanziarie non sono ancora attivate: evitare di mostrare somme non riconciliate.

## Prima dell'avvio come vero gestionale
1. Backup completo e test di ripristino di database, storage e utenze; verificare storico file PDF. Nessun backup è stato ancora effettuato da questo prototipo.
2. Audit schema esistente, vincoli di integrità, sicurezza RLS, Edge Functions, ruoli, consensi, file archiviati.
3. Verifica su staging separato con copie controllate dei dati; eventuale progettazione di nuove tabelle/additive migrations per i layout personalizzati, senza eliminare quelli già in uso.
4. Replica/collaudo della contabilità V80: incassi Nicola/Raffaele per ogni viaggio e prenotazione, rimborsi, POS, importi in centesimi, BUS BIS e trasferimenti.
5. Gestione atomica prenotazioni/trasferimenti posti e doppia prenotazione; test su iPhone e PC; ricevute e PDF, comunicazioni e consenso WhatsApp.
6. Pubblicazione protetta distinta dal gestionale attuale; disabilitare modalità demo per l'uso reale.

## Avvio
Con un server statico (es.: python3 -m http.server 8000) aprire il percorso /GESTIONALE_V2/.
Non inserire mai una chiave sb_secret_ o service_role nel browser. Non inserire password nel codice o nel repository.
I dati operativi vengono caricati solo dopo login di un operatore autorizzato e rispettano RLS del database. Se una policy nega la lettura, mostrare errore e verificare autorizzazioni, non disabilitare RLS.
