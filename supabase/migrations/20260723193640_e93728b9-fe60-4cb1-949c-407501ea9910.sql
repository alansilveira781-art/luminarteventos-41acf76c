
-- =========================
-- compras
-- =========================
ALTER TABLE public.compras
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'link'
    CHECK (origem IN ('link','operacao','interno')),
  ADD COLUMN IF NOT EXISTS op_ordem_id uuid REFERENCES public.op_ordens(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS aprovacao_operacao text
    CHECK (aprovacao_operacao IN ('pendente','aprovada','recusada')),
  ADD COLUMN IF NOT EXISTS aprovacao_operacao_motivo text,
  ADD COLUMN IF NOT EXISTS aprovacao_operacao_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS aprovacao_operacao_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_compras_origem ON public.compras(origem);
CREATE INDEX IF NOT EXISTS idx_compras_aprov_op ON public.compras(aprovacao_operacao);
CREATE INDEX IF NOT EXISTS idx_compras_op_ordem ON public.compras(op_ordem_id);

-- =========================
-- demandas
-- =========================
ALTER TABLE public.demandas
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'link'
    CHECK (origem IN ('link','operacao','interno')),
  ADD COLUMN IF NOT EXISTS op_ordem_id uuid REFERENCES public.op_ordens(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS aprovacao_operacao text
    CHECK (aprovacao_operacao IN ('pendente','aprovada','recusada')),
  ADD COLUMN IF NOT EXISTS aprovacao_operacao_motivo text,
  ADD COLUMN IF NOT EXISTS aprovacao_operacao_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS aprovacao_operacao_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_demandas_origem ON public.demandas(origem);
CREATE INDEX IF NOT EXISTS idx_demandas_aprov_op ON public.demandas(aprovacao_operacao);
CREATE INDEX IF NOT EXISTS idx_demandas_op_ordem ON public.demandas(op_ordem_id);
