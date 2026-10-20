-- DELGROSSO VIAGGI · CASSA PROGRESSIVA V2
-- Migration additiva: nuove RPC, nessuna modifica a chiusure storiche né a dati economici.
-- Valori: solo contante realmente attribuito all'operatore, un solo conteggio per fonte.
-- I movimenti in economia creati automaticamente da pagamenti o noleggi vengono esclusi.

CREATE OR REPLACE FUNCTION public.dg_cash_preview_v2(p_date date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_today date := (now() AT TIME ZONE 'Europe/Rome')::date;
  v_day date := coalesce(p_date, (now() AT TIME ZONE 'Europe/Rome')::date);
  v_op text;
  v_previous public.cassa_chiusure%ROWTYPE;
  v_current public.cassa_chiusure%ROWTYPE;
  v_has_previous boolean := false;
  v_has_current boolean := false;
  v_opening numeric := 0;
  v_trip_in numeric := 0;
  v_trip_out numeric := 0;
  v_rental_in numeric := 0;
  v_rental_out numeric := 0;
  v_manual_in numeric := 0;
  v_manual_out numeric := 0;
  v_transfer_in numeric := 0;
  v_transfer_out numeric := 0;
  v_total numeric := 0;
  v_count integer := 0;
BEGIN
  IF v_uid IS NULL OR NOT dg_private.has_permission('cassa','read') THEN
    RAISE EXCEPTION 'Accesso al riepilogo cassa non autorizzato';
  END IF;
  -- Non simuliamo o riapriamo chiusure storiche con movimenti successivi.
  IF v_day <> v_today THEN
    RAISE EXCEPTION 'La cassa progressiva e calcolabile soltanto per la data corrente';
  END IF;
  SELECT nome INTO v_op FROM public.operatori_gestionale WHERE user_id=v_uid AND attivo=true;
  IF v_op IS NULL THEN RAISE EXCEPTION 'Operatore non attivo'; END IF;
  SELECT * INTO v_previous FROM public.cassa_chiusure
   WHERE operatore_user_id=v_uid AND data_chiusura < v_day
   ORDER BY data_chiusura DESC, created_at DESC LIMIT 1;
  v_has_previous := FOUND;
  IF v_has_previous THEN v_opening := coalesce(v_previous.contanti_contati,0); END IF;

  SELECT * INTO v_current FROM public.cassa_chiusure
   WHERE operatore_user_id=v_uid AND data_chiusura=v_day LIMIT 1;
  v_has_current := FOUND;

  SELECT
    coalesce(sum(CASE WHEN lower(coalesce(tipo,'')) <> 'rimborso' THEN abs(importo) ELSE 0 END),0),
    coalesce(sum(CASE WHEN lower(coalesce(tipo,'')) = 'rimborso' THEN abs(importo) ELSE 0 END),0),
    count(*)
  INTO v_trip_in,v_trip_out,v_count
  FROM public.pagamenti
  WHERE incassato_da_user_id=v_uid
    AND lower(coalesce(nullif(trim(metodo),''),metodo_pagamento,'')) LIKE '%contant%'
    AND (NOT v_has_previous OR created_at > v_previous.created_at)
    AND created_at <= now()
    AND lower(coalesce(stato,'')) NOT IN ('annullato','annullata','bozza');

  SELECT
    coalesce(sum(CASE WHEN lower(coalesce(tipo,'')) <> 'rimborso' THEN abs(importo) ELSE 0 END),0),
    coalesce(sum(CASE WHEN lower(coalesce(tipo,'')) = 'rimborso' THEN abs(importo) ELSE 0 END),0)
  INTO v_rental_in,v_rental_out
  FROM public.noleggi_bus_pagamenti
  WHERE incassato_da_user_id=v_uid
    AND lower(coalesce(metodo,'')) LIKE '%contant%'
    AND (NOT v_has_previous OR created_at > v_previous.created_at)
    AND created_at <= now();

  SELECT
    coalesce(sum(CASE WHEN lower(coalesce(tipo,''))='entrata' THEN abs(importo) ELSE 0 END),0),
    coalesce(sum(CASE WHEN lower(coalesce(tipo,''))='uscita' THEN abs(importo) ELSE 0 END),0)
  INTO v_manual_in,v_manual_out
  FROM public.economia_movimenti
  WHERE operatore_user_id=v_uid
    AND lower(coalesce(metodo,'')) LIKE '%contant%'
    AND pagamento_id IS NULL AND noleggio_pagamento_id IS NULL
    AND (NOT v_has_previous OR created_at > v_previous.created_at)
    AND created_at <= now()
    AND lower(coalesce(origine,'')) NOT LIKE 'automatico%'
    AND lower(coalesce(origine,'')) NOT LIKE 'migrazione_pagamenti%';

  SELECT
    coalesce(sum(CASE WHEN a_operatore_user_id=v_uid THEN abs(importo) ELSE 0 END),0),
    coalesce(sum(CASE WHEN da_operatore_user_id=v_uid THEN abs(importo) ELSE 0 END),0)
  INTO v_transfer_in,v_transfer_out
  FROM public.cassa_trasferimenti
  WHERE stato='Confermato'
    AND (a_operatore_user_id=v_uid OR da_operatore_user_id=v_uid)
    AND (NOT v_has_previous OR created_at > v_previous.created_at)
    AND created_at <= now();

  v_total := round(v_opening+v_trip_in+v_rental_in+v_manual_in+v_transfer_in
                    -v_trip_out-v_rental_out-v_manual_out-v_transfer_out, 2);
  RETURN jsonb_build_object(
    'success',true,'operator_id',v_uid,'operatore',v_op,'date',v_day,
    'previous_date',CASE WHEN v_has_previous THEN v_previous.data_chiusura ELSE NULL END,
    'previous_closed_at',CASE WHEN v_has_previous THEN v_previous.created_at ELSE NULL END,
    'saldo_iniziale',round(v_opening,2),
    'incassi_viaggi',round(v_trip_in,2),'rimborsi_viaggi',round(v_trip_out,2),
    'incassi_noleggi',round(v_rental_in,2),'rimborsi_noleggi',round(v_rental_out,2),
    'entrate_manual',round(v_manual_in,2),'uscite_manual',round(v_manual_out,2),
    'trasferimenti_entrata',round(v_transfer_in,2),'trasferimenti_uscita',round(v_transfer_out,2),
    'delta',round(v_total-v_opening,2),'saldo_teorico',v_total,
    'today_closed',v_has_current,
    'today_counted',CASE WHEN v_has_current THEN v_current.contanti_contati ELSE NULL END,
    'today_difference',CASE WHEN v_has_current THEN v_current.differenza ELSE NULL END,
    'today_note',CASE WHEN v_has_current THEN v_current.note ELSE NULL END,
    'cash_payments_count',v_count,
    'model','cassa_progressiva_v2'
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.dg_close_cash_day_v2(
  p_counted numeric,
  p_note text DEFAULT NULL,
  p_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_day date := (now() AT TIME ZONE 'Europe/Rome')::date;
  v_summary jsonb;
  v_theoretical numeric;
  v_difference numeric;
  v_rid uuid;
BEGIN
  IF v_uid IS NULL OR NOT dg_private.has_permission('cassa','write') THEN
    RAISE EXCEPTION 'Chiusura cassa non autorizzata';
  END IF;
  IF coalesce(p_date,v_day) <> v_day THEN
    RAISE EXCEPTION 'Non e consentito chiudere una data passata o futura';
  END IF;
  IF p_counted IS NULL OR p_counted < 0 OR p_counted <> round(p_counted,2) THEN
    RAISE EXCEPTION 'Importo contato non valido (massimo 2 decimali)';
  END IF;
  -- Un operatore non puo effettuare due chiusure contemporanee.
  PERFORM pg_advisory_xact_lock(hashtext('dg_cash_close_v2'), hashtext(v_uid::text));
  v_summary := public.dg_cash_preview_v2(v_day);
  v_theoretical := (v_summary->>'saldo_teorico')::numeric;
  v_difference := round(p_counted-v_theoretical,2);
  IF abs(v_difference)>=0.01 AND nullif(trim(coalesce(p_note,'')),'') IS NULL THEN
    RAISE EXCEPTION 'Inserisci una nota per la differenza di cassa';
  END IF;
  INSERT INTO public.cassa_chiusure
    (data_chiusura,operatore_user_id,operatore,saldo_teorico,contanti_contati,note,created_by,updated_at)
  VALUES
    (v_day,v_uid,v_summary->>'operatore',v_theoretical,p_counted,
     nullif(trim(coalesce(p_note,'')),''),v_uid,now())
  ON CONFLICT (data_chiusura,operatore_user_id) DO UPDATE
  SET saldo_teorico=excluded.saldo_teorico,
      contanti_contati=excluded.contanti_contati,
      note=excluded.note,updated_at=now()
  RETURNING id INTO v_rid;

  INSERT INTO public.audit_log_gestionale(user_id,azione,entita,entita_id,descrizione,dati)
  VALUES(v_uid,'CHIUSURA_CASSA_PROGRESSIVA','cassa_chiusure',v_rid,
         'Chiusura progressiva: saldo precedente + movimenti del periodo',
         v_summary || jsonb_build_object('contato',p_counted,'differenza',v_difference));
  RETURN v_summary || jsonb_build_object('success',true,'id',v_rid,
    'contato',p_counted,'differenza',v_difference);
END;
$fn$;

REVOKE ALL ON FUNCTION public.dg_cash_preview_v2(date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.dg_close_cash_day_v2(numeric,text,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dg_cash_preview_v2(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dg_close_cash_day_v2(numeric,text,date) TO authenticated;
