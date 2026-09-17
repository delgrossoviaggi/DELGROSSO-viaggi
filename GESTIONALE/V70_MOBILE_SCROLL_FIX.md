# DELGROSSO GESTIONALE V70 — MOBILE SCROLL FIX

- Removed the global click-to-focus handler from dg-v46-ux.js.
- That handler focused the first input in any open modal after every click, causing mobile browsers to jump back to the beginning of the client/customer card or modal.
- Added cache-busting `?v=70` to references so browsers load the corrected script.
- No Supabase service, URL, key, schema, or data layer was changed.
