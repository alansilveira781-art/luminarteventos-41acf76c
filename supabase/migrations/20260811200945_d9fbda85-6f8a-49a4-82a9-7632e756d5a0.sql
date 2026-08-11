CREATE TABLE public.diarista_fechamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_inicio date NOT NULL,
  periodo_fim date NOT NULL,
  filtros jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_dias integer NOT NULL DEFAULT 0,
  total_minutos integer NOT NULL DEFAULT 0,
  total_valor numeric NOT NULL DEFAULT 0,
  data_pagamento date NOT NULL DEFAULT current_date,
  observacao text,
  created_by uuid REFERENCES auth.users,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.diarista_fechamentos TO authenticated;
GRANT ALL ON public.diarista_fechamentos TO service_role;

ALTER TABLE public.diarista_fechamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Financeiro le fechamentos" ON public.diarista_fechamentos
  FOR SELECT TO authenticated
  USING (has_module_access(auth.uid(), 'financeiro'));

CREATE POLICY "Admin financeiro cria fechamentos" ON public.diarista_fechamentos
  FOR INSERT TO authenticated
  WITH CHECK ((is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'financeiro')) AND created_by = auth.uid());

CREATE POLICY "Admin financeiro edita fechamentos" ON public.diarista_fechamentos
  FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'financeiro'))
  WITH CHECK (is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'financeiro'));

CREATE POLICY "Admin financeiro exclui fechamentos" ON public.diarista_fechamentos
  FOR DELETE TO authenticated
  USING (is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'financeiro'));

CREATE TRIGGER diarista_fechamentos_updated_at
  BEFORE UPDATE ON public.diarista_fechamentos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.diarista_apontamentos
  ADD COLUMN fechamento_id uuid REFERENCES public.diarista_fechamentos(id) ON DELETE SET NULL;

CREATE INDEX idx_diarista_apontamentos_fechamento ON public.diarista_apontamentos(fechamento_id);

DROP POLICY "Financeiro pode gerenciar apontamentos" ON public.diarista_apontamentos;
DROP POLICY "Lancador gerencia proprios apontamentos" ON public.diarista_apontamentos;

CREATE POLICY "Financeiro le apontamentos" ON public.diarista_apontamentos
  FOR SELECT TO authenticated
  USING (has_module_access(auth.uid(), 'financeiro'));

CREATE POLICY "Financeiro cria apontamentos" ON public.diarista_apontamentos
  FOR INSERT TO authenticated
  WITH CHECK (has_module_access(auth.uid(), 'financeiro'));

CREATE POLICY "Financeiro edita apontamentos" ON public.diarista_apontamentos
  FOR UPDATE TO authenticated
  USING (has_module_access(auth.uid(), 'financeiro')
    AND (fechamento_id IS NULL OR is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'financeiro')))
  WITH CHECK (has_module_access(auth.uid(), 'financeiro')
    AND (fechamento_id IS NULL OR is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'financeiro')));

CREATE POLICY "Financeiro exclui apontamentos" ON public.diarista_apontamentos
  FOR DELETE TO authenticated
  USING (has_module_access(auth.uid(), 'financeiro')
    AND (fechamento_id IS NULL OR is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'financeiro')));

CREATE POLICY "Lancador le proprios apontamentos" ON public.diarista_apontamentos
  FOR SELECT TO authenticated
  USING (pode_lancar_diaria(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Lancador cria proprios apontamentos" ON public.diarista_apontamentos
  FOR INSERT TO authenticated
  WITH CHECK (pode_lancar_diaria(auth.uid()) AND created_by = auth.uid() AND fechamento_id IS NULL);

CREATE POLICY "Lancador edita proprios apontamentos" ON public.diarista_apontamentos
  FOR UPDATE TO authenticated
  USING (pode_lancar_diaria(auth.uid()) AND created_by = auth.uid() AND fechamento_id IS NULL)
  WITH CHECK (pode_lancar_diaria(auth.uid()) AND created_by = auth.uid() AND fechamento_id IS NULL);

CREATE POLICY "Lancador exclui proprios apontamentos" ON public.diarista_apontamentos
  FOR DELETE TO authenticated
  USING (pode_lancar_diaria(auth.uid()) AND created_by = auth.uid() AND fechamento_id IS NULL);