
-- 1) Novos tipos de saída (manter epi_fardamento por compatibilidade)
ALTER TYPE saida_tipo ADD VALUE IF NOT EXISTS 'epi';
ALTER TYPE saida_tipo ADD VALUE IF NOT EXISTS 'fardamento';
ALTER TYPE saida_tipo ADD VALUE IF NOT EXISTS 'producao_novos_itens';

-- 2) Coluna de desconto percentual em compra_itens
ALTER TABLE public.compra_itens
  ADD COLUMN IF NOT EXISTS desconto_percentual NUMERIC NULL;

-- 3) Tabela de anexos da compra
CREATE TABLE IF NOT EXISTS public.compra_anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id UUID NOT NULL,
  nome TEXT NOT NULL,
  path TEXT NOT NULL,
  mime_type TEXT,
  tamanho BIGINT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compra_anexos_compra_id ON public.compra_anexos(compra_id);

ALTER TABLE public.compra_anexos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "compra_anexos module access" ON public.compra_anexos;
CREATE POLICY "compra_anexos module access"
  ON public.compra_anexos
  FOR ALL
  TO authenticated
  USING (has_module_access(auth.uid(), 'compras') OR has_module_access(auth.uid(), 'estoque'))
  WITH CHECK (has_module_access(auth.uid(), 'compras') OR has_module_access(auth.uid(), 'estoque'));

-- 4) Bucket de storage para anexos (privado)
INSERT INTO storage.buckets (id, name, public)
VALUES ('compra-anexos', 'compra-anexos', false)
ON CONFLICT (id) DO NOTHING;

-- Policies do bucket: leitura/escrita/exclusão para usuários com acesso a compras ou estoque
DROP POLICY IF EXISTS "compra-anexos read" ON storage.objects;
CREATE POLICY "compra-anexos read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'compra-anexos' AND (has_module_access(auth.uid(), 'compras') OR has_module_access(auth.uid(), 'estoque')));

DROP POLICY IF EXISTS "compra-anexos insert" ON storage.objects;
CREATE POLICY "compra-anexos insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'compra-anexos' AND (has_module_access(auth.uid(), 'compras') OR has_module_access(auth.uid(), 'estoque')));

DROP POLICY IF EXISTS "compra-anexos update" ON storage.objects;
CREATE POLICY "compra-anexos update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'compra-anexos' AND (has_module_access(auth.uid(), 'compras') OR has_module_access(auth.uid(), 'estoque')));

DROP POLICY IF EXISTS "compra-anexos delete" ON storage.objects;
CREATE POLICY "compra-anexos delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'compra-anexos' AND (has_module_access(auth.uid(), 'compras') OR has_module_access(auth.uid(), 'estoque')));
