DROP POLICY IF EXISTS "juridico_contratos read" ON public.juridico_contratos;
CREATE POLICY "juridico_contratos read" ON public.juridico_contratos
FOR SELECT TO authenticated
USING (public.has_module_access(auth.uid(), 'juridico'));

DROP POLICY IF EXISTS "juridico_contratos update" ON public.juridico_contratos;
CREATE POLICY "juridico_contratos update" ON public.juridico_contratos
FOR UPDATE TO authenticated
USING (public.has_module_access(auth.uid(), 'juridico'))
WITH CHECK (public.has_module_access(auth.uid(), 'juridico'));