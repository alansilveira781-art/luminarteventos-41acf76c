
-- uber_corridas: exigir acesso ao módulo financeiro_op
DROP POLICY IF EXISTS uber_corridas_select ON public.uber_corridas;
DROP POLICY IF EXISTS uber_corridas_insert ON public.uber_corridas;
DROP POLICY IF EXISTS uber_corridas_update ON public.uber_corridas;
DROP POLICY IF EXISTS uber_corridas_delete ON public.uber_corridas;

CREATE POLICY uber_corridas_select ON public.uber_corridas
  FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'financeiro_op'));
CREATE POLICY uber_corridas_insert ON public.uber_corridas
  FOR INSERT TO authenticated
  WITH CHECK (public.has_module_access(auth.uid(), 'financeiro_op'));
CREATE POLICY uber_corridas_update ON public.uber_corridas
  FOR UPDATE TO authenticated
  USING (public.has_module_access(auth.uid(), 'financeiro_op'))
  WITH CHECK (public.has_module_access(auth.uid(), 'financeiro_op'));
CREATE POLICY uber_corridas_delete ON public.uber_corridas
  FOR DELETE TO authenticated
  USING (public.has_module_access(auth.uid(), 'financeiro_op'));

-- financeiro_rotina_execucoes: role authenticated
ALTER POLICY "financeiro_rotina_execucoes read"   ON public.financeiro_rotina_execucoes TO authenticated;
ALTER POLICY "financeiro_rotina_execucoes insert" ON public.financeiro_rotina_execucoes TO authenticated;
ALTER POLICY "financeiro_rotina_execucoes update" ON public.financeiro_rotina_execucoes TO authenticated;
ALTER POLICY "financeiro_rotina_execucoes delete" ON public.financeiro_rotina_execucoes TO authenticated;

ALTER POLICY "financeiro_rotina_exec_anexos all" ON public.financeiro_rotina_execucao_anexos TO authenticated;
ALTER POLICY "financeiro_rotina_anexos all"      ON public.financeiro_rotina_anexos TO authenticated;

ALTER POLICY "financeiro_status_defaults read"        ON public.financeiro_status_defaults TO authenticated;
ALTER POLICY "financeiro_status_defaults admin write" ON public.financeiro_status_defaults TO authenticated;
