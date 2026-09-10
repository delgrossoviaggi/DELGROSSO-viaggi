-- Booking identifiers: all existing and future bookings receive a stable human-readable ID.
ALTER TABLE public.prenotazioni ADD COLUMN IF NOT EXISTS id_prenotazione text;

UPDATE public.prenotazioni
SET id_prenotazione = COALESCE(NULLIF(trim(confirmation_number), ''), NULLIF(trim(codice), ''), 'DG-P-' || upper(substr(replace(id::text,'-',''),1,8)))
WHERE id_prenotazione IS NULL OR trim(id_prenotazione) = '';

UPDATE public.prenotazioni
SET confirmation_number = id_prenotazione, codice = id_prenotazione
WHERE confirmation_number IS NULL OR trim(confirmation_number) = '' OR codice IS NULL OR trim(codice) = '';

CREATE UNIQUE INDEX IF NOT EXISTS prenotazioni_id_prenotazione_uidx ON public.prenotazioni (id_prenotazione);

CREATE OR REPLACE FUNCTION public.sync_prenotazione_identifier()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF COALESCE(NULLIF(trim(NEW.id_prenotazione),''), '') = '' THEN
    NEW.id_prenotazione := COALESCE(NULLIF(trim(NEW.confirmation_number),''), NULLIF(trim(NEW.codice),''), 'DG-P-' || upper(substr(replace(NEW.id::text,'-',''),1,8)));
  END IF;
  IF COALESCE(NULLIF(trim(NEW.confirmation_number),''), '') = '' THEN NEW.confirmation_number := NEW.id_prenotazione; END IF;
  IF COALESCE(NULLIF(trim(NEW.codice),''), '') = '' THEN NEW.codice := NEW.id_prenotazione; END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_prenotazione_identifier ON public.prenotazioni;
CREATE TRIGGER trg_sync_prenotazione_identifier
BEFORE INSERT OR UPDATE ON public.prenotazioni
FOR EACH ROW EXECUTE FUNCTION public.sync_prenotazione_identifier();
