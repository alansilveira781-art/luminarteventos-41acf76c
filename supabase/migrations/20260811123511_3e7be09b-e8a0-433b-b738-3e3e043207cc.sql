ALTER TABLE public.juridico_contratos
  ADD COLUMN IF NOT EXISTS evento_id uuid REFERENCES public.eventos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS venda_id uuid REFERENCES public.comercial_vendas(id) ON DELETE SET NULL;