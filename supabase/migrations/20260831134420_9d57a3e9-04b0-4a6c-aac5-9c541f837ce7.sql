-- diaristas
DROP POLICY "Financeiro pode gerenciar diaristas" ON public.diaristas;
CREATE POLICY "Financeiro pode gerenciar diaristas" ON public.diaristas
FOR ALL TO authenticated
USING (has_module_access(auth.uid(), 'financeiro_op'))
WITH CHECK (has_module_access(auth.uid(), 'financeiro_op'));

-- diarista_apontamentos
DROP POLICY "Financeiro le apontamentos" ON public.diarista_apontamentos;
CREATE POLICY "Financeiro le apontamentos" ON public.diarista_apontamentos
FOR SELECT TO authenticated
USING (has_module_access(auth.uid(), 'financeiro_op'));

DROP POLICY "Financeiro cria apontamentos" ON public.diarista_apontamentos;
CREATE POLICY "Financeiro cria apontamentos" ON public.diarista_apontamentos
FOR INSERT TO authenticated
WITH CHECK (has_module_access(auth.uid(), 'financeiro_op'));

DROP POLICY "Financeiro edita apontamentos" ON public.diarista_apontamentos;
CREATE POLICY "Financeiro edita apontamentos" ON public.diarista_apontamentos
FOR UPDATE TO authenticated
USING (has_module_access(auth.uid(), 'financeiro_op') AND (fechamento_id IS NULL OR is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'financeiro_op')))
WITH CHECK (has_module_access(auth.uid(), 'financeiro_op') AND (fechamento_id IS NULL OR is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'financeiro_op')));

DROP POLICY "Financeiro exclui apontamentos" ON public.diarista_apontamentos;
CREATE POLICY "Financeiro exclui apontamentos" ON public.diarista_apontamentos
FOR DELETE TO authenticated
USING (has_module_access(auth.uid(), 'financeiro_op') AND (fechamento_id IS NULL OR is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'financeiro_op')));

-- diarista_apontamento_eventos
DROP POLICY "Acesso aos eventos conforme apontamento" ON public.diarista_apontamento_eventos;
CREATE POLICY "Acesso aos eventos conforme apontamento" ON public.diarista_apontamento_eventos
FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM diarista_apontamentos a
  WHERE a.id = diarista_apontamento_eventos.apontamento_id
    AND (has_module_access(auth.uid(), 'financeiro_op') OR (pode_lancar_diaria(auth.uid()) AND a.created_by = auth.uid()))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM diarista_apontamentos a
  WHERE a.id = diarista_apontamento_eventos.apontamento_id
    AND (has_module_access(auth.uid(), 'financeiro_op') OR (pode_lancar_diaria(auth.uid()) AND a.created_by = auth.uid()))
));

-- diarista_fechamentos
DROP POLICY "Financeiro le fechamentos" ON public.diarista_fechamentos;
CREATE POLICY "Financeiro le fechamentos" ON public.diarista_fechamentos
FOR SELECT TO authenticated
USING (has_module_access(auth.uid(), 'financeiro_op'));

DROP POLICY "Admin financeiro cria fechamentos" ON public.diarista_fechamentos;
CREATE POLICY "Admin financeiro cria fechamentos" ON public.diarista_fechamentos
FOR INSERT TO authenticated
WITH CHECK ((is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'financeiro_op')) AND created_by = auth.uid());

DROP POLICY "Admin financeiro edita fechamentos" ON public.diarista_fechamentos;
CREATE POLICY "Admin financeiro edita fechamentos" ON public.diarista_fechamentos
FOR UPDATE TO authenticated
USING (is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'financeiro_op'))
WITH CHECK (is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'financeiro_op'));

DROP POLICY "Admin financeiro exclui fechamentos" ON public.diarista_fechamentos;
CREATE POLICY "Admin financeiro exclui fechamentos" ON public.diarista_fechamentos
FOR DELETE TO authenticated
USING (is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'financeiro_op'));