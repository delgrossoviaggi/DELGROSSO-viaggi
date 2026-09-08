# DELGROSSO Gestionale V4.8 — Stability

- All client fields used by the UI are aligned with the Supabase schema.
- "Comune" is persisted to the canonical `clienti.citta` column.
- Client fields `codice_cliente`, `data_nascita`, `stato_cliente`, `provenienza` are persisted.
- Booking total uses canonical `prenotazioni.totale`; obsolete `importo` is no longer written.
- Booking date is persisted in `prenotazioni.data_prenotazione`.
- Booking list/editor falls back to `totale` so existing bookings render their amounts correctly.
- Service-worker cache key bumped to V4.8 to force a fresh asset cache.
- Existing records are preserved.
