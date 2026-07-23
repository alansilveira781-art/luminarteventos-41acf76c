
CREATE POLICY "juridico-anexos read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'juridico-anexos' AND public.has_module_access(auth.uid(), 'juridico')
  );

CREATE POLICY "juridico-anexos insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'juridico-anexos' AND public.has_module_access(auth.uid(), 'juridico')
  );

CREATE POLICY "juridico-anexos update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'juridico-anexos' AND public.has_module_access(auth.uid(), 'juridico')
  ) WITH CHECK (
    bucket_id = 'juridico-anexos' AND public.has_module_access(auth.uid(), 'juridico')
  );

CREATE POLICY "juridico-anexos delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'juridico-anexos' AND public.has_module_access(auth.uid(), 'juridico')
  );
