-- DELGROSSO VIAGGI 4.0 / TRASFERIMENTO QUOTE TRA PRENOTAZIONI
-- DRAFT: migration da provare SU RIPRISTINO ISOLATO, NON SU PRODUZIONE.
-- Requires: independently verified database backup + Supabase Storage export.
-- Never insert phantom incoming cash or overwrite the original receipt.
BEGIN;

CREATE TABLE IF NOT EXISTS public.dg4_booking_credit_transfers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL UNIQUE,
 source_booking_id uuid NOT NULL REFERENCES public.prenotazioni(id) ON DELETE RESTRICT,
 target_booking_id uuid NOT NULL REFERENCES public.prenotazioni(id) ON DELETE RESTRICT,
 source_trip_id uuid NOT NULL REFERENCES public.viaggi(id) ON DELETE RESTRICT,
 target_trip_id uuid NOT NULL REFERENCES public.viaggi(id) ON DELETE RESTRICT,
 importo numeric(12,2) NOT NULL CHECK(importo>0),
 motivo text NOT NULL CHECK(length(btrim(motivo)) BETWEEN 8 AND 800),
 stato text NOT NULL DEFAULT 'Confermato' CHECK(stato='Confermato'),
 created_by uuid NOT NULL DEFAULT auth.uid(),
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT dg4_credit_distinct_bookings CHECK(source_booking_id<>target_booking_id),
 CONSTRAINT dg4_credit_distinct_trips CHECK(source_trip_id<>target_trip_id)
);
CREATE INDEX IF NOT EXISTS dg4_credit_out_idx
 ON public.dg4_booking_credit_transfers(source_booking_id,created_at);
CREATE INDEX IF NOT EXISTS dg4_credit_in_idx
 ON public.dg4_booking_credit_transfers(target_booking_id,created_at);

ALTER TABLE public.dg4_booking_credit_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dg4_credit_read ON public.dg4_booking_credit_transfers;
CREATE POLICY dg4_credit_read ON public.dg4_booking_credit_transfers
 FOR SELECT TO authenticated
 USING (auth.uid() IS NOT NULL AND public.is_gestionale_admin());
REVOKE ALL ON public.dg4_booking_credit_transfers FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.dg4_booking_credit_transfers TO authenticated;

-- A read-only reporting view; the real cash ledger pagamenti is unchanged.
-- Accounting for individual journeys uses net cash received +/- the credit
-- allocations in this ledger; Nicola/Raffaele cash stays unchanged.
CREATE OR REPLACE VIEW public.dg4_booking_credit_balances
WITH (security_invoker=true)
AS
WITH money AS (
 SELECT p.prenotazione_id,sum(p.importo)::numeric(12,2) cash_net
 FROM public.pagamenti p
 WHERE coalesce(p.stato,'')!~*'annull|cancel|cancell|storn'
 GROUP BY p.prenotazione_id
), credits AS (
 SELECT booking_id,sum(inflow)::numeric(12,2) incoming,
   sum(outflow)::numeric(12,2) outgoing
 FROM (
  SELECT target_booking_id booking_id,importo inflow,0::numeric outflow
   FROM public.dg4_booking_credit_transfers WHERE stato='Confermato'
  UNION ALL
  SELECT source_booking_id,0::numeric,importo
   FROM public.dg4_booking_credit_transfers WHERE stato='Confermato'
 ) x GROUP BY booking_id
)
SELECT b.id AS prenotazione_id,b.viaggio_id,b.cliente,b.telefono,
 b.totale,b.pagato AS pagato_registro,
 coalesce(m.cash_net,0) AS incassi_originari_netti,
 coalesce(c.incoming,0) AS quote_ricevute,
 coalesce(c.outgoing,0) AS quote_trasferite,
 (coalesce(m.cash_net,0)+coalesce(c.incoming,0)-coalesce(c.outgoing,0))::numeric(12,2)
 AS pagato_effettivo,
 greatest(coalesce(b.totale,0)-coalesce(m.cash_net,0)-coalesce(c.incoming,0)+coalesce(c.outgoing,0),0)
 AS saldo_effettivo,
 (abs(coalesce(b.pagato,0)-coalesce(m.cash_net,0))>0.01) AS incassi_da_riconciliare
