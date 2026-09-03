# V37 — Unified professional shell + responsive + archive resilience

- One navigation shell for all authenticated pages.
- Legacy `brandShell` converted to compatibility bridge to prevent duplicate/hidden menus.
- Archivio is included in the unified menu.
- Archive reads `public.archivio_documenti` first and falls back to the same Supabase tables if the view is unavailable.
- Archive keeps private Storage URLs and existing document actions.
- Prenotazioni table now shortens UUID-like booking codes and uses readable trip labels/date formatting when data is available.
- Responsive shell targets iPhone/iOS, Android, tablets/iPad and desktop.
