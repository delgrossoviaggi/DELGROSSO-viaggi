-- Applied via Supabase migration guard_public_booking_capacity on 2026-10-31.
-- Keep existing bookings unchanged; prevent future overbooking by passenger count.
CREATE OR REPLACE FUNCTION dg_public_api.create_public_booking_v3(p_viaggio_id uuid, p_nome text, p_cognome text, p_telefono text, p_email text DEFAULT ''::text, p_note text DEFAULT ''::text, p_posti text[] DEFAULT '{}'::text[], p_request_id text DEFAULT ''::text, p_fermata_partenza text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_viaggio public.viaggi%rowtype; v_existing_booking public.prenotazioni%rowtype;
 v_id uuid; v_code text; v_token text; v_posti integer; v_total numeric; v_existing integer; v_occupied bigint;
 v_seats text[]; v_suffix text; v_request_id text; v_days integer := 2;
begin
 v_request_id:=nullif(trim(coalesce(p_request_id,'')),'');
 if coalesce(trim(p_nome),'')='' or coalesce(trim(p_cognome),'')='' or coalesce(trim(p_telefono),'')='' then
  return jsonb_build_object('success',false,'error','Nome, cognome e telefono sono obbligatori.');
 end if;
 if coalesce(trim(p_fermata_partenza),'')='' then
  return jsonb_build_object('success',false,'error','Indica da dove partirai.');
 end if;
 if v_request_id is not null then
  select * into v_existing_booking from public.prenotazioni where request_id=v_request_id limit 1;
  if found then return jsonb_build_object('success',true,'id',v_existing_booking.id,'numero',coalesce(v_existing_booking.codice,v_existing_booking.id_prenotazione),'token',v_existing_booking.confirmation_token,'posti',string_to_array(coalesce(v_existing_booking.posti_selezionati,''),','),'totale',v_existing_booking.totale,'scadenza_acconto',v_existing_booking.scadenza_acconto,'idempotent_replay',true); end if;
 end if;
 v_seats:=array(select distinct trim(x) from unnest(coalesce(p_posti,'{}')) x where trim(x)<>'');
 v_posti:=coalesce(array_length(v_seats,1),0);
 if v_posti<1 then return jsonb_build_object('success',false,'error','Seleziona almeno un posto.'); end if;
 perform pg_advisory_xact_lock(hashtext('public_booking:'||p_viaggio_id::text));
 select * into v_viaggio from public.viaggi where id=p_viaggio_id for update;
 if not found then return jsonb_build_object('success',false,'error','Viaggio non trovato.'); end if;
 if upper(coalesce(v_viaggio.pubblicato,''))<>'SI' then return jsonb_build_object('success',false,'error','Questo viaggio non è disponibile alla prenotazione.'); end if;
 if lower(coalesce(v_viaggio.stato,'')) ~ 'sold[[:space:]]*out|esaurit|complet|chius' then return jsonb_build_object('success',false,'error','SOLD OUT: viaggio al completo.'); end if;
 select count(*) into v_existing from public.prenotazioni p,unnest(coalesce(v_seats,'{}')) s
 where p.viaggio_id=p_viaggio_id and lower(coalesce(p.stato,'')) not in ('annullata','cancellata','cancelled')
 and (','||replace(coalesce(p.posti_selezionati,''),' ','')||',') like ('%,'||replace(s,' ','')||',%');
 if v_existing>0 then return jsonb_build_object('success',false,'error','Uno o più posti selezionati non sono più disponibili. Aggiorna la pagina e riprova.'); end if;
 -- Include all active passengers even when legacy seat numbers exceed this bus capacity.
 select coalesce(sum(greatest(coalesce(p.posti,0),coalesce(cardinality(string_to_array(p.posti_selezionati,',')),0))),0)
 into v_occupied
 from public.prenotazioni p
 where p.viaggio_id=p_viaggio_id
   and lower(coalesce(p.stato,'')) not in ('annullata','cancellata','cancelled');
 if v_occupied + v_posti > greatest(coalesce(v_viaggio.posti_totali,0),0) then
  return jsonb_build_object('success',false,'error','Posti insufficienti: verifica disponibilità e autobus assegnato prima di prenotare.');
 end if;
 v_id:=gen_random_uuid(); v_suffix:=upper(substr(replace(v_id::text,'-',''),1,8)); v_code:='DG-P-'||v_suffix;
 v_token:=md5(v_id::text||clock_timestamp()::text||random()::text); v_total:=coalesce(v_viaggio.prezzo,0)*v_posti;
 insert into public.prenotazioni(id,viaggio_id,tratta_id,cliente,cliente_nome,telefono,email,posti,totale,stato,note,posti_selezionati,codice,viaggio_codice,acconto,saldo,pagato,data_prenotazione,confirmation_number,confirmation_token,id_prenotazione,request_id,fermata_partenza,giorni_acconto,scadenza_acconto)
 values(v_id,p_viaggio_id,p_viaggio_id,trim(p_nome)||' '||trim(p_cognome),trim(p_nome)||' '||trim(p_cognome),trim(p_telefono),nullif(trim(p_email),''),v_posti,v_total,'In attesa acconto',nullif(trim(p_note),''),array_to_string(v_seats,','),v_code,v_code,0,v_total,0,current_date,v_code,v_token,v_code,v_request_id,trim(p_fermata_partenza),v_days,now()+(v_days||' days')::interval);
 return jsonb_build_object('success',true,'id',v_id,'numero',v_code,'id_prenotazione',v_code,'token',v_token,'posti',to_jsonb(v_seats),'totale',v_total,'fermata_partenza',trim(p_fermata_partenza),'giorni_acconto',v_days,'scadenza_acconto',now()+(v_days||' days')::interval,'idempotent_replay',false);
exception when unique_violation then
 return jsonb_build_object('success',false,'error','Prenotazione duplicata: contatta Nicola prima di riprovare.');
when others then return jsonb_build_object('success',false,'error','Errore durante la prenotazione: '||sqlerrm);
end $function$
;
