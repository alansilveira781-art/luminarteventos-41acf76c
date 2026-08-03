-- 1) compra_anexos: incluir solicitante nas regras de update/delete (igual ao select)
DROP POLICY IF EXISTS "compra_anexos delete owner" ON public.compra_anexos;
CREATE POLICY "compra_anexos delete owner" ON public.compra_anexos
FOR DELETE TO authenticated
USING (
  is_admin(auth.uid())
  OR is_module_admin(auth.uid(), 'compras')
  OR is_module_admin(auth.uid(), 'estoque')
  OR EXISTS (
    SELECT 1 FROM public.compras c
    WHERE c.id = compra_anexos.compra_id
      AND (
        c.created_by = auth.uid()
        OR c.responsavel_id = auth.uid()
        OR c.solicitante_id = auth.uid()
        OR (c.solicitante IS NOT NULL AND lower(c.solicitante) = lower(auth.jwt() ->> 'email'))
        OR (c.solicitante_email IS NOT NULL AND lower(c.solicitante_email) = lower(auth.jwt() ->> 'email'))
      )
  )
);

DROP POLICY IF EXISTS "compra_anexos update owner" ON public.compra_anexos;
CREATE POLICY "compra_anexos update owner" ON public.compra_anexos
FOR UPDATE TO authenticated
USING (
  is_admin(auth.uid())
  OR is_module_admin(auth.uid(), 'compras')
  OR is_module_admin(auth.uid(), 'estoque')
  OR EXISTS (
    SELECT 1 FROM public.compras c
    WHERE c.id = compra_anexos.compra_id
      AND (
        c.created_by = auth.uid()
        OR c.responsavel_id = auth.uid()
        OR c.solicitante_id = auth.uid()
        OR (c.solicitante IS NOT NULL AND lower(c.solicitante) = lower(auth.jwt() ->> 'email'))
        OR (c.solicitante_email IS NOT NULL AND lower(c.solicitante_email) = lower(auth.jwt() ->> 'email'))
      )
  )
)
WITH CHECK (
  is_admin(auth.uid())
  OR is_module_admin(auth.uid(), 'compras')
  OR is_module_admin(auth.uid(), 'estoque')
  OR EXISTS (
    SELECT 1 FROM public.compras c
    WHERE c.id = compra_anexos.compra_id
      AND (
        c.created_by = auth.uid()
        OR c.responsavel_id = auth.uid()
        OR c.solicitante_id = auth.uid()
        OR (c.solicitante IS NOT NULL AND lower(c.solicitante) = lower(auth.jwt() ->> 'email'))
        OR (c.solicitante_email IS NOT NULL AND lower(c.solicitante_email) = lower(auth.jwt() ->> 'email'))
      )
  )
);

-- 2) compras: restringir delegação via compras_status_defaults
DROP POLICY IF EXISTS "compras_update_owner_or_admin" ON public.compras;
CREATE POLICY "compras_update_owner_or_admin" ON public.compras
FOR UPDATE TO authenticated
USING (
  is_admin(auth.uid())
  OR is_module_admin(auth.uid(), 'compras')
  OR is_module_admin(auth.uid(), 'estoque')
  OR auth.uid() = created_by
  OR auth.uid() = responsavel_id
  OR (
    has_module_access(auth.uid(), 'compras')
    AND EXISTS (
      SELECT 1 FROM public.compras_status_defaults csd
      WHERE csd.status = compras.status AND csd.responsavel_id = auth.uid()
    )
  )
)
WITH CHECK (
  is_admin(auth.uid())
  OR is_module_admin(auth.uid(), 'compras')
  OR is_module_admin(auth.uid(), 'estoque')
  OR auth.uid() = created_by
  OR auth.uid() = responsavel_id
  OR (
    has_module_access(auth.uid(), 'compras')
    AND EXISTS (
      SELECT 1 FROM public.compras_status_defaults csd
      WHERE csd.status = compras.status AND csd.responsavel_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "compras_delete_owner_or_admin" ON public.compras;
CREATE POLICY "compras_delete_owner_or_admin" ON public.compras
FOR DELETE TO authenticated
USING (
  is_admin(auth.uid())
  OR is_module_admin(auth.uid(), 'compras')
  OR auth.uid() = created_by
  OR auth.uid() = responsavel_id
);

-- 3) financeiro_op: limitar updates a registros já no fluxo financeiro
DROP POLICY IF EXISTS "financeiro_op pode atualizar compras" ON public.compras;
CREATE POLICY "financeiro_op pode atualizar compras" ON public.compras
FOR UPDATE TO authenticated
USING (has_module_access(auth.uid(), 'financeiro_op') AND status_financeiro IS NOT NULL)
WITH CHECK (has_module_access(auth.uid(), 'financeiro_op') AND status_financeiro IS NOT NULL);

DROP POLICY IF EXISTS "financeiro_op pode atualizar demandas" ON public.demandas;
CREATE POLICY "financeiro_op pode atualizar demandas" ON public.demandas
FOR UPDATE TO authenticated
USING (has_module_access(auth.uid(), 'financeiro_op') AND status_financeiro IS NOT NULL)
WITH CHECK (has_module_access(auth.uid(), 'financeiro_op') AND status_financeiro IS NOT NULL);