DROP POLICY IF EXISTS "compra_anexos select owner" ON public.compra_anexos;
CREATE POLICY "compra_anexos select owner"
ON public.compra_anexos
FOR SELECT
TO authenticated
USING (
  is_admin(auth.uid())
  OR has_module_access(auth.uid(), 'compras')
  OR has_module_access(auth.uid(), 'estoque')
  OR EXISTS (
    SELECT 1 FROM public.compras c
    WHERE c.id = compra_anexos.compra_id
      AND (
        c.created_by = auth.uid()
        OR c.responsavel_id = auth.uid()
        OR c.solicitante_id = auth.uid()
        OR (c.solicitante IS NOT NULL AND lower(c.solicitante) = lower((auth.jwt() ->> 'email')))
        OR (c.solicitante_email IS NOT NULL AND lower(c.solicitante_email) = lower((auth.jwt() ->> 'email')))
      )
  )
);

DROP POLICY IF EXISTS "compra_anexos insert owner" ON public.compra_anexos;
CREATE POLICY "compra_anexos insert owner"
ON public.compra_anexos
FOR INSERT
TO authenticated
WITH CHECK (
  is_admin(auth.uid())
  OR has_module_access(auth.uid(), 'compras')
  OR has_module_access(auth.uid(), 'estoque')
  OR EXISTS (
    SELECT 1 FROM public.compras c
    WHERE c.id = compra_anexos.compra_id
      AND (
        c.created_by = auth.uid()
        OR c.responsavel_id = auth.uid()
        OR c.solicitante_id = auth.uid()
        OR (c.solicitante_email IS NOT NULL AND lower(c.solicitante_email) = lower((auth.jwt() ->> 'email')))
      )
  )
);