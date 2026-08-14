ALTER TABLE public.lembretes_tarefas
  ADD COLUMN IF NOT EXISTS serie_id uuid,
  ADD COLUMN IF NOT EXISTS recorrencia_intervalo integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS recorrencia_fim date,
  ADD COLUMN IF NOT EXISTS recorrencia_qtd integer;

CREATE INDEX IF NOT EXISTS lembretes_tarefas_user_serie_idx
  ON public.lembretes_tarefas (user_id, serie_id);