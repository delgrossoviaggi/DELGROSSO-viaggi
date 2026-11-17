-- DELGROSSO 4.0 · BUS BIS POSTI MANUALI
-- DRAFT FOR ISOLATED RESTORE / STAGING ONLY.
-- DO NOT APPLY DIRECTLY IN PRODUCTION before backup, storage export,
-- isolated restore and real booking + layout + cancellation tests.
--
-- Invariant: viaggi.posti_totali = PHYSICAL bus capacity; the set of seats
-- available for purchase is explicitly marked available in dg28_trip_layouts.
-- All other physical seats remain blocked; a DB trigger enforces that limit
-- for every online booking path (not only the browser).
BEGIN;

-- Fail-closed enforcement of manual-BIS restrictions for booking INSERT,
-- move or changed seat assignments. Does not alter historic records.
CREATE OR REPLACE FUNCTION dg_private.dg4_enforce_manual_bis_seats_v1()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
  cfg jsonb;
  place text;
BEGIN
  IF NEW.viaggio_id IS NULL OR
     coalesce(NEW.stato,'') ~* 'annull|cancel|cancell' THEN
    RETURN NEW;
  END IF;
  SELECT l.configurazione INTO cfg
  FROM public.dg28_trip_layouts l
  WHERE l.viaggio_id=NEW.viaggio_id
    AND l.configurazione->>'dg4_manual_bis'='true';
  IF cfg IS NULL THEN RETURN NEW; END IF;
  FOR place IN SELECT trim(p) FROM pg_catalog.regexp_split_to_table(
    coalesce(NEW.posti_selezionati,''), '[,;[:space:]]+') AS p
  LOOP
    IF place='' THEN CONTINUE; END IF;
    IF place !~ '^[1-9][0-9]{0,2}$' OR NOT EXISTS(
      SELECT 1
      FROM pg_catalog.jsonb_array_elements(cfg->'rows') rw,
           pg_catalog.jsonb_array_elements(rw.value->'cells') c
      WHERE c.value->>'type'='seat'
        AND c.value->>'id'=place
        AND c.value->>'status'='available'
    ) THEN
      RAISE EXCEPTION 'POSTO_BIS_NON_APERTO: %', place USING ERRCODE='23514';
    END IF;
  END LOOP;
  RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION dg_private.dg4_enforce_manual_bis_seats_v1() FROM PUBLIC;

DROP TRIGGER IF EXISTS dg4_enforce_manual_bis_seats_v1 ON public.prenotazioni;
CREATE TRIGGER dg4_enforce_manual_bis_seats_v1
BEFORE INSERT OR UPDATE OF viaggio_id,posti_selezionati,stato ON public.prenotazioni
FOR EACH ROW EXECUTE FUNCTION dg_private.dg4_enforce_manual_bis_seats_v1();

