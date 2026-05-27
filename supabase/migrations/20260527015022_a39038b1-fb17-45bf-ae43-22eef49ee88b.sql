
-- Fix compradores: replace permissive true policies with module access check
DROP POLICY IF EXISTS compradores_select_auth ON public.compradores;
DROP POLICY IF EXISTS compradores_insert_auth ON public.compradores;
DROP POLICY IF EXISTS compradores_update_auth ON public.compradores;
DROP POLICY IF EXISTS compradores_delete_auth ON public.compradores;

CREATE POLICY "compradores module access"
ON public.compradores
FOR ALL
TO authenticated
USING (has_module_access(auth.uid(), 'compras'::text) OR has_module_access(auth.uid(), 'estoque'::text))
WITH CHECK (has_module_access(auth.uid(), 'compras'::text) OR has_module_access(auth.uid(), 'estoque'::text));

-- Fix demanda-anexos storage UPDATE policy to enforce module access
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND cmd='UPDATE'
      AND (qual ILIKE '%demanda-anexos%' OR with_check ILIKE '%demanda-anexos%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "demanda anexos update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'demanda-anexos' AND has_module_access(auth.uid(), 'financeiro'::text))
WITH CHECK (bucket_id = 'demanda-anexos' AND has_module_access(auth.uid(), 'financeiro'::text));
