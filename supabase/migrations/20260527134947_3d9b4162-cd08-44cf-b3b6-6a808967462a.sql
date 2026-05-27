ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS responsavel_id UUID, ADD COLUMN IF NOT EXISTS responsavel_nome TEXT;
ALTER TABLE public.notificacoes ADD COLUMN IF NOT EXISTS concluida BOOLEAN NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS concluida_em TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_notificacoes_user_created ON public.notificacoes(user_id, created_at DESC);