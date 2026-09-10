-- V24: ricevute Acconto/Saldo, copia nel fascicolo e invio email.
alter table public.pagamenti add column if not exists receipt_number text;
alter table public.pagamenti add column if not exists receipt_generated_at timestamptz;
alter table public.pagamenti add column if not exists receipt_storage_path text;
alter table public.pagamenti add column if not exists receipt_email_sent boolean default false;
alter table public.pagamenti add column if not exists receipt_email_sent_at timestamptz;
alter table public.pagamenti add column if not exists receipt_email_error text;
create unique index if not exists pagamenti_receipt_number_uidx on public.pagamenti(receipt_number) where receipt_number is not null;
insert into storage.buckets (id,name,public) values ('ricevute-prenotazioni','ricevute-prenotazioni',false) on conflict (id) do nothing;
