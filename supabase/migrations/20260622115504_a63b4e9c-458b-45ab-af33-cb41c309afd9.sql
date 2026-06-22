UPDATE public.itens
SET quantidade_atual = ROUND(quantidade_atual::numeric, 2)
WHERE quantidade_atual IS NOT NULL
  AND quantidade_atual <> ROUND(quantidade_atual::numeric, 2);

UPDATE public.movimentacoes
SET quantidade = ROUND(quantidade::numeric, 2)
WHERE quantidade IS NOT NULL
  AND quantidade <> ROUND(quantidade::numeric, 2);

UPDATE public.movimentacao_itens
SET quantidade = ROUND(quantidade::numeric, 2)
WHERE quantidade IS NOT NULL
  AND quantidade <> ROUND(quantidade::numeric, 2);