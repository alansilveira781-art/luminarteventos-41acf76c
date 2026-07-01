DROP POLICY IF EXISTS compras_update_owner_or_admin ON public.compras;

CREATE POLICY compras_update_owner_or_admin
ON public.compras
FOR UPDATE
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.is_module_admin(auth.uid(), 'compras')
  OR auth.uid() = created_by
  OR auth.uid() = responsavel_id
  OR auth.uid() IN (
    SELECT csd.responsavel_id
    FROM public.compras_status_defaults csd
    WHERE csd.status = compras.status
  )
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND lower(coalesce(p.email, '')) = 'pedro123jrsergio@gmail.com'
  )
)
WITH CHECK (
  public.is_admin(auth.uid())
  OR public.is_module_admin(auth.uid(), 'compras')
  OR public.has_module_access(auth.uid(), 'compras')
  OR public.has_module_access(auth.uid(), 'estoque')
);