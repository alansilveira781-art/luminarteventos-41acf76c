ALTER TABLE public.demandas ADD COLUMN IF NOT EXISTS categoria_external_id text;
CREATE INDEX IF NOT EXISTS idx_demandas_categoria_external_id ON public.demandas(categoria_external_id);