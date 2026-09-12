# DELGROSSO Gestionale V49 — Locked UI + Security Phase 1

## UI
- Unified final visual layer: `assets/dg-v49-locked-ui.css`.
- Loaded last on every Gestionale HTML page, including login.
- Responsive behavior standardized for desktop, tablet and smartphone.
- iOS safe-area support and narrow viewport rules included for iPhone 17 Pro class widths (~402px CSS portrait).
- Tables become horizontally scrollable inside their own container instead of overflowing the page.
- Touch controls use a minimum 44px target where applicable.
- Service-worker cache version bumped to V49 to force the new UI layer to refresh.

## Supabase security phase 1
Applied migration `20260909_security_hardening_safe_phase1`:
- fixed mutable `search_path` on internal helper functions;
- revoked public execution of internal `sync_viaggio_identifier()`;
- intentionally preserved public booking/quote RPC execution because the public site depends on those endpoints.

## Important
A full RLS lock-down for Gestionale data requires moving the Gestionale from browser/localStorage authentication to Supabase Auth (or an equivalent server-trusted identity). The current frontend uses local authentication, so replacing `anon` policies with `authenticated` policies immediately would break CRUD screens. V49 therefore applies only the safe security changes that do not introduce functional blocks.
