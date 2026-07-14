
-- Fix: comercial_classificacoes writes must require comercial module access
DROP POLICY IF EXISTS cc_insert ON public.comercial_classificacoes;
DROP POLICY IF EXISTS cc_delete ON public.comercial_classificacoes;

CREATE POLICY cc_insert_module ON public.comercial_classificacoes
  FOR INSERT TO authenticated
  WITH CHECK (has_module_access(auth.uid(), 'comercial'));

CREATE POLICY cc_update_module ON public.comercial_classificacoes
  FOR UPDATE TO authenticated
  USING (has_module_access(auth.uid(), 'comercial'))
  WITH CHECK (has_module_access(auth.uid(), 'comercial'));

CREATE POLICY cc_delete_module ON public.comercial_classificacoes
  FOR DELETE TO authenticated
  USING (has_module_access(auth.uid(), 'comercial'));

-- Fix: compra_comentarios — restrict UPDATE/DELETE to author or module admin
DROP POLICY IF EXISTS "compras module access" ON public.compra_comentarios;

CREATE POLICY compra_comentarios_select ON public.compra_comentarios
  FOR SELECT TO authenticated
  USING (
    has_module_access(auth.uid(), 'compras')
    OR has_module_access(auth.uid(), 'estoque')
  );

CREATE POLICY compra_comentarios_insert ON public.compra_comentarios
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      has_module_access(auth.uid(), 'compras')
      OR has_module_access(auth.uid(), 'estoque')
    )
  );

CREATE POLICY compra_comentarios_update_own ON public.compra_comentarios
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR is_module_admin(auth.uid(), 'compras')
    OR is_admin(auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    OR is_module_admin(auth.uid(), 'compras')
    OR is_admin(auth.uid())
  );

CREATE POLICY compra_comentarios_delete_own ON public.compra_comentarios
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR is_module_admin(auth.uid(), 'compras')
    OR is_admin(auth.uid())
  );

-- Fix: demanda_comentarios — restrict UPDATE/DELETE to author or module admin
DROP POLICY IF EXISTS "financeiro module access" ON public.demanda_comentarios;

CREATE POLICY demanda_comentarios_select ON public.demanda_comentarios
  FOR SELECT TO authenticated
  USING (has_module_access(auth.uid(), 'financeiro'));

CREATE POLICY demanda_comentarios_insert ON public.demanda_comentarios
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND has_module_access(auth.uid(), 'financeiro')
  );

CREATE POLICY demanda_comentarios_update_own ON public.demanda_comentarios
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR is_module_admin(auth.uid(), 'financeiro')
    OR is_admin(auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    OR is_module_admin(auth.uid(), 'financeiro')
    OR is_admin(auth.uid())
  );

CREATE POLICY demanda_comentarios_delete_own ON public.demanda_comentarios
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR is_module_admin(auth.uid(), 'financeiro')
    OR is_admin(auth.uid())
  );

-- Fix: demanda_patrimonio_registros — remove open policies, keep module-scoped
DROP POLICY IF EXISTS dpr_insert ON public.demanda_patrimonio_registros;
DROP POLICY IF EXISTS dpr_select ON public.demanda_patrimonio_registros;

-- Fix: compras_status_defaults — verified only admins have write access
-- (compras_status_defaults admin write ALL + admin delete DELETE;
--  regular users only have SELECT via compras_status_defaults read).
-- No open write policy exists; no change needed beyond confirming.
