-- DELGROSSO VIAGGI 3.0 ULTIMATE — read-only seat integrity audit.
-- Runs safely against the operational Supabase project; never modifies records.
-- 1. Overall status of official layout publication and bookkeeping.
select
  (select count(*) from public.flotta where categoria='GT' and attivo) as autobus_gt,
  (select count(*) from public.dg2_layout_library where attivo) as bozze_layout_attive,
  (select count(*) from public.dg28_bus_layouts) as layout_bus_pubblicati,
  (select count(*) from public.dg28_trip_layouts) as layout_viaggio_pubblicati,
  (select count(*) from public.prenotazioni) as prenotazioni,
  (select count(*) from public.prenotazione_posti) as righe_posti,
  (select count(*) from public.pagamenti) as pagamenti;

-- 2. Future trip counters vs seat index; mismatches are diagnostic, not
--    an instruction to change totals. Legacy bookings may use text seat lists.
with seat_index as (
  select viaggio_id,count(*) as posti_indice,
         count(distinct posto) as posti_distinti
  from public.prenotazione_posti group by viaggio_id
)
select v.id as viaggio_id,v.data_partenza,v.titolo,
       v.posti_totali,v.posti_occupati,v.posti_liberi,
       coalesce(s.posti_indice,0) as posti_indice,
       coalesce(s.posti_distinti,0) as posti_distinti,
       v.posti_totali-v.posti_occupati-v.posti_liberi as scostamento_contatori,
       v.posti_occupati-coalesce(s.posti_distinti,0) as scostamento_indice,
       exists (select 1 from public.dg28_trip_layouts t
               where t.viaggio_id=v.id and t.autobus_id=v.autobus_id)
         as snapshot_viaggio_ufficiale
from public.viaggi v left join seat_index s on s.viaggio_id=v.id
where v.data_partenza >= (now() at time zone 'Europe/Rome')::date
  and v.archiviato_at is null
order by abs(v.posti_occupati-coalesce(s.posti_distinti,0)) desc,v.data_partenza;

-- 3. Duplicated active seat numbers must be investigated before changing
--    a vehicle or publishing a trip-specific layout.
with active_index as (
  select s.viaggio_id,trim(s.posto) as posto,count(distinct s.prenotazione_id) as practices
  from public.prenotazione_posti s
  join public.prenotazioni p on p.id=s.prenotazione_id
  where coalesce(p.stato,'') !~* 'annull|cancel|cancell'
  group by s.viaggio_id,trim(s.posto)
)
select viaggio_id,posto,practices from active_index where practices>1
order by viaggio_id,posto;

-- 4. Blockers for a safe new master publication. A booked future trip
--    with no independent snapshot must be explicitly validated first.
select v.id as viaggio_id,v.data_partenza,v.titolo,v.autobus_id
from public.viaggi v
where v.autobus_id is not null
  and v.data_partenza >= (now() at time zone 'Europe/Rome')::date
  and v.archiviato_at is null
  and coalesce(v.stato,'') !~* 'annull|cancel|cancell'
  and exists(select 1 from public.prenotazioni p
             where p.viaggio_id=v.id
             and coalesce(p.stato,'') !~* 'annull|cancel|cancell')
  and not exists(select 1 from public.dg28_trip_layouts t
                 where t.viaggio_id=v.id and t.autobus_id=v.autobus_id)
order by v.data_partenza;
