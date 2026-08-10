CREATE TABLE public.financeiro_rotina_atividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rotina_id uuid NOT NULL REFERENCES public.financeiro_rotinas(id) ON DELETE CASCADE,
  atividade_id uuid NOT NULL REFERENCES public.financeiro_atividades(id) ON DELETE CASCADE,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rotina_id, atividade_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_rotina_atividades TO authenticated;
GRANT ALL ON public.financeiro_rotina_atividades TO service_role;

ALTER TABLE public.financeiro_rotina_atividades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financeiro module access" ON public.financeiro_rotina_atividades
FOR ALL TO authenticated
USING (has_module_access(auth.uid(), 'financeiro'))
WITH CHECK (has_module_access(auth.uid(), 'financeiro'));

CREATE TRIGGER financeiro_rotina_atividades_updated_at
BEFORE UPDATE ON public.financeiro_rotina_atividades
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_frat_rotina ON public.financeiro_rotina_atividades(rotina_id);

INSERT INTO public.financeiro_rotina_atividades (rotina_id, atividade_id, ordem)
SELECT id, atividade_id, 0 FROM public.financeiro_rotinas WHERE atividade_id IS NOT NULL
ON CONFLICT DO NOTHING;