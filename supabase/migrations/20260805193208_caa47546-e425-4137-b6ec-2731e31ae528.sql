CREATE TABLE public.eventos_terceirizados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  documento text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.eventos_terceirizados TO authenticated;
GRANT ALL ON public.eventos_terceirizados TO service_role;

ALTER TABLE public.eventos_terceirizados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terceirizados: leitura autenticada"
  ON public.eventos_terceirizados FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Terceirizados: inserir com acesso a eventos"
  ON public.eventos_terceirizados FOR INSERT TO authenticated
  WITH CHECK (public.has_module_access(auth.uid(), 'eventos'));

CREATE POLICY "Terceirizados: editar com acesso a eventos"
  ON public.eventos_terceirizados FOR UPDATE TO authenticated
  USING (public.has_module_access(auth.uid(), 'eventos'))
  WITH CHECK (public.has_module_access(auth.uid(), 'eventos'));

CREATE POLICY "Terceirizados: excluir admin"
  ON public.eventos_terceirizados FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'eventos'));

CREATE TRIGGER eventos_terceirizados_updated_at
  BEFORE UPDATE ON public.eventos_terceirizados
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.eventos
  ADD COLUMN produtor_terceirizado boolean NOT NULL DEFAULT false,
  ADD COLUMN terceirizado_id uuid REFERENCES public.eventos_terceirizados(id) ON DELETE SET NULL;