ALTER TABLE public.ca_contas_pagar ADD COLUMN IF NOT EXISTS detalhe_synced_at timestamptz;
ALTER TABLE public.ca_contas_receber ADD COLUMN IF NOT EXISTS detalhe_synced_at timestamptz;
CREATE INDEX IF NOT EXISTS ca_contas_pagar_detalhe_synced_at_idx ON public.ca_contas_pagar (detalhe_synced_at);
CREATE INDEX IF NOT EXISTS ca_contas_receber_detalhe_synced_at_idx ON public.ca_contas_receber (detalhe_synced_at);