
-- ============ ENUMS ============
CREATE TYPE item_status AS ENUM ('disponivel','baixo_estoque','sem_estoque','em_manutencao','inativo');
CREATE TYPE entity_status AS ENUM ('ativo','inativo');
CREATE TYPE movement_kind AS ENUM ('entrada','saida','devolucao','ajuste');
CREATE TYPE entrada_tipo AS ENUM ('compra','doacao','ajuste','retorno','transferencia','outros');
CREATE TYPE saida_tipo AS ENUM ('evento','emprestimo','consumo','perda','quebra','manutencao','transferencia','outros');
CREATE TYPE saida_status AS ENUM ('aberta','parcialmente_devolvida','devolvida','finalizada','cancelada');
CREATE TYPE devolucao_condicao AS ENUM ('perfeito','danificado','quebrado','faltando_peca','em_manutencao','perdido');

-- ============ FORNECEDORES ============
CREATE TABLE public.fornecedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  documento TEXT,
  contato_nome TEXT,
  telefone TEXT,
  email TEXT,
  endereco TEXT,
  tipo_fornecimento TEXT,
  status entity_status NOT NULL DEFAULT 'ativo',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ SOLICITANTES ============
CREATE TABLE public.solicitantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  setor TEXT,
  cargo TEXT,
  telefone TEXT,
  email TEXT,
  status entity_status NOT NULL DEFAULT 'ativo',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ ITENS ============
CREATE TABLE public.itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  categoria TEXT,
  subcategoria TEXT,
  descricao TEXT,
  unidade TEXT NOT NULL DEFAULT 'un',
  quantidade_atual NUMERIC NOT NULL DEFAULT 0,
  quantidade_minima NUMERIC NOT NULL DEFAULT 0,
  localizacao TEXT,
  status item_status NOT NULL DEFAULT 'disponivel',
  observacoes TEXT,
  foto_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_itens_nome ON public.itens (nome);
CREATE INDEX idx_itens_categoria ON public.itens (categoria);

-- ============ MOVIMENTACOES (entradas, saidas, devolucoes, ajustes) ============
CREATE TABLE public.movimentacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo movement_kind NOT NULL,
  data_movimento TIMESTAMPTZ NOT NULL DEFAULT now(),
  item_id UUID NOT NULL REFERENCES public.itens(id) ON DELETE RESTRICT,
  quantidade NUMERIC NOT NULL CHECK (quantidade > 0),

  -- entrada
  entrada_tipo entrada_tipo,
  fornecedor_id UUID REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  valor_unitario NUMERIC,
  nota_fiscal TEXT,

  -- saida
  saida_tipo saida_tipo,
  solicitante_id UUID REFERENCES public.solicitantes(id) ON DELETE SET NULL,
  quantidade_solicitada NUMERIC,
  finalidade TEXT,
  responsavel_retirada TEXT,
  data_prevista_devolucao DATE,
  saida_status saida_status,

  -- devolucao
  saida_origem_id UUID REFERENCES public.movimentacoes(id) ON DELETE SET NULL,
  condicao devolucao_condicao,
  responsavel_recebimento TEXT,

  -- comum
  responsavel_lancamento TEXT,
  observacoes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mov_item ON public.movimentacoes (item_id);
CREATE INDEX idx_mov_tipo ON public.movimentacoes (tipo);
CREATE INDEX idx_mov_data ON public.movimentacoes (data_movimento DESC);
CREATE INDEX idx_mov_saida_origem ON public.movimentacoes (saida_origem_id);

