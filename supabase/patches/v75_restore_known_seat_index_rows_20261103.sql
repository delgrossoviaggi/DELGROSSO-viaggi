-- DELGROSSO V75: one-time repair of missing seat-index rows.
-- Reconstruct only seat numbers ALREADY documented in prenotazioni.posti_selezionati.
-- Nothing is assigned when a booking has no explicit seat list.
-- Fail atomically if counts or unique constraints differ from the audited snapshot.
DO $restore$
DECLARE v_inserted integer;
BEGIN
  -- Serialize the short reconciliation against concurrent seat and booking writes.
  LOCK TABLE public.prenotazioni IN SHARE MODE;
  LOCK TABLE public.prenotazione_posti IN SHARE ROW EXCLUSIVE MODE;

  CREATE TEMP TABLE dg_v75_seat_candidates ON COMMIT DROP AS
  WITH originals AS (
    SELECT b.id AS booking_id, b.viaggio_id, b.posti AS booked_count,
           v.posti_totali AS bus_capacity, trim(x) AS seat
    FROM public.prenotazioni b
    JOIN public.viaggi v ON v.id=b.viaggio_id
    CROSS JOIN LATERAL unnest(string_to_array(
       regexp_replace(coalesce(b.posti_selezionati,''),'[[:space:]]+','','g'),',')) x
    WHERE coalesce(b.stato,'') !~* '(annull|cancel|storn|rimbors)'
      AND b.riserva_aziendale=false
      AND nullif(trim(b.posti_selezionati),'') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.prenotazione_posti pp
        WHERE pp.prenotazione_id=b.id
      )
  ), valid_bookings AS (
    SELECT booking_id
    FROM originals
    GROUP BY booking_id
    HAVING count(*)=max(booked_count)
       AND count(distinct seat)=max(booked_count)
       AND bool_and(seat ~ '^[1-9][0-9]*$')
       AND bool_and(CASE WHEN seat ~ '^[1-9][0-9]*
  )
  SELECT o.booking_id,o.viaggio_id,o.seat
  FROM originals o
  JOIN valid_bookings v ON v.booking_id=o.booking_id;

  IF (SELECT count(distinct booking_id) FROM dg_v75_seat_candidates) <> 6
     OR (SELECT count(*) FROM dg_v75_seat_candidates) <> 26 THEN
     RAISE EXCEPTION 'V75_SEAT_SNAPSHOT_CHANGED: manual review required';
  END IF;

  -- Cross-check declared seats of OTHER bookings (even legacy bookings with
  -- no index rows), as well as the unique indexed seat table.
  IF EXISTS (
    SELECT 1
    FROM dg_v75_seat_candidates c
    JOIN public.prenotazioni other ON other.viaggio_id=c.viaggio_id
      AND other.id<>c.booking_id
      AND coalesce(other.stato,'') !~* '(annull|cancel|storn|rimbors)'
    CROSS JOIN LATERAL unnest(string_to_array(regexp_replace(
       coalesce(other.posti_selezionati,''),'[[:space:]]+','','g'),',')) x
    WHERE trim(x)=c.seat
  ) OR EXISTS (
    SELECT 1 FROM dg_v75_seat_candidates c
    JOIN public.prenotazione_posti pp
      ON pp.viaggio_id=c.viaggio_id AND pp.posto=c.seat
  ) THEN
    RAISE EXCEPTION 'V75_SEATS_CONFLICT: no changes made';
  END IF;

  INSERT INTO public.prenotazione_posti(prenotazione_id,viaggio_id,posto)
  SELECT booking_id,viaggio_id,seat FROM dg_v75_seat_candidates;
  GET DIAGNOSTICS v_inserted=ROW_COUNT;
  IF v_inserted<>26 THEN
    RAISE EXCEPTION 'V75_SEAT_INSERT_MISMATCH: %',v_inserted;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.prenotazioni b
    JOIN (SELECT DISTINCT booking_id FROM dg_v75_seat_candidates) c
      ON c.booking_id=b.id
    LEFT JOIN public.prenotazione_posti pp ON pp.prenotazione_id=b.id
    GROUP BY b.id,b.posti
    HAVING count(pp.posto)<>b.posti
  ) THEN
    RAISE EXCEPTION 'V75_SEAT_VERIFICATION_FAILED: rollback';
  END IF;

  INSERT INTO public.audit_log_gestionale(
    id,user_id,azione,entita,entita_id,descrizione,dati
  )
  SELECT gen_random_uuid(),null,'RICOSTRUZIONE_POSTI_V75','prenotazioni',
         booking_id,'Ripristino collegamenti posti già assegnati, senza spostamenti',
         jsonb_build_object('posti_ricollegati',count(*),
                            'origine','posti_selezionati già salvati')
  FROM dg_v75_seat_candidates GROUP BY booking_id;
