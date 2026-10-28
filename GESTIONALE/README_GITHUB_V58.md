# DELGROSSO VIAGGI — Gestionale integrato V58 (GitHub)

## COSA CONTIENE
Questa versione unisce **il progetto originale fornito dall'utente** (`GESTIONALE old.zip`) con
**l'interfaccia e le funzioni sviluppate fino alla V57**.

- `index.html`: nuova interfaccia V57 completa (Control Room separata, mappe GT53/GT63,
  prenotazioni e modifiche, BUS BIS, caricamento e archivio viaggi, noleggi,
  eliminazioni protette, flotta, profili Nicola/Raffaele, Cassa e notifiche).
- `operations360.js` / `operations360.css`: **originali recuperati** dallo ZIP del gestionale.
- `incassi-cassa-progressiva-v2.js`: **originale recuperato**, contabilità e quote per operatore.
- `comunicazioni-notifiche-r34.js`: **originale recuperato**, notifiche e comunicazioni.
- Immagini e icone di entrambi i pacchetti, conservate sui percorsi originari.
- `iphone.html`, `iphone-loader.js`, `recovery-iphone.html`, `sw.js`, `manifest.webmanifest`:
  supporto preesistente per iPhone e installazioni web (non viene imposto un reindirizzamento iPhone).

**Pulizia:** rimossi backup HTML, vecchi ZIP, istruzioni storiche e script **non richiamati**
dalla pagina integrata. I moduli di flotta, assistente e pagamenti inclusi inline nella V57
non sono caricati una seconda volta, per evitare conflitti.

## GUIDA GITHUB — NON CANCELLARE A CASO
1. Eseguire **backup** dell'attuale repository GitHub prima della sostituzione.
2. Creare idealmente un **branch di prova** (es. `integrazione-v58`).
3. Estrarre lo ZIP; caricare **il CONTENUTO**, non la cartella ZIP,
   nella stessa directory che contiene l'attuale `index.html` del gestionale.
4. Sostituire i file con lo stesso nome; **non eliminare altri file o cartelle già presenti**.
5. Conservare i percorsi `assets/` e i quattro file esterni JS/CSS nella stessa cartella di `index.html`.
6. Pubblicare prima su una **Preview Vercel**, accedere con NICOLA e RAFFAELE e verificare
   viaggi, prenotazioni, Control Room, sedi, BUS BIS, pagamenti, ricevute, flotta e noleggi.
7. Solo dopo i test, unire il branch in `main` (se collegato alla produzione).
8. Se appare la vecchia versione: ricaricare ignorando la cache (`Ctrl+F5`) oppure
   usare `recovery-iphone.html` su iPhone per rimuovere la vecchia cache del gestionale.

## NOTE IMPORTANTI
- Gli script sono stati controllati staticamente. Sono previsti test base in browser,
  **non** una validazione di ogni operazione con account reali/Supabase.
- Le funzioni RPC Supabase per eliminazione e archivio viaggi/noleggi create nelle versioni
  precedenti **devono restare disponibili** nel progetto Supabase attuale. Caricare questi file
  su GitHub **non** ricrea automaticamente le funzioni del database.
- Le piantine GT53 e GT63 sono implementate in `index.html`; le prenotazioni e i
  relativi posti sono caricati da Supabase, non copiati in questo ZIP.
- Per motivi di sicurezza **non** includere password, chiavi segrete `service_role` o file `.env` nel repository pubblico.
- Nessun dato operativo Supabase è stato modificato durante la preparazione di questo ZIP.
- I file `iphone*` sono stati preservati per compatibilità; il normale percorso desktop/mobile
  resta `index.html`.

## FILE PRINCIPALE
**index.html** (insieme agli script originali recuperati).
