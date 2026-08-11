-- compra_historico
DROP POLICY IF EXISTS "compras module access" ON public.compra_historico;

CREATE POLICY "compra_historico select" ON public.compra_historico
FOR SELECT TO authenticated
USING (has_module_access(auth.uid(), 'compras') OR has_module_access(auth.uid(), 'estoque'));

CREATE POLICY "compra_historico insert" ON public.compra_historico
FOR INSERT TO authenticated
WITH CHECK (has_module_access(auth.uid(), 'compras') OR has_module_access(auth.uid(), 'estoque'));

CREATE POLICY "compra_historico admin update" ON public.compra_historico
FOR UPDATE TO authenticated
USING (is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'compras'))
WITH CHECK (is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'compras'));

CREATE POLICY "compra_historico delete" ON public.compra_historico
FOR DELETE TO authenticated
USING (
  is_admin(auth.uid())
  OR is_module_admin(auth.uid(), 'compras')
  OR EXISTS (
    SELECT 1 FROM public.compras c
    WHERE c.id = compra_historico.compra_id
      AND (c.created_by = auth.uid() OR c.responsavel_id = auth.uid())
  )
);

-- demanda_historico
DROP POLICY IF EXISTS "financeiro module access" ON public.demanda_historico;

CREATE POLICY "demanda_historico select" ON public.demanda_historico
FOR SELECT TO authenticated
USING (has_module_access(auth.uid(), 'financeiro'));

CREATE POLICY "demanda_historico insert" ON public.demanda_historico
FOR INSERT TO authenticated
WITH CHECK (has_module_access(auth.uid(), 'financeiro'));

CREATE POLICY "demanda_historico admin update" ON public.demanda_historico
FOR UPDATE TO authenticated
USING (is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'financeiro'))
WITH CHECK (is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'financeiro'));

CREATE POLICY "demanda_historico delete" ON public.demanda_historico
FOR DELETE TO authenticated
USING (
  is_admin(auth.uid())
  OR is_module_admin(auth.uid(), 'financeiro')
  OR EXISTS (
    SELECT 1 FROM public.demandas d
    WHERE d.id = demanda_historico.demanda_id
      AND (d.created_by = auth.uid() OR d.responsavel_id = auth.uid())
  )
);

-- op_ordens: align WITH CHECK with USING
DROP POLICY IF EXISTS "op_ordens_update" ON public.op_ordens;

CREATE POLICY "op_ordens_update" ON public.op_ordens
FOR UPDATE TO authenticated
USING (
  is_admin(auth.uid())
  OR is_module_admin(auth.uid(), 'operacao')
  OR (has_module_access(auth.uid(), 'operacao')
      AND (created_by = auth.uid() OR responsavel_id = auth.uid()
           OR (created_by IS NULL AND responsavel_id IS NULL)))
)
WITH CHECK (
  is_admin(auth.uid())
  OR is_module_admin(auth.uid(), 'operacao')
  OR (has_module_access(auth.uid(), 'operacao')
      AND (created_by = auth.uid() OR responsavel_id = auth.uid()
           OR (created_by IS NULL AND responsavel_id IS NULL)))
);