FROM public.prenotazioni b
LEFT JOIN money m ON m.prenotazione_id=b.id
LEFT JOIN credits c ON c.booking_id=b.id;
REVOKE ALL ON public.dg4_booking_credit_balances FROM PUBLIC,anon;
GRANT SELECT ON public.dg4_booking_credit_balances TO authenticated;

-- All checks happen on the SERVER, under row locks. No cash movement.
CREATE OR REPLACE FUNCTION dg_private.dg4_transfer_booking_credit_v1(
 p_source_booking_id uuid,p_target_booking_id uuid,
 p_importo numeric,p_motivo text,p_request_id uuid,
 p_expected_source_credit numeric DEFAULT NULL,
 p_expected_target_credit numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
 s public.prenotazioni%rowtype;
 d public.prenotazioni%rowtype;
 origin public.viaggi%rowtype;
 destination public.viaggi%rowtype;
 earlier record;
 src_cash numeric;
 dst_cash numeric;
 src_in numeric;
 src_out numeric;
 dst_in numeric;
 dst_out numeric;
 available numeric;
 due numeric;
 amount numeric;
 source_key text;
 dest_key text;
 result_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_gestionale_admin()
  OR NOT dg_private.has_permission('cassa','write')
  OR NOT dg_private.has_permission('operazioni','write')
 THEN RAISE EXCEPTION 'OPERATORE_NON_AUTORIZZATO' USING ERRCODE='42501'; END IF;
 IF p_source_booking_id IS NULL OR p_target_booking_id IS NULL
  OR p_source_booking_id=p_target_booking_id OR p_request_id IS NULL
 THEN RAISE EXCEPTION 'GIROCONTO_IDENTIFICATORI_NON_VALIDI'; END IF;
 amount:=round(p_importo,2);
 IF amount IS NULL OR amount<=0 OR amount>1000000 OR p_importo<>amount
 THEN RAISE EXCEPTION 'IMPORTO_GIROCONTO_NON_VALIDO'; END IF;
 IF length(btrim(coalesce(p_motivo,''))) NOT BETWEEN 8 AND 800
 THEN RAISE EXCEPTION 'MOTIVAZIONE_OBBLIGATORIA'; END IF;

 -- Deterministic advisory and row locking prevents simultaneous giroconti
 -- and races with registrations/refunds (which also lock booking rows).
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(
  'credit:'||least(p_source_booking_id,p_target_booking_id)::text));
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(
  'credit:'||greatest(p_source_booking_id,p_target_booking_id)::text));
 PERFORM 1 FROM public.prenotazioni
  WHERE id IN (p_source_booking_id,p_target_booking_id)
  ORDER BY id FOR UPDATE;
 IF (SELECT count(*) FROM public.prenotazioni
  WHERE id IN (p_source_booking_id,p_target_booking_id))<>2
 THEN RAISE EXCEPTION 'PRENOTAZIONE_ORIGINE_O_DESTINAZIONE_NON_TROVATA'; END IF;

 -- Exact replay returns original result, never transfers twice.
 SELECT id INTO result_id FROM public.dg4_booking_credit_transfers
 WHERE request_id=p_request_id;
 IF FOUND THEN
  IF NOT EXISTS (
   SELECT 1 FROM public.dg4_booking_credit_transfers
   WHERE id=result_id AND source_booking_id=p_source_booking_id
    AND target_booking_id=p_target_booking_id AND importo=amount
  ) THEN RAISE EXCEPTION 'RICHIESTA_GIROCONTO_RIUTILIZZATA'; END IF;
  RETURN pg_catalog.jsonb_build_object('success',true,'transfer_id',result_id,'idempotent_replay',true);
 END IF;

 SELECT * INTO s FROM public.prenotazioni WHERE id=p_source_booking_id;
 SELECT * INTO d FROM public.prenotazioni WHERE id=p_target_booking_id;
 SELECT * INTO origin FROM public.viaggi WHERE id=s.viaggio_id;
 SELECT * INTO destination FROM public.viaggi WHERE id=d.viaggio_id;
 IF origin.id IS NULL OR destination.id IS NULL OR s.viaggio_id=d.viaggio_id THEN
  RAISE EXCEPTION 'SERVONO_DUE_PRENOTAZIONI_DI_VIAGGI_DIVERSI'; END IF;
 IF coalesce(s.riserva_aziendale,false) OR coalesce(d.riserva_aziendale,false)
  OR d.stato ~* 'annull|cancel|cancell'
  OR destination.archiviato_at IS NOT NULL
  OR destination.stato ~* 'annull|cancel|rinviat'
  OR destination.data_partenza<(now() at time zone 'Europe/Rome')::date
 THEN RAISE EXCEPTION 'PRENOTAZIONE_DESTINAZIONE_NON_ATTIVA'; END IF;
 IF NOT (coalesce(s.stato,'')~*'annull|cancel|cancell'
    OR coalesce(origin.stato,'')~*'non[[:space:]]?format|annull|cancel|rinviat|soppres')
 THEN RAISE EXCEPTION 'ANNULLARE_PRENOTAZIONE_ORIGINE_O_SEGNARE_VIAGGIO_NON_FORMATO'; END IF;

 -- Strict identity: prevent combining distinct customers who share a name.
 source_key:=pg_catalog.lower(pg_catalog.regexp_replace(
  pg_catalog.btrim(coalesce(nullif(s.cliente_nome,''),s.cliente,'')),
  '[[:space:]]+',' ','g'));
 dest_key:=pg_catalog.lower(pg_catalog.regexp_replace(
  pg_catalog.btrim(coalesce(nullif(d.cliente_nome,''),d.cliente,'')),
  '[[:space:]]+',' ','g'));
 IF source_key<>dest_key
  OR pg_catalog.array_length(pg_catalog.regexp_split_to_array(source_key,' '),1)<2
  OR nullif(pg_catalog.regexp_replace(coalesce(s.telefono,''),'[^0-9]','','g'),'') IS NULL
  OR nullif(pg_catalog.regexp_replace(coalesce(d.telefono,''),'[^0-9]','','g'),'') IS NULL
  OR (
    CASE
     WHEN pg_catalog.regexp_replace(s.telefono,'[^0-9]','','g') LIKE '0039%'
       THEN pg_catalog.substr(pg_catalog.regexp_replace(s.telefono,'[^0-9]','','g'),5)
     WHEN pg_catalog.regexp_replace(s.telefono,'[^0-9]','','g') LIKE '39%'
       AND pg_catalog.length(pg_catalog.regexp_replace(s.telefono,'[^0-9]','','g'))>=12
       THEN pg_catalog.substr(pg_catalog.regexp_replace(s.telefono,'[^0-9]','','g'),3)
     ELSE pg_catalog.regexp_replace(s.telefono,'[^0-9]','','g')
    END
   ) <> (
    CASE
     WHEN pg_catalog.regexp_replace(d.telefono,'[^0-9]','','g') LIKE '0039%'
       THEN pg_catalog.substr(pg_catalog.regexp_replace(d.telefono,'[^0-9]','','g'),5)
     WHEN pg_catalog.regexp_replace(d.telefono,'[^0-9]','','g') LIKE '39%'
       AND pg_catalog.length(pg_catalog.regexp_replace(d.telefono,'[^0-9]','','g'))>=12
       THEN pg_catalog.substr(pg_catalog.regexp_replace(d.telefono,'[^0-9]','','g'),3)
     ELSE pg_catalog.regexp_replace(d.telefono,'[^0-9]','','g')
    END
   )
 THEN RAISE EXCEPTION 'CLIENTE_DIVERSO: VERIFICARE_NOME_COGNOME_E_TELEFONO'; END IF;

 SELECT coalesce(sum(importo),0) INTO src_cash FROM public.pagamenti
 WHERE prenotazione_id=s.id AND coalesce(stato,'')!~*'annull|cancel|cancell|storn';
 SELECT coalesce(sum(importo),0) INTO dst_cash FROM public.pagamenti
 WHERE prenotazione_id=d.id AND coalesce(stato,'')!~*'annull|cancel|cancell|storn';
 IF abs(coalesce(s.pagato,0)-src_cash)>0.01 OR abs(coalesce(d.pagato,0)-dst_cash)>0.01
 THEN RAISE EXCEPTION 'INCASSI_DA_RICONCILIARE_PRIMA_DEL_GIROCONTO'; END IF;

 SELECT coalesce(sum(importo),0) INTO src_in FROM public.dg4_booking_credit_transfers
 WHERE target_booking_id=s.id AND stato='Confermato';
 SELECT coalesce(sum(importo),0) INTO src_out FROM public.dg4_booking_credit_transfers
 WHERE source_booking_id=s.id AND stato='Confermato';
 SELECT coalesce(sum(importo),0) INTO dst_in FROM public.dg4_booking_credit_transfers
 WHERE target_booking_id=d.id AND stato='Confermato';
 SELECT coalesce(sum(importo),0) INTO dst_out FROM public.dg4_booking_credit_transfers
 WHERE source_booking_id=d.id AND stato='Confermato';

 available:=src_cash+src_in-src_out;
 due:=greatest(coalesce(d.totale,0)-dst_cash-dst_in+dst_out,0);
 IF available<amount OR due<amount THEN
  RAISE EXCEPTION 'CREDITO_INSUFFICIENTE_O_SALDO_DESTINAZIONE_INFERIORE'; END IF;
 IF p_expected_source_credit IS NOT NULL AND
   abs(available-p_expected_source_credit)>0.01
 THEN RAISE EXCEPTION 'PRENOTAZIONE_ORIGINE_AGGIORNATA_RICALCOLA'; END IF;
 IF p_expected_target_credit IS NOT NULL AND
   abs(dst_cash+dst_in-dst_out-p_expected_target_credit)>0.01
 THEN RAISE EXCEPTION 'PRENOTAZIONE_DESTINAZIONE_AGGIORNATA_RICALCOLA'; END IF;

 INSERT INTO public.dg4_booking_credit_transfers(
  request_id,source_booking_id,target_booking_id,
  source_trip_id,target_trip_id,importo,motivo,created_by
 ) VALUES (
  p_request_id,s.id,d.id,s.viaggio_id,d.viaggio_id,amount,p_motivo,auth.uid()
 ) RETURNING id INTO result_id;
 INSERT INTO public.audit_log_gestionale(user_id,azione,entita,entita_id,descrizione,dati)
 VALUES (auth.uid(),'GIROCONTO_QUOTA_TRA_VIAGGI','prenotazioni',result_id,
  'Credito riattribuito senza incasso aggiuntivo',
  pg_catalog.jsonb_build_object('source_booking_id',s.id,'target_booking_id',d.id,
    'source_trip_id',s.viaggio_id,'target_trip_id',d.viaggio_id,
    'amount',amount,'request_id',p_request_id));
 RETURN pg_catalog.jsonb_build_object(
  'success',true,'transfer_id',result_id,'source_booking_id',s.id,
  'target_booking_id',d.id,'importo',amount,'source_credit_after',available-amount,
  'target_paid_after',dst_cash+dst_in-dst_out+amount,
  'target_due_after',due-amount,'idempotent_replay',false
 );
