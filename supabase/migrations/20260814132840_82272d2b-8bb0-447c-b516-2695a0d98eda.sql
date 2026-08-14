ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fuso_horario text NOT NULL DEFAULT 'America/Fortaleza';

CREATE TABLE public.lembretes_projetos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  nome text NOT NULL,
  cor text NOT NULL DEFAULT '#2C3E50',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lembretes_projetos TO authenticated;
GRANT ALL ON public.lembretes_projetos TO service_role;

ALTER TABLE public.lembretes_projetos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lembretes_projetos_select_own" ON public.lembretes_projetos
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "lembretes_projetos_insert_own" ON public.lembretes_projetos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lembretes_projetos_update_own" ON public.lembretes_projetos
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lembretes_projetos_delete_own" ON public.lembretes_projetos
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.lembretes_tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  projeto_id uuid REFERENCES public.lembretes_projetos(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  descricao text,
  data_hora timestamptz NOT NULL,
  dia_inteiro boolean NOT NULL DEFAULT false,
  duracao_min integer NOT NULL DEFAULT 30,
  lembrete_min integer NOT NULL DEFAULT 15,
  recorrencia text NOT NULL DEFAULT 'nenhuma' CHECK (recorrencia IN ('nenhuma','diaria','semanal','mensal')),
  prioridade text NOT NULL DEFAULT 'normal' CHECK (prioridade IN ('baixa','normal','alta')),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','concluida','cancelada')),
  concluida_em timestamptz,
  notificada_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lembretes_tarefas TO authenticated;
GRANT ALL ON public.lembretes_tarefas TO service_role;

ALTER TABLE public.lembretes_tarefas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lembretes_tarefas_select_own" ON public.lembretes_tarefas
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "lembretes_tarefas_insert_own" ON public.lembretes_tarefas
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lembretes_tarefas_update_own" ON public.lembretes_tarefas
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lembretes_tarefas_delete_own" ON public.lembretes_tarefas
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_lembretes_tarefas_user_data ON public.lembretes_tarefas (user_id, data_hora);
CREATE INDEX idx_lembretes_projetos_user ON public.lembretes_projetos (user_id);

CREATE TRIGGER lembretes_projetos_set_updated_at BEFORE UPDATE ON public.lembretes_projetos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER lembretes_tarefas_set_updated_at BEFORE UPDATE ON public.lembretes_tarefas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();