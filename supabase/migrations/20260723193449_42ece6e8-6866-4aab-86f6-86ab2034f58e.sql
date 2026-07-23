
-- =========================
-- op_setores
-- =========================
CREATE TABLE public.op_setores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  slug text UNIQUE NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  responsavel_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.op_setores TO authenticated;
GRANT ALL ON public.op_setores TO service_role;

ALTER TABLE public.op_setores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "op_setores_select" ON public.op_setores
  FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'operacao'));

CREATE POLICY "op_setores_admin_all" ON public.op_setores
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'operacao'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'operacao'));

CREATE TRIGGER trg_op_setores_updated_at
  BEFORE UPDATE ON public.op_setores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- op_setor_etapas
-- =========================
CREATE TABLE public.op_setor_etapas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setor_id uuid NOT NULL REFERENCES public.op_setores(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ordem integer NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_op_setor_etapas_setor ON public.op_setor_etapas(setor_id, ordem);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.op_setor_etapas TO authenticated;
GRANT ALL ON public.op_setor_etapas TO service_role;

ALTER TABLE public.op_setor_etapas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "op_setor_etapas_select" ON public.op_setor_etapas
  FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'operacao'));

CREATE POLICY "op_setor_etapas_admin_all" ON public.op_setor_etapas
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'operacao'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'operacao'));

-- =========================
-- Seed setores
-- =========================
INSERT INTO public.op_setores (nome, slug, ordem) VALUES
  ('Costura',            'costura',            10),
  ('Usinagem',           'usinagem',           20),
  ('Metalurgia',         'metalurgia',         30),
  ('Estrutura',          'estrutura',          40),
  ('Comunicação Visual', 'comunicacao_visual', 50),
  ('Marcenaria',         'marcenaria',         60),
  ('Almoxarifado',       'almoxarifado',       70),
  ('Iluminação',         'iluminacao',         80),
  ('Pintura',            'pintura',            90);

-- =========================
-- Seed etapas por setor
-- =========================
-- Estrutura
INSERT INTO public.op_setor_etapas (setor_id, nome, ordem)
SELECT id, e.nome, e.ordem FROM public.op_setores s
CROSS JOIN (VALUES
  ('Início', 10),
  ('Conferir material', 20),
  ('Verificar solda/peças', 30),
  ('Montagem', 40),
  ('Desmontagem', 50),
  ('Finalizado', 60)
) e(nome, ordem)
WHERE s.slug = 'estrutura';

-- Marcenaria (com macro-fluxo Item 03 embutido)
INSERT INTO public.op_setor_etapas (setor_id, nome, ordem)
SELECT id, e.nome, e.ordem FROM public.op_setores s
CROSS JOIN (VALUES
  ('Início', 10),
  ('Verificar acervo', 20),
  ('Identificar se precisa fabricar', 30),
  ('Fabricação', 40),
  ('Pré-montagem', 50),
  ('Embalagem', 60),
  ('Montagem', 70),
  ('Desmontagem', 80),
  ('Finalizado', 90)
) e(nome, ordem)
WHERE s.slug = 'marcenaria';

-- Comunicação Visual
INSERT INTO public.op_setor_etapas (setor_id, nome, ordem)
SELECT id, e.nome, e.ordem FROM public.op_setores s
CROSS JOIN (VALUES
  ('Início', 10),
  ('Verificar banco de dados/arquivo', 20),
  ('Compatibilizar com projeto', 30),
  ('Finalizar arte', 40),
  ('Enviar para impressão', 50),
  ('Montagem', 60),
  ('Finalizado', 70)
) e(nome, ordem)
WHERE s.slug = 'comunicacao_visual';

-- Costura
INSERT INTO public.op_setor_etapas (setor_id, nome, ordem)
SELECT id, e.nome, e.ordem FROM public.op_setores s
CROSS JOIN (VALUES
  ('Início', 10),
  ('Quantitativo do material', 20),
  ('Separar por evento', 30),
  ('Produção', 40),
  ('Finalizado', 50)
) e(nome, ordem)
WHERE s.slug = 'costura';

-- Almoxarifado
INSERT INTO public.op_setor_etapas (setor_id, nome, ordem)
SELECT id, e.nome, e.ordem FROM public.op_setores s
CROSS JOIN (VALUES
  ('Início', 10),
  ('Verificar/separar (se não tem, solicitar compra)', 20),
  ('Finalizado', 30)
) e(nome, ordem)
WHERE s.slug = 'almoxarifado';

-- Usinagem
INSERT INTO public.op_setor_etapas (setor_id, nome, ordem)
SELECT id, e.nome, e.ordem FROM public.op_setores s
CROSS JOIN (VALUES
  ('Início', 10),
  ('Programar arquivo', 20),
  ('Cortar', 30),
  ('Conferir', 40),
  ('Separar por evento', 50),
  ('Finalizado', 60)
) e(nome, ordem)
WHERE s.slug = 'usinagem';

-- Iluminação
INSERT INTO public.op_setor_etapas (setor_id, nome, ordem)
SELECT id, e.nome, e.ordem FROM public.op_setores s
CROSS JOIN (VALUES
  ('Início', 10),
  ('Verificar necessidade vs estoque (se falta, solicitar compra)', 20),
  ('Finalizado', 30)
) e(nome, ordem)
WHERE s.slug = 'iluminacao';

-- Metalurgia (com macro-fluxo produção)
INSERT INTO public.op_setor_etapas (setor_id, nome, ordem)
SELECT id, e.nome, e.ordem FROM public.op_setores s
CROSS JOIN (VALUES
  ('Início', 10),
  ('Verificar material (se falta, solicitar compra)', 20),
  ('Produção', 30),
  ('Pintura', 40),
  ('Pré-montagem', 50),
  ('Finalizado', 60)
) e(nome, ordem)
WHERE s.slug = 'metalurgia';

-- Pintura
INSERT INTO public.op_setor_etapas (setor_id, nome, ordem)
SELECT id, e.nome, e.ordem FROM public.op_setores s
CROSS JOIN (VALUES
  ('Início', 10),
  ('Depurar', 20),
  ('Pintar', 30),
  ('Pré-montagem', 40),
  ('Embalar', 50),
  ('Finalizado', 60)
) e(nome, ordem)
WHERE s.slug = 'pintura';
