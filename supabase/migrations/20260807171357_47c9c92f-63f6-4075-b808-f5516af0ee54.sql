ALTER TABLE public.diarista_apontamentos
  ADD COLUMN IF NOT EXISTS almoco boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS janta boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.diarista_config (
  id boolean PRIMARY KEY DEFAULT true,
  valor_almoco numeric NOT NULL DEFAULT 0,
  valor_janta numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT diarista_config_singleton CHECK (id)
);

GRANT SELECT, INSERT, UPDATE ON public.diarista_config TO authenticated;
GRANT ALL ON public.diarista_config TO service_role;

ALTER TABLE public.diarista_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "diarista_config_select" ON public.diarista_config
  FOR SELECT TO authenticated
  USING (public.is_diaria_admin(auth.uid()) OR public.pode_lancar_diaria(auth.uid()));

CREATE POLICY "diarista_config_insert" ON public.diarista_config
  FOR INSERT TO authenticated
  WITH CHECK (public.is_diaria_admin(auth.uid()));

CREATE POLICY "diarista_config_update" ON public.diarista_config
  FOR UPDATE TO authenticated
  USING (public.is_diaria_admin(auth.uid()))
  WITH CHECK (public.is_diaria_admin(auth.uid()));

CREATE TRIGGER trg_diarista_config_updated_at
  BEFORE UPDATE ON public.diarista_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.diarista_config (id) VALUES (true) ON CONFLICT (id) DO NOTHING;