END
$restore$;
 AND length(seat)<=3
                     THEN seat::integer<=bus_capacity
                     ELSE false END)
  )
  SELECT o.booking_id,o.viaggio_id,o.seat
  FROM originals o
  JOIN valid_bookings v ON v.booking_id=o.booking_id;

  IF (SELECT count(distinct booking_id) FROM dg_v75_seat_candidates) <> 6
     OR (SELECT count(*) FROM dg_v75_seat_candidates) <> 26 THEN
     RAISE EXCEPTION 'V75_SEAT_SNAPSHOT_CHANGED: manual review required';
  END IF;

  -- Cross-check declared seats of OTHER bookings (even legacy bookings with
  -- no index rows), as well as the unique indexed seat table.
  IF EXISTS (
    SELECT 1
    FROM dg_v75_seat_candidates c
    JOIN public.prenotazioni other ON other.viaggio_id=c.viaggio_id
      AND other.id<>c.booking_id
      AND coalesce(other.stato,'') !~* '(annull|cancel|storn|rimbors)'
    CROSS JOIN LATERAL unnest(string_to_array(regexp_replace(
       coalesce(other.posti_selezionati,''),'[[:space:]]+','','g'),',')) x
    WHERE trim(x)=c.seat
  ) OR EXISTS (
    SELECT 1 FROM dg_v75_seat_candidates c
    JOIN public.prenotazione_posti pp
      ON pp.viaggio_id=c.viaggio_id AND pp.posto=c.seat
  ) THEN
    RAISE EXCEPTION 'V75_SEATS_CONFLICT: no changes made';
  END IF;

  INSERT INTO public.prenotazione_posti(prenotazione_id,viaggio_id,posto)
  SELECT booking_id,viaggio_id,seat FROM dg_v75_seat_candidates;
  GET DIAGNOSTICS v_inserted=ROW_COUNT;
  IF v_inserted<>26 THEN
    RAISE EXCEPTION 'V75_SEAT_INSERT_MISMATCH: %',v_inserted;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.prenotazioni b
    JOIN (SELECT DISTINCT booking_id FROM dg_v75_seat_candidates) c
      ON c.booking_id=b.id
    LEFT JOIN public.prenotazione_posti pp ON pp.prenotazione_id=b.id
    GROUP BY b.id,b.posti
    HAVING count(pp.posto)<>b.posti
  ) THEN
    RAISE EXCEPTION 'V75_SEAT_VERIFICATION_FAILED: rollback';
  END IF;

  INSERT INTO public.audit_log_gestionale(
    id,user_id,azione,entita,entita_id,descrizione,dati
  )
  SELECT gen_random_uuid(),null,'RICOSTRUZIONE_POSTI_V75','prenotazioni',
         booking_id,'Ripristino collegamenti posti già assegnati, senza spostamenti',
         jsonb_build_object('posti_ricollegati',count(*),
                            'origine','posti_selezionati già salvati')
  FROM dg_v75_seat_candidates GROUP BY booking_id;
END
$restore$;
