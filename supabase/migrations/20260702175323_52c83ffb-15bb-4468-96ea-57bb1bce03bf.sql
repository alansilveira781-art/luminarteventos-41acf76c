
-- Fix 1: Remove hardcoded email bypass from compras UPDATE policy
DROP POLICY IF EXISTS compras_update_owner_or_admin ON public.compras;
CREATE POLICY compras_update_owner_or_admin ON public.compras
  FOR UPDATE
  TO authenticated
  USING (
    is_admin(auth.uid())
    OR is_module_admin(auth.uid(), 'compras'::text)
    OR is_module_admin(auth.uid(), 'estoque'::text)
    OR has_module_access(auth.uid(), 'estoque'::text)
    OR (auth.uid() = created_by)
    OR (auth.uid() = responsavel_id)
    OR (auth.uid() IN (
      SELECT csd.responsavel_id FROM public.compras_status_defaults csd
      WHERE csd.status = compras.status
    ))
  )
  WITH CHECK (
    is_admin(auth.uid())
    OR is_module_admin(auth.uid(), 'compras'::text)
    OR has_module_access(auth.uid(), 'compras'::text)
    OR has_module_access(auth.uid(), 'estoque'::text)
  );

-- Fix 2: Remove public anon read on eventos
DROP POLICY IF EXISTS "eventos public read" ON public.eventos;
REVOKE SELECT ON public.eventos FROM anon;
