DROP POLICY IF EXISTS compras_update_owner_or_admin ON public.compras;
DROP POLICY IF EXISTS compras_delete_owner_or_admin ON public.compras;

CREATE POLICY compras_update_owner_or_admin ON public.compras
FOR UPDATE
USING (
  auth.uid() = responsavel_id
  OR auth.uid() = created_by
  OR auth.uid() = '9465f822-0273-4235-ba24-148cb1bf2c4b'::uuid
  OR is_admin(auth.uid())
  OR is_module_admin(auth.uid(), 'compras'::text)
  OR is_module_admin(auth.uid(), 'estoque'::text)
)
WITH CHECK (
  auth.uid() = responsavel_id
  OR auth.uid() = created_by
  OR auth.uid() = '9465f822-0273-4235-ba24-148cb1bf2c4b'::uuid
  OR is_admin(auth.uid())
  OR is_module_admin(auth.uid(), 'compras'::text)
  OR is_module_admin(auth.uid(), 'estoque'::text)
);

CREATE POLICY compras_delete_owner_or_admin ON public.compras
FOR DELETE
USING (
  auth.uid() = responsavel_id
  OR auth.uid() = created_by
  OR auth.uid() = '9465f822-0273-4235-ba24-148cb1bf2c4b'::uuid
  OR is_admin(auth.uid())
  OR is_module_admin(auth.uid(), 'compras'::text)
  OR is_module_admin(auth.uid(), 'estoque'::text)
);