
-- Produtores
CREATE TABLE IF NOT EXISTS public.comercial_produtores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comercial_produtores TO authenticated;
GRANT ALL ON public.comercial_produtores TO service_role;
ALTER TABLE public.comercial_produtores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comercial_produtores_select" ON public.comercial_produtores FOR SELECT TO authenticated USING (public.has_module_access(auth.uid(), 'comercial'));
CREATE POLICY "comercial_produtores_insert" ON public.comercial_produtores FOR INSERT TO authenticated WITH CHECK (public.has_module_access(auth.uid(), 'comercial'));
CREATE POLICY "comercial_produtores_update" ON public.comercial_produtores FOR UPDATE TO authenticated USING (public.has_module_access(auth.uid(), 'comercial')) WITH CHECK (public.has_module_access(auth.uid(), 'comercial'));
CREATE POLICY "comercial_produtores_delete" ON public.comercial_produtores FOR DELETE TO authenticated USING (public.has_module_access(auth.uid(), 'comercial'));

-- Alçadas de complexidade
CREATE TABLE IF NOT EXISTS public.comercial_alcadas_complexidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria text NOT NULL,
  nivel int NOT NULL CHECK (nivel BETWEEN 1 AND 6),
  valor_ate numeric,
  multiplicador numeric NOT NULL DEFAULT 150,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (categoria, nivel)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comercial_alcadas_complexidade TO authenticated;
GRANT ALL ON public.comercial_alcadas_complexidade TO service_role;
ALTER TABLE public.comercial_alcadas_complexidade ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comercial_alcadas_select" ON public.comercial_alcadas_complexidade FOR SELECT TO authenticated USING (public.has_module_access(auth.uid(), 'comercial'));
CREATE POLICY "comercial_alcadas_insert" ON public.comercial_alcadas_complexidade FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "comercial_alcadas_update" ON public.comercial_alcadas_complexidade FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "comercial_alcadas_delete" ON public.comercial_alcadas_complexidade FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
CREATE TRIGGER trg_alcadas_updated_at BEFORE UPDATE ON public.comercial_alcadas_complexidade FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed das faixas
INSERT INTO public.comercial_alcadas_complexidade (categoria, nivel, valor_ate, multiplicador) VALUES
  ('Stand', 1, 40000, 150), ('Stand', 2, 85000, 150), ('Stand', 3, 140000, 150), ('Stand', 4, 200000, 150), ('Stand', 5, 280000, 150), ('Stand', 6, NULL, 150),
  ('Corporativo', 1, 40000, 150), ('Corporativo', 2, 65000, 150), ('Corporativo', 3, 90000, 150), ('Corporativo', 4, 180000, 150), ('Corporativo', 5, 260000, 150), ('Corporativo', 6, NULL, 150),
  ('Social', 1, 35000, 150), ('Social', 2, 75000, 150), ('Social', 3, 120000, 150), ('Social', 4, 170000, 150), ('Social', 5, 230000, 150), ('Social', 6, NULL, 150),
  ('Cenografia', 1, 20000, 150), ('Cenografia', 2, 40000, 150), ('Cenografia', 3, 65000, 150), ('Cenografia', 4, 95000, 150), ('Cenografia', 5, 130000, 150), ('Cenografia', 6, NULL, 150),
  ('Casamento', 1, 35000, 150), ('Casamento', 2, 75000, 150), ('Casamento', 3, 120000, 150), ('Casamento', 4, 170000, 150), ('Casamento', 5, 230000, 150), ('Casamento', 6, NULL, 150)
ON CONFLICT (categoria, nivel) DO NOTHING;

-- Bonificação por produção (por evento+produtor)
CREATE TABLE IF NOT EXISTS public.comercial_bonificacao_producao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id uuid,
  nome_evento text NOT NULL,
  data_evento date,
  categoria text,
  produtor_id uuid REFERENCES public.comercial_produtores(id) ON DELETE CASCADE,
  produtor_nome text,
  complexidade int CHECK (complexidade BETWEEN 1 AND 6),
  valor_final numeric,
  ano int,
  mes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (venda_id, produtor_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comercial_bonificacao_producao TO authenticated;
GRANT ALL ON public.comercial_bonificacao_producao TO service_role;
ALTER TABLE public.comercial_bonificacao_producao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comercial_bonif_select" ON public.comercial_bonificacao_producao FOR SELECT TO authenticated USING (public.has_module_access(auth.uid(), 'comercial'));
CREATE POLICY "comercial_bonif_insert" ON public.comercial_bonificacao_producao FOR INSERT TO authenticated WITH CHECK (public.has_module_access(auth.uid(), 'comercial'));
CREATE POLICY "comercial_bonif_update" ON public.comercial_bonificacao_producao FOR UPDATE TO authenticated USING (public.has_module_access(auth.uid(), 'comercial')) WITH CHECK (public.has_module_access(auth.uid(), 'comercial'));
CREATE POLICY "comercial_bonif_delete" ON public.comercial_bonificacao_producao FOR DELETE TO authenticated USING (public.has_module_access(auth.uid(), 'comercial'));
CREATE TRIGGER trg_bonif_updated_at BEFORE UPDATE ON public.comercial_bonificacao_producao FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
