
DROP POLICY IF EXISTS "compras_fornecedores module access" ON public.compras_fornecedores;
DROP POLICY IF EXISTS "compras_solicitantes module access" ON public.compras_solicitantes;

CREATE POLICY "compras_fornecedores select" ON public.compras_fornecedores
  FOR SELECT TO authenticated
  USING (has_module_access(auth.uid(), 'compras') OR has_module_access(auth.uid(), 'estoque'));

CREATE POLICY "compras_fornecedores insert admin" ON public.compras_fornecedores
  FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'compras') OR is_module_admin(auth.uid(), 'estoque'));

CREATE POLICY "compras_fornecedores update admin" ON public.compras_fornecedores
  FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'compras') OR is_module_admin(auth.uid(), 'estoque'))
  WITH CHECK (is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'compras') OR is_module_admin(auth.uid(), 'estoque'));

CREATE POLICY "compras_fornecedores delete admin" ON public.compras_fornecedores
  FOR DELETE TO authenticated
  USING (is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'compras') OR is_module_admin(auth.uid(), 'estoque'));

CREATE POLICY "compras_solicitantes select" ON public.compras_solicitantes
  FOR SELECT TO authenticated
  USING (has_module_access(auth.uid(), 'compras') OR has_module_access(auth.uid(), 'estoque'));

CREATE POLICY "compras_solicitantes insert admin" ON public.compras_solicitantes
  FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'compras') OR is_module_admin(auth.uid(), 'estoque'));

CREATE POLICY "compras_solicitantes update admin" ON public.compras_solicitantes
  FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'compras') OR is_module_admin(auth.uid(), 'estoque'))
  WITH CHECK (is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'compras') OR is_module_admin(auth.uid(), 'estoque'));

CREATE POLICY "compras_solicitantes delete admin" ON public.compras_solicitantes
  FOR DELETE TO authenticated
  USING (is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'compras') OR is_module_admin(auth.uid(), 'estoque'));
