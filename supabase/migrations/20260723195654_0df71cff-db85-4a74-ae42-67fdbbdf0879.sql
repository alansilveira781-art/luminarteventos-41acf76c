
-- 1) comercial_vendas / cards / bonificacao_producao: restrict SELECT to admins/module admins
DROP POLICY IF EXISTS "Comercial can read vendas" ON public.comercial_vendas;
CREATE POLICY "comercial_vendas_select_admins"
  ON public.comercial_vendas
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.is_module_admin(auth.uid(), 'comercial')
  );

DROP POLICY IF EXISTS "comercial_cards_select" ON public.comercial_cards;
CREATE POLICY "comercial_cards_select"
  ON public.comercial_cards
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.is_module_admin(auth.uid(), 'comercial')
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "comercial_bonif_select" ON public.comercial_bonificacao_producao;
CREATE POLICY "comercial_bonif_select"
  ON public.comercial_bonificacao_producao
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.is_module_admin(auth.uid(), 'comercial')
  );

-- 2) compra_anexos: restrict SELECT to owners/admins tied to parent compra
DROP POLICY IF EXISTS "compra_anexos select module" ON public.compra_anexos;
CREATE POLICY "compra_anexos_select_owner"
  ON public.compra_anexos
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.is_module_admin(auth.uid(), 'compras')
    OR public.is_module_admin(auth.uid(), 'estoque')
    OR EXISTS (
      SELECT 1 FROM public.compras c
      WHERE c.id = compra_anexos.compra_id
        AND (
          c.created_by = auth.uid()
          OR c.responsavel_id = auth.uid()
          OR c.solicitante_id = auth.uid()
          OR (c.solicitante IS NOT NULL AND lower(c.solicitante) = lower((auth.jwt() ->> 'email')))
        )
    )
  );

-- 3) compra_comentarios: same scoping
DROP POLICY IF EXISTS "compra_comentarios_select" ON public.compra_comentarios;
CREATE POLICY "compra_comentarios_select"
  ON public.compra_comentarios
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.is_module_admin(auth.uid(), 'compras')
    OR public.is_module_admin(auth.uid(), 'estoque')
    OR EXISTS (
      SELECT 1 FROM public.compras c
      WHERE c.id = compra_comentarios.compra_id
        AND (
          c.created_by = auth.uid()
          OR c.responsavel_id = auth.uid()
          OR c.solicitante_id = auth.uid()
          OR (c.solicitante IS NOT NULL AND lower(c.solicitante) = lower((auth.jwt() ->> 'email')))
        )
    )
  );

-- 4) Switch public-role policies to authenticated
-- juridico_anexos
DROP POLICY IF EXISTS "juridico_anexos delete owner" ON public.juridico_anexos;
DROP POLICY IF EXISTS "juridico_anexos insert" ON public.juridico_anexos;
DROP POLICY IF EXISTS "juridico_anexos select module" ON public.juridico_anexos;
DROP POLICY IF EXISTS "juridico_anexos update owner" ON public.juridico_anexos;
CREATE POLICY "juridico_anexos select module" ON public.juridico_anexos
  FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'juridico'));
CREATE POLICY "juridico_anexos insert" ON public.juridico_anexos
  FOR INSERT TO authenticated
  WITH CHECK (public.has_module_access(auth.uid(), 'juridico'));
CREATE POLICY "juridico_anexos update owner" ON public.juridico_anexos
  FOR UPDATE TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.is_module_admin(auth.uid(), 'juridico')
    OR uploaded_by = auth.uid()
  );
CREATE POLICY "juridico_anexos delete owner" ON public.juridico_anexos
  FOR DELETE TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.is_module_admin(auth.uid(), 'juridico')
    OR uploaded_by = auth.uid()
  );

-- juridico_comentarios
DROP POLICY IF EXISTS "juridico_comentarios_delete_own" ON public.juridico_comentarios;
DROP POLICY IF EXISTS "juridico_comentarios_insert" ON public.juridico_comentarios;
DROP POLICY IF EXISTS "juridico_comentarios_select" ON public.juridico_comentarios;
DROP POLICY IF EXISTS "juridico_comentarios_update_own" ON public.juridico_comentarios;
CREATE POLICY "juridico_comentarios_select" ON public.juridico_comentarios
  FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'juridico'));
CREATE POLICY "juridico_comentarios_insert" ON public.juridico_comentarios
  FOR INSERT TO authenticated
  WITH CHECK (public.has_module_access(auth.uid(), 'juridico') AND auth.uid() = user_id);
CREATE POLICY "juridico_comentarios_update_own" ON public.juridico_comentarios
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_module_admin(auth.uid(), 'juridico')
    OR public.is_admin(auth.uid())
  );
CREATE POLICY "juridico_comentarios_delete_own" ON public.juridico_comentarios
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_module_admin(auth.uid(), 'juridico')
    OR public.is_admin(auth.uid())
  );

-- juridico_historico
DROP POLICY IF EXISTS "juridico_historico module access" ON public.juridico_historico;
CREATE POLICY "juridico_historico module access" ON public.juridico_historico
  FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(), 'juridico'))
  WITH CHECK (public.has_module_access(auth.uid(), 'juridico'));

-- juridico_contratos: switch remaining public policies to authenticated
DROP POLICY IF EXISTS "juridico_contratos insert" ON public.juridico_contratos;
DROP POLICY IF EXISTS "juridico_contratos update" ON public.juridico_contratos;
CREATE POLICY "juridico_contratos insert" ON public.juridico_contratos
  FOR INSERT TO authenticated
  WITH CHECK (public.has_module_access(auth.uid(), 'juridico'));
CREATE POLICY "juridico_contratos update" ON public.juridico_contratos
  FOR UPDATE TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.is_module_admin(auth.uid(), 'juridico')
    OR public.has_module_access(auth.uid(), 'juridico')
  );

-- compra_itens_select_owner and demanda_itens_select_owner: switch to authenticated
DROP POLICY IF EXISTS "compra_itens_select_owner" ON public.compra_itens;
CREATE POLICY "compra_itens_select_owner" ON public.compra_itens
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.compras c
    WHERE c.id = compra_itens.compra_id
      AND (
        auth.uid() = c.created_by
        OR auth.uid() = c.solicitante_id
        OR (c.solicitante IS NOT NULL AND lower(c.solicitante) = lower((auth.jwt() ->> 'email')))
      )
  ));

DROP POLICY IF EXISTS "demanda_itens_select_owner" ON public.demanda_itens;
CREATE POLICY "demanda_itens_select_owner" ON public.demanda_itens
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.demandas d
    WHERE d.id = demanda_itens.demanda_id
      AND (
        auth.uid() = d.created_by
        OR auth.uid() = d.solicitante_id
        OR (d.solicitante IS NOT NULL AND lower(d.solicitante) = lower((auth.jwt() ->> 'email')))
      )
  ));
