
-- Desativa RH (dados preservados)
UPDATE public.modulos SET ativo = false WHERE slug = 'rh';

-- Registra módulo Operações
INSERT INTO public.modulos (slug, nome, descricao, icone, rota, ordem, ativo)
VALUES ('operacao', 'Operações', 'Gestão de produção por setor', 'Factory', '/operacao', 90, true)
ON CONFLICT (slug) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  icone = EXCLUDED.icone,
  rota = EXCLUDED.rota,
  ordem = EXCLUDED.ordem,
  ativo = true;

-- Jefferson Nascimento como admin do módulo Operações
INSERT INTO public.user_modulos (user_id, modulo_id, is_admin)
SELECT 'c547536a-ad0a-497e-87fd-191952e17dc3'::uuid, m.id, true
FROM public.modulos m
WHERE m.slug = 'operacao'
ON CONFLICT (user_id, modulo_id) DO UPDATE SET is_admin = true;
