
CREATE TABLE IF NOT EXISTS public.comercial_classificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comercial_classificacoes TO authenticated;
GRANT ALL ON public.comercial_classificacoes TO service_role;

ALTER TABLE public.comercial_classificacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cc_select" ON public.comercial_classificacoes;
CREATE POLICY "cc_select" ON public.comercial_classificacoes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "cc_insert" ON public.comercial_classificacoes;
CREATE POLICY "cc_insert" ON public.comercial_classificacoes
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "cc_delete" ON public.comercial_classificacoes;
CREATE POLICY "cc_delete" ON public.comercial_classificacoes
  FOR DELETE TO authenticated USING (true);

INSERT INTO public.comercial_classificacoes (nome)
VALUES ('Cenografia'), ('Social'), ('Stand'), ('Corporativo')
ON CONFLICT (nome) DO NOTHING;

CREATE UNIQUE INDEX IF NOT EXISTS comercial_vendedores_nome_uk   ON public.comercial_vendedores (nome);
CREATE UNIQUE INDEX IF NOT EXISTS comercial_cerimoniais_nome_uk  ON public.comercial_cerimoniais (nome);
CREATE UNIQUE INDEX IF NOT EXISTS comercial_decoradores_nome_uk  ON public.comercial_decoradores (nome);
