
CREATE TABLE IF NOT EXISTS public.eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text UNIQUE,
  nome text NOT NULL,
  local text,
  cidade text,
  tipo text,
  data_evento date NOT NULL,
  data_montagem date,
  data_desmontagem date,
  hora_inicio time,
  hora_fim time,
  responsavel text,
  observacoes text,
  cor text DEFAULT '#6366f1',
  origem text NOT NULL DEFAULT 'manual',
  venda_id uuid,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eventos_data ON public.eventos(data_evento);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.eventos TO authenticated;
GRANT SELECT ON public.eventos TO anon;
GRANT ALL ON public.eventos TO service_role;

ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eventos module access" ON public.eventos
  FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(), 'eventos'))
  WITH CHECK (public.has_module_access(auth.uid(), 'eventos'));

CREATE POLICY "eventos public read" ON public.eventos
  FOR SELECT TO anon
  USING (true);

CREATE OR REPLACE FUNCTION public.proximo_codigo_evento(_data date)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefixo text;
  v_count int;
BEGIN
  v_prefixo := to_char(_data, 'YYYYMM');
  SELECT count(*) INTO v_count
  FROM public.eventos
  WHERE to_char(data_evento, 'YYYYMM') = v_prefixo;
  RETURN v_prefixo || lpad((v_count + 1)::text, 2, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.proximo_codigo_evento(date) TO authenticated;

INSERT INTO public.modulos (slug, nome, rota, ordem, icone, ativo)
VALUES ('eventos', 'Eventos', '/eventos', 50, 'CalendarDays', true)
ON CONFLICT (slug) DO NOTHING;

CREATE TRIGGER eventos_updated_at BEFORE UPDATE ON public.eventos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
