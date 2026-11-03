-- Applied to DELGROSSO Supabase on 2026-11-03.
-- The public.dg_delete_booking RPC continues to enforce operator permissions.
-- Never delete financial or WhatsApp outbound evidence when a booking is cancelled.
create or replace function dg_private.dg_delete_booking(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_payment_count bigint := 0;
  v_message_count bigint := 0;
  v_status text;
begin
  if not dg_private.has_permission('operazioni', 'delete') then
    raise exception 'Operazione non autorizzata';
  end if;
  if p_booking_id is null then
    raise exception 'PRENOTAZIONE_NON_TROVATA';
  end if;
  select b.stato into v_status
    from public.prenotazioni b
    where b.id = p_booking_id
    for update;
  if not found then raise exception 'PRENOTAZIONE_NON_TROVATA'; end if;

  select count(*) into v_payment_count
    from public.pagamenti p where p.prenotazione_id = p_booking_id;
  select count(*) into v_message_count
    from public.dg_whatsapp_outbound_v62 m where m.booking_id = p_booking_id;
  delete from public.prenotazione_posti where prenotazione_id = p_booking_id;

  if v_payment_count > 0 or v_message_count > 0 then
    update public.prenotazioni
       set stato = 'Annullata', posti = 0,
           posti_selezionati = null, updated_at = now()
     where id = p_booking_id;
    return jsonb_build_object(
      'mode', 'annullata', 'booking_id', p_booking_id,
      'preserved_payments', v_payment_count,
      'preserved_outbound_messages', v_message_count
    );
  end if;

  delete from public.prenotazioni where id = p_booking_id;
  if not found then raise exception 'PRENOTAZIONE_NON_TROVATA'; end if;
  return jsonb_build_object('mode','eliminata','booking_id',p_booking_id);
end
$function$;