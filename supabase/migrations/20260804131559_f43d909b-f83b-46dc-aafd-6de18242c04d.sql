CREATE TABLE public.op_ordem_setores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ordem_id uuid NOT NULL REFERENCES public.op_ordens(id) ON DELETE CASCADE,
  setor_id uuid NOT NULL REFERENCES public.op_setores(id) ON DELETE CASCADE,
  posicao integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente',
  iniciado_em timestamptz,
  concluido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ordem_id, setor_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.op_ordem_setores TO authenticated;
GRANT ALL ON public.op_ordem_setores TO service_role;
ALTER TABLE public.op_ordem_setores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "op_ordem_setores_select" ON public.op_ordem_setores
  FOR SELECT TO authenticated USING (has_module_access(auth.uid(), 'operacao'));
CREATE POLICY "op_ordem_setores_insert" ON public.op_ordem_setores
  FOR INSERT TO authenticated WITH CHECK (has_module_access(auth.uid(), 'operacao'));
CREATE POLICY "op_ordem_setores_update" ON public.op_ordem_setores
  FOR UPDATE TO authenticated USING (has_module_access(auth.uid(), 'operacao'))
  WITH CHECK (has_module_access(auth.uid(), 'operacao'));
CREATE POLICY "op_ordem_setores_delete" ON public.op_ordem_setores
  FOR DELETE TO authenticated USING (is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'operacao'));

CREATE TABLE public.op_ordem_checklist (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ordem_id uuid NOT NULL REFERENCES public.op_ordens(id) ON DELETE CASCADE,
  setor_id uuid NOT NULL REFERENCES public.op_setores(id) ON DELETE CASCADE,
  etapa_id uuid REFERENCES public.op_setor_etapas(id) ON DELETE SET NULL,
  nome text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  concluido boolean NOT NULL DEFAULT false,
  concluido_por uuid,
  concluido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.op_ordem_checklist TO authenticated;
GRANT ALL ON public.op_ordem_checklist TO service_role;
ALTER TABLE public.op_ordem_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "op_ordem_checklist_select" ON public.op_ordem_checklist
  FOR SELECT TO authenticated USING (has_module_access(auth.uid(), 'operacao'));
CREATE POLICY "op_ordem_checklist_insert" ON public.op_ordem_checklist
  FOR INSERT TO authenticated WITH CHECK (has_module_access(auth.uid(), 'operacao'));
CREATE POLICY "op_ordem_checklist_update" ON public.op_ordem_checklist
  FOR UPDATE TO authenticated USING (has_module_access(auth.uid(), 'operacao'))
  WITH CHECK (has_module_access(auth.uid(), 'operacao'));
CREATE POLICY "op_ordem_checklist_delete" ON public.op_ordem_checklist
  FOR DELETE TO authenticated USING (is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'operacao'));

CREATE INDEX idx_op_ordem_setores_ordem ON public.op_ordem_setores(ordem_id);
CREATE INDEX idx_op_ordem_checklist_ordem ON public.op_ordem_checklist(ordem_id, setor_id);

ALTER TABLE public.op_ordens ADD COLUMN IF NOT EXISTS data_inicio date;

CREATE TRIGGER op_ordem_setores_updated_at BEFORE UPDATE ON public.op_ordem_setores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER op_ordem_checklist_updated_at BEFORE UPDATE ON public.op_ordem_checklist
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();