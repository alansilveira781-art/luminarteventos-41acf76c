ALTER TABLE public.compras  ADD COLUMN IF NOT EXISTS tem_nf boolean NOT NULL DEFAULT true;
ALTER TABLE public.demandas ADD COLUMN IF NOT EXISTS tem_nf boolean NOT NULL DEFAULT true;
ALTER TABLE public.demandas ADD COLUMN IF NOT EXISTS numero_nf text;