
-- 1) Rotinas do Financeiro
CREATE TABLE public.financeiro_rotinas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  frequencia text NOT NULL CHECK (frequencia IN ('diaria','semanal','quinzenal','mensal','custom')),
  dias_semana integer[] DEFAULT '{}',
  hora time NOT NULL DEFAULT '09:00',
  data_inicio date NOT NULL DEFAULT CURRENT_DATE,
  data_fim date,
  responsavel_id uuid,
  responsavel_nome text,
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','pausada')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.financeiro_rotinas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financeiro module access"
  ON public.financeiro_rotinas FOR ALL
  TO authenticated
  USING (has_module_access(auth.uid(), 'financeiro'))
  WITH CHECK (has_module_access(auth.uid(), 'financeiro'));

CREATE TRIGGER trg_financeiro_rotinas_updated_at
  BEFORE UPDATE ON public.financeiro_rotinas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Empresa nas movimentações de estoque
ALTER TABLE public.movimentacoes ADD COLUMN IF NOT EXISTS empresa text;

-- 3) Cache de consultas SEFAZ
CREATE TABLE public.nfe_consultas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa text NOT NULL,
  chave text NOT NULL UNIQUE,
  numero text,
  serie text,
  emitente_cnpj text,
  emitente_nome text,
  destinatario_cnpj text,
  destinatario_nome text,
  valor numeric,
  data_emissao timestamptz,
  status text,
  xml_url text,
  raw jsonb,
  synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX nfe_consultas_empresa_data_idx ON public.nfe_consultas (empresa, data_emissao DESC);

ALTER TABLE public.nfe_consultas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estoque module access"
  ON public.nfe_consultas FOR ALL
  TO authenticated
  USING (has_module_access(auth.uid(), 'estoque'))
  WITH CHECK (has_module_access(auth.uid(), 'estoque'));
