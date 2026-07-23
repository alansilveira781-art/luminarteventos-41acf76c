
-- =========================
-- Sequence para numero amigavel
-- =========================
CREATE SEQUENCE IF NOT EXISTS public.op_ordens_numero_seq;

-- =========================
-- op_acervo
-- =========================
CREATE TABLE public.op_acervo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text UNIQUE,
  nome text NOT NULL,
  descricao text,
  categoria text,
  dimensoes text,
  estado text NOT NULL DEFAULT 'BOM',
  localizacao text,
  quantidade numeric NOT NULL DEFAULT 1,
  imagem_url text,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.op_acervo TO authenticated;
GRANT ALL ON public.op_acervo TO service_role;

ALTER TABLE public.op_acervo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "op_acervo_select" ON public.op_acervo
  FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'operacao'));

CREATE POLICY "op_acervo_admin_all" ON public.op_acervo
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'operacao'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'operacao'));

CREATE TRIGGER trg_op_acervo_updated_at
  BEFORE UPDATE ON public.op_acervo
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- op_ordens
-- =========================
CREATE TABLE public.op_ordens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero integer NOT NULL DEFAULT nextval('public.op_ordens_numero_seq'),
  setor_id uuid NOT NULL REFERENCES public.op_setores(id),
  titulo text NOT NULL,
  descricao text,
  tipo_unidade text NOT NULL DEFAULT 'peca' CHECK (tipo_unidade IN ('peca','item_inteiro')),
  quantidade numeric NOT NULL DEFAULT 1,
  evento_ref text,
  origem text NOT NULL DEFAULT 'avulsa' CHECK (origem IN ('avulsa','proposta')),
  proposta_id uuid REFERENCES public.comercial_propostas(id) ON DELETE SET NULL,
  proposta_item_id text,
  etapa_atual_id uuid REFERENCES public.op_setor_etapas(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','em_producao','finalizada','cancelada')),
  responsavel_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  prazo date,
  acervo_id uuid REFERENCES public.op_acervo(id) ON DELETE SET NULL,
  ordem integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_op_ordens_setor ON public.op_ordens(setor_id);
CREATE INDEX idx_op_ordens_status ON public.op_ordens(status);
CREATE INDEX idx_op_ordens_proposta ON public.op_ordens(proposta_id);
CREATE INDEX idx_op_ordens_evento ON public.op_ordens(evento_ref);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.op_ordens TO authenticated;
GRANT ALL ON public.op_ordens TO service_role;

ALTER TABLE public.op_ordens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "op_ordens_select" ON public.op_ordens
  FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'operacao'));

CREATE POLICY "op_ordens_insert" ON public.op_ordens
  FOR INSERT TO authenticated
  WITH CHECK (public.has_module_access(auth.uid(), 'operacao'));

CREATE POLICY "op_ordens_update" ON public.op_ordens
  FOR UPDATE TO authenticated
  USING (public.has_module_access(auth.uid(), 'operacao'))
  WITH CHECK (public.has_module_access(auth.uid(), 'operacao'));

CREATE POLICY "op_ordens_delete" ON public.op_ordens
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'operacao'));

CREATE TRIGGER trg_op_ordens_updated_at
  BEFORE UPDATE ON public.op_ordens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- op_ordem_apontamentos
-- =========================
CREATE TABLE public.op_ordem_apontamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_id uuid NOT NULL REFERENCES public.op_ordens(id) ON DELETE CASCADE,
  etapa_id uuid NOT NULL REFERENCES public.op_setor_etapas(id),
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  finalizado_em timestamptz,
  executado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_op_apont_ordem ON public.op_ordem_apontamentos(ordem_id);
CREATE INDEX idx_op_apont_etapa ON public.op_ordem_apontamentos(etapa_id);
CREATE INDEX idx_op_apont_iniciado ON public.op_ordem_apontamentos(iniciado_em);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.op_ordem_apontamentos TO authenticated;
GRANT ALL ON public.op_ordem_apontamentos TO service_role;

ALTER TABLE public.op_ordem_apontamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "op_apont_select" ON public.op_ordem_apontamentos
  FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'operacao'));

CREATE POLICY "op_apont_write" ON public.op_ordem_apontamentos
  FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(), 'operacao'))
  WITH CHECK (public.has_module_access(auth.uid(), 'operacao'));

-- =========================
-- op_ordem_anexos
-- =========================
CREATE TABLE public.op_ordem_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_id uuid NOT NULL REFERENCES public.op_ordens(id) ON DELETE CASCADE,
  nome text NOT NULL,
  path text NOT NULL,
  mime_type text,
  tamanho bigint,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_op_anexos_ordem ON public.op_ordem_anexos(ordem_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.op_ordem_anexos TO authenticated;
GRANT ALL ON public.op_ordem_anexos TO service_role;

ALTER TABLE public.op_ordem_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "op_anexos_select" ON public.op_ordem_anexos
  FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'operacao'));

