INSERT INTO public.modulos (slug, nome, rota, ordem, icone, ativo)
VALUES ('financeiro_op', 'Financeiro', '/financeiro-op', 45, 'DollarSign', true)
ON CONFLICT (slug) DO NOTHING;