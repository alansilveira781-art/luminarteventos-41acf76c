
DROP POLICY IF EXISTS compras_update_owner_or_admin ON public.compras;
CREATE POLICY compras_update_owner_or_admin ON public.compras
FOR UPDATE
USING (
  auth.uid() = responsavel_id
  OR auth.uid() = created_by
  OR auth.uid() = '9465f822-0273-4235-ba24-148cb1bf2c4b'::uuid
  OR auth.uid() = 'fd75a882-75fe-4e5b-935b-d650f050d6be'::uuid
  OR is_admin(auth.uid())
  OR is_module_admin(auth.uid(), 'compras'::text)
  OR is_module_admin(auth.uid(), 'estoque'::text)
)
WITH CHECK (
  auth.uid() = responsavel_id
  OR auth.uid() = created_by
  OR auth.uid() = '9465f822-0273-4235-ba24-148cb1bf2c4b'::uuid
  OR auth.uid() = 'fd75a882-75fe-4e5b-935b-d650f050d6be'::uuid
  OR is_admin(auth.uid())
  OR is_module_admin(auth.uid(), 'compras'::text)
  OR is_module_admin(auth.uid(), 'estoque'::text)
);

DROP POLICY IF EXISTS compras_delete_owner_or_admin ON public.compras;
CREATE POLICY compras_delete_owner_or_admin ON public.compras
FOR DELETE
USING (
  auth.uid() = responsavel_id
  OR auth.uid() = created_by
  OR auth.uid() = '9465f822-0273-4235-ba24-148cb1bf2c4b'::uuid
  OR auth.uid() = 'fd75a882-75fe-4e5b-935b-d650f050d6be'::uuid
  OR is_admin(auth.uid())
  OR is_module_admin(auth.uid(), 'compras'::text)
  OR is_module_admin(auth.uid(), 'estoque'::text)
);
