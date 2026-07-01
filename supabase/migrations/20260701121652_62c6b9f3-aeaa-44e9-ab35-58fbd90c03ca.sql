CREATE TABLE IF NOT EXISTS public.demanda_patrimonio_registros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demanda_id uuid NOT NULL REFERENCES public.demandas(id) ON DELETE CASCADE,
  pat_item_id uuid REFERENCES public.pat_itens(id) ON DELETE SET NULL,
  registrado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  registrado_em timestamptz NOT NULL DEFAULT now(),
  observacoes text,
  UNIQUE(demanda_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.demanda_patrimonio_registros TO authenticated;
GRANT ALL ON public.demanda_patrimonio_registros TO service_role;

CREATE INDEX IF NOT EXISTS idx_demanda_patrimonio_demanda ON public.demanda_patrimonio_registros(demanda_id);

ALTER TABLE public.demanda_patrimonio_registros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patrimonio registros all"
  ON public.demanda_patrimonio_registros FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(), 'patrimonio'))
  WITH CHECK (public.has_module_access(auth.uid(), 'patrimonio'));

CREATE POLICY "financeiro registros read"
  ON public.demanda_patrimonio_registros FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'financeiro'));

CREATE POLICY "patrimonio read demandas imobilizado"
  ON public.demandas FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'patrimonio') AND tipo_demanda = 'imobilizado');
