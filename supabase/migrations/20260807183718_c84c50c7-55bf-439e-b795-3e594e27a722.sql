-- ============ fiscal_empresas ============
CREATE TABLE public.fiscal_empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cnpj text,
  regime text NOT NULL DEFAULT 'presumido' CHECK (regime IN ('simples','presumido','real')),
  anexo int CHECK (anexo BETWEEN 1 AND 5),
  inicio_atividade date,
  iss_aliquota numeric NOT NULL DEFAULT 0,
  rat numeric NOT NULL DEFAULT 2,
  presuncao_irpj numeric NOT NULL DEFAULT 32,
  presuncao_csll numeric NOT NULL DEFAULT 32,
  adicional_irpj_ativo boolean NOT NULL DEFAULT false,
  cnaes text[] NOT NULL DEFAULT '{}',
  atividades text[] NOT NULL DEFAULT '{}',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_empresas TO authenticated;
GRANT ALL ON public.fiscal_empresas TO service_role;
ALTER TABLE public.fiscal_empresas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contabil module access" ON public.fiscal_empresas FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(), 'contabil'))
  WITH CHECK (public.has_module_access(auth.uid(), 'contabil'));
CREATE TRIGGER fiscal_empresas_set_updated_at BEFORE UPDATE ON public.fiscal_empresas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- validação: anexo obrigatório no Simples
CREATE OR REPLACE FUNCTION public.fiscal_empresas_validate()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.regime = 'simples' AND NEW.anexo IS NULL THEN
    RAISE EXCEPTION 'Empresas no Simples Nacional precisam de um anexo (1 a 5).'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER fiscal_empresas_validate_trg BEFORE INSERT OR UPDATE ON public.fiscal_empresas
  FOR EACH ROW EXECUTE FUNCTION public.fiscal_empresas_validate();

-- ============ fiscal_faturamento ============
CREATE TABLE public.fiscal_faturamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.fiscal_empresas(id) ON DELETE CASCADE,
  competencia date NOT NULL,
  receita_bruta numeric NOT NULL DEFAULT 0,
  folha_bruta numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX fiscal_faturamento_empresa_competencia_key
  ON public.fiscal_faturamento (empresa_id, competencia);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_faturamento TO authenticated;
GRANT ALL ON public.fiscal_faturamento TO service_role;
ALTER TABLE public.fiscal_faturamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contabil module access" ON public.fiscal_faturamento FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(), 'contabil'))
  WITH CHECK (public.has_module_access(auth.uid(), 'contabil'));
CREATE TRIGGER fiscal_faturamento_set_updated_at BEFORE UPDATE ON public.fiscal_faturamento
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ fiscal_faixas_simples ============
CREATE TABLE public.fiscal_faixas_simples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anexo int NOT NULL,
  faixa int NOT NULL,
  limite_min numeric NOT NULL,
  limite_max numeric NOT NULL,
  aliquota_nominal numeric NOT NULL,
  parcela_deduzir numeric NOT NULL DEFAULT 0,
  rep_irpj numeric,
  rep_csll numeric,
  rep_cofins numeric,
  rep_pis numeric,
  rep_cpp numeric,
  rep_iss numeric,
  rep_icms numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX fiscal_faixas_simples_anexo_faixa_key
  ON public.fiscal_faixas_simples (anexo, faixa);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_faixas_simples TO authenticated;
GRANT ALL ON public.fiscal_faixas_simples TO service_role;
ALTER TABLE public.fiscal_faixas_simples ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contabil module access" ON public.fiscal_faixas_simples FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(), 'contabil'))
  WITH CHECK (public.has_module_access(auth.uid(), 'contabil'));
CREATE TRIGGER fiscal_faixas_simples_set_updated_at BEFORE UPDATE ON public.fiscal_faixas_simples
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ fiscal_projecoes ============
CREATE TABLE public.fiscal_projecoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  valor_analisado numeric NOT NULL,
  atividade text,
  competencia date,
  criado_em timestamptz NOT NULL DEFAULT now(),
  criado_por uuid,
  criado_por_nome text,
  resultado jsonb NOT NULL DEFAULT '{}'::jsonb
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_projecoes TO authenticated;
GRANT ALL ON public.fiscal_projecoes TO service_role;
ALTER TABLE public.fiscal_projecoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contabil module access" ON public.fiscal_projecoes FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(), 'contabil'))
  WITH CHECK (public.has_module_access(auth.uid(), 'contabil'));

