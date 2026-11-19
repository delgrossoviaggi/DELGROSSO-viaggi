-- DG82 - INSTALLAZIONE CONTROLLATA, NON ESEGUITA SU SUPABASE
-- Eseguire SOLO dopo backup e verifica reale delle colonne, dei trigger e del flusso di prenotazione del SITO.
-- Non modifica le prenotazioni precedenti all'attivazione; non elimina dati storici.
BEGIN;
CREATE TABLE IF NOT EXISTS public.dg82_booking_holds (
 booking_id uuid PRIMARY KEY REFERENCES public.prenotazioni(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','grace','confirmed','released','manual_review')),
 created_at timestamptz NOT NULL DEFAULT now(),
 remind_at timestamptz NOT NULL DEFAULT (now()+interval '48 hours'),
 expires_at timestamptz NOT NULL DEFAULT (now()+interval '72 hours'),
 confirmed_at timestamptz,
 released_at timestamptz,
 reminder_queued_at timestamptz,
 release_message_queued_at timestamptz,
 last_error text
);
CREATE TABLE IF NOT EXISTS public.dg82_outbox (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 booking_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('initial','reminder','release','confirmed')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','sent','failed','skipped')),
 created_at timestamptz NOT NULL DEFAULT now(),
 sent_at timestamptz,
 last_error text,
 UNIQUE(booking_id,kind)
);
CREATE INDEX IF NOT EXISTS dg82_due_idx ON public.dg82_booking_holds(status,remind_at,expires_at);
ALTER TABLE public.dg82_booking_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dg82_outbox ENABLE ROW LEVEL SECURITY;
-- Permessi di sola lettura per operatori autenticati SOLO se già autorizzati a vedere le prenotazioni.
-- NON accordare privilegi al ruolo anon. Verificare prima le politiche esistenti.
-- REVOKE ALL ON public.dg82_booking_holds FROM anon,authenticated;
-- REVOKE ALL ON public.dg82_outbox FROM anon,authenticated;
-- Per visualizzare il pannello, configurare una policy SELECT con ruolo gestionale verificato lato server.
-- NON usare TO authenticated senza condizione di autorizzazione.

CREATE OR REPLACE FUNCTION public.dg82_sync_booking_hold() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE prior public.dg82_booking_holds%ROWTYPE; is_paid boolean;
BEGIN
  IF NEW.riserva_aziendale IS TRUE THEN RETURN NEW; END IF;
  SELECT * INTO prior FROM public.dg82_booking_holds WHERE booking_id=NEW.id;
  is_paid := greatest(coalesce(NEW.pagato,0),coalesce(NEW.acconto,0))>0 OR EXISTS (
   SELECT 1 FROM public.pagamenti p WHERE p.prenotazione_id=NEW.id
   GROUP BY p.prenotazione_id HAVING sum(CASE WHEN lower(coalesce(p.tipo,'')) LIKE '%rimborso%'
       THEN -abs(coalesce(p.importo,p.pagato,0)) ELSE abs(coalesce(p.importo,p.pagato,0)) END)>0);
  IF NEW.stato ~* 'annull|cancel|eliminat|rimbors' THEN
    IF FOUND THEN UPDATE public.dg82_booking_holds SET status='manual_review',last_error='Annullamento esterno: verificare rimborsi' WHERE booking_id=NEW.id AND status<>'released'; END IF;
    RETURN NEW;
  END IF;
  IF NOT FOUND THEN
    -- Evita la creazione retroattiva di scadenze su prenotazioni storiche: attivazione con data di installazione.
    -- Per attivare sul sito: impostare in DG82 almeno il momento della distribuzione.
    RETURN NEW;
  END IF;
  IF is_paid AND prior.status IN ('pending','grace') THEN
    UPDATE public.dg82_booking_holds SET status='confirmed',confirmed_at=now() WHERE booking_id=NEW.id;
    INSERT INTO public.dg82_outbox(booking_id,kind) VALUES(NEW.id,'confirmed') ON CONFLICT DO NOTHING;
  ELSIF NOT is_paid AND prior.status='confirmed' THEN
    UPDATE public.dg82_booking_holds SET status='manual_review',last_error='Acconto rimosso o rettificato: verifica manuale' WHERE booking_id=NEW.id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS dg82_booking_sync ON public.prenotazioni;
CREATE TRIGGER dg82_booking_sync AFTER UPDATE OF pagato,acconto,stato ON public.prenotazioni FOR EACH ROW EXECUTE FUNCTION public.dg82_sync_booking_hold();

-- Il sito deve chiamare questa RPC con un booking_id creato dalla RPC atomica di prenotazione,
-- NON dal browser anonimo. Integrazione obbligatoria con il sito (non incluso nello ZIP).
-- Per mantenere la sicurezza il bootstrap viene eseguito da un backend trusted, con INSERT sui soli nuovi booking.
-- Esempio transazionale server: INSERT INTO dg82_booking_holds(booking_id) VALUES(:new_id);
-- INSERT INTO dg82_outbox(booking_id,kind) VALUES(:new_id,'initial');

-- Questo processo è disponibile ma NON schedulato: attivarlo dopo collaudo e integrazione WhatsApp.
-- DG83 GUARDRAIL: programma solo il promemoria e segnala una scadenza.
-- NON cancella prenotazioni e NON elimina posti finché non esiste una procedura
-- transazionale certificata con controlli sui pagamenti, sul sito e sulle notifiche.
CREATE OR REPLACE FUNCTION public.dg82_process_due() RETURNS TABLE(reminders integer,releases integer)
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE rr integer := 0; r record;
BEGIN
 FOR r IN SELECT h.booking_id FROM public.dg82_booking_holds h
          JOIN public.prenotazioni b ON b.id=h.booking_id
          WHERE h.status='pending' AND h.remind_at<=now()
          AND coalesce(b.pagato,0)<=0 AND coalesce(b.acconto,0)<=0
          AND NOT EXISTS (
           SELECT 1 FROM public.pagamenti p WHERE p.prenotazione_id=h.booking_id
           GROUP BY p.prenotazione_id
           HAVING sum(CASE WHEN lower(coalesce(p.tipo,'')) LIKE '%rimborso%'
                           THEN -abs(coalesce(p.importo,p.pagato,0))
                           ELSE abs(coalesce(p.importo,p.pagato,0)) END)>0)
          FOR UPDATE OF h SKIP LOCKED
 LOOP
  UPDATE public.dg82_booking_holds SET status='grace',reminder_queued_at=now() WHERE booking_id=r.booking_id;
  INSERT INTO public.dg82_outbox(booking_id,kind) VALUES(r.booking_id,'reminder') ON CONFLICT DO NOTHING;
  rr:=rr+1;
 END LOOP;
 -- A 72 ore, se manca il pagamento, richiedi revisione: MAI liberare in automatico
 -- prima di verificare l'invio riuscito del reminder e sincronizzazione con sito.
 UPDATE public.dg82_booking_holds h SET status='manual_review',
  last_error='72 ore: controllo incassi/WhatsApp/sito obbligatorio prima di liberare posti'
 FROM public.prenotazioni b WHERE b.id=h.booking_id AND h.status IN ('pending','grace')
  AND h.expires_at<=now() AND coalesce(b.pagato,0)<=0 AND coalesce(b.acconto,0)<=0
  AND NOT EXISTS (
   SELECT 1 FROM public.pagamenti p WHERE p.prenotazione_id=h.booking_id
   GROUP BY p.prenotazione_id
   HAVING sum(CASE WHEN lower(coalesce(p.tipo,'')) LIKE '%rimborso%'
                   THEN -abs(coalesce(p.importo,p.pagato,0))
                   ELSE abs(coalesce(p.importo,p.pagato,0)) END)>0);
 RETURN QUERY SELECT rr,0;
END $$;
REVOKE ALL ON FUNCTION public.dg82_process_due() FROM PUBLIC,anon,authenticated;
COMMIT;
-- NON ESEGUIRE IN PRODUZIONE SENZA TEST: SELECT * FROM public.dg82_process_due();
-- DOPO COLLAUDO: creare cron nel dashboard Supabase, ogni 5-15 minuti, con utente autorizzato.
