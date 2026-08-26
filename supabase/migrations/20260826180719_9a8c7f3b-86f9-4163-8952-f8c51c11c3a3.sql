ALTER TABLE public.ca_lancamento_baixas
  ADD COLUMN IF NOT EXISTS valor_liquido numeric,
  ADD COLUMN IF NOT EXISTS taxa numeric;