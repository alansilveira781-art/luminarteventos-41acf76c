CREATE TABLE public.uber_corridas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_solicitacao DATE NOT NULL,
  hora_solicitacao TEXT,
  nome TEXT,
  sobrenome TEXT,
  servico TEXT,
  cidade TEXT,
  endereco_partida TEXT,
  endereco_destino TEXT,
  valor NUMERIC NOT NULL DEFAULT 0,
  hash_dedup TEXT UNIQUE,
  importado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  importado_por UUID REFERENCES auth.users(id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.uber_corridas TO authenticated;
GRANT ALL ON public.uber_corridas TO service_role;

ALTER TABLE public.uber_corridas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uber_corridas_select" ON public.uber_corridas FOR SELECT TO authenticated USING (true);
CREATE POLICY "uber_corridas_insert" ON public.uber_corridas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "uber_corridas_update" ON public.uber_corridas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "uber_corridas_delete" ON public.uber_corridas FOR DELETE TO authenticated USING (true);

CREATE INDEX uber_corridas_data_idx ON public.uber_corridas (data_solicitacao);