ALTER TABLE public.juridico_contratos
  ADD COLUMN IF NOT EXISTS evento_local text,
  ADD COLUMN IF NOT EXISTS proposta_numero_manual text;