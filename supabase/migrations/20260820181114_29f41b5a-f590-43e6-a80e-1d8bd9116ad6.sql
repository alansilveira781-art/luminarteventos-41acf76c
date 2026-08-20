CREATE TABLE public.diarista_departamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL UNIQUE,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.diarista_departamentos TO authenticated;
GRANT ALL ON public.diarista_departamentos TO service_role;

ALTER TABLE public.diarista_departamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "diarista_departamentos_select" ON public.diarista_departamentos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "diarista_departamentos_insert" ON public.diarista_departamentos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'financeiro_op'));

CREATE POLICY "diarista_departamentos_update" ON public.diarista_departamentos
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'financeiro_op'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'financeiro_op'));

CREATE POLICY "diarista_departamentos_delete" ON public.diarista_departamentos
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'financeiro_op'));

INSERT INTO public.diarista_departamentos (nome, ordem) VALUES
  ('Marcenaria', 1),
  ('Estrutura', 2),
  ('Iluminação', 3),
  ('Produção de Eventos', 4);