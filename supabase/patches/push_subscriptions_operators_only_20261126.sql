-- 26/11/2026 - Notifiche push riservate agli operatori attivi.
-- Motivo: le notifiche contengono nome cliente e destinazione; prima chiunque
-- (anche senza accesso) poteva registrare un dispositivo e riceverle.
-- APPLICATA sul progetto gestionale chkuayhbmitdmzmmvona.
drop policy if exists "push subscriptions client insert" on public.push_subscriptions;
create policy "push subscriptions operator insert" on public.push_subscriptions
  for insert to authenticated
  with check (
    (select dg_private.is_operator())
    and endpoint is not null and length(endpoint) > 20
    and p256dh is not null and length(p256dh) > 20
    and auth is not null and length(auth) > 10
    and coalesce(active, true) = true
  );
revoke insert on public.push_subscriptions from anon;

-- ANNULLAMENTO (ripristina la situazione precedente):
-- drop policy if exists "push subscriptions operator insert" on public.push_subscriptions;
-- grant insert on public.push_subscriptions to anon;
-- create policy "push subscriptions client insert" on public.push_subscriptions
--   for insert to anon, authenticated
--   with check (endpoint is not null and length(endpoint) > 20 and p256dh is not null
--     and length(p256dh) > 20 and auth is not null and length(auth) > 10
--     and coalesce(active, true) = true);
