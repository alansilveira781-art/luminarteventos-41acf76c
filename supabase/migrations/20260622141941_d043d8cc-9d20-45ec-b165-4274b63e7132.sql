-- Liberar INSERT/UPDATE/DELETE em compras_fornecedores e compras_solicitantes
-- para qualquer usuário com acesso ao módulo Compras ou Estoque.
-- compradores já está OK (policy ALL com module access).

DROP POLICY IF EXISTS "compras_fornecedores insert admin" ON public.compras_fornecedores;
DROP POLICY IF EXISTS "compras_fornecedores update admin" ON public.compras_fornecedores;
DROP POLICY IF EXISTS "compras_fornecedores delete admin" ON public.compras_fornecedores;

CREATE POLICY "compras_fornecedores insert module"
  ON public.compras_fornecedores
  FOR INSERT
  TO authenticated
  WITH CHECK (has_module_access(auth.uid(), 'compras') OR has_module_access(auth.uid(), 'estoque'));

CREATE POLICY "compras_fornecedores update module"
  ON public.compras_fornecedores
  FOR UPDATE
  TO authenticated
  USING (has_module_access(auth.uid(), 'compras') OR has_module_access(auth.uid(), 'estoque'))
  WITH CHECK (has_module_access(auth.uid(), 'compras') OR has_module_access(auth.uid(), 'estoque'));

CREATE POLICY "compras_fornecedores delete module"
  ON public.compras_fornecedores
  FOR DELETE
  TO authenticated
  USING (has_module_access(auth.uid(), 'compras') OR has_module_access(auth.uid(), 'estoque'));

DROP POLICY IF EXISTS "compras_solicitantes insert admin" ON public.compras_solicitantes;
DROP POLICY IF EXISTS "compras_solicitantes update admin" ON public.compras_solicitantes;
DROP POLICY IF EXISTS "compras_solicitantes delete admin" ON public.compras_solicitantes;

CREATE POLICY "compras_solicitantes insert module"
  ON public.compras_solicitantes
  FOR INSERT
  TO authenticated
  WITH CHECK (has_module_access(auth.uid(), 'compras') OR has_module_access(auth.uid(), 'estoque'));

CREATE POLICY "compras_solicitantes update module"
  ON public.compras_solicitantes
  FOR UPDATE
  TO authenticated
  USING (has_module_access(auth.uid(), 'compras') OR has_module_access(auth.uid(), 'estoque'))
  WITH CHECK (has_module_access(auth.uid(), 'compras') OR has_module_access(auth.uid(), 'estoque'));

CREATE POLICY "compras_solicitantes delete module"
  ON public.compras_solicitantes
  FOR DELETE
  TO authenticated
  USING (has_module_access(auth.uid(), 'compras') OR has_module_access(auth.uid(), 'estoque'));