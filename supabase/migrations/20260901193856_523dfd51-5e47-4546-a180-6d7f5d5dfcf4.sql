-- financeiro_rotinas
DROP POLICY IF EXISTS "financeiro module access" ON public.financeiro_rotinas;
CREATE POLICY "financeiro_op module access" ON public.financeiro_rotinas
  FOR ALL USING (has_module_access(auth.uid(), 'financeiro_op'))
  WITH CHECK (has_module_access(auth.uid(), 'financeiro_op'));

-- financeiro_rotina_atividades
DROP POLICY IF EXISTS "financeiro module access" ON public.financeiro_rotina_atividades;
CREATE POLICY "financeiro_op module access" ON public.financeiro_rotina_atividades
  FOR ALL USING (has_module_access(auth.uid(), 'financeiro_op'))
  WITH CHECK (has_module_access(auth.uid(), 'financeiro_op'));

-- financeiro_rotina_anexos
DROP POLICY IF EXISTS "financeiro_rotina_anexos all" ON public.financeiro_rotina_anexos;
CREATE POLICY "financeiro_rotina_anexos all" ON public.financeiro_rotina_anexos
  FOR ALL USING (has_module_access(auth.uid(), 'financeiro_op'))
  WITH CHECK (has_module_access(auth.uid(), 'financeiro_op'));

-- financeiro_rotina_execucao_anexos
DROP POLICY IF EXISTS "financeiro_rotina_exec_anexos all" ON public.financeiro_rotina_execucao_anexos;
CREATE POLICY "financeiro_rotina_exec_anexos all" ON public.financeiro_rotina_execucao_anexos
  FOR ALL USING (has_module_access(auth.uid(), 'financeiro_op'))
  WITH CHECK (has_module_access(auth.uid(), 'financeiro_op'));

-- financeiro_rotina_execucoes
DROP POLICY IF EXISTS "financeiro_rotina_execucoes read" ON public.financeiro_rotina_execucoes;
CREATE POLICY "financeiro_rotina_execucoes read" ON public.financeiro_rotina_execucoes
  FOR SELECT USING (has_module_access(auth.uid(), 'financeiro_op'));

DROP POLICY IF EXISTS "financeiro_rotina_execucoes insert" ON public.financeiro_rotina_execucoes;
CREATE POLICY "financeiro_rotina_execucoes insert" ON public.financeiro_rotina_execucoes
  FOR INSERT WITH CHECK (has_module_access(auth.uid(), 'financeiro_op'));

DROP POLICY IF EXISTS "financeiro_rotina_execucoes update" ON public.financeiro_rotina_execucoes;
CREATE POLICY "financeiro_rotina_execucoes update" ON public.financeiro_rotina_execucoes
  FOR UPDATE USING (has_module_access(auth.uid(), 'financeiro_op'))
  WITH CHECK (has_module_access(auth.uid(), 'financeiro_op'));

DROP POLICY IF EXISTS "financeiro_rotina_execucoes delete" ON public.financeiro_rotina_execucoes;
CREATE POLICY "financeiro_rotina_execucoes delete" ON public.financeiro_rotina_execucoes
  FOR DELETE USING (is_module_admin(auth.uid(), 'financeiro_op') OR is_admin(auth.uid()));

-- storage: bucket rotina-anexos
DROP POLICY IF EXISTS "rotina anexos read" ON storage.objects;
CREATE POLICY "rotina anexos read" ON storage.objects
  FOR SELECT USING (bucket_id = 'rotina-anexos' AND has_module_access(auth.uid(), 'financeiro_op'));

DROP POLICY IF EXISTS "rotina anexos write" ON storage.objects;
CREATE POLICY "rotina anexos write" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'rotina-anexos' AND has_module_access(auth.uid(), 'financeiro_op'));

DROP POLICY IF EXISTS "rotina anexos update" ON storage.objects;
CREATE POLICY "rotina anexos update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'rotina-anexos' AND has_module_access(auth.uid(), 'financeiro_op'))
  WITH CHECK (bucket_id = 'rotina-anexos' AND has_module_access(auth.uid(), 'financeiro_op'));

DROP POLICY IF EXISTS "rotina anexos delete" ON storage.objects;
CREATE POLICY "rotina anexos delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'rotina-anexos' AND has_module_access(auth.uid(), 'financeiro_op'));