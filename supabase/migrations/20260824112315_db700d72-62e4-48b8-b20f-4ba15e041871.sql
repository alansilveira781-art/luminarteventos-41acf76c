DROP POLICY IF EXISTS "compras_status_defaults read" ON public.compras_status_defaults;
CREATE POLICY "compras_status_defaults read" ON public.compras_status_defaults
FOR SELECT TO authenticated
USING (has_module_access(auth.uid(), 'compras'::text));