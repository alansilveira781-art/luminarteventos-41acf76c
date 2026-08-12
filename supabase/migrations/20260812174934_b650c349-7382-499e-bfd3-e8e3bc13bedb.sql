ALTER TABLE public.diarista_apontamentos
  ADD COLUMN IF NOT EXISTS empeleita boolean NOT NULL DEFAULT false;

ALTER TABLE public.diarista_apontamento_eventos
  ADD COLUMN IF NOT EXISTS bloco integer NOT NULL DEFAULT 0;

UPDATE public.diarista_apontamento_eventos SET bloco = ordem WHERE bloco = 0;