-- DELGROSSO Gestionale V59
-- Supabase project: chkuayhbmitdmzmmvona
-- Already applied to production during the V59 rebuild.

create or replace function public.is_gestionale_admin() returns boolean
language sql stable security definer set search_path=public as $$
  select lower(coalesce(auth.jwt()->>'email','')) in (
    'nicola@delgrossoviaggi.it',
    'raffaele@delgrossoviaggi.it'
  );
$$;

-- Operational tables use authenticated admin access only.
-- The public site keeps published-trip SELECT through viaggi_public_read_published.
