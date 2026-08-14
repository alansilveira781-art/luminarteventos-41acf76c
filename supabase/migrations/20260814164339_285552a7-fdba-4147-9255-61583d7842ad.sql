CREATE TABLE public.estoque_solicitacoes_saida (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero serial NOT NULL,
  data_retirada date NOT NULL,
  solicitante_id uuid REFERENCES public.solicitantes(id) ON DELETE SET NULL,
  solicitante_nome text,
  is_evento boolean NOT NULL DEFAULT false,
  evento_projeto text,
  finalidade_livre text,
  observacoes text,
  status text NOT NULL DEFAULT 'pendente',
  motivo_recusa text,
  validado_por uuid,
  validado_em timestamptz,
  requisicao_numero integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.estoque_solicitacoes_saida_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id uuid NOT NULL REFERENCES public.estoque_solicitacoes_saida(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  quantidade numeric NOT NULL DEFAULT 1,
  item_id uuid REFERENCES public.itens(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.estoque_solicitacoes_saida TO authenticated;
GRANT ALL ON public.estoque_solicitacoes_saida TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estoque_solicitacoes_saida_itens TO authenticated;
GRANT ALL ON public.estoque_solicitacoes_saida_itens TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.estoque_solicitacoes_saida_numero_seq TO authenticated, service_role;

ALTER TABLE public.estoque_solicitacoes_saida ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_solicitacoes_saida_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estoque module read solicitacoes saida"
  ON public.estoque_solicitacoes_saida FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'estoque'));
CREATE POLICY "estoque module write solicitacoes saida"
  ON public.estoque_solicitacoes_saida FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'estoque'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'estoque'));
CREATE POLICY "estoque module insert solicitacoes saida"
  ON public.estoque_solicitacoes_saida FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'estoque'));
CREATE POLICY "estoque admin delete solicitacoes saida"
  ON public.estoque_solicitacoes_saida FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'estoque'));

CREATE POLICY "estoque module read solicitacoes saida itens"
  ON public.estoque_solicitacoes_saida_itens FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'estoque'));
CREATE POLICY "estoque module insert solicitacoes saida itens"
  ON public.estoque_solicitacoes_saida_itens FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'estoque'));
CREATE POLICY "estoque module update solicitacoes saida itens"
  ON public.estoque_solicitacoes_saida_itens FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'estoque'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'estoque'));
CREATE POLICY "estoque admin delete solicitacoes saida itens"
  ON public.estoque_solicitacoes_saida_itens FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'estoque'));

CREATE TRIGGER set_updated_at_estoque_solicitacoes_saida
  BEFORE UPDATE ON public.estoque_solicitacoes_saida
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_estoque_solicitacoes_saida_itens
  BEFORE UPDATE ON public.estoque_solicitacoes_saida_itens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_solic_saida_status ON public.estoque_solicitacoes_saida(status, data_retirada DESC);
CREATE INDEX idx_solic_saida_itens_sol ON public.estoque_solicitacoes_saida_itens(solicitacao_id);