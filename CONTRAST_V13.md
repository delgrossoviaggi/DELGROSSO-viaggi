# V13 — Adaptive text contrast

Public image cards now choose a readable text tone from the actual photo luminance.
Dark photos use white text; bright photos use dark text with a local light veil.
If an external image cannot be sampled because of CORS, the safe white-on-dark fallback is used.

Scope: public website only. The `Gestionale/` directory is intentionally untouched.
