# DELGROSSO GESTIONALE V36 — Revisione professionale

## Obiettivi
- Un solo menu/drawer responsive su tutte le pagine autenticate.
- Fallback shell resiliente anche sulle pagine che non caricavano esplicitamente il brand shell.
- Navigazione centralizzata con Archivio incluso.
- UX touch e accessibilità di base: focus visibile, ESC per chiudere, target touch, safe-area.
- Layout fluido per iPhone, Android, tablet/iPad e PC.
- Nessuna modifica distruttiva a Supabase o ai dati.

## Archivio
`archivio.html` continua a leggere `public.archivio_documenti` tramite REST; il bucket dei PDF resta privato.

## Nota
La V36 è una revisione UI/navigazione. Non modifica credenziali, schema dati o funzioni Edge.
