-- 1) comercial_catalogo: restringir criação a admins do módulo (update/delete já são)
DROP POLICY IF EXISTS comercial_catalogo_insert ON public.comercial_catalogo;
CREATE POLICY comercial_catalogo_insert ON public.comercial_catalogo
  FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'comercial'));

-- 2) compras: remover auto-atribuição via status defaults
DROP POLICY IF EXISTS compras_update_owner_or_admin ON public.compras;
CREATE POLICY compras_update_owner_or_admin ON public.compras
  FOR UPDATE TO authenticated
  USING (
    is_admin(auth.uid())
    OR is_module_admin(auth.uid(), 'compras')
    OR is_module_admin(auth.uid(), 'estoque')
    OR auth.uid() = created_by
    OR auth.uid() = responsavel_id
  )
  WITH CHECK (
    is_admin(auth.uid())
    OR is_module_admin(auth.uid(), 'compras')
    OR is_module_admin(auth.uid(), 'estoque')
    OR auth.uid() = created_by
    OR auth.uid() = responsavel_id
  );

-- 3) demanda_tipos: leitura escopada por módulo
DROP POLICY IF EXISTS demanda_tipos_select_auth ON public.demanda_tipos;
CREATE POLICY demanda_tipos_select_auth ON public.demanda_tipos
  FOR SELECT TO authenticated
  USING (
    is_admin(auth.uid())
    OR has_module_access(auth.uid(), 'financeiro_op')
    OR has_module_access(auth.uid(), 'financeiro')
    OR has_module_access(auth.uid(), 'compras')
    OR has_module_access(auth.uid(), 'estoque')
    OR has_module_access(auth.uid(), 'patrimonio')
  );

-- 4) diarista_departamentos: leitura escopada por módulo/lançadores
DROP POLICY IF EXISTS diarista_departamentos_select ON public.diarista_departamentos;
CREATE POLICY diarista_departamentos_select ON public.diarista_departamentos
  FOR SELECT TO authenticated
  USING (
    is_admin(auth.uid())
    OR has_module_access(auth.uid(), 'financeiro_op')
    OR has_module_access(auth.uid(), 'financeiro')
    OR pode_lancar_diaria(auth.uid())
  );