CREATE POLICY "op_anexos_insert" ON public.op_ordem_anexos
  FOR INSERT TO authenticated
  WITH CHECK (public.has_module_access(auth.uid(), 'operacao') AND uploaded_by = auth.uid());

CREATE POLICY "op_anexos_delete" ON public.op_ordem_anexos
  FOR DELETE TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.is_module_admin(auth.uid(), 'operacao')
    OR uploaded_by = auth.uid()
  );

-- =========================
-- op_ordem_comentarios
-- =========================
CREATE TABLE public.op_ordem_comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_id uuid NOT NULL REFERENCES public.op_ordens(id) ON DELETE CASCADE,
  user_id uuid,
  user_nome text,
  texto text NOT NULL,
  mencoes uuid[],
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_op_coment_ordem ON public.op_ordem_comentarios(ordem_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.op_ordem_comentarios TO authenticated;
GRANT ALL ON public.op_ordem_comentarios TO service_role;

ALTER TABLE public.op_ordem_comentarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "op_coment_select" ON public.op_ordem_comentarios
  FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'operacao'));

CREATE POLICY "op_coment_insert" ON public.op_ordem_comentarios
  FOR INSERT TO authenticated
  WITH CHECK (public.has_module_access(auth.uid(), 'operacao') AND user_id = auth.uid());

CREATE POLICY "op_coment_update" ON public.op_ordem_comentarios
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'operacao'))
  WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'operacao'));

CREATE POLICY "op_coment_delete" ON public.op_ordem_comentarios
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'operacao'));

-- =========================
-- op_ordem_historico
-- =========================
CREATE TABLE public.op_ordem_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_id uuid NOT NULL REFERENCES public.op_ordens(id) ON DELETE CASCADE,
  user_id uuid,
  user_nome text,
  acao text NOT NULL,
  status_anterior text,
  status_novo text,
  detalhes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_op_hist_ordem ON public.op_ordem_historico(ordem_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.op_ordem_historico TO authenticated;
GRANT ALL ON public.op_ordem_historico TO service_role;

ALTER TABLE public.op_ordem_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "op_hist_select" ON public.op_ordem_historico
  FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'operacao'));

CREATE POLICY "op_hist_insert" ON public.op_ordem_historico
  FOR INSERT TO authenticated
  WITH CHECK (public.has_module_access(auth.uid(), 'operacao'));

-- =========================
-- Trigger de historico automatico em op_ordens
-- =========================
CREATE OR REPLACE FUNCTION public.op_ordens_log_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_nome text;
BEGIN
  SELECT display_name INTO v_nome FROM public.profiles WHERE id = auth.uid();

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.op_ordem_historico(ordem_id, user_id, user_nome, acao, status_novo)
    VALUES (NEW.id, auth.uid(), v_nome, 'criou', NEW.status);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.op_ordem_historico(ordem_id, user_id, user_nome, acao, status_anterior, status_novo)
      VALUES (NEW.id, auth.uid(), v_nome, 'mudou_status', OLD.status, NEW.status);
    END IF;
    IF NEW.etapa_atual_id IS DISTINCT FROM OLD.etapa_atual_id THEN
      INSERT INTO public.op_ordem_historico(ordem_id, user_id, user_nome, acao, detalhes)
      VALUES (NEW.id, auth.uid(), v_nome, 'mudou_etapa',
              'etapa_id=' || COALESCE(NEW.etapa_atual_id::text, 'null'));
    END IF;
    IF NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id THEN
      INSERT INTO public.op_ordem_historico(ordem_id, user_id, user_nome, acao, detalhes)
      VALUES (NEW.id, auth.uid(), v_nome, 'trocou_responsavel',
              'responsavel_id=' || COALESCE(NEW.responsavel_id::text, 'null'));
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_op_ordens_hist
  AFTER INSERT OR UPDATE ON public.op_ordens
  FOR EACH ROW EXECUTE FUNCTION public.op_ordens_log_change();

-- =========================
-- Storage policies para bucket op-anexos
-- =========================
CREATE POLICY "op_anexos_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'op-anexos' AND public.has_module_access(auth.uid(), 'operacao'));

CREATE POLICY "op_anexos_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'op-anexos' AND public.has_module_access(auth.uid(), 'operacao'));

CREATE POLICY "op_anexos_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'op-anexos' AND (
      public.is_admin(auth.uid())
      OR public.is_module_admin(auth.uid(), 'operacao')
      OR owner = auth.uid()
    )
  );
