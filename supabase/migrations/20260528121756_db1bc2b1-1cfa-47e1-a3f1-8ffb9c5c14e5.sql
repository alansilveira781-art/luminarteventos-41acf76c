
ALTER TABLE public.eventos_projetos
  ADD COLUMN IF NOT EXISTS codigo TEXT,
  ADD COLUMN IF NOT EXISTS data_inicio DATE,
  ADD COLUMN IF NOT EXISTS data_fim DATE,
  ADD COLUMN IF NOT EXISTS local TEXT,
  ADD COLUMN IF NOT EXISTS uf TEXT,
  ADD COLUMN IF NOT EXISTS produtor TEXT,
  ADD COLUMN IF NOT EXISTS montagem_inicio DATE,
  ADD COLUMN IF NOT EXISTS montagem_fim DATE,
  ADD COLUMN IF NOT EXISTS desmontagem_inicio DATE,
  ADD COLUMN IF NOT EXISTS desmontagem_fim DATE,
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_eventos_projetos_data_inicio ON public.eventos_projetos(data_inicio);
