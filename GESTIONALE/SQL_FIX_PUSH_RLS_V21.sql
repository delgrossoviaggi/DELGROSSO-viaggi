-- DELGROSSO V21 — Fix RLS per registrazione Web Push
-- Questa tabella contiene esclusivamente subscription push.

alter table public.push_subscriptions enable row level security;

do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'push_subscriptions'
  loop
    execute format('drop policy if exists %I on public.push_subscriptions', p.policyname);
  end loop;
end $$;

grant insert on table public.push_subscriptions to anon;

grant insert on table public.push_subscriptions to authenticated;

create policy "push subscriptions client insert"
on public.push_subscriptions
for insert
to anon, authenticated
with check (
  endpoint is not null
  and length(endpoint) > 20
  and p256dh is not null
  and length(p256dh) > 20
  and auth is not null
  and length(auth) > 10
  and coalesce(active, true) = true
);

-- Verifica finale: deve mostrare la policy appena creata.
select policyname, permissive, roles, cmd, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'push_subscriptions';
