-- DG94 · Controllo di sistema del 28/11/2026 — APPLICATA il 28/11/2026 (migrazione dg94_controllo_sistema_20261128), su OK dell'utente
-- 1) Riconciliazione pagamenti → economia: aggiorna solo i movimenti che cambiano davvero
--    (prima riscriveva tutti i movimenti a ogni apertura della versione web: ~1.700 righe di storico inutili al giorno).
-- 2) Storico finanza: non registra più le modifiche "vuote" (dati identici, cambia solo updated_at).
-- 3) Posti scelti dal sito: le prenotazioni online non creavano le righe in prenotazione_posti.
--    Riparo le 27 prenotazioni attive e aggiungo un controllo a fine transazione che crea le righe mancanti.
-- 4) Regole di accesso: auth.uid() letto una volta per richiesta (consiglio Supabase), stessa logica.

create or replace function dg_private.dg_reconcile_payments_economia()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  inserted_count integer := 0;
  updated_count integer := 0;
begin
  if not public.is_gestionale_admin() then raise exception 'AUTH_REQUIRED'; end if;

  insert into public.economia_movimenti
    (tipo,categoria,descrizione,importo,data_movimento,metodo,viaggio_id,cliente_id,pagamento_id,origine,riferimento,created_by)
  select
    case when lower(coalesce(p.tipo,'Altro'))='rimborso' then 'Uscita' else 'Entrata' end,
    case when lower(coalesce(p.tipo,'Altro'))='rimborso' then 'Rimborso' else 'Incasso prenotazione' end,
    coalesce(p.cliente,'Pagamento prenotazione'), abs(coalesce(p.importo,0)),
    coalesce(p.data_pagamento,current_date), coalesce(p.metodo_pagamento,p.metodo),
    p.viaggio_id,p.cliente_id,p.id,'automatico_pagamento',p.id::text,auth.uid()
  from public.pagamenti p
  left join public.economia_movimenti e on e.pagamento_id=p.id
  where e.id is null;
  get diagnostics inserted_count = row_count;

  with src as (
    select p.id pid,
      case when lower(coalesce(p.tipo,'Altro'))='rimborso' then 'Uscita' else 'Entrata' end tipo,
      case when lower(coalesce(p.tipo,'Altro'))='rimborso' then 'Rimborso' else 'Incasso prenotazione' end categoria,
      coalesce(p.cliente,'Pagamento prenotazione') descrizione,
      abs(coalesce(p.importo,0)) importo,
      coalesce(p.data_pagamento,current_date) data_movimento,
      coalesce(p.metodo_pagamento,p.metodo) metodo,
      p.viaggio_id, p.cliente_id
    from public.pagamenti p
  )
  update public.economia_movimenti e
     set tipo=s.tipo, categoria=s.categoria, descrizione=s.descrizione, importo=s.importo,
         data_movimento=s.data_movimento, metodo=s.metodo, viaggio_id=s.viaggio_id, cliente_id=s.cliente_id,
         updated_at=now()
    from src s
   where e.pagamento_id=s.pid
     and (e.tipo,e.categoria,e.descrizione,e.importo,e.data_movimento,e.metodo,e.viaggio_id,e.cliente_id)
         is distinct from (s.tipo,s.categoria,s.descrizione,s.importo,s.data_movimento,s.metodo,s.viaggio_id,s.cliente_id);
  get diagnostics updated_count = row_count;

  return jsonb_build_object('insertiti',inserted_count,'aggiornati',updated_count);
end
$function$;

