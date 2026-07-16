
-- 1) contabil_tomadores: require contabil module access for writes
DROP POLICY IF EXISTS "Autenticados criam tomadores" ON public.contabil_tomadores;
DROP POLICY IF EXISTS "Autenticados atualizam tomadores" ON public.contabil_tomadores;
DROP POLICY IF EXISTS "Autenticados excluem tomadores" ON public.contabil_tomadores;

CREATE POLICY "Contabil cria tomadores"
  ON public.contabil_tomadores
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_module_access(auth.uid(), 'contabil'));

CREATE POLICY "Contabil atualiza tomadores"
  ON public.contabil_tomadores
  FOR UPDATE
  TO authenticated
  USING (public.has_module_access(auth.uid(), 'contabil'))
  WITH CHECK (public.has_module_access(auth.uid(), 'contabil'));

CREATE POLICY "Contabil exclui tomadores"
  ON public.contabil_tomadores
  FOR DELETE
  TO authenticated
  USING (public.has_module_access(auth.uid(), 'contabil'));

-- 2) compras: tighten UPDATE WITH CHECK to mirror USING (owner/responsavel/admin)
DROP POLICY IF EXISTS compras_update_owner_or_admin ON public.compras;

CREATE POLICY compras_update_owner_or_admin
  ON public.compras
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.is_module_admin(auth.uid(), 'compras')
    OR public.is_module_admin(auth.uid(), 'estoque')
    OR auth.uid() = created_by
    OR auth.uid() = responsavel_id
    OR auth.uid() IN (
      SELECT csd.responsavel_id
      FROM public.compras_status_defaults csd
      WHERE csd.status = compras.status
    )
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.is_module_admin(auth.uid(), 'compras')
    OR public.is_module_admin(auth.uid(), 'estoque')
    OR auth.uid() = created_by
    OR auth.uid() = responsavel_id
    OR auth.uid() IN (
      SELECT csd.responsavel_id
      FROM public.compras_status_defaults csd
      WHERE csd.status = compras.status
    )
  );

-- 3) comercial_email_log: add UPDATE/DELETE policies restricted to admins
CREATE POLICY "Admins atualizam logs de e-mail"
  ON public.comercial_email_log
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'comercial'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'comercial'));

CREATE POLICY "Admins excluem logs de e-mail"
  ON public.comercial_email_log
  FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'comercial'));
