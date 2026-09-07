-- V49: allow both anon and authenticated Supabase sessions on operational tables.
-- The Gestionale uses local authentication, but supabase-js may otherwise restore
-- an existing authenticated session on a device. Without matching authenticated
-- RLS policies, writes to tables protected only for anon can fail.
create policy "clienti_authenticated_all" on public.clienti as permissive for all to authenticated using (true) with check (true);
create policy "prenotazioni_authenticated_all" on public.prenotazioni as permissive for all to authenticated using (true) with check (true);
create policy "viaggi_authenticated_all" on public.viaggi as permissive for all to authenticated using (true) with check (true);
create policy "preventivi_authenticated_all" on public.preventivi as permissive for all to authenticated using (true) with check (true);
create policy "impostazioni_authenticated_all" on public.impostazioni as permissive for all to authenticated using (true) with check (true);
