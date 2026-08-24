CREATE TABLE public.master_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.master_admins TO authenticated;
GRANT ALL ON public.master_admins TO service_role;
ALTER TABLE public.master_admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_master_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.master_admins WHERE user_id = _user_id)
$$;

CREATE POLICY "master_admins_select" ON public.master_admins
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_master_admin(auth.uid()));
CREATE POLICY "master_admins_insert" ON public.master_admins
  FOR INSERT TO authenticated
  WITH CHECK (public.is_master_admin(auth.uid()));
CREATE POLICY "master_admins_delete" ON public.master_admins
  FOR DELETE TO authenticated
  USING (public.is_master_admin(auth.uid()));

INSERT INTO public.master_admins (user_id) VALUES
  ('405b2005-f400-495e-8f9c-7c2ca3982534'),
  ('7df29f9f-beb0-4710-9036-17996e9cbd82')
ON CONFLICT DO NOTHING;

CREATE TABLE public.assistente_conversas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo text NOT NULL DEFAULT 'Nova conversa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistente_conversas TO authenticated;
GRANT ALL ON public.assistente_conversas TO service_role;
ALTER TABLE public.assistente_conversas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assistente_conversas_own" ON public.assistente_conversas
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.is_master_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() AND public.is_master_admin(auth.uid()));

CREATE TABLE public.assistente_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid NOT NULL REFERENCES public.assistente_conversas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  conteudo text NOT NULL,
  ferramentas jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_assistente_mensagens_conversa ON public.assistente_mensagens(conversa_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistente_mensagens TO authenticated;
GRANT ALL ON public.assistente_mensagens TO service_role;
ALTER TABLE public.assistente_mensagens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assistente_mensagens_own" ON public.assistente_mensagens
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.is_master_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() AND public.is_master_admin(auth.uid()));

CREATE TRIGGER assistente_conversas_updated_at
  BEFORE UPDATE ON public.assistente_conversas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();