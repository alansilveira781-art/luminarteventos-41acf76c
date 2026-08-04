ALTER TABLE public.op_setores ADD COLUMN IF NOT EXISTS fixo boolean NOT NULL DEFAULT false;
ALTER TABLE public.op_setor_etapas ADD COLUMN IF NOT EXISTS descricao text;
ALTER TABLE public.op_ordem_checklist ADD COLUMN IF NOT EXISTS descricao text;
ALTER TABLE public.op_ordens ADD COLUMN IF NOT EXISTS evento_id uuid REFERENCES public.eventos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS op_ordens_evento_id_idx ON public.op_ordens(evento_id);

INSERT INTO public.op_setores (nome, slug, ordem, ativo, fixo)
SELECT 'Preparação', 'preparacao', 1, true, true
WHERE NOT EXISTS (SELECT 1 FROM public.op_setores WHERE slug = 'preparacao');

INSERT INTO public.op_setores (nome, slug, ordem, ativo, fixo)
SELECT 'Executivo', 'executivo', 2, true, true
WHERE NOT EXISTS (SELECT 1 FROM public.op_setores WHERE slug = 'executivo');