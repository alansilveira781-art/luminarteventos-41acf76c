
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS codigo_proprio text;
CREATE INDEX IF NOT EXISTS idx_itens_codigo_proprio ON public.itens (codigo_proprio);

CREATE TABLE IF NOT EXISTS public.unidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "estoque module access" ON public.unidades;
CREATE POLICY "estoque module access"
  ON public.unidades
  TO authenticated
  USING (has_module_access(auth.uid(), 'estoque'))
  WITH CHECK (has_module_access(auth.uid(), 'estoque'));

INSERT INTO public.unidades (nome) VALUES
  ('Unidade'), ('Metro'), ('M²'), ('Peça'), ('Rolo'), ('Litro'), ('Balde')
ON CONFLICT (nome) DO NOTHING;
