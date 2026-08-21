DROP POLICY IF EXISTS "demanda_tipos_select_all" ON public.demanda_tipos;
REVOKE SELECT ON public.demanda_tipos FROM anon;
CREATE POLICY "demanda_tipos_select_auth" ON public.demanda_tipos
FOR SELECT TO authenticated USING (true);