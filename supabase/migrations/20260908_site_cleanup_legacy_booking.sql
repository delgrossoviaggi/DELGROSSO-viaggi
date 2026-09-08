-- SITE CLEANUP: booking/preventivi belong exclusively to GESTIONALE.
drop table if exists public.prenotazioni cascade;
drop table if exists public.preventivi cascade;
drop function if exists public.create_public_booking(uuid,text,text,text,text,text,text[]);
drop function if exists public.get_public_booked_seats(uuid);
drop function if exists public.get_public_booking(uuid);
