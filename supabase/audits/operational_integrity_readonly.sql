-- DELGROSSO VIAGGI - Audit operativo di sola lettura.
-- Nessuna modifica a prenotazioni, flotta, pagamenti o documenti.
-- Eseguire in Supabase SQL Editor; controllare prima i risultati aggregati.

-- 1. Integrita delle prenotazioni e dei posti per viaggio.
with active as (
 select p.viaggio_id,p.id,p.posti,p.posti_selezionati
 from public.prenotazioni p
 where lower(coalesce(p.stato,'')) not in ('annullata','cancellata','cancelled')
), occupied as (
 select viaggio_id,sum(greatest(coalesce(posti,0),coalesce(cardinality(string_to_array(posti_selezionati,',')),0))) passengers
 from active group by viaggio_id
), seats as (
 select a.viaggio_id,trim(x) seat,v.posti_totali
 from active a join public.viaggi v on v.id=a.viaggio_id
 cross join lateral regexp_split_to_table(coalesce(a.posti_selezionati,''),',') x
 where trim(x)<>''
), dup as (
 select viaggio_id,seat from seats group by 1,2 having count(*)>1
)
select
 (select count(*) from public.prenotazioni) as bookings,
 (select count(*) from seats) as seat_entries,
 (select count(*) from dup) as duplicate_seat_groups,
 (select count(*) from seats where case when seat ~ '^[1-9][0-9]{0,3}$'
  then seat::integer>coalesce(posti_totali,0) else true end) as invalid_or_out_of_range,
 (select count(*) from public.viaggi v left join occupied o on o.viaggio_id=v.id
  where v.pubblicato='SI'
   and (coalesce(v.posti_occupati,0)<>coalesce(o.passengers,0)
        or coalesce(v.posti_liberi,0)<>coalesce(v.posti_totali,0)-coalesce(v.posti_occupati,0))) as inventory_mismatches;

-- 2. PDF ed email: attenzione, invio SMTP accettato non equivale a consegna.
select
 count(*) bookings,
 count(*) filter(where confirmation_storage_path is not null) pdf_archived,
 count(*) filter(where confirmation_email_sent=true) smtp_accepted,
 count(*) filter(where confirmation_token is null) missing_confirmation_tokens
from public.prenotazioni;

-- 3. Movimenti di pagamento e riconciliazione (nessun dato personale).
with movements as (
 select prenotazione_id,sum(coalesce(importo,0)) amount
 from public.pagamenti
 where prenotazione_id is not null and lower(coalesce(stato,'')) not like '%annull%'
 group by prenotazione_id
)
select count(*) booking_accounts_checked,
 count(*) filter(where abs(coalesce(p.pagato,0)-m.amount)>0.01) mismatched_payment_accounts
from movements m join public.prenotazioni p on p.id=m.prenotazione_id;

-- 4. Partenze pubblicate senza autobus associato. Solo avviso, non blocca prenotazioni.
select titolo,data_partenza,posti_totali,posti_occupati,posti_liberi
from public.viaggi
where pubblicato='SI' and autobus_id is null
order by data_partenza,titolo;
