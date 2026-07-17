
CREATE TABLE public.diaristas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  valor_hora_fortaleza numeric NOT NULL DEFAULT 0,
  valor_hora_fora numeric NOT NULL DEFAULT 0,
  chave_pix text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.diaristas TO authenticated;
GRANT ALL ON public.diaristas TO service_role;

ALTER TABLE public.diaristas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Financeiro pode gerenciar diaristas"
  ON public.diaristas FOR ALL
  USING (public.has_module_access(auth.uid(), 'financeiro'))
  WITH CHECK (public.has_module_access(auth.uid(), 'financeiro'));

CREATE TRIGGER diaristas_set_updated_at
  BEFORE UPDATE ON public.diaristas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.diarista_apontamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diarista_id uuid REFERENCES public.diaristas(id) ON DELETE CASCADE,
  empresa text,
  atividade text,
  projeto text,
  comodos text,
  data date NOT NULL,
  hora_inicial time NOT NULL,
  hora_final time NOT NULL,
  intervalo_minutos integer NOT NULL DEFAULT 0,
  local text NOT NULL DEFAULT 'fortaleza',
  obs text,
  extra_manual numeric NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.diarista_apontamentos TO authenticated;
GRANT ALL ON public.diarista_apontamentos TO service_role;

ALTER TABLE public.diarista_apontamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Financeiro pode gerenciar apontamentos"
  ON public.diarista_apontamentos FOR ALL
  USING (public.has_module_access(auth.uid(), 'financeiro'))
  WITH CHECK (public.has_module_access(auth.uid(), 'financeiro'));

CREATE TRIGGER diarista_apontamentos_set_updated_at
  BEFORE UPDATE ON public.diarista_apontamentos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX diarista_apontamentos_diarista_idx ON public.diarista_apontamentos(diarista_id);
CREATE INDEX diarista_apontamentos_data_idx ON public.diarista_apontamentos(data);
