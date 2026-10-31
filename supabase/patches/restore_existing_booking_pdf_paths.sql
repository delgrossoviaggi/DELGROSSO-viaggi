-- DELGROSSO: non-invasive reconciliation of already archived booking PDF paths.
-- Only link an existing application/pdf object to its unique matching confirmation code.
-- No PDF creation, email sending, seat changes or payment changes.
with candidates as (
 select o.name, o.created_at as stored_at, p.id as booking_id,
        count(*) over(partition by o.name) as file_matches,
        count(*) over(partition by p.id) as booking_matches
 from storage.objects o
 join public.prenotazioni p
   on upper(coalesce(p.confirmation_number,p.id_prenotazione,p.codice,'')) =
      upper(regexp_replace(split_part(o.name,'/',2),'[.]pdf$','','i'))
 where o.bucket_id='ricevute-prenotazioni'
   and o.name like 'conferme/%.pdf'
   and coalesce(o.metadata->>'mimetype','')='application/pdf'
   and coalesce((o.metadata->>'size')::bigint,0)>=1000
   and p.confirmation_storage_path is null
), unique_docs as (
 select * from candidates where file_matches=1 and booking_matches=1
), recovered as (
 update public.prenotazioni p
 set confirmation_storage_path=d.name,
     confirmation_generated_at=coalesce(p.confirmation_generated_at,d.stored_at)
 from unique_docs d
 where p.id=d.booking_id and p.confirmation_storage_path is null
 returning p.id
)
select count(*) as pdf_links_restored from recovered;