create or replace function public.dg_audit_finance_change()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare ent text; rid uuid;
begin
 if tg_op='UPDATE' and (to_jsonb(new)-'updated_at') = (to_jsonb(old)-'updated_at') then
   return new; -- modifica vuota: niente da registrare
 end if;
 ent:=tg_table_name; rid:=coalesce(new.id,old.id);
 insert into public.audit_log_gestionale(user_id,azione,entita,entita_id,descrizione,dati)
 values(auth.uid(),case when tg_op='INSERT' then 'CREA' when tg_op='UPDATE' then 'MODIFICA' else 'ELIMINA' end,ent,rid,
        case when tg_op='INSERT' then 'Creato movimento/record '||ent when tg_op='UPDATE' then 'Modificato record '||ent else 'Eliminato record '||ent end,
        jsonb_build_object('operazione',tg_op,'new',case when tg_op<>'DELETE' then to_jsonb(new) else null end,'old',case when tg_op<>'INSERT' then to_jsonb(old) else null end));
 return coalesce(new,old);
end $function$;

-- 3a) riparazione: righe posto per le prenotazioni attive che hanno i posti solo nel testo
insert into public.prenotazione_posti(prenotazione_id,viaggio_id,posto)
select b.id, b.viaggio_id, s.posto
from public.prenotazioni b
cross join lateral (select distinct btrim(x) posto from unnest(string_to_array(coalesce(b.posti_selezionati,''),',')) x where btrim(x)<>'') s
where b.viaggio_id is not null
  and lower(coalesce(b.stato,'')) !~ 'annull|cancel|rimbors'
  and not exists (select 1 from public.prenotazione_posti pp where pp.prenotazione_id=b.id)
on conflict do nothing;

-- 3b) da ora in poi: a fine transazione, se una prenotazione attiva ha posti scritti ma nessuna riga posto, le crea
create or replace function dg_private.dg94_fill_missing_seat_rows()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare b public.prenotazioni%rowtype;
begin
  select * into b from public.prenotazioni where id=new.id;
  if not found or b.viaggio_id is null
     or lower(coalesce(b.stato,'')) ~ 'annull|cancel|rimbors'
     or nullif(pg_catalog.btrim(coalesce(b.posti_selezionati,'')),'') is null
     or exists (select 1 from public.prenotazione_posti pp where pp.prenotazione_id=b.id) then
    return null;
  end if;
  insert into public.prenotazione_posti(prenotazione_id,viaggio_id,posto)
  select b.id, b.viaggio_id, s.posto
  from (select distinct pg_catalog.btrim(x) posto from pg_catalog.unnest(pg_catalog.string_to_array(b.posti_selezionati,',')) x where pg_catalog.btrim(x)<>'') s
  on conflict do nothing;
  return null;
end $function$;
revoke all on function dg_private.dg94_fill_missing_seat_rows() from public, anon, authenticated;

drop trigger if exists dg94_fill_missing_seat_rows on public.prenotazioni;
create constraint trigger dg94_fill_missing_seat_rows
  after insert or update of posti_selezionati, stato on public.prenotazioni
  deferrable initially deferred
  for each row execute function dg_private.dg94_fill_missing_seat_rows();

-- 4) regole di accesso: (select auth.uid()) al posto di auth.uid(), stessa logica
do $$
declare r record; q text; w text; s text;
begin
  for r in select schemaname, tablename, policyname, qual, with_check from pg_policies
           where schemaname='public' and policyname in ('dg2_layout_library_insert','dg2_layout_library_update','dg3_wa_manual_insert','dg3_invoice_insert','dg3_invoice_update','dg3_autisti_insert','dg3_wa_manual_update','dg3_anomalie_insert','dg3_impostazioni_insert','dg3_impostazioni_update','dg3_rettifica_cassa_insert','dg11_costi_insert','dg28_bus_insert','dg28_bus_update','dg28_trip_insert','dg28_trip_update')
  loop
    q := replace(r.qual,'auth.uid()','(select auth.uid())');
    w := replace(r.with_check,'auth.uid()','(select auth.uid())');
    s := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    if q is not null then s := s || ' using (' || q || ')'; end if;
    if w is not null then s := s || ' with check (' || w || ')'; end if;
    execute s;
  end loop;
end $$;
