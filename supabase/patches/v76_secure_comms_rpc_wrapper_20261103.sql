-- DELGROSSO V76: keep privileged communication mutations out of public RPC.
-- Public API becomes a SECURITY INVOKER wrapper. Only an active operator with
-- explicit write permission may call the private SECURITY DEFINER implementation.
CREATE OR REPLACE FUNCTION dg_private.dg_mark_comms_manual_v76(
  p_id uuid, p_note text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid;
  v_row public.dg_comms_queue_v65%rowtype;
BEGIN
  IF NOT dg_private.has_permission('operazioni', 'write') THEN
    RAISE EXCEPTION 'Operatore non autorizzato'
      USING ERRCODE='42501';
  END IF;
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sessione non disponibile'
      USING ERRCODE='42501';
  END IF;
  IF length(coalesce(p_note,'')) > 300 THEN
    RAISE EXCEPTION 'Nota troppo lunga';
  END IF;
  UPDATE public.dg_comms_queue_v65
  SET status='handled_manual', processed_at=now(), handled_by=v_uid,
      manual_note=nullif(trim(p_note),'')
  WHERE id=p_id AND status IN ('pending','waiting_consent','failed','disabled')
  RETURNING * INTO v_row;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evento assente o già gestito';
  END IF;
  RETURN jsonb_build_object(
    'id',v_row.id,'status',v_row.status,'processed_at',v_row.processed_at
  );
END
$function$;

REVOKE ALL ON FUNCTION dg_private.dg_mark_comms_manual_v76(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION dg_private.dg_mark_comms_manual_v76(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.dg_mark_comms_manual_v66(
  p_id uuid, p_note text DEFAULT ''
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $wrapper$
  SELECT dg_private.dg_mark_comms_manual_v76(p_id,p_note)
$wrapper$;

REVOKE ALL ON FUNCTION public.dg_mark_comms_manual_v66(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dg_mark_comms_manual_v66(uuid,text) TO authenticated;
