# DELGROSSO Viaggi — Sito pubblico

## Architettura
- Sito pubblico: root
- Gestionale: `GESTIONALE/` (non modificato)
- `viaggi.html`, `prenota.html`, `preventivo.html`: mantenuti come HTML; i loro flussi usano il Supabase del Gestionale.
- Nuove pagine del sito: usano il nuovo Supabase del sito configurato in `site-js/site-config.js`.

## Flussi pubblici
`viaggi.html` → legge `viaggi` dal Supabase Gestionale.
`prenota.html` → legge disponibilità tramite `get_public_booked_seats` e crea la prenotazione tramite `create_public_booking`, che aggiorna i posti in modo atomico.
`preventivo.html` → crea la richiesta tramite `create_public_quote`.

## Sviluppo locale
Richiede Node.js.
- `npm install`
- `npm run dev`
- `npm run build`

## Importante
Non modificare la cartella `GESTIONALE/` quando si aggiorna il sito pubblico.
