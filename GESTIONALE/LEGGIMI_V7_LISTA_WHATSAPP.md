# DELGROSSO Business Suite V7 — Lista WhatsApp per viaggio

**Base:** V6 PC/iOS/Android (tutti gli altri moduli preservati). **Data:** 11 novembre 2026.

## Cosa è stato aggiunto

- `Lista WhatsApp prenotati` nel **MENU AZIENDALE**, nella Dashboard e nel menu rapido mobile.
- Filtro per viaggio e per BUS 1/BUS BIS, con ricerca della lista dai dati prenotazioni già caricati da Supabase.
- Caselle di selezione accanto a ogni referente; **Seleziona tutti**, **Deseleziona**; contatore dei numeri selezionati.
- **Copia numeri selezionati** (`+39...`, uno per riga) e **Copia con nominativi**.
- **Copia prossimo numero**: copia una persona alla volta per incollarla nella ricerca "Aggiungi membri" di WhatsApp, senza importare la rubrica.
- **Contatti .VCF (facoltativo)**: genera solo per i selezionati. Il file NON salva nulla nel telefono finché **l'utente non lo importa**. L'importazione aggiunge i contatti al telefono, quindi non usarla se non vuoi contatti in rubrica.
- **Apri prossimo invito**: apre la chat individuale con il link di gruppo **solo se** è stato registrato il consenso per quello specifico viaggio/bus e il link del gruppo è valido. L'operatore deve premere **Invia** su WhatsApp; non ci sono invii automatici.
- Deduplica per numero telefonico e mantiene separati bus 1 / BIS. I prenotati annullati, le riserve aziendali e i record senza numero vengono esclusi dall'export; gli assenti vengono conteggiati.

## Limite tecnico WhatsApp

**WhatsApp non crea un gruppo o seleziona in blocco i membri da un testo di numeri incollati.** Anche con la lista copiata, devi selezionare i numeri nell'app. Alternative: inserimento uno alla volta con il comando "Copia prossimo", oppure importazione facoltativa VCF e scelta dei contatti in WhatsApp. Nei gruppi i numeri dei partecipanti possono essere visibili agli altri membri. Sono richieste informazione e consenso adeguati; il gestionale distingue chi ha dato il consenso specifico agli inviti.

## Caricamento manuale su GitHub

1. Estrai questo ZIP. NON caricare lo ZIP come un singolo file nel sito.
2. Su GitHub crea un **branch di prova** dal repository DELGROSSO.
3. Carica **l'intera cartella** `GESTIONALE_V2` alla radice; non toccare `GESTIONALE/`, `prenota.html` o il sito pubblico.
4. Controlla la Preview Vercel: `/GESTIONALE_V2/VERIFICA_RELEASE.html` deve indicare **VERSIONE V7 VERIFICATA**.
5. Apri `/GESTIONALE_V2/index.html?v=20261111-v7-whatsapp`. Esegui il normale login Nicola/Raffaele.
6. Apri **Lista WhatsApp prenotati** dal menu o dalla Dashboard. Seleziona viaggio, bus e numeri. Verifica la copia e l'apertura dei link sui tuoi dispositivi.

## Supabase e sicurezza

- La V7 usa il Supabase attuale tramite `state.viaggi`, `state.prenotazioni`, `state.whatsappInvites`. Nessuna tabella nuova, nessuna migrazione, nessuna chiave segreta frontend.
- Le selezioni di numeri sono **soltanto in memoria** e non sono memorizzate in `localStorage` o `sessionStorage` dal nuovo modulo.
- L'invio resta un atto manuale. La rubrica non è modificata dal gestionale.
- È stato verificato che esistono le tabelle `prenotazioni`, `dg_trip_group_consents_v65` e `dg_whatsapp_trip_invites_v61` sul progetto gestionale. **I consensi specifici al gruppo risultavano zero al momento della verifica**: gli inviti sono quindi bloccati finché non sono registrati, mentre la lista e la copia funzionano.
- Per i clienti che prenotano per più persone, il numero è quello del **referente della prenotazione**: non sono disponibili necessariamente i cellulari di ogni singolo passeggero.

## Collaudo

Test Chromium **con dati fittizi**, su viewport 1365 px e 390 px, superati per: liste e filtri, BUS/BIS, esclusione prenotazioni annullate, telefoni mancanti, deduplica, selezione individuale/tutti, copia di selezionati/prossimo e generazione di file VCF validi. Controllo `node --check` superato su 45 script HTML e 26 file JS. **Non è stato eseguito un invio reale via WhatsApp né verificata la pubblicazione online**. Non sono state eseguite scritture sul database.
