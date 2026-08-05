ALTER TABLE public.comercial_bonificacao_producao
  ADD COLUMN IF NOT EXISTS evento_id uuid REFERENCES public.eventos(id) ON DELETE CASCADE;

ALTER TABLE public.comercial_bonificacao_fechamento_itens
  ADD COLUMN IF NOT EXISTS evento_id uuid;

ALTER TABLE public.comercial_bonificacao_producao ALTER COLUMN venda_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS comercial_bonif_evento_produtor_uidx
  ON public.comercial_bonificacao_producao (evento_id, produtor_id)
  WHERE evento_id IS NOT NULL AND produtor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS comercial_bonif_evento_idx
  ON public.comercial_bonificacao_producao (evento_id);