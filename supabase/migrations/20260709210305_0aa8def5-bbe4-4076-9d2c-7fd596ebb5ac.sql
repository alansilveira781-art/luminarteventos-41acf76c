
-- 1) DELETE policies on status_defaults tables (admin-only, matching existing write policies)
DROP POLICY IF EXISTS "compras_status_defaults admin delete" ON public.compras_status_defaults;
CREATE POLICY "compras_status_defaults admin delete"
  ON public.compras_status_defaults FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'compras'));

DROP POLICY IF EXISTS "comercial_status_defaults admin delete" ON public.comercial_status_defaults;
CREATE POLICY "comercial_status_defaults admin delete"
  ON public.comercial_status_defaults FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'comercial'));

-- 2) Replace public SELECT on item-photos and pat-photos with module-scoped policies
DROP POLICY IF EXISTS "item-photos public read" ON storage.objects;
DROP POLICY IF EXISTS "item-photos module read" ON storage.objects;
CREATE POLICY "item-photos module read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'item-photos' AND public.has_module_access(auth.uid(), 'estoque'));

DROP POLICY IF EXISTS "pat-photos public read" ON storage.objects;
DROP POLICY IF EXISTS "pat-photos module read" ON storage.objects;
CREATE POLICY "pat-photos module read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'pat-photos' AND public.has_module_access(auth.uid(), 'patrimonio'));
