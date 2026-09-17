# Security decision — V49

The database currently exposes several Gestionale tables through permissive `anon` RLS policies (`USING true`, `WITH CHECK true`). This cannot be safely converted to authenticated-only access while the frontend authenticates locally in the browser.

The high-risk `impostazioni` table contains SMTP configuration fields. A complete hardening pass should be paired with a Supabase Auth migration and then replace anonymous CRUD policies with role-aware authenticated policies.

V49 does not fake a security fix that would break the application. It applies non-breaking hardening first and documents the required next architectural step.
