-- Add Compras module
INSERT INTO public.modulos (slug, nome, descricao, icone, rota, ativo, ordem)
VALUES ('compras', 'Compras', 'Gestão de compras com kanban', 'ShoppingCart', '/compras', true, 20)
ON CONFLICT (slug) DO NOTHING;

-- Status enum
DO $$ BEGIN
  CREATE TYPE public.compra_status AS ENUM (
    'solicitacao','analise','negada','pendente_aprovacao','aprovada','em_andamento','a_receber','finalizado'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Compras table
CREATE TABLE IF NOT EXISTS public.compras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status public.compra_status NOT NULL DEFAULT 'solicitacao',
  ordem INTEGER NOT NULL DEFAULT 0,
  titulo TEXT,
  solicitante TEXT,
  solicitante_id UUID,
  fornecedor TEXT,
  fornecedor_id UUID,
  documento TEXT,
  comprador TEXT,
  data_solicitacao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_compra DATE,
  parcelamento TEXT,
  condicao_pagamento TEXT,
  valor_total NUMERIC,
  observacoes TEXT,
  motivo_negacao TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compras_status ON public.compras(status);

CREATE TABLE IF NOT EXISTS public.compra_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id UUID NOT NULL REFERENCES public.compras(id) ON DELETE CASCADE,
  item_id UUID,
  descricao TEXT NOT NULL,
  quantidade NUMERIC NOT NULL DEFAULT 1,
  unidade TEXT,
  valor_unitario NUMERIC,
  recebido BOOLEAN NOT NULL DEFAULT false,
  quantidade_recebida NUMERIC NOT NULL DEFAULT 0,
  recebido_em TIMESTAMPTZ,
  recebido_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compra_itens_compra ON public.compra_itens(compra_id);

ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compra_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compras module access" ON public.compras
  FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(), 'compras') OR public.has_module_access(auth.uid(), 'estoque'))
  WITH CHECK (public.has_module_access(auth.uid(), 'compras') OR public.has_module_access(auth.uid(), 'estoque'));

CREATE POLICY "compra_itens module access" ON public.compra_itens
  FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(), 'compras') OR public.has_module_access(auth.uid(), 'estoque'))
  WITH CHECK (public.has_module_access(auth.uid(), 'compras') OR public.has_module_access(auth.uid(), 'estoque'));

CREATE TRIGGER compras_set_updated_at
  BEFORE UPDATE ON public.compras
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
