
CREATE TABLE public.comercial_metas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano int NOT NULL,
  mes int NOT NULL CHECK (mes BETWEEN 1 AND 12),
  classificacao text NOT NULL,
  valor_meta numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ano, mes, classificacao)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comercial_metas TO authenticated;
GRANT ALL ON public.comercial_metas TO service_role;

ALTER TABLE public.comercial_metas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comercial pode ler metas"
  ON public.comercial_metas FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'comercial'));

CREATE POLICY "admin comercial gerencia metas"
  ON public.comercial_metas FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'comercial'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'comercial'));

CREATE TRIGGER set_updated_at_comercial_metas
  BEFORE UPDATE ON public.comercial_metas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
