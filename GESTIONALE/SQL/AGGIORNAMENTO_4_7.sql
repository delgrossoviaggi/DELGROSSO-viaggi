-- Eseguire nel SQL Editor del progetto Supabase gestionale PRIMA di pubblicare la 4.7.
-- Non elimina dati esistenti. Verificare le politiche RLS già in uso.
ALTER TABLE public.prenotazioni ADD COLUMN IF NOT EXISTS fermata_partenza text;
ALTER TABLE public.prenotazioni ADD COLUMN IF NOT EXISTS giorni_acconto integer DEFAULT 2;
ALTER TABLE public.prenotazioni ADD COLUMN IF NOT EXISTS scadenza_acconto timestamptz;
ALTER TABLE public.noleggi_bus ADD COLUMN IF NOT EXISTS flotta_id uuid;
CREATE TABLE IF NOT EXISTS public.dg_blocchi_flotta (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), flotta_id uuid NOT NULL REFERENCES public.flotta(id),
 data_inizio date NOT NULL, data_fine date NOT NULL, motivo text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT dg_blocchi_date_valide CHECK (data_fine >= data_inizio)
);
CREATE INDEX IF NOT EXISTS dg_blocchi_flotta_mezzo_date_idx ON public.dg_blocchi_flotta(flotta_id,data_inizio,data_fine);
-- Scadenza definita dal server, modificabile variando giorni_acconto.
CREATE OR REPLACE FUNCTION public.dg_booking_deposit_deadline() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='INSERT' THEN
   NEW.giorni_acconto := coalesce(NEW.giorni_acconto,2);
   NEW.scadenza_acconto := now() + make_interval(days => NEW.giorni_acconto);
 ELSIF NEW.giorni_acconto IS DISTINCT FROM OLD.giorni_acconto THEN
   NEW.scadenza_acconto := coalesce(OLD.created_at,now()) + make_interval(days => NEW.giorni_acconto);
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS dg_booking_deposit_deadline_trg ON public.prenotazioni;
CREATE TRIGGER dg_booking_deposit_deadline_trg BEFORE INSERT OR UPDATE OF giorni_acconto
 ON public.prenotazioni FOR EACH ROW EXECUTE FUNCTION public.dg_booking_deposit_deadline();
-- Validazione sul server: impedisce sovrapposizioni tra viaggi, noleggi con acconto e blocchi manuali.
CREATE OR REPLACE FUNCTION public.dg_assert_fleet_free(p_flotta uuid,p_from date,p_to date,p_exclude_trip uuid DEFAULT NULL,p_exclude_rental uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 IF p_flotta IS NULL OR p_from IS NULL THEN RETURN; END IF;
 IF p_to IS NULL THEN p_to:=p_from; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_flotta::text,0));
 IF EXISTS (SELECT 1 FROM public.dg_blocchi_flotta b WHERE b.flotta_id=p_flotta AND b.data_inizio<=p_to AND b.data_fine>=p_from) THEN
  RAISE EXCEPTION 'Mezzo bloccato nelle date richieste'; END IF;
 IF EXISTS (SELECT 1 FROM public.viaggi v WHERE v.autobus_id=p_flotta AND (p_exclude_trip IS NULL OR v.id<>p_exclude_trip)
 AND coalesce(v.stato,'') !~* 'annull' AND v.data_partenza::date<=p_to AND v.data_partenza::date>=p_from) THEN
  RAISE EXCEPTION 'Mezzo assegnato a un altro viaggio'; END IF;
 IF EXISTS (SELECT 1 FROM public.noleggi_bus n WHERE n.flotta_id=p_flotta AND (p_exclude_rental IS NULL OR n.id<>p_exclude_rental)
 AND coalesce(n.stato_noleggio,'') !~* 'annull|completat' AND coalesce(n.acconto,0)>0
 AND n.data_partenza::date<=p_to AND coalesce(n.data_ritorno,n.data_partenza)::date>=p_from) THEN
  RAISE EXCEPTION 'Mezzo assegnato a un noleggio con acconto'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.dg_guard_trip_fleet() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.autobus_id IS NOT NULL AND coalesce(NEW.stato,'') !~* 'annull' THEN
 PERFORM public.dg_assert_fleet_free(NEW.autobus_id,NEW.data_partenza::date,NEW.data_partenza::date,NEW.id,NULL);
 END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS dg_guard_trip_fleet_trg ON public.viaggi;
CREATE TRIGGER dg_guard_trip_fleet_trg BEFORE INSERT OR UPDATE OF autobus_id,data_partenza,stato ON public.viaggi
 FOR EACH ROW EXECUTE FUNCTION public.dg_guard_trip_fleet();
CREATE OR REPLACE FUNCTION public.dg_guard_rental_fleet() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.flotta_id IS NOT NULL AND coalesce(NEW.acconto,0)>0 AND coalesce(NEW.stato_noleggio,'') !~* 'annull|completat' THEN
 PERFORM public.dg_assert_fleet_free(NEW.flotta_id,NEW.data_partenza::date,coalesce(NEW.data_ritorno,NEW.data_partenza)::date,NULL,NEW.id);
 END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS dg_guard_rental_fleet_trg ON public.noleggi_bus;
CREATE TRIGGER dg_guard_rental_fleet_trg BEFORE INSERT OR UPDATE OF flotta_id,data_partenza,data_ritorno,acconto,stato_noleggio ON public.noleggi_bus
 FOR EACH ROW EXECUTE FUNCTION public.dg_guard_rental_fleet();
CREATE OR REPLACE FUNCTION public.dg_guard_fleet_block() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 PERFORM public.dg_assert_fleet_free(NEW.flotta_id,NEW.data_inizio,NEW.data_fine,NULL,NULL);
 RETURN NEW; END $$;
DROP TRIGGER IF EXISTS dg_guard_fleet_block_trg ON public.dg_blocchi_flotta;
CREATE TRIGGER dg_guard_fleet_block_trg BEFORE INSERT OR UPDATE ON public.dg_blocchi_flotta
 FOR EACH ROW EXECUTE FUNCTION public.dg_guard_fleet_block();
ALTER TABLE public.dg_blocchi_flotta ENABLE ROW LEVEL SECURITY;
-- NON aggiungere policy permissive indiscriminate: predisporre policy coerenti con i ruoli Auth già configurati.
