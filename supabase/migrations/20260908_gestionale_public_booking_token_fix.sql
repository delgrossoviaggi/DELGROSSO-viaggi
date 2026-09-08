-- This migration belongs to the GESTIONALE Supabase project:
-- chkuayhbmitdmzmmvona
-- It fixes public booking creation on databases where gen_random_bytes() is unavailable.
-- The live migration has already been applied to the Gestionale project.

CREATE OR REPLACE FUNCTION public.create_public_booking(p_viaggio_id uuid, p_nome text, p_cognome text, p_telefono text, p_email text DEFAULT ''::text, p_note text DEFAULT ''::text, p_posti text[] DEFAULT '{}'::text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_viaggio public.viaggi%rowtype;
  v_id uuid;
  v_code text;
  v_token text;
  v_posti integer;
  v_total numeric;
  v_existing integer;
  v_seats text[];
  v_suffix text;
begin
  if coalesce(trim(p_nome),'') = '' or coalesce(trim(p_cognome),'') = '' then
    return jsonb_build_object('success',false,'error','Nome e cognome sono obbligatori.');
  end if;
  v_seats := array(select distinct trim(x) from unnest(coalesce(p_posti,'{}')) x where trim(x) <> '');
  v_posti := coalesce(array_length(v_seats,1),0);
  if v_posti < 1 then
    return jsonb_build_object('success',false,'error','Seleziona almeno un posto.');
  end if;
  perform pg_advisory_xact_lock(hashtext('public_booking:' || p_viaggio_id::text));
  select * into v_viaggio from public.viaggi where id = p_viaggio_id for update;
  if not found then return jsonb_build_object('success',false,'error','Viaggio non trovato.'); end if;
  if upper(coalesce(v_viaggio.pubblicato,'')) <> 'SI' then return jsonb_build_object('success',false,'error','Questo viaggio non è disponibile alla prenotazione.'); end if;
  select count(*) into v_existing
  from public.prenotazioni p, unnest(coalesce(v_seats,'{}')) s
  where p.viaggio_id = p_viaggio_id
    and lower(coalesce(p.stato,'')) not in ('annullata','cancellata','cancelled')
    and (',' || replace(coalesce(p.posti_selezionati,''),' ','') || ',') like ('%,' || replace(s,' ','') || ',%');
  if v_existing > 0 then return jsonb_build_object('success',false,'error','Uno o più posti selezionati non sono più disponibili. Aggiorna la pagina e riprova.'); end if;
  if v_viaggio.posti_liberi is not null and v_viaggio.posti_liberi < v_posti then return jsonb_build_object('success',false,'error','Non ci sono abbastanza posti disponibili.'); end if;
  v_id := gen_random_uuid();
  v_suffix := upper(substr(replace(v_id::text,'-',''),1,8));
  v_code := 'DG-P-' || v_suffix;
  v_token := md5(v_id::text || clock_timestamp()::text || random()::text);
  v_total := coalesce(v_viaggio.prezzo,0) * v_posti;
  insert into public.prenotazioni (id,viaggio_id,tratta_id,cliente,cliente_nome,telefono,email,posti,totale,stato,note,posti_selezionati,codice,viaggio_codice,acconto,saldo,pagato,data_prenotazione,confirmation_number,confirmation_token,id_prenotazione)
  values (v_id,p_viaggio_id,p_viaggio_id,trim(p_nome)||' '||trim(p_cognome),trim(p_nome)||' '||trim(p_cognome),nullif(trim(p_telefono),''),nullif(trim(p_email),''),v_posti,v_total,'Confermata',nullif(trim(p_note),''),array_to_string(v_seats,','),v_code,v_code,0,v_total,0,current_date,v_code,v_token,v_code);
  update public.viaggi
  set posti_occupati=coalesce(posti_occupati,0)+v_posti,
      posti_liberi=case when posti_totali is null then posti_liberi else greatest(0,posti_totali-(coalesce(posti_occupati,0)+v_posti)) end,
      updated_at=now()
  where id=p_viaggio_id;
  return jsonb_build_object('success',true,'id',v_id,'numero',v_code,'id_prenotazione',v_code,'token',v_token,'posti',to_jsonb(v_seats),'totale',v_total);
exception when others then
  return jsonb_build_object('success',false,'error','Errore durante la prenotazione: ' || sqlerrm);
end;
$function$;
GRANT EXECUTE ON FUNCTION public.create_public_booking(uuid,text,text,text,text,text,text[]) TO anon, authenticated;
