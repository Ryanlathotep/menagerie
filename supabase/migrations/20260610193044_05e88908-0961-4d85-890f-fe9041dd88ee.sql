
-- Bug screenshots: bucket is now private. Restrict storage.objects access.
DROP POLICY IF EXISTS "bug_screenshots_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "bug_screenshots_select_own_or_admin" ON storage.objects;
DROP POLICY IF EXISTS "bug_screenshots_update_own" ON storage.objects;
DROP POLICY IF EXISTS "bug_screenshots_delete_own" ON storage.objects;

CREATE POLICY "bug_screenshots_insert_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'bug-screenshots'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "bug_screenshots_select_own_or_admin"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'bug-screenshots'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

CREATE POLICY "bug_screenshots_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'bug-screenshots'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'bug-screenshots'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "bug_screenshots_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'bug-screenshots'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);
