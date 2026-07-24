
CREATE TABLE public.admin_empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social text NOT NULL,
  nome_fantasia text,
  cnpj text NOT NULL,
  inscricao_municipal text,
  inscricao_estadual text,
  endereco text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_empresas_cnpj_unique UNIQUE (cnpj)
);

CREATE INDEX admin_empresas_ativo_idx ON public.admin_empresas (ativo);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_empresas TO authenticated;
GRANT ALL ON public.admin_empresas TO service_role;

ALTER TABLE public.admin_empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_empresas leitura autenticada"
  ON public.admin_empresas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "admin_empresas escrita admin"
  ON public.admin_empresas FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'admin'));

CREATE POLICY "admin_empresas update admin"
  ON public.admin_empresas FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'admin'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'admin'));

CREATE POLICY "admin_empresas delete admin"
  ON public.admin_empresas FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'admin'));

CREATE TRIGGER admin_empresas_set_updated_at
  BEFORE UPDATE ON public.admin_empresas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.admin_empresas (razao_social, nome_fantasia, cnpj)
VALUES
  ('Luminart Eventos', 'Luminart Eventos', '00000000000001'),
  ('Luminart Planejados', 'Luminart Planejados', '00000000000002'),
  ('Luminart Tecnologia', 'Luminart Tecnologia', '00000000000003')
ON CONFLICT (cnpj) DO NOTHING;
