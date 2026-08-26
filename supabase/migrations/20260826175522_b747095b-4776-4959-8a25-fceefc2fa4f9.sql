ALTER TABLE public.ca_lancamento_baixas
  ADD COLUMN IF NOT EXISTS conta_bancaria text,
  ADD COLUMN IF NOT EXISTS conta_bancaria_external_id text;
CREATE INDEX IF NOT EXISTS idx_ca_lancamento_baixas_conta ON public.ca_lancamento_baixas (conta_bancaria);