-- A single atomic operation: open hidden BIS, publish manual layout,
-- then optionally expose the chosen seats on the public website.
CREATE OR REPLACE FUNCTION public.dg4_open_trip_bis_manual_v1(
  p_source_trip_id uuid,
  p_bus_id uuid,
  p_layout_id uuid,
  p_bookable_seats integer[],
  p_publish boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path TO ''
AS $fn$
DECLARE
  v_src public.viaggi%rowtype;
  v_bus public.flotta%rowtype;
  v_tpl public.dg2_layout_library%rowtype;
  v_result jsonb;
  v_apply jsonb;
  v_bis_id uuid;
  v_rows jsonb;
  v_cfg jsonb;
  v_selected_count integer;
  v_num integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_gestionale_admin() OR
    NOT dg_private.has_permission('operazioni','write') OR
    NOT dg_private.has_permission('flotta','write')
  THEN RAISE EXCEPTION 'OPERATORE_NON_AUTORIZZATO' USING ERRCODE='42501'; END IF;

  IF p_source_trip_id IS NULL OR p_bus_id IS NULL OR p_layout_id IS NULL THEN
    RAISE EXCEPTION 'VIAGGIO_BUS_PIANTINA_OBBLIGATORI';
  END IF;
  SELECT * INTO v_src FROM public.viaggi
  WHERE id=p_source_trip_id FOR UPDATE;
  IF NOT FOUND OR v_src.bis_parent_id IS NOT NULL OR v_src.archiviato_at IS NOT NULL
    OR v_src.data_partenza < (now() at time zone 'Europe/Rome')::date
    OR coalesce(v_src.stato,'') ~* 'annull|cancel|rinviat'
  THEN RAISE EXCEPTION 'VIAGGIO_PRINCIPALE_NON_VALIDO'; END IF;

  SELECT * INTO v_bus FROM public.flotta
  WHERE id=p_bus_id AND attivo=true AND categoria='GT';
  IF NOT FOUND OR coalesce(v_bus.posti,0) NOT BETWEEN 1 AND 100
  THEN RAISE EXCEPTION 'AUTOBUS_GT_NON_DISPONIBILE'; END IF;

  SELECT * INTO v_tpl FROM public.dg2_layout_library
  WHERE id=p_layout_id AND attivo=true;
  IF NOT FOUND THEN RAISE EXCEPTION 'PIANTINA_NON_PUBBLICABILE'; END IF;
  PERFORM public.dg28_validate_layout_v1(v_tpl.configurazione,v_bus.posti);

  v_selected_count:=pg_catalog.cardinality(p_bookable_seats);
  IF v_selected_count IS NULL OR v_selected_count < 1
    OR v_selected_count > v_bus.posti OR
    (SELECT count(DISTINCT k) FROM pg_catalog.unnest(p_bookable_seats) k)<>v_selected_count
  THEN RAISE EXCEPTION 'SELEZIONE_POSTI_NON_VALIDA'; END IF;

  IF EXISTS(
    SELECT 1 FROM pg_catalog.unnest(p_bookable_seats) seat_id
    WHERE seat_id NOT BETWEEN 1 AND v_bus.posti
      OR NOT EXISTS(
        SELECT 1 FROM pg_catalog.jsonb_array_elements(v_tpl.configurazione->'rows') rw,
             pg_catalog.jsonb_array_elements(rw.value->'cells') c
        WHERE c.value->>'type'='seat'
          AND (c.value->>'id')::integer=seat_id
          AND coalesce(c.value->>'status','available')='available'
      )
  ) THEN RAISE EXCEPTION 'POSTO_NON_PRESENTE_O_FUORI_SERVIZIO'; END IF;

  -- Maintain the physical seat diagram and IDs. Only change the sale flag.
  SELECT pg_catalog.jsonb_agg(
    pg_catalog.jsonb_set(row_cell.value,'{cells}',
      (SELECT pg_catalog.jsonb_agg(
        CASE WHEN cell.value->>'type'='seat' THEN
          pg_catalog.jsonb_set(cell.value,'{status}',
            pg_catalog.to_jsonb(
              CASE WHEN (cell.value->>'id')::integer =
                ANY(p_bookable_seats) THEN 'available'
              WHEN cell.value->>'status'='out_of_service' THEN 'out_of_service'
              ELSE 'blocked' END
            ),true)
        ELSE cell.value END
        ORDER BY cell.ordinality)
       FROM pg_catalog.jsonb_array_elements(row_cell.value->'cells')
       WITH ORDINALITY cell(value,ordinality)),true)
    ORDER BY row_cell.ordinality)
  INTO v_rows
  FROM pg_catalog.jsonb_array_elements(v_tpl.configurazione->'rows')
  WITH ORDINALITY row_cell(value,ordinality);

  v_cfg:=pg_catalog.jsonb_set(v_tpl.configurazione,'{rows}',v_rows,true)
     || pg_catalog.jsonb_build_object(
        'dg4_manual_bis',true,
        'dg4_open_seats',v_selected_count,
        'dg4_source_layout_id',p_layout_id,
        'dg4_manual_selection',pg_catalog.to_jsonb(p_bookable_seats),
        'name',coalesce(v_tpl.configurazione->>'name',v_tpl.nome,'GT')||' · BIS manuale'
      );
  PERFORM public.dg28_validate_layout_v1(v_cfg,v_bus.posti);

  -- Existing RPC keeps all source trip fields, stop times and BUS BIS links.
  -- Any subsequent error rolls back the BUS creation and copied stops.
  v_result:=public.dg_open_trip_bis_v1(p_source_trip_id,p_bus_id,false);
  IF v_result->>'success'<>'true'
     OR v_result->>'assigned_bus_id' IS DISTINCT FROM p_bus_id::text
  THEN RAISE EXCEPTION 'BUS_BIS_NON_ASSEGNATO: %',
    coalesce(v_result->>'bus_conflict_reason','autobus non disponibile'); END IF;
  v_bis_id:=(v_result->>'trip_id')::uuid;
  IF v_bis_id IS NULL THEN RAISE EXCEPTION 'BIS_NON_CREATO'; END IF;

  PERFORM public.dg28_check_booking_integrity_v1(v_bis_id,v_cfg);
  INSERT INTO public.dg28_trip_layouts(
    viaggio_id,autobus_id,layout_id,configurazione,versione,pubblicata_da,pubblicata_il
  ) VALUES(
    v_bis_id,p_bus_id,p_layout_id,v_cfg,1,auth.uid(),now()
  );

  -- Uses the existing routine to manage public visibility and the root BUS
  -- when it is already full. Physical seat capacity is unchanged.
  v_apply:=public.dg_update_trip_bis_v1(v_bis_id,p_bus_id,coalesce(p_publish,false));
  IF v_apply->>'success'<>'true' THEN RAISE EXCEPTION 'BIS_NON_PUBBLICATO'; END IF;

  INSERT INTO public.audit_log_gestionale(
    user_id,azione,entita,entita_id,descrizione,dati
  ) VALUES (
    auth.uid(),'APRI_BIS_POSTI_MANUALI','viaggi',v_bis_id,
    'BUS BIS: numeri dei sedili aperti manualmente',
    pg_catalog.jsonb_build_object(
      'root_trip_id',v_result->>'root_trip_id',
      'bus_id',p_bus_id,'layout_id',p_layout_id,
      'physical_seats',v_bus.posti,'bookable_seats',v_selected_count,
      'chosen_ids',pg_catalog.to_jsonb(p_bookable_seats),
      'published',coalesce(p_publish,false))
  );
  RETURN pg_catalog.jsonb_build_object(
    'success',true,'trip_id',v_bis_id,
    'root_trip_id',v_result->>'root_trip_id',
    'physical_seats',v_bus.posti,'bookable_seats',v_selected_count,
    'published',v_apply->>'published','layout_id',p_layout_id
  );
END $fn$;
REVOKE ALL ON FUNCTION public.dg4_open_trip_bis_manual_v1(uuid,uuid,uuid,integer[],boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.dg4_open_trip_bis_manual_v1(uuid,uuid,uuid,integer[],boolean) TO authenticated;

-- Count physical vs. MANUALLY OPEN seats from the official seatmap and
-- booked seat numbers. Return no customer data, only public aggregate counts.
CREATE OR REPLACE FUNCTION public.dg4_public_manual_bis_availability_v1()
RETURNS TABLE(viaggio_id uuid,posti_prenotabili integer,posti_liberi integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
 WITH opened AS (
   SELECT t.id AS viaggio_id,c.value->>'id' AS seat
   FROM public.dg28_trip_layouts l
   JOIN public.viaggi t ON t.id=l.viaggio_id
   CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(l.configurazione->'rows') rw
   CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(rw.value->'cells') c
   WHERE l.configurazione->>'dg4_manual_bis'='true'
     AND t.bis_parent_id IS NOT NULL
     AND t.archiviato_at IS NULL
     AND upper(coalesce(t.pubblicato,''))='SI'
     AND t.data_partenza >= (now() at time zone 'Europe/Rome')::date
     AND c.value->>'type'='seat'
     AND c.value->>'status'='available'
 ), booked AS (
   SELECT DISTINCT p.viaggio_id,trim(s) AS seat
   FROM public.prenotazioni p
   CROSS JOIN LATERAL pg_catalog.regexp_split_to_table(
     coalesce(p.posti_selezionati,''),'[,;[:space:]]+') s
   WHERE coalesce(p.stato,'')!~*'annull|cancel|cancell'
     AND trim(s)<>''
 )
 SELECT o.viaggio_id,count(*)::integer,
   count(*) FILTER(WHERE b.seat IS NULL)::integer
 FROM opened o LEFT JOIN booked b
  ON b.viaggio_id=o.viaggio_id AND b.seat=o.seat
 GROUP BY o.viaggio_id;
$fn$;
REVOKE ALL ON FUNCTION public.dg4_public_manual_bis_availability_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dg4_public_manual_bis_availability_v1() TO anon,authenticated;

COMMIT;
