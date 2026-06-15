
DROP POLICY IF EXISTS "Authenticated can read vendas" ON public.comercial_vendas;
DROP POLICY IF EXISTS "Authenticated can write vendas" ON public.comercial_vendas;

CREATE POLICY "Comercial can read vendas"
  ON public.comercial_vendas FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'comercial'));

CREATE POLICY "Comercial can write vendas"
  ON public.comercial_vendas FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(), 'comercial'))
  WITH CHECK (public.has_module_access(auth.uid(), 'comercial'));

DROP POLICY IF EXISTS "Authenticated can read sync log" ON public.comercial_vendas_sync;
DROP POLICY IF EXISTS "Authenticated can insert sync log" ON public.comercial_vendas_sync;
DROP POLICY IF EXISTS "Authenticated can update sync log" ON public.comercial_vendas_sync;

CREATE POLICY "Comercial can read sync log"
  ON public.comercial_vendas_sync FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'comercial'));

CREATE POLICY "Comercial can insert sync log"
  ON public.comercial_vendas_sync FOR INSERT TO authenticated
  WITH CHECK (public.has_module_access(auth.uid(), 'comercial'));

CREATE POLICY "Comercial can update sync log"
  ON public.comercial_vendas_sync FOR UPDATE TO authenticated
  USING (public.has_module_access(auth.uid(), 'comercial'))
  WITH CHECK (public.has_module_access(auth.uid(), 'comercial'));
