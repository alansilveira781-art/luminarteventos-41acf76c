DROP POLICY IF EXISTS "comercial_vendas_insert" ON public.comercial_vendas;
CREATE POLICY "comercial_vendas_insert" ON public.comercial_vendas
FOR INSERT TO authenticated
WITH CHECK (is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'comercial'));

DROP POLICY IF EXISTS "op_apont_write" ON public.op_ordem_apontamentos;

CREATE POLICY "op_apont_insert" ON public.op_ordem_apontamentos
FOR INSERT TO authenticated
WITH CHECK (
  has_module_access(auth.uid(), 'operacao')
  AND (executado_por IS NULL OR executado_por = auth.uid() OR is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'operacao'))
);

CREATE POLICY "op_apont_update" ON public.op_ordem_apontamentos
FOR UPDATE TO authenticated
USING (
  has_module_access(auth.uid(), 'operacao')
  AND (executado_por IS NULL OR executado_por = auth.uid() OR is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'operacao'))
)
WITH CHECK (
  has_module_access(auth.uid(), 'operacao')
  AND (executado_por IS NULL OR executado_por = auth.uid() OR is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'operacao'))
);

CREATE POLICY "op_apont_delete" ON public.op_ordem_apontamentos
FOR DELETE TO authenticated
USING (
  has_module_access(auth.uid(), 'operacao')
  AND (executado_por = auth.uid() OR is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'operacao'))
);