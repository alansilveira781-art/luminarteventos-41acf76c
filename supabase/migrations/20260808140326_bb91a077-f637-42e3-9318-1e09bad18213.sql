-- juridico_contratos: restringir leitura de dados pessoais sensíveis
DROP POLICY IF EXISTS "juridico_contratos read" ON public.juridico_contratos;
CREATE POLICY "juridico_contratos read"
ON public.juridico_contratos
FOR SELECT
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.is_module_admin(auth.uid(), 'juridico')
  OR (public.has_module_access(auth.uid(), 'juridico') AND created_by = auth.uid())
);

-- compras_status_defaults: garantir que responsavel_id só possa ser definido por admin
DROP POLICY IF EXISTS "compras_status_defaults admin write" ON public.compras_status_defaults;
CREATE POLICY "compras_status_defaults admin insert"
ON public.compras_status_defaults
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'compras'));
CREATE POLICY "compras_status_defaults admin update"
ON public.compras_status_defaults
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'compras'))
WITH CHECK (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'compras'));