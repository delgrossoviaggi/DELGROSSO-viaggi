# DELGROSSO Gestionale V64 — WhatsApp Business: conferme e ricevute

## Cosa è stato aggiunto

- Nella pagina **Prenotazioni**: pulsante **💬 WhatsApp** per il cliente, con messaggio personalizzato e accesso alla conferma di prenotazione da salvare come PDF.
- Nella pagina **Pagamenti**: pulsante **💬 Invia ricevuta** soltanto per pagamenti positivi reali, con prenotazione e telefono associati. Non è disponibile per rimborsi o annullamenti.
- **Centro WhatsApp Business** accessibile dalle due pagine, oltre che dal menu V63.
- Testo modificabile, copia testo, apertura chat via link ufficiale wa.me. Invio finale sempre manuale dall'app WhatsApp Business.
- Cambiato nome cache SW a V64 per aggiornamento iPhone. Nessuna modifica DB, nessuna chiave privata.

## Ricevute e allegati: passaggio manuale obbligatorio

1. Dalla riga Pagamenti seleziona **💬 Invia ricevuta**.
2. Verifica il pagamento e premi **📄 Apri ricevuta PDF**. Salva il PDF (o dal foglio Condividi di Safari scegli WhatsApp Business se disponibile).
3. Premi **💬 Apri chat del cliente**: il messaggio è precompilato, NON inviato.
4. Scegli l'app **WhatsApp Business DELGROSSO** come mittente, allega il PDF alla conversazione giusta e premi **Invia**.

Per la conferma di prenotazione: stessa procedura nella pagina Prenotazioni. Per richieste non confermate il testo NON dichiara conferma definitiva.

## Limiti

La modalità gratuita non consente al gestionale di inviare automaticamente PDF o messaggi, selezionare forzatamente WhatsApp Business se sul dispositivo sono installate più app, registrare se la chat è stata inviata, leggere i messaggi ricevuti o creare gruppi automaticamente. Queste operazioni richiedono un'integrazione ufficiale e/o operazioni manuali.

## PUBBLICAZIONE IN SICUREZZA — IMPORTANTISSIMO

Il repository pubblico GitHub `delgrossoviaggi/DELGROSSO-viaggi` ha una **cartella GESTIONALE/** distinta dal sito.
NON sostituire il file `/index.html` nella root del sito. Il pacchetto completo contiene i file solo sotto `GESTIONALE/`.

Prima di pubblicare, devi **annullare su GitHub il commit errato `7b9352f` del 30/10/2026 che aveva sovrascritto la root del sito** (revert), senza annullare il commit successivo `2e2815d` contenente i file V63 nella cartella `GESTIONALE/`.
Il sito su Vercel è stato temporaneamente ripristinato al deployment precedente: non riattivare il deploy di HEAD finché la root non è tornata corretta.

File minimi V64 da caricare sotto `GESTIONALE/` soltanto:

- `index.html` (sostituisce `GESTIONALE/index.html` con la versione V64)
- `dg64-whatsapp-actions.js` (nuovo)
- `sw.js` (sostituisce `GESTIONALE/sw.js`)

Se la cartella è ancora V60, usare lo ZIP COMPLETO con tutti i file. Il pacchetto *patch* è per la V63 presente attualmente nel repository.

Effettua backup, preferisci Preview Vercel e prova con un numero aziendale autorizzato. Non inviare ai clienti per test.
