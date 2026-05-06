
-- Cotação por item de compra
ALTER TABLE public.compra_itens ADD COLUMN IF NOT EXISTS cotacao text;

-- Parcelamentos
CREATE TABLE IF NOT EXISTS public.parcelamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.parcelamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "compras module access" ON public.parcelamentos
  FOR ALL TO authenticated
  USING (has_module_access(auth.uid(),'compras') OR has_module_access(auth.uid(),'estoque'))
  WITH CHECK (has_module_access(auth.uid(),'compras') OR has_module_access(auth.uid(),'estoque'));

-- Condições de pagamento
CREATE TABLE IF NOT EXISTS public.condicoes_pagamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.condicoes_pagamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "compras module access" ON public.condicoes_pagamento
  FOR ALL TO authenticated
  USING (has_module_access(auth.uid(),'compras') OR has_module_access(auth.uid(),'estoque'))
  WITH CHECK (has_module_access(auth.uid(),'compras') OR has_module_access(auth.uid(),'estoque'));

-- Histórico de compras
CREATE TABLE IF NOT EXISTS public.compra_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id uuid NOT NULL,
  user_id uuid,
  user_nome text,
  acao text NOT NULL,
  status_anterior compra_status,
  status_novo compra_status,
  detalhes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_compra_historico_compra ON public.compra_historico(compra_id, created_at DESC);
ALTER TABLE public.compra_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "compras module access" ON public.compra_historico
  FOR ALL TO authenticated
  USING (has_module_access(auth.uid(),'compras') OR has_module_access(auth.uid(),'estoque'))
  WITH CHECK (has_module_access(auth.uid(),'compras') OR has_module_access(auth.uid(),'estoque'));

-- Comentários
CREATE TABLE IF NOT EXISTS public.compra_comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id uuid NOT NULL,
  user_id uuid,
  user_nome text,
  texto text NOT NULL,
  mencoes uuid[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_compra_comentarios_compra ON public.compra_comentarios(compra_id, created_at DESC);
ALTER TABLE public.compra_comentarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "compras module access" ON public.compra_comentarios
  FOR ALL TO authenticated
  USING (has_module_access(auth.uid(),'compras') OR has_module_access(auth.uid(),'estoque'))
  WITH CHECK (has_module_access(auth.uid(),'compras') OR has_module_access(auth.uid(),'estoque'));

-- Notificações in-app
CREATE TABLE IF NOT EXISTS public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tipo text NOT NULL,
  titulo text NOT NULL,
  mensagem text,
  link text,
  lida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notificacoes_user ON public.notificacoes(user_id, lida, created_at DESC);
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notificacoes self" ON public.notificacoes
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_admin(auth.uid()))
  WITH CHECK (true);

-- Trigger para registrar mudança de status no histórico
CREATE OR REPLACE FUNCTION public.compras_log_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_nome text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT display_name INTO v_nome FROM public.profiles WHERE id = auth.uid();
    INSERT INTO public.compra_historico(compra_id, user_id, user_nome, acao, status_anterior, status_novo)
    VALUES (NEW.id, auth.uid(), v_nome, 'mudou_status', OLD.status, NEW.status);
  ELSIF TG_OP = 'INSERT' THEN
    SELECT display_name INTO v_nome FROM public.profiles WHERE id = auth.uid();
    INSERT INTO public.compra_historico(compra_id, user_id, user_nome, acao, status_novo)
    VALUES (NEW.id, auth.uid(), v_nome, 'criou', NEW.status);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_compras_status ON public.compras;
CREATE TRIGGER trg_compras_status
AFTER INSERT OR UPDATE OF status ON public.compras
FOR EACH ROW EXECUTE FUNCTION public.compras_log_status_change();

-- Realtime para notificações e comentários
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.compra_comentarios;
ALTER PUBLICATION supabase_realtime ADD TABLE public.compra_historico;
