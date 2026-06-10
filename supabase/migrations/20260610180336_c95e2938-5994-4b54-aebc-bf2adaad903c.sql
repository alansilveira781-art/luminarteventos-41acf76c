
CREATE TABLE IF NOT EXISTS public.comercial_vendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_evento text,
  data_registro date,
  data_evento date,
  ano int,
  mes text,
  semana int,
  mes_evento text,
  ano_evento int,
  trimestre_evento smallint,
  tipo text,
  tipo_evento text,
  classificacao text,
  empresa text,
  local text,
  estado text,
  cidade text,
  salao text,
  consultor text,
  gestor text,
  cerimonial text,
  decorador text,
  quantidade numeric DEFAULT 0,
  valor_proposta numeric DEFAULT 0,
  desconto numeric DEFAULT 0,
  percentual numeric DEFAULT 0,
  valor_final numeric DEFAULT 0,
  valor_bv numeric DEFAULT 0,
  comissao_gestor numeric DEFAULT 0,
  tipo_comissao text,
  comissao_consultor numeric DEFAULT 0,
  source text NOT NULL DEFAULT 'dropbox',
  row_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Chave única para upsert (nome + data do evento). COALESCE para tratar nulos.
CREATE UNIQUE INDEX IF NOT EXISTS comercial_vendas_uniq
  ON public.comercial_vendas (
    COALESCE(lower(nome_evento), ''),
    COALESCE(data_evento, '1900-01-01'::date),
    COALESCE(data_registro, '1900-01-01'::date)
  );

CREATE INDEX IF NOT EXISTS comercial_vendas_ano_evento_idx ON public.comercial_vendas(ano_evento);
CREATE INDEX IF NOT EXISTS comercial_vendas_consultor_idx ON public.comercial_vendas(consultor);
CREATE INDEX IF NOT EXISTS comercial_vendas_empresa_idx ON public.comercial_vendas(empresa);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comercial_vendas TO authenticated;
GRANT ALL ON public.comercial_vendas TO service_role;

ALTER TABLE public.comercial_vendas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read vendas"
  ON public.comercial_vendas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can write vendas"
  ON public.comercial_vendas FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_comercial_vendas_updated
  BEFORE UPDATE ON public.comercial_vendas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Histórico de sincronizações
CREATE TABLE IF NOT EXISTS public.comercial_vendas_sync (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  source text NOT NULL,
  rows_total int DEFAULT 0,
  rows_inserted int DEFAULT 0,
  rows_updated int DEFAULT 0,
  status text NOT NULL DEFAULT 'running',
  error text,
  created_by uuid
);

CREATE INDEX IF NOT EXISTS comercial_vendas_sync_started_idx
  ON public.comercial_vendas_sync(started_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.comercial_vendas_sync TO authenticated;
GRANT ALL ON public.comercial_vendas_sync TO service_role;

ALTER TABLE public.comercial_vendas_sync ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read sync log"
  ON public.comercial_vendas_sync FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert sync log"
  ON public.comercial_vendas_sync FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update sync log"
  ON public.comercial_vendas_sync FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
