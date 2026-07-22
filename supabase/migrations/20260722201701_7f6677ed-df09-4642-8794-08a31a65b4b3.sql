
CREATE TABLE public.comercial_dashboard_permissoes (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ver_painel boolean NOT NULL DEFAULT true,
  ver_relatorio boolean NOT NULL DEFAULT true,
  ver_vendedores boolean NOT NULL DEFAULT true,
  ver_indicadores boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comercial_dashboard_permissoes TO authenticated;
GRANT ALL ON public.comercial_dashboard_permissoes TO service_role;

ALTER TABLE public.comercial_dashboard_permissoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all dashboard permissions"
  ON public.comercial_dashboard_permissoes
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read own dashboard permissions"
  ON public.comercial_dashboard_permissoes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_comercial_dashboard_permissoes_updated_at
  BEFORE UPDATE ON public.comercial_dashboard_permissoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
