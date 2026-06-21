-- Normalizar NULLs em comercial_vendas
UPDATE public.comercial_vendas SET nome_evento   = ''            WHERE nome_evento   IS NULL;
UPDATE public.comercial_vendas SET data_evento   = '1900-01-01'  WHERE data_evento   IS NULL;
UPDATE public.comercial_vendas SET data_registro = '1900-01-01'  WHERE data_registro IS NULL;

-- Remover duplicatas
DELETE FROM public.comercial_vendas a
USING public.comercial_vendas b
WHERE a.ctid < b.ctid
  AND a.nome_evento   = b.nome_evento
  AND a.data_evento   = b.data_evento
  AND a.data_registro = b.data_registro;

ALTER TABLE public.comercial_vendas
  DROP CONSTRAINT IF EXISTS comercial_vendas_chave_unica;
ALTER TABLE public.comercial_vendas
  ADD CONSTRAINT comercial_vendas_chave_unica
  UNIQUE (nome_evento, data_evento, data_registro);

-- Catálogo
CREATE TABLE IF NOT EXISTS public.comercial_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo_medida text NOT NULL DEFAULT 'unidade',
  valor_unitario numeric NOT NULL DEFAULT 0,
  unidade text DEFAULT 'un',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comercial_catalogo TO authenticated;
GRANT ALL ON public.comercial_catalogo TO service_role;

ALTER TABLE public.comercial_catalogo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comercial_catalogo read"  ON public.comercial_catalogo;
DROP POLICY IF EXISTS "comercial_catalogo write" ON public.comercial_catalogo;

CREATE POLICY "comercial_catalogo read"
  ON public.comercial_catalogo FOR SELECT TO authenticated
  USING (has_module_access(auth.uid(), 'comercial'));

CREATE POLICY "comercial_catalogo write"
  ON public.comercial_catalogo FOR ALL TO authenticated
  USING (has_module_access(auth.uid(), 'comercial'))
  WITH CHECK (has_module_access(auth.uid(), 'comercial'));