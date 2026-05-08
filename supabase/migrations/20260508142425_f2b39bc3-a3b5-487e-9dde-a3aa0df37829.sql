CREATE SEQUENCE IF NOT EXISTS public.requisicao_material_seq START 1;

ALTER TABLE public.movimentacoes ADD COLUMN IF NOT EXISTS requisicao_numero INTEGER;

CREATE INDEX IF NOT EXISTS idx_movs_requisicao ON public.movimentacoes(requisicao_numero, tipo);

CREATE OR REPLACE FUNCTION public.next_requisicao_numero()
RETURNS INTEGER LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ SELECT nextval('public.requisicao_material_seq')::int $$;

-- Backfill: cada linha existente sem número recebe um próprio
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.movimentacoes WHERE requisicao_numero IS NULL ORDER BY data_movimento, created_at LOOP
    UPDATE public.movimentacoes SET requisicao_numero = nextval('public.requisicao_material_seq')::int WHERE id = r.id;
  END LOOP;
END $$;