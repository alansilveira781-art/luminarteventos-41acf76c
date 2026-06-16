
-- 1) financeiro_status_defaults (mirror of compras_status_defaults)
CREATE TABLE IF NOT EXISTS public.financeiro_status_defaults (
  status public.compra_status PRIMARY KEY,
  responsavel_id uuid,
  responsavel_nome text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_status_defaults TO authenticated;
GRANT ALL ON public.financeiro_status_defaults TO service_role;

ALTER TABLE public.financeiro_status_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financeiro_status_defaults read"
  ON public.financeiro_status_defaults FOR SELECT
  USING (public.has_module_access(auth.uid(), 'financeiro'));

CREATE POLICY "financeiro_status_defaults admin write"
  ON public.financeiro_status_defaults FOR ALL
  USING (public.is_module_admin(auth.uid(), 'financeiro') OR public.is_admin(auth.uid()))
  WITH CHECK (public.is_module_admin(auth.uid(), 'financeiro') OR public.is_admin(auth.uid()));

-- 2) demandas: add responsavel_id / responsavel_nome for default assignment
ALTER TABLE public.demandas
  ADD COLUMN IF NOT EXISTS responsavel_id uuid,
  ADD COLUMN IF NOT EXISTS responsavel_nome text;

-- 3) financeiro_rotinas: exige_validacao flag
ALTER TABLE public.financeiro_rotinas
  ADD COLUMN IF NOT EXISTS exige_validacao boolean NOT NULL DEFAULT false;

-- 4) financeiro_rotina_execucoes
CREATE TABLE IF NOT EXISTS public.financeiro_rotina_execucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rotina_id uuid NOT NULL REFERENCES public.financeiro_rotinas(id) ON DELETE CASCADE,
  data_referencia date NOT NULL,
  executada boolean NOT NULL DEFAULT true,
  executada_em timestamptz NOT NULL DEFAULT now(),
  executada_por uuid,
  executada_por_nome text,
  observacoes text,
  validacao_status text NOT NULL DEFAULT 'nao_requer',
  validado_por uuid,
  validado_por_nome text,
  validado_em timestamptz,
  validacao_observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rotina_execucoes_rotina ON public.financeiro_rotina_execucoes(rotina_id);
CREATE INDEX IF NOT EXISTS idx_rotina_execucoes_validacao ON public.financeiro_rotina_execucoes(validacao_status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_rotina_execucoes TO authenticated;
GRANT ALL ON public.financeiro_rotina_execucoes TO service_role;
ALTER TABLE public.financeiro_rotina_execucoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financeiro_rotina_execucoes read"
  ON public.financeiro_rotina_execucoes FOR SELECT
  USING (public.has_module_access(auth.uid(), 'financeiro'));

CREATE POLICY "financeiro_rotina_execucoes insert"
  ON public.financeiro_rotina_execucoes FOR INSERT
  WITH CHECK (public.has_module_access(auth.uid(), 'financeiro'));

CREATE POLICY "financeiro_rotina_execucoes update"
  ON public.financeiro_rotina_execucoes FOR UPDATE
  USING (public.has_module_access(auth.uid(), 'financeiro'))
  WITH CHECK (public.has_module_access(auth.uid(), 'financeiro'));

CREATE POLICY "financeiro_rotina_execucoes delete"
  ON public.financeiro_rotina_execucoes FOR DELETE
  USING (public.is_module_admin(auth.uid(), 'financeiro') OR public.is_admin(auth.uid()));

-- 5) financeiro_rotina_execucao_anexos
CREATE TABLE IF NOT EXISTS public.financeiro_rotina_execucao_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execucao_id uuid NOT NULL REFERENCES public.financeiro_rotina_execucoes(id) ON DELETE CASCADE,
  nome text NOT NULL,
  path text NOT NULL,
  mime_type text,
  tamanho bigint,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rotina_exec_anexos_execucao ON public.financeiro_rotina_execucao_anexos(execucao_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_rotina_execucao_anexos TO authenticated;
GRANT ALL ON public.financeiro_rotina_execucao_anexos TO service_role;
ALTER TABLE public.financeiro_rotina_execucao_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financeiro_rotina_exec_anexos all"
  ON public.financeiro_rotina_execucao_anexos FOR ALL
  USING (public.has_module_access(auth.uid(), 'financeiro'))
  WITH CHECK (public.has_module_access(auth.uid(), 'financeiro'));

-- 6) Storage policies for rotina-anexos bucket
CREATE POLICY "rotina anexos read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'rotina-anexos' AND public.has_module_access(auth.uid(), 'financeiro'));

CREATE POLICY "rotina anexos write"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'rotina-anexos' AND public.has_module_access(auth.uid(), 'financeiro'));

CREATE POLICY "rotina anexos update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'rotina-anexos' AND public.has_module_access(auth.uid(), 'financeiro'))
  WITH CHECK (bucket_id = 'rotina-anexos' AND public.has_module_access(auth.uid(), 'financeiro'));

CREATE POLICY "rotina anexos delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'rotina-anexos' AND public.has_module_access(auth.uid(), 'financeiro'));
