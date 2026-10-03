-- Già applicata sul Supabase gestionale
create table if not exists public.ai_operazioni (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  richiesta text not null,
  piano jsonb not null,
  stato text not null default 'PENDING' check (stato in ('PENDING','EXECUTING','COMPLETED','FAILED','CANCELLED','EXPIRED')),
  risultato jsonb,
  errore text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  executed_at timestamptz
);
alter table public.ai_operazioni enable row level security;
