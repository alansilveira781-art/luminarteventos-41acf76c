ALTER TABLE public.movimentacoes ADD COLUMN IF NOT EXISTS evento_projeto TEXT;
CREATE INDEX IF NOT EXISTS idx_mov_data ON public.movimentacoes(data_movimento);
CREATE INDEX IF NOT EXISTS idx_mov_tipo ON public.movimentacoes(tipo);
CREATE INDEX IF NOT EXISTS idx_mov_evento ON public.movimentacoes(evento_projeto);