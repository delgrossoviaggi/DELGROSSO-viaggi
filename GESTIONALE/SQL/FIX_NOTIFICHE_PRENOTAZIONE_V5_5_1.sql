-- V5.5.1 - Fix errore notifiche_tipo_check durante prenotazione pubblica
-- La tabella notifiche accetta: INFO, SUCCESS, WARNING, ERROR.
-- Il trigger precedente tentava di inserire PRENOTAZIONE.
create or replace function public.dg_assistente_booking_event()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare vt text; msg text;
begin
 if tg_op='INSERT' then
   select titolo into vt from public.viaggi where id=new.viaggio_id;
   msg:=coalesce(new.cliente,'Cliente')||' · '||coalesce(vt,'Viaggio')||' · '||coalesce(new.posti,1)||' posti · Partenza: '||coalesce(new.fermata_partenza,'da definire')||' · Acconto entro '||coalesce(to_char(new.scadenza_acconto at time zone 'Europe/Rome','DD/MM/YYYY HH24:MI'),'2 giorni');
   insert into public.assistente_eventi(tipo,priorita,prenotazione_id,viaggio_id,titolo,messaggio,payload)
   values('NUOVA_PRENOTAZIONE','INFO',new.id,new.viaggio_id,'Nuova prenotazione',msg,jsonb_build_object('cliente',new.cliente,'telefono',new.telefono,'posti',new.posti,'sedili',new.posti_selezionati,'fermata',new.fermata_partenza,'totale',new.totale,'scadenza_acconto',new.scadenza_acconto));
   insert into public.notifiche(titolo,messaggio,tipo,letto,riferimento)
   values('Nuova prenotazione',msg,'INFO',false,new.id::text);
 elsif tg_op='UPDATE' and coalesce(old.acconto,0)<=0 and coalesce(new.acconto,0)>0 then
   insert into public.assistente_eventi(tipo,priorita,prenotazione_id,viaggio_id,titolo,messaggio,stato,payload)
   values('ACCONTO_RICEVUTO','INFO',new.id,new.viaggio_id,'Acconto ricevuto',coalesce(new.cliente,'Cliente')||' · EUR '||to_char(new.acconto,'FM999999990.00'),'RISOLTO',jsonb_build_object('acconto',new.acconto));
   update public.assistente_eventi set stato='RISOLTO',resolved_at=now() where prenotazione_id=new.id and tipo in ('ACCONTO_DA_RICEVERE','CLIENTE_CONTATTO_ACCONTO') and stato<>'RISOLTO';
 end if;
 return new;
end $function$;