END $fn$;

REVOKE ALL ON FUNCTION dg_private.dg4_transfer_booking_credit_v1(
 uuid,uuid,numeric,text,uuid,numeric,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION dg_private.dg4_transfer_booking_credit_v1(
 uuid,uuid,numeric,text,uuid,numeric,numeric) TO authenticated;
CREATE OR REPLACE FUNCTION public.dg4_transfer_booking_credit_v1(
 p_source_booking_id uuid,p_target_booking_id uuid,
 p_importo numeric,p_motivo text,p_request_id uuid,
 p_expected_source_credit numeric DEFAULT NULL,
 p_expected_target_credit numeric DEFAULT NULL
)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $fn$
 SELECT dg_private.dg4_transfer_booking_credit_v1(
  p_source_booking_id,p_target_booking_id,p_importo,p_motivo,p_request_id,
  p_expected_source_credit,p_expected_target_credit);
$fn$;
REVOKE ALL ON FUNCTION public.dg4_transfer_booking_credit_v1(
 uuid,uuid,numeric,text,uuid,numeric,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.dg4_transfer_booking_credit_v1(
 uuid,uuid,numeric,text,uuid,numeric,numeric) TO authenticated;

-- Defense against future actual refunds or extra cash payments that would
-- spend a credit already allocated to another booking. The original payment
-- receipt and operator stay unchanged; the trigger does nothing on bookings
-- that have no giroconti.
CREATE OR REPLACE FUNCTION dg_private.dg4_guard_payment_after_credit_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
 b public.prenotazioni%rowtype;
 total_in numeric;
 total_out numeric;
 effective numeric;
 target_money numeric;
BEGIN
 IF TG_OP='DELETE' THEN
  IF EXISTS(SELECT 1 FROM public.dg4_booking_credit_transfers
   WHERE source_booking_id=OLD.prenotazione_id OR target_booking_id=OLD.prenotazione_id)
  THEN RAISE EXCEPTION 'NON_CANCELLARE_INCASSI_CON_GIROCONT0'; END IF;
  RETURN OLD;
 END IF;
 IF TG_OP='UPDATE' THEN
  IF EXISTS(SELECT 1 FROM public.dg4_booking_credit_transfers
   WHERE source_booking_id=OLD.prenotazione_id OR target_booking_id=OLD.prenotazione_id)
   AND (OLD.prenotazione_id,OLD.importo,OLD.tipo,OLD.stato,OLD.viaggio_id)
       IS DISTINCT FROM
       (NEW.prenotazione_id,NEW.importo,NEW.tipo,NEW.stato,NEW.viaggio_id)
  THEN RAISE EXCEPTION 'MOVIMENTO_ORIGINALE_IMMUTABILE_DOPO_GIROCONTO'; END IF;
  RETURN NEW;
 END IF;
 IF NEW.prenotazione_id IS NULL OR coalesce(NEW.stato,'')~*'annull|cancel|cancell'
 THEN RETURN NEW; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.dg4_booking_credit_transfers
   WHERE source_booking_id=NEW.prenotazione_id OR target_booking_id=NEW.prenotazione_id)
 THEN RETURN NEW; END IF;

 SELECT * INTO b FROM public.prenotazioni
 WHERE id=NEW.prenotazione_id FOR UPDATE;
 SELECT coalesce(sum(importo),0) INTO total_in FROM public.dg4_booking_credit_transfers
 WHERE target_booking_id=NEW.prenotazione_id AND stato='Confermato';
 SELECT coalesce(sum(importo),0) INTO total_out FROM public.dg4_booking_credit_transfers
 WHERE source_booking_id=NEW.prenotazione_id AND stato='Confermato';
 effective:=coalesce(b.pagato,0)+total_in-total_out;
 IF lower(coalesce(NEW.tipo,''))='rimborso' AND
   abs(NEW.importo)>effective+0.005
 THEN RAISE EXCEPTION 'RIMBORSO_SUPERIORE_AL_CREDITO_RESIDUO'; END IF;
 IF lower(coalesce(NEW.tipo,''))<>'rimborso' AND
   abs(NEW.importo)>greatest(coalesce(b.totale,0)-effective,0)+0.005
 THEN RAISE EXCEPTION 'PAGAMENTO_SUPERIORE_AL_SALDO_DOPO_GIROCONTO'; END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION dg_private.dg4_guard_payment_after_credit_v1() FROM PUBLIC;

DROP TRIGGER IF EXISTS dg4_guard_credit_payment_ins ON public.pagamenti;
CREATE TRIGGER dg4_guard_credit_payment_ins
BEFORE INSERT ON public.pagamenti FOR EACH ROW
EXECUTE FUNCTION dg_private.dg4_guard_payment_after_credit_v1();
DROP TRIGGER IF EXISTS dg4_guard_credit_payment_ud ON public.pagamenti;
CREATE TRIGGER dg4_guard_credit_payment_ud
BEFORE UPDATE OR DELETE ON public.pagamenti FOR EACH ROW
EXECUTE FUNCTION dg_private.dg4_guard_payment_after_credit_v1();

COMMIT;
