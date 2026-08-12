-- 1) Backfill: vincula pedidos antigos à conta real pelo e-mail antes de remover o match textual
UPDATE public.compras c
SET solicitante_id = u.id
FROM auth.users u
WHERE c.solicitante_id IS NULL
  AND (lower(c.solicitante_email) = lower(u.email) OR lower(c.solicitante) = lower(u.email));

UPDATE public.demandas d
SET solicitante_id = u.id
FROM auth.users u
WHERE d.solicitante_id IS NULL
  AND (lower(d.solicitante_email) = lower(u.email) OR lower(d.solicitante) = lower(u.email));

-- 2) COMPRAS
DROP POLICY IF EXISTS "compras_select_owner" ON public.compras;
CREATE POLICY "compras_select_owner" ON public.compras
FOR SELECT TO authenticated
USING (auth.uid() = created_by OR auth.uid() = solicitante_id);

DROP POLICY IF EXISTS "compra_itens_select_owner" ON public.compra_itens;
CREATE POLICY "compra_itens_select_owner" ON public.compra_itens
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.compras c
  WHERE c.id = compra_itens.compra_id AND (auth.uid() = c.created_by OR auth.uid() = c.solicitante_id)));

DROP POLICY IF EXISTS "compra_pagamentos_select_owner" ON public.compra_pagamentos;
CREATE POLICY "compra_pagamentos_select_owner" ON public.compra_pagamentos
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.compras c
  WHERE c.id = compra_pagamentos.compra_id AND (auth.uid() = c.created_by OR auth.uid() = c.solicitante_id)));

DROP POLICY IF EXISTS "compra_anexos select owner" ON public.compra_anexos;
CREATE POLICY "compra_anexos select owner" ON public.compra_anexos
FOR SELECT TO authenticated
USING (
  is_admin(auth.uid()) OR has_module_access(auth.uid(), 'compras') OR has_module_access(auth.uid(), 'estoque')
  OR EXISTS (SELECT 1 FROM public.compras c
    WHERE c.id = compra_anexos.compra_id
      AND (c.created_by = auth.uid() OR c.responsavel_id = auth.uid() OR c.solicitante_id = auth.uid()))
);

DROP POLICY IF EXISTS "compra_anexos update owner" ON public.compra_anexos;
CREATE POLICY "compra_anexos update owner" ON public.compra_anexos
FOR UPDATE TO authenticated
USING (
  is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'compras') OR is_module_admin(auth.uid(), 'estoque')
  OR EXISTS (SELECT 1 FROM public.compras c
    WHERE c.id = compra_anexos.compra_id
      AND (c.created_by = auth.uid() OR c.responsavel_id = auth.uid() OR c.solicitante_id = auth.uid()))
)
WITH CHECK (
  is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'compras') OR is_module_admin(auth.uid(), 'estoque')
  OR EXISTS (SELECT 1 FROM public.compras c
    WHERE c.id = compra_anexos.compra_id
      AND (c.created_by = auth.uid() OR c.responsavel_id = auth.uid() OR c.solicitante_id = auth.uid()))
);

DROP POLICY IF EXISTS "compra_anexos delete owner" ON public.compra_anexos;
CREATE POLICY "compra_anexos delete owner" ON public.compra_anexos
FOR DELETE TO authenticated
USING (
  is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'compras') OR is_module_admin(auth.uid(), 'estoque')
  OR EXISTS (SELECT 1 FROM public.compras c
    WHERE c.id = compra_anexos.compra_id
      AND (c.created_by = auth.uid() OR c.responsavel_id = auth.uid() OR c.solicitante_id = auth.uid()))
);

DROP POLICY IF EXISTS "compra_anexos insert owner" ON public.compra_anexos;
CREATE POLICY "compra_anexos insert owner" ON public.compra_anexos
FOR INSERT TO authenticated
WITH CHECK (
  is_admin(auth.uid()) OR has_module_access(auth.uid(), 'compras') OR has_module_access(auth.uid(), 'estoque')
  OR EXISTS (SELECT 1 FROM public.compras c
    WHERE c.id = compra_anexos.compra_id
      AND (c.created_by = auth.uid() OR c.responsavel_id = auth.uid() OR c.solicitante_id = auth.uid()))
);

-- 3) DEMANDAS
DROP POLICY IF EXISTS "demandas_select_owner" ON public.demandas;
CREATE POLICY "demandas_select_owner" ON public.demandas
FOR SELECT TO authenticated
USING (auth.uid() = created_by OR auth.uid() = solicitante_id);

DROP POLICY IF EXISTS "demanda_itens_select_owner" ON public.demanda_itens;
CREATE POLICY "demanda_itens_select_owner" ON public.demanda_itens
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.demandas d
  WHERE d.id = demanda_itens.demanda_id AND (auth.uid() = d.created_by OR auth.uid() = d.solicitante_id)));

DROP POLICY IF EXISTS "demanda_pagamentos_select_owner" ON public.demanda_pagamentos;
CREATE POLICY "demanda_pagamentos_select_owner" ON public.demanda_pagamentos
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.demandas d
  WHERE d.id = demanda_pagamentos.demanda_id AND (auth.uid() = d.created_by OR auth.uid() = d.solicitante_id)));

DROP POLICY IF EXISTS "demanda_anexos select owner" ON public.demanda_anexos;
CREATE POLICY "demanda_anexos select owner" ON public.demanda_anexos
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.demandas d
  WHERE d.id = demanda_anexos.demanda_id AND (d.created_by = auth.uid() OR d.solicitante_id = auth.uid())));

-- 4) STORAGE
DROP POLICY IF EXISTS "compra-anexos read" ON storage.objects;
CREATE POLICY "compra-anexos read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'compra-anexos' AND (
    is_admin(auth.uid()) OR has_module_access(auth.uid(), 'compras') OR has_module_access(auth.uid(), 'estoque')
    OR EXISTS (SELECT 1 FROM public.compras c
      WHERE c.id = public.storage_folder_uuid(objects.name)
        AND (c.created_by = auth.uid() OR c.responsavel_id = auth.uid() OR c.solicitante_id = auth.uid()))
  )
);

DROP POLICY IF EXISTS "demanda anexos read owner" ON storage.objects;
CREATE POLICY "demanda anexos read owner" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'demanda-anexos' AND EXISTS (
    SELECT 1 FROM public.demandas d
    WHERE d.id = public.storage_folder_uuid(objects.name)
      AND (d.created_by = auth.uid() OR d.solicitante_id = auth.uid())
  )
);

-- 5) FINANCEIRO_ATIVIDADES
DROP POLICY IF EXISTS "Atividades visiveis para autenticados" ON public.financeiro_atividades;
CREATE POLICY "Atividades visiveis para modulo financeiro" ON public.financeiro_atividades
FOR SELECT TO authenticated
USING (
  is_admin(auth.uid())
  OR has_module_access(auth.uid(), 'financeiro')
  OR has_module_access(auth.uid(), 'financeiro_op')
);