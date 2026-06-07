CREATE TABLE public.ca_lancamento_rateios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lancamento_external_id text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('pagar','receber')),
  centro_custo_external_id text,
  categoria_external_id text,
  valor numeric NOT NULL,
  percentual numeric,
  ordem int NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lancamento_external_id, tipo, ordem)
);

GRANT SELECT ON public.ca_lancamento_rateios TO authenticated;
GRANT ALL ON public.ca_lancamento_rateios TO service_role;

ALTER TABLE public.ca_lancamento_rateios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ca_lancamento_rateios read for financeiro"
  ON public.ca_lancamento_rateios
  FOR SELECT
  TO authenticated
  USING (public.has_module_access(auth.uid(), 'financeiro'));

CREATE INDEX idx_ca_rateios_centro ON public.ca_lancamento_rateios (centro_custo_external_id);
CREATE INDEX idx_ca_rateios_categoria ON public.ca_lancamento_rateios (categoria_external_id);
CREATE INDEX idx_ca_rateios_lanc ON public.ca_lancamento_rateios (lancamento_external_id, tipo);