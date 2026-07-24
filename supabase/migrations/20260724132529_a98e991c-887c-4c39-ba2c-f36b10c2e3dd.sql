
DROP POLICY IF EXISTS "demanda anexos read" ON storage.objects;
DROP POLICY IF EXISTS "demanda anexos write" ON storage.objects;
DROP POLICY IF EXISTS "demanda anexos update" ON storage.objects;
DROP POLICY IF EXISTS "demanda anexos delete" ON storage.objects;

CREATE POLICY "demanda anexos read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'demanda-anexos'
    AND (public.has_module_access(auth.uid(), 'financeiro')
      OR public.has_module_access(auth.uid(), 'estoque')));

CREATE POLICY "demanda anexos write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'demanda-anexos'
    AND (public.has_module_access(auth.uid(), 'financeiro')
      OR public.has_module_access(auth.uid(), 'estoque')));

CREATE POLICY "demanda anexos update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'demanda-anexos'
    AND (public.has_module_access(auth.uid(), 'financeiro')
      OR public.has_module_access(auth.uid(), 'estoque')))
  WITH CHECK (bucket_id = 'demanda-anexos'
    AND (public.has_module_access(auth.uid(), 'financeiro')
      OR public.has_module_access(auth.uid(), 'estoque')));

CREATE POLICY "demanda anexos delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'demanda-anexos'
    AND (public.has_module_access(auth.uid(), 'financeiro')
      OR public.has_module_access(auth.uid(), 'estoque')));
