
CREATE TABLE IF NOT EXISTS public.comercial_bonificacao_fechamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano int NOT NULL,
  mes text NOT NULL,
  fechado_em timestamptz NOT NULL DEFAULT now(),
  fechado_por uuid,
  fechado_por_nome text,
  total_geral numeric,
  CONSTRAINT comercial_bonif_fechamento_unico UNIQUE (ano, mes)
);
GRANT SELECT, INSERT ON public.comercial_bonificacao_fechamento TO authenticated;
GRANT ALL ON public.comercial_bonificacao_fechamento TO service_role;
ALTER TABLE public.comercial_bonificacao_fechamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bonif_fech_select" ON public.comercial_bonificacao_fechamento
  FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'comercial'));

CREATE POLICY "bonif_fech_insert" ON public.comercial_bonificacao_fechamento
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.is_module_admin(auth.uid(), 'comercial')
  );

CREATE TABLE IF NOT EXISTS public.comercial_bonificacao_fechamento_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fechamento_id uuid NOT NULL REFERENCES public.comercial_bonificacao_fechamento(id) ON DELETE CASCADE,
  venda_id uuid,
  nome_evento text,
  data_evento date,
  categoria text,
  produtor_id uuid,
  produtor_nome text,
  complexidade int,
  valor_final numeric
);
GRANT SELECT, INSERT ON public.comercial_bonificacao_fechamento_itens TO authenticated;
GRANT ALL ON public.comercial_bonificacao_fechamento_itens TO service_role;
ALTER TABLE public.comercial_bonificacao_fechamento_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bonif_fech_itens_select" ON public.comercial_bonificacao_fechamento_itens
  FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'comercial'));

CREATE POLICY "bonif_fech_itens_insert" ON public.comercial_bonificacao_fechamento_itens
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.is_module_admin(auth.uid(), 'comercial')
  );

CREATE INDEX IF NOT EXISTS idx_bonif_fech_itens_fechamento ON public.comercial_bonificacao_fechamento_itens(fechamento_id);
