-- space-assets: bucket privado + RLS por membro do space (path: {space_id}/{file})

UPDATE storage.buckets SET public = false WHERE id = 'space-assets';

CREATE OR REPLACE FUNCTION public.storage_space_id_from_path(p_name text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_name ~ '^[0-9a-fA-F-]{36}/' THEN substring(p_name, 1, 36)::uuid
    ELSE NULL
  END;
$$;

DROP POLICY IF EXISTS "space-assets insert" ON storage.objects;
DROP POLICY IF EXISTS "space-assets select" ON storage.objects;
DROP POLICY IF EXISTS "space-assets update" ON storage.objects;
DROP POLICY IF EXISTS "space-assets delete" ON storage.objects;

DROP POLICY IF EXISTS "space_assets_select_members" ON storage.objects;
CREATE POLICY "space_assets_select_members"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'space-assets'
    AND public.can_access_space(public.storage_space_id_from_path(name), false)
  );

DROP POLICY IF EXISTS "space_assets_insert_editors" ON storage.objects;
CREATE POLICY "space_assets_insert_editors"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'space-assets'
    AND public.can_access_space(public.storage_space_id_from_path(name), true)
  );

DROP POLICY IF EXISTS "space_assets_update_editors" ON storage.objects;
CREATE POLICY "space_assets_update_editors"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'space-assets'
    AND public.can_access_space(public.storage_space_id_from_path(name), true)
  )
  WITH CHECK (
    bucket_id = 'space-assets'
    AND public.can_access_space(public.storage_space_id_from_path(name), true)
  );

DROP POLICY IF EXISTS "space_assets_delete_editors" ON storage.objects;
CREATE POLICY "space_assets_delete_editors"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'space-assets'
    AND public.can_access_space(public.storage_space_id_from_path(name), true)
  );
