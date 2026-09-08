-- DELGROSSO SITE CMS: storage is public-read but admin-write only.
-- Applied to project bhsanrbadsqcpbtxupmr.
DROP POLICY IF EXISTS site_media_storage_insert ON storage.objects;
DROP POLICY IF EXISTS site_media_storage_update ON storage.objects;
DROP POLICY IF EXISTS site_media_storage_delete ON storage.objects;
DROP POLICY IF EXISTS site_media_insert ON storage.objects;
DROP POLICY IF EXISTS site_media_update ON storage.objects;
DROP POLICY IF EXISTS site_media_delete ON storage.objects;
DROP POLICY IF EXISTS site_media_public_read ON storage.objects;
DROP POLICY IF EXISTS site_media_read ON storage.objects;
DROP POLICY IF EXISTS site_media_storage_read ON storage.objects;
DROP POLICY IF EXISTS site_media_admin_insert ON storage.objects;
DROP POLICY IF EXISTS site_media_admin_update ON storage.objects;
DROP POLICY IF EXISTS site_media_admin_delete ON storage.objects;
CREATE POLICY site_media_public_read ON storage.objects FOR SELECT TO public USING (bucket_id='site-media');
CREATE POLICY site_media_admin_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='site-media' AND public.is_site_admin());
CREATE POLICY site_media_admin_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='site-media' AND public.is_site_admin()) WITH CHECK (bucket_id='site-media' AND public.is_site_admin());
CREATE POLICY site_media_admin_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id='site-media' AND public.is_site_admin());
GRANT EXECUTE ON FUNCTION public.is_site_admin() TO authenticated;
