
-- 1) Novos campos em compras e demandas
ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS status_financeiro text;
ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS financeiro_ordem numeric;
ALTER TABLE public.demandas ADD COLUMN IF NOT EXISTS status_financeiro text;
ALTER TABLE public.demandas ADD COLUMN IF NOT EXISTS financeiro_ordem numeric;

-- Trigger: quando status='finalizado' e status_financeiro é NULL, seta 'caixa_entrada'
CREATE OR REPLACE FUNCTION public.set_status_financeiro_on_finalizado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status::text = 'finalizado' AND NEW.status_financeiro IS NULL THEN
    NEW.status_financeiro := 'caixa_entrada';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compras_status_financeiro ON public.compras;
CREATE TRIGGER trg_compras_status_financeiro
  BEFORE INSERT OR UPDATE OF status ON public.compras
  FOR EACH ROW EXECUTE FUNCTION public.set_status_financeiro_on_finalizado();

DROP TRIGGER IF EXISTS trg_demandas_status_financeiro ON public.demandas;
CREATE TRIGGER trg_demandas_status_financeiro
  BEFORE INSERT OR UPDATE OF status ON public.demandas
  FOR EACH ROW EXECUTE FUNCTION public.set_status_financeiro_on_finalizado();

-- Backfill: compras/demandas já finalizadas entram na caixa de entrada
UPDATE public.compras SET status_financeiro = 'caixa_entrada'
  WHERE status::text = 'finalizado' AND status_financeiro IS NULL;
UPDATE public.demandas SET status_financeiro = 'caixa_entrada'
  WHERE status::text = 'finalizado' AND status_financeiro IS NULL;

-- Política adicional: usuários com módulo financeiro_op podem atualizar compras/demandas
-- (necessário para mover cards no Quadro Financeiro)
DROP POLICY IF EXISTS "financeiro_op pode atualizar compras" ON public.compras;
CREATE POLICY "financeiro_op pode atualizar compras" ON public.compras
  FOR UPDATE TO authenticated
  USING (public.has_module_access(auth.uid(), 'financeiro_op'))
  WITH CHECK (public.has_module_access(auth.uid(), 'financeiro_op'));

DROP POLICY IF EXISTS "financeiro_op pode atualizar demandas" ON public.demandas;
CREATE POLICY "financeiro_op pode atualizar demandas" ON public.demandas
  FOR UPDATE TO authenticated
  USING (public.has_module_access(auth.uid(), 'financeiro_op'))
  WITH CHECK (public.has_module_access(auth.uid(), 'financeiro_op'));

-- 2) Produtores para módulo Eventos
CREATE TABLE IF NOT EXISTS public.produtores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.produtores TO authenticated;
GRANT ALL ON public.produtores TO service_role;

ALTER TABLE public.produtores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "eventos gerencia produtores" ON public.produtores;
CREATE POLICY "eventos gerencia produtores" ON public.produtores
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'eventos'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'eventos'));

ALTER TABLE public.eventos
  ADD COLUMN IF NOT EXISTS produtor_id uuid REFERENCES public.produtores(id) ON DELETE SET NULL;
