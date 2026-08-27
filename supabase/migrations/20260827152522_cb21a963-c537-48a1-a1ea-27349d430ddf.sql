ALTER TABLE public.lembretes_tarefas
ADD COLUMN somente_dias_uteis boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.lembretes_tarefas.somente_dias_uteis IS
'Indica que as ocorrências recorrentes devem ser geradas apenas de segunda a sexta-feira.';