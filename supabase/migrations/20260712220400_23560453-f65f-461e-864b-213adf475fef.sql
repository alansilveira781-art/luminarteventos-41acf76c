
ALTER TABLE public.demanda_itens
  ADD COLUMN IF NOT EXISTS recebido boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recebido_em timestamptz;

CREATE TABLE IF NOT EXISTS public.demanda_patrimonio_registros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demanda_id uuid NOT NULL REFERENCES public.demandas(id) ON DELETE CASCADE,
  pat_item_id uuid NOT NULL REFERENCES public.pat_itens(id) ON DELETE CASCADE,
  registrado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.demanda_patrimonio_registros TO authenticated;
GRANT ALL ON public.demanda_patrimonio_registros TO service_role;

ALTER TABLE public.demanda_patrimonio_registros
  DROP CONSTRAINT IF EXISTS demanda_patrimonio_registros_demanda_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS demanda_patrimonio_registros_par_uk
  ON public.demanda_patrimonio_registros (demanda_id, pat_item_id);
CREATE INDEX IF NOT EXISTS idx_dpr_demanda ON public.demanda_patrimonio_registros (demanda_id);

ALTER TABLE public.demanda_patrimonio_registros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dpr_select" ON public.demanda_patrimonio_registros;
CREATE POLICY "dpr_select" ON public.demanda_patrimonio_registros
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "dpr_insert" ON public.demanda_patrimonio_registros;
CREATE POLICY "dpr_insert" ON public.demanda_patrimonio_registros
  FOR INSERT TO authenticated WITH CHECK (true);
