
CREATE TABLE public.notification_mutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  modulo_slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, modulo_slug)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_mutes TO authenticated;
GRANT ALL ON public.notification_mutes TO service_role;

ALTER TABLE public.notification_mutes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own mutes" ON public.notification_mutes
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Admins manage mutes" ON public.notification_mutes
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Users manage own mutes" ON public.notification_mutes
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Update stock alert trigger to skip muted users
CREATE OR REPLACE FUNCTION public.notify_stock_alert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    WHERE um.modulo_id = v_modulo_id
      AND NOT EXISTS (
        SELECT 1 FROM public.notification_mutes nm
        WHERE nm.user_id = um.user_id AND nm.modulo_slug = 'estoque'
      );
  END IF;
  RETURN NEW;
END;
$function$;
