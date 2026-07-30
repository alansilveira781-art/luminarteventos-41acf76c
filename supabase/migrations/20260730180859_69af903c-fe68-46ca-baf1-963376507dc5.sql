CREATE TABLE public.compra_pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id uuid NOT NULL REFERENCES public.compras(id) ON DELETE CASCADE,
  forma text,
  parcelamento text,
  valor numeric NOT NULL DEFAULT 0,
  ordem integer NOT NULL DEFAULT 0,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compra_pagamentos TO authenticated;
GRANT ALL ON public.compra_pagamentos TO service_role;
ALTER TABLE public.compra_pagamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "compra_pagamentos module access" ON public.compra_pagamentos
  FOR ALL TO authenticated
  USING (has_module_access(auth.uid(), 'compras') OR has_module_access(auth.uid(), 'estoque'))
  WITH CHECK (has_module_access(auth.uid(), 'compras') OR has_module_access(auth.uid(), 'estoque'));
CREATE POLICY "compra_pagamentos_select_owner" ON public.compra_pagamentos
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.compras c
    WHERE c.id = compra_pagamentos.compra_id
      AND (auth.uid() = c.created_by
        OR auth.uid() = c.solicitante_id
        OR (c.solicitante IS NOT NULL AND lower(c.solicitante) = lower(auth.jwt() ->> 'email'))
        OR (c.solicitante_email IS NOT NULL AND lower(c.solicitante_email) = lower(auth.jwt() ->> 'email')))
  ));
CREATE INDEX idx_compra_pagamentos_compra ON public.compra_pagamentos(compra_id);
CREATE TRIGGER trg_compra_pagamentos_updated_at BEFORE UPDATE ON public.compra_pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.demanda_pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demanda_id uuid NOT NULL REFERENCES public.demandas(id) ON DELETE CASCADE,
  forma text,
  parcelamento text,
  valor numeric NOT NULL DEFAULT 0,
  ordem integer NOT NULL DEFAULT 0,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demanda_pagamentos TO authenticated;
GRANT ALL ON public.demanda_pagamentos TO service_role;
ALTER TABLE public.demanda_pagamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demanda_pagamentos module access" ON public.demanda_pagamentos
  FOR ALL TO authenticated
  USING (has_module_access(auth.uid(), 'financeiro') OR has_module_access(auth.uid(), 'estoque'))
  WITH CHECK (has_module_access(auth.uid(), 'financeiro') OR has_module_access(auth.uid(), 'estoque'));
CREATE POLICY "demanda_pagamentos_select_owner" ON public.demanda_pagamentos
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.demandas d
    WHERE d.id = demanda_pagamentos.demanda_id
      AND (auth.uid() = d.created_by
        OR auth.uid() = d.solicitante_id
        OR (d.solicitante IS NOT NULL AND lower(d.solicitante) = lower(auth.jwt() ->> 'email'))
        OR (d.solicitante_email IS NOT NULL AND lower(d.solicitante_email) = lower(auth.jwt() ->> 'email')))
  ));
CREATE INDEX idx_demanda_pagamentos_demanda ON public.demanda_pagamentos(demanda_id);
CREATE TRIGGER trg_demanda_pagamentos_updated_at BEFORE UPDATE ON public.demanda_pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.compra_pagamentos (compra_id, forma, parcelamento, valor, ordem)
SELECT c.id, c.condicao_pagamento, c.parcelamento, COALESCE(c.valor_total, 0), 0
FROM public.compras c
WHERE COALESCE(c.condicao_pagamento, '') <> '' OR COALESCE(c.parcelamento, '') <> '';

INSERT INTO public.demanda_pagamentos (demanda_id, forma, parcelamento, valor, ordem)
SELECT d.id, d.condicao_pagamento, d.parcelamento, COALESCE(d.valor_total, 0), 0
FROM public.demandas d
WHERE COALESCE(d.condicao_pagamento, '') <> '' OR COALESCE(d.parcelamento, '') <> '';