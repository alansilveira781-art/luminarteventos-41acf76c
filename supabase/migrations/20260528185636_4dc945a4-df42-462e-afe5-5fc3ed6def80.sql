-- Extensão para chamadas HTTP a partir do banco
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1) Tabela de assinaturas de push (dispositivos)
CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own push subscriptions - select"
ON public.push_subscriptions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users manage their own push subscriptions - insert"
ON public.push_subscriptions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage their own push subscriptions - update"
ON public.push_subscriptions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users manage their own push subscriptions - delete"
ON public.push_subscriptions FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX idx_push_subscriptions_user ON public.push_subscriptions(user_id);

CREATE TRIGGER push_subscriptions_updated_at
BEFORE UPDATE ON public.push_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Alerta de estoque: ao mudar para baixo/sem estoque, notifica usuários do módulo estoque
CREATE OR REPLACE FUNCTION public.notify_stock_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_modulo_id uuid;
  v_label text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('baixo_estoque','sem_estoque') THEN

    v_label := CASE WHEN NEW.status = 'sem_estoque' THEN 'Sem estoque' ELSE 'Estoque baixo' END;

    SELECT id INTO v_modulo_id FROM public.modulos WHERE slug = 'estoque' AND ativo = true;
    IF v_modulo_id IS NULL THEN RETURN NEW; END IF;

    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, link)
    SELECT um.user_id,
           'estoque_alerta',
           'Alerta de estoque: ' || v_label,
           NEW.nome || ' está com ' || v_label || ' (' || COALESCE(NEW.quantidade_atual,0) || ' em estoque).',
           '/estoque?item=' || NEW.id
    FROM public.user_modulos um
    WHERE um.modulo_id = v_modulo_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_stock_alert
AFTER UPDATE OF status ON public.itens
FOR EACH ROW EXECUTE FUNCTION public.notify_stock_alert();

-- 3) Disparo do push ao criar uma notificação
CREATE OR REPLACE FUNCTION public.dispatch_push_on_notificacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://project--6426c238-9a04-43ca-bcba-50cca625fad7.lovable.app/api/public/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNreXhydXRveHhkYXpwaHNiaHdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0OTgzNzEsImV4cCI6MjA5MzA3NDM3MX0.NnHUXmBFrDH449bb61plzBzXKW3kjnaVhR4j1a7-5yQ'
    ),
    body := jsonb_build_object('notificacao_id', NEW.id::text)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_dispatch_push
AFTER INSERT ON public.notificacoes
FOR EACH ROW EXECUTE FUNCTION public.dispatch_push_on_notificacao();