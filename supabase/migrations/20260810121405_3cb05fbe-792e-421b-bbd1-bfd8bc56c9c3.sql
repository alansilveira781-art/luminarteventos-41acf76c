CREATE TABLE public.financeiro_atividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_atividades TO authenticated;
GRANT ALL ON public.financeiro_atividades TO service_role;

ALTER TABLE public.financeiro_atividades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Atividades visiveis para autenticados"
ON public.financeiro_atividades FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins criam atividades"
ON public.financeiro_atividades FOR INSERT TO authenticated
WITH CHECK (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'financeiro'));

CREATE POLICY "Admins editam atividades"
ON public.financeiro_atividades FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'financeiro'))
WITH CHECK (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'financeiro'));

CREATE POLICY "Admins excluem atividades"
ON public.financeiro_atividades FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'financeiro'));

CREATE TRIGGER financeiro_atividades_set_updated_at
BEFORE UPDATE ON public.financeiro_atividades
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.financeiro_rotinas
  ADD COLUMN IF NOT EXISTS atividade_id uuid REFERENCES public.financeiro_atividades(id) ON DELETE SET NULL;

ALTER TABLE public.financeiro_rotinas DROP CONSTRAINT IF EXISTS financeiro_rotinas_frequencia_check;
ALTER TABLE public.financeiro_rotinas ADD CONSTRAINT financeiro_rotinas_frequencia_check
  CHECK (frequencia = ANY (ARRAY['diaria','semanal','quinzenal','mensal','custom','esporadica']));