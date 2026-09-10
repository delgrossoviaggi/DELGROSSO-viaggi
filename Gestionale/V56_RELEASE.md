# DELGROSSO GESTIONALE V56 — SUPABASE + ADMIN FIX

- Central sync asset versioned to `dg-supabase-sync-v3.js` to force a clean browser/service-worker asset URL.
- All Gestionale references updated from V2 to V3.
- Viaggi no longer depends on the central sync module; it uses its own browser-safe Supabase client plus direct REST fallback, so a central-sync failure cannot block the Viaggi screen.
- Nicola and Raffaele are both recognized as administrators by the Gestionale permission contract.
- No service_role/secret key is exposed.
