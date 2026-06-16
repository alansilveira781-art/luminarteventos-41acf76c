
-- juridico_contratos: split into read-for-module + write-for-admins
DROP POLICY IF EXISTS "juridico module access" ON public.juridico_contratos;

CREATE POLICY "juridico_contratos read"
  ON public.juridico_contratos
  FOR SELECT
  TO authenticated
  USING (has_module_access(auth.uid(), 'juridico'::text));

CREATE POLICY "juridico_contratos admin write"
  ON public.juridico_contratos
  FOR INSERT
  TO authenticated
  WITH CHECK (is_module_admin(auth.uid(), 'juridico'::text) OR is_admin(auth.uid()));

CREATE POLICY "juridico_contratos admin update"
  ON public.juridico_contratos
  FOR UPDATE
  TO authenticated
  USING (is_module_admin(auth.uid(), 'juridico'::text) OR is_admin(auth.uid()))
  WITH CHECK (is_module_admin(auth.uid(), 'juridico'::text) OR is_admin(auth.uid()));

CREATE POLICY "juridico_contratos admin delete"
  ON public.juridico_contratos
  FOR DELETE
  TO authenticated
  USING (is_module_admin(auth.uid(), 'juridico'::text) OR is_admin(auth.uid()));

-- rh_vagas: split into read-for-module + write-for-admins
DROP POLICY IF EXISTS "rh module access" ON public.rh_vagas;

CREATE POLICY "rh_vagas read"
  ON public.rh_vagas
  FOR SELECT
  TO authenticated
  USING (has_module_access(auth.uid(), 'rh'::text));

CREATE POLICY "rh_vagas admin write"
  ON public.rh_vagas
  FOR INSERT
  TO authenticated
  WITH CHECK (is_module_admin(auth.uid(), 'rh'::text) OR is_admin(auth.uid()));

CREATE POLICY "rh_vagas admin update"
  ON public.rh_vagas
  FOR UPDATE
  TO authenticated
  USING (is_module_admin(auth.uid(), 'rh'::text) OR is_admin(auth.uid()))
  WITH CHECK (is_module_admin(auth.uid(), 'rh'::text) OR is_admin(auth.uid()));

CREATE POLICY "rh_vagas admin delete"
  ON public.rh_vagas
  FOR DELETE
  TO authenticated
  USING (is_module_admin(auth.uid(), 'rh'::text) OR is_admin(auth.uid()));
