CREATE TABLE public.ca_lancamento_baixas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('pagar', 'receber')),
  lancamento_external_id text NOT NULL,
  baixa_external_id text NOT NULL,
  data_baixa date NOT NULL,
  valor numeric(15,2) NOT NULL CHECK (valor >= 0),
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tipo, lancamento_external_id, baixa_external_id)
);

GRANT SELECT ON public.ca_lancamento_baixas TO authenticated;
GRANT ALL ON public.ca_lancamento_baixas TO service_role;

ALTER TABLE public.ca_lancamento_baixas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Financeiro pode visualizar baixas"
ON public.ca_lancamento_baixas
FOR SELECT
TO authenticated
USING (public.has_module_access(auth.uid(), 'financeiro'));

CREATE INDEX idx_ca_lancamento_baixas_tipo_data
ON public.ca_lancamento_baixas (tipo, data_baixa);

CREATE INDEX idx_ca_lancamento_baixas_lancamento
ON public.ca_lancamento_baixas (tipo, lancamento_external_id);

CREATE TRIGGER set_ca_lancamento_baixas_updated_at
BEFORE UPDATE ON public.ca_lancamento_baixas
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();