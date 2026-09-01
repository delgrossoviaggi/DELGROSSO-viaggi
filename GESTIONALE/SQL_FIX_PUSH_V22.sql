-- DELGROSSO V22: secure push registration RPC
-- The browser no longer inserts directly into push_subscriptions.
-- The SECURITY DEFINER function performs the insert server-side.
create or replace function public.register_push_subscription(p_subscription jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_endpoint text := p_subscription->>'endpoint';
  v_p256dh text := p_subscription->>'p256dh';
  v_auth text := p_subscription->>'auth';
  v_user_name text := coalesce(nullif(p_subscription->>'user_name',''),'admin');
  v_platform text := coalesce(nullif(p_subscription->>'platform',''),'web');
  v_user_agent text := left(coalesce(p_subscription->>'user_agent',''),500);
begin
  if coalesce(length(v_endpoint),0) < 20
     or coalesce(length(v_p256dh),0) < 20
     or coalesce(length(v_auth),0) < 10 then
    raise exception using errcode='22023', message='Invalid push subscription payload';
  end if;

  -- Remove an older registration for the same endpoint, then insert the current one.
  delete from public.push_subscriptions where endpoint = v_endpoint;

  insert into public.push_subscriptions(endpoint,p256dh,auth,user_name,user_agent,platform,active,created_at,updated_at)
  values(v_endpoint,v_p256dh,v_auth,v_user_name,v_user_agent,v_platform,true,now(),now())
  returning id into v_id;

  return jsonb_build_object('success',true,'id',v_id);
end;
$$;

revoke all on function public.register_push_subscription(jsonb) from public;
grant execute on function public.register_push_subscription(jsonb) to anon, authenticated;

-- RLS remains enabled. The browser does not need INSERT privilege anymore.
revoke insert on public.push_subscriptions from anon, authenticated;

select routine_schema, routine_name
from information_schema.routines
where routine_schema='public' and routine_name='register_push_subscription';
