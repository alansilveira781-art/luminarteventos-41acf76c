CREATE TABLE public.contabil_tomadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  documento text,
  email text,
  telefone text,
  endereco text,
  inscricao_municipal text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX contabil_tomadores_documento_key
  ON public.contabil_tomadores (documento)
  WHERE documento IS NOT NULL AND documento <> '';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contabil_tomadores TO authenticated;
GRANT ALL ON public.contabil_tomadores TO service_role;

ALTER TABLE public.contabil_tomadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem tomadores"
  ON public.contabil_tomadores FOR SELECT TO authenticated USING (true);

CREATE POLICY "Autenticados criam tomadores"
  ON public.contabil_tomadores FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Autenticados atualizam tomadores"
  ON public.contabil_tomadores FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Autenticados excluem tomadores"
  ON public.contabil_tomadores FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE TRIGGER trg_contabil_tomadores_updated_at
  BEFORE UPDATE ON public.contabil_tomadores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();