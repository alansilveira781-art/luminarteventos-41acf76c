-- 1. Lançadores
CREATE TABLE public.diarista_lancadores (
  user_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.diarista_lancadores TO authenticated;
GRANT ALL ON public.diarista_lancadores TO service_role;

ALTER TABLE public.diarista_lancadores ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.pode_lancar_diaria(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.diarista_lancadores WHERE user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.is_diaria_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin(_user_id)
      OR public.is_module_admin(_user_id, 'financeiro')
      OR public.is_module_admin(_user_id, 'financeiro_op')
$$;

CREATE POLICY "Autenticados leem lancadores"
  ON public.diarista_lancadores FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin financeiro gerencia lancadores"
  ON public.diarista_lancadores FOR ALL TO authenticated
  USING (public.is_diaria_admin(auth.uid()))
  WITH CHECK (public.is_diaria_admin(auth.uid()));

-- 2. Apontamentos: modo de divisão + created_by automático
ALTER TABLE public.diarista_apontamentos
  ADD COLUMN IF NOT EXISTS modo_divisao text NOT NULL DEFAULT 'unico';

ALTER TABLE public.diarista_apontamentos
  ADD CONSTRAINT diarista_apontamentos_modo_divisao_check
  CHECK (modo_divisao IN ('unico','horarios','igual'));

CREATE OR REPLACE FUNCTION public.diarista_apontamentos_set_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_diarista_apontamentos_created_by ON public.diarista_apontamentos;
CREATE TRIGGER trg_diarista_apontamentos_created_by
  BEFORE INSERT ON public.diarista_apontamentos
  FOR EACH ROW EXECUTE FUNCTION public.diarista_apontamentos_set_created_by();

-- 3. Eventos do apontamento
CREATE TABLE public.diarista_apontamento_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apontamento_id uuid NOT NULL REFERENCES public.diarista_apontamentos(id) ON DELETE CASCADE,
  evento_id uuid,
  evento_nome text NOT NULL,
  hora_inicial time,
  hora_final time,
  intervalo_minutos integer NOT NULL DEFAULT 0,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_diarista_apontamento_eventos_apontamento
  ON public.diarista_apontamento_eventos(apontamento_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.diarista_apontamento_eventos TO authenticated;
GRANT ALL ON public.diarista_apontamento_eventos TO service_role;

ALTER TABLE public.diarista_apontamento_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso aos eventos conforme apontamento"
  ON public.diarista_apontamento_eventos FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.diarista_apontamentos a
    WHERE a.id = apontamento_id
      AND (public.has_module_access(auth.uid(), 'financeiro')
        OR (public.pode_lancar_diaria(auth.uid()) AND a.created_by = auth.uid()))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.diarista_apontamentos a
    WHERE a.id = apontamento_id
      AND (public.has_module_access(auth.uid(), 'financeiro')
        OR (public.pode_lancar_diaria(auth.uid()) AND a.created_by = auth.uid()))
  ));

-- 4. Políticas para lançadores
CREATE POLICY "Lancador gerencia proprios apontamentos"
  ON public.diarista_apontamentos FOR ALL TO authenticated
  USING (public.pode_lancar_diaria(auth.uid()) AND created_by = auth.uid())
  WITH CHECK (public.pode_lancar_diaria(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Lancador le diaristas"
  ON public.diaristas FOR SELECT TO authenticated
  USING (public.pode_lancar_diaria(auth.uid()));

CREATE POLICY "Lancador cadastra diaristas"
  ON public.diaristas FOR INSERT TO authenticated
  WITH CHECK (public.pode_lancar_diaria(auth.uid()));

CREATE POLICY "Lancador edita diaristas"
  ON public.diaristas FOR UPDATE TO authenticated
  USING (public.pode_lancar_diaria(auth.uid()))
  WITH CHECK (public.pode_lancar_diaria(auth.uid()));