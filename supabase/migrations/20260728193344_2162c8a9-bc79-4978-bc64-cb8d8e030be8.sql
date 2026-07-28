CREATE TABLE public.juridico_solicitantes (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

GRANT SELECT ON public.juridico_solicitantes TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.juridico_solicitantes TO authenticated;
GRANT ALL ON public.juridico_solicitantes TO service_role;

ALTER TABLE public.juridico_solicitantes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "juridico_solicitantes read" ON public.juridico_solicitantes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "juridico_solicitantes manage" ON public.juridico_solicitantes
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'juridico'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'juridico'));

CREATE TRIGGER juridico_solicitantes_updated_at
  BEFORE UPDATE ON public.juridico_solicitantes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.pode_solicitar_contrato(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin(_user_id)
      OR public.is_module_admin(_user_id, 'juridico')
      OR EXISTS (
        SELECT 1 FROM public.juridico_solicitantes s
        WHERE s.user_id = _user_id AND s.ativo = true
      )
$$;

CREATE POLICY "juridico_contratos solicitante insert" ON public.juridico_contratos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.pode_solicitar_contrato(auth.uid())
    AND created_by = auth.uid()
    AND status = 'entrada'
  );

CREATE POLICY "juridico_contratos solicitante read own" ON public.juridico_contratos
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() AND public.pode_solicitar_contrato(auth.uid()));