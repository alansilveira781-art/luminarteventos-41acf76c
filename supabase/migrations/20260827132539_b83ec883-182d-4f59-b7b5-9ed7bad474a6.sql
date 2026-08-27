-- Aquisições agora vivem no Quadro de Compras: liberar acesso via módulo 'compras'
DROP POLICY IF EXISTS "financeiro module access" ON public.demandas;
CREATE POLICY "aquisicoes module access" ON public.demandas
  FOR ALL TO authenticated
  USING (has_module_access(auth.uid(),'financeiro') OR has_module_access(auth.uid(),'compras'))
  WITH CHECK (has_module_access(auth.uid(),'financeiro') OR has_module_access(auth.uid(),'compras'));

DROP POLICY IF EXISTS "demanda_itens module access" ON public.demanda_itens;
CREATE POLICY "demanda_itens module access" ON public.demanda_itens
  FOR ALL TO authenticated
  USING (has_module_access(auth.uid(),'financeiro') OR has_module_access(auth.uid(),'estoque') OR has_module_access(auth.uid(),'compras'))
  WITH CHECK (has_module_access(auth.uid(),'financeiro') OR has_module_access(auth.uid(),'estoque') OR has_module_access(auth.uid(),'compras'));

DROP POLICY IF EXISTS "demanda_pagamentos module access" ON public.demanda_pagamentos;
CREATE POLICY "demanda_pagamentos module access" ON public.demanda_pagamentos
  FOR ALL TO authenticated
  USING (has_module_access(auth.uid(),'financeiro') OR has_module_access(auth.uid(),'estoque') OR has_module_access(auth.uid(),'compras'))
  WITH CHECK (has_module_access(auth.uid(),'financeiro') OR has_module_access(auth.uid(),'estoque') OR has_module_access(auth.uid(),'compras'));

DROP POLICY IF EXISTS "financeiro module access" ON public.demanda_anexos;
CREATE POLICY "aquisicoes anexos module access" ON public.demanda_anexos
  FOR ALL TO authenticated
  USING (has_module_access(auth.uid(),'financeiro') OR has_module_access(auth.uid(),'compras'))
  WITH CHECK (has_module_access(auth.uid(),'financeiro') OR has_module_access(auth.uid(),'compras'));

-- Arquivos no bucket demanda-anexos
DROP POLICY IF EXISTS "demanda anexos read" ON storage.objects;
CREATE POLICY "demanda anexos read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'demanda-anexos' AND EXISTS (
      SELECT 1 FROM public.demandas d
      WHERE d.id = public.storage_folder_uuid(objects.name)
        AND (
          is_admin(auth.uid())
          OR has_module_access(auth.uid(),'financeiro')
          OR has_module_access(auth.uid(),'compras')
          OR (has_module_access(auth.uid(),'estoque') AND d.tipo_demanda = ANY (ARRAY['fardamento','material_limpeza','material_escritorio','reposicao_estoque']))
          OR (has_module_access(auth.uid(),'patrimonio') AND d.tipo_demanda = 'imobilizado')
          OR d.created_by = auth.uid()
          OR d.solicitante_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "demanda anexos write" ON storage.objects;
CREATE POLICY "demanda anexos write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'demanda-anexos' AND EXISTS (
      SELECT 1 FROM public.demandas d
      WHERE d.id = public.storage_folder_uuid(objects.name)
        AND (
          is_admin(auth.uid())
          OR has_module_access(auth.uid(),'financeiro')
          OR has_module_access(auth.uid(),'compras')
          OR (has_module_access(auth.uid(),'estoque') AND d.tipo_demanda = ANY (ARRAY['fardamento','material_limpeza','material_escritorio','reposicao_estoque']))
          OR d.created_by = auth.uid()
          OR d.solicitante_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "demanda anexos update" ON storage.objects;
CREATE POLICY "demanda anexos update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'demanda-anexos' AND EXISTS (
      SELECT 1 FROM public.demandas d
      WHERE d.id = public.storage_folder_uuid(objects.name)
        AND (is_admin(auth.uid()) OR has_module_access(auth.uid(),'financeiro') OR has_module_access(auth.uid(),'compras') OR d.created_by = auth.uid() OR d.solicitante_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "demanda anexos delete" ON storage.objects;
CREATE POLICY "demanda anexos delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'demanda-anexos' AND EXISTS (
      SELECT 1 FROM public.demandas d
      WHERE d.id = public.storage_folder_uuid(objects.name)
        AND (is_admin(auth.uid()) OR has_module_access(auth.uid(),'financeiro') OR has_module_access(auth.uid(),'compras') OR d.created_by = auth.uid() OR d.solicitante_id = auth.uid())
    )
  );