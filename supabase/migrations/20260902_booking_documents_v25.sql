-- V25: archivio conferme prenotazione + comunicazioni
alter table public.prenotazioni add column if not exists confirmation_number text;
alter table public.prenotazioni add column if not exists confirmation_storage_path text;
alter table public.prenotazioni add column if not exists confirmation_generated_at timestamptz;
alter table public.prenotazioni add column if not exists confirmation_email_sent boolean default false;
alter table public.prenotazioni add column if not exists confirmation_email_sent_at timestamptz;
alter table public.prenotazioni add column if not exists confirmation_email_error text;
create unique index if not exists prenotazioni_confirmation_number_uidx on public.prenotazioni(confirmation_number) where confirmation_number is not null;
insert into storage.buckets (id,name,public) values ('ricevute-prenotazioni','ricevute-prenotazioni',false) on conflict (id) do nothing;
