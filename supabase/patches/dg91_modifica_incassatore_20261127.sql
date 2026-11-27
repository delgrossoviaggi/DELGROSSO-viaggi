-- DG91 (27/11/2026) — «Modifica incassatore», riservato agli amministratori.
-- Cambia chi ha incassato un pagamento (viaggio o noleggio). Effetti:
--  * la cassa operatori (vista dg_cassa_operatori) si sposta da sola, perché si calcola da incassato_da_user_id;
--  * il movimento di economia collegato prende lo stesso operatore;
--  * la ricevuta professionale viene rigenerata alla prossima apertura (nuova versione, la vecchia resta nello storico);
--  * ogni cambio finisce in audit_log_gestionale con chi l'ha fatto, prima/dopo, importo e motivo.
-- Nessun messaggio ai clienti: il trigger delle email ignora gli aggiornamenti che non cambiano tipo/stato.

create or replace function dg_private.dg_change_payment_collector(p_kind text, p_payment_id uuid, p_user_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_kind text := case when lower(coalesce(p_kind,'trip'))='rental' then 'rental' else 'trip' end;
  v_old uuid; v_old_name text; v_new_name text; v_imp numeric; v_tipo text; v_stato text; v_data date;
begin
  if not dg_private.has_permission('admin','write') then raise exception 'SOLO_AMMINISTRATORI'; end if;
  if p_payment_id is null or p_user_id is null then raise exception 'DATI_MANCANTI'; end if;

  select coalesce(nullif(trim(o.nome),''),o.username) into v_new_name
    from public.operatori_gestionale o where o.user_id=p_user_id and o.attivo=true;
  if v_new_name is null then raise exception 'OPERATORE_NON_VALIDO'; end if;

  if v_kind='rental' then
    select x.incassato_da_user_id, x.incassato_da, x.importo, x.tipo, x.data_pagamento
      into v_old, v_old_name, v_imp, v_tipo, v_data
      from public.noleggi_bus_pagamenti x where x.id=p_payment_id for update;
    if not found then raise exception 'PAGAMENTO_NON_TROVATO'; end if;
  else
    select x.incassato_da_user_id, x.incassato_da, x.importo, x.tipo, x.stato, x.data_pagamento
      into v_old, v_old_name, v_imp, v_tipo, v_stato, v_data
      from public.pagamenti x where x.id=p_payment_id for update;
    if not found then raise exception 'PAGAMENTO_NON_TROVATO'; end if;
    if lower(coalesce(v_stato,'')) ~ '(annull|storn)' then raise exception 'PAGAMENTO_ANNULLATO'; end if;
  end if;

  v_old_name := coalesce(public.dg_operator_name(v_old), nullif(trim(v_old_name),''), 'nessuno');
  if v_old is not distinct from p_user_id then
    return jsonb_build_object('changed',false,'da',v_old_name,'a',v_new_name);
  end if;

  if v_kind='rental' then
    update public.noleggi_bus_pagamenti
       set incassato_da_user_id=p_user_id, incassato_da=v_new_name, receipt_professional_generated_at=null
     where id=p_payment_id;
    update public.economia_movimenti set operatore_user_id=p_user_id, operatore=v_new_name where noleggio_pagamento_id=p_payment_id;
  else
    update public.pagamenti
       set incassato_da_user_id=p_user_id, incassato_da=v_new_name, receipt_professional_generated_at=null
     where id=p_payment_id;
    update public.economia_movimenti set operatore_user_id=p_user_id, operatore=v_new_name where pagamento_id=p_payment_id;
  end if;

  insert into public.audit_log_gestionale(user_id,azione,entita,entita_id,descrizione,dati)
  values(auth.uid(),'modifica_incassatore',case when v_kind='rental' then 'noleggi_bus_pagamenti' else 'pagamenti' end,p_payment_id,
         'Incassatore cambiato da '||v_old_name||' a '||v_new_name,
         jsonb_build_object('da_user_id',v_old,'da',v_old_name,'a_user_id',p_user_id,'a',v_new_name,'importo',v_imp,'tipo',v_tipo,
                            'data_pagamento',v_data,'motivo',nullif(trim(coalesce(p_reason,'')),'')));

  return jsonb_build_object('changed',true,'da',v_old_name,'a',v_new_name,'importo',v_imp,'tipo',v_tipo);
end
$function$;

create or replace function public.dg_change_payment_collector(p_kind text, p_payment_id uuid, p_user_id uuid, p_reason text default null)
returns jsonb
language plpgsql
set search_path to ''
as $function$
begin
  if not dg_private.has_permission('admin','write') then raise exception 'SOLO_AMMINISTRATORI'; end if;
  return dg_private.dg_change_payment_collector(p_kind,p_payment_id,p_user_id,p_reason);
end
$function$;

revoke all on function dg_private.dg_change_payment_collector(text,uuid,uuid,text) from public, anon;
revoke all on function public.dg_change_payment_collector(text,uuid,uuid,text) from public, anon;
grant execute on function dg_private.dg_change_payment_collector(text,uuid,uuid,text) to authenticated, service_role;
grant execute on function public.dg_change_payment_collector(text,uuid,uuid,text) to authenticated, service_role;
