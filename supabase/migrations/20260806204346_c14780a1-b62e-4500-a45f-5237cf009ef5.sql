ALTER TABLE public.juridico_contratos
  ADD COLUMN IF NOT EXISTS montagem_inicio date,
  ADD COLUMN IF NOT EXISTS montagem_fim date,
  ADD COLUMN IF NOT EXISTS desmontagem_inicio date,
  ADD COLUMN IF NOT EXISTS desmontagem_fim date,
  ADD COLUMN IF NOT EXISTS montagem_hora_inicio time,
  ADD COLUMN IF NOT EXISTS montagem_hora_fim time,
  ADD COLUMN IF NOT EXISTS desmontagem_hora_inicio time,
  ADD COLUMN IF NOT EXISTS desmontagem_hora_fim time;