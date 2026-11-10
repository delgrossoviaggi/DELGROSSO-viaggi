# DELGROSSO V6 — PC, iOS e Android con le stesse funzioni

Questa release integra la V5 senza sostituire la Business Suite originale o alterare gli archivi.

- Le otto funzioni principali sono sempre presenti nel menu desktop e nei collegamenti Dashboard.
- Sotto 850 px compare il pulsante inferiore **Funzioni** con le stesse otto voci. **Menu aziendale completo** apre tutte le altre sezioni della Business Suite, senza nasconderle.
- Le schermate dei moduli, le tabelle, i form e i dialoghi sono state adattate al tocco. Le funzionalità interne e i dati sono gli stessi; non esiste una versione database separata per mobile.
- Le sessioni operatori e i permessi Supabase restano obbligatori. Nessun interruttore per la scrittura, nessun blocco automatico dello schermo.
- Con gli account Nicola/Raffaele, il comportamento reale su Safari iOS e Chrome Android è ancora da collaudare; i test in Chromium riguardano il nuovo menu mobile isolato, non le scritture DB o le funzioni legacy.

## Pubblicazione manuale su GitHub

Caricare tutti i file della cartella `GESTIONALE_V2/` nella root del branch di prova, non il file ZIP come elemento. Verificare il file `GESTIONALE_V2/dg-v6-mobile-parity.css`, il file `GESTIONALE_V2/dg-v6-mobile-parity.js` e `GESTIONALE_V2/VERIFICA_RELEASE.html`.

Aprire `/GESTIONALE_V2/VERIFICA_RELEASE.html`, poi `/GESTIONALE_V2/index.html?v=20261109-v6-mobile`. Aggiornare la scheda (o eliminare i dati del sito PWA) se viene mostrato il vecchio menu.

## Collaudo suggerito in 4 passaggi

1. Accesso da PC, iPhone e Android con operatori autorizzati: un solo login, stesso elenco viaggi.
2. Controllo visivo delle otto funzioni e del menu completo su tutti i dispositivi.
3. Prenotazioni: confronto dei posti occupati/liberi in Control Room e nel modulo nuova prenotazione.
4. Pagamenti e Agenda: verifica di lettura sincronizzata tra dispositivi; scritture solo dopo backup e in una prova autorizzata.

Il test responsivo isolato ha passato cinque viewport (375,390,412,768,1365 px). Non equivale al collaudo reale di Safari e Android.
