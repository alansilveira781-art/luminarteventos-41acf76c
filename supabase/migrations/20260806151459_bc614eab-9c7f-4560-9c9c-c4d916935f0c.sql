ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS prazo date;
ALTER TABLE public.demandas ADD COLUMN IF NOT EXISTS prazo date;