-- ============ Seed: faixas do Simples Nacional ============
INSERT INTO public.fiscal_faixas_simples (anexo, faixa, limite_min, limite_max, aliquota_nominal, parcela_deduzir) VALUES
(1,1,0,180000,4.00,0),
(1,2,180000.01,360000,7.30,5940),
(1,3,360000.01,720000,9.50,13860),
(1,4,720000.01,1800000,10.70,22500),
(1,5,1800000.01,3600000,14.30,87300),
(1,6,3600000.01,4800000,19.00,378000),
(2,1,0,180000,4.50,0),
(2,2,180000.01,360000,7.80,5940),
(2,3,360000.01,720000,10.00,13860),
(2,4,720000.01,1800000,11.20,22500),
(2,5,1800000.01,3600000,14.70,85500),
(2,6,3600000.01,4800000,30.00,720000),
(3,1,0,180000,6.00,0),
(3,2,180000.01,360000,11.20,9360),
(3,3,360000.01,720000,13.50,17640),
(3,4,720000.01,1800000,16.00,35640),
(3,5,1800000.01,3600000,21.00,125640),
(3,6,3600000.01,4800000,33.00,648000),
(4,1,0,180000,4.50,0),
(4,2,180000.01,360000,9.00,8100),
(4,3,360000.01,720000,10.20,12420),
(4,4,720000.01,1800000,14.00,39780),
(4,5,1800000.01,3600000,22.00,183780),
(4,6,3600000.01,4800000,33.00,828000),
(5,1,0,180000,15.50,0),
(5,2,180000.01,360000,18.00,4500),
(5,3,360000.01,720000,19.50,9900),
(5,4,720000.01,1800000,20.50,17100),
(5,5,1800000.01,3600000,23.00,62100),
(5,6,3600000.01,4800000,30.50,540000);

-- Repartição do Anexo III
UPDATE public.fiscal_faixas_simples SET rep_irpj=4.00, rep_csll=3.50, rep_cofins=12.82, rep_pis=2.78, rep_cpp=43.40, rep_iss=33.50 WHERE anexo=3 AND faixa=1;
UPDATE public.fiscal_faixas_simples SET rep_irpj=4.00, rep_csll=3.50, rep_cofins=14.05, rep_pis=3.05, rep_cpp=43.40, rep_iss=32.00 WHERE anexo=3 AND faixa=2;
UPDATE public.fiscal_faixas_simples SET rep_irpj=4.00, rep_csll=3.50, rep_cofins=13.64, rep_pis=2.96, rep_cpp=43.40, rep_iss=32.50 WHERE anexo=3 AND faixa=3;
UPDATE public.fiscal_faixas_simples SET rep_irpj=4.00, rep_csll=3.50, rep_cofins=13.64, rep_pis=2.96, rep_cpp=43.40, rep_iss=32.50 WHERE anexo=3 AND faixa=4;
UPDATE public.fiscal_faixas_simples SET rep_irpj=4.00, rep_csll=3.50, rep_cofins=12.82, rep_pis=2.78, rep_cpp=43.40, rep_iss=33.50 WHERE anexo=3 AND faixa=5;
UPDATE public.fiscal_faixas_simples SET rep_irpj=35.00, rep_csll=15.00, rep_cofins=16.03, rep_pis=3.47, rep_cpp=30.50, rep_iss=0 WHERE anexo=3 AND faixa=6;

-- ============ Seed: empresas do grupo ============
INSERT INTO public.fiscal_empresas (nome, regime, anexo, inicio_atividade, atividades, iss_aliquota) VALUES
('Luminart Tecnologia para Eventos LTDA', 'simples', 3, '2025-12-30', ARRAY['Apoio administrativo','Tecnologia para eventos'], 0),
('Luminart Eventos', 'presumido', NULL, NULL, ARRAY['Cenografia','Montagem de stand'], 0),
('Luminart Planejados', 'presumido', NULL, NULL, ARRAY['Cenografia','Montagem de stand'], 0);