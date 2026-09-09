alter table public.viaggi add column if not exists id_viaggio text;
update public.viaggi set id_viaggio='DG-V-'||upper(substr(replace(id::text,'-',''),1,8)) where id_viaggio is null or btrim(id_viaggio)='';
create unique index if not exists viaggi_id_viaggio_uidx on public.viaggi(id_viaggio);
create or replace function public.sync_viaggio_identifier() returns trigger language plpgsql security definer set search_path=public as $$ begin if new.id_viaggio is null or btrim(new.id_viaggio)='' then new.id_viaggio:='DG-V-'||upper(substr(replace(new.id::text,'-',''),1,8)); end if; return new; end; $$;
drop trigger if exists trg_sync_viaggio_identifier on public.viaggi;
create trigger trg_sync_viaggio_identifier before insert or update on public.viaggi for each row execute function public.sync_viaggio_identifier();
