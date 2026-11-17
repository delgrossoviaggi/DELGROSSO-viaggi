-- DELGROSSO VIAGGI 4.0 ULTIMATE / FASE 0
-- SOLO LETTURA / PROGETTO: chkuayhbmitdmzmmvona
-- 17 NOV 2026
-- Eseguire separatamente le query dopo il ripristino di PostgreSQL.
-- Nessun INSERT/UPDATE/DELETE, nessun RESTART, nessuna migrazione.

-- A) Verifica connessioni e attese (non espone testo delle query)
select current_setting('max_connections') as max_connections,
       count(*) as all_connections,
       count(*) filter (where state = 'active') as active,
       count(*) filter (where state = 'idle') as idle,
       count(*) filter (where state = 'idle in transaction') as idle_in_transaction
from pg_stat_activity;

select datname,
       application_name,
       usename,
       state,
       wait_event_type,
       wait_event,
       count(*) as connections,
       max(extract(epoch from now() - coalesce(xact_start, query_start, backend_start)))::integer as longest_seconds
from pg_stat_activity
where datname = current_database()
group by datname, application_name, usename, state, wait_event_type, wait_event
order by connections desc, longest_seconds desc
limit 100;

-- B) Informazioni aggregate sulle tabelle e schema operativo
select table_schema, count(*) as tables
from information_schema.tables
where table_type='BASE TABLE' and table_schema not in ('pg_catalog','information_schema')
group by table_schema
order by table_schema;

select c.table_schema, c.table_name, c.column_name, c.data_type,
       c.is_nullable, c.column_default
from information_schema.columns c
where c.table_schema in ('public','dg_private','dg_public_api')
order by c.table_schema,c.table_name,c.ordinal_position;

-- C) Indici/vincoli: lettura struttura
select n.nspname as schema_name, t.relname as table_name, i.relname as index_name,
       pg_get_indexdef(ix.indexrelid) as index_definition
from pg_index ix
join pg_class t on t.oid=ix.indrelid
join pg_class i on i.oid=ix.indexrelid
join pg_namespace n on n.oid=t.relnamespace
where n.nspname in ('public','dg_private')
order by 1,2,3;

select conrelid::regclass::text as table_name, conname, contype,
       pg_get_constraintdef(oid) as constraint_definition
from pg_constraint
where connamespace in ('public'::regnamespace,'dg_private'::regnamespace)
order by 1,2;

-- D) Trigger: definizioni, non esecuzione
select event_object_schema,event_object_table,trigger_name,
       action_timing,event_manipulation,action_statement
from information_schema.triggers
where trigger_schema='public'
order by 1,2,3;

-- E) RLS: lettura policy, NON disabilitare
select schemaname,tablename,policyname,cmd,roles,qual,with_check
from pg_policies
where schemaname in ('public','storage','dg_private')
order by schemaname,tablename,policyname;

-- F) Conteggi e status business
select (select count(*) from public.viaggi) as viaggi,
       (select count(*) from public.viaggi where upper(trim(coalesce(pubblicato,'')))='SI') as pubblicati,
       (select count(*) from public.prenotazioni) as prenotazioni,
       (select count(*) from public.clienti) as clienti,
       (select count(*) from public.pagamenti) as pagamenti,
       (select count(*) from public.prenotazione_posti) as posti,
       (select count(*) from public.dg2_piantine) as piantine,
       (select count(*) from public.dg2_layout_library) as layout_library,
       (select count(*) from public.dg28_bus_layouts) as layouts_bus_ufficiali,
       (select count(*) from public.dg28_trip_layouts) as layouts_viaggio_ufficiali,
       (select count(*) from public.operatori_gestionale where attivo) as operatori_attivi;

select stato, riserva_aziendale, count(*) as senza_piantina
from public.prenotazioni p
where p.posti>0
  and not exists(select 1 from public.prenotazione_posti s where s.prenotazione_id=p.id)
group by stato, riserva_aziendale
order by senza_piantina desc;

-- G) Verifiche referenziali che NON modificano dati
select 'booking_senza_viaggio' as controllo,count(*) as totale
from public.prenotazioni p left join public.viaggi v on v.id=p.viaggio_id
where p.viaggio_id is not null and v.id is null
union all
select 'posto_senza_booking',count(*) from public.prenotazione_posti s
left join public.prenotazioni p on p.id=s.prenotazione_id
where s.prenotazione_id is not null and p.id is null
union all
select 'posto_senza_viaggio',count(*) from public.prenotazione_posti s
left join public.viaggi v on v.id=s.viaggio_id
where s.viaggio_id is not null and v.id is null
union all
select 'pagamento_senza_booking',count(*) from public.pagamenti x
left join public.prenotazioni p on p.id=x.prenotazione_id
where x.prenotazione_id is not null and p.id is null
union all
select 'posto_viaggio_diverso',count(*) from public.prenotazione_posti s
join public.prenotazioni p on p.id=s.prenotazione_id
where s.viaggio_id is distinct from p.viaggio_id;

select viaggio_id,posto,count(*) as duplicati
from public.prenotazione_posti
group by viaggio_id,posto having count(*)>1;

-- H) Storage: solo inventario, NON scarica né modifica oggetti
select b.id,b.name,b.public,coalesce(count(o.id),0) as files
from storage.buckets b
left join storage.objects o on o.bucket_id=b.id
group by b.id,b.name,b.public
order by b.name;

-- I) Funzioni pubbliche e relativi permessi
select n.nspname as schema_name,p.proname as routine,
       pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer,
       has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','dg_public_api','dg_private')
order by 1,2;

-- J) Nessuna delle SELECT precedenti sostituisce un backup certificato.
