
-- 1. CLIENTES
CREATE TABLE public.comercial_clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  telefone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comercial_clientes TO authenticated;
GRANT ALL ON public.comercial_clientes TO service_role;
ALTER TABLE public.comercial_clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comercial_clientes_select" ON public.comercial_clientes
  FOR SELECT TO authenticated USING (public.has_module_access(auth.uid(), 'comercial'));
CREATE POLICY "comercial_clientes_insert" ON public.comercial_clientes
  FOR INSERT TO authenticated WITH CHECK (public.has_module_access(auth.uid(), 'comercial'));
CREATE POLICY "comercial_clientes_update" ON public.comercial_clientes
  FOR UPDATE TO authenticated USING (public.has_module_access(auth.uid(), 'comercial'))
  WITH CHECK (public.has_module_access(auth.uid(), 'comercial'));
CREATE POLICY "comercial_clientes_delete" ON public.comercial_clientes
  FOR DELETE TO authenticated USING (public.has_module_access(auth.uid(), 'comercial'));

-- 2. CATÁLOGO
CREATE TABLE public.comercial_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo_medida text NOT NULL DEFAULT 'unidade',
  valor_unitario numeric NOT NULL DEFAULT 0,
  unidade text NOT NULL DEFAULT 'un',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comercial_catalogo TO authenticated;
GRANT ALL ON public.comercial_catalogo TO service_role;
ALTER TABLE public.comercial_catalogo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comercial_catalogo_select" ON public.comercial_catalogo
  FOR SELECT TO authenticated USING (public.has_module_access(auth.uid(), 'comercial'));
CREATE POLICY "comercial_catalogo_insert" ON public.comercial_catalogo
  FOR INSERT TO authenticated WITH CHECK (public.has_module_access(auth.uid(), 'comercial'));
CREATE POLICY "comercial_catalogo_update" ON public.comercial_catalogo
  FOR UPDATE TO authenticated USING (public.has_module_access(auth.uid(), 'comercial'))
  WITH CHECK (public.has_module_access(auth.uid(), 'comercial'));
CREATE POLICY "comercial_catalogo_delete" ON public.comercial_catalogo
  FOR DELETE TO authenticated USING (public.has_module_access(auth.uid(), 'comercial'));

-- 3. CARDS
CREATE TABLE public.comercial_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES public.comercial_clientes(id) ON DELETE SET NULL,
  cliente_nome text NOT NULL DEFAULT '',
  evento_nome text NOT NULL DEFAULT '',
  evento_data_inicio date,
  evento_data_fim date,
  valor_estimado numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'lead',
  responsavel text NOT NULL DEFAULT '',
  observacoes text NOT NULL DEFAULT '',
  motivo_perda text,
  proposta_id uuid,
  data_envio date,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comercial_cards TO authenticated;
GRANT ALL ON public.comercial_cards TO service_role;
ALTER TABLE public.comercial_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comercial_cards_select" ON public.comercial_cards
  FOR SELECT TO authenticated USING (public.has_module_access(auth.uid(), 'comercial'));
CREATE POLICY "comercial_cards_insert" ON public.comercial_cards
  FOR INSERT TO authenticated WITH CHECK (public.has_module_access(auth.uid(), 'comercial'));
CREATE POLICY "comercial_cards_update" ON public.comercial_cards
  FOR UPDATE TO authenticated USING (public.has_module_access(auth.uid(), 'comercial'))
  WITH CHECK (public.has_module_access(auth.uid(), 'comercial'));
CREATE POLICY "comercial_cards_delete" ON public.comercial_cards
  FOR DELETE TO authenticated USING (public.has_module_access(auth.uid(), 'comercial'));

