-- 1. comercial_vendas: split broad ALL policy (which implicitly granted SELECT) into write-only policies
DROP POLICY IF EXISTS "Comercial can write vendas" ON public.comercial_vendas;
CREATE POLICY "comercial_vendas_insert" ON public.comercial_vendas FOR INSERT TO authenticated
  WITH CHECK (public.has_module_access(auth.uid(), 'comercial'));
CREATE POLICY "comercial_vendas_update" ON public.comercial_vendas FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'comercial'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'comercial'));
CREATE POLICY "comercial_vendas_delete" ON public.comercial_vendas FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'comercial'));

-- 2. comercial_bonificacao_producao: align write access with admin-only read
DROP POLICY IF EXISTS "comercial_bonif_insert" ON public.comercial_bonificacao_producao;
DROP POLICY IF EXISTS "comercial_bonif_update" ON public.comercial_bonificacao_producao;
DROP POLICY IF EXISTS "comercial_bonif_delete" ON public.comercial_bonificacao_producao;
CREATE POLICY "comercial_bonif_insert" ON public.comercial_bonificacao_producao FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'comercial'));
CREATE POLICY "comercial_bonif_update" ON public.comercial_bonificacao_producao FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'comercial'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'comercial'));
CREATE POLICY "comercial_bonif_delete" ON public.comercial_bonificacao_producao FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'comercial'));

-- helper: safe uuid cast of first folder segment
CREATE OR REPLACE FUNCTION public.storage_folder_uuid(_name text)
RETURNS uuid LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE v text;
BEGIN
  v := split_part(_name, '/', 1);
  IF v ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
    RETURN v::uuid;
  END IF;
  RETURN NULL;
END; $$;

-- 3. compra-anexos storage: require ownership join to the underlying compra
DROP POLICY IF EXISTS "compra-anexos read" ON storage.objects;
DROP POLICY IF EXISTS "compra-anexos insert" ON storage.objects;
DROP POLICY IF EXISTS "compra-anexos update" ON storage.objects;
DROP POLICY IF EXISTS "compra-anexos delete" ON storage.objects;

CREATE POLICY "compra-anexos read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'compra-anexos'
  AND EXISTS (
    SELECT 1 FROM public.compras c
    WHERE c.id = public.storage_folder_uuid(name)
      AND (
        public.is_admin(auth.uid())
        OR public.has_module_access(auth.uid(), 'compras')
        OR public.has_module_access(auth.uid(), 'estoque')
        OR c.created_by = auth.uid()
        OR c.responsavel_id = auth.uid()
        OR c.solicitante_id = auth.uid()
      )
  )
);

CREATE POLICY "compra-anexos insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'compra-anexos'
  AND EXISTS (
    SELECT 1 FROM public.compras c
    WHERE c.id = public.storage_folder_uuid(name)
      AND (
        public.is_admin(auth.uid())
        OR public.is_module_admin(auth.uid(), 'compras')
        OR public.is_module_admin(auth.uid(), 'estoque')
        OR c.created_by = auth.uid()
        OR c.responsavel_id = auth.uid()
        OR c.solicitante_id = auth.uid()
      )
  )
);

CREATE POLICY "compra-anexos update" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'compra-anexos'
  AND EXISTS (
    SELECT 1 FROM public.compras c
    WHERE c.id = public.storage_folder_uuid(name)
      AND (
        public.is_admin(auth.uid())
        OR public.is_module_admin(auth.uid(), 'compras')
        OR public.is_module_admin(auth.uid(), 'estoque')
        OR c.created_by = auth.uid()
        OR c.responsavel_id = auth.uid()
      )
  )
);

CREATE POLICY "compra-anexos delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'compra-anexos'
  AND EXISTS (
    SELECT 1 FROM public.compras c
    WHERE c.id = public.storage_folder_uuid(name)
      AND (
        public.is_admin(auth.uid())
        OR public.is_module_admin(auth.uid(), 'compras')
        OR public.is_module_admin(auth.uid(), 'estoque')
        OR c.created_by = auth.uid()
        OR c.responsavel_id = auth.uid()
      )
  )
);

-- 4. demanda-anexos storage: require ownership join to the underlying demanda
DROP POLICY IF EXISTS "demanda anexos read" ON storage.objects;
DROP POLICY IF EXISTS "demanda anexos write" ON storage.objects;
DROP POLICY IF EXISTS "demanda anexos update" ON storage.objects;
DROP POLICY IF EXISTS "demanda anexos delete" ON storage.objects;

CREATE POLICY "demanda anexos read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'demanda-anexos'
  AND EXISTS (
    SELECT 1 FROM public.demandas d
    WHERE d.id = public.storage_folder_uuid(name)
      AND (
        public.is_admin(auth.uid())
        OR public.has_module_access(auth.uid(), 'financeiro')
        OR (public.has_module_access(auth.uid(), 'estoque')
            AND d.tipo_demanda = ANY (ARRAY['fardamento','material_limpeza','material_escritorio','reposicao_estoque']))
        OR (public.has_module_access(auth.uid(), 'patrimonio') AND d.tipo_demanda = 'imobilizado')
        OR d.created_by = auth.uid()
        OR d.solicitante_id = auth.uid()
      )
  )
);

CREATE POLICY "demanda anexos write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'demanda-anexos'
  AND EXISTS (
    SELECT 1 FROM public.demandas d
    WHERE d.id = public.storage_folder_uuid(name)
      AND (
        public.is_admin(auth.uid())
        OR public.has_module_access(auth.uid(), 'financeiro')
        OR (public.has_module_access(auth.uid(), 'estoque')
            AND d.tipo_demanda = ANY (ARRAY['fardamento','material_limpeza','material_escritorio','reposicao_estoque']))
        OR d.created_by = auth.uid()
        OR d.solicitante_id = auth.uid()
      )
  )
);

CREATE POLICY "demanda anexos update" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'demanda-anexos'
  AND EXISTS (
    SELECT 1 FROM public.demandas d
    WHERE d.id = public.storage_folder_uuid(name)
      AND (
        public.is_admin(auth.uid())
        OR public.has_module_access(auth.uid(), 'financeiro')
        OR d.created_by = auth.uid()
        OR d.solicitante_id = auth.uid()
      )
  )
);

CREATE POLICY "demanda anexos delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'demanda-anexos'
  AND EXISTS (
    SELECT 1 FROM public.demandas d
    WHERE d.id = public.storage_folder_uuid(name)
      AND (
        public.is_admin(auth.uid())
        OR public.has_module_access(auth.uid(), 'financeiro')
        OR d.created_by = auth.uid()
        OR d.solicitante_id = auth.uid()
      )
  )
);