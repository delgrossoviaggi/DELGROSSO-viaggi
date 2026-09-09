-- Del Grosso Gestionale: iPhone Web Push subscriptions
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_name text not null default 'admin',
  platform text not null default 'web',
  user_agent text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_active_idx on public.push_subscriptions(active);

alter table public.push_subscriptions enable row level security;

-- The existing gestionale uses its own local login, not Supabase Auth.
-- Therefore the browser only needs permission to register its own push endpoint;
-- the service role used by the Edge Function is the only role that reads all endpoints.
drop policy if exists "push subscriptions anon insert" on public.push_subscriptions;
create policy "push subscriptions anon insert"
on public.push_subscriptions
for insert to anon
with check (active = true and length(endpoint) > 20 and length(p256dh) > 20 and length(auth) > 10);

-- Optional refresh of an existing endpoint. The client normally uses ignore-duplicates,
-- so this policy is intentionally conservative.
drop policy if exists "push subscriptions anon update" on public.push_subscriptions;
create policy "push subscriptions anon update"
on public.push_subscriptions
for update to anon
using (false)
with check (false);

grant insert on public.push_subscriptions to anon;

-- Keep updated_at current when the service updates a subscription.
create or replace function public.set_push_subscription_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists push_subscriptions_updated_at on public.push_subscriptions;
create trigger push_subscriptions_updated_at
before update on public.push_subscriptions
for each row execute function public.set_push_subscription_updated_at();
