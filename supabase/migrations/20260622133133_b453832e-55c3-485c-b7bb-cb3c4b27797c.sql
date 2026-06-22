
-- Auto-fill created_by on insert
CREATE OR REPLACE FUNCTION public.compras_set_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compras_set_created_by ON public.compras;
CREATE TRIGGER trg_compras_set_created_by
  BEFORE INSERT ON public.compras
  FOR EACH ROW EXECUTE FUNCTION public.compras_set_created_by();

-- Replace single FOR ALL policy with per-op policies
DROP POLICY IF EXISTS "compras module access" ON public.compras;

CREATE POLICY "compras_select_module" ON public.compras
  FOR SELECT TO authenticated
  USING (
    public.has_module_access(auth.uid(), 'compras')
    OR public.has_module_access(auth.uid(), 'estoque')
  );

CREATE POLICY "compras_insert_module" ON public.compras
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_module_access(auth.uid(), 'compras')
    OR public.has_module_access(auth.uid(), 'estoque')
  );

CREATE POLICY "compras_update_owner_or_admin" ON public.compras
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = responsavel_id
    OR auth.uid() = created_by
    OR public.is_admin(auth.uid())
    OR public.is_module_admin(auth.uid(), 'compras')
    OR public.is_module_admin(auth.uid(), 'estoque')
  )
  WITH CHECK (
    auth.uid() = responsavel_id
    OR auth.uid() = created_by
    OR public.is_admin(auth.uid())
    OR public.is_module_admin(auth.uid(), 'compras')
    OR public.is_module_admin(auth.uid(), 'estoque')
  );

CREATE POLICY "compras_delete_owner_or_admin" ON public.compras
  FOR DELETE TO authenticated
  USING (
    auth.uid() = responsavel_id
    OR auth.uid() = created_by
    OR public.is_admin(auth.uid())
    OR public.is_module_admin(auth.uid(), 'compras')
    OR public.is_module_admin(auth.uid(), 'estoque')
  );
