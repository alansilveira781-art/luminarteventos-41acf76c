
-- 1) comercial_vendas_sync: enforce created_by = auth.uid()
DROP POLICY IF EXISTS "Comercial can insert sync log" ON public.comercial_vendas_sync;
CREATE POLICY "Comercial can insert sync log" ON public.comercial_vendas_sync
  FOR INSERT TO authenticated
  WITH CHECK (
    has_module_access(auth.uid(), 'comercial')
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Comercial can update sync log" ON public.comercial_vendas_sync;
CREATE POLICY "Comercial can update sync log" ON public.comercial_vendas_sync
  FOR UPDATE TO authenticated
  USING (
    has_module_access(auth.uid(), 'comercial')
    AND (created_by = auth.uid() OR is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'comercial'))
  )
  WITH CHECK (
    has_module_access(auth.uid(), 'comercial')
    AND created_by = auth.uid()
  );

-- 2) juridico-anexos storage policies: restrict to authenticated role
DROP POLICY IF EXISTS "juridico-anexos delete" ON storage.objects;
DROP POLICY IF EXISTS "juridico-anexos insert" ON storage.objects;
DROP POLICY IF EXISTS "juridico-anexos read" ON storage.objects;
DROP POLICY IF EXISTS "juridico-anexos update" ON storage.objects;

CREATE POLICY "juridico-anexos read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'juridico-anexos' AND has_module_access(auth.uid(), 'juridico'));

CREATE POLICY "juridico-anexos insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'juridico-anexos'
    AND has_module_access(auth.uid(), 'juridico')
    AND owner = auth.uid()
  );

CREATE POLICY "juridico-anexos update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'juridico-anexos'
    AND (owner = auth.uid() OR is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'juridico'))
  )
  WITH CHECK (
    bucket_id = 'juridico-anexos'
    AND has_module_access(auth.uid(), 'juridico')
  );

CREATE POLICY "juridico-anexos delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'juridico-anexos'
    AND (owner = auth.uid() OR is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'juridico'))
  );

-- 3) juridico_contratos: restrict UPDATE to owner or admin, add WITH CHECK
DROP POLICY IF EXISTS "juridico_contratos update" ON public.juridico_contratos;
CREATE POLICY "juridico_contratos update" ON public.juridico_contratos
  FOR UPDATE TO authenticated
  USING (
    is_admin(auth.uid())
    OR is_module_admin(auth.uid(), 'juridico')
    OR (has_module_access(auth.uid(), 'juridico') AND created_by = auth.uid())
  )
  WITH CHECK (
    is_admin(auth.uid())
    OR is_module_admin(auth.uid(), 'juridico')
    OR (has_module_access(auth.uid(), 'juridico') AND created_by = auth.uid())
  );

-- 4) op-anexos storage insert: enforce uploader identity
DROP POLICY IF EXISTS op_anexos_storage_insert ON storage.objects;
CREATE POLICY op_anexos_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'op-anexos'
    AND has_module_access(auth.uid(), 'operacao')
    AND owner = auth.uid()
  );
