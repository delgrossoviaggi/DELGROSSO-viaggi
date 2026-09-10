# DELGROSSO Gestionale V57 — Viaggi / Routing Fix

- Fixed Viaggi import from appRoutes: uses exported routes object (`t as routes`) instead of the URL builder function.
- Fixed “Apri Viaggio” navigation so it opens `./centro-operativo.html?trip=<uuid>` instead of `./undefined?trip=...`.
- Removed obsolete `dg-supabase-sync-v2.js` from the package to prevent accidental loading/confusion.
- Bumped local Viaggi snapshot key to V57.
- Supabase project remains the Gestionale project.
