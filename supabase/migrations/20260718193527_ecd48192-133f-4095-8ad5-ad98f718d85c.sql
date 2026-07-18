
CREATE TABLE public.eventos_centros_custo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text UNIQUE NOT NULL,
  nome text NOT NULL,
  categoria text CHECK (categoria IN ('corporativo','stand','social','cenografia')),
  ativo boolean NOT NULL DEFAULT true,
  removido_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  classificado_por uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.eventos_centros_custo TO authenticated;
GRANT ALL ON public.eventos_centros_custo TO service_role;

ALTER TABLE public.eventos_centros_custo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financeiro module access"
  ON public.eventos_centros_custo
  FOR ALL
  USING (public.has_module_access(auth.uid(), 'financeiro'))
  WITH CHECK (public.has_module_access(auth.uid(), 'financeiro'));

CREATE TRIGGER eventos_centros_custo_set_updated_at
  BEFORE UPDATE ON public.eventos_centros_custo
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- set_updated_at usa NEW.updated_at; a coluna nesta tabela chama-se atualizado_em.
-- Trigger dedicado:
DROP TRIGGER eventos_centros_custo_set_updated_at ON public.eventos_centros_custo;

CREATE OR REPLACE FUNCTION public.eventos_centros_custo_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.atualizado_em = now(); RETURN NEW; END;
$$;

CREATE TRIGGER eventos_centros_custo_touch
  BEFORE UPDATE ON public.eventos_centros_custo
  FOR EACH ROW EXECUTE FUNCTION public.eventos_centros_custo_touch();

-- Backfill inicial
INSERT INTO public.eventos_centros_custo (external_id, nome, ativo)
SELECT external_id, nome, COALESCE(ativo, true) FROM public.ca_centros_custo
ON CONFLICT (external_id) DO NOTHING;
