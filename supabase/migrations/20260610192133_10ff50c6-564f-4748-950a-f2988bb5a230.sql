ALTER TABLE public.comercial_vendas
  ADD COLUMN IF NOT EXISTS status_bv_rt text,
  ADD COLUMN IF NOT EXISTS cont_cerimonial integer,
  ADD COLUMN IF NOT EXISTS cont_decorador integer;