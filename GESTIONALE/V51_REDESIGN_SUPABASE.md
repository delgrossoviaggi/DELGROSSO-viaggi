# DELGROSSO GESTIONALE V51

- Redesign visuale unificato di tutte le sezioni.
- Nuova shell laterale/header responsive, tema chiaro/scuro e stato connessione.
- Verifica diretta browser-safe dell'endpoint Supabase del gestionale.
- Cache applicativa del Gestionale disattivata per evitare vecchie versioni.
- Moduli business esistenti e servizi Supabase preservati: il redesign non sostituisce le operazioni CRUD.
- Modulo prenotazioni: pulsante di salvataggio sempre visibile nel footer sticky della finestra.
- Evento `dg:refresh` disponibile per i moduli che devono forzare il refresh dati dopo riconnessione.
