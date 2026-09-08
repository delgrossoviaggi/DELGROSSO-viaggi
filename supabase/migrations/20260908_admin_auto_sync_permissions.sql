-- DELGROSSO SITE CMS: Admin permissions for reliable automatic synchronization.
-- Applied to Supabase project bhsanrbadsqcpbtxupmr.
-- The frontend also performs automatic polling every 15 seconds and refreshes
-- immediately when the tab returns online/visible.

do $$ begin
  execute 'create policy "site_admin_manage_site_media_v2" on public.site_media for all to authenticated using (public.is_site_admin()) with check (public.is_site_admin())';
  exception when duplicate_object then null;
end $$;

do $$ begin
  execute 'create policy "site_admin_manage_site_fleet_v2" on public.site_fleet for all to authenticated using (public.is_site_admin()) with check (public.is_site_admin())';
  exception when duplicate_object then null;
end $$;

do $$ begin
  execute 'create policy "site_admin_manage_site_carousel_viaggi_v2" on public.site_carousel_viaggi for all to authenticated using (public.is_site_admin()) with check (public.is_site_admin())';
  exception when duplicate_object then null;
end $$;

do $$ begin
  execute 'create policy "site_admin_manage_site_party_events_v2" on public.site_party_events for all to authenticated using (public.is_site_admin()) with check (public.is_site_admin())';
  exception when duplicate_object then null;
end $$;

do $$ begin
  execute 'create policy "site_admin_manage_site_posts_v2" on public.site_posts for all to authenticated using (public.is_site_admin()) with check (public.is_site_admin())';
  exception when duplicate_object then null;
end $$;

do $$ begin
  execute 'create policy "site_admin_manage_site_settings_v2" on public.site_settings for all to authenticated using (public.is_site_admin()) with check (public.is_site_admin())';
  exception when duplicate_object then null;
end $$;

do $$ begin
  execute 'create policy "site_admin_storage_select_v2" on storage.objects for select to authenticated using (bucket_id = ''site-media'' and public.is_site_admin())';
  exception when duplicate_object then null;
end $$;

do $$ begin
  execute 'create policy "site_admin_storage_insert_v2" on storage.objects for insert to authenticated with check (bucket_id = ''site-media'' and public.is_site_admin())';
  exception when duplicate_object then null;
end $$;

do $$ begin
  execute 'create policy "site_admin_storage_update_v2" on storage.objects for update to authenticated using (bucket_id = ''site-media'' and public.is_site_admin()) with check (bucket_id = ''site-media'' and public.is_site_admin())';
  exception when duplicate_object then null;
end $$;

do $$ begin
  execute 'create policy "site_admin_storage_delete_v2" on storage.objects for delete to authenticated using (bucket_id = ''site-media'' and public.is_site_admin())';
  exception when duplicate_object then null;
end $$;
