
-- 1) Deduplicate existing rows (keep oldest by ctid)
DELETE FROM public.financeiro_rotina_execucoes a
USING public.financeiro_rotina_execucoes b
WHERE a.rotina_id = b.rotina_id
  AND a.data_referencia = b.data_referencia
  AND a.ctid > b.ctid;

-- 2) Unique constraint to prevent duplicates
ALTER TABLE public.financeiro_rotina_execucoes
  DROP CONSTRAINT IF EXISTS uq_rotina_execucao_data;
ALTER TABLE public.financeiro_rotina_execucoes
  ADD CONSTRAINT uq_rotina_execucao_data UNIQUE (rotina_id, data_referencia);

-- 3) Attach the existing avancar_rotina_apos_execucao trigger
DROP TRIGGER IF EXISTS trg_avancar_rotina ON public.financeiro_rotina_execucoes;
CREATE TRIGGER trg_avancar_rotina
  AFTER INSERT ON public.financeiro_rotina_execucoes
  FOR EACH ROW EXECUTE FUNCTION public.avancar_rotina_apos_execucao();
