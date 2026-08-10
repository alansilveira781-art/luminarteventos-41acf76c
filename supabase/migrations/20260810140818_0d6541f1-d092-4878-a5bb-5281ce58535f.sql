ALTER TABLE public.diaristas
  ADD COLUMN IF NOT EXISTS departamento text,
  ADD COLUMN IF NOT EXISTS colaborador_id uuid REFERENCES public.rh_colaboradores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_diaristas_departamento ON public.diaristas(departamento);

DROP POLICY IF EXISTS "Lancador le colaboradores" ON public.rh_colaboradores;
CREATE POLICY "Lancador le colaboradores" ON public.rh_colaboradores
  FOR SELECT TO authenticated
  USING (public.pode_lancar_diaria(auth.uid()) OR public.has_module_access(auth.uid(), 'financeiro'));