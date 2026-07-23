
-- ============================================================
-- Módulo Jurídico: anexos, comentários e histórico
-- ============================================================

-- 1) Anexos ---------------------------------------------------
CREATE TABLE public.juridico_anexos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_id UUID NOT NULL REFERENCES public.juridico_contratos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  path TEXT NOT NULL,
  mime_type TEXT,
  tamanho BIGINT,
  tipo TEXT NOT NULL DEFAULT 'outro' CHECK (tipo IN ('proposta','contrato','outro')),
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX juridico_anexos_contrato_id_idx ON public.juridico_anexos(contrato_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.juridico_anexos TO authenticated;
GRANT ALL ON public.juridico_anexos TO service_role;

ALTER TABLE public.juridico_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "juridico_anexos select module" ON public.juridico_anexos
  FOR SELECT USING (public.has_module_access(auth.uid(), 'juridico'));

CREATE POLICY "juridico_anexos insert" ON public.juridico_anexos
  FOR INSERT WITH CHECK (
    public.is_admin(auth.uid())
    OR public.is_module_admin(auth.uid(), 'juridico')
    OR public.has_module_access(auth.uid(), 'juridico')
  );

CREATE POLICY "juridico_anexos update owner" ON public.juridico_anexos
  FOR UPDATE USING (
    public.is_admin(auth.uid())
    OR public.is_module_admin(auth.uid(), 'juridico')
    OR uploaded_by = auth.uid()
  ) WITH CHECK (
    public.is_admin(auth.uid())
    OR public.is_module_admin(auth.uid(), 'juridico')
    OR uploaded_by = auth.uid()
  );

CREATE POLICY "juridico_anexos delete owner" ON public.juridico_anexos
  FOR DELETE USING (
    public.is_admin(auth.uid())
    OR public.is_module_admin(auth.uid(), 'juridico')
    OR uploaded_by = auth.uid()
  );

CREATE TRIGGER juridico_anexos_set_updated_at
BEFORE UPDATE ON public.juridico_anexos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 2) Comentários ---------------------------------------------
CREATE TABLE public.juridico_comentarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_id UUID NOT NULL REFERENCES public.juridico_contratos(id) ON DELETE CASCADE,
  user_id UUID,
  user_nome TEXT,
  texto TEXT NOT NULL,
  mencoes UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX juridico_comentarios_contrato_id_idx ON public.juridico_comentarios(contrato_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.juridico_comentarios TO authenticated;
GRANT ALL ON public.juridico_comentarios TO service_role;

ALTER TABLE public.juridico_comentarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "juridico_comentarios_select" ON public.juridico_comentarios
  FOR SELECT USING (public.has_module_access(auth.uid(), 'juridico'));

CREATE POLICY "juridico_comentarios_insert" ON public.juridico_comentarios
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND public.has_module_access(auth.uid(), 'juridico')
  );

CREATE POLICY "juridico_comentarios_update_own" ON public.juridico_comentarios
  FOR UPDATE USING (
    auth.uid() = user_id
    OR public.is_module_admin(auth.uid(), 'juridico')
    OR public.is_admin(auth.uid())
  ) WITH CHECK (
    auth.uid() = user_id
    OR public.is_module_admin(auth.uid(), 'juridico')
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "juridico_comentarios_delete_own" ON public.juridico_comentarios
  FOR DELETE USING (
    auth.uid() = user_id
    OR public.is_module_admin(auth.uid(), 'juridico')
    OR public.is_admin(auth.uid())
  );

CREATE TRIGGER juridico_comentarios_set_updated_at
BEFORE UPDATE ON public.juridico_comentarios
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 3) Histórico -----------------------------------------------
CREATE TABLE public.juridico_historico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_id UUID NOT NULL REFERENCES public.juridico_contratos(id) ON DELETE CASCADE,
  user_id UUID,
  user_nome TEXT,
  acao TEXT NOT NULL,
  status_anterior TEXT,
  status_novo TEXT,
  detalhe TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX juridico_historico_contrato_id_idx ON public.juridico_historico(contrato_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.juridico_historico TO authenticated;
GRANT ALL ON public.juridico_historico TO service_role;

ALTER TABLE public.juridico_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "juridico_historico module access" ON public.juridico_historico
  FOR ALL USING (public.has_module_access(auth.uid(), 'juridico'))
  WITH CHECK (public.has_module_access(auth.uid(), 'juridico'));


-- 4) Trigger de histórico automático no juridico_contratos ---
CREATE OR REPLACE FUNCTION public.juridico_contratos_log_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE v_nome text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT display_name INTO v_nome FROM public.profiles WHERE id = auth.uid();
    INSERT INTO public.juridico_historico(contrato_id, user_id, user_nome, acao, status_anterior, status_novo)
    VALUES (NEW.id, auth.uid(), v_nome, 'mudou_status', OLD.status, NEW.status);
  ELSIF TG_OP = 'INSERT' THEN
    SELECT display_name INTO v_nome FROM public.profiles WHERE id = auth.uid();
    INSERT INTO public.juridico_historico(contrato_id, user_id, user_nome, acao, status_novo)
    VALUES (NEW.id, auth.uid(), v_nome, 'criou', NEW.status);
  END IF;
  RETURN NEW;
END $function$;

CREATE TRIGGER juridico_contratos_log_status_change
AFTER INSERT OR UPDATE ON public.juridico_contratos
FOR EACH ROW EXECUTE FUNCTION public.juridico_contratos_log_status_change();


-- 5) Ampliar policies de INSERT/UPDATE dos contratos para
--    permitir uso pelo módulo Comercial (fechamento gera card).
DROP POLICY IF EXISTS "juridico_contratos admin write" ON public.juridico_contratos;
DROP POLICY IF EXISTS "juridico_contratos admin update" ON public.juridico_contratos;

CREATE POLICY "juridico_contratos insert" ON public.juridico_contratos
  FOR INSERT WITH CHECK (
    public.is_admin(auth.uid())
    OR public.is_module_admin(auth.uid(), 'juridico')
    OR public.has_module_access(auth.uid(), 'juridico')
    OR public.has_module_access(auth.uid(), 'comercial')
  );

CREATE POLICY "juridico_contratos update" ON public.juridico_contratos
  FOR UPDATE USING (
    public.is_admin(auth.uid())
    OR public.is_module_admin(auth.uid(), 'juridico')
    OR public.has_module_access(auth.uid(), 'juridico')
  ) WITH CHECK (
    public.is_admin(auth.uid())
    OR public.is_module_admin(auth.uid(), 'juridico')
    OR public.has_module_access(auth.uid(), 'juridico')
  );
