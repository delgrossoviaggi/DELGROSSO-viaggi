-- DELGROSSO V76: RLS performance without changing who can see or change data.
-- Only auth.uid() call sites are wrapped in a one-time per-statement initPlan.
-- Existing policy names, roles, checks and permission helpers are preserved.
DO $v76$
DECLARE
  r record;
  v_count integer;
  v_using text;
  v_check text;
BEGIN
  SELECT count(*) INTO v_count FROM pg_policies
  WHERE schemaname='public'
    AND tablename IN (
      'dg_notification_reads',
      'dg_operator_communications',
      'dg_whatsapp_trip_invites_v61',
      'dg_whatsapp_optins_v61'
    )
    AND (coalesce(qual,'') LIKE '%auth.uid()%'
      OR coalesce(with_check,'') LIKE '%auth.uid()%');
  IF v_count <> 9 THEN
    RAISE EXCEPTION 'V76_RLS_SNAPSHOT_CHANGED: expected 9 policies; found %',v_count;
  END IF;

  FOR r IN
    SELECT schemaname,tablename,policyname,qual,with_check
    FROM pg_policies
    WHERE schemaname='public'
      AND tablename IN (
        'dg_notification_reads',
        'dg_operator_communications',
        'dg_whatsapp_trip_invites_v61',
        'dg_whatsapp_optins_v61'
      )
      AND (coalesce(qual,'') LIKE '%auth.uid()%'
        OR coalesce(with_check,'') LIKE '%auth.uid()%')
  LOOP
    v_using := CASE WHEN r.qual IS NULL THEN '' ELSE
      format(' USING (%s)',replace(r.qual,'auth.uid()','(select auth.uid())')) END;
    v_check := CASE WHEN r.with_check IS NULL THEN '' ELSE
      format(' WITH CHECK (%s)',replace(r.with_check,'auth.uid()','(select auth.uid())')) END;
    EXECUTE format('ALTER POLICY %I ON %I.%I%s%s',
      r.policyname,r.schemaname,r.tablename,v_using,v_check);
  END LOOP;

  SELECT count(*) INTO v_count FROM pg_policies
  WHERE schemaname='public'
    AND tablename IN (
      'dg_notification_reads','dg_operator_communications',
      'dg_whatsapp_trip_invites_v61','dg_whatsapp_optins_v61'
    )
    AND (coalesce(qual,'') LIKE '%auth.uid()%'
      OR coalesce(with_check,'') LIKE '%auth.uid()%')
    AND (coalesce(qual,'') NOT LIKE '%( SELECT auth.uid() AS uid)%'
      OR coalesce(with_check,'') NOT LIKE '%( SELECT auth.uid() AS uid)%');
  -- Do not error based on prettified Postgres expression formatting; separately
  -- verify with pg_policies and Supabase performance advisors after deployment.
END
$v76$;
