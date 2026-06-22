
-- 1) Cadastros novos
CREATE TABLE public.comercial_vendedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  percentual_comissao numeric NOT NULL DEFAULT 0 CHECK (percentual_comissao >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comercial_vendedores TO authenticated;
GRANT ALL ON public.comercial_vendedores TO service_role;
ALTER TABLE public.comercial_vendedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comercial_vendedores_select" ON public.comercial_vendedores
  FOR SELECT TO authenticated USING (has_module_access(auth.uid(), 'comercial'));
CREATE POLICY "comercial_vendedores_insert" ON public.comercial_vendedores
  FOR INSERT TO authenticated WITH CHECK (has_module_access(auth.uid(), 'comercial'));
CREATE POLICY "comercial_vendedores_update" ON public.comercial_vendedores
  FOR UPDATE TO authenticated
  USING (has_module_access(auth.uid(), 'comercial'))
  WITH CHECK (has_module_access(auth.uid(), 'comercial'));
CREATE POLICY "comercial_vendedores_delete" ON public.comercial_vendedores
  FOR DELETE TO authenticated USING (has_module_access(auth.uid(), 'comercial'));

CREATE TABLE public.comercial_cerimoniais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  percentual_bv numeric NOT NULL DEFAULT 0 CHECK (percentual_bv >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comercial_cerimoniais TO authenticated;
GRANT ALL ON public.comercial_cerimoniais TO service_role;
ALTER TABLE public.comercial_cerimoniais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comercial_cerimoniais_select" ON public.comercial_cerimoniais
  FOR SELECT TO authenticated USING (has_module_access(auth.uid(), 'comercial'));
CREATE POLICY "comercial_cerimoniais_insert" ON public.comercial_cerimoniais
  FOR INSERT TO authenticated WITH CHECK (has_module_access(auth.uid(), 'comercial'));
CREATE POLICY "comercial_cerimoniais_update" ON public.comercial_cerimoniais
  FOR UPDATE TO authenticated
  USING (has_module_access(auth.uid(), 'comercial'))
  WITH CHECK (has_module_access(auth.uid(), 'comercial'));
CREATE POLICY "comercial_cerimoniais_delete" ON public.comercial_cerimoniais
  FOR DELETE TO authenticated USING (has_module_access(auth.uid(), 'comercial'));

CREATE TABLE public.comercial_decoradores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comercial_decoradores TO authenticated;
GRANT ALL ON public.comercial_decoradores TO service_role;
ALTER TABLE public.comercial_decoradores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comercial_decoradores_select" ON public.comercial_decoradores
  FOR SELECT TO authenticated USING (has_module_access(auth.uid(), 'comercial'));
CREATE POLICY "comercial_decoradores_insert" ON public.comercial_decoradores
  FOR INSERT TO authenticated WITH CHECK (has_module_access(auth.uid(), 'comercial'));
CREATE POLICY "comercial_decoradores_update" ON public.comercial_decoradores
  FOR UPDATE TO authenticated
  USING (has_module_access(auth.uid(), 'comercial'))
  WITH CHECK (has_module_access(auth.uid(), 'comercial'));
CREATE POLICY "comercial_decoradores_delete" ON public.comercial_decoradores
  FOR DELETE TO authenticated USING (has_module_access(auth.uid(), 'comercial'));

-- 2) Coluna de comissão
ALTER TABLE public.comercial_vendas ADD COLUMN IF NOT EXISTS valor_comissao numeric NOT NULL DEFAULT 0;