-- ============ TRIGGER: updated_at ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_fornecedores_updated BEFORE UPDATE ON public.fornecedores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_solicitantes_updated BEFORE UPDATE ON public.solicitantes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_itens_updated BEFORE UPDATE ON public.itens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ FUNCAO: recalcular status do item ============
CREATE OR REPLACE FUNCTION public.refresh_item_status(p_item_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE q NUMERIC; m NUMERIC; s item_status;
BEGIN
  SELECT quantidade_atual, quantidade_minima, status INTO q, m, s
    FROM public.itens WHERE id = p_item_id;
  IF s IN ('em_manutencao','inativo') THEN RETURN; END IF;
  IF q <= 0 THEN
    UPDATE public.itens SET status='sem_estoque' WHERE id=p_item_id;
  ELSIF q <= m THEN
    UPDATE public.itens SET status='baixo_estoque' WHERE id=p_item_id;
  ELSE
    UPDATE public.itens SET status='disponivel' WHERE id=p_item_id;
  END IF;
END; $$;

-- ============ TRIGGER: aplicar movimentacao ao estoque ============
CREATE OR REPLACE FUNCTION public.apply_movement()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE delta NUMERIC := 0; v_cond devolucao_condicao;
BEGIN
  IF NEW.tipo = 'entrada' THEN
    delta := NEW.quantidade;
  ELSIF NEW.tipo = 'saida' THEN
    delta := -NEW.quantidade;
    IF NEW.saida_status IS NULL THEN NEW.saida_status := 'aberta'; END IF;
  ELSIF NEW.tipo = 'devolucao' THEN
    -- Apenas itens em condição que retornam ao estoque "vivo"
    IF NEW.condicao IN ('perfeito') THEN
      delta := NEW.quantidade;
    ELSIF NEW.condicao IN ('danificado','quebrado','faltando_peca','em_manutencao') THEN
      delta := NEW.quantidade; -- volta fisicamente, mas item marcado
    ELSE
      delta := 0; -- perdido: não retorna
    END IF;
  ELSIF NEW.tipo = 'ajuste' THEN
    delta := NEW.quantidade; -- usar negativo via outro registro se quiser baixar
  END IF;

  UPDATE public.itens
    SET quantidade_atual = quantidade_atual + delta
    WHERE id = NEW.item_id;

  PERFORM public.refresh_item_status(NEW.item_id);

  -- Se for devolução com condição que requer manutenção, marca o item
  IF NEW.tipo = 'devolucao' AND NEW.condicao IN ('danificado','quebrado','faltando_peca','em_manutencao') THEN
    UPDATE public.itens SET status='em_manutencao' WHERE id=NEW.item_id;
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER trg_apply_movement
  BEFORE INSERT ON public.movimentacoes
  FOR EACH ROW EXECUTE FUNCTION public.apply_movement();

-- ============ TRIGGER: atualizar status da saida origem após devolucao ============
CREATE OR REPLACE FUNCTION public.refresh_saida_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE total_devolvido NUMERIC; qtd_saida NUMERIC; v_origem UUID;
BEGIN
  v_origem := NEW.saida_origem_id;
  IF v_origem IS NULL OR NEW.tipo <> 'devolucao' THEN RETURN NEW; END IF;

  SELECT quantidade INTO qtd_saida FROM public.movimentacoes WHERE id = v_origem;
  SELECT COALESCE(SUM(quantidade),0) INTO total_devolvido
    FROM public.movimentacoes
    WHERE saida_origem_id = v_origem AND tipo='devolucao';

  IF total_devolvido >= qtd_saida THEN
    UPDATE public.movimentacoes SET saida_status='devolvida' WHERE id=v_origem;
  ELSE
    UPDATE public.movimentacoes SET saida_status='parcialmente_devolvida' WHERE id=v_origem;
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER trg_refresh_saida_status
  AFTER INSERT ON public.movimentacoes
  FOR EACH ROW EXECUTE FUNCTION public.refresh_saida_status();

-- ============ RLS: acesso publico (uso interno sem login) ============
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public all fornecedores" ON public.fornecedores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public all solicitantes" ON public.solicitantes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public all itens" ON public.itens FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public all movimentacoes" ON public.movimentacoes FOR ALL USING (true) WITH CHECK (true);
