ALTER TABLE public.juridico_contratos
  ADD COLUMN IF NOT EXISTS evento_inicio date,
  ADD COLUMN IF NOT EXISTS evento_fim date,
  ADD COLUMN IF NOT EXISTS evento_hora_inicio time without time zone,
  ADD COLUMN IF NOT EXISTS evento_hora_fim time without time zone;