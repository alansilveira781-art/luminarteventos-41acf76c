
-- ============ Módulos cadastrados ============
INSERT INTO public.modulos (slug, nome, descricao, icone, rota, ordem, ativo)
VALUES
  ('contabil', 'Contábil', 'Emissão de notas fiscais, consulta de impostos e configurações tributárias', 'Calculator', '/contabil', 70, true),
  ('juridico', 'Jurídico', 'Gestão de contratos em formato kanban', 'Scale', '/juridico', 80, true),
  ('rh', 'Recursos Humanos', 'Recrutamento e seleção em formato kanban', 'UserCog', '/rh', 90, true)
ON CONFLICT (slug) DO UPDATE SET nome = EXCLUDED.nome, descricao = EXCLUDED.descricao, icone = EXCLUDED.icone, rota = EXCLUDED.rota, ativo = true;

-- ============ Contábil ============
CREATE TABLE IF NOT EXISTS public.contabil_notas_fiscais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa TEXT NOT NULL,
  numero TEXT,
  tipo_servico TEXT,
  tomador_nome TEXT NOT NULL,
  tomador_documento TEXT,
  tomador_email TEXT,
  valor_bruto NUMERIC NOT NULL DEFAULT 0,
  valor_liquido NUMERIC,
  impostos JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'rascunho',
  data_emissao DATE,
  observacoes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contabil_notas_fiscais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contabil module access" ON public.contabil_notas_fiscais
  FOR ALL TO authenticated
  USING (has_module_access(auth.uid(), 'contabil'))
  WITH CHECK (has_module_access(auth.uid(), 'contabil'));
CREATE TRIGGER contabil_notas_fiscais_set_updated_at
  BEFORE UPDATE ON public.contabil_notas_fiscais
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.contabil_configuracao_aliquotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa TEXT NOT NULL,
  regime TEXT NOT NULL,
  imposto TEXT NOT NULL,
  aliquota NUMERIC NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (empresa, imposto)
);
ALTER TABLE public.contabil_configuracao_aliquotas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contabil module access" ON public.contabil_configuracao_aliquotas
  FOR ALL TO authenticated
  USING (has_module_access(auth.uid(), 'contabil'))
  WITH CHECK (has_module_access(auth.uid(), 'contabil'));
CREATE TRIGGER contabil_config_set_updated_at
  BEFORE UPDATE ON public.contabil_configuracao_aliquotas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.contabil_consultas_impostos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  empresa TEXT,
  periodo_inicio DATE,
  periodo_fim DATE,
  parametros JSONB DEFAULT '{}'::jsonb,
  resultado JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pendente',
  observacoes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contabil_consultas_impostos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contabil module access" ON public.contabil_consultas_impostos
  FOR ALL TO authenticated
  USING (has_module_access(auth.uid(), 'contabil'))
  WITH CHECK (has_module_access(auth.uid(), 'contabil'));
CREATE TRIGGER contabil_consultas_set_updated_at
  BEFORE UPDATE ON public.contabil_consultas_impostos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ Jurídico ============
CREATE TABLE IF NOT EXISTS public.juridico_contratos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  empresa TEXT,
  cliente_nome TEXT,
  cliente_documento TEXT,
  cliente_email TEXT,
  cliente_telefone TEXT,
  valor NUMERIC,
  status TEXT NOT NULL DEFAULT 'entrada',
  proposta_ref TEXT,
  proposta_numero INTEGER,
  data_fechamento DATE,
  data_assinatura DATE,
  responsavel TEXT,
  observacoes TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.juridico_contratos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "juridico module access" ON public.juridico_contratos
  FOR ALL TO authenticated
  USING (has_module_access(auth.uid(), 'juridico'))
  WITH CHECK (has_module_access(auth.uid(), 'juridico'));
CREATE TRIGGER juridico_contratos_set_updated_at
  BEFORE UPDATE ON public.juridico_contratos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ RH ============
CREATE TABLE IF NOT EXISTS public.rh_vagas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  empresa TEXT,
  departamento TEXT,
  descricao TEXT,
  candidato_nome TEXT,
  candidato_email TEXT,
  candidato_telefone TEXT,
  fonte TEXT,
  responsavel TEXT,
  status TEXT NOT NULL DEFAULT 'aberta',
  ordem INTEGER NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rh_vagas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh module access" ON public.rh_vagas
  FOR ALL TO authenticated
  USING (has_module_access(auth.uid(), 'rh'))
  WITH CHECK (has_module_access(auth.uid(), 'rh'));
CREATE TRIGGER rh_vagas_set_updated_at
  BEFORE UPDATE ON public.rh_vagas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
