
-- compra_anexos: exigir ownership da compra pai para escrita
DROP POLICY IF EXISTS "compra_anexos module access" ON public.compra_anexos;

CREATE POLICY "compra_anexos select module"
ON public.compra_anexos FOR SELECT TO authenticated
USING (
  public.has_module_access(auth.uid(),'compras')
  OR public.has_module_access(auth.uid(),'estoque')
);

CREATE POLICY "compra_anexos insert owner"
ON public.compra_anexos FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin(auth.uid())
  OR public.is_module_admin(auth.uid(),'compras')
  OR public.is_module_admin(auth.uid(),'estoque')
  OR EXISTS (
    SELECT 1 FROM public.compras c
    WHERE c.id = compra_anexos.compra_id
      AND (c.created_by = auth.uid() OR c.responsavel_id = auth.uid())
  )
);

CREATE POLICY "compra_anexos update owner"
ON public.compra_anexos FOR UPDATE TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.is_module_admin(auth.uid(),'compras')
  OR public.is_module_admin(auth.uid(),'estoque')
  OR EXISTS (
    SELECT 1 FROM public.compras c
    WHERE c.id = compra_anexos.compra_id
      AND (c.created_by = auth.uid() OR c.responsavel_id = auth.uid())
  )
)
WITH CHECK (
  public.is_admin(auth.uid())
  OR public.is_module_admin(auth.uid(),'compras')
  OR public.is_module_admin(auth.uid(),'estoque')
  OR EXISTS (
    SELECT 1 FROM public.compras c
    WHERE c.id = compra_anexos.compra_id
      AND (c.created_by = auth.uid() OR c.responsavel_id = auth.uid())
  )
);

CREATE POLICY "compra_anexos delete owner"
ON public.compra_anexos FOR DELETE TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.is_module_admin(auth.uid(),'compras')
  OR public.is_module_admin(auth.uid(),'estoque')
  OR EXISTS (
    SELECT 1 FROM public.compras c
    WHERE c.id = compra_anexos.compra_id
      AND (c.created_by = auth.uid() OR c.responsavel_id = auth.uid())
  )
);

-- compras/demandas: remover match frágil por trecho de e-mail em observacoes
DROP POLICY IF EXISTS "compras_select_owner" ON public.compras;
CREATE POLICY "compras_select_owner"
ON public.compras FOR SELECT TO authenticated
USING (
  auth.uid() = created_by
  OR auth.uid() = solicitante_id
  OR (solicitante IS NOT NULL
      AND lower(solicitante) = lower((auth.jwt() ->> 'email')))
);

DROP POLICY IF EXISTS "demandas_select_owner" ON public.demandas;
CREATE POLICY "demandas_select_owner"
ON public.demandas FOR SELECT TO authenticated
USING (
  auth.uid() = created_by
  OR auth.uid() = solicitante_id
  OR (solicitante IS NOT NULL
      AND lower(solicitante) = lower((auth.jwt() ->> 'email')))
);

-- Restringir role público -> authenticated
DROP POLICY IF EXISTS "Financeiro pode gerenciar diaristas" ON public.diaristas;
CREATE POLICY "Financeiro pode gerenciar diaristas"
ON public.diaristas FOR ALL TO authenticated
USING (public.has_module_access(auth.uid(),'financeiro'))
WITH CHECK (public.has_module_access(auth.uid(),'financeiro'));

DROP POLICY IF EXISTS "Financeiro pode gerenciar apontamentos" ON public.diarista_apontamentos;
CREATE POLICY "Financeiro pode gerenciar apontamentos"
ON public.diarista_apontamentos FOR ALL TO authenticated
USING (public.has_module_access(auth.uid(),'financeiro'))
WITH CHECK (public.has_module_access(auth.uid(),'financeiro'));

DROP POLICY IF EXISTS "financeiro module access" ON public.eventos_centros_custo;
CREATE POLICY "eventos_centros_custo financeiro"
ON public.eventos_centros_custo FOR ALL TO authenticated
USING (public.has_module_access(auth.uid(),'financeiro'))
WITH CHECK (public.has_module_access(auth.uid(),'financeiro'));
