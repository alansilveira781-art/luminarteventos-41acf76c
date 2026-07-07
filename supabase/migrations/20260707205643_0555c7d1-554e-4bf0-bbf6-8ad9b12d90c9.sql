
DROP POLICY IF EXISTS "rotina anexos read" ON storage.objects;
DROP POLICY IF EXISTS "rotina anexos write" ON storage.objects;
DROP POLICY IF EXISTS "rotina anexos update" ON storage.objects;
DROP POLICY IF EXISTS "rotina anexos delete" ON storage.objects;

CREATE POLICY "rotina anexos read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'rotina-anexos' AND public.has_module_access(auth.uid(), 'financeiro'));

CREATE POLICY "rotina anexos write"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'rotina-anexos' AND public.has_module_access(auth.uid(), 'financeiro'));

CREATE POLICY "rotina anexos update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'rotina-anexos' AND public.has_module_access(auth.uid(), 'financeiro'))
WITH CHECK (bucket_id = 'rotina-anexos' AND public.has_module_access(auth.uid(), 'financeiro'));

CREATE POLICY "rotina anexos delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'rotina-anexos' AND public.has_module_access(auth.uid(), 'financeiro'));
