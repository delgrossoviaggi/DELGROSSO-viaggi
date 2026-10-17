-- DELGROSSO Gestionale V5.3
-- Evita falsi conflitti flotta durante normali modifiche/prenotazioni.
-- Se invece cambia realmente autobus/data/stato e il mezzo è occupato,
-- assegna automaticamente un mezzo compatibile libero per la data.

create or replace function public.dg_guard_trip_fleet()
returns trigger language plpgsql set search_path to 'public' as $$
declare
  v_original record;
  v_candidate uuid;
  v_need integer;
begin
  -- Una normale modifica del viaggio/prenotazione non deve rieseguire il controllo flotta.
  if tg_op='UPDATE'
     and new.autobus_id is not distinct from old.autobus_id
     and new.data_partenza is not distinct from old.data_partenza
     and new.stato is not distinct from old.stato then
    return new;
  end if;

  if new.autobus_id is null or coalesce(new.stato,'') ~* 'annull' then
    return new;
  end if;

  begin
    perform public.dg_assert_fleet_free(
      new.autobus_id,
      new.data_partenza::date,
      new.data_partenza::date,
      new.id,
      null
    );
    return new;
  exception when others then
    if sqlerrm not ilike '%Mezzo assegnato%' and sqlerrm not ilike '%Mezzo bloccato%' then
      raise;
    end if;
  end;

  select id,marca,modello,targa,posti
    into v_original
  from public.flotta
  where id=new.autobus_id;

  v_need:=greatest(coalesce(new.posti_totali,0),0);

  select f.id into v_candidate
  from public.flotta f
  where f.id<>new.autobus_id
    and coalesce(f.stato,'Disponibile') !~* 'manut|fuori|blocc|indispon'
    and coalesce(f.posti,0)>=v_need
    and (
      (coalesce(v_original.modello,'') ilike '%LIMOUSINE%' and coalesce(f.modello,'') ilike '%LIMOUSINE%')
      or
      (coalesce(v_original.marca,'') ilike '%MERCEDES%' and coalesce(f.marca,'') ilike '%MERCEDES%')
      or
      (coalesce(v_original.modello,'') not ilike '%LIMOUSINE%'
       and coalesce(v_original.marca,'') not ilike '%MERCEDES%'
       and coalesce(f.modello,'') not ilike '%LIMOUSINE%'
       and coalesce(f.marca,'') not ilike '%MERCEDES%')
    )
    and not exists (
      select 1 from public.dg_blocchi_flotta b
      where b.flotta_id=f.id
        and b.data_inizio<=new.data_partenza::date
        and b.data_fine>=new.data_partenza::date
    )
    and not exists (
      select 1 from public.viaggi v
      where v.autobus_id=f.id
        and v.id<>new.id
        and coalesce(v.stato,'') !~* 'annull'
        and v.data_partenza::date=new.data_partenza::date
    )
    and not exists (
      select 1 from public.noleggi_bus n
      where n.flotta_id=f.id
        and coalesce(n.stato_noleggio,'') !~* 'annull|completat'
        and coalesce(n.acconto,0)>0
        and n.data_partenza::date<=new.data_partenza::date
        and coalesce(n.data_ritorno,n.data_partenza)::date>=new.data_partenza::date
    )
  order by f.posti asc,f.targa asc
  limit 1;

  if v_candidate is null then
    raise exception 'Nessun mezzo compatibile libero il % per questo viaggio',
      to_char(new.data_partenza::date,'DD/MM/YYYY');
  end if;

  new.autobus_id:=v_candidate;
  select coalesce(marca,'')||' '||coalesce(modello,'')||' - '||coalesce(targa,'')
    into new.autobus
  from public.flotta
  where id=v_candidate;

  return new;
end $$;
