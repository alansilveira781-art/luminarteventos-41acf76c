CREATE TABLE IF NOT EXISTS public.compras_exclusoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id uuid,
  compra_numero integer,
  titulo text,
  fornecedor text,
  valor_total numeric,
  status_no_momento public.compra_status,
  dados_json jsonb,
  motivo text NOT NULL,
  excluido_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  excluido_por_nome text,
  excluido_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.compras_exclusoes TO authenticated;
GRANT ALL ON public.compras_exclusoes TO service_role;

CREATE INDEX IF NOT EXISTS idx_compras_exclusoes_data ON public.compras_exclusoes(excluido_em DESC);

ALTER TABLE public.compras_exclusoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compras_exclusoes read" ON public.compras_exclusoes
  FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'compras') OR public.has_module_access(auth.uid(), 'estoque'));

CREATE POLICY "compras_exclusoes insert" ON public.compras_exclusoes
  FOR INSERT TO authenticated
  WITH CHECK (public.has_module_access(auth.uid(), 'compras') OR public.has_module_access(auth.uid(), 'estoque'));

DROP POLICY IF EXISTS compras_delete_owner_or_admin ON public.compras;

CREATE POLICY compras_delete_owner_or_admin ON public.compras
FOR DELETE TO authenticated
USING (
  auth.uid() = created_by
  OR public.is_admin(auth.uid())
  OR public.is_module_admin(auth.uid(), 'compras')
  OR auth.uid() = responsavel_id
  OR auth.uid() IN (
    SELECT csd.responsavel_id
    FROM public.compras_status_defaults csd
    WHERE csd.status = compras.status
  )
);