-- 4. PROPOSTAS
CREATE TABLE public.comercial_propostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero integer NOT NULL,
  card_id uuid REFERENCES public.comercial_cards(id) ON DELETE CASCADE,
  cliente_id uuid,
  cliente jsonb NOT NULL DEFAULT '{}'::jsonb,
  evento jsonb NOT NULL DEFAULT '{}'::jsonb,
  ambientes jsonb NOT NULL DEFAULT '[]'::jsonb,
  custos jsonb NOT NULL DEFAULT '{}'::jsonb,
  resumo jsonb NOT NULL DEFAULT '{}'::jsonb,
  responsavel text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'aguardando_aprovacao',
  parent_id uuid,
  version integer NOT NULL DEFAULT 1,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid()
);
CREATE INDEX comercial_propostas_card_idx ON public.comercial_propostas(card_id);
CREATE INDEX comercial_propostas_parent_idx ON public.comercial_propostas(parent_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comercial_propostas TO authenticated;
GRANT ALL ON public.comercial_propostas TO service_role;
ALTER TABLE public.comercial_propostas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comercial_propostas_select" ON public.comercial_propostas
  FOR SELECT TO authenticated USING (public.has_module_access(auth.uid(), 'comercial'));
CREATE POLICY "comercial_propostas_insert" ON public.comercial_propostas
  FOR INSERT TO authenticated WITH CHECK (public.has_module_access(auth.uid(), 'comercial'));
CREATE POLICY "comercial_propostas_update" ON public.comercial_propostas
  FOR UPDATE TO authenticated USING (public.has_module_access(auth.uid(), 'comercial'))
  WITH CHECK (public.has_module_access(auth.uid(), 'comercial'));
CREATE POLICY "comercial_propostas_delete" ON public.comercial_propostas
  FOR DELETE TO authenticated USING (public.has_module_access(auth.uid(), 'comercial'));

-- 5. CONSULTORES
CREATE TABLE public.comercial_consultores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comercial_consultores TO authenticated;
GRANT ALL ON public.comercial_consultores TO service_role;
ALTER TABLE public.comercial_consultores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comercial_consultores_select" ON public.comercial_consultores
  FOR SELECT TO authenticated USING (public.has_module_access(auth.uid(), 'comercial'));
CREATE POLICY "comercial_consultores_insert" ON public.comercial_consultores
  FOR INSERT TO authenticated WITH CHECK (public.has_module_access(auth.uid(), 'comercial'));
CREATE POLICY "comercial_consultores_update" ON public.comercial_consultores
  FOR UPDATE TO authenticated USING (public.has_module_access(auth.uid(), 'comercial'))
  WITH CHECK (public.has_module_access(auth.uid(), 'comercial'));
CREATE POLICY "comercial_consultores_delete" ON public.comercial_consultores
  FOR DELETE TO authenticated USING (public.has_module_access(auth.uid(), 'comercial'));

-- Seed consultores padrão
INSERT INTO public.comercial_consultores (nome) VALUES ('Pádua Costa'), ('Romulo Manoel')
  ON CONFLICT (nome) DO NOTHING;

-- 6. SEQUÊNCIA DE NUMERAÇÃO DE PROPOSTAS
CREATE TABLE public.comercial_proposta_seq (
  id boolean PRIMARY KEY DEFAULT true,
  valor integer NOT NULL DEFAULT 1000,
  CONSTRAINT seq_singleton CHECK (id)
);
GRANT SELECT, INSERT, UPDATE ON public.comercial_proposta_seq TO authenticated;
GRANT ALL ON public.comercial_proposta_seq TO service_role;
ALTER TABLE public.comercial_proposta_seq ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comercial_proposta_seq_select" ON public.comercial_proposta_seq
  FOR SELECT TO authenticated USING (public.has_module_access(auth.uid(), 'comercial'));
INSERT INTO public.comercial_proposta_seq (id, valor) VALUES (true, 1000) ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.next_proposta_numero()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v integer;
BEGIN
  IF NOT public.has_module_access(auth.uid(), 'comercial') THEN
    RAISE EXCEPTION 'Sem acesso ao módulo comercial';
  END IF;
  UPDATE public.comercial_proposta_seq SET valor = valor + 1 WHERE id = true RETURNING valor INTO v;
  RETURN v;
END;
$$;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.comercial_clientes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comercial_catalogo;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comercial_cards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comercial_propostas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comercial_consultores;
