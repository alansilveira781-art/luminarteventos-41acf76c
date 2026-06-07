
CREATE TABLE public.ca_dre_estrutura (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem int NOT NULL UNIQUE,
  codigo text NOT NULL UNIQUE,
  label text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('sum','calc')),
  sinal int NOT NULL DEFAULT 1 CHECK (sinal IN (-1,1)),
  prefixos text[] NOT NULL DEFAULT '{}',
  formula text[] NOT NULL DEFAULT '{}',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ca_dre_estrutura TO authenticated;
GRANT ALL ON public.ca_dre_estrutura TO service_role;

ALTER TABLE public.ca_dre_estrutura ENABLE ROW LEVEL SECURITY;

CREATE POLICY "DRE estrutura: leitura autenticada"
  ON public.ca_dre_estrutura FOR SELECT TO authenticated USING (true);

CREATE POLICY "DRE estrutura: admin gerencia"
  ON public.ca_dre_estrutura FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_ca_dre_estrutura_updated_at
  BEFORE UPDATE ON public.ca_dre_estrutura
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.ca_dre_estrutura (ordem, codigo, label, tipo, sinal, prefixos, formula) VALUES
  (1,  'RB',     '(+) Receita Bruta',             'sum',  1, ARRAY['RB'],       ARRAY[]::text[]),
  (2,  'DR',     '(-) Deduções da Receita',       'sum', -1, ARRAY['DR'],       ARRAY[]::text[]),
  (3,  'RL',     '(=) Receita Líquida',           'calc', 1, ARRAY[]::text[],   ARRAY['RB','DR']),
  (4,  'AC',     '(-) Aquisição de Clientes',     'sum', -1, ARRAY['AC'],       ARRAY[]::text[]),
  (5,  'DM',     '(-) Despesas com Marketing',    'sum', -1, ARRAY['DM'],       ARRAY[]::text[]),
  (6,  'DC',     '(-) Despesas Comerciais',       'sum', -1, ARRAY['DC'],       ARRAY[]::text[]),
  (7,  'RV',     '(=) Resultado de Venda',        'calc', 1, ARRAY[]::text[],   ARRAY['RL','AC','DM','DC']),
  (8,  'CV',     '(-) Custos Variáveis',          'sum', -1, ARRAY['CV'],       ARRAY[]::text[]),
  (9,  'CD',     '(-) Custos Diretos',            'sum', -1, ARRAY['CD'],       ARRAY[]::text[]),
  (10, 'CI',     '(-) Custos Indiretos',          'sum', -1, ARRAY['CI'],       ARRAY[]::text[]),
  (11, 'RO',     '(=) Resultado da Operação',     'calc', 1, ARRAY[]::text[],   ARRAY['RV','CV','CD','CI']),
  (12, 'DS',     '(-) Despesas com Sócio',        'sum', -1, ARRAY['DS'],       ARRAY[]::text[]),
  (13, 'DA',     '(-) Despesas Administrativas',  'sum', -1, ARRAY['DA'],       ARRAY[]::text[]),
  (14, 'DT',     '(-) Despesas Tributárias',      'sum', -1, ARRAY['DT'],       ARRAY[]::text[]),
  (15, 'RG',     '(=) Resultado Gerencial',       'calc', 1, ARRAY[]::text[],   ARRAY['RO','DS','DA','DT']),
  (16, 'RF_REC', '(+) Receitas Financeiras',      'sum',  1, ARRAY['RF'],       ARRAY[]::text[]),
  (17, 'DF',     '(-) Despesas Financeiras',      'sum', -1, ARRAY['DF'],       ARRAY[]::text[]),
  (18, 'RF_TOT', '(=) Resultado Financeiro',      'calc', 1, ARRAY[]::text[],   ARRAY['RF_REC','DF']),
  (19, 'OE',     '(+) Outras Entradas',           'sum',  1, ARRAY['OE','OR'],  ARRAY[]::text[]),
  (20, 'OS',     '(-) Outras Saídas',             'sum', -1, ARRAY['OS'],       ARRAY[]::text[]),
  (21, 'RNO',    '(=) Resultado Não Operacional', 'calc', 1, ARRAY[]::text[],   ARRAY['OE','OS']),
  (22, 'RN',     '(=) Resultado do Negócio',      'calc', 1, ARRAY[]::text[],   ARRAY['RG','RF_TOT','RNO']),
  (23, 'IN',     '(-) Investimentos',             'sum', -1, ARRAY['IN'],       ARRAY[]::text[]),
  (24, 'LU',     '(=) Lucro',                     'calc', 1, ARRAY[]::text[],   ARRAY['RN','IN']);
