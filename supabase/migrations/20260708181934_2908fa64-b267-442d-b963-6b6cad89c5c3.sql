CREATE TABLE public.demanda_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demanda_id uuid NOT NULL REFERENCES public.demandas(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.itens(id),
  descricao text,
  unidade text,
  quantidade numeric NOT NULL DEFAULT 0,
  valor_unitario numeric,
  recebido boolean NOT NULL DEFAULT false,
  quantidade_recebida numeric NOT NULL DEFAULT 0,
  recebido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_demanda_itens_demanda ON public.demanda_itens(demanda_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.demanda_itens TO authenticated;
GRANT ALL ON public.demanda_itens TO service_role;

ALTER TABLE public.demanda_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demanda_itens module access"
ON public.demanda_itens
FOR ALL
TO authenticated
USING (
  public.has_module_access(auth.uid(), 'financeiro')
  OR public.has_module_access(auth.uid(), 'estoque')
)
WITH CHECK (
  public.has_module_access(auth.uid(), 'financeiro')
  OR public.has_module_access(auth.uid(), 'estoque')
);