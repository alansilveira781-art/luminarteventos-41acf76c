-- Garantia real no banco: estoque não pode ficar negativo.
-- Antes de adicionar o CHECK, normaliza qualquer saldo negativo herdado para zero.
UPDATE public.itens SET quantidade_atual = 0 WHERE quantidade_atual < 0;

ALTER TABLE public.itens
  DROP CONSTRAINT IF EXISTS chk_itens_quantidade_nao_negativa;
ALTER TABLE public.itens
  ADD CONSTRAINT chk_itens_quantidade_nao_negativa
  CHECK (quantidade_atual >= 0);