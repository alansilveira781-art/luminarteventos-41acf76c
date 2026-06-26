DROP POLICY IF EXISTS compras_update_owner_or_admin ON public.compras;

CREATE POLICY compras_update_owner_or_admin ON public.compras
FOR UPDATE TO authenticated
USING (
  auth.uid() = created_by
  OR public.is_admin(auth.uid())
  OR public.is_module_admin(auth.uid(), 'compras')
  OR public.is_module_admin(auth.uid(), 'estoque')
)
WITH CHECK (
  auth.uid() = created_by
  OR public.is_admin(auth.uid())
  OR public.is_module_admin(auth.uid(), 'compras')
  OR public.is_module_admin(auth.uid(), 'estoque')
);