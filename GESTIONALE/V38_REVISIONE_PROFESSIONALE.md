# DELGROSSO GESTIONALE V38

## Obiettivo
Unificare definitivamente la navigazione e migliorare l'esperienza responsive su smartphone, tablet e PC.

## Menu
- Unico shell V38 per le pagine del Gestionale.
- Archivio presente nel menu.
- Prenotazioni e Prenotazione singola puntano alla stessa sezione di navigazione.
- Menu a drawer con backdrop, chiusura con X/click fuori/ESC e target touch.
- Il vecchio brand shell viene rimosso per evitare sovrapposizioni.

## Responsive
- Safe-area iOS.
- Smartphone Android/iOS.
- Tablet/iPad.
- Desktop/notebook.
- Toolbar e filtri fluidi.
- Tabelle con scroll interno.
- Modali contenute nell'altezza viewport.

## Prenotazioni
`dg-prenotazioni-v38.js` migliora solo la visualizzazione, senza modificare i dati:
- UUID lunghi visualizzati come identificativi abbreviati.
- Titolo/destinazione del viaggio recuperato da Supabase tramite `viaggio_id` quando disponibile.
- Date formattate in italiano.

## Archivio
L'Archivio continua a leggere `public.archivio_documenti` e mantiene il fallback sulle tabelle esistenti. Nessuna nuova tabella dati viene creata.
