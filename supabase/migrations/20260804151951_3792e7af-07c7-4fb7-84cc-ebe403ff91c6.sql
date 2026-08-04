ALTER TABLE public.op_ordens DROP CONSTRAINT IF EXISTS op_ordens_tipo_unidade_check;
ALTER TABLE public.op_ordens ADD CONSTRAINT op_ordens_tipo_unidade_check CHECK (tipo_unidade = ANY (ARRAY['peca'::text,'item_inteiro'::text,'un'::text]));

ALTER TABLE public.op_ordens DROP CONSTRAINT IF EXISTS op_ordens_origem_check;
ALTER TABLE public.op_ordens ADD CONSTRAINT op_ordens_origem_check CHECK (origem = ANY (ARRAY['avulsa'::text,'proposta'::text,'evento'::text]));

ALTER TABLE public.op_ordens DROP CONSTRAINT IF EXISTS op_ordens_status_check;
ALTER TABLE public.op_ordens ADD CONSTRAINT op_ordens_status_check CHECK (status = ANY (ARRAY['aberta'::text,'em_andamento'::text,'em_producao'::text,'finalizada'::text,'cancelada'::text]));