
-- Grant compras module admin to the two users currently hardcoded in RLS
UPDATE public.user_modulos um
SET is_admin = true
FROM public.modulos m
WHERE um.modulo_id = m.id
  AND m.slug = 'compras'
  AND um.user_id IN ('9465f822-0273-4235-ba24-148cb1bf2c4b'::uuid, 'fd75a882-75fe-4e5b-935b-d650f050d6be'::uuid);

-- Replace policies to remove hardcoded UUIDs; rely on is_admin / is_module_admin
DROP POLICY IF EXISTS compras_update_owner_or_admin ON public.compras;
DROP POLICY IF EXISTS compras_delete_owner_or_admin ON public.compras;

CREATE POLICY compras_update_owner_or_admin ON public.compras
FOR UPDATE TO authenticated
USING (
  auth.uid() = created_by
  OR public.is_admin(auth.uid())
  OR public.is_module_admin(auth.uid(), 'compras')
)
WITH CHECK (
  auth.uid() = created_by
  OR public.is_admin(auth.uid())
  OR public.is_module_admin(auth.uid(), 'compras')
);

CREATE POLICY compras_delete_owner_or_admin ON public.compras
FOR DELETE TO authenticated
USING (
  auth.uid() = created_by
  OR public.is_admin(auth.uid())
  OR public.is_module_admin(auth.uid(), 'compras')
);
