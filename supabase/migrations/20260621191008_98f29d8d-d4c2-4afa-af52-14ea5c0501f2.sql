
CREATE TABLE public.financeiro_rotina_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rotina_id uuid NOT NULL REFERENCES public.financeiro_rotinas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  path text NOT NULL,
  mime_type text,
  tamanho bigint,
  uploaded_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_rotina_anexos TO authenticated;
GRANT ALL ON public.financeiro_rotina_anexos TO service_role;

ALTER TABLE public.financeiro_rotina_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financeiro_rotina_anexos all"
  ON public.financeiro_rotina_anexos
  FOR ALL
  USING (public.has_module_access(auth.uid(), 'financeiro'))
  WITH CHECK (public.has_module_access(auth.uid(), 'financeiro'));

CREATE INDEX idx_financeiro_rotina_anexos_rotina ON public.financeiro_rotina_anexos(